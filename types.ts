import type {
	AudioCodec as ACodec,
	ConversionAudioOptions as CAOptions,
	Conversion,
	ConversionOptions as COptions,
	CropRectangle as CRectangle,
	ConversionVideoOptions as CVOptions,
	Input,
	Rotation as MBRotation,
	Source as MBSource,
	MediaCodec as MCodec,
	OutputFormat,
	QualityLevel,
	VideoCodec as VCodec,
} from "mediabunny";

declare global {
	interface ObjectConstructor {
		/**
		 * Returns an array of values of the enumerable own properties of an object
		 * @param o Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.
		 */
		values<T extends {}>(o: T): Required<T>[keyof T][];
		/**
		 * Returns an array of key/values of the enumerable own properties of an object
		 * @param o Object that contains the properties and methods. This can be an object that you created or an existing Document Object Model (DOM) object.
		 */
		entries<T extends {}>(
			o: T,
		): {
			[K in keyof T]-?: K extends string | number ? [`${K}`, T[K]] : never;
		}[keyof T][];
		/**
		 * Returns an object created by key-value entries for properties and methods
		 * @param entries An iterable object that contains key-value entries for properties and methods.
		 */
		fromEntries<T extends Iterable<readonly [PropertyKey, unknown]>>(
			entries: T,
		): {
			[Entry in T extends Iterable<infer A> ? A : never as Entry[0]]: Entry[1];
		};
	}
	interface NumberConstructor {
		new <T extends number>(value: `${T}`): T;
		<T extends number>(value: `${T}`): T;
	}

	type OutputFormatConstructor = new () => OutputFormat;
	type VideoCodec = VCodec;
	type AudioCodec = ACodec;
	type MediaCodec = MCodec;
	type Source = MBSource;
	type CropRectangle = CRectangle;
	type Rotation = MBRotation;
	type ConversionVideoOptions = CVOptions;
	type ConversionAudioOptions = CAOptions;
	type ConversionOptions = COptions;

	type ResolutionPreset = { label: string; height?: number; id: string };
	type CodecDefinition<C extends MediaCodec = MediaCodec> = {
		id: C;
		label: string;
	};
	type Codec = {
		id: VCodec;
		label: string;
		supported: boolean;
		decodeSupported: boolean;
		tooltip: string;
	};
	type VideoInfo = {
		codec: VCodec | null;
		codedW: number;
		codedH: number;
		displayW: number;
		displayH: number;
		fps: number;
		rotation: number;
		bitrate: number | null;
		aspectRatio: string;
		colorSpace: string;
		hdr: boolean;
	};
	type AudioInfo = {
		codec: ACodec | null;
		channels: number;
		channelLabel: string;
		sampleRate: number;
		bitrate: number | null;
	};
	type Metadata = {
		fileName: string;
		fileSize: number;
		fileSizeStr: string;
		container: string;
		duration: number;
		durationStr: string;
		totalBitrate: number;
		totalBitrateStr: string;
		video: VideoInfo | null;
		audio: AudioInfo | null;
	};

	type NumberInput = `${number}` | "";
	type Format =
		| "mp4"
		| "cmaf"
		| "mov"
		| "mkv"
		| "webm"
		| "mp3"
		| "wav"
		| "ogg"
		| "adts"
		| "flac"
		| "mpegts";

	type Settings = Partial<{
		audioBitrate: NumberInput;
		audioBitrateUnit: NumberInput;
		audioCodec: AudioCodec;
		audioQuality: "" | QualityLevel | "custom";
		channels: NumberInput;
		cropHeight: NumberInput;
		cropLeft: NumberInput;
		cropTop: NumberInput;
		cropWidth: NumberInput;
		mapAudio: "recode" | "copy" | "discard";
		mapVideo: "recode" | "copy" | "discard";
		fit: ConversionVideoOptions["fit"];
		frameRate: NumberInput;
		height: NumberInput;
		keyFrameInterval: NumberInput;
		maxSize: NumberInput;
		maxSizeUnit: NumberInput;
		resolution: NumberInput | "custom";
		rotate: `${Rotation}`;
		sampleFormat: ConversionAudioOptions["sampleFormat"] | "";
		sampleRate: NumberInput;
		trimEnd: NumberInput;
		trimStart: NumberInput;
		videoBitrate: NumberInput;
		videoBitrateUnit: NumberInput;
		videoCodec: VideoCodec;
		videoQuality: "" | QualityLevel | "custom";
		width: NumberInput;
	}> & { maxSizePreset: NumberInput | "custom"; format: "" | Format };

	type AppState = { input: Input | null; currentConversion: Conversion | null };
}
