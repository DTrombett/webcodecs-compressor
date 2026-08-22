import {
	ALL_FORMATS,
	BlobSource,
	canEncodeAudio,
	canEncodeVideo,
	Input,
} from "mediabunny";
import { channelLabel, fill, formatDuration, formatSize } from "./utils.js";
import { AUDIO_CODEC_DEFINITIONS, VIDEO_CODEC_DEFINITIONS } from "./video.js";

const elements = {
	fileInput: /** @type {HTMLInputElement} */ (
		document.getElementById("fileInput")
	),
	dropZone: /** @type {HTMLDivElement} */ (document.getElementById("dropZone")),
	metadata: /** @type {HTMLDivElement} */ (document.getElementById("metadata")),
	metadataVideo: /** @type {HTMLDetailsElement} */ (
		document.getElementById("metadataVideo")
	),
	settingsVideoCodec: /** @type {HTMLSelectElement} */ (
		document.getElementById("settingsVideoCodec")
	),
	settingsAudioCodec: /** @type {HTMLSelectElement} */ (
		document.getElementById("settingsAudioCodec")
	),
	metadataAudio: /** @type {HTMLDetailsElement} */ (
		document.getElementById("metadataAudio")
	),
	fileSelection: /** @type {HTMLDivElement} */ (
		document.getElementById("fileSelection")
	),
	removeFile: /** @type {HTMLButtonElement} */ (
		document.getElementById("removeFile")
	),
	settings: /** @type {HTMLDivElement} */ (document.getElementById("settings")),
};

/** @type {AppState} */
const state = {
	input: null,
	processing: false,
	progress: 0,
	error: null,
	statusMessage: "",
	downloadUrl: null,
	outputFileName: "",
	metadata: null,
	codecs: [],
	currentConversion: null,
	isHdrSource: false,
};

/**
 * Check which codecs are supported for video encoding.
 */
const checkVideoCodecs = async () => {
	await Promise.allSettled(
		VIDEO_CODEC_DEFINITIONS.map(async (def, i) => {
			if (await canEncodeVideo(def.id)) {
				const option = document.createElement("option");

				option.text = def.label;
				option.value = def.id;
				elements.settingsVideoCodec.options.add(option, i + 1);
			}
		}),
	);
	elements.settingsVideoCodec.options.remove(0);
	elements.settingsVideoCodec.selectedIndex = 0;
};
/**
 * Check which codecs are supported for audio encoding.
 */
const checkAudioCodecs = async () => {
	await Promise.allSettled(
		AUDIO_CODEC_DEFINITIONS.map(async (def, i) => {
			if (await canEncodeAudio(def.id)) {
				const option = document.createElement("option");

				option.text = def.label;
				option.value = def.id;
				elements.settingsAudioCodec.options.add(option, i + 1);
			}
		}),
	);
	elements.settingsAudioCodec.options.remove(0);
	elements.settingsAudioCodec.selectedIndex = 0;
};

