import Router from "@koa/router";
import sharp from "sharp";
import crypto from "crypto";
import Queue from "better-queue";
import os from "os";

import { stat } from "fs/promises";
import { extname, basename } from "path";
import { Middleware } from "koa";

import { guessResolutions } from "./guessResolutions";
import {
	applyCrop,
	SmartCropOptions,
	DirectCropOptions,
} from "./smartCropImage";

import { is, predicates } from "@sealcode/ts-predicates";

interface Task {
	hash: string;
	resolution: number;
	fileExtension: string;
	cropData: SmartCropOptions | DirectCropOptions | undefined;
}

interface Task {
	hash: string;
	resolution: number;
	fileExtension: string;
}

type correctExtension = "jpeg" | "png" | "avif" | "webp";

function isCorrectExtension(
	fileExtension: unknown
): fileExtension is correctExtension {
	const extensions = ["avif", "webp", "jpeg", "png"];
	return extensions.includes(fileExtension as string);
}

const MONTH = 60 * 60 * 24 * 30;

// ImgClass
enum imgClass {
	horizontal = "horizontal",
	vertical = "vertical",
	square = "square",
	landscape = "landscape",
	portrait = "portrait",

	ratioCrossedThreshold = "ratio-crossed-threshold",
	ratioAboveThreshold = "ratio-above-threshold",
	ratioBelowThreshold = "ratio-below-threshold",
}

function joinClasses(...classes: string[]): string {
	return classes.join(" ");
}

function makeImgClasses({
	width,
	height,
	target_ratio,
	ratio_diff_threshold,
}: {
	width: number;
	height: number;
	target_ratio: number;
	ratio_diff_threshold: number;
}): string {
	let classes = "";

	if (width > height)
		classes = joinClasses(imgClass.horizontal, imgClass.landscape);
	else if (width === height) classes = joinClasses(imgClass.square);
	else classes = joinClasses(imgClass.vertical, imgClass.portrait);

	const ratio = width / height;
	const ratio_difference = ratio - target_ratio;

	if (Math.abs(ratio_difference) > ratio_diff_threshold) {
		classes = joinClasses(classes, imgClass.ratioCrossedThreshold);

		if (ratio_difference > 0)
			classes = joinClasses(classes, imgClass.ratioAboveThreshold);
		else classes = joinClasses(classes, imgClass.ratioBelowThreshold);
	}

	return classes;
}

function encodeFilename({
	width,
	originalPath,
	format,
}: {
	width: number;
	originalPath: string;
	format: string;
}): string {
	const filename = basename(originalPath)
		.slice(0, -1 * extname(originalPath).length)
		.replace(/\./g, "_");

	return `${filename || "image"}.${width}.${format}`;
}

export default class KoaResponsiveImageRouter extends Router {
	router: Router;
	hashToResolutions: Record<string, number[]> = {};
	hashToLossless: Record<string, boolean> = {};
	hashToMetadata: Record<string, Promise<sharp.Metadata> | undefined> = {};
	hashToOriginalPath: Record<string, string> = {};
	hashToCropData: Record<string, SmartCropOptions | DirectCropOptions> = {};
	nginxWarningDisplayed = false;
	private maxConcurrent: number;
	private imageQueue: Queue;

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

			const cropData = this.hashToCropData[hash];
			if (
				this.hashToResolutions[hash].find(
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
							cropData,
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
			cropData: SmartCropOptions | DirectCropOptions | undefined;
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
			const { hash, resolution, fileExtension, cropData } = task;
			if (isCorrectExtension(fileExtension)) {
				if (is(cropData, predicates.undefined)) {
					const imageBuffer = await this.generateImage({
						hash,
						resolution,
						fileExtension,
					});
					cb(null, imageBuffer);
				} else {
					const croppedImageData = await applyCrop(
						this.hashToOriginalPath[hash],
						this.tmp_path,
						resolution,
						cropData
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
		if (this.hashToMetadata[hash]) {
			return this.hashToMetadata[hash] as Promise<sharp.Metadata>;
		} else {
			const metadata = sharp(this.hashToOriginalPath[hash]).metadata();
			this.hashToMetadata[hash] = metadata;
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
			originalPath: this.hashToOriginalPath[hash],
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

	async image({
		resolutions,
		sizes_attr,
		path,
		alt,
		lossless = false,
		lazy = true,
		img_style,
		target_ratio = 16 / 9,
		ratio_diff_threshold = 0.2,
		crop,
	}: {
		resolutions?: number[];
		sizes_attr: string;
		path: string;
		lossless?: boolean;
		lazy?: boolean;
		img_style?: string;
		target_ratio?: number;
		ratio_diff_threshold?: number;
		alt?: string;
		crop?: SmartCropOptions | DirectCropOptions;
	}): Promise<string> {
		if (!resolutions || !resolutions.length) {
			resolutions = guessResolutions(sizes_attr);
		}

		const hash = await this.getHash(path, resolutions, crop);

		this.hashToLossless[hash] = lossless;
		this.hashToOriginalPath[hash] = path;

		if (crop) {
			this.hashToCropData[hash] = crop;
		}

		const metadata = await this.getMetadata(hash);
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

		this.hashToResolutions[hash] = resolutions;

		const extensions = [
			"webp",
			"png",
			...(lossless ? [] : ["jpg", "avif"]),
		];

		let html = "<picture>";

		html += this.generateResponsiveImageSources(
			hash,
			extensions,
			resolutions,
			sizes_attr
		);

		html += this.generateMainImageTag(
			hash,
			imgDimensions,
			target_ratio,
			ratio_diff_threshold,
			lazy,
			img_style,
			alt,
			resolutions
		);

		html += "</picture> ";

		return html;
	}

	private generateResponsiveImageSources(
		hash: string,
		extensions: string[],
		resolutions: number[],
		sizes_attr: string
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
			return `<source srcset="${srcset}" sizes="${sizes_attr}" type="image/${extension}" />`;
		});

		return sourceTags.join("\n");
	}

	private generateMainImageTag(
		hash: string,
		imgDimensions: { width: number; height: number },
		target_ratio: number,
		ratio_diff_threshold: number,
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

		return `<img class="${makeImgClasses({
			width: imgDimensions.width,
			height: imgDimensions.height,
			target_ratio,
			ratio_diff_threshold,
		})}" ${lazyLoading} width="${imgDimensions.width}" height="${
			imgDimensions.height
		}" ${imgStyle} src="${imgURL}" ${altText} />`;
	}

	getRoutes(): Middleware {
		return this.router.routes();
	}

	private async getHash(
		original_file_path: string,
		resolutions: number[],
		crop?: SmartCropOptions | DirectCropOptions
	) {
		const cropString = crop ? JSON.stringify(crop) : "";
		return crypto
			.createHash("md5")
			.update(
				`
				${basename(original_file_path)}${(
					await stat(original_file_path)
				).atime.getTime()}${JSON.stringify(resolutions)}${cropString}`
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
		const lossless = this.hashToLossless[hash];
		return await sharp(this.hashToOriginalPath[hash])
			.resize(resolution)
			.toFormat(fileExtension, lossless ? { lossless: true } : {})
			.toBuffer();
	}
}
