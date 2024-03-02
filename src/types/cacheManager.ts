import { DirectCropOptions, SmartCropOptions } from "../utils/smartCropImage";
import { predicates } from "@sealcode/ts-predicates";

// Definition of the image data structure stored in the cache
export type CacheImageData = {
	// Array of resolutions for the image
	resolutions: number[];
	// Indicates whether the image is stored losslessly
	lossless: boolean;
	// The original path of the image on the server
	originalPath: string;
	// Base64-encoded low-resolution version of the image for quick display
	lowResCacheBase64: string;
};

export type SmartcropMap = Map<string, Promise<CropResult>>;

export type ImageMap = Map<string, Promise<Buffer>>;

export type FilruParameters = {
	storagePath?: string;
	diskCacheSize?: number;
	pruneInterval?: number;
	maxAge?: number;
	hashSeed?: string;
};

export type ThumbnailCacheParams = {
	maxCacheSize?: number;
};

export type CropType = SmartCropOptions | DirectCropOptions | undefined;

export type Task = {
	hash: string;
	resolution: number;
	fileExtension: string;
	cropData: CropType;
};

export type SmartcropTask = {
	hash: string;
	cropData: SmartCropOptions | DirectCropOptions;
};

type ImageQueueTask = {
	type: "image";
	data: Task;
};

type SmartcropQueueTask = {
	type: "smartcrop-analysis";
	data: SmartcropTask;
};

export type QueueTask = ImageQueueTask | SmartcropQueueTask;

type Crop = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type CropResult = {
	topCrop: Crop;
};

export const JsonCropResultShape = {
	topCrop: predicates.shape({
		x: predicates.number,
		y: predicates.number,
		width: predicates.number,
		height: predicates.number,
	}),
};
