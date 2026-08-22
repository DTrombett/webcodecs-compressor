import {
	canEncodeAudio,
	canEncodeVideo,
	Input,
	InputAudioTrack,
	InputVideoTrack,
} from "mediabunny";
import { AUDIO_CODEC_DEFINITIONS, VIDEO_CODEC_DEFINITIONS } from "./video.js";

export const elements = {
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
	frameRate: /** @type {HTMLInputElement} */ (
		document.getElementById("frameRate")
	),
};

/**
 * Get a label describing the audio channels.
 * @param {number} n - Number of audio channels
 * @returns {string} A label for the audio channels count
 */
export const channelLabel = (n) =>
	({ 1: "Mono", 2: "Stereo", 6: "5.1 Surround", 8: "7.1 Surround" })[n] ??
	`${n}ch`;

/**
 * Convert a number of bytes into a human readable format.
 * @param {number} bytes - Number of bytes
 * @returns {string} A human readable size
 */
export const formatSize = (
	bytes,
	{
		sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
		x = 1000,
		fractionDigits = 1,
	} = {},
) => {
	if (!bytes) return `0 ${sizes[0]}`;
	const i = Math.floor(Math.log(bytes) / Math.log(x));

	return `${(bytes / x ** i).toFixed(fractionDigits)}${sizes[i]}`;
};

/**
 * Format a number of seconds.
 * @param {number} sec - The number of seconds to format
 * @returns {string} A string representation of seconds in format (hh:)mm:ss
 */
export const formatDuration = (sec) => {
	if (isNaN(sec)) return "--:--";
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	const s = Math.floor(sec % 60);

	if (h > 0)
		return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

/**
 * Fill all elements with a specific data-prop.
 * @param {string} prop - The data-prop to search for
 * @param {string?} textContent - The text content to fill
 */
export const fill = (prop, textContent) =>
	document
		.querySelectorAll(`[data-prop="${prop}"]`)
		.forEach((value) => (value.textContent = textContent));

/**
 * Get the duration of a media input.
 * @param {Input} input - The media input
 * @param {number} size - The input size in bytes
 */
export const getDuration = async (input, size) => {
	const duration = await input
		.getDurationFromMetadata()
		.then((d) => d ?? input.computeDuration());

	fill("inputDuration", formatDuration(duration));
	fill(
		"inputBitrate",
		`${Math.round((size * 8) / duration / 1000).toLocaleString()} kbps`,
	);
	return duration;
};

/**
 * Get the container of a media input.
 * @param {Input} input - The media input
 */
export const getFormat = async (input) => {
	const format = await input.getFormat();

	fill("inputFormat", format.name);
	return format;
};

/**
 * Get the frame rate of a video track.
 * @param {InputVideoTrack} track - The video track
 */
export const getFps = async (track) => {
	const frm = await track.computeFrameRateMetrics();
	const textContent = `${frm.bestGuessFrameRate.toLocaleString()} fps`;

	fill("inputVideoFps", textContent);
	elements.frameRate.placeholder = `Original (${textContent})`;
	return frm;
};

/**
 * Get the color space of a video track.
 * @param {InputVideoTrack} track - The video track
 */
export const getColorSpace = async (track) => {
	const vcsi = await track.getColorSpace();

	fill("inputVideoColorSpace", vcsi.matrix ?? "unknown");
	return vcsi;
};

/**
 * Get the codec of a video track.
 * @param {InputVideoTrack} track - The video track
 */
export const getVideoCodec = async (track) => {
	const codec = await track.getCodec();

	fill("inputVideoCodec", codec ?? "unknown");
	return codec;
};

/**
 * Get the resolution of a video track.
 * @param {InputVideoTrack} track - The video track
 */
export const getResolution = async (track) => {
	const [w, h] = await Promise.all([
		track.getDisplayWidth(),
		track.getDisplayHeight(),
	]);

	fill("inputDisplaySize", `${w}×${h}`);
	fill("inputResolution", `${Math.min(w, h)}p`);
	return { w, h };
};

/**
 * Get the average bitrate of a video track.
 * @param {InputVideoTrack} track - The video track
 */
export const getVideoBitrate = async (track) => {
	const bitrate =
		(await track.getAverageBitrate()) ?? (await track.getBitrate());

	fill(
		"inputVideoBitrate",
		bitrate ? `${(bitrate / 1000).toLocaleString()} kbps` : "unknown",
	);
	return bitrate;
};

/**
 * Get the average bitrate of an track.
 * @param {InputAudioTrack} track - The audio track
 */
export const getAudioBitrate = async (track) => {
	const bitrate =
		(await track.getAverageBitrate()) ?? (await track.getBitrate());

	fill(
		"inputAudioBitrate",
		bitrate ? `${(bitrate / 1000).toLocaleString()} kbps` : "unknown",
	);
	return bitrate;
};

/**
 * Get the codec of an audio track.
 * @param {InputAudioTrack} track - The audio track
 */
export const getAudioCodec = async (track) => {
	const codec = await track.getCodec();

	fill("inputAudioCodec", codec ?? "unknown");
	return codec;
};

/**
 * Get the channels of an audio track.
 * @param {InputAudioTrack} track - The audio track
 */
export const getChannels = async (track) => {
	const channels = await track.getNumberOfChannels();

	fill("inputAudioChannels", channelLabel(channels));
	return channels;
};

/**
 * Get the sample rate of an audio track.
 * @param {InputAudioTrack} track - The audio track
 */
export const getSampleRate = async (track) => {
	const sampleRate = await track.getSampleRate();

	fill("inputAudioSampleRate", `${sampleRate.toLocaleString()} Hz`);
	return sampleRate;
};

/**
 * Get the primary video track from a media input.
 * @param {Input} input - The media input
 */
export const getVideo = async (input) => {
	const track = await input.getPrimaryVideoTrack();

	if (track) {
		elements.metadataVideo.style.display = "";
		await Promise.allSettled([
			getFps(track),
			getColorSpace(track),
			getVideoCodec(track),
			getResolution(track),
			getVideoBitrate(track),
		]);
	} else {
		elements.metadataVideo.style.display = "none";
		elements.frameRate.placeholder = "Original";
		fill("inputVideoCodec", null);
		fill("inputDisplaySize", null);
		fill("inputVideoFps", null);
		fill("inputVideoBitrate", null);
		fill("inputVideoColorSpace", null);
		fill("inputResolution", null);
	}
	return track;
};

/**
 * Get the primary audio track from a media input.
 * @param {Input} input - The media input
 */
export const getAudio = async (input) => {
	const track = await input.getPrimaryAudioTrack();

	if (track) {
		elements.metadataAudio.style.display = "";
		await Promise.allSettled([
			getAudioBitrate(track),
			getAudioCodec(track),
			getChannels(track),
			getSampleRate(track),
		]);
	} else {
		elements.metadataAudio.style.display = "none";
		fill("inputAudioCodec", null);
		fill("inputAudioChannels", null);
		fill("inputAudioSampleRate", null);
		fill("inputAudioBitrate", null);
	}
	return track;
};

/**
 * Check which codecs are supported for video encoding.
 */
export const checkVideoCodecs = async () => {
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
export const checkAudioCodecs = async () => {
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
