import {
	AdtsOutputFormat,
	BufferTarget,
	CmafOutputFormat,
	Conversion,
	FlacOutputFormat,
	Input,
	MkvOutputFormat,
	MovOutputFormat,
	Mp3OutputFormat,
	Mp4OutputFormat,
	MpegTsOutputFormat,
	OggOutputFormat,
	Output,
	OutputFormat,
	Quality,
	WavOutputFormat,
	WebMOutputFormat,
} from "mediabunny";
import { getDuration } from "./utils.js";

/**
 * Make a number even by rounding to the nearest multiple of 2.
 * @param {number} number - The number to evenify
 */
const evenify = (number) => {
	number = Math.round(number);
	return number % 2 ? number + 1 : number;
};

const WebM = WebMOutputFormat.bind(undefined, { minimumClusterDuration: 5 });
const Mkv = MkvOutputFormat.bind(undefined, { minimumClusterDuration: 5 });

/** @type {Record<VideoCodec, OutputFormatConstructor>} */
const videoOnlyFormats = {
	av1: WebM,
	vp8: WebM,
	vp9: WebM,
	avc: Mp4OutputFormat,
	hevc: Mp4OutputFormat,
	prores: MovOutputFormat,
};
/** @type {Record<AudioCodec, OutputFormatConstructor>} */
const audioOnlyFormats = {
	aac: Mp4OutputFormat,
	ac3: MpegTsOutputFormat,
	eac3: MpegTsOutputFormat,
	alaw: WavOutputFormat,
	"pcm-f32": WavOutputFormat,
	"pcm-f64": WavOutputFormat,
	"pcm-s16": WavOutputFormat,
	"pcm-s24": WavOutputFormat,
	"pcm-s32": WavOutputFormat,
	"pcm-s8": WavOutputFormat,
	"pcm-u8": WavOutputFormat,
	ulaw: WavOutputFormat,
	flac: FlacOutputFormat,
	mp3: Mp3OutputFormat,
	opus: OggOutputFormat,
	vorbis: OggOutputFormat,
	"pcm-f32be": MovOutputFormat,
	"pcm-f64be": MovOutputFormat,
	"pcm-s16be": MovOutputFormat,
	"pcm-s24be": MovOutputFormat,
	"pcm-s32be": MovOutputFormat,
	dts: Mkv,
};
/** @type {Partial<Record<VideoCodec, Partial<Record<AudioCodec, new (...args: any[]) => OutputFormat>>>>} */
const videoAudioFormats = {
	avc: {
		aac: Mp4OutputFormat,
		ac3: Mp4OutputFormat,
		eac3: Mp4OutputFormat,
		mp3: Mp4OutputFormat,
		alaw: MovOutputFormat,
		ulaw: MovOutputFormat,
		"pcm-f32": MovOutputFormat,
		"pcm-f32be": MovOutputFormat,
		"pcm-f64": MovOutputFormat,
		"pcm-f64be": MovOutputFormat,
		"pcm-s16": MovOutputFormat,
		"pcm-s16be": MovOutputFormat,
		"pcm-s24": MovOutputFormat,
		"pcm-s24be": MovOutputFormat,
		"pcm-s32": MovOutputFormat,
		"pcm-s32be": MovOutputFormat,
		"pcm-s8": MovOutputFormat,
		"pcm-u8": MovOutputFormat,
	},
	vp8: { opus: WebM, vorbis: WebM },
	prores: {
		"pcm-f32": MovOutputFormat,
		"pcm-f32be": MovOutputFormat,
		"pcm-f64": MovOutputFormat,
		"pcm-f64be": MovOutputFormat,
		"pcm-s16": MovOutputFormat,
		"pcm-s16be": MovOutputFormat,
		"pcm-s24": MovOutputFormat,
		"pcm-s24be": MovOutputFormat,
		"pcm-s32": MovOutputFormat,
		"pcm-s32be": MovOutputFormat,
		"pcm-s8": MovOutputFormat,
		"pcm-u8": MovOutputFormat,
	},
};
videoAudioFormats.hevc = videoAudioFormats.avc;
videoAudioFormats.vp9 = videoAudioFormats.av1 = videoAudioFormats.vp8;

/**
 * Compute the most suitable output format based on the audio and video codecs
 * @param {AudioCodec?} [audioCodec] - The audio codec
 * @param {VideoCodec?} [videoCodec] - The video codec
 * @returns {OutputFormatConstructor}
 */
