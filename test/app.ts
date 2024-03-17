import Koa from "koa";
import Router from "@koa/router";
import { KoaResponsiveImageRouter } from "../src/index";
import { paths, imageRouterConfig } from "./config";

const app = new Koa();
const router = new Router();

const imageRouter = new KoaResponsiveImageRouter({
	staticPath: paths.staticImages,
	thumbnailSize: imageRouterConfig.thumbnailsSize,
	cacheManagerResolutionThreshold:
		imageRouterConfig.cacheManagerResolutionThreshold,
});

async function startApp(): Promise<void> {
	await imageRouter.start();

	function generateNavbar(currentPage: string): string {
		const navLinks = [
			{
				text: "Sizes Example",
				path: "/",
				isActive: currentPage === "sizes",
			},
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
			{
				text: "Resolution filter example",
				path: "/res-filter",
				isActive: currentPage === "res-filter",
			},
			{
				text: "Thumbnails example",
				path: "/thumbnails",
				isActive: currentPage === "thumbnails",
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
	${await imageRouter.image(paths.exampleImg, {
		sizesAttr: `
					(min-width: 600px) 80vw,
					(min-width: 400px) 90vw,
					100vw`,
		thumbnailSize: 100,
	})} ${await imageRouter.image(paths.exampleImg, {
			sizesAttr: `
					(max-width: 300px) 100vw,
					(max-width: 600px) 80vw,
					(max-width: 900px) 50vw,
					900px`,
		})}${await imageRouter.image(paths.exampleImg, {
			resolutions: [100, 500, 1000, 1500],
			sizesAttr: "(max-width: 900px) 100vw, 900px",
		})} ${await imageRouter.image(paths.exampleImg, {
			resolutions: [2000, 3000, 1000, 6000],
			sizesAttr: "(max-width: 900px) 100vw, 900px",
		})}`;
	});

	const ratios_path = `${paths.inputDir}/ratios`,
		ratio_images_count = 5;

	const getImages = async () => {
		const promises = [];

		for (let i = 1; i <= ratio_images_count; i++) {
			const path = `${ratios_path}/${i}.jpg`;

			promises.push(
				imageRouter.image(path, {
					sizesAttr: `50vw`,
				})
			);
		}

		const imagesArray = await Promise.all(promises);
		const images = imagesArray.join("");

		return images;
	};

	router.get("/thumbnails", async (ctx) => {
		const currentPage = "thumbnails";
		const navbarHTML = generateNavbar(currentPage);

		ctx.body = `
		${navbarHTML}

		${await imageRouter.image(paths.exampleImg, {
			resolutions: [200, 500, 1000, 1500],
			sizesAttr: "(max-width: 200px) 100vw, 200px",
			lazy: false,
			imgStyle: "width: 200px; height: auto",
			thumbnailSize: 20,
		})}
		${await imageRouter.image(paths.exampleImg, {
			resolutions: [600, 1000, 1500, 2000],
			sizesAttr: "(max-width: 600px) 100vw, 600px",
			lazy: false,
			imgStyle: "width: 600px; height: auto",
			thumbnailSize: 10,
		})}
		${await imageRouter.image(paths.exampleImg, {
			resolutions: [2000, 3000, 1000, 6000],
			sizesAttr: "(max-width: 800px) 100vw, 800px",
			lazy: false,
			imgStyle: "width: 800px; height: auto",
			thumbnailSize: 1,
		})}
	`;
	});

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
		${await imageRouter.image(paths.exampleSmartCropImg, {
			resolutions: [600, 1000, 1500, 2000],
			sizesAttr: "(max-width: 600) 100vw, 600px",
			lazy: false,
			imgStyle: "width: 600px; height: auto",
			crop: { width: 600, height: 600 },
		})}

		${await imageRouter.image(paths.exampleSmartCropImg, {
			resolutions: [600, 1000, 1500, 2000],
			sizesAttr: "(max-width: 600) 100vw, 605px",
			lazy: false,
			imgStyle: "width: 600px; height: auto",
			crop: { width: 200, height: 200 },
		})}

		${await imageRouter.image(paths.exampleSmartCropImg, {
			resolutions: [600, 1000, 1500, 2000],
			sizesAttr: "(max-width: 600) 100vw, 602px",
			lazy: false,
			imgStyle: "width: 600px; height: auto",
			crop: { width: 150, height: 300 },
		})}

		${await imageRouter.image(paths.exampleSmartCropImg, {
			resolutions: [600, 1000, 1500, 2000],
			sizesAttr: "(max-width: 600px) 100vw, 600px",
			lazy: false,
			imgStyle: "width: 600px; height: auto",
			crop: { width: 2592, height: 3456, x: 2592, y: 0 },
		})}

		${await imageRouter.image(paths.exampleSmartCropImg, {
			resolutions: [600, 1000, 1500, 2000],
			sizesAttr: "(max-width: 600) 100vw, 600px",
			lazy: false,
			imgStyle: "width: 600px; height: auto",
		})}
		`;
	});

	router.get("/queue", async (ctx) => {
		const currentPage = "queue";
		const navbarHTML = generateNavbar(currentPage);

		const imageOptions = {
			resolutions: [600, 1000, 1500, 2000],
			sizesAttr: "(max-width: 3000) 100vw, 3000px",

			lazy: false,
			imgStyle: "width: 50px; height: auto",
			alt: "image",
		};

		const promises = [];

		for (let i = 1; i <= 100; i++) {
			promises.push(
				imageRouter.image(paths.exampleImg, {
					...imageOptions,
					sizesAttr: "2000" + (i as unknown as string) + "w",
					resolutions: [2000 + i],
				})
			);
		}

		const imagesArray = await Promise.all(promises);
		const images = imagesArray.join("");

		ctx.body = `
	${navbarHTML}
	   ${images}
	`;
	});

	router.get("/res-filter", async (ctx) => {
		const currentPage = "res-filter";
		const navbarHTML = generateNavbar(currentPage);
		ctx.body = `
	${navbarHTML}w

	<p><b>max-res: 5820</b></p>

	${await imageRouter.image(paths.exampleImg, {
		resolutions: [
			600, 1000, 2000, 3000, 4000, 5000, 5500, 5820, 5821, 6000, 6500,
			8000,
		],
		sizesAttr: "(max-width: 600) 100vw, 600px",
		lazy: false,
		imgStyle: "width: 600px; height: auto",
	})}

	${await imageRouter.image(paths.exampleImg, {
		resolutions: [600, 1000, 5500, 6000, 6500, 8000],
		sizesAttr: "(max-width: 600) 100vw, 600px",
		lazy: false,
		imgStyle: "width: 600px; height: auto",
	})}`;
	});

	router.get("/object-fit-sizing", async (ctx) => {
		const currentPage = "object-fit-sizing";
		const navbarHTML = generateNavbar(currentPage);
		const object_width = 500;
		const resolutions: number[] = [];

		for (let step = 1; step <= 100; step++) {
			resolutions.push(object_width * (step * 0.1));
		}

		ctx.body = `
	${navbarHTML}

	<h2>Default Image (Cover)</h2>
	${await imageRouter.image(paths.exampleImg, {
		resolutions: resolutions,
		sizesAttr: `${object_width}px`,
		lazy: false,
		imgStyle: "width: 500px; height: auto",
	})}

	<h2>Container with 'cover' Object Fit</h2>
	${await imageRouter.image(paths.exampleImg, {
		resolutions: resolutions,
		lazy: false,
		imgStyle: "width: 500px; height: 500px;",
		container: {
			objectFit: "cover",
			width: object_width,
			height: object_width,
		},
	})}

	<h2>Container with 'contain' Object Fit</h2>
	${await imageRouter.image(paths.exampleImg, {
		resolutions: resolutions,
		lazy: false,
		imgStyle: "width: 500px; height: 500px;",
		container: {
			objectFit: "contain",
			width: object_width,
			height: object_width,
		},
	})}

	`;
	});
}

void startApp()
	.catch((error) => {
		console.error("An error occurred:", error);
		throw error;
	})
	.then(() => {
		console.log("APP STARTED");
	});

router.use(paths.staticImages, imageRouter.getRoutes());
app.use(router.routes()).use(router.allowedMethods()).listen(3005);
console.log("Demo running on http://localhost:3005");
