import Router from "@koa/router";
import sharp from "sharp";
import crypto from "crypto";
import { statSync } from "fs";
import { access, mkdir, copyFile, readFile } from "fs/promises";
import { dirname, extname, basename } from "path";
import { fileURLToPath } from "url";

export default class ResponsiveImageRouter extends Router {
    static_path: string = "";
    tmp_dir: string = "";
    hash: string = "";

    constructor(static_path: string, tmp_dir: string) {
        super();
        this.static_path = static_path;
        // this.hash = getHash(original_file_path);
    }

    image({ resolutions, sizes_attr, path }): string {
        const destination = `/images/${this.getHash(path)}`;
        const extensions = ["jpg", "png", "avif", "webp"];
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

            html += `src="${destination}${
                resolutions[parseInt(resolutions.length / 2, 10)]
            }.${extensions[j]}"\n`;

            html += `sizes="${sizes_attr}"\ntype="image/${
                extensions[j] === "jpg" ? "jpeg" : extensions[j]
            }"\n/>\n`;
        }

        html += `<img src="${destination}${
            resolutions[parseInt(resolutions.length / 2, 10)]
        }.jpg" /></picture>`;
        return html;
    }

    getRoutes() {
		
	}

    private getHash(original_file_path: string) {
        return crypto
            .createHash("md5")
            .update(
                basename(original_file_path) +
                    statSync(original_file_path).atime
            )
            .digest("hex");
    }

    private getHashedPath(hash: string) {
        return `${__dirname}${this.tmp_dir}/${hash}`;
    }

    private async generateDirectory() {
        const destination = `${__dirname}/${this.tmp_dir}/${this.hash}`;
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

    private async copySourceFile() {
        const source = `${__dirname}/${basename(original_file_path)}`;
        const destination = `${this.getHashedPath(this.hash)}/original-file`;
        await copyFile(source, destination);
    }

    private async getImage({ hash, resolution, type }): Promise<Buffer> {
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

    private saveImage({ hash, resolution, type, buffer }) {
        sharp(buffer).toFile(
            `${this.getHashedPath(hash)}/${resolution}.${type}`
        );
    }

    private async generateImage({ hash, resolution, type }) {
        return await sharp(`${this.getHashedPath(hash)}/original-file`)
            .resize(parseInt(resolution))
            .toFormat(type)
            .toBuffer();
    }
}
