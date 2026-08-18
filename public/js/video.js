/**
 * core/video.js - Resolution presets, dimension calculation, aspect-ratio helpers,
 * and shared codec definitions.
 */

/**
 * Shared codec definitions — single source of truth.
 * Used by main.js (detection) and core/pipeline.js (processing).
 * @type {CodecDefinition[]}
 */
export const CODEC_DEFINITIONS = [
	{
		id: "vp9",
		label: "VP9 (WebM)",
		mbCodec: "vp9",
		ext: ".webm",
		decodeMimeType: 'video/webm; codecs="vp09.00.10.08"',
	},
	{
		id: "av1",
		label: "AV1 (MP4/WebM)",
		mbCodec: "av1",
		ext: ".mp4",
		decodeMimeType: 'video/webm; codecs="av01.0.05M.08"',
	},
	{
		id: "vp8",
		label: "VP8 (WebM)",
		mbCodec: "vp8",
		ext: ".webm",
		decodeMimeType: 'video/webm; codecs="vp8"',
	},
	{
		id: "hevc",
		label: "H.265 / HEVC (MP4)",
		mbCodec: "hevc",
		ext: ".mp4",
		decodeMimeType: 'video/mp4; codecs="hev1.1.6.L93.B0"',
	},
	{
		id: "avc",
		label: "H.264 / AVC (MP4)",
		mbCodec: "avc",
		ext: ".mp4",
		decodeMimeType: 'video/mp4; codecs="avc1.42E01E"',
	},
];

/** @satisfies {Record<string, ResolutionPreset>} */
export const RESOLUTION_PRESETS = {
	original: {
		label: "Original (unchanged)",
		height: undefined,
		id: "original",
	},
	custom: { label: "Custom…", height: undefined, id: "custom" },
	360: { label: "360p", height: 360, id: "360p" },
	480: { label: "480p (SD)", height: 480, id: "480p" },
	720: { label: "720p (HD)", height: 720, id: "720p" },
	1080: { label: "1080p (FHD)", height: 1080, id: "1080p" },
	1440: { label: "2K (1440p)", height: 1440, id: "1440p" },
	2160: { label: "4K (2160p)", height: 2160, id: "2160p" },
};
