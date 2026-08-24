import {
	ALL_FORMATS,
	BlobSource,
	ConversionCanceledError,
	Input,
	Quality,
} from "mediabunny";
import { processVideo } from "./pipeline.js";
import {
	checkAudioCodecs,
	checkVideoCodecs,
	computeVideoBitrate,
	elements,
	fill,
	formatSize,
	getAudio,
	getDuration,
	getFormat,
	getResolution,
	getVideo,
	state,
} from "./utils.js";

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

	state.file = file ?? null;
	elements.processing.style.display = "none";
	elements.downloadUrl.style.display = "none";
	elements.downloadUrl.href = "";
	fill("outputFileName", null);
	fill("fileName", file?.name ?? null);
	fill("fileSize", file ? formatSize(file.size) : null);
	if (file)
		if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
			const input = (state.input = new Input({
				source: new BlobSource(file),
				formats: ALL_FORMATS,
			}));

			await Promise.allSettled([
				getDuration(input, file.size),
				getFormat(input),
				getVideo(input),
				getAudio(input),
			]);
			elements.fileSelection.style.display = "none";
			elements.metadata.style.display = "";
			elements.settings.style.display = "";
			return;
		} else alert("The selected video or audio is not supported!");
	elements.settings.style.display = "none";
	elements.metadata.style.display = "none";
	elements.fileSelection.style.display = "";
	elements.fileInput.value = "";
	elements.frameRate.placeholder = "Original";
	elements.sampleRate.placeholder = "Original";
	elements.channels.placeholder = "Original";
	elements.trimEnd.max = "";
	state.input?.dispose();
	state.input = null;
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
	fill("inputResolution", null);
	for (const element of elements.resolution.children)
		if (element instanceof HTMLOptionElement) element.disabled = false;
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
elements.settings.addEventListener("submit", async (ev) => {
	const form = /** @type {Settings} */ (
		Object.fromEntries(new FormData(elements.settings).entries())
	);
	let listener;

	ev.preventDefault();
	if (!state.input || !state.file) return;
	try {
		elements.processing.style.display = "";
		elements.processing.scrollIntoView({ behavior: "smooth" });
		if (state.currentConversion) await state.currentConversion.cancel();
		const videoTrack = await state.input.getPrimaryVideoTrack();
		const resolution = videoTrack && (await getResolution(videoTrack));
		const video = {
			quality:
				form.videoQuality ?
					new Quality(
						form.videoQuality === "custom" ?
							{ bitrate: Math.round(Number(form.videoBitrate) * 1000) }
						:	form.videoQuality,
					)
				:	undefined,
			codec: form.videoCodec,
			rotate: form.rotate ? Number(form.rotate) : undefined,
			frameRate: form.frameRate ? Number(form.frameRate) : undefined,
			keyFrameInterval:
				form.keyFrameInterval ? Number(form.keyFrameInterval) : undefined,
			discard: form.discardVideo === "on",
			height:
				form.resolution ?
					form.resolution === "custom" ? Number(form.height)
					: resolution && resolution.h <= resolution.w ? Number(form.resolution)
					: undefined
				:	undefined,
			width:
				form.resolution ?
					form.resolution === "custom" ? Number(form.width)
					: resolution && resolution.w < resolution.h ? Number(form.resolution)
					: undefined
				:	undefined,
			fit: form.resolution === "custom" ? form.fit : undefined,
			crop:
				form.cropHeight || form.cropLeft || form.cropTop || form.cropWidth ?
					{
						height: form.cropHeight ? Number(form.cropHeight) : Infinity,
						width: form.cropWidth ? Number(form.cropWidth) : Infinity,
						left: form.cropLeft ? Number(form.cropLeft) : Infinity,
						top: form.cropTop ? Number(form.cropTop) : Infinity,
					}
				:	undefined,
		};
		const audio = {
			quality:
				form.audioQuality ?
					new Quality(
						form.audioQuality === "custom" ?
							{ bitrate: Math.round(Number(form.audioBitrate) * 1000) }
						:	form.audioQuality,
					)
				:	undefined,
			codec: form.audioCodec,
			sampleFormat: form.sampleFormat || undefined,
			sampleRate: form.sampleRate ? Number(form.sampleRate) : undefined,
			channels: form.channels ? Number(form.channels) : undefined,
			discard: form.discardAudio === "on",
		};

		if (form.maxSizePreset) {
			const [duration, res] = await Promise.all([
				getDuration(state.input, state.file.size),
				videoTrack && getResolution(videoTrack),
			]);
			const targetBitrate =
				(Number(
					form.maxSizePreset === "custom" ? form.maxSize : form.maxSizePreset,
				) *
					8_000_000) /
				duration;
			if (
				(video.codec && !form.videoBitrate) ||
				(audio.codec && !form.audioBitrate) ||
				Number(form.videoBitrate) * 1000 + Number(form.videoBitrate) * 1000 >
					targetBitrate
			) {
				let audioBitrate = Number(form.audioBitrate) * 1000,
					videoBitrate = Number(form.videoBitrate) * 1000;

				if (audioBitrate > targetBitrate && !videoBitrate) audioBitrate = 0;
				else if (videoBitrate > targetBitrate && !audioBitrate)
					videoBitrate = 0;
				if (
					!audioBitrate &&
					!videoBitrate &&
					audio.codec &&
					video.codec &&
					res
				) {
					/**
					 * @license [Vanilagy/mediabunny](https://github.com/Vanilagy/mediabunny/blob/0f9dc1f91bcc24109ef1ed81bf5d790ba26e98cd/src/encode.ts#L854-L862)
					 * @type {Partial<Record<AudioCodec, number>>}
					 */
					const audioBaseRates = {
						aac: 128000, // 128kbps base for AAC
						opus: 64000, // 64kbps base for Opus
						mp3: 160000, // 160kbps base for MP3
						vorbis: 64000, // 64kbps base for Vorbis
						ac3: 384000, // 384kbps base for AC-3
						eac3: 192000, // 192kbps base for E-AC-3
						dts: 768000, // 768kbps base for DTS
					};

					audioBitrate = audioBaseRates[audio.codec] ?? 0;
					videoBitrate = computeVideoBitrate(
						video.codec,
						video.width ??
							(video.height ? (video.height * res.w) / res.h : res.w),
						video.height ??
							(video.width ? (video.width * res.h) / res.w : res.h),
					);
				}
				if (audioBitrate && videoBitrate) {
					const sum = audioBitrate + videoBitrate;

					audioBitrate = (targetBitrate * audioBitrate) / sum;
					videoBitrate = (targetBitrate * videoBitrate) / sum;
				} else if (audioBitrate) videoBitrate = targetBitrate - audioBitrate;
				else if (videoBitrate) audioBitrate = targetBitrate - videoBitrate;
				video.quality = new Quality({ bitrate: Math.ceil(videoBitrate) });
				audio.quality = new Quality({ bitrate: Math.ceil(audioBitrate) });
			}
		}
		const result = await processVideo(state.input, video, audio, {
			fileName: state.file.name,
			format: form.format || undefined,
			trimStart: form.trimStart ? Number(form.trimStart) : undefined,
			trimEnd: form.trimEnd ? Number(form.trimEnd) : undefined,
			onProgress: (p) => {
				elements.progress.value = p;
				elements.statusMessage.textContent = `Processing... (${Math.floor(p * 100)}%)`;
			},
			onConversionReady: (conversion) => {
				state.currentConversion = conversion;
				elements.cancelProcessing.addEventListener(
					"click",
					(listener = conversion.cancel.bind(conversion)),
				);
				elements.progress.value = 0;
				elements.statusMessage.textContent = "Processing...";
				elements.cancelProcessing.style.display = "";
				elements.processing.scrollIntoView({ behavior: "smooth" });
			},
		});

		elements.downloadUrl.href = URL.createObjectURL(
			new Blob([result.buffer], { type: result.mimeType }),
		);
		fill("outputFileName", (elements.downloadUrl.download = result.fileName));
		elements.statusMessage.textContent = `Done! ${formatSize(result.outputSize)} (${((result.outputSize / result.inputSize) * 100).toFixed(1)}% of source)`;
		elements.downloadUrl.style.display = "";
	} catch (err) {
		console.error(err);
		if (err instanceof ConversionCanceledError)
			elements.statusMessage.textContent = "Cancelled.";
		else
			elements.statusMessage.textContent =
				err instanceof Error ?
					err.message
				:	"Unexpected error during processing.";
	} finally {
		state.currentConversion = null;
		elements.cancelProcessing.style.display = "none";
		if (listener)
			elements.cancelProcessing.removeEventListener("click", listener);
	}
});

// export default () => ({
// 	get decodeStatus() {
// 		const codec = this.selectedCodec;

// 		if (!codec) return null;
// 		return {
// 			supported: codec.decodeSupported,
// 			label: codec.decodeSupported ? "Supported" : "Not supported",
// 		};
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
