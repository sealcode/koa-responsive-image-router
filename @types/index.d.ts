/// <reference types="koa__router" />
import Router from "@koa/router";
import sharp from "sharp";
import { Middleware } from "koa";
export default class KoaResponsiveImageRouter extends Router {
	static_path: string;
	router: Router;
	hashToResolutions: Record<string, number[]>;
	hashToLossless: Record<string, boolean>;
	hashToMetadata: Record<string, Promise<sharp.Metadata> | undefined>;
	hashToOriginalPath: Record<string, string>;
	nginxWarningDisplayed: boolean;
	constructor(static_path: string);
	getMetadata(hash: string): Promise<sharp.Metadata>;
	private makeImageURL;
	makeNginxConfig(cache_path: string, max_size_mb: number): string;
	image({
		resolutions,
		sizes_attr,
		path,
		lossless,
		lazy,
		img_style,
	}: {
		resolutions?: number[];
		sizes_attr: string;
		path: string;
		lossless?: boolean;
		lazy?: boolean;
		img_style?: string;
	}): Promise<string>;
	getRoutes(): Middleware;
	private getHash;
	private generateImage;
}
