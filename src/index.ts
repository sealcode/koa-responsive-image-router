import Router from "@koa/router";
import crypto from "crypto";
import { stat } from "fs/promises";
import { Middleware } from "koa";
import { basename, extname } from "path";
import { MONTH } from "./constants/constants";
import {
	FilruParameters,
	Task,
	ThumbnailCacheParams,
} from "./types/cacheManager";
import {
	BaseImageParameters,
	Container,
	CropDescription,
	ImageParameters,
} from "./types/imageRouter";
import { ImageInfoTool } from "./utils/ImageInfoTool";
import { CacheManager } from "./utils/cache/CacheManager";
import { guessResolutions } from "./utils/guessResolutions";
import {
	checkMaxConcurrent,
	encodeFilename,
	getImageClasses,
	isCorrectExtension,
} from "./utils/utils";
import { fit } from "object-fit-math";
import { hasField } from "@sealcode/ts-predicates";

export class KoaResponsiveImageRouter extends Router {
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
	 * @param {string} smartCropStoragePath - cache directory for smartcrop results
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
		smartCropStoragePath,
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
		imageStoragePath: string;
		smartCropStoragePath: string;
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
			storagePath: smartCropStoragePath,
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
	): BaseImageParameters {
		const result: BaseImageParameters = {
			alt: params.alt ? params.alt : "",
			lossless: params.lossless ? params.lossless : false,
			lazy: params.lazy ? params.lazy : true,
			imgStyle: params.imgStyle || "",
			targetRatio: params.targetRatio ? params.targetRatio : 16 / 9,
			ratioDiffThreshold: params.ratioDiffThreshold
				? params.ratioDiffThreshold
				: 0.2,
			thumbnailSize: params.thumbnailSize
				? params.thumbnailSize
				: this.defaultThumbnailSize,
			crop: false,
			style: "",
		};
		return result;
	}

	prepareResolutions({
		sizesAttr,
		resolutions,
		container,
		original_image_size,
		thumbnailSize,
	}: {
		sizesAttr?: string;
		resolutions?: number[];
		container?: Container;
		original_image_size: { width: number; height: number };
		thumbnailSize: number;
	}) {
		if (!resolutions) {
			if (sizesAttr) {
				resolutions = guessResolutions(
					sizesAttr,
					{},
					undefined,
					original_image_size
				);
			} else if (container) {
				resolutions = guessResolutions(
					`${container.width}px`,
					{},
					container,
					original_image_size
				);
			} else {
				throw new Error(
					"Invalid parameters. You must provide at least either: (resolutions) or (sizesAttr) or (container)"
				);
			}
		}
		resolutions.push(thumbnailSize);
		resolutions = Array.from(
			new Set(
				resolutions.filter(
					(width) => width <= original_image_size.width
				)
			)
		);
		if (resolutions.filter((l) => l != thumbnailSize).length == 0) {
			// no resolutions other than the thumbnail, let's add at least one
			resolutions = [original_image_size.width];
		}
		resolutions = resolutions.map((l) => Math.round(l));
		return resolutions;
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
	async image(path: string, params: ImageParameters): Promise<string> {
		let container: Container | null = hasField("container", params)
			? params.container
			: null;

		if (!path) {
			return "";
		}

		const metadata = await ImageInfoTool.getMetadata(path);

		const crop = params.crop || false;

		const imageParams = this.createImageDefaultParameters(params);

		const resolutions = this.prepareResolutions({
			...params,
			original_image_size: {
				width: metadata.width as number,
				height: metadata.height as number,
			},
			thumbnailSize: params.thumbnailSize || this.defaultThumbnailSize,
		});

		const hash = this.getHash(
			path,
			resolutions,
			imageParams.targetRatio,
			imageParams.ratioDiffThreshold,
			container,
			crop
		);

		ImageInfoTool.initImageData(hash);
		ImageInfoTool.updateProperty(hash, "resolutions", resolutions);
		ImageInfoTool.updateProperty(hash, "lossless", imageParams.lossless);
		ImageInfoTool.updateProperty(hash, "originalPath", path);
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

		ImageInfoTool.updateProperty(
			hash,
			"thumbnailSize",
			imageParams.thumbnailSize
		);

		const imgDimensions = {
			width: metadata.width || 100,
			height: metadata.height || 100,
		};

		const extensions = [
			...(imageParams.lossless ? [] : ["avif"]),
			"webp",
			"png",
			...(imageParams.lossless ? [] : ["jpeg"]),
		];

		let imageWidth = imgDimensions.width;
		let imageHeight = imgDimensions.height;
		let objectWidth: number = imgDimensions.width;

		const thumbnailExtension = "jpeg";

		const thumbnailTask: Task = {
			hash: hash,
			resolution: imageParams.thumbnailSize,
			fileExtension: thumbnailExtension,
			cropData: crop,
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
					container.objectFit || "contain"
				);

				objectWidth = objectSize.width;
				imageHeight = objectSize.height;
				imageWidth = container.width;
				imageParams.imgStyle =
					(imageParams.imgStyle || "") +
					`object-fit: ${
						container.objectFit || "contain"
					}; width: 100%; height: 100%;`;
			} else {
				throw new Error("Invalid container dimensions");
			}
		}

		let html = "";
		let background_size = "100% 100%";
		if (container) {
			const fitted_image_size = fit(
				container,
				imgDimensions,
				container.objectFit || "contain"
			);
			background_size = `${
				(fitted_image_size.width / container.width) * 100
			}% ${(fitted_image_size.height / container.height) * 100}%`;
		}

		const styles: string[] = [
			`display: inline-flex`, // to prevent weird padding at the bottom of the image
			`background-size: ${background_size}`,
			`background-position: 50%`,
			`background-repeat: no-repeat`,
			`width: 100%`,
		];

		if (
			lowResCacheBase64 &&
			ImageInfoTool.getImageData(hash).thumbnailSize <=
				this.cacheManagerResolutionThreshold
		) {
			const uniqueId = this.generateUniqueId();

			let thumbnail_display_width = "calc(100% + 10px)";
			let thumbnail_display_height = "calc(100% + 10px)";
			if (container) {
				const fitted_image_size = fit(
					container,
					imgDimensions,
					container.objectFit || "contain"
				);
				thumbnail_display_width = `${
					(fitted_image_size.width / container.width) * 100
				}%`;
				thumbnail_display_height = `${
					(fitted_image_size.height / container.height) * 100
				}%`;
			}

			html += `
			<style>
				#${uniqueId}::after {
					content: "";
					display: block;
					position: absolute;
					top: -5px;
					left: -5px;
					width: ${thumbnail_display_width};
					height: ${thumbnail_display_height};
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
		html += `${styles.join(";")} ${params.style || ""}"`;

		let sizes = "";
		if ("sizesAttr" in params && params.sizesAttr) {
			sizes = params.sizesAttr;
		} else if ("container" in params && params.container) {
			const fitted_image_size = fit(
				params.container,
				metadata as { width: number; height: number },
				params.container.objectFit || "contain"
			);
			sizes += `${
				params.container.width
					? Math.min(
							fitted_image_size.width,
							metadata.width as number
					  )
					: objectWidth
			}px`;
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
			imageParams.imgStyle || "width: 100%; height: 100%",
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
						extension,
					});
					return `${imgURL} ${Math.round(resolution)}w`;
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
		objectFit: string = "contain"
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

	private getHash(
		original_file_path: string,
		resolutions: number[],
		target_ratio: number,
		ratio_diff_threshold: number,
		container: Container | null,
		crop: CropDescription
	) {
		const containerString = container ? JSON.stringify(container) : "";
		const cropString = crop ? JSON.stringify(crop) : "";

		return crypto
			.createHash("SHA1")
			.update(
				`
				${basename(original_file_path)}
				${
					"" /* (await stat(original_file_path)).mtime.getTime()  // -- commented out. seems like it's not worth checking the mtime each time. Let's assume that if the file changes, so does its filename. */
				}
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
