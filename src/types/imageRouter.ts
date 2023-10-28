import sharp from "sharp";
import { DirectCropOptions, SmartCropOptions } from "../utils/smartCropImage";

export type BaseImageParameters = {
	path: string;
	alt?: string;
	lossless?: boolean;
	lazy?: boolean;
	img_style?: string;
	target_ratio?: number;
	ratio_diff_threshold?: number;
	crop?: SmartCropOptions | DirectCropOptions;
};

type sizes_attr = {
	sizes_attr: string;
};

type container = {
	container: {
		object_fit: "cover" | "contain";
		width: number;
		height: number;
	};
};

type resolutions = {
	resolutions: number[];
};

type SizesImageParameters = BaseImageParameters & sizes_attr;
type SizesResolutionImageParameters = BaseImageParameters &
	sizes_attr &
	resolutions;
type ResolutionsContainerImageParameters = BaseImageParameters &
	resolutions &
	container;
type ContainerImageParameters = BaseImageParameters & container;

export type ImageParametersWithDefaults = {
	alt: string;
	lossless: boolean;
	lazy: boolean;
	img_style: string;
	target_ratio: number;
	ratio_diff_threshold: number;
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

export type correctExtension = "jpeg" | "png" | "avif" | "webp";

export type ImageData = {
	resolutions: number[];
	lossless: boolean;
	metadata: Promise<sharp.Metadata> | undefined;
	originalPath: string;
	target_ratio: number;
	ratio_diff_threshold: number;
	container: {
		object_fit: "cover" | "contain" | "";
		width: number;
		height: number;
	};
	crop: SmartCropOptions | DirectCropOptions | undefined;
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
