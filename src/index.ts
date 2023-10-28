import Router from "@koa/router";
import sharp from "sharp";
import crypto from "crypto";
import Queue from "better-queue";
import os from "os";

import { is, predicates } from "@sealcode/ts-predicates";
import { stat } from "fs/promises";
import { extname, basename } from "path";
import { Middleware } from "koa";

import { guessResolutions } from "./utils/guessResolutions";

import {
	ImageParametersWithDefaults,
	ImageParameters,
	BaseImageParameters,
	ImageData,
	Task,
	correctExtension,
} from "./types/imageRouter";

import { SmartCropOptions, DirectCropOptions } from "./types/smartCropImage";

import { applyCrop } from "./utils/smartCropImage";

import { MONTH } from "./constants/constants";

import {
	encodeFilename,
	getImageClasses,
	isCorrectExtension,
} from "./utils/utils";

export default class KoaResponsiveImageRouter extends Router {
	router: Router;
	nginxWarningDisplayed = false;
	private maxConcurrent: number;
	private imageQueue: Queue;
	hashToImageData: Record<string, ImageData> = {};

	constructor(
		public static_path: string,
		public tmp_path: string,
		maxConcurrent?: number
	) {
		super();
		this.router = new Router();

		const availableCpus = os.cpus().length;
		const suggestedMaxConcurrent =
			availableCpus > 1 ? availableCpus - 1 : 1;

		if (
			maxConcurrent !== undefined &&
			maxConcurrent > suggestedMaxConcurrent
		) {
			console.warn(
				`Warning: The specified maxConcurrent (${maxConcurrent}) exceeds the recommended limit (${suggestedMaxConcurrent}). Using ${suggestedMaxConcurrent} instead.`
			);
			this.maxConcurrent = suggestedMaxConcurrent;
		} else {
			this.maxConcurrent =
				maxConcurrent !== undefined
					? maxConcurrent
					: suggestedMaxConcurrent;
		}
		this.imageQueue = new Queue(this.processImage.bind(this), {
			concurrent: this.maxConcurrent,
		});

		this.router.get("/:hash/:filename", async (ctx) => {
			if (!this.nginxWarningDisplayed && !ctx.headers["x-proxied"]) {
				console.log(
					"Request for an image probably did not go through a caching proxy, use the following NGINX config to fix that:"
				);

				console.log(this.makeNginxConfig("/run/nginx-cache", 1024));
				this.nginxWarningDisplayed = true;
			}

			const { hash, filename } = ctx.params;

			const resolution = parseInt(filename.split(".")[1]);
			const fileExtension = extname(filename).split(".").pop();

			const crop = this.hashToImageData[hash].crop;
			if (
				this.hashToImageData[hash].resolutions.find(
					(el: number) => el === resolution
				) &&
				fileExtension !== undefined &&
				isCorrectExtension(fileExtension)
			) {
				ctx.set("Cache-Control", `public, max-age=${MONTH}, immutable`);
				ctx.set("etag", `"${hash}:${filename}"`);
				ctx.status = 200; //otherwise the `.fresh` check won't work, see https://koajs.com/
				if (ctx.fresh) {
					ctx.status = 304;
					return;
				}

				try {
					const imageBuffer = await this.enqueueImageProcessing(
						this.imageQueue,
						{
							hash,
							resolution,
							fileExtension,
							crop,
						}
					);

					ctx.body = imageBuffer;
					ctx.type = `image/${fileExtension}`;
					ctx.status = 200;
				} catch (error) {
					console.error(error);
					ctx.response.status = 404;
				}
			} else {
				ctx.response.status = 404;
			}
		});
	}

	private async enqueueImageProcessing(
		imageQueue: Queue,
		data: {
			hash: string;
			resolution: number;
			fileExtension: string;
			crop: SmartCropOptions | DirectCropOptions | undefined;
		}
	): Promise<Buffer> {
		return new Promise<Buffer>((resolve, reject) => {
			imageQueue.push(
				data,
				(error: Error | null, result: Buffer | null) => {
					if (error) {
						reject(error);
					} else if (result === null) {
						reject(
							new Error(
								"Image processing resulted in null buffer."
							)
						);
					} else {
						resolve(result);
					}
				}
			);
		});
	}

	async processImage(
		task: Task,
		cb: (error: Error | null, result: Buffer | null) => void
	): Promise<void> {
		try {
			const { hash, resolution, fileExtension, crop } = task;
			if (isCorrectExtension(fileExtension)) {
				if (is(crop, predicates.undefined)) {
					const imageBuffer = await this.generateImage({
						hash,
						resolution,
						fileExtension,
					});
					cb(null, imageBuffer);
				} else {
					const croppedImageData = await applyCrop(
						this.hashToImageData[hash].originalPath,
						this.tmp_path,
						resolution,
						crop
					);
					cb(null, croppedImageData);
				}
			} else {
				cb(new Error(`Invalid image type: ${fileExtension}`), null);
			}
		} catch (error) {
			cb(error, null);
		}
	}

