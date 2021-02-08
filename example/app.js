import Koa from "koa";
import Router from "koa-router";
import fs from "fs";
import { fileURLToPath } from "url";
import path, { dirname } from "path";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = new Koa();
const router = new Router();

const tmp_dir = "/tmp/image-cache";

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

router.get("/images/:filename/:size/:type", async (ctx, next) => {
    // let image = await getImage(ctx.params);
    // if (image === false) {
    //     image = await generateImage(ctx.params);
    // }

    ctx.body = await getImage(ctx.params);
    ctx.type = `image/${ctx.params.type}`;
});

async function getImage({ filename, size, type }) {
    console.log(filename, size, type);
    try {
        const file = fs.readFileSync(
            `${__dirname}/tmp/image-cache/${filename}-${size}.${type}`
        );
        return Buffer.from(file, "base64");
    } catch (error) {
        console.log("error", error);
        const buffer = await generateImage({ filename, size, type });
        saveImage({ filename, size, type, buffer });
        return buffer;
    }
}

function saveImage({ filename, size, type, buffer }) {
    sharp(buffer).toFile(
        `${__dirname}/tmp/image-cache/${filename}-${size}.${type}`
    );
}

async function generateImage({ filename, type, size }) {
    console.log("generating image");

    fs.closeSync(
        fs.openSync(
            `${__dirname}/tmp/image-cache/${filename}-${size}.${type}`,
            "w"
        )
    );
    const pixelArray = await sharp(
        `${__dirname}/tmp/image-cache/${filename}.${type}`
    )
        .resize(parseInt(size))
        .toFormat(type)
        .toBuffer();
    return pixelArray;
}

app.use(router.routes()).use(router.allowedMethods()).listen(3000);
