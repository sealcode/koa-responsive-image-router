import Router from "@koa/router";
import sharp from "sharp";
import crypto from "crypto";

import { access, mkdir, copyFile, readFile, stat } from "fs/promises";
import { extname, basename } from "path";
import { Middleware } from "koa";

type correctExtension = "jpeg" | "png" | "avif" | "webp";

function isCorrectExtension(type: unknown): type is correctExtension {
	const extensions = ["avif", "webp", "jpeg", "png"];
	return extensions.includes(type as string);
}

const MONTH = 60 * 60 * 24 * 30;

export default class KoaResponsiveImageRouter extends Router {
	router: Router;
	hashToResolutions: Record<string, number[]> = {};
	hashToLossless: Record<string, boolean> = {};
	hashToMetadata: Record<string, Promise<sharp.Metadata> | undefined> = {};

	constructor(public static_path: string, public tmp_dir: string) {
		super();
		this.router = new Router();

		this.router.get("/:hash/:filename", async (ctx) => {
			const { hash, filename } = ctx.params;
			const resolution = parseInt(filename.split(".")[0]);
			const destination = `${this.getHashedPath(hash)}`;
			const type = extname(filename).split(".").pop();

			if (
				this.hashToResolutions[hash].find(
					(el: number) => el === resolution
				) &&
				type !== undefined &&
				isCorrectExtension(type)
			) {
				ctx.set("Cache-Control", `public, max-age=${MONTH}`);
				ctx.set("etag", `"${hash}:${filename}"`);
				ctx.status = 200; //otherwise the `.fresh` check won't work, see https://koajs.com/
				if (ctx.fresh) {
					ctx.status = 304;
					return;
				}
				try {
					await access(destination);
					ctx.body = await this.getImage({ hash, resolution, type });
					ctx.type = `image/${type}`;
				} catch (error) {
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
			const metadata = sharp(
				`${this.getHashedPath(hash)}/original-file`
			).metadata();
			this.hashToMetadata[hash] = metadata;
			return metadata;
		}
	}

	async image({
		resolutions,
		sizes_attr,
		path,
		lossless = false,
		lazy = true,
	}: {
		resolutions: number[];
		sizes_attr: string;
		path: string;
		lossless?: boolean;
		lazy?: boolean;
	}): Promise<string> {
		const hash = await this.getHash(path, resolutions);
		this.hashToResolutions[hash] = resolutions;
		this.hashToLossless[hash] = lossless;

		const metadata = await this.getMetadata(hash);

		resolutions = resolutions.filter(
			(width) => width <= (metadata.width || Infinity)
		);

		await this.generateDirectory(path, hash);
		await this.copySourceFile(path, hash);

		const destination = `${this.static_path}/${hash}`;
		const extensions = [
			"webp",
			"png",
			...(lossless ? [] : ["jpg", "avif"]),
		];
		let html = "<picture>";

		for (let j = 0; j < extensions.length; j++) {
			html += '\n<source\nsrcset="\n';

			for (let i = 0; i < resolutions.length; i++) {
				html += `${destination}/${resolutions[i]}.${extensions[j]} ${resolutions[i]}w`;

				if (i !== resolutions.length - 1) {
					html += ",";
				} else {
					html += `\n"`;
				}
				html += `\n`;
			}

			html += `src="${destination}/${
				resolutions[Math.round(resolutions.length / 2)]
			}.${extensions[j]}"\n`;

			html += `sizes="${sizes_attr}"\ntype="image/${extensions[j]}"\n/>\n`;
		}

		html += `<img ${lazy ? `loading="lazy"` : ""} width="${
			metadata.width
		}" height="${metadata.height}" src="${destination}/${
			resolutions[Math.round(resolutions.length / 2)]
		}.jpeg" /></picture>`;
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

	private getHashedPath(hash: string) {
		return `${this.tmp_dir}/${hash}`;
	}

	private async generateDirectory(original_file_path: string, hash: string) {
		const destination = `${this.tmp_dir}/${hash}`;
		try {
			await access(destination);
		} catch {
			try {
				await mkdir(destination, { recursive: true });
			} catch (error) {
				console.log("directory exist");
			}
		}
	}

	private async copySourceFile(original_file_path: string, hash: string) {
		const source = original_file_path;
		const destination = `${this.getHashedPath(hash)}/original-file`;
		await copyFile(source, destination);
	}

	private async getImage({
		hash,
		resolution,
		type,
	}: {
		hash: string;
		resolution: number;
		type: correctExtension;
	}): Promise<Buffer> {
		try {
			return Buffer.from(
				((await readFile(
					`${this.getHashedPath(hash)}/${resolution}.${type}`
				)) as unknown) as string,
				"base64" as BufferEncoding
			);
		} catch {
			const buffer = await this.generateImage({ hash, resolution, type });
			this.saveImage({ hash, resolution, type, buffer });
			return buffer;
		}
	}

	private saveImage({
		hash,
		resolution,
		type,
		buffer,
	}: {
		hash: string;
		resolution: number;
		type: string;
		buffer: Buffer;
	}) {
		void sharp(buffer).toFile(
			`${this.getHashedPath(hash)}/${resolution}.${type}`
		);
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
		return await sharp(`${this.getHashedPath(hash)}/original-file`)
			.resize(resolution)
			.toFormat(type, lossless ? { lossless: true } : {})
			.toBuffer();
	}
}
