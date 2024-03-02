import Router from "@koa/router";
import crypto from "crypto";

import { stat } from "fs/promises";
import { extname, basename } from "path";
import { Middleware } from "koa";

import { guessResolutions } from "./utils/guessResolutions";

import {
	FilruParameters,
	Task,
	ThumbnailCacheParams,
} from "./types/cacheManager";

import { MONTH } from "./constants/constants";

import {
	encodeFilename,
	getImageClasses,
	isCorrectExtension,
	checkMaxConcurrent,
} from "./utils/utils";

import { ImageInfoTool } from "./utils/ImageInfoTool";

import { SmartCropOptions, DirectCropOptions } from "./utils/smartCropImage";

import { CacheManager } from "./utils/cache/CacheManager";
import {
	BaseImageParameters,
	ImageParameters,
	ImageParametersWithDefaults,
} from "./types/imageRouter";

export default class KoaResponsiveImageRouter extends Router {
	private router: Router;
	// Store low resolution thumbnail
	private cacheManager: CacheManager;
	// Flag to track if the NGINX warning has been displayed
	private nginxWarningDisplayed = false;
	// Generated thumbnail size in pixels
	private defaultThumbnailSize: number;
	// id for thumbnail
	private currentId = 0;
	private staticPath;
	private cacheManagerResolutionThreshold;

	/**
	 * @param {string} static_path - static url
	 * @param {string} thumbnailSize - thumbnail size in pixels
	 * @param {number} [cacheManagerResolutionThreshold] - Threshold for
	 * determining whether images should be stored in memory or on disk in the
	 * cache manager. It represents the image size in pixels, and images larger
	 * than this threshold will be stored on disk, while smaller images will be
	 * stored in memory.
	 * @param {string} imageStoragePath - cache directory for images
	 * @param {string} smartCropDtoragePath - cache directory for smartcrop results
	 * @param {number} [maxImagesConcurrent] - number of threads
	 * @param {number} [diskImageCacheSize] - max allowed size of the cache on disk in
	 * mega bytes. (default: 50 MB)
	 * @param {number} [smartCropCacheSize] - max allowed size of the cache on disk in
	 * mega bytes. (default: 50 MB)
	 * @param {number} [pruneInterval] - interval to run cache invalidation in
	 * @param {number} [maxAge] - max allowed age of cached items in seconds.
	 * milliseconds. (default: 5 minutes)
	 * @param {number} [hashSeed] - seed for hashing
	 * @param {number} [thumbnailMaxCacheSize] - max cache size for thumbnails
	 */
	constructor({
		staticPath,
		thumbnailSize,
		cacheManagerResolutionThreshold,
		imageStoragePath,
		smartCropDtoragePath,
		maxImagesConcurrent,
		diskImageCacheSize,
		smartCropCacheSize,
		pruneInterval,
		maxAge,
		hashSeed,
		thumbnailMaxCacheSize,
	}: {
		staticPath: string;
		thumbnailSize: number;
		cacheManagerResolutionThreshold: number;
		imageStoragePath?: string;
		smartCropDtoragePath?: string;
		maxImagesConcurrent?: number;
		diskImageCacheSize?: number;
		smartCropCacheSize?: number;
		pruneInterval?: number;
		maxAge?: number;
		hashSeed?: string;
		thumbnailMaxCacheSize?: number;
	}) {
		super();
		this.router = new Router();
		this.staticPath = staticPath;
		this.cacheManagerResolutionThreshold = cacheManagerResolutionThreshold;
		this.defaultThumbnailSize = thumbnailSize;

		const localCachePatameters: FilruParameters = {
			storagePath: imageStoragePath,
			diskCacheSize: diskImageCacheSize,
			pruneInterval: pruneInterval,
			maxAge: maxAge,
			hashSeed: hashSeed,
		};

		const smartcropCacheParams: FilruParameters = {
			storagePath: smartCropDtoragePath,
			diskCacheSize: smartCropCacheSize,
			pruneInterval: pruneInterval,
			maxAge: maxAge,
			hashSeed: hashSeed,
		};

		const thumnailCacheParams: ThumbnailCacheParams = {
			maxCacheSize: thumbnailMaxCacheSize,
		};

		maxImagesConcurrent = checkMaxConcurrent(maxImagesConcurrent);

		this.cacheManager = new CacheManager(
			thumnailCacheParams,
			localCachePatameters,
			smartcropCacheParams,
			maxImagesConcurrent,
			cacheManagerResolutionThreshold
		);

		this.router.get("/:hash/:filename", async (ctx) => {
			// Display NGINX warning if not using a caching proxy
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

			// Serve image if hash, resolution, and extension are valid
			const cropData = ImageInfoTool.getImageData(hash).crop;
			if (
				!(
					ImageInfoTool.getImageData(hash).resolutions.find(
						(el: number) => el === resolution
					) &&
					fileExtension !== undefined &&
					isCorrectExtension(fileExtension)
				)
			) {
				ctx.response.status = 404;
				return;
			}
			ctx.set("Cache-Control", `public, max-age=${MONTH}, immutable`);
			ctx.set("etag", `"${hash}:${filename}"`);
			ctx.status = 200; //otherwise the `.fresh` check won't work, see https://koajs.com/
			if (ctx.fresh) {
				ctx.status = 304;
				return;
			}

			try {
				const thumbnailTask: Task = {
					hash: hash,
					resolution: resolution,
					fileExtension: fileExtension,
					cropData: cropData,
				};

				const imageBuffer =
					this.cacheManager.cachedGetProcessedImage(thumbnailTask);

				ctx.body = await imageBuffer;

				ctx.type = `image/${fileExtension}`;
				ctx.status = 200;
			} catch (error) {
				console.error(error);
				ctx.response.status = 404;
			}
		});
	}

