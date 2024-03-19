import Queue from "better-queue";
import _locreq from "locreq";
export const locreq = _locreq(__dirname);
import hash from "object-hash";

import { ThumbnailCache } from "./ThumbnailCache";
import { SmartcropCache } from "./SmartCropCache";
import { DiskImageCache } from "./DiskImageCache";

import {
	FilruParameters,
	QueueTask,
	Task,
	ThumbnailCacheParams,
} from "../../types/cacheManager";
import { correctExtension } from "../../types/imageRouter";
import {
	CropResult,
	ImageMap,
	SmartcropMap,
	SmartcropTask,
} from "./../../types/cacheManager";
import { isCorrectExtension } from "../utils";
import { is, predicates } from "@sealcode/ts-predicates";
import { ImageInfoTool } from "../ImageInfoTool";
import { applyCrop, getSmartCropResult } from "../smartCropImage";
import sharp from "sharp";

export class CacheManager {
	private memoryCache: ThumbnailCache;
	private diskImageCache: DiskImageCache;
	private smartcropCache: SmartcropCache;
	private imageQueue: Queue;
	private enqueuedImagePromises: ImageMap = new Map();
	private enqueuedSmartcropPromises: SmartcropMap = new Map();

	private tmpPath = locreq.resolve("tmp-samrtcrop");

	constructor(
		thumbnailCacheParams: ThumbnailCacheParams,
		localCacheParams: FilruParameters,
		SmartcropCacheParams: FilruParameters,
		maxImagesConcurrent: number,
		public resolutionThreshold: number
	) {
		this.memoryCache = new ThumbnailCache(thumbnailCacheParams);
		this.diskImageCache = new DiskImageCache(localCacheParams);
		this.smartcropCache = new SmartcropCache(SmartcropCacheParams);

		this.imageQueue = new Queue(
			(task, cb) => void this.processQueueTask(task, cb),
			{
				concurrent: maxImagesConcurrent,
			}
		);
	}

	public async start(): Promise<void> {
		await this.diskImageCache.start();
		await this.smartcropCache.start();
	}

	public cachedGetProcessedImage(task: Task): Promise<Buffer> {
		return this.enqueueProcessing<Buffer>(
			this.enqueuedImagePromises,
			"image",
			task
		);
	}

	public cachedGetSmarctopAnalysisResult(
		task: SmartcropTask
	): Promise<CropResult> {
		return this.enqueueProcessing<CropResult>(
			this.enqueuedSmartcropPromises,
			"smartcrop-analysis",
			task
		);
	}

	public isInCache(task: Task): string | null {
		const hash = this.getTaskHash(task);
		const imagePromiseBuffer = this.get(hash, task.resolution);
		if (imagePromiseBuffer) {
			return imagePromiseBuffer.toString("base64");
		}
		return null;
	}

	private async set(
		hash: string,
		resolution: number,
		buffer: Buffer
	): Promise<void> {
		if (resolution > this.resolutionThreshold) {
			await this.diskImageCache.set(hash, buffer);
		} else if (resolution <= this.resolutionThreshold && resolution >= 0) {
			this.memoryCache.set(hash, buffer);
		}
	}

	private get(
		hash: string,
		resolution: number
	): Promise<Buffer> | Buffer | null {
		if (resolution > this.resolutionThreshold) {
			return this.diskImageCache.get(hash);
		} else if (resolution <= this.resolutionThreshold && resolution >= 0) {
			return this.memoryCache.get(hash);
		}
		return null;
	}

	private async enqueueProcessing<Buffer>(
		enqueuedPromises: ImageMap,
		type: "image",
		data: Task
	): Promise<Buffer>;

	private async enqueueProcessing<CropResult>(
		enqueuedPromises: SmartcropMap,
		type: "smartcrop-analysis",
		data: SmartcropTask
	): Promise<CropResult>;

