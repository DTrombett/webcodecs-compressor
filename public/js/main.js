/**
 * main.js - Alpine.js application controller (zero static MediaBunny imports).
 * Exports a factory function for Alpine registration.
 */

import {
	ALL_FORMATS,
	BlobSource,
	canDecodeVideo,
	canEncodeVideo,
	ConversionCanceledError,
	Input,
	Quality,
} from "mediabunny";
import { processVideo } from "./pipeline.js";
import { CODEC_DEFINITIONS, RESOLUTION_PRESETS } from "./video.js";

/** SDR-only codecs for HDR warning */
const SDR_ONLY_CODEC_IDS = ["h264", "vp8"];

/** @returns {AppState} */
export default () => ({
	/* ── state ──────────────────────────────────────────────────── */
	file: null,
	dragging: false,
	processing: false,
	progress: 0,
	error: null,
	statusMessage: "",
	downloadUrl: null,
	outputFileName: "",
	metadata: null,
	codecs: [],
	currentConversion: null,
	settings: {
		resolution: "original",
		size: 20,
		discardAudio: false,
		autoDownload: true,
		discardVideo: false,
		mono: false,
	},
	isHdrSource: false,
	presets: RESOLUTION_PRESETS,
	/* ── computed ───────────────────────────────────────────────── */
	get canStart() {
		return this.file != null && !this.processing;
	},
	get disabledCodecs() {
		return this.codecs.filter((c) => !c.supported);
	},
	get selectedCodec() {
		return this.codecs.find((c) => c.id === this.settings.videoCodec);
	},
	get selectedUnsupported() {
		const obj = this.selectedCodec;

		return obj && !obj.supported;
	},
	get unsupportedTooltip() {
		return this.selectedCodec?.tooltip || "Not supported";
	},
	get decodeStatus() {
		const codec = this.selectedCodec;

		if (!codec) return null;
		return {
			supported: codec.decodeSupported,
			label: codec.decodeSupported ? "Supported" : "Not supported",
		};
	},
	get decodeTooltip() {
		const codec = this.selectedCodec;

		if (!codec) return "";
		if (!codec.decodeSupported)
			return "Browser does not support decoding this codec";
		return "Decoding supported";
	},
	resolutionDisabled(preset) {
		return (
			this.metadata?.video?.displayH != null &&
			preset.height != null &&
			preset.height > this.metadata.video.displayH
		);
	},
	resolutionTooltip(preset) {
		return this.metadata?.video && this.resolutionDisabled(preset) ?
				`Higher than source (${this.metadata.video.displayH}p)`
			:	"";
	},
	/* ── init: detect codecs ────────────────────────────────────── */
	async init() {
		try {
			this.codecs = await Promise.all(
				CODEC_DEFINITIONS.map(async (def) => {
					const [encodeOk, decodeOk] = await Promise.all([
						canEncodeVideo(def.mbCodec).catch(() => false),
						canDecodeVideo(def.mbCodec).catch(() => false),
					]);
					const tooltipParts = [];

					if (!encodeOk) tooltipParts.push("Encode not supported.");
					if (!decodeOk) tooltipParts.push("Decode not supported.");
					return {
						id: def.id,
						label: def.label,
						supported: encodeOk,
						decodeSupported: decodeOk,
						tooltip: tooltipParts.join(" ") || "Supported",
					};
				}),
			);
			const first = this.codecs.find((c) => c.supported);
			if (first) this.settings.videoCodec = first.id;
		} catch (e) {
			console.warn("[codecs] detection failed", e);
			this.codecs = [];
		}
	},
	/* ── file handling ──────────────────────────────────────────── */
	handleFileSelect(event) {
		if (event.target.files?.length) this.setFile(event.target.files[0]);
	},
	handleDrop(event) {
		this.dragging = false;
		const f = event.dataTransfer?.files?.[0];
		if (f) this.setFile(f);
	},
	async setFile(file) {
		this.file = file;
		this.error = null;
		this.downloadUrl = null;
		this.metadata = null;
		try {
			const input = new Input({
				source: new BlobSource(file),
				formats: ALL_FORMATS,
			});
			const [size, duration, format, videoTrack, audioTrack] =
				await Promise.all([
					input.source.getSize(),
					input
						.getDurationFromMetadata()
						.then((d) => d ?? input.computeDuration()),
					input.getFormat(),
					input.getPrimaryVideoTrack(),
					input.getPrimaryAudioTrack(),
				]);

			/** @type {VideoInfo?} */
			let videoInfo = null;
			if (videoTrack) {
				const [
					frameRateMetrics,
					par,
					colorSpace,
					codec,
					codedW,
					codedH,
					displayW,
					displayH,
					rotation,
					bitrate,
					hdr,
				] = await Promise.all([
					videoTrack.computeFrameRateMetrics(),
					videoTrack.getPixelAspectRatio(),
					videoTrack.getColorSpace(),
					videoTrack.getCodec(),
					videoTrack.getCodedWidth(),
					videoTrack.getCodedHeight(),
					videoTrack.getDisplayWidth(),
					videoTrack.getDisplayHeight(),
					videoTrack.getRotation(),
					videoTrack
						.getAverageBitrate()
						.then((bitrate) => bitrate ?? videoTrack.getBitrate()),
					videoTrack.hasHighDynamicRange(),
				]);

				videoInfo = {
					codec,
					codedW,
					codedH,
					displayW,
					displayH,
					fps: frameRateMetrics.bestGuessFrameRate,
					rotation,
					bitrate,
					aspectRatio: `${par.num}:${par.den}`,
					colorSpace: colorSpace.matrix ?? "unknown",
					hdr,
				};
			}

			/** @type {AudioInfo?} */
			let audioInfo = null;
			if (audioTrack) {
				const [channels, codec, sampleRate, bitrate] = await Promise.all([
					audioTrack.getNumberOfChannels(),
					audioTrack.getCodec(),
					audioTrack.getSampleRate(),
					audioTrack
						.getAverageBitrate()
						.then((bitrate) => bitrate ?? audioTrack.getBitrate()),
				]);

				audioInfo = {
					codec,
					channels: channels,
					channelLabel: this._channelLabel(channels),
					sampleRate,
					bitrate,
				};
			}
			const totalBitrate = (size * 8) / duration;
			this.metadata = {
				fileName: file.name,
				fileSize: size,
				fileSizeStr: this.formatSize(size),
				container: format.name,
				duration,
				durationStr: this.formatDuration(duration),
				totalBitrate,
				totalBitrateStr: `${Math.round(totalBitrate / 1000)} kbps`,
				video: videoInfo,
				audio: audioInfo,
			};
			this.isHdrSource = videoInfo?.hdr ?? false;
		} catch (e) {
			console.warn("[app] metadata read failed", e);
		}
	},
	clearFile() {
		this.file = null;
		this.metadata = null;
		this.error = null;
		this.downloadUrl = null;
		this.settings = {
			resolution: "original",
			size: 20,
			discardAudio: false,
			autoDownload: true,
			discardVideo: false,
			mono: false,
		};
		if (this.$refs?.fileInput) this.$refs.fileInput.value = "";
	},
	warning: null,
	setResolution(preset) {
		const srcH = this.metadata?.video?.displayH;
		if (!srcH || !preset.height) {
			this.settings.resolution =
				/** @type {keyof typeof RESOLUTION_PRESETS} */ (preset.id);
			return;
		}
		if (preset.height > srcH) {
			this.settings.resolution = "original";
			this.warning = `Selected resolution would exceed source (${srcH}p). Capped to original.`;
			setTimeout(() => {
				this.warning = null;
			}, 5000);
			return;
		}
		this.settings.resolution = /** @type {keyof typeof RESOLUTION_PRESETS} */ (
			preset.id
		);
		this.warning = null;
	},
	/** Validate that custom dimensions don't exceed source */
	validateCustomResolution() {
		const srcW = this.metadata?.video?.displayW;
		const srcH = this.metadata?.video?.displayH;
		if (!srcW || !srcH) return;
		const cW = this.settings.customWidth;
		const cH = this.settings.customHeight;

		if (cW && cW > srcW) {
			this.settings.customWidth = srcW;
			this.warning = `Width capped to source (${srcW}px).`;
			setTimeout(() => {
				this.warning = null;
			}, 5000);
		}
		if (cH && cH > srcH) {
			this.settings.customHeight = srcH;
			this.warning = `Height capped to source (${srcH}px).`;
			setTimeout(() => {
				this.warning = null;
			}, 5000);
		}
		return;
	},
	/* ── processing ─────────────────────────────────────────────── */
	async startProcessing() {
		if (!this.file || this.processing || !this.metadata) return;

		// Safety check: custom resolution must not exceed source
		if (this.settings.resolution === "custom") {
			this.validateCustomResolution();
			if (this.warning) {
				this.error = this.warning;
				return;
			}
			if (!this.settings.customWidth || !this.settings.customHeight) {
				this.error =
					"Please enter both width and height for custom resolution.";
				return;
			}
		}

		// Warn about HDR→SDR conversion
		if (
			this.isHdrSource &&
			this.settings.videoCodec &&
			SDR_ONLY_CODEC_IDS.includes(this.settings.videoCodec)
		) {
			this.warning =
				"HDR source will be converted to SDR. Colors may appear washed.";
			setTimeout(() => {
				this.warning = null;
			}, 5000);
		}

		this.processing = true;
		this.progress = 0;
		this.error = null;
		this.statusMessage = "Initializing…";
		this.downloadUrl = null;
		this.currentConversion = null;
		try {
			const result = await processVideo(
				new BlobSource(this.file),
				{
					codec: this.settings.videoCodec,
					crop: this.settings.crop,
					discard: this.settings.discardVideo,
					frameRate: this.settings.frameRate,
					height:
						this.settings.resolution === "custom" ?
							this.settings.customHeight
						:	RESOLUTION_PRESETS[this.settings.resolution]?.height,
					width:
						this.settings.resolution === "custom" ?
							this.settings.customWidth
						:	undefined,
					keyFrameInterval: this.settings.keyFrameInterval,
					quality: new Quality({
						bitrate: Math.round(
							(this.settings.size * 1000 * 1000 * 8) / this.metadata.duration,
						),
					}),
				},
				{
					codec: this.settings.audioCodec,
					discard: this.settings.discardAudio,
					mono: this.settings.mono,
					sampleRate: this.settings.sampleRate,
				},
				{
					metadata: this.metadata,
					onProgress: (p) => {
						this.progress = p;
						this.statusMessage = `Processing... (${Math.floor(p * 100)}%)`;
					},
					onConversionReady: (conv) => {
						this.statusMessage = "Processing...";
						this.currentConversion = conv;
					},
				},
			);
			const blob = new Blob([result.buffer], { type: result.mimeType });
			const url = URL.createObjectURL(blob);
			this.downloadUrl = url;
			this.outputFileName = result.fileName;
			const pct = ((result.outputSize / result.inputSize) * 100).toFixed(1);
			this.statusMessage = `Done! ${this.formatSize(result.outputSize)} (${pct}% of source)`;
			if (this.settings.autoDownload)
				this._triggerDownload(url, result.fileName);
		} catch (err) {
			console.error("[app] processing error", err);
			if (err instanceof ConversionCanceledError)
				this.statusMessage = "Cancelled.";
			else {
				this.error =
					err instanceof Error ?
						err.message
					:	"Unexpected error during processing.";
				this.statusMessage = "";
			}
		} finally {
			this.processing = false;
			this.currentConversion = null;
		}
	},
	async cancelProcessing() {
		if (this.currentConversion) await this.currentConversion.cancel();
	},
	/* ── helpers ─────────────────────────────────────────────────── */
	_channelLabel(n) {
		return (
			{ 1: "Mono", 2: "Stereo", 6: "5.1 Surround", 8: "7.1 Surround" }[n] ??
			`${n}ch`
		);
	},
	formatSize(bytes) {
		const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
		if (!bytes) return "0 Bytes";
		const i = Math.floor(Math.log(bytes) / Math.log(1000));

		return `${(bytes / 1000 ** i).toFixed(1)}${sizes[i]}`;
	},
	formatDuration(sec) {
		if (!sec || isNaN(sec)) return "--:--";
		const h = Math.floor(sec / 3600);
		const m = Math.floor((sec % 3600) / 60);
		const s = Math.floor(sec % 60);

		if (h > 0)
			return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
		return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	},
	_triggerDownload(url, filename) {
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		a.style.display = "none";
		document.body.appendChild(a);
		a.click();
		requestAnimationFrame(() => {
			if (a.parentNode) a.remove();
		});
	},
});
