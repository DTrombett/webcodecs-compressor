import type {
	AudioCodec as ACodec,
	Conversion,
	CropRectangle as CRectangle,
	Source as MBSource,
	OutputFormat,
	VideoCodec as VCodec,
} from "mediabunny";
import type { RESOLUTION_PRESETS } from "./public/js/video";

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

	type OutputFormatConstructor = new () => OutputFormat;
	type VideoCodec = VCodec;
	type AudioCodec = ACodec;
	type Source = MBSource;
	type CropRectangle = CRectangle;

	type ResolutionPreset = { label: string; height?: number; id: string };
	type CodecDefinition = {
		id: VCodec;
		label: string;
		mbCodec: VCodec;
		ext: `.${string}`;
		decodeMimeType: string;
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

	type AppState = {
		file: File | null;
		dragging: boolean;
		processing: boolean;
		progress: number;
		error: string | null;
		statusMessage: string;
		downloadUrl: string | null;
		outputFileName: string;
		metadata: Metadata | null;
		codecs: Codec[];
		currentConversion: Conversion | null;
		settings: {
			autoDownload: boolean;
			discardAudio: boolean;
			discardVideo: boolean;
			mono: boolean;
			resolution: keyof typeof RESOLUTION_PRESETS;
			size: number;
			audioCodec?: ACodec;
			crop?: CropRectangle;
			customHeight?: number;
			customWidth?: number;
			frameRate?: number;
			keyFrameInterval?: number;
			sampleRate?: number;
			videoCodec?: VCodec;
		};
		isHdrSource: boolean;
		presets: Record<string, ResolutionPreset>;
		get canStart(): boolean;
		get disabledCodecs(): Codec[];
		get selectedCodec(): Codec | undefined;
		get selectedUnsupported(): boolean | undefined;
		get unsupportedTooltip(): string;
		get decodeStatus(): { supported: boolean; label: string } | null;
		get decodeTooltip(): string;
		resolutionTooltip(preset: ResolutionPreset): string;
		resolutionDisabled(preset: ResolutionPreset): boolean;
		init(): Promise<void>;
		handleFileSelect(
			event: Event & {
				currentTarget: HTMLInputElement;
				target: HTMLInputElement;
			},
		): void;
		handleDrop(
			event: DragEvent & {
				currentTarget: HTMLInputElement;
				target: HTMLInputElement;
			},
		): void;
		setFile(file: File): Promise<void>;
		clearFile(): void;
		warning: string | null;
		setResolution(preset: ResolutionPreset): void;
		validateCustomResolution(): void;
		startProcessing(): Promise<void>;
		cancelProcessing(): Promise<void>;
		_channelLabel(n: number): string;
		formatSize(bytes: number): string;
		formatDuration(sec: number): string;
		_triggerDownload(url: string, filename: string): void;
		$refs?: { fileInput: HTMLInputElement };
	};
}
