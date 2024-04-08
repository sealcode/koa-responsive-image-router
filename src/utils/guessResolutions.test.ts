import { guessResolutions } from "./guessResolutions";
import assert from "assert";

describe("resolutions guessing", function () {
	it("handles a simple vw case", function () {
		assert.deepStrictEqual(
			guessResolutions("100vw"),
			[320, 640, 1280, 1920, 2560, 3840]
		);
	});

	it("handles vw case with min-width conditions", function () {
		assert.deepStrictEqual(
			guessResolutions(
				`(min-width: 600px) 80vw,
				(min-width: 400px) 90vw,
				100vw`
			),
			[
				320, 360, 399, 480, 539, 640, 720, 798, 960, 1078, 1280, 1536,
				2560, 3072,
			]
		);
	});

	it("handles vw/px case with min-width conditions + px default", function () {
		assert.deepStrictEqual(
			guessResolutions(
				`(min-width: 1000px) 50vw,
				(min-width: 800px) 800px,
				600px`
			),
			[500, 600, 800, 960, 1000, 1200, 1600, 1920]
		);
	});

	it("handles complex vw case with max-width conditions + px default", function () {
		assert.deepStrictEqual(
			guessResolutions(
				`
				(max-width: 600px) 100vw,
				(max-width: 1200px) 80vw,
				(max-width: 2000px) 50vw,
				900px`
			),
			[
				320, 480, 599, 600, 640, 900, 959, 960, 999, 1198, 1200, 1280,
				1800, 1918, 1998,
			]
		);
	});

	it("handles max-width condition with vw value and vw default", function () {
		assert.deepStrictEqual(
			guessResolutions(
				`(max-width: 400px) 100vw,
				50vw`
			),
			[320, 399, 400, 640, 798, 960, 1280, 1920]
		);
	});

	it("handles vw case with defined min/max resolutions", function () {
		assert.deepStrictEqual(
			guessResolutions(`100vw`, {
				min_viewport_size: 144,
				max_viewport_size: 1600,
			}),
			[144, 288, 576, 1152, 1600, 2304, 3200]
		);
	});

	it("doesn't return values larger than the image size, if provided", function () {
		assert.deepStrictEqual(
			guessResolutions(
				`100vw`,
				{
					min_viewport_size: 320,
					max_viewport_size: 1280,
				},
				undefined,
				{
					width: 640,
					height: 900,
				}
			),
			[320, 640]
		);
	});

	it("keeps the original image resolution if cutting out resolutions larger than it and leaving only smaller ones", function () {
		assert.deepStrictEqual(
			guessResolutions(
				"100vw",
				{ min_viewport_size: 320, max_viewport_size: 1920 },
				undefined,
				{
					width: 1200,
					height: 900,
				}
			),
			[320, 640, 1200]
		);
	});
});
