import Koa from "koa";
import Router from "koa-router";
import sharp from "sharp";
import crypto from "crypto";
import { statSync, readFileSync, closeSync, openSync } from "fs";
import { access, mkdir, copyFile } from "fs/promises";
import { dirname, extname, basename } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = new Koa();
const router = new Router();

const temp_dir = "/tmp/image-cache";
const resolutions = [320, 600, 900, 1600, 1920];
const original_file_path = "./image.png";
const hash = getHash(original_file_path);

async function init() {
    await generateDirectory();
    await copySourceFile();
}
init();

function getHash(original_file_path) {
    return crypto
        .createHash("md5")
        .update(
            basename(original_file_path) +
                statSync(`${__dirname}/${original_file_path}`).atime
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

async function getImage({ hash, resolution, type }) {
    try {
        return getCachedImage({ hash, resolution, type });
    } catch {
        const buffer = await generateImage({ hash, resolution, type });
        saveImage({ hash, resolution, type, buffer });
        return buffer;
    }
}

function getCachedImage({ hash, resolution, type }) {
    const file = readFileSync(`${getHashedPath(hash)}/${resolution}.${type}`);
    return Buffer.from(file, "base64");
}

async function saveImage({ hash, resolution, type, buffer }) {
    await createEmptyImage({ hash, type, resolution });
    sharp(buffer).toFile(`${getHashedPath(hash)}/${resolution}.${type}`);
}

async function createEmptyImage({ hash, type, resolution }) {
    closeSync(openSync(`${getHashedPath(hash)}/${resolution}.${type}`, "w"));
}

async function generateImage({ hash, resolution, type }) {
    return await sharp(`${getHashedPath(hash)}/original-file`)
        .resize(parseInt(resolution))
        .toFormat(type)
        .toBuffer();
}

app.use(router.routes()).use(router.allowedMethods()).listen(3005);

// tbc

function image({ path, resolutions, quality, extensions, alt }) {
    let sources = "";

    for (let i = 0; i < resolutions.length; i++) {
        for (let j = 0; j < extensions.length; j++) {
            const filename = `${hash}-${resolutions[i]}.${extensions[j]}`;
            sources += `<source srcset="${path}/${filename}" media="(min-width: ${resolutions[i]}px)">`;
        }
    }

    return `
        <picture>
            ${sources}
            <img src="" alt="">
        </picture>`;
}
