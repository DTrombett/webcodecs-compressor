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