	async start(): Promise<void> {
		await this.cacheManager.start();
	}

	private makeImageURL({
		hash,
		width,
		extension,
	}: {
		hash: string;
		width: number;
		extension: string;
	}): string {
		const result = `${this.staticPath}/${hash}/${encodeFilename({
			width,
			originalPath: ImageInfoTool.getImageData(hash).originalPath,
			extension,
		})}`;

		return result;
	}

	makeNginxConfig(cache_path: string, max_size_mb: number): string {
		return `http {
	proxy_cache_path ${cache_path} keys_zone=cache:10m levels=1:2 inactive=90d max_size=${max_size_mb}m use_temp_path=off;

	server {
		# ....
		location ${this.staticPath} {
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
			imgStyle:
				typeof params.imgStyle !== "undefined" ? params.imgStyle : "",
			targetRatio:
				typeof params.targetRatio !== "undefined"
					? params.targetRatio
					: 16 / 9,
			ratioDiffThreshold:
				typeof params.ratioDiffThreshold !== "undefined"
					? params.ratioDiffThreshold
					: 0.2,
			thumbnailSize:
				typeof params.thumbnailSize !== "undefined"
					? params.thumbnailSize
					: this.defaultThumbnailSize,
		};
		return result;
	}

	/**
	 * Generates an <img> tag with responsive attributes based on the provided parameters.
	 *
	 * This function takes various parameters to create an HTML <img> tag with responsive attributes,
	 * allowing for flexible customization of image display and behavior.
	 *
	 * @param {BaseImageParameters} params - An object containing base image parameters.
	 * @param {number[]} [params.resolutions] - An array of resolutions for responsive images.
	 * @param {string} params.sizesAttr - The "sizes" attribute for the <img> tag, specifying responsive behavior based on available space.
	 * @param {string} params.path - The path to the original image to be processed and delivered by the function.
	 * @param {string} params.alt - The "alt" attribute for the <img> tag, describing the image content.
	 * @param {boolean} [params.lossless=false] - A boolean indicating whether to use lossless compression for images (default: false).
	 * @param {boolean} [params.lazy=true] - A boolean indicating whether lazy loading of images should be enabled (default: true).
	 * @param {string} [params.imgStyle] - CSS styles to be applied to the <img> tag.
	 * @param {number} [params.targetRatio=16/9] - The target aspect ratio for cropping images (default: 16/9).
	 * @param {number} [params.ratioDiffThreshold=0.2] - The threshold for acceptable aspect ratio differences (default: 0.2).
	 * @param {number} [params.thumbnailSize] - Custom thumbnail size.
	 * @param {SmartCropOptions | DirectCropOptions} [params.crop] - Options for smart cropping or direct cropping of images.
	 *
	 * @return {Promise<string>} - A string representing the HTML <img> tag with appropriate attributes and CSS classes.
	 */
	async image(params: ImageParameters): Promise<string> {
		let resolutions: number[] = [];
		let container;

		if (
			"sizesAttr" in params &&
			params.sizesAttr &&
			"resolutions" in params
		) {
			resolutions = params.resolutions;
		} else if ("sizesAttr" in params && params.sizesAttr) {
			resolutions = guessResolutions(params.sizesAttr);
		} else if ("resolutions" in params && "container" in params) {
			resolutions = params.resolutions;
			container = params.container;
		} else if ("container" in params) {
			container = params.container;
			resolutions = guessResolutions(`${container.width}px`);
		} else {
			throw new Error(
				"Invalid parameters. You must provide 'sizesAttr', or 'resolutions' and 'container', or 'container'."
			);
		}

		const imageParams = this.createImageDefaultParameters(params);

		const hash = await this.getHash(
			params.path,
			resolutions,
			imageParams.targetRatio,
			imageParams.ratioDiffThreshold,
			container,
			params.crop
		);

		ImageInfoTool.initImageData(hash);

		ImageInfoTool.updateProperty(hash, "lossless", imageParams.lossless);
		ImageInfoTool.updateProperty(hash, "originalPath", params.path);
		ImageInfoTool.updateProperty(
			hash,
			"targetRatio",
			imageParams.targetRatio
		);
		ImageInfoTool.updateProperty(
			hash,
			"ratioDiffThreshold",
			imageParams.ratioDiffThreshold
		);

		if (params.crop) {
			ImageInfoTool.updateProperty(hash, "crop", params.crop);
		}

		resolutions.push(imageParams.thumbnailSize);

		ImageInfoTool.updateProperty(
			hash,
			"thumbnailSize",
			imageParams.thumbnailSize
		);

		const metadata = await ImageInfoTool.getMetadata(hash);

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

		ImageInfoTool.updateProperty(hash, "resolutions", resolutions);

		const extensions = [
			"webp",
			"png",
			"jxl",
			...(imageParams.lossless ? [] : ["jpg", "avif"]),
		];

		let imageWidth = imgDimensions.width;
		let imageHeight = imgDimensions.height;
		let objectWidth: number = imgDimensions.width;

		const thumbnailExtension = "jpeg";

		const thumbnailTask: Task = {
			hash: hash,
			resolution: imageParams.thumbnailSize,
			fileExtension: thumbnailExtension,
			cropData: params.crop,
		};

		const lowResCacheBase64 = this.cacheManager.isInCache(thumbnailTask);

		if (container) {
			ImageInfoTool.updateProperty(hash, "container", container);

			if (container.height > 0 && container.width > 0) {
				const objectSize = this.calculateImageSizeForContainer(
					imgDimensions.width,
					imgDimensions.height,
					container.width,
					container.height,
					container.objectFit
				);

				objectWidth = objectSize.width;
				imageHeight = objectSize.height;
				imageWidth = container.width;

				if (imageParams.imgStyle) {
					imageParams.imgStyle += `object-fit: ${container.objectFit};`;
				} else {
					imageParams.imgStyle = `object-fit: ${container.objectFit};`;
				}
			} else {
				throw new Error("Invalid container dimensions");
			}
		}

		let html = "";

		const styles: string[] = [
			`display: inline-block`,
			`background-size: 100% 100%`,
			`background-repeat: no-repeat`,
		];

		if (
			lowResCacheBase64 &&
			ImageInfoTool.getImageData(hash).thumbnailSize <=
				this.cacheManagerResolutionThreshold
		) {
			const uniqueId = this.generateUniqueId();

			html += `
			<style>
				#${uniqueId}::after {
					content: "";
					display: block;
					position: absolute;
					top: -5;
					left: -5;
					width: calc(100% + 10px);
					height: calc(100% + 10px);
					z-index: -1;
					-webkit-background-size: cover;
					-moz-background-size: cover;
					-o-background-size: cover;
					background-size: cover;
					background-repeat: no-repeat;
					background-image: url(data:image/*;base64,${lowResCacheBase64});
					-webkit-filter: blur(5px);
					-moz-filter: blur(5px);
					-o-filter: blur(5px);
					-ms-filter: blur(5px);
					filter: blur(5px);
				}
			</style>`;

			html += `<picture id="${uniqueId}"`;
			html += ` style="`;

			styles.push(`overflow: hidden`);
			styles.push(`position: relative`);
		} else {
			html = "<picture ";
			const imageURL = this.makeImageURL({
				hash,
				width: ImageInfoTool.getImageData(hash).thumbnailSize,
				extension: thumbnailExtension,
			});

			html += ` style="`;

			styles.push(`background-image: url(${imageURL})`);
		}
		html += `${styles.join(";")}"`;

		let sizes = "";
		if ("sizesAttr" in params && params.sizesAttr) {
			sizes = params.sizesAttr;
		} else if ("container" in params && params.container) {
			sizes += `${objectWidth}px`;
		}

		html += ">";

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
			imageParams.imgStyle,
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
						extension: "jpeg",
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
		imgStyle: string | undefined,
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
			extension: "jpeg",
		});

		const lazyLoading = lazy ? `loading="lazy"` : "";
		imgStyle = imgStyle ? `style="${imgStyle}"` : "";
		const altText = alt ? `alt="${alt}"` : "";

		return `<img class="${getImageClasses({
			width: imgDimensions.width,
			height: imgDimensions.height,
			targetRatio: ImageInfoTool.getImageData(hash).targetRatio,
			ratioDiffThreshold:
				ImageInfoTool.getImageData(hash).ratioDiffThreshold,
		}).join(" ")}" ${lazyLoading} width="${imgDimensions.width}" height="${
			imgDimensions.height
		}" ${imgStyle} src="${imgURL}" ${altText} />`;
	}

	private generateUniqueId() {
		const uniqueId = `responsive-image-${this.currentId}`;
		this.currentId += 1;
		return uniqueId;
	}

	public calculateImageSizeForContainer(
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
			objectFit: "cover" | "contain";
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

	getRoutes(): Middleware {
		return this.router.routes();
	}
}
