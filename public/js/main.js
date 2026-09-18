import {
	ALL_FORMATS,
	BlobSource,
	BufferSource,
	ConversionCanceledError,
	Input,
	Quality,
} from "mediabunny";
import { processVideo } from "./pipeline.js";
import {
	checkAudioCodecs,
	checkVideoCodecs,
	computeVideoBitrate,
	fill,
	formatDuration,
	formatSize,
	getAudio,
	getAudioCodec,
	getChannels,
	getDuration,
	getFormat,
	getFps,
	getQualityMultiplier,
	getResolution,
	getVideo,
	getVideoCodec,
	settleAndLog,
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
		if (!(ev.target instanceof Node && window.dropZone.contains(ev.target)))
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
window.dropZone.addEventListener("dragover", (e) => {
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
			window.dropZone.classList.add("drag-over");
			e.dataTransfer.dropEffect = "copy";
		} else {
			window.dropZone.classList.add("drag-invalid");
			e.dataTransfer.dropEffect = "none";
		}
	}
});
window.dropZone.addEventListener("dragleave", () => {
	window.dropZone.classList.remove("drag-over", "drag-invalid");
});
window.dropZone.addEventListener("drop", (ev) => {
	ev.preventDefault();
	window.dropZone.classList.remove("drag-over", "drag-invalid");
	window.fileInput.files = ev.dataTransfer?.files ?? null;
	window.fileInput.dispatchEvent(
		new Event("change", { bubbles: true, cancelable: false, composed: false }),
	);
});
window.fileInput.addEventListener("change", async () => {
	const file = window.fileInput.files?.[0];
	// This is a workaround for external files
	const source =
		file &&
		(Date.now() - file.lastModified <= 0 ?
			file.arrayBuffer().then((buffer) => new BufferSource(buffer))
		:	new BlobSource(file));

	if (source instanceof Promise)
		console.warn("Storing the whole file in memory");
	window.video.src = file ? URL.createObjectURL(file) : "";
	window.processing.style.display = "none";
	window.downloadUrl.style.display = "none";
	window.downloadUrl.href = "";
	fill("outputFileName", null);
	fill("fileName", file?.name ?? null);
	fill("fileSize", file ? formatSize(file.size) : null);
	if (file)
		if (
			(file.type.startsWith("video/") || file.type.startsWith("audio/")) &&
			source
		) {
			const input = (state.input = new Input({
				source: await source,
				formats: ALL_FORMATS,
			}));

			await settleAndLog([
				getDuration(input, file.size),
				getFormat(input),
				getVideo(input),
				getAudio(input),
			]);
			window.fileSelection.style.display = "none";
			window.metadata.style.display = "";
			window.settings.style.display = "";
			return;
		} else alert("The selected video or audio is not supported!");
	window.settings.style.display = "none";
	window.metadata.style.display = "none";
	window.metadata.style.setProperty("--progress", "0");
	window.fileSelection.style.display = "";
	window.fileInput.value = "";
	window.frameRate.placeholder = "Original";
	window.sampleRate.placeholder = "Original";
	window.channels.placeholder = "Original";
	window.trimEnd.max = "";
	window.trimStart.max = "";
	window.progressBar.max = 1;
	window.cropHeight.max = "";
	window.cropLeft.max = "";
	window.cropTop.max = "";
	window.cropWidth.max = "";
	state.input?.dispose();
	state.input = null;
	fill("artist", null);
	fill(
		"currentTime",
		formatDuration((window.progressBar.value = window.video.currentTime = 0)),
	);
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
	for (const element of window.resolution.children)
		if (element instanceof HTMLOptionElement) element.disabled = false;
});
// window.removeFile.addEventListener("click", (ev) => {
// 	ev.preventDefault();
// 	window.fileInput.value = "";
// 	window.fileInput.dispatchEvent(
// 		new Event("change", { bubbles: true, cancelable: false, composed: false }),
// 	);
// });
document.body.querySelectorAll("select:has(~ .hiddenInput)").forEach((el) =>
	el.addEventListener("change", () => {
		for (const element of el.parentElement?.querySelectorAll(
			".hiddenInput select, .hiddenInput input, .hiddenInput textarea, .hiddenInput fieldset",
		) ?? [])
			/** @type {HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement | HTMLFieldSetElement} */ (
				element
			).disabled = /** @type {HTMLSelectElement} */ (el).value !== "custom";
	}),
);
document.body
	.querySelectorAll("input[name='mapAudio'], input[name='mapVideo']")
	.forEach((el) =>
		el.addEventListener("change", () => {
			if (!(el instanceof HTMLInputElement) || !el.checked) return;
			(el.name === "mapAudio" ?
				[window.audioOptions]
			:	[window.videoOptions, window.transformOptions]
			).forEach((options) =>
				options.classList[el.value === "recode" ? "remove" : "add"]("disabled"),
			);
		}),
	);
