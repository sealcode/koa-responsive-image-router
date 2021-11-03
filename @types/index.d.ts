/// <reference types="koa__router" />
import Router from "@koa/router";
import sharp from "sharp";
import { Middleware } from "koa";
export default class KoaResponsiveImageRouter extends Router {
    static_path: string;
    tmp_dir: string;
    router: Router;
    hashToResolutions: Record<string, number[]>;
    hashToLossless: Record<string, boolean>;
    hashToMetadata: Record<string, Promise<sharp.Metadata> | undefined>;
    constructor(static_path: string, tmp_dir: string);
    getMetadata(hash: string): Promise<sharp.Metadata>;
    image({ resolutions, sizes_attr, path, lossless, lazy, }: {
        resolutions: number[];
        sizes_attr: string;
        path: string;
        lossless?: boolean;
        lazy?: boolean;
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
