import sharp from "sharp";

import { DirectCropOptions, SmartCropOptions } from "../utils/smartCropImage";

export type CropDescription = SmartCropOptions | DirectCropOptions | false;

export type BaseImageParameters = {
	alt: string;
	lossless: boolean;
	lazy: boolean;
	imgStyle: string;
	targetRatio: number;
	ratioDiffThreshold: number;
	crop: CropDescription;
	thumbnailSize: number;
};

type sizesAttr = {
	sizesAttr: string;
};

export type Container = {
	objectFit?: "cover" | "contain";
	width: number;
	height: number;
};

type resolutions = {
	resolutions: number[];
};

export type ImageParameters = Partial<BaseImageParameters> &
	(
		| (sizesAttr & resolutions)
		| sizesAttr
		| (resolutions & { container: Container })
		| { container: Container }
	);

export type Task = {
	hash: string;
	resolution: number;
	fileExtension: string;
	crop: SmartCropOptions | DirectCropOptions | undefined;
};

export type correctExtension = "jpeg" | "png" | "avif" | "webp" | "jxl";

export type ImageData = {
	resolutions: number[];
	lossless: boolean;
	metadata: Promise<sharp.Metadata> | undefined;
	originalPath: string;
	targetRatio: number;
	ratioDiffThreshold: number;
	container: Container;
	crop: CropDescription;
	thumbnailSize: number;
};

export type ImageRatioClass =
	| "horizontal"
	| "vertical"
	| "square"
	| "landscape"
	| "portrait"
	| "ratio-crossed-threshold"
	| "ratio-above-threshold"
	| "ratio-below-threshold";
