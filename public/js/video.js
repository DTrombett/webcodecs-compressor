/** @type {CodecDefinition<VideoCodec>[]} */
export const VIDEO_CODEC_DEFINITIONS = [
	{ id: "vp9", label: "VP9" },
	{ id: "av1", label: "AV1" },
	{ id: "vp8", label: "VP8" },
	{ id: "hevc", label: "H.265 / HEVC" },
	{ id: "avc", label: "H.264 / AVC" },
];

/** @type {CodecDefinition<AudioCodec>[]} */
export const AUDIO_CODEC_DEFINITIONS = [
	{ id: "opus", label: "Opus" },
	{ id: "vorbis", label: "Vorbis" },
	{ id: "mp3", label: "MP3" },
	{ id: "flac", label: "Flac" },
	{ id: "aac", label: "AAC / M4A" },
];

/** @satisfies {Record<string, ResolutionPreset>} */
export const RESOLUTION_PRESETS = {
	original: {
		label: "Original (unchanged)",
		height: undefined,
		id: "original",
	},
	"2160p": { label: "4K UHD (2160p)", height: 2160, id: "2160p" },
	"1620p": { label: "3K (1620p)", height: 1620, id: "1620p" },
	"1440p": { label: "QHD (1440p)", height: 1440, id: "1440p" },
	"1080p": { label: "FHD (1080p)", height: 1080, id: "1080p" },
	"720p": { label: "HD (720p)", height: 720, id: "720p" },
	"480p": { label: "SD (480p)", height: 480, id: "480p" },
	custom: { label: "Custom…", height: undefined, id: "custom" },
};
