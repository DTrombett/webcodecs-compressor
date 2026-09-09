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
	elements,
	fill,
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
	// This is a workaround for external files
	const source =
		file &&
		(Date.now() - file.lastModified <= 0 ?
			file.arrayBuffer().then((buffer) => new BufferSource(buffer))
		:	new BlobSource(file));

	if (source instanceof Promise)
		console.warn("Storing the whole file in memory");
	elements.processing.style.display = "none";
	elements.downloadUrl.style.display = "none";
	elements.downloadUrl.href = "";
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
			if (!(/** @type {HTMLInputElement}*/ (el).checked)) return;
			const type =
				/** @type {HTMLInputElement}*/
				(el).name === "mapAudio" ? "audio" : "video";
			const name = JSON.stringify(/** @type {HTMLInputElement}*/ (el).name);

			for (const element of document.body.querySelectorAll(
				["select", "input", "textarea", "fieldset"]
					.map((v) => `#${type}Options ${v}:not([name=${name}])`)
					.join(","),
			))
				/** @type {HTMLSelectElement | HTMLInputElement | HTMLTextAreaElement | HTMLFieldSetElement} */ (
					element
				).disabled = /** @type {HTMLInputElement} */ (el).value !== "recode";
		}),
	);
elements.settings.addEventListener("submit", async (ev) => {
	const form = /** @type {Settings} */ (
		Object.fromEntries(new FormData(elements.settings).entries())
	);
	const file = elements.fileInput.files?.[0];
	let listener;

	ev.preventDefault();
	if (!state.input || !file) return;
	try {
		elements.processing.style.display = "";
		elements.processing.scrollIntoView({ behavior: "smooth" });
		if (state.currentConversion) await state.currentConversion.cancel();
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
				form.audioBitrate ?
					Number(form.audioBitrate) * Number(form.audioBitrateUnit)
				:	0,
			videoBitrate =
				form.videoBitrate ?
					Number(form.videoBitrate) * Number(form.videoBitrateUnit)
				:	0;
		/** @type {ConversionVideoOptions} */
		const video =
			form.mapVideo === "copy" ?
				{}
			:	{
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
					discard: form.mapVideo === "discard",
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
								height: form.cropHeight ? Number(form.cropHeight) : Infinity,
								width: form.cropWidth ? Number(form.cropWidth) : Infinity,
								left: form.cropLeft ? Number(form.cropLeft) : Infinity,
								top: form.cropTop ? Number(form.cropTop) : Infinity,
							}
						:	undefined,
					forceTranscode: form.mapVideo === "recode",
				};
		/** @type {ConversionAudioOptions} */
		const audio =
			form.mapAudio === "copy" ?
				{}
			:	{
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
					discard: form.mapAudio === "discard",
					forceTranscode: form.mapAudio === "recode",
				};

		if (form.maxSizePreset) {
			const duration =
				Number(form.trimEnd || (await getDuration(state.input, file.size))) -
				Number(form.trimStart || 0);
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

					if (sum <= targetBitrate) targetBitrate *= 0.95;
					audioBitrate = (targetBitrate * audioBitrate) / sum;
					videoBitrate = targetBitrate - audioBitrate;
				} else if (audioBitrate) videoBitrate = targetBitrate - audioBitrate;
				else if (videoBitrate) audioBitrate = targetBitrate - videoBitrate;
				if (video.codec)
					video.quality = new Quality({
						bitrate: Math.floor(videoBitrate),
						bitrateMode: "constant",
					});
				if (audio.codec)
					audio.quality &&= new Quality({
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
		elements.statusMessage.textContent = `Done! ${formatSize(result.outputSize)} (${formatSize(
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
