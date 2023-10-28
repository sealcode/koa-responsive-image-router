import sharp from "sharp";
import smartcrop from "smartcrop-sharp";
import { Buffer } from "buffer";
import fs from "fs/promises";
import { randomBytes } from "crypto";
import { SmartCropOptions, DirectCropOptions } from "../types/smartCropImage";

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

async function applyCrop(
	src: string,
	tmp_path: string,
	resolution: number,
	options: SmartCropOptions | DirectCropOptions
): Promise<Buffer> {
	if (isDirectCropOptions(options)) {
		const { width, height, x, y } = options;
		const croppedImageBuffer = await sharp(src)
			.extract({ left: x, top: y, width, height })
			.resize({ width: resolution })
			.toBuffer();

		return croppedImageBuffer;
	} else if (isSmartCropOptions(options)) {
		const result = await smartcrop.crop(src, {
			width: options.width,
			height: options.height,
		});

		const crop = result.topCrop;

		const randomBytesString = randomBytes(16).toString("hex");
		const tempDest = `${tmp_path}.${randomBytesString}.cropped.jpeg`;

		await sharp(src)
			.extract({
				left: crop.x,
				top: crop.y,
				width: crop.width,
				height: crop.height,
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
};
