import sharp from "sharp";
import { CropType } from "./cacheManager";

export type Container = {
	objectFit: "cover" | "contain" | "";
	width: number;
	height: number;
};

import { DirectCropOptions, SmartCropOptions } from "../utils/smartCropImage";

export type BaseImageParameters = {
	path: string;
	alt?: string;
	lossless?: boolean;
	lazy?: boolean;
	imgStyle?: string;
	targetRatio?: number;
	ratioDiffThreshold?: number;
	crop?: SmartCropOptions | DirectCropOptions;
	thumbnailSize?: number;
};

type sizesAttr = {
	sizesAttr: string;
};

type container = {
	container: {
		objectFit: "cover" | "contain";
		width: number;
		height: number;
	};
};

type resolutions = {
	resolutions: number[];
};

type SizesImageParameters = BaseImageParameters & sizesAttr;

type SizesResolutionImageParameters = BaseImageParameters &
	sizesAttr &
	resolutions;

type ResolutionsContainerImageParameters = BaseImageParameters &
	resolutions &
	container;

type ContainerImageParameters = BaseImageParameters & container;

export type ImageParametersWithDefaults = {
	alt: string;
	lossless: boolean;
	lazy: boolean;
	imgStyle: string;
	targetRatio: number;
	ratioDiffThreshold: number;
	thumbnailSize: number;
};

export type ImageParameters =
	| SizesResolutionImageParameters
	| SizesImageParameters
	| ResolutionsContainerImageParameters
	| ContainerImageParameters;

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
	crop: CropType;
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
