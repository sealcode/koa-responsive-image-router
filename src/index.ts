import Router from "@koa/router";
import sharp from "sharp";
import crypto from "crypto";

import { stat } from "fs/promises";
import { extname, basename } from "path";
import { Middleware } from "koa";

import { guessResolutions } from "./guessResolutions";

type correctExtension = "jpeg" | "png" | "avif" | "webp";

function isCorrectExtension(type: unknown): type is correctExtension {
	const extensions = ["avif", "webp", "jpeg", "png"];
	return extensions.includes(type as string);
}

const MONTH = 60 * 60 * 24 * 30;

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
	return `${filename}.${width}.${format}`;
}

export default class KoaResponsiveImageRouter extends Router {
	router: Router;
	hashToResolutions: Record<string, number[]> = {};
	hashToLossless: Record<string, boolean> = {};
	hashToMetadata: Record<string, Promise<sharp.Metadata> | undefined> = {};
	hashToOriginalPath: Record<string, string> = {};
	nginxWarningDisplayed = false;

	constructor(public static_path: string) {
		super();
		this.router = new Router();

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
			const type = extname(filename).split(".").pop();

			if (
				this.hashToResolutions[hash].find(
					(el: number) => el === resolution
				) &&
				type !== undefined &&
				isCorrectExtension(type)
			) {
				ctx.set("Cache-Control", `public, max-age=${MONTH}, immutable`);
				ctx.set("etag", `"${hash}:${filename}"`);
				ctx.status = 200; //otherwise the `.fresh` check won't work, see https://koajs.com/
				if (ctx.fresh) {
					ctx.status = 304;
					return;
				}
				try {
					ctx.body = await this.generateImage({
						hash,
						resolution,
						type,
					});
					ctx.type = `image/${type}`;
				} catch (error) {
					console.error(error);
					ctx.response.status = 404;
				}
			} else {
				ctx.response.status = 404;
			}
		});
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
		return `${this.static_path}/${hash}/${encodeFilename({
			width,
			originalPath: this.hashToOriginalPath[hash],
			format,
		})}`;
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
		lossless = false,
		lazy = true,
		img_style,
		target_ratio = 16 / 9,
		ratio_diff_threshold = 0.2,
	}: {
		resolutions?: number[];
		sizes_attr: string;
		path: string;
		lossless?: boolean;
		lazy?: boolean;
		img_style?: string;
		target_ratio?: number;
		ratio_diff_threshold?: number;
	}): Promise<string> {
		if (!resolutions || !resolutions.length) {
			resolutions = guessResolutions(sizes_attr);
		}

		const hash = await this.getHash(path, resolutions);
		this.hashToResolutions[hash] = resolutions;
		this.hashToLossless[hash] = lossless;
		this.hashToOriginalPath[hash] = path;
		const metadata = await this.getMetadata(hash);
		const imgDimensions = {
			width: metadata.width || 100,
			height: metadata.height || 100,
		};

		resolutions = resolutions.filter(
			(width) => width <= (metadata.width || Infinity)
		);

		const extensions = [
			"webp",
			"png",
			...(lossless ? [] : ["jpg", "avif"]),
		];
		let html = "<picture>";

		for (let j = 0; j < extensions.length; j++) {
			html += '\n<source\nsrcset="\n';

			for (let i = 0; i < resolutions.length; i++) {
				html += `${this.makeImageURL({
					hash,
					width: resolutions[i],
					format: extensions[j],
				})} ${resolutions[i]}w`;

				if (i !== resolutions.length - 1) {
					html += ",";
				} else {
					html += `\n"`;
				}
				html += `\n`;
			}

			html += `src="${this.makeImageURL({
				hash,
				width: resolutions[Math.round(resolutions.length / 2)],
				format: extensions[j],
			})}"\n`;

			html += `sizes="${sizes_attr}"\ntype="image/${extensions[j]}"\n/>\n`;
		}

		// refer to readme to learn about these classes
		html += `<img class="${makeImgClasses({
			width: imgDimensions.width,
			height: imgDimensions.height,
			target_ratio,
			ratio_diff_threshold,
		})}" ${lazy ? `loading="lazy"` : ""} width="${
			imgDimensions.width
		}" height="${imgDimensions.height}" ${
			img_style ? `style="${img_style}"` : ""
		} src="${this.makeImageURL({
			hash,
			width: resolutions[Math.round(resolutions.length / 2)],
			format: "jpeg",
		})}" /></picture>`;
		return html;
	}

	getRoutes(): Middleware {
		return this.router.routes();
	}

	private async getHash(original_file_path: string, resolutions: number[]) {
		return crypto
			.createHash("md5")
			.update(
				`
				${basename(original_file_path)}${(
					await stat(original_file_path)
				).atime.getTime()}${JSON.stringify(resolutions)}`
			)
			.digest("hex");
	}

	private async generateImage({
		hash,
		resolution,
		type,
	}: {
		hash: string;
		resolution: number;
		type: correctExtension;
	}) {
		const lossless = this.hashToLossless[hash];
		return await sharp(this.hashToOriginalPath[hash])
			.resize(resolution)
			.toFormat(type, lossless ? { lossless: true } : {})
			.toBuffer();
	}
}
