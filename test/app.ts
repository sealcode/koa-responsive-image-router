import Koa from "koa";
import Router from "@koa/router";
import KoaResponsiveImageRouter from "../src/index";
import { paths } from "./config";

const app = new Koa();
const router = new Router();

const imageRouter = new KoaResponsiveImageRouter(
	paths.staticImages,
	paths.tmpImages,
	20
);

router.get("/", async (ctx) => {
	ctx.body = `<p><b>sizes example</b> <a href="/ratios">go to ratios</a> </p>
	<p><b>smarctop example</b> <a href="/smartcrop">go to smartcrop</a> </p>
	<p><b>queue test</b> <a href="/queue">go to queue</a> </p>
	${await imageRouter.image({
		sizes_attr: `
					(min-width: 600px) 80vw,
					(min-width: 400px) 90vw,
					100vw`,
		path: paths.exampleImg,
	})} ${await imageRouter.image({
		sizes_attr: `
					(max-width: 300px) 100vw,
					(max-width: 600px) 80vw,
					(max-width: 900px) 50vw,
					900px`,
		path: paths.exampleImg,
	})}${await imageRouter.image({
		resolutions: [100, 500, 1000, 1500],
		sizes_attr: "(max-width: 900px) 100vw, 900px",
		path: paths.exampleImg,
	})} ${await imageRouter.image({
		resolutions: [2000, 3000, 1000, 6000],
		sizes_attr: "(max-width: 900px) 100vw, 900px",
		path: paths.exampleImg,
	})}`;
});

const ratios_path = `${paths.inputDir}/ratios`,
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
		<p><b>smarctop example</b> <a href="/smartcrop">go to smartcrop</a> </p>
		<p><b>queue test</b> <a href="/queue">go to queue</a> </p>
		${await getImages()}
	`;
});

router.get("/smartcrop", async (ctx) => {
	ctx.body = `
	<p><b>sizes example</b> <a href="/ratios">go to ratios</a> </p>
	<p><b>ratios example</b> <a href="/">go to sizes</a> </p>
	<p><b>queue test</b> <a href="/queue">go to queue</a> </p>
	${await imageRouter.image({
		resolutions: [600, 1000, 1500, 2000],
		sizes_attr: "(max-width: 600) 100vw, 600px",
		path: paths.exampleSmartCropImg,
		lazy: false,
		img_style: "width: 600px; height: auto",
		crop: { width: 600, height: 600 },
	})}

	${await imageRouter.image({
		resolutions: [600, 1000, 1500, 2000],
		sizes_attr: "(max-width: 600) 100vw, 605px",
		path: paths.exampleSmartCropImg,
		lazy: false,
		img_style: "width: 600px; height: auto",
		crop: { width: 200, height: 200 },
	})}

	${await imageRouter.image({
		resolutions: [600, 1000, 1500, 2000],
		sizes_attr: "(max-width: 600) 100vw, 602px",
		path: paths.exampleSmartCropImg,
		lazy: false,
		img_style: "width: 600px; height: auto",
		crop: { width: 300, height: 300 },
	})}

	${await imageRouter.image({
		resolutions: [600, 1000, 1500, 2000],
		sizes_attr: "(max-width: 600px) 100vw, 600px",
		path: paths.exampleSmartCropImg,
		lazy: false,
		img_style: "width: 600px; height: auto",
		crop: { width: 2592, height: 3456, x: 2592, y: 0 },
	})}

	${await imageRouter.image({
		resolutions: [600, 1000, 1500, 2000],
		sizes_attr: "(max-width: 600) 100vw, 600px",
		path: paths.exampleSmartCropImg,
		lazy: false,
		img_style: "width: 600px; height: auto",
	})}
	`;
});

router.use(paths.staticImages, imageRouter.getRoutes());
router.get("/queue", async (ctx) => {
	let imagesHtml = "";

	const imageOptions = {
		resolutions: [600, 1000, 1500, 2000],
		sizes_attr: "(max-width: 3000) 100vw, 3000px",
		path: paths.exampleImg,
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

	ctx.body = `
	<p><b>sizes example</b> <a href="/ratios">go to ratios</a> </p>
	<p><b>ratios example</b> <a href="/">go to sizes</a> </p>
	<p><b>smarctop example</b> <a href="/smartcrop">go to smartcrop</a> </p>
	   ${imagesHtml}
	`;
});

router.use("/static/images", imageRouter.getRoutes());
app.use(router.routes()).use(router.allowedMethods()).listen(3005);