	async getMetadata(hash: string): Promise<sharp.Metadata> {
		if (this.hashToImageData[hash].metadata) {
			return this.hashToImageData[hash]
				.metadata as Promise<sharp.Metadata>;
		} else {
			const metadata = sharp(
				this.hashToImageData[hash].originalPath
			).metadata();
			this.hashToImageData[hash].metadata = metadata;
			return metadata;
		}
	}

	private makeImageURL({
		hash,
		width,
		format,
	}: {
		hash: string;
		width: number;
		format: string;
	}): string {
		const result = `${this.static_path}/${hash}/${encodeFilename({
			width,
			originalPath: this.hashToImageData[hash].originalPath,
			format,
		})}`;

		return result;
	}

	makeNginxConfig(cache_path: string, max_size_mb: number): string {
		return `http {
	proxy_cache_path ${cache_path} keys_zone=cache:10m levels=1:2 inactive=90d max_size=${max_size_mb}m use_temp_path=off;

	server {
		# ....
		location ${this.static_path} {
			proxy_cache cache;
			proxy_cache_lock on;
			proxy_cache_valid 200 90d;
			proxy_cache_use_stale updating;
			proxy_cache_background_update on;
			proxy_set_header X-Proxied true;
			proxy_pass http://localhost:8080;
		}
	}
}`;
	}

	private createImageDefaultParameters(
		params: Partial<BaseImageParameters>
	): ImageParametersWithDefaults {
		const result: ImageParametersWithDefaults = {
			alt: typeof params.alt !== "undefined" ? params.alt : "",
			lossless:
				typeof params.lossless !== "undefined"
					? params.lossless
					: false,
			lazy: typeof params.lazy !== "undefined" ? params.lazy : true,
			img_style:
				typeof params.img_style !== "undefined" ? params.img_style : "",
			target_ratio:
				typeof params.target_ratio !== "undefined"
					? params.target_ratio
					: 16 / 9,
			ratio_diff_threshold:
				typeof params.ratio_diff_threshold !== "undefined"
					? params.ratio_diff_threshold
					: 0.2,
		};
		return result;
	}

	async image(params: ImageParameters): Promise<string> {
		let resolutions: number[] = [];
		let container;

		if (
			"sizes_attr" in params &&
			params.sizes_attr &&
			"resolutions" in params
		) {
			resolutions = params.resolutions;
		} else if ("sizes_attr" in params && params.sizes_attr) {
			resolutions = guessResolutions(params.sizes_attr);
		} else if ("resolutions" in params && "container" in params) {
			resolutions = params.resolutions;
			container = params.container;
		} else if ("container" in params) {
			container = params.container;
			resolutions = guessResolutions(`${container.width}px`);
		} else {
			throw new Error(
				"Invalid parameters. You must provide 'sizes_attr', or 'resolutions' and 'container', or 'container'."
			);
		}

		const imageParams = this.createImageDefaultParameters(params);

		const hash = await this.getHash(
			params.path,
			resolutions,
			imageParams.target_ratio,
			imageParams.ratio_diff_threshold,
			container,
			params.crop
		);

		if (!this.hashToImageData[hash]) {
			this.hashToImageData[hash] = {
				resolutions: [],
				lossless: imageParams.lossless,
				metadata: undefined,
				originalPath: params.path,
				target_ratio: imageParams.target_ratio,
				ratio_diff_threshold: imageParams.ratio_diff_threshold,
				container: {
					object_fit: "",
					width: 0,
					height: 0,
				},
				crop: undefined,
			};
		}

		if (params.crop) {
			this.hashToImageData[hash].crop = params.crop;
		}

		const metadata = await this.getMetadata(hash);

		const originalWidth = metadata.width || Infinity;

		resolutions = Array.from(
			new Set(resolutions.filter((width) => width <= originalWidth))
		);

		const imgDimensions = {
			width: metadata.width || 100,
			height: metadata.height || 100,
		};

		if (resolutions.length == 0) {
			resolutions = [imgDimensions.width];
		}

		resolutions = resolutions.filter(
			(width) => width <= (metadata.width || Infinity)
		);

		if (resolutions.length == 0) {
			resolutions = [imgDimensions.width];
		}

		this.hashToImageData[hash].resolutions = resolutions;

		const extensions = [
			"webp",
			"png",
			...(imageParams.lossless ? [] : ["jpg", "avif"]),
		];

		let imageWidth = imgDimensions.width;
		let imageHeight = imgDimensions.height;
		let objectWidth: number = imgDimensions.width;

		if (container) {
			this.hashToImageData[hash].container = container;

			if (container.height > 0 && container.width > 0) {
				const objectSize = this.calculateImageSizeForContainer(
					imgDimensions.width,
					imgDimensions.height,
					container.width,
					container.height,
					container.object_fit
				);

				objectWidth = objectSize.width;
				imageHeight = objectSize.height;
				imageWidth = container.width;

				if (imageParams.img_style) {
					imageParams.img_style += `object-fit: ${container.object_fit};`;
				} else {
					imageParams.img_style = `object-fit: ${container.object_fit};`;
				}
			} else {
				throw new Error("Invalid container dimensions");
			}
		}

		let html = "<picture>";

		let sizes = "";
		if ("sizes_attr" in params && params.sizes_attr) {
			sizes = params.sizes_attr;
		} else if ("container" in params && params.container) {
			sizes += `${objectWidth}px`;
		}

		html += this.generateResponsiveImageSources(
			hash,
			extensions,
			resolutions,
			sizes
		);

		html += this.generateMainImageTag(
			hash,
			{ width: imageWidth, height: imageHeight },
			imageParams.lazy,
			imageParams.img_style,
			imageParams.alt,
			resolutions
		);

		html += "</picture> ";

		return html;
	}

