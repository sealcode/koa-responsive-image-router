import assert from "assert";
import { KoaResponsiveImageRouter } from "..";
import { JSDOM } from "jsdom";
import { imageRouterConfig, paths } from "../../test/config";
import _locreq from "locreq";
const locreq = _locreq(__dirname);

// const imageRouter = new KoaResponsiveImageRouter(
// 	"/static/images",
// 	"/tmp/images",
// 	7
// );

const imageRouter = new KoaResponsiveImageRouter({
	staticPath: paths.staticImages,
	thumbnailSize: imageRouterConfig.thumbnailsSize,
	smartCropStoragePath: paths.smartcropCache,
	imageStoragePath: paths.storageImages,
	cacheManagerResolutionThreshold:
		imageRouterConfig.cacheManagerResolutionThreshold,
});

describe("Resolutions parser", function () {
	const input_dir_path = locreq.resolve("example");

	const example_img_path = `${input_dir_path}/image.png`;

	it("Contains only resolutions smaller or equal to those in resolutions", async function () {
		const expectedResolutions = [
			10, 600, 1000, 2000, 3000, 4000, 5000, 5500, 5820,
		];

		const html = await imageRouter.image(example_img_path, {
			resolutions: [
				600, 1000, 2000, 3000, 4000, 5000, 5500, 5820, 5821, 6000, 6500,
				8000,
			],
			sizesAttr: "(max-width: 600) 100vw, 600px",
			lazy: false,
			imgStyle: "width: 600px; height: auto",
		});

		const dom = new JSDOM(html);
		const document = dom.window.document;

		const sources = document.querySelectorAll("picture source");

		sources.forEach((source) => {
			const srcset = source.getAttribute("srcset");
			const sizes = source.getAttribute("sizes");

			if (!srcset || !sizes) {
				throw new Error("Missing srcset or sizes attribute.");
			}
			const srcsetItems = srcset
				.split(",")
				.map((item) => item.trim().split(" "));

			srcsetItems.forEach((item) => {
				const width = parseInt(item[1].replace("w", ""), 10);
				if (!expectedResolutions.includes(width)) {
					assert.fail(
						`Unexpected resolution ${width} found in HTML.`
					);
				}
			});
		});

		const img = document.querySelector("picture img");

		if (!img) {
			throw new Error("Missing img element.");
		}
		const widthAttribute = img.getAttribute("width");
		const imgWidth = widthAttribute ? parseInt(widthAttribute, 10) : 0;
		const maxResolution = Math.max(...expectedResolutions);
		assert(
			imgWidth <= maxResolution,
			`The width of <img> (${imgWidth}) is greater than the highest resolution in resolutions (${maxResolution}).`
		);
	});
});
