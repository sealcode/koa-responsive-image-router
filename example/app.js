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
const sizes = [320, 600, 900, 1600, 1920];
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
    const size = sizes[sizes.length - 1];

    await getImage({ filename, size, type });
    try {
        return getCachedImage({ filename, size, type });
    } catch {
        const buffer = await generateImage({ filename, size, type });
        saveImage({ filename, size, type, buffer });
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

router.get("/images/:filename/:size/:type", async (ctx) => {
    if (sizes.find((size) => size === parseInt(ctx.params.size))) {
        ctx.body = await getImage(ctx.params);
        ctx.type = `image/${ctx.params.type}`;
    } else {
        ctx.response.status = 404;
    }
});

async function getImage({ filename, size, type }) {
    try {
        return getCachedImage({ filename, size, type });
    } catch {
        const buffer = await generateImage({ filename, size, type });
        saveImage({ filename, size, type, buffer });
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

function getCachedImage({ filename, size, type }) {
    const file = fs.readFileSync(
        `${__dirname}/tmp/image-cache/${hashedName}-${size}.${type}`
    );
    return Buffer.from(file, "base64");
}

async function saveImage({ filename, size, type, buffer }) {
    await createEmptyImage({ filename, type, size });
    sharp(buffer).toFile(
        `${__dirname}/tmp/image-cache/${hashedName}-${size}.${type}`
    );
}

async function createEmptyImage({ filename, type, size }) {
    fs.closeSync(
        fs.openSync(
            `${__dirname}/tmp/image-cache/${hashedName}-${size}.${type}`,
            "w"
        )
    );
}

async function generateImage({ filename, type, size }) {
    // get original image
    const pixelArray = await sharp(`${__dirname}/${filename}.${type}`)
        .resize(parseInt(size))
        .toFormat(type)
        .toBuffer();
    return pixelArray;
}

app.use(router.routes()).use(router.allowedMethods()).listen(3001);
