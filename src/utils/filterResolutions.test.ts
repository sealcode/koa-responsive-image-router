import assert from "assert";
import KoaResponsiveImageRouter from "..";
import { JSDOM } from "jsdom";

const imageRouter = new KoaResponsiveImageRouter(
	"/static/images",
	"/tmp/images",
	7
);

describe("Resolutions parser", function () {
	const input_dir_path = `${__dirname}/../example`;

	const example_img_path = `${input_dir_path}/image.png`;

	it("Contains only resolutions smaller or equal to those in resolutions", async function () {
		const expectedResolutions = [
			600, 1000, 2000, 3000, 4000, 5000, 5500, 5820,
		];

		const html = await imageRouter.image({
			resolutions: [
				600, 1000, 2000, 3000, 4000, 5000, 5500, 5820, 5821, 6000, 6500,
				8000,
			],
			sizes_attr: "(max-width: 600) 100vw, 600px",
			path: example_img_path,
			lazy: false,
			img_style: "width: 600px; height: auto",
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