checkVideoCodecs();
checkAudioCodecs();
window.addEventListener("dragover", (ev) => {
	if (
		ev.dataTransfer &&
		[...ev.dataTransfer.items].some((item) => item.kind === "file")
	) {
		ev.preventDefault();
		if (!(ev.target instanceof Node && elements.dropZone.contains(ev.target)))
			ev.dataTransfer.dropEffect = "none";
	}
});
window.addEventListener("drop", (ev) => {
	if (
		ev.dataTransfer &&
		[...ev.dataTransfer.items].some((item) => item.kind === "file")
	)
		ev.preventDefault();
});
elements.dropZone.addEventListener("dragover", (e) => {
	const fileItems =
		e.dataTransfer ?
			[...e.dataTransfer?.items].filter((item) => item.kind === "file")
		:	[];

	if (e.dataTransfer && fileItems.length > 0) {
		e.preventDefault();
		if (
			fileItems.some(
				(item) =>
					item.type.startsWith("video/") || item.type.startsWith("audio/"),
			)
		) {
			elements.dropZone.classList.add("drag-over");
			e.dataTransfer.dropEffect = "copy";
		} else {
			elements.dropZone.classList.add("drag-invalid");
			e.dataTransfer.dropEffect = "none";
		}
	}
});
elements.dropZone.addEventListener("dragleave", () => {
	elements.dropZone.classList.remove("drag-over", "drag-invalid");
});
elements.dropZone.addEventListener("drop", (ev) => {
	ev.preventDefault();
	elements.dropZone.classList.remove("drag-over", "drag-invalid");
	elements.fileInput.files = ev.dataTransfer?.files ?? null;
	elements.fileInput.dispatchEvent(
		new Event("change", { bubbles: true, cancelable: false, composed: false }),
	);
});
elements.fileInput.addEventListener("change", async () => {
	const file = elements.fileInput.files?.[0];

	fill("fileName", file?.name ?? null);
	fill("fileSize", file ? formatSize(file.size) : null);
	if (file)
		if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
			state.error = null;
			state.downloadUrl = null;
			state.metadata = null;
			try {
				const input = (state.input = new Input({
					source: new BlobSource(file),
					formats: ALL_FORMATS,
				}));
				const [duration, format, videoTrack, audioTrack] = await Promise.all([
					input
						.getDurationFromMetadata()
						.then((d) => d ?? input.computeDuration()),
					input.getFormat(),
					input.getPrimaryVideoTrack(),
					input.getPrimaryAudioTrack(),
				]);

				elements.metadataVideo.style.display = videoTrack ? "" : "none";
				elements.metadataAudio.style.display = audioTrack ? "" : "none";
				fill("inputFormat", format.name);
				fill("inputDuration", formatDuration(duration));
				fill(
					"inputBitrate",
					`${Math.round((file.size * 8) / duration / 1000).toLocaleString()} kbps`,
				);
				const [
					videoFrameRateMetrics,
					videoColorSpace,
					videoCodec,
					videoDisplayW,
					videoDisplayH,
					videoBitrate,
				] = await Promise.all([
					videoTrack?.computeFrameRateMetrics(),
					videoTrack?.getColorSpace(),
					videoTrack?.getCodec(),
					videoTrack?.getDisplayWidth(),
					videoTrack?.getDisplayHeight(),
					videoTrack
						?.getAverageBitrate()
						.then((bitrate) => bitrate ?? videoTrack.getBitrate()),
				]);
				fill("inputVideoCodec", videoTrack ? (videoCodec ?? "unknown") : null);
				fill(
					"inputDisplaySize",
					videoTrack ? `${videoDisplayW}×${videoDisplayH}` : null,
				);
				fill(
					"inputVideoFps",
					videoFrameRateMetrics ?
						`${videoFrameRateMetrics.bestGuessFrameRate.toLocaleString()} fps`
					:	null,
				);
				fill(
					"inputVideoBitrate",
					videoTrack ?
						videoBitrate ? `${(videoBitrate / 1000).toLocaleString()} kbps`
						:	"unknown"
					:	null,
				);
				fill(
					"inputVideoColorSpace",
					videoTrack ? (videoColorSpace?.matrix ?? "unknown") : null,
				);
				const resolution = Math.min(videoDisplayH ?? 0, videoDisplayW ?? 0);
				fill("inputResolution", resolution ? `${resolution}p` : null);
				const [audioChannels, audioCodec, audioSampleRate, audioBitrate] =
					await Promise.all([
						audioTrack?.getNumberOfChannels(),
						audioTrack?.getCodec(),
						audioTrack?.getSampleRate(),
						audioTrack
							?.getAverageBitrate()
							.then((bitrate) => bitrate ?? audioTrack.getBitrate()),
					]);
				fill("inputAudioCodec", audioTrack ? (audioCodec ?? "unknown") : null);
				fill(
					"inputAudioChannels",
					audioChannels ? channelLabel(audioChannels) : null,
				);
				fill(
					"inputAudioSampleRate",
					audioSampleRate ? `${audioSampleRate.toLocaleString()} Hz` : null,
				);
				fill(
					"inputAudioBitrate",
					audioTrack ?
						audioBitrate ? `${(audioBitrate / 1000).toLocaleString()} kbps`
						:	"unknown"
					:	null,
				);
				elements.fileSelection.style.display = "none";
				// const totalBitrate = (size * 8) / duration;
				// state.metadata = {
				// 	fileName: file.name,
				// 	fileSize: size,
				// 	fileSizeStr: formatSize(size),
				// 	container: format.name,
				// 	duration,
				// 	durationStr: formatDuration(duration),
				// 	totalBitrate,
				// 	totalBitrateStr: `${Math.round(totalBitrate / 1000)} kbps`,
				// 	video: videoInfo,
				// 	audio: audioInfo,
				// };
				// state.isHdrSource = videoInfo?.hdr ?? false;
				elements.settings.style.display = "";
				elements.metadata.style.display = "";
			} catch (e) {
				console.error("[app] metadata read failed", e);
				fill("inputFormat", null);
				fill("inputDuration", null);
				fill("inputBitrate", null);
				fill("inputVideoCodec", null);
				fill("inputDisplaySize", null);
				fill("inputVideoFps", null);
				fill("inputVideoBitrate", null);
				fill("inputVideoColorSpace", null);
				fill("inputAudioCodec", null);
				fill("inputAudioChannels", null);
				fill("inputAudioSampleRate", null);
				fill("inputAudioBitrate", null);
				fill("inputResolution", "unchanged");
				elements.settings.style.display = "none";
				elements.metadata.style.display = "none";
			}
			return;
		} else alert("The selected video or audio is not supported!");
	elements.settings.style.display = "none";
	elements.metadata.style.display = "none";
	elements.fileSelection.style.display = "";
	elements.fileInput.value = "";
	state.input?.dispose();
	state.input = null;
	state.metadata = null;
	state.error = null;
	state.downloadUrl = null;
	fill("inputFormat", null);
	fill("inputDuration", null);
	fill("inputBitrate", null);
	fill("inputVideoCodec", null);
	fill("inputDisplaySize", null);
	fill("inputVideoFps", null);
	fill("inputVideoBitrate", null);
	fill("inputVideoColorSpace", null);
	fill("inputAudioCodec", null);
	fill("inputAudioChannels", null);
	fill("inputAudioSampleRate", null);
	fill("inputAudioBitrate", null);
	fill("inputResolution", "unchanged");
});
elements.removeFile.addEventListener("click", (ev) => {
	ev.preventDefault();
	elements.fileInput.value = "";
	elements.fileInput.dispatchEvent(
		new Event("change", { bubbles: true, cancelable: false, composed: false }),
	);
});
document.body.querySelectorAll("select:has(~ .hiddenInput)").forEach((el) =>
	el.addEventListener("change", () => {
		console.log("change", el);
		const disabled = !(
			/** @type {HTMLSelectElement} */ (el).value === "custom"
		);

		for (const element of el.parentElement?.querySelectorAll(
			".hiddenInput select, .hiddenInput input, .hiddenInput textarea, .hiddenInput fieldset",
		) ?? [])
			/** @type {HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement | HTMLFieldSetElement} */ (
				element
			).disabled = disabled;
	}),
);