	private async enqueueProcessing<T extends Buffer | CropResult>(
		enqueuedPromises: ImageMap | SmartcropMap,
		type: "image" | "smartcrop-analysis",
		data: Task | SmartcropTask
	): Promise<T> {
		const hash = this.getTaskHash(data);

		if (this.isInImageQueue(enqueuedPromises, hash)) {
			return enqueuedPromises.get(hash) as Promise<T>;
		} else {
			if (this.isTask(data)) {
				const buffer = this.get(hash, data.resolution);
				if ((await buffer) !== null) {
					return buffer as Promise<T>;
				}
			} else {
				const cropResult = this.smartcropCache.get(hash);
				if ((await cropResult) !== null) {
					return cropResult as Promise<T>;
				}
			}
		}

		const promise = new Promise<T>((resolve, reject) => {
			this.imageQueue.push(
				{ type, data },
				(error: Error | null, result: Buffer | CropResult | null) => {
					if (error) {
						reject(error);
					} else if (result === null) {
						reject(
							new Error(
								"Image processing resulted in null buffer."
							)
						);
					} else {
						resolve(result as T);
					}

					enqueuedPromises.delete(hash);
				}
			);
		});

		if (this.isImageMap(enqueuedPromises)) {
			enqueuedPromises.set(hash, promise as Promise<Buffer>);
		} else if (this.isSmartcropMap(enqueuedPromises)) {
			enqueuedPromises.set(hash, promise as Promise<CropResult>);
		}

		return promise;
	}

	private isImageMap(map: ImageMap | SmartcropMap): map is ImageMap {
		return (map as ImageMap).set !== undefined;
	}

	private isSmartcropMap(map: ImageMap | SmartcropMap): map is SmartcropMap {
		return (map as SmartcropMap).set !== undefined;
	}

	private isInImageQueue(
		enqueuedPromises: ImageMap | SmartcropMap,
		hash: string
	): boolean {
		return enqueuedPromises.has(hash);
	}

	private async processQueueTask(
		task: QueueTask,
		cb: (arg1: Error) => void
	): Promise<void> {
		const { type } = task;
		try {
			if (type === "image") {
				await this.processImage(task.data, cb);
			} else if (type === "smartcrop-analysis") {
				await this.processSmartCrop(task.data, cb);
			} else {
				cb(new Error(`Unknown task process type`));
			}
		} catch (error) {
			cb(error);
		}
	}

	private async processImage(
		task: Task,
		cb: (arg1: Error | null, arg2: Buffer | null) => void
	): Promise<void> {
		try {
			const { hash, resolution, fileExtension, cropData } = task;
			if (
				isCorrectExtension(fileExtension) &&
				this.chcekResolution(hash, resolution)
			) {
				try {
					if (!cropData) {
						const imageBuffer = await this.generateImage(
							hash,
							resolution,
							fileExtension
						);
						const taskHash = this.getTaskHash(task);
						await this.set(taskHash, resolution, imageBuffer);
						cb(null, imageBuffer);
						return;
					} else {
						const imageBuffer = await applyCrop(
							this,
							hash,
							this.tmpPath,
							resolution,
							cropData
						);
						const taskHash = this.getTaskHash(task);
						await this.set(taskHash, resolution, imageBuffer);
						cb(null, imageBuffer);
					}
				} catch (err) {
					console.log("err form catach index: ", err);
					cb(err, null);
				}
			} else {
				cb(new Error(`Invalid image type: ${fileExtension}`), null);
			}
		} catch (error) {
			cb(error, null);
		}
	}

	private cropResultToBuffer(cropResult: CropResult): Buffer {
		const cropResultJSON = JSON.stringify(cropResult);
		const cropResultBuffer = Buffer.from(cropResultJSON, "utf-8");
		return cropResultBuffer;
	}

	private async processSmartCrop(
		task: SmartcropTask,
		cb: (arg1: Error | null, arg2: CropResult | null) => void
	): Promise<void> {
		try {
			const { hash, cropData } = task;
			const taskHash = this.getTaskHash(task);

			const cropResult = await getSmartCropResult(hash, cropData);

			const cropResultBuffer = this.cropResultToBuffer(cropResult);

			await this.smartcropCache.set(taskHash, cropResultBuffer);

			cb(null, cropResult);
		} catch (error) {
			cb(error, null);
		}
	}

	private async generateImage(
		hash: string,
		resolution: number,
		fileExtension: correctExtension
	): Promise<Buffer> {
		const imageData = ImageInfoTool.getImageData(hash);
		const { originalPath, lossless } = imageData;

		return await sharp(originalPath)
			.resize(resolution)
			.toFormat(fileExtension, lossless ? { lossless: true } : {})
			.toBuffer();
	}

	private chcekResolution(hash: string, resolution: number) {
		return !!ImageInfoTool.getImageData(hash).resolutions?.includes(
			resolution
		);
	}

	private getTaskHash(task: Task | SmartcropTask): string {
		return hash(task);
	}

	private isTask(data: Task | SmartcropTask): data is Task {
		return (data as Task).resolution !== undefined;
	}
}