	private generateResponsiveImageSources(
		hash: string,
		extensions: string[],
		resolutions: number[],
		sizes: string
	): string {
		const sourceTags = extensions.map((extension) => {
			const srcset = resolutions
				.map((resolution) => {
					const imgURL = this.makeImageURL({
						hash,
						width: resolution,
						format: "jpeg",
					});
					return `${imgURL} ${resolution}w`;
				})
				.join(", ");
			return `<source srcset="${srcset}" sizes="${sizes}" type="image/${extension}" />`;
		});

		return sourceTags.join("\n");
	}

	private generateMainImageTag(
		hash: string,
		imgDimensions: { width: number; height: number },
		lazy: boolean,
		img_style: string | undefined,
		alt: string | undefined,
		resolutions: number[]
	): string {
		const midResolutionIndex = Math.max(
			Math.floor(resolutions.length / 2) - 1,
			0
		);
		const midResolution = resolutions[midResolutionIndex];

		const imgURL = this.makeImageURL({
			hash,
			width: midResolution,
			format: "jpeg",
		});

		const lazyLoading = lazy ? `loading="lazy"` : "";
		const imgStyle = img_style ? `style="${img_style}"` : "";
		const altText = alt ? `alt="${alt}"` : "";

		return `<img class="${getImageClasses({
			width: imgDimensions.width,
			height: imgDimensions.height,
			target_ratio: this.hashToImageData[hash].target_ratio,
			ratio_diff_threshold:
				this.hashToImageData[hash].ratio_diff_threshold,
		}).join(" ")}" ${lazyLoading} width="${imgDimensions.width}" height="${
			imgDimensions.height
		}" ${imgStyle} src="${imgURL}" ${altText} />`;
	}

	getRoutes(): Middleware {
		return this.router.routes();
	}

	calculateImageSizeForContainer(
		imageWidth: number,
		imageHeight: number,
		containerWidth: number,
		containerHeight: number,
		objectFit: string
	): { width: number; height: number } {
		let targetWidth: number, targetHeight: number;

		if (containerWidth <= 0 || containerHeight <= 0) {
			targetWidth = 0;
			targetHeight = 0;
		} else {
			const containerAspect = containerWidth / containerHeight;
			const imageAspect = imageWidth / imageHeight;
			if (containerAspect === imageAspect) {
				targetWidth = containerWidth;
				targetHeight = containerHeight;
			}
			if (objectFit === "cover") {
				if (containerAspect > imageAspect) {
					targetWidth = containerWidth;
					targetHeight = containerWidth / imageAspect;
				} else {
					targetHeight = containerHeight;
					targetWidth = containerHeight * imageAspect;
				}
			} else if (objectFit === "contain") {
				if (containerAspect < imageAspect) {
					targetWidth = containerWidth;
					targetHeight = containerWidth / imageAspect;
				} else {
					targetHeight = containerHeight;
					targetWidth = containerHeight * imageAspect;
				}
			} else {
				targetWidth = containerWidth;
				targetHeight = containerHeight;
			}
		}

		return {
			width: targetWidth,
			height: targetHeight,
		};
	}

	private async getHash(
		original_file_path: string,
		resolutions: number[],
		target_ratio: number,
		ratio_diff_threshold: number,
		container?: {
			object_fit: "cover" | "contain";
			width: number;
			height: number;
		},
		crop?: SmartCropOptions | DirectCropOptions
	) {
		const containerString = container ? JSON.stringify(container) : "";
		const cropString = crop ? JSON.stringify(crop) : "";
		return crypto
			.createHash("sha3-256")
			.update(
				`
				${basename(original_file_path)}
				${(await stat(original_file_path)).atime.getTime()}
				${JSON.stringify(resolutions)}
				${JSON.stringify(target_ratio)}
				${JSON.stringify(ratio_diff_threshold)}
				${containerString}
				${cropString}
				`
			)
			.digest("hex");
	}

	private async generateImage({
		hash,
		resolution,
		fileExtension,
	}: {
		hash: string;
		resolution: number;
		fileExtension: correctExtension;
	}) {
		const lossless = this.hashToImageData[hash].lossless;
		return await sharp(this.hashToImageData[hash].originalPath)
			.resize(resolution)
			.toFormat(fileExtension, lossless ? { lossless: true } : {})
			.toBuffer();
	}
}