/** @returns {AppState} */
// export default () => ({
// 	get disabledCodecs() {
// 		return this.codecs.filter((c) => !c.supported);
// 	},
// 	get selectedCodec() {
// 		return this.codecs.find((c) => c.id === this.settings.videoCodec);
// 	},
// 	get selectedUnsupported() {
// 		const obj = this.selectedCodec;

// 		return obj && !obj.supported;
// 	},
// 	get unsupportedTooltip() {
// 		return this.selectedCodec?.tooltip || "Not supported";
// 	},
// 	get decodeStatus() {
// 		const codec = this.selectedCodec;

// 		if (!codec) return null;
// 		return {
// 			supported: codec.decodeSupported,
// 			label: codec.decodeSupported ? "Supported" : "Not supported",
// 		};
// 	},
// 	get decodeTooltip() {
// 		const codec = this.selectedCodec;

// 		if (!codec) return "";
// 		if (!codec.decodeSupported)
// 			return "Browser does not support decoding this codec";
// 		return "Decoding supported";
// 	},
// 	resolutionDisabled(preset) {
// 		return (
// 			this.metadata?.video?.displayH != null &&
// 			preset.height != null &&
// 			preset.height > this.metadata.video.displayH
// 		);
// 	},
// 	resolutionTooltip(preset) {
// 		return this.metadata?.video && this.resolutionDisabled(preset) ?
// 				`Higher than source (${this.metadata.video.displayH}p)`
// 			:	"";
// 	},
// 	/* ── init: detect codecs ────────────────────────────────────── */
// 	async init() {
// 		try {
// 			this.codecs = await Promise.all(
// 				CODEC_DEFINITIONS.map(async (def) => {
// 					const [encodeOk, decodeOk] = await Promise.all([
// 						canEncodeVideo(def.id).catch(() => false),
// 						canDecodeVideo(def.id).catch(() => false),
// 					]);
// 					const tooltipParts = [];

