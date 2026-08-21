import { ALL_FORMATS, BlobSource, canEncodeVideo, Input } from "mediabunny";
import { channelLabel, formatDuration, formatSize } from "./utils.js";
import { CODEC_DEFINITIONS, RESOLUTION_PRESETS } from "./video.js";

const elements = {
	fileInput: /** @type {HTMLInputElement} */ (
		document.getElementById("fileInput")
	),
	dropZone: /** @type {HTMLDivElement} */ (document.getElementById("dropZone")),
	metadata: /** @type {HTMLDivElement} */ (document.getElementById("metadata")),
	metadataFileName: /** @type {HTMLTableCellElement} */ (
		document.getElementById("metadataFileName")
	),
	metadataFileSizeStr: /** @type {HTMLTableCellElement} */ (
		document.getElementById("metadataFileSizeStr")
	),
	metadataContainer: /** @type {HTMLTableCellElement} */ (
		document.getElementById("metadataContainer")
	),
	metadataDurationStr: /** @type {HTMLTableCellElement} */ (
		document.getElementById("metadataDurationStr")
	),
	metadataTotalBitrateStr: /** @type {HTMLTableCellElement} */ (
		document.getElementById("metadataTotalBitrateStr")
	),
	metadataVideo: /** @type {HTMLDetailsElement} */ (
		document.getElementById("metadataVideo")
	),
	metadataVideoCodec: /** @type {HTMLTableCellElement} */ (
		document.getElementById("metadataVideoCodec")
	),
	metadataVideoDisplaySize: /** @type {HTMLTableCellElement} */ (
		document.getElementById("metadataVideoDisplaySize")
	),
	metadataVideoFps: /** @type {HTMLTableCellElement} */ (
		document.getElementById("metadataVideoFps")
	),
	metadataVideoBitrate: /** @type {HTMLTableCellElement} */ (
		document.getElementById("metadataVideoBitrate")
	),
	metadataVideoColorSpace: /** @type {HTMLTableCellElement} */ (
		document.getElementById("metadataVideoColorSpace")
	),
	metadataAudio: /** @type {HTMLDetailsElement} */ (
		document.getElementById("metadataAudio")
	),
	metadataAudioCodec: /** @type {HTMLTableCellElement} */ (
		document.getElementById("metadataAudioCodec")
	),
	metadataAudioChannelLabel: /** @type {HTMLTableCellElement} */ (
		document.getElementById("metadataAudioChannelLabel")
	),
	metadataAudioSampleRate: /** @type {HTMLTableCellElement} */ (
		document.getElementById("metadataAudioSampleRate")
	),
	metadataAudioBitrate: /** @type {HTMLTableCellElement} */ (
		document.getElementById("metadataAudioBitrate")
	),
	settingsVideoCodec: /** @type {HTMLSelectElement} */ (
		document.getElementById("settingsVideoCodec")
	),
	presets: /** @type {HTMLDivElement} */ (document.getElementById("presets")),
	fileSelection: /** @type {HTMLDivElement} */ (
		document.getElementById("fileSelection")
	),
	fileName: /** @type {HTMLSpanElement} */ (
		document.getElementById("fileName")
	),
	removeFile: /** @type {HTMLButtonElement} */ (
		document.getElementById("removeFile")
	),
};

