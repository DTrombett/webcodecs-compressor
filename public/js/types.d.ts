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

type ResolutionPreset = {
	id: string;
	label: string;
	height?: number | "custom";
};
type CodecDefinition = {
	id: import("mediabunny").VideoCodec;
	label: string;
	mbCodec: import("mediabunny").VideoCodec;
	ext: `.${string}`;
	decodeMimeType: string;
};
type Codec = {
	id: import("mediabunny").VideoCodec;
	label: string;
	supported: boolean;
	decodeSupported: boolean;
	tooltip: string;
};
type VideoInfo = {
	codec: string?;
	codedW: number;
	codedH: number;
	displayW: number;
	displayH: number;
	fps: number;
	rotation: number;
	bitrate: number?;
	aspectRatio: string;
	colorSpace: string;
	hdr: boolean;
};
type AudioInfo = {
	codec: string?;
	channels: number;
	channelLabel: string;
	sampleRate: number;
	bitrate: number?;
};
type Metadata = {
	fileName: string;
	fileSize: number;
	fileSizeStr: string;
	container: string;
	duration: number;
	durationStr: string;
	totalBitrate: ?number;
	totalBitrateStr: string;
	video: VideoInfo?;
	audio: AudioInfo?;
};

type AppState = {
	file: File?;
	dragging: boolean;
	processing: boolean;
	progress: number;
	error: string?;
	statusMessage: string;
	downloadUrl: string?;
	outputFileName: string;
	metadata: Metadata?;
	codecs: Codec[];
	currentConversion: import("mediabunny").Conversion?;
	settings: {
		codec: import("mediabunny").VideoCodec;
		resolution: string;
		customWidth: number?;
		customHeight: number?;
		speed: number;
		size: number;
		keepAudio: boolean;
		autoDownload: boolean;
	};
	isHdrSource: boolean;
	presets: ResolutionPreset[];
	get canStart(): boolean;
	get disabledCodecs(): Codec[];
	get selectedCodec(): Codec | undefined;
	get selectedUnsupported(): boolean | undefined;
	get unsupportedTooltip(): string;
	get decodeStatus(): { supported: boolean; label: string }?;
	get decodeTooltip(): string;
	get resolutionDisabled(): (preset: ResolutionPreset) => boolean;
	get resolutionTooltip(): (preset: ResolutionPreset) => string;
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
	warning: string?;
	setResolution(id: string): void;
	validateCustomResolution(): void;
	startProcessing(): Promise<void>;
	cancelProcessing(): Promise<void>;
	_channelLabel(n: number): string;
	formatSize(bytes: number): string;
	formatDuration(sec: number): string;
	_triggerDownload(url: string, filename: string): void;
	$refs?: { fileInput: HTMLInputElement };
};