// 					if (!encodeOk) tooltipParts.push("Encode not supported.");
// 					if (!decodeOk) tooltipParts.push("Decode not supported.");
// 					return {
// 						id: def.id,
// 						label: def.label,
// 						supported: encodeOk,
// 						decodeSupported: decodeOk,
// 						tooltip: tooltipParts.join(" ") || "Supported",
// 					};
// 				}),
// 			);
// 			const first = this.codecs.find((c) => c.supported);
// 			if (first) this.settings.videoCodec = first.id;
// 		} catch (e) {
// 			console.warn("[codecs] detection failed", e);
// 			this.codecs = [];
// 		}
// 	},
// 	/* ── file handling ──────────────────────────────────────────── */
// 	handleFileSelect(event) {
// 		if (event.target.files?.length) this.setFile(event.target.files[0]);
// 	},
// 	handleDrop(event) {
// 		this.dragging = false;
// 		const f = event.dataTransfer?.files?.[0];
// 		if (f) this.setFile(f);
// 	},
// 	async setFile(file) {
// 		this.file = file;
// 		this.error = null;
// 		this.downloadUrl = null;
// 		this.metadata = null;
// 		try {
// 			const input = new Input({
// 				source: new BlobSource(file),
// 				formats: ALL_FORMATS,
// 			});
// 			const [size, duration, format, videoTrack, audioTrack] =
// 				await Promise.all([
// 					input.source.getSize(),
// 					input
// 						.getDurationFromMetadata()
// 						.then((d) => d ?? input.computeDuration()),
// 					input.getFormat(),
// 					input.getPrimaryVideoTrack(),
// 					input.getPrimaryAudioTrack(),
// 				]);

// 			/** @type {VideoInfo?} */
// 			let videoInfo = null;
// 			if (videoTrack) {
// 				const [
// 					frameRateMetrics,
// 					par,
// 					colorSpace,
// 					codec,
// 					codedW,
// 					codedH,
// 					displayW,
// 					displayH,
// 					rotation,
// 					bitrate,
// 					hdr,
// 				] = await Promise.all([
// 					videoTrack.computeFrameRateMetrics(),
// 					videoTrack.getPixelAspectRatio(),
// 					videoTrack.getColorSpace(),
// 					videoTrack.getCodec(),
// 					videoTrack.getCodedWidth(),
// 					videoTrack.getCodedHeight(),
// 					videoTrack.getDisplayWidth(),
// 					videoTrack.getDisplayHeight(),
// 					videoTrack.getRotation(),
// 					videoTrack
// 						.getAverageBitrate()
// 						.then((bitrate) => bitrate ?? videoTrack.getBitrate()),
// 					videoTrack.hasHighDynamicRange(),
// 				]);

