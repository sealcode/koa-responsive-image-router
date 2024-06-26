import { pickPort } from "pick-port";
import assert from "node:assert";
import fs from "fs";
import Koa from "koa";
import Router from "@koa/router";
import { KoaResponsiveImageRouter } from "..";
import _locreq from "locreq";
import sharp from "sharp";
const locreq = _locreq(__dirname);

describe("image serving", () => {
	it("Serves the correct image format when cropping", async () => {
		const port = await pickPort({ type: "tcp" });
		const app = new Koa();
		const router = new Router();

		const imageRouter = new KoaResponsiveImageRouter({
			staticPath: "/images",
			thumbnailSize: 20,
			smartCropStoragePath: `/tmp/${Date.now()}`,
			imageStoragePath: `/tmp/${Date.now()}`,
			cacheManagerResolutionThreshold: 30,
		});

		await imageRouter.start();
		router.use("/images", imageRouter.getRoutes());
		const server = app
			.use(router.routes())
			.use(router.allowedMethods())
			.listen(port);

		const image_html = await imageRouter.image(
			locreq.resolve("example/image.png"),
			{
				sizesAttr: "500px",
				resolutions: [100],
				alt: "",
				crop: { width: 100, height: 100 },
			}
		);
		const image_id = image_html
			.match(/srcset="\/images\/.*\/.*.100.webp 100w/)?.[0]
			.split("/")[2];
		const image_url = `http://localhost:${port}/images/${image_id}/image.100.webp`;
		const result = await fetch(image_url);
		fs.writeFileSync("/tmp/image", Buffer.from(await result.arrayBuffer()));
		const metadata = await sharp("/tmp/image").metadata();
		assert.strictEqual(metadata?.format, "webp");
		server.close();
	});
});
