import Router from "koa-router";
import sharp from "sharp";
import crypto from "crypto";
import { statSync } from "fs";
import { access, mkdir, copyFile, readFile } from "fs/promises";
import { dirname, extname, basename } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = new Router();

const temp_dir = "/tmp/image-cache";
const resolutions = [320, 600, 900, 1600, 1920];

async function init() {
    await generateDirectory();
    await copySourceFile();
}
init();

function getHash(original_file_path) {
    return crypto
        .createHash("md5")
        .update(
            basename(original_file_path) + statSync(original_file_path).atime
        )
        .digest("hex");
}

function getHashedPath(hash) {
    return `${__dirname}${temp_dir}/${hash}`;
}

async function generateDirectory() {
    const destination = `${__dirname}/${temp_dir}/${hash}`;
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

async function copySourceFile() {
    const source = `${__dirname}/${basename(original_file_path)}`;
    const destination = `${getHashedPath(hash)}/original-file`;
    await copyFile(source, destination);
}

async function getImage({ hash, resolution, type }) {
    try {
        return Buffer.from(
            await readFile(`${getHashedPath(hash)}/${resolution}.${type}`),
            "base64"
        );
    } catch {
        const buffer = await generateImage({ hash, resolution, type });
        saveImage({ hash, resolution, type, buffer });
        return buffer;
    }
}

function saveImage({ hash, resolution, type, buffer }) {
    sharp(buffer).toFile(`${getHashedPath(hash)}/${resolution}.${type}`);
}

async function generateImage({ hash, resolution, type }) {
    return await sharp(`${getHashedPath(hash)}/original-file`)
        .resize(parseInt(resolution))
        .toFormat(type)
        .toBuffer();
}

router.image = ({ resolutions, sizes_attr, path }) => {
    const destination = `/images/${getHash(path)}`;
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
};

router.get("/images/:hash/:filename", async (ctx) => {
    const { hash, filename } = ctx.params;
    const resolution = parseInt(filename.split(".")[0]);
    const destination = `${getHashedPath(hash)}`;
    const type = extname(filename).split(".").pop();

    if (resolutions.find((el) => el === resolution)) {
        try {
            await access(destination);
            ctx.body = await getImage({ hash, resolution, type });
            ctx.type = `image/${ctx.params.type}`;
        } catch (error) {
            ctx.response.status = 404;
        }
    } else {
        ctx.response.status = 404;
    }
});

export default router;