// 				videoInfo = {
// 					codec,
// 					codedW,
// 					codedH,
// 					displayW,
// 					displayH,
// 					fps: frameRateMetrics.bestGuessFrameRate,
// 					rotation,
// 					bitrate,
// 					aspectRatio: `${par.num}:${par.den}`,
// 					colorSpace: colorSpace.matrix ?? "unknown",
// 					hdr,
// 				};
// 			}

// 			/** @type {AudioInfo?} */
// 			let audioInfo = null;
// 			if (audioTrack) {
// 				const [channels, codec, sampleRate, bitrate] = await Promise.all([
// 					audioTrack.getNumberOfChannels(),
// 					audioTrack.getCodec(),
// 					audioTrack.getSampleRate(),
// 					audioTrack
// 						.getAverageBitrate()
// 						.then((bitrate) => bitrate ?? audioTrack.getBitrate()),
// 				]);

// 				audioInfo = {
// 					codec,
// 					channels: channels,
// 					channelLabel: this._channelLabel(channels),
// 					sampleRate,
// 					bitrate,
// 				};
// 			}
// 			const totalBitrate = (size * 8) / duration;
// 			this.metadata = {
// 				fileName: file.name,
// 				fileSize: size,
// 				fileSizeStr: this.formatSize(size),
// 				container: format.name,
// 				duration,
// 				durationStr: this.formatDuration(duration),
// 				totalBitrate,
// 				totalBitrateStr: `${Math.round(totalBitrate / 1000)} kbps`,
// 				video: videoInfo,
// 				audio: audioInfo,
// 			};
// 			this.isHdrSource = videoInfo?.hdr ?? false;
// 		} catch (e) {
// 			console.warn("[app] metadata read failed", e);
// 		}
// 	},
// 	warning: null,
// 	setResolution(preset) {
// 		const srcH = this.metadata?.video?.displayH;
// 		if (!srcH || !preset.height) {
// 			this.settings.resolution =
// 				/** @type {keyof typeof RESOLUTION_PRESETS} */ (preset.id);
// 			return;
// 		}
// 		if (preset.height > srcH) {
// 			this.settings.resolution = "original";
// 			this.warning = `Selected resolution would exceed source (${srcH}p). Capped to original.`;
// 			setTimeout(() => {
// 				this.warning = null;
// 			}, 5000);
// 			return;
// 		}
// 		this.settings.resolution = /** @type {keyof typeof RESOLUTION_PRESETS} */ (
// 			preset.id
// 		);
// 		this.warning = null;
// 	},
// 	/** Validate that custom dimensions don't exceed source */
// 	validateCustomResolution() {
// 		const srcW = this.metadata?.video?.displayW;
// 		const srcH = this.metadata?.video?.displayH;
// 		if (!srcW || !srcH) return;
// 		const cW = this.settings.customWidth;
// 		const cH = this.settings.customHeight;

// 		if (cW && cW > srcW) {
// 			this.settings.customWidth = srcW;
// 			this.warning = `Width capped to source (${srcW}px).`;
// 			setTimeout(() => {
// 				this.warning = null;
// 			}, 5000);
// 		}
// 		if (cH && cH > srcH) {
// 			this.settings.customHeight = srcH;
// 			this.warning = `Height capped to source (${srcH}px).`;
// 			setTimeout(() => {
// 				this.warning = null;
// 			}, 5000);
// 		}
// 		return;
// 	},
// 	/* ── processing ─────────────────────────────────────────────── */
// 	async startProcessing() {
// 		if (!this.file || this.processing || !this.metadata) return;

// 		// Safety check: custom resolution must not exceed source
// 		if (this.settings.resolution === "custom") {
// 			this.validateCustomResolution();
// 			if (this.warning) {
// 				this.error = this.warning;
// 				return;
// 			}
// 			if (!this.settings.customWidth || !this.settings.customHeight) {
// 				this.error =
// 					"Please enter both width and height for custom resolution.";
// 				return;
// 			}
// 		}

