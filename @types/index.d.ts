/// <reference types="koa__router" />
import Router from "@koa/router";
import { Middleware } from "koa";
export default class KoaResponsiveImageRouter extends Router {
	static_path: string;
	tmp_dir: string;
	router: Router;
	hashToResolutions: Record<string, number[]>;
	constructor(static_path: string, tmp_dir: string);
	image({
		resolutions,
		sizes_attr,
		path,
	}: {
		resolutions?: number[];
		sizes_attr: string;
		path: string;
	}): Promise<string>;
	getRoutes(): Middleware;
	private getHash;
	private getHashedPath;
	private generateDirectory;
	private copySourceFile;
	private getImage;
	private saveImage;
	private generateImage;
}
