import { guessResolutions } from "./guessResolutions";
import assert from "assert";

describe("resolutions guessing", function () {
	it("handles a simple vw case", function () {
		assert.deepStrictEqual(guessResolutions("100vw"), [
			320,
			640,
			1280,
			1920,
			2560,
			3840,
		]);
	});

	it("handles vw case with min-width conditions", function () {
		assert.deepStrictEqual(
			guessResolutions(
				`(min-width: 600px) 80vw,
				(min-width: 400px) 90vw,
				100vw`
			),
			[320, 360, 480, 640, 1280, 1536, 1728, 2560, 3456]
		);
	});

	it("handles vw/px case with min-width conditions + px default", function () {
		assert.deepStrictEqual(
			guessResolutions(
				`(min-width: 1000px) 50vw,
				(min-width: 800px) 800px,
				600px`
			),
			[500, 600, 800, 960, 1000, 1920]
		);
	});

	it("handles complex vw case with max-width conditions + px default", function () {
		assert.deepStrictEqual(
			guessResolutions(
				`(max-width: 300px) 100vw,
				(max-width: 600px) 80vw,
				(max-width: 1200px) 50vw, 
				900px`
			),
			[320, 480, 600, 640, 900, 1280, 1800]
		);
	});

	it("handles max-width condition with vw value and vw default", function () {
		assert.deepStrictEqual(
			guessResolutions(
				`(max-width: 300px) 100vw,
				50vw`
			),
			[320, 640, 960, 1280, 1920]
		);
	});

	it("handles vw case with defined min/max resolutions", function () {
		assert.deepStrictEqual(
			guessResolutions(`100vw`, {
				min_resolution: 144,
				max_resolution: 1600,
			}),
			[144, 288, 576, 1152, 1600, 2304, 3200]
		);
	});
});
