import { correctExtension, ImageRatioClass } from "../types/imageRouter";
import { extname, basename } from "path";
import os from "os";

export function isCorrectExtension(
	fileExtension: unknown
): fileExtension is correctExtension {
	const extensions = ["avif", "webp", "jpeg", "png"];
	return extensions.includes(fileExtension as string);
}

export function getImageClasses({
	width,
	height,
	targetRatio,
	ratioDiffThreshold,
}: {
	width: number;
	height: number;
	targetRatio: number;
	ratioDiffThreshold: number;
}): ImageRatioClass[] {
	const classes: ImageRatioClass[] = [];

	if (width > height) {
		classes.push("horizontal", "landscape");
	} else if (width === height) classes.push("square");
	else classes.push("vertical", "portrait");

	const ratio = width / height;
	const ratioDifference = ratio - targetRatio;

	if (Math.abs(ratioDifference) > ratioDiffThreshold) {
		classes.push("ratio-crossed-threshold");

		if (ratioDifference > 0) classes.push("ratio-above-threshold");
		else classes.push("ratio-below-threshold");
	}

	return classes;
}

export function encodeFilename({
	width,
	originalPath,
	extension,
}: {
	width: number;
	originalPath: string;
	extension: string;
}): string {
	const filename = basename(originalPath)
		.slice(0, -1 * extname(originalPath).length)
		.replace(/\./g, "_");
	return `${filename || "image"}.${width}.${extension}`;
}

export function checkMaxConcurrent(maxConcurrent?: number): number {
	const availableCpus = os.cpus().length;

	const maxConcurrentWithOneFree = availableCpus > 1 ? availableCpus - 1 : 1;

	const suggestedMaxConcurrent =
		maxConcurrent !== undefined
			? Math.min(maxConcurrent, maxConcurrentWithOneFree)
			: maxConcurrentWithOneFree;

	if (maxConcurrent !== undefined && maxConcurrent > suggestedMaxConcurrent) {
		console.warn(
			`Warning: The specified maxConcurrent (${maxConcurrent}) exceeds the recommended limit (${suggestedMaxConcurrent}). Using ${suggestedMaxConcurrent} instead.`
		);
		return suggestedMaxConcurrent;
	} else {
		return maxConcurrent !== undefined
			? maxConcurrent
			: suggestedMaxConcurrent;
	}
}
