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

function generateNavbar(currentPage: string): string {
	const navLinks = [
		{ text: "Sizes Example", path: "/", isActive: currentPage === "sizes" },
		{
			text: "Ratios Example",
			path: "/ratios",
			isActive: currentPage === "ratios",
		},
		{
			text: "Queue Test",
			path: "/queue",
			isActive: currentPage === "queue",
		},
		{
			text: "Object-fit-sizing example",
			path: "/object-fit-sizing",
			isActive: currentPage === "object-fit-sizing",
		},
		{
			text: "Smartcrop example",
			path: "/smartcrop",
			isActive: currentPage === "smartcrop",
		},
	];

	let navbarHTML = "<nav><ul>";

	navLinks.forEach((link) => {
		if (!link.isActive) {
			navbarHTML += `<li><a href="${link.path}">${link.text}</a></li>`;
		}
	});

	navbarHTML += "</ul></nav>";

	return navbarHTML;
}

router.get("/", async (ctx) => {
	const currentPage = "sizes";
	const navbarHTML = generateNavbar(currentPage);
	ctx.body = `
	${navbarHTML}
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
	const currentPage = "ratios";
	const navbarHTML = generateNavbar(currentPage);
	ctx.body = `
	${navbarHTML}
		${await getImages()}
	`;
});

router.get("/smartcrop", async (ctx) => {
	const currentPage = "smartcrop";
	const navbarHTML = generateNavbar(currentPage);
	ctx.body = `
	${navbarHTML}
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
	const currentPage = "queue";
	const navbarHTML = generateNavbar(currentPage);

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
	${navbarHTML}
	   ${imagesHtml}
	`;
});

router.get("/object-fit-sizing", async (ctx) => {
	const currentPage = "object-fit-sizing";
	const navbarHTML = generateNavbar(currentPage);
	let object_width = 500;
	const resolutions: number[] = [];

	for (let step = 1; step <= 100; step++) {
		resolutions.push(object_width * (step * 0.1));
	}

	ctx.body = `
	${navbarHTML}

	<h2>Default Image (Cover)</h2>
	${await imageRouter.image({
		resolutions: resolutions,
		sizes_attr: `${object_width}px`,
		path: paths.exampleImg,
		lazy: false,
		img_style: "width: 500px; height: auto",
	})}

	<h2>Container with 'cover' Object Fit</h2>
	${await imageRouter.image({
		resolutions: resolutions,
		path: paths.exampleImg,
		lazy: false,
		img_style: "width: 500px; height: 500px;",
		container: {
			object_fit: "cover",
			width: object_width,
			height: object_width,
		},
	})}

	<h2>Container with 'contain' Object Fit</h2>
	${await imageRouter.image({
		resolutions: resolutions,
		path: paths.exampleImg,
		lazy: false,
		img_style: "width: 500px; height: 500px;",
		container: {
			object_fit: "contain",
			width: object_width,
			height: object_width,
		},
	})}

	`;
});

router.use("/static/images", imageRouter.getRoutes());
app.use(router.routes()).use(router.allowedMethods()).listen(3005);
console.log("Demo running on http://localhost:3005");
