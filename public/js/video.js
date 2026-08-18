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
	{ id: "vp9", label: "VP9" },
	{ id: "av1", label: "AV1" },
	{ id: "vp8", label: "VP8" },
	{ id: "hevc", label: "H.265 / HEVC (MP4)" },
	{ id: "avc", label: "H.264 / AVC (MP4)" },
];

/** @satisfies {Record<string, ResolutionPreset>} */
export const RESOLUTION_PRESETS = {
	original: {
		label: "Original (unchanged)",
		height: undefined,
		id: "original",
	},
	"2160p": { label: "4K (2160p)", height: 2160, id: "2160p" },
	"1440p": { label: "2K (1440p)", height: 1440, id: "1440p" },
	"1080p": { label: "1080p (FHD)", height: 1080, id: "1080p" },
	"720p": { label: "720p (HD)", height: 720, id: "720p" },
	"480p": { label: "480p (SD)", height: 480, id: "480p" },
	"360p": { label: "360p", height: 360, id: "360p" },
	custom: { label: "Custom…", height: undefined, id: "custom" },
};
