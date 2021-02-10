import Koa from "koa";
import Router from "koa-router";
import fs from "fs";
import { fileURLToPath } from "url";
import { dirname } from "path";
import sharp from "sharp";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = new Koa();
const router = new Router();

// user settings
const tmp_dir = "/tmp/image-cache";
const resolutions = [320, 600, 900, 1600, 1920];
const original_file = {
    filename: "image",
    type: "png",
    path: ".",
};

// init router
const hashedName = generateImageName({
    filename: original_file.filename,
    type: original_file.type,
});

async function init() {
    const { filename, type } = original_file;
    const resolution = resolutions[resolutions.length - 1];

    await getImage({ filename, resolution, type });
    try {
        return getCachedImage({ filename, resolution, type });
    } catch {
        const buffer = await generateImage({ filename, resolution, type });
        saveImage({ filename, resolution, type, buffer });
        return buffer;
    }
}
init();

// router.get("/image", async (ctx, next) => {
//     const image = await fs.readFile(
//         `${__dirname}/image.png`,
//         "utf8",
//         (err, data) => data
//     );
//     ctx.body = `<img src="${path.resolve(__dirname, "image.png")}"
// 	alt="Image alt"
// 	srcset="/files/16864/clock-demo-200px.png 1x, /files/16797/clock-demo-400px.png 2x">`;
// });

// image_router.image()
function image({ path, resolutions, quality, extensions, alt }) {
    let sources = "";

    for (let i = 0; i < resolutions.length; i++) {
        for (let j = 0; j < extensions.length; j++) {
            const filename = `${hashedName}-${resolutions[i]}.${extensions[j]}`;
            sources += `<source srcset="${path}/${filename}" media="(min-width: ${resolutions[i]}px)">`;
        }
    }

    return `
        <picture>
            ${sources}
            <img src="" alt="">
        </picture>`;
}

router.get("/images/:filename/:resolution/:type", async (ctx) => {
    if (
        resolutions.find(
            (resolution) => resolution === parseInt(ctx.params.resolution)
        )
    ) {
        ctx.body = await getImage(ctx.params);
        ctx.type = `image/${ctx.params.type}`;
    } else {
        ctx.response.status = 404;
    }
});

async function getImage({ filename, resolution, type }) {
    try {
        return getCachedImage({ filename, resolution, type });
    } catch {
        const buffer = await generateImage({ filename, resolution, type });
        saveImage({ filename, resolution, type, buffer });
        return buffer;
    }
}

function generateImageName({ filename, type }) {
    // get original file details
    const file_details = fs.statSync(`${__dirname}/${filename}.${type}`);
    return crypto
        .createHash("md5")
        .update(filename + file_details.atime)
        .digest("hex");
}

function getCachedImage({ filename, resolution, type }) {
    const file = fs.readFileSync(
        `${__dirname}/tmp/image-cache/${hashedName}-${resolution}.${type}`
    );
    return Buffer.from(file, "base64");
}

async function saveImage({ filename, resolution, type, buffer }) {
    await createEmptyImage({ filename, type, resolution });
    sharp(buffer).toFile(
        `${__dirname}/tmp/image-cache/${hashedName}-${resolution}.${type}`
    );
}

async function createEmptyImage({ filename, type, resolution }) {
    fs.closeSync(
        fs.openSync(
            `${__dirname}/tmp/image-cache/${hashedName}-${resolution}.${type}`,
            "w"
        )
    );
}

async function generateImage({ filename, type, resolution }) {
    // get original image
    const pixelArray = await sharp(`${__dirname}/${filename}.${type}`)
        .toResize(parseInt(resolution))
        .toFormat(type)
        .toBuffer();
    return pixelArray;
}

app.use(router.routes()).use(router.allowedMethods()).listen(3001);
