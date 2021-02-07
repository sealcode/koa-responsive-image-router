import Koa from "koa";
import Router from "koa-router";
import fs from "fs";
import { fileURLToPath } from "url";
import path, { dirname } from "path";

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
	
	let image = await getImage(ctx.params);
    if (image === false) {
        image = await generateImage(ctx.params);
    }
    ctx.body = image;
    ctx.type = `image/${ctx.params.type}`;
});

async function getImage({ filename, size, type }) {
    console.log(filename, size, type);
    try {
        const file = fs.readFileSync(
            `${__dirname}/${filename}-${size}.${type}`
        );
        return Buffer.from(file, "base64");
    } catch (error) {
        console.log("error", error);
        return false;
    }
}

async function generateImage({ filename, type, size }) {
    console.log("tbc");
    return `<p>test</p>`;
}

app.use(router.routes()).use(router.allowedMethods()).listen(3000);