/** @type {{ [P in keyof AppState]?: (value: AppState[P]) => void; } & { [K: string | symbol]: (value: any) => void; }} */
const setHandlers = {
	metadata: (metadata) => {
		elements.metadataFileName.textContent = metadata?.fileName ?? null;
		elements.metadataFileSizeStr.textContent = metadata?.fileSizeStr ?? null;
		elements.metadataContainer.textContent = metadata?.container ?? null;
		elements.metadataDurationStr.textContent = metadata?.durationStr ?? null;
		elements.metadataTotalBitrateStr.textContent =
			metadata?.totalBitrateStr ?? null;
		elements.metadataVideoCodec.textContent = metadata?.video?.codec ?? null;
		elements.metadataVideoDisplaySize.textContent =
			metadata?.video ?
				metadata.video.displayW + "\u00d7" + metadata.video.displayH
			:	null;
		elements.metadataVideoFps.textContent =
			metadata?.video ? `${metadata.video.fps} fps` : null;
		elements.metadataVideoBitrate.textContent =
			metadata?.video ?
				metadata.video.bitrate ?
					`${(metadata.video.bitrate / 1000).toFixed(0)} kbps`
				:	"unknown"
			:	null;
		elements.metadataVideoColorSpace.textContent =
			metadata?.video?.colorSpace ?? null;
		elements.metadataVideo.style.display = metadata?.video ? "" : "none";
		elements.metadataAudioCodec.textContent = metadata?.audio?.codec ?? null;
		elements.metadataAudioChannelLabel.textContent =
			metadata?.audio?.channelLabel ?? null;
		elements.metadataAudioSampleRate.textContent =
			metadata?.audio ? `${metadata.audio.sampleRate} Hz` : null;
		elements.metadataAudioBitrate.textContent =
			metadata?.audio ?
				metadata.audio.bitrate ?
					`${(metadata.audio.bitrate / 1000).toFixed(0)} kbps`
				:	"unknown"
			:	null;
		elements.metadataAudio.style.display = metadata?.audio ? "" : "none";
		elements.metadata.style.display = metadata ? "" : "none";
	},
};

/** @type {AppState} */
const state = new Proxy(
	{
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
	},
	{
		set: (target, p, value, receiver) => {
			Reflect.set(target, p, value, receiver);
			setHandlers[p]?.(value);
			return true;
		},
	},
);

/**
 * Check which codecs are supported for encoding.
 */
const checkCodecs = async () => {
	await Promise.allSettled(
		CODEC_DEFINITIONS.map(async (def, i) => {
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

for (const resolution of Object.values(RESOLUTION_PRESETS)) {
	const input = document.createElement("input"),
		label = document.createElement("label"),
		span1 = document.createElement("span"),
		span2 = document.createElement("span");

	input.id = input.value = label.htmlFor = resolution.id;
	input.style.display = "none";
	input.name = "resolution";
	input.type = "radio";
	span1.textContent = resolution.label;
	span2.textContent = resolution.label;
	label.appendChild(input);
	label.appendChild(span1);
	label.appendChild(span2);
	label.className = "pill";
	elements.presets.appendChild(label);
}
for (const child of elements.presets.children)
	if (child instanceof HTMLLabelElement) {
		const input = document.getElementById(child.htmlFor);

		if (input instanceof HTMLInputElement) {
			input.checked = true;
			break;
		}
	}
checkCodecs();
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

	if (file)
		if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
			elements.fileName.textContent = file.name;
			state.error = null;
			state.downloadUrl = null;
			state.metadata = null;
			try {
				const input = (state.input = new Input({
					source: new BlobSource(file),
					formats: ALL_FORMATS,
				}));
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
						channelLabel: channelLabel(channels),
						sampleRate,
						bitrate,
					};
				}
				const totalBitrate = (size * 8) / duration;
				elements.fileSelection.style.display = "none";
				state.metadata = {
					fileName: file.name,
					fileSize: size,
					fileSizeStr: formatSize(size),
					container: format.name,
					duration,
					durationStr: formatDuration(duration),
					totalBitrate,
					totalBitrateStr: `${Math.round(totalBitrate / 1000)} kbps`,
					video: videoInfo,
					audio: audioInfo,
				};
				state.isHdrSource = videoInfo?.hdr ?? false;
			} catch (e) {
				console.warn("[app] metadata read failed", e);
			}
			return;
		} else alert("The selected video or audio is not supported!");
	state.input?.dispose();
	state.input = null;
	state.metadata = null;
	state.error = null;
	state.downloadUrl = null;
	elements.fileInput.value = "";
	elements.fileSelection.style.display = "";
});
elements.removeFile.addEventListener("click", (ev) => {
	ev.preventDefault();
	elements.fileInput.value = "";
	elements.fileInput.dispatchEvent(
		new Event("change", { bubbles: true, cancelable: false, composed: false }),
	);
});

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
