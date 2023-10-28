import { correctExtension, ImageRatioClass } from "../types/imageRouter";
import { extname, basename } from "path";

export function isCorrectExtension(
	fileExtension: unknown
): fileExtension is correctExtension {
	const extensions = ["avif", "webp", "jpeg", "png"];
	return extensions.includes(fileExtension as string);
}

export function getImageClasses({
	width,
	height,
	target_ratio,
	ratio_diff_threshold,
}: {
	width: number;
	height: number;
	target_ratio: number;
	ratio_diff_threshold: number;
}): ImageRatioClass[] {
	const classes: ImageRatioClass[] = [];

	if (width > height) {
		classes.push("horizontal", "landscape");
	} else if (width === height) classes.push("square");
	else classes.push("vertical", "portrait");

	const ratio = width / height;
	const ratio_difference = ratio - target_ratio;

	if (Math.abs(ratio_difference) > ratio_diff_threshold) {
		classes.push("ratio-crossed-threshold");

		if (ratio_difference > 0) classes.push("ratio-above-threshold");
		else classes.push("ratio-below-threshold");
	}

	return classes;
}

export function encodeFilename({
	width,
	originalPath,
	format,
}: {
	width: number;
	originalPath: string;
	format: string;
}): string {
	const filename = basename(originalPath)
		.slice(0, -1 * extname(originalPath).length)
		.replace(/\./g, "_");
	return `${filename || "image"}.${width}.${format}`;
}