window.settings.addEventListener("submit", async (ev) => {
	const form = /** @type {Settings} */ (
		Object.fromEntries(new FormData(window.settings).entries())
	);
	const file = window.fileInput.files?.[0];
	let listener;

	ev.preventDefault();
	if (!state.input || !file) return;
	try {
		window.processing.style.display = "";
		window.processing.scrollIntoView({ behavior: "smooth" });
		if (state.currentConversion) await state.currentConversion.cancel();
		const duration =
			Number(form.trimEnd || (await getDuration(state.input, file.size))) -
			Number(form.trimStart || 0);
		if (duration <= 0) throw new Error("Invalid duration");
		const [videoTrack, audioTrack] = await Promise.all([
			state.input.getPrimaryVideoTrack(),
			state.input.getPrimaryAudioTrack(),
		]);
		const [resolution, fps, channels] = await Promise.all([
			videoTrack && getResolution(videoTrack),
			videoTrack && getFps(videoTrack),
			audioTrack && getChannels(audioTrack),
		]);
		let audioBitrate =
				form.audioBitrate && form.mapAudio === "recode" ?
					Number(form.audioBitrate) * Number(form.audioBitrateUnit)
				:	0,
			videoBitrate =
				form.videoBitrate && form.mapVideo === "recode" ?
					Number(form.videoBitrate) * Number(form.videoBitrateUnit)
				:	0;
		/** @type {ConversionVideoOptions} */
		const video =
			form.mapVideo === "copy" ? {}
			: form.mapVideo === "discard" ? { discard: true }
			: {
					quality:
						form.videoQuality ?
							new Quality(
								form.videoQuality === "custom" ?
									{ bitrate: Math.floor(videoBitrate) }
								:	form.videoQuality,
							)
						:	undefined,
					codec: form.videoCodec,
					rotate: form.rotate ? Number(form.rotate) : undefined,
					frameRate:
						form.frameRate ? Number(form.frameRate)
						: fps ? Math.floor(fps.bestGuessFrameRate)
						: undefined,
					keyFrameInterval:
						form.keyFrameInterval ? Number(form.keyFrameInterval) : undefined,
					height:
						form.resolution ?
							form.resolution === "custom" ? Number(form.height)
							: resolution && resolution.h <= resolution.w ?
								Number(form.resolution)
							:	undefined
						:	undefined,
					width:
						form.resolution ?
							form.resolution === "custom" ? Number(form.width)
							: resolution && resolution.w < resolution.h ?
								Number(form.resolution)
							:	undefined
						:	undefined,
					fit: form.resolution === "custom" ? form.fit : undefined,
					crop:
						form.cropHeight || form.cropLeft || form.cropTop || form.cropWidth ?
							{
								height:
									form.cropHeight ?
										Number(form.cropHeight)
									:	(resolution?.h ?? Number.MAX_SAFE_INTEGER),
								width:
									form.cropWidth ?
										Number(form.cropWidth)
									:	(resolution?.w ?? Number.MAX_SAFE_INTEGER),
								left: form.cropLeft ? Number(form.cropLeft) : 0,
								top: form.cropTop ? Number(form.cropTop) : 0,
							}
						:	undefined,
					forceTranscode: true,
					alpha: form.alpha === "on" ? "keep" : "discard",
				};
		/** @type {ConversionAudioOptions} */
		const audio =
			form.mapAudio === "copy" ? {}
			: form.mapAudio === "discard" ? { discard: true }
			: {
					quality:
						form.audioQuality ?
							new Quality(
								form.audioQuality === "custom" ?
									{ bitrate: Math.floor(audioBitrate) }
								:	form.audioQuality,
							)
						:	undefined,
					codec: form.audioCodec,
					sampleFormat: form.sampleFormat || undefined,
					sampleRate: form.sampleRate ? Number(form.sampleRate) : undefined,
					numberOfChannels: form.channels ? Number(form.channels) : undefined,
					forceTranscode: true,
				};

		if (form.maxSizePreset) {
			let targetBitrate =
				((form.maxSizePreset === "custom" ?
					Number(form.maxSize) * Number(form.maxSizeUnit)
				:	Number(form.maxSizePreset)) *
					8) /
				duration;
			if (form.mapAudio === "copy" && audioTrack)
				audioBitrate =
					(
						await audioTrack.computePacketStats(undefined, {
							metadataOnly: true,
						})
					).averageBitrate ?? 0;
			if (form.mapVideo === "copy" && videoTrack)
				videoBitrate =
					(
						await videoTrack.computePacketStats(undefined, {
							metadataOnly: true,
						})
					).averageBitrate ?? 0;
			if (
				(videoTrack && !video.discard && !videoBitrate) ||
				(audioTrack && !audio.discard && !audioBitrate) ||
				videoBitrate + audioBitrate > targetBitrate
			) {
				if (audioBitrate > targetBitrate && !videoBitrate) audioBitrate = 0;
				else if (videoBitrate > targetBitrate && !audioBitrate)
					videoBitrate = 0;
				if (
					!audioBitrate &&
					!videoBitrate &&
					!audio.discard &&
					!video.discard &&
					audioTrack &&
					videoTrack &&
					resolution &&
					fps &&
					channels
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

					audio.codec ??= (await getAudioCodec(audioTrack)) ?? undefined;
					if (!audio.codec)
						throw new Error("Audio codec is not supported for recoding.");
					audioBitrate =
						(audioBaseRates[audio.codec] ?? 0) *
						((audio.numberOfChannels ?? channels) / 2) *
						getQualityMultiplier(form.audioQuality);
					video.codec ??= (await getVideoCodec(videoTrack)) ?? undefined;
					if (!video.codec)
						throw new Error("Video codec is not supported for recoding.");
					if (video.crop?.width) resolution.w = video.crop.width;
					else if (video.crop?.left) resolution.w -= video.crop.left;
					if (video.crop?.height) resolution.h = video.crop.height;
					else if (video.crop?.top) resolution.h -= video.crop.top;
					videoBitrate =
						computeVideoBitrate(
							video.codec,
							video.width ??
								(video.height ?
									(video.height * resolution.w) / resolution.h
								:	resolution.w),
							video.height ??
								(video.width ?
									(video.width * resolution.h) / resolution.w
								:	resolution.h),
							video.frameRate ?? fps.averageFrameRate,
						) * getQualityMultiplier(form.videoQuality);
				}
				if (audioBitrate && videoBitrate) {
					const sum = audioBitrate + videoBitrate;

					if (sum <= targetBitrate)
						targetBitrate = Math.min(targetBitrate * 0.95, sum * 4);
					audioBitrate = (targetBitrate * audioBitrate) / sum;
					if (audio.codec === "aac" || audio.codec === "mp3")
						audioBitrate = (
							audio.codec === "aac" ?
								[96000, 128000, 160000, 192000]
							:	[
									8000, 16000, 24000, 32000, 40000, 48000, 64000, 80000, 96000,
									112000, 128000, 160000, 192000, 224000, 256000, 320000,
								]).reduce((prev, curr) =>
							Math.abs(curr - audioBitrate) < Math.abs(prev - audioBitrate) ?
								curr
							:	prev,
						);
					else if (audio.codec === "opus" || audio.codec === "vorbis")
						audioBitrate = Math.max(audioBitrate, 6000);
					videoBitrate = targetBitrate - audioBitrate;
				} else if (audioBitrate) videoBitrate = targetBitrate - audioBitrate;
				else if (videoBitrate) {
					audioBitrate = targetBitrate - videoBitrate;
					if (audio.codec === "aac" || audio.codec === "mp3")
						audioBitrate = (
							audio.codec === "aac" ?
								[96000, 128000, 160000, 192000]
							:	[
									8000, 16000, 24000, 32000, 40000, 48000, 64000, 80000, 96000,
									112000, 128000, 160000, 192000, 224000, 256000, 320000,
								]).reduce((prev, curr) =>
							Math.abs(curr - audioBitrate) < Math.abs(prev - audioBitrate) ?
								curr
							:	prev,
						);
					else if (audio.codec === "opus" || audio.codec === "vorbis")
						audioBitrate = Math.max(audioBitrate, 6000);
				}
				if (video.codec)
					video.quality = new Quality({
						bitrate: Math.floor(videoBitrate),
						bitrateMode: "constant",
					});
				if (audio.codec)
					audio.quality = new Quality({
						bitrate: Math.floor(audioBitrate),
						bitrateMode: "constant",
					});
			}
		}
		const result = await processVideo(state.input, video, audio, {
			fileName: file.name,
			format: form.format || undefined,
			trimStart: form.trimStart ? Number(form.trimStart) : undefined,
			trimEnd: form.trimEnd ? Number(form.trimEnd) : undefined,
			onProgress: (p) => {
				window.progress.value = p;
				window.statusMessage.textContent = `Processing... (${Math.floor(p * 100)}%)`;
			},
			onConversionReady: (conversion) => {
				state.currentConversion = conversion;
				window.cancelProcessing.addEventListener(
					"click",
					(listener = conversion.cancel.bind(conversion)),
				);
				window.progress.value = 0;
				window.statusMessage.textContent = "Processing...";
				window.cancelProcessing.style.display = "";
				window.processing.scrollIntoView({ behavior: "smooth" });
			},
		});

		// navigator.share({
		// 	files: [
		// 		new File(
		// 			[new Blob([result.buffer], { type: result.mimeType })],
		// 			result.fileName,
		// 			{ type: result.mimeType },
		// 		),
		// 	],
		// });
		window.downloadUrl.href = URL.createObjectURL(
			new Blob([result.buffer], { type: result.mimeType }),
		);
		fill("outputFileName", (window.downloadUrl.download = result.fileName));
		window.statusMessage.textContent = `Done! ${formatSize(result.outputSize)} (${formatSize(
			result.outputSize,
			{
				sizes: [
					"Bytes",
					"KiB",
					"MiB",
					"GiB",
					"TiB",
					"PiB",
					"EiB",
					"ZiB",
					"YiB",
				],
				x: 1024,
			},
		)})`;
		window.downloadUrl.style.display = "";
	} catch (err) {
		console.error(err);
		if (err instanceof ConversionCanceledError)
			window.statusMessage.textContent = "Cancelled.";
		else
			window.statusMessage.textContent =
				err instanceof Error ?
					err.message
				:	"Unexpected error during processing.";
	} finally {
		state.currentConversion = null;
		window.cancelProcessing.style.display = "none";
		if (listener)
			window.cancelProcessing.removeEventListener("click", listener);
	}
});
window.playPause.addEventListener("click", () => {
	if (window.video.ended) window.video.currentTime = 0;
	if (window.video.paused) window.video.play();
	else window.video.pause();
});
window.video.addEventListener("play", () => {
	window.play.style.display = "none";
	window.pause.style.display = "";
	window.playPauseButton.title = "Pause";
});
window.video.addEventListener("pause", () => {
	window.play.style.display = "";
	window.pause.style.display = "none";
	window.playPauseButton.title = "Play";
});
window.video.addEventListener("timeupdate", () => {
	window.progressBar.value = window.video.currentTime;
	if (!state.dragging)
		window.metadata.style.setProperty(
			"--progress",
			String(window.video.currentTime / window.video.duration),
		);
	fill("currentTime", formatDuration(window.video.currentTime));
});
window.progressBar.addEventListener("click", (event) => {
	window.video.currentTime =
		(event.offsetX / window.progressBar.offsetWidth) * window.video.duration;
	window.progressBar.value = window.video.currentTime;
	window.metadata.style.setProperty(
		"--progress",
		String(window.video.currentTime / window.video.duration),
	);
});
window.progressBar.addEventListener("pointerdown", (event) => {
	window.progressBar.setPointerCapture(event.pointerId);
	state.dragging = true;
	window.metadata.style.setProperty(
		"--progress",
		String(
			Math.min(Math.max(event.offsetX / window.progressBar.offsetWidth, 0), 1),
		),
	);
});
window.progressBar.addEventListener("pointermove", (event) => {
	if (!window.progressBar.hasPointerCapture(event.pointerId)) return;
	window.metadata.style.setProperty(
		"--progress",
		String(
			Math.min(Math.max(event.offsetX / window.progressBar.offsetWidth, 0), 1),
		),
	);
});
/** @param {HTMLElementEventMap["pointerup" | "pointercancel" | "pointerleave"]} ev */
const listener = (ev) => {
	state.dragging = false;
	window.progressBar.releasePointerCapture(ev.pointerId);
	window.metadata.style.setProperty(
		"--progress",
		String(window.video.currentTime / window.video.duration),
	);
};
window.progressBar.addEventListener("pointerup", listener);
window.progressBar.addEventListener("pointercancel", listener);
window.progressBar.addEventListener("pointerleave", listener);
