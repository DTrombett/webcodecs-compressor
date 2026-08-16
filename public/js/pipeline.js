/**
 * core/pipeline.js - Main video processing pipeline using MediaBunny Conversion API
 *
 * Transformations:
 * - Resize: via MediaBunny native scaling (width/height/fit)
 * - Speed: via custom process() modifying timestamp/duration on each sample
 * - Codec: via video.codec option (transcodes when needed)
 * - Audio: kept or discarded; timestamps modified via process() when speed != 1
 *
 * HEVC (H.265) is mapped to MP4 container.
 */

import {
	ALL_FORMATS,
	AudioSample,
	BlobSource,
	BufferTarget,
	Conversion,
	Input,
	MovOutputFormat,
	Mp4OutputFormat,
	Output,
	OutputFormat,
	Quality,
	VideoSample,
	WebMOutputFormat,
} from "mediabunny";
import {
	calculateCustomResize,
	CODEC_DEFINITIONS,
	dimensionsFromPreset,
} from "./video.js";

/** Internal lookup with output format classes attached for pipeline use */
/** @type {Record<import("mediabunny").VideoCodec, new (...args: any[]) => OutputFormat>} */
const FMT_MAP = {
	avc: Mp4OutputFormat,
	hevc: Mp4OutputFormat,
	vp8: WebMOutputFormat,
	vp9: WebMOutputFormat,
	av1: Mp4OutputFormat,
	prores: MovOutputFormat,
};

const BY_ID = Object.fromEntries(
	CODEC_DEFINITIONS.map((c) => [c.id, { ...c, fmt: FMT_MAP[c.id] }]),
);

/**
 * Derive output file name.
 * @param {string} originalName - The original name
 * @param {import("mediabunny").VideoCodec} codecId - The codec id
 */
export const deriveOutputFileName = (originalName, codecId) =>
	`${originalName.replace(/\.[^.]+$/, "")}_compressed${BY_ID[codecId] ? BY_ID[codecId].ext : ".mp4"}`;

/**
 * Build video process function — adjusts timestamps for speed.
 * Called by MediaBunny AFTER native resize/rotate.
 * @param {number} speed - The speed factor
 */
const makeVideoProcessFn = (speed) => (/** @type {VideoSample} */ sample) => {
	sample.setTimestamp(sample.timestamp / speed);
	sample.setDuration(sample.duration / speed);
	return sample;
};

/**
 * Build audio process function — adjusts timestamps for speed.
 * @param {number} speed - The speed factor
 */
const makeAudioProcessFn = (speed) => (/** @type {AudioSample} */ sample) => {
	sample.setTimestamp(sample.timestamp / speed);
	return sample;
};

/**
 * Full processing pipeline.
 *
 * @param {object} opts
 * @param {File} opts.file
 * @param {import("mediabunny").VideoCodec} opts.codec - Codec id: h264|hevc|vp8|vp9|av1
 * @param {string} [opts.resolution] - Resolution preset id or null (= original)
 * @param {number} [opts.customWidth] - Custom width (when resolution === 'custom')
 * @param {number} [opts.customHeight] - Custom height (when resolution === 'custom')
 * @param {number} [opts.speed] - Playback speed multiplier
 * @param {boolean} [opts.keepAudio] - Whether to keep the audio
 * @param {number} opts.bitrate - Video bitrate in bps
 * @param {Metadata} opts.metadata - Video metadata
 * @param {(progress: number) => void} [opts.onProgress]
 * @param {(status: string) => void} [opts.onStatus]
 * @param {(result: Conversion) => void} [opts.onConversionReady]
 * @returns {Promise<{ buffer: ArrayBuffer, fileName: string, mimeType: string,
 *                    inputSize: number, outputSize: number, srcDuration: number }>}
 */