// 		// Warn about HDR→SDR conversion
// 		if (
// 			this.isHdrSource &&
// 			this.settings.videoCodec &&
// 			SDR_ONLY_CODEC_IDS.includes(this.settings.videoCodec)
// 		) {
// 			this.warning =
// 				"HDR source will be converted to SDR. Colors may appear washed.";
// 			setTimeout(() => {
// 				this.warning = null;
// 			}, 5000);
// 		}

// 		this.processing = true;
// 		this.progress = 0;
// 		this.error = null;
// 		this.statusMessage = "Initializing…";
// 		this.downloadUrl = null;
// 		this.currentConversion = null;
// 		try {
// 			const result = await processVideo(
// 				new BlobSource(this.file),
// 				{
// 					codec: this.settings.videoCodec,
// 					crop: {
// 						height:
// 							this.settings.crop.height ??
// 							this.metadata.video?.displayH ??
// 							Infinity,
// 						width:
// 							this.settings.crop.width ??
// 							this.metadata.video?.displayW ??
// 							Infinity,
// 						left: this.settings.crop.left ?? 0,
// 						top: this.settings.crop.top ?? 0,
// 					},
// 					discard: this.settings.discardVideo,
// 					frameRate: this.settings.frameRate,
// 					height:
// 						this.settings.resolution === "custom" ?
// 							this.settings.customHeight
// 						:	RESOLUTION_PRESETS[this.settings.resolution]?.height,
// 					width:
// 						this.settings.resolution === "custom" ?
// 							this.settings.customWidth
// 						:	undefined,
// 					keyFrameInterval: this.settings.keyFrameInterval,
// 					quality: new Quality({
// 						bitrate: Math.floor(
// 							(this.settings.size * 1000 * 1000 * 8) / this.metadata.duration,
// 						),
// 					}),
// 				},
// 				{
// 					codec: this.settings.audioCodec,
// 					discard: this.settings.discardAudio,
// 					mono: this.settings.mono,
// 					sampleRate: this.settings.sampleRate,
// 				},
// 				{
// 					metadata: this.metadata,
// 					onProgress: (p) => {
// 						this.progress = p;
// 						this.statusMessage = `Processing... (${Math.floor(p * 100)}%)`;
// 					},
// 					onConversionReady: (conv) => {
// 						this.statusMessage = "Processing...";
// 						this.currentConversion = conv;
// 					},
// 				},
// 			);
// 			const blob = new Blob([result.buffer], { type: result.mimeType });
// 			const url = URL.createObjectURL(blob);
// 			this.downloadUrl = url;
// 			this.outputFileName = result.fileName;
// 			const pct = ((result.outputSize / result.inputSize) * 100).toFixed(1);
// 			this.statusMessage = `Done! ${this.formatSize(result.outputSize)} (${pct}% of source)`;
// 			if (this.settings.autoDownload)
// 				this._triggerDownload(url, result.fileName);
// 		} catch (err) {
// 			console.error("[app] processing error", err);
// 			if (err instanceof ConversionCanceledError)
// 				this.statusMessage = "Cancelled.";
// 			else {
// 				this.error =
// 					err instanceof Error ?
// 						err.message
// 					:	"Unexpected error during processing.";
// 				this.statusMessage = "";
// 			}
// 		} finally {
// 			this.processing = false;
// 			this.currentConversion = null;
// 		}
// 	},
// 	async cancelProcessing() {
// 		if (this.currentConversion) await this.currentConversion.cancel();
// 	},
// 	/* ── helpers ─────────────────────────────────────────────────── */
// 	_triggerDownload(url, filename) {
// 		const a = document.createElement("a");
// 		a.href = url;
// 		a.download = filename;
// 		a.style.display = "none";
// 		document.body.appendChild(a);
// 		a.click();
// 		requestAnimationFrame(() => {
// 			if (a.parentNode) a.remove();
// 		});
// 	},
// });
