import Koa from "koa";
import Router from "@koa/router";
import KoaResponsiveImageRouter from "../src/index";

const app = new Koa();
const router = new Router();

const imageRouter = new KoaResponsiveImageRouter("/static/images", 20);

const input_dir_path = `${__dirname}/../example`;

const example_img_path = `${input_dir_path}/image.png`;

router.get("/", async (ctx) => {
	ctx.body = `<p><b>sizes example</b> <a href="/ratios">go to ratios</a> </p>
	<p><b>queue test</b> <a href="/queue">go to queue</a> </p>

	${await imageRouter.image({
		sizes_attr: `
					(min-width: 600px) 80vw,
					(min-width: 400px) 90vw,
					100vw`,
		path: example_img_path,
	})} ${await imageRouter.image({
		sizes_attr: `
					(max-width: 300px) 100vw,
					(max-width: 600px) 80vw,
					(max-width: 900px) 50vw,
					900px`,
		path: example_img_path,
	})}${await imageRouter.image({
		resolutions: [100, 500, 1000, 1500],
		sizes_attr: "(max-width: 900px) 100vw, 900px",
		path: example_img_path,
	})} ${await imageRouter.image({
		resolutions: [2000, 3000, 1000, 6000],
		sizes_attr: "(max-width: 900px) 100vw, 900px",
		path: example_img_path,
	})}`;
});

const ratios_path = `${input_dir_path}/ratios`,
	ratio_images_count = 5;

const getImages = async () => {
	let images = "";

	for (let i = 1; i <= ratio_images_count; i++) {
		const path = `${ratios_path}/${i}.jpg`;

		images += await imageRouter.image({
			sizes_attr: `50vw`,
			path,
		});
	}

	return images;
};

router.get("/ratios", async (ctx) => {
	ctx.body = `
		<p><b>ratios example</b> <a href="/">go to sizes</a> </p>
		<p><b>queue test</b> <a href="/queue">go to queue</a> </p>

		${await getImages()}
	`;
});

router.get("/queue", async (ctx) => {
	let imagesHtml = "";

	const imageOptions = {
		resolutions: [600, 1000, 1500, 2000],
		sizes_attr: "(max-width: 3000) 100vw, 3000px",
		path: example_img_path,
		lazy: false,
		img_style: "width: 50px; height: auto",
		alt: "image",
	};

	for (let i = 0; i < 1000; i++) {
		imagesHtml += await imageRouter.image({
			...imageOptions,
			sizes_attr: 2000 + i + "w",
			resolutions: [2000 + i],
		});
	}

	ctx.body = `<p><b>sizes example</b> <a href="/ratios">go to ratios</a> </p>
	<p><b>ratios example</b> <a href="/">go to sizes</a> </p>
	   ${imagesHtml}
	`;
});

router.use("/static/images", imageRouter.getRoutes());
app.use(router.routes()).use(router.allowedMethods()).listen(3005);