const computeOutputFormat = (audioCodec, videoCodec) => {
	if (audioCodec === null || videoCodec === null) return Mkv;
	if (audioCodec === undefined)
		if (videoCodec === undefined)
			throw new TypeError(
				"At least an audio or video codec should be specified",
			);
		else return videoOnlyFormats[videoCodec] ?? Mkv;
	if (videoCodec === undefined) return audioOnlyFormats[audioCodec] ?? Mkv;
	return videoAudioFormats[videoCodec]?.[audioCodec] ?? Mkv;
};

/** @type {Record<Format, OutputFormatConstructor>} */
const formats = {
	adts: AdtsOutputFormat,
	cmaf: CmafOutputFormat,
	flac: FlacOutputFormat,
	mkv: Mkv,
	mov: MovOutputFormat,
	mp3: Mp3OutputFormat,
	mp4: Mp4OutputFormat,
	mpegts: MpegTsOutputFormat,
	ogg: OggOutputFormat,
	wav: WavOutputFormat,
	webm: WebM,
};

/**
 * Full processing pipeline.
 * @param {Input<Source>} input - The input file
 * @param {object} video - Video options
 * @param {VideoCodec} [video.codec] - Codec id
 * @param {Quality} [video.quality] - Video quality
 * @param {CropRectangle} [video.crop] - How to crop the video
 * @param {ConversionVideoOptions["fit"]} [video.fit] - The fitting algorithm in case both width and height are set
 * @param {Rotation} [video.rotate] - Rotation to be applied to the video
 * @param {number} [video.frameRate] - Output fps
 * @param {number} [video.keyFrameInterval] - After how many seconds a keyframe should be added
 * @param {number} [video.width] - Custom width
 * @param {number} [video.height] - Custom height
 * @param {boolean} [video.discard] - Whether to discard the video track
 * @param {object} audio - Audio options
 * @param {AudioCodec} [audio.codec] - Codec id
 * @param {Quality} [audio.quality] - Audio quality
 * @param {boolean} [audio.discard] - Whether to discard the audio track
 * @param {number} [audio.channels] - The number of audio channels
 * @param {number} [audio.sampleRate] - The audio sample rate
 * @param {ConversionAudioOptions["sampleFormat"]} [audio.sampleFormat] - The audio sample format
 * @param {object} opts - Global options
 * @param {string} opts.fileName - The original file name
 * @param {OutputFormatConstructor | Format} [opts.format] - The output format to use
 * @param {(conversion: Conversion) => void} [opts.onConversionReady]
 * @param {(progress: number) => void} [opts.onProgress]
 */
export const processVideo = async (
	input,
	video,
	audio,
	{ onConversionReady, onProgress, fileName, format },
) => {
	const [inputVideoTrack, inputAudioTrack] = await Promise.all([
		input.getPrimaryVideoTrack(),
		input.getPrimaryAudioTrack(),
	]);
	const size = await input.source.getSize();

	if (!inputVideoTrack) video = { discard: true };
	if (!inputAudioTrack) audio = { discard: true };
	const output = new Output({
		format: new (typeof format === "string" ?
			formats[format]
		:	(format ??
				computeOutputFormat(
					audio.discard ? undefined : (
						(audio.codec ?? (await inputAudioTrack?.getCodec()))
					),
					video.discard ? undefined : (
						(video.codec ?? (await inputVideoTrack?.getCodec()))
					),
				)))(),
		target: new BufferTarget(),
	});
	const conversion = await Conversion.init({
		input,
		output,
		video:
			video.discard ?
				{ discard: true }
			:	{
					codec: video.codec,
					crop: video.crop,
					discard: video.discard,
					fit: video.fit,
					frameRate: video.frameRate,
					height: video.height,
					keyFrameInterval: video.keyFrameInterval,
					quality: video.quality,
					rotate: video.rotate,
					width: video.width,
				},
		audio:
			audio.discard ?
				{
					codec: audio.codec,
					numberOfChannels: audio.channels,
					quality: audio.quality,
					sampleRate: audio.sampleRate,
					sampleFormat: audio.sampleFormat,
				}
			:	{},
	});

	if (!conversion.isValid)
		throw new Error(
			`Conversion invalid: ${conversion.discardedTracks.map((d) => d.reason).join("; ")}`,
		);
	conversion.onProgress = onProgress;
	onConversionReady?.(conversion);
	await conversion.execute();
	if (!output.target.buffer) throw new Error("Output is not finalized!");
	return {
		buffer: output.target.buffer,
		fileName: fileName.replace(
			/\.[^.]+$/,
			`_compressed${output.format.fileExtension}`,
		),
		mimeType: output.format.mimeType,
		inputSize: size,
		outputSize: output.target.buffer.byteLength,
		srcDuration: await getDuration(input, size),
	};
};