export const processVideo = async ({
	file,
	codec,
	resolution,
	customWidth,
	customHeight,
	speed = 1.0,
	keepAudio = true,
	bitrate,
	metadata,
	onProgress,
	onStatus,
	onConversionReady,
}) => {
	const cfg = BY_ID[codec];
	if (!cfg) throw new Error(`Unknown codec: ${codec}`);
	const videoCodec = cfg.mbCodec;
	const outputFormat = new cfg.fmt();
	bitrate = Math.ceil(bitrate);

	/* ── 1. Open input ─────────────────────────────────────────────── */
	const input = new Input({
		source: new BlobSource(file),
		formats: ALL_FORMATS,
	});
	const audioTrack = await input.getPrimaryAudioTrack();
	let outW,
		outH,
		needsResize = false;

	/* ── 2. Resolve output dimensions ──────────────────────────────── */
	if (metadata.video) {
		outW = metadata.video.displayW;
		outH = metadata.video.displayH;
		if (resolution && resolution !== "original") {
			if (resolution === "custom" && customWidth && customHeight)
				({ width: outW, height: outH } = calculateCustomResize(
					customWidth,
					customHeight,
				));
			else {
				const presetH = parseInt(resolution, 10);

				if (!isNaN(presetH))
					({ width: outW, height: outH } = dimensionsFromPreset(
						presetH,
						metadata.video?.displayW,
						metadata.video?.displayH,
					));
			}
			needsResize =
				outW !== metadata.video?.displayW || outH !== metadata.video?.displayH;
		}
		// Safety: never upscale beyond source dimensions
		if (outW > metadata.video?.displayW || outH > metadata.video?.displayH) {
			outW = metadata.video?.displayW;
			outH = metadata.video?.displayH;
			needsResize = false;
		}
	}
	const doSpeed = Math.abs(speed - 1.0) > 0.001;
	if (onStatus) {
		const parts = [];
		if (needsResize)
			parts.push(
				`resize ${metadata.video?.displayW}×${metadata.video?.displayH} → ${outW}×${outH}`,
			);
		if (doSpeed) parts.push(`speed ${speed}×`);
		parts.push(`${cfg.label} @ ${(bitrate / 1000).toFixed(0)}kbps`);
		if (!keepAudio) parts.push("no audio");
		onStatus(parts.join(", "));
	}

	/* ── 3. Build output ───────────────────────────────────────────── */
	const output = new Output({
		format: outputFormat,
		target: new BufferTarget(),
	});

	/* ── 4. Initialise conversion ──────────────────────────────────── */
	const conversion = await Conversion.init({
		input,
		output,
		video: {
			codec: videoCodec,
			quality: new Quality({ bitrate: bitrate - 32000 }),
			...(needsResize ? { width: outW, height: outH, fit: "contain" } : {}),
			...(doSpeed ?
				{
					process: makeVideoProcessFn(speed),
					...(needsResize ?
						{ processedWidth: outW, processedHeight: outH }
					:	{}),
				}
			:	{}),
		},
		audio:
			keepAudio && audioTrack ?
				{
					codec: "opus",
					process: doSpeed ? makeAudioProcessFn(speed) : undefined,
					quality: new Quality({ bitrate: 32000 }),
				}
			:	{ discard: true },
	});

	if (!conversion.isValid)
		throw new Error(
			`Conversion invalid: ${conversion.discardedTracks.map((d) => d.reason).join("; ")}`,
		);
	onConversionReady?.(conversion);
	/* ── 5. Execute ────────────────────────────────────────────────── */
	conversion.onProgress = onProgress;
	onStatus?.("Processing…");
	await conversion.execute();

	/* ── 6. Return ─────────────────────────────────────────────────── */
	const buffer = output.target.buffer;
	const mimeType = output.format.mimeType;
	const fileName = deriveOutputFileName(file.name, codec);

	if (!buffer) throw new Error("Conversion not completed!");
	return {
		buffer,
		fileName,
		mimeType,
		inputSize: metadata.fileSize,
		outputSize: buffer.byteLength,
		srcDuration: metadata.duration,
	};
};
