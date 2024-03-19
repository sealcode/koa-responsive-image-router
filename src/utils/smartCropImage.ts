import { CropResult } from "./../types/cacheManager";
import sharp from "sharp";
import smartcrop from "smartcrop-sharp";
import { Buffer } from "buffer";
import fs from "fs/promises";
import { randomBytes } from "crypto";
import { CacheManager } from "./cache/CacheManager";
import { ImageInfoTool } from "./ImageInfoTool";
import { SmartCropOptions, DirectCropOptions } from "../types/smartCropImage";
import { CropDescription } from "../types/imageRouter";

function isSmartCropOptions(
	value: SmartCropOptions | DirectCropOptions
): value is SmartCropOptions {
	return (
		(value as DirectCropOptions).x === undefined &&
		(value as DirectCropOptions).y === undefined
	);
}

function isDirectCropOptions(
	value: SmartCropOptions | DirectCropOptions
): value is DirectCropOptions {
	return (
		(value as DirectCropOptions).x !== undefined &&
		(value as DirectCropOptions).y !== undefined
	);
}

async function getSmartCropResult(
	hash: string,
	options: SmartCropOptions | DirectCropOptions
): Promise<CropResult> {
	const src = ImageInfoTool.getImageData(hash).originalPath;

	const result = await smartcrop.crop(src, {
		width: options.width,
		height: options.height,
	});

	return result;
}

async function applyCrop(
	context: CacheManager,
	hash: string,
	tmp_path: string,
	resolution: number,
	options: Exclude<CropDescription, false>
): Promise<Buffer> {
	const src = ImageInfoTool.getImageData(hash).originalPath;

	if (isDirectCropOptions(options)) {
		const { width, height, x, y } = options;
		const croppedImageBuffer = await sharp(src)
			.extract({ left: x, top: y, width, height })
			.resize({ width: resolution })
			.toBuffer();

		return croppedImageBuffer;
	} else if (isSmartCropOptions(options)) {
		const cropResult = await context.cachedGetSmarctopAnalysisResult({
			hash: hash,
			cropData: options,
		});

		const randomBytesString = randomBytes(16).toString("hex");
		const tempDest = `${tmp_path}.${randomBytesString}.cropped.jpeg`;

		await sharp(src)
			.extract({
				left: cropResult.topCrop.x,
				top: cropResult.topCrop.y,
				width: cropResult.topCrop.width,
				height: cropResult.topCrop.height,
			})
			.resize({ width: resolution })
			.toFile(tempDest);

		const croppedImageBuffer = await fs.readFile(tempDest);
		await fs.unlink(tempDest);

		return croppedImageBuffer;
	} else {
		throw new Error("Invalid cropping options provided");
	}
}

export {
	applyCrop,
	SmartCropOptions,
	DirectCropOptions,
	isDirectCropOptions,
	isSmartCropOptions,
	getSmartCropResult,
};
