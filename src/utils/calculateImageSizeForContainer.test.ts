import KoaResponsiveImageRouter from "..";
import assert from "assert";

describe.only("calculateImageSizeForContainer", () => {
	const imageRouter = new KoaResponsiveImageRouter(
		"/static/images",
		"/tmp/images"
	);

	it('should return the correct size for "cover" object fit (landscape container)', () => {
		const imageWidth = 800;
		const imageHeight = 600;
		const containerWidth = 300;
		const containerHeight = 150;
		const objectFit = "cover";

		const result = imageRouter.calculateImageSizeForContainer(
			imageWidth,
			imageHeight,
			containerWidth,
			containerHeight,
			objectFit
		);

		assert.deepStrictEqual(result, {
			width: 300,
			height: 225,
		});
	});

	it('should return the correct size for "cover" object fit (portrait container)', () => {
		const imageWidth = 600;
		const imageHeight = 800;
		const containerWidth = 150;
		const containerHeight = 300;
		const objectFit = "cover";

		const result = imageRouter.calculateImageSizeForContainer(
			imageWidth,
			imageHeight,
			containerWidth,
			containerHeight,
			objectFit
		);

		assert.deepStrictEqual(result, {
			width: 225,
			height: 300,
		});
	});

	it('should return the correct size for "contain" object fit (landscape container)', () => {
		const imageWidth = 800;
		const imageHeight = 600;
		const containerWidth = 300;
		const containerHeight = 150;
		const objectFit = "contain";

		const result = imageRouter.calculateImageSizeForContainer(
			imageWidth,
			imageHeight,
			containerWidth,
			containerHeight,
			objectFit
		);

		assert.deepStrictEqual(result, {
			width: 200,
			height: 150,
		});
	});

	it('should return the correct size for "contain" object fit (portrait container)', () => {
		const imageWidth = 600;
		const imageHeight = 800;
		const containerWidth = 150;
		const containerHeight = 300;
		const objectFit = "contain";

		const result = imageRouter.calculateImageSizeForContainer(
			imageWidth,
			imageHeight,
			containerWidth,
			containerHeight,
			objectFit
		);

		assert.deepStrictEqual(result, {
			width: 150,
			height: 200,
		});
	});

	it('should return the correct size for "cover" object fit (square container)', () => {
		const imageWidth = 600;
		const imageHeight = 600;
		const containerWidth = 400;
		const containerHeight = 400;
		const objectFit = "cover";

		const result = imageRouter.calculateImageSizeForContainer(
			imageWidth,
			imageHeight,
			containerWidth,
			containerHeight,
			objectFit
		);

		assert.deepStrictEqual(result, {
			width: 400,
			height: 400,
		});
	});

	it('should return the correct size for "contain" object fit (square container)', () => {
		const imageWidth = 600;
		const imageHeight = 600;
		const containerWidth = 400;
		const containerHeight = 400;
		const objectFit = "contain";

		const result = imageRouter.calculateImageSizeForContainer(
			imageWidth,
			imageHeight,
			containerWidth,
			containerHeight,
			objectFit
		);

		assert.deepStrictEqual(result, {
			width: 400,
			height: 400,
		});
	});

	it("should return 0 width and 0 height for negative container dimensions", () => {
		const imageWidth = 800;
		const imageHeight = 600;
		const containerWidth = -100;
		const containerHeight = -200;
		const objectFit = "cover";

		const result = imageRouter.calculateImageSizeForContainer(
			imageWidth,
			imageHeight,
			containerWidth,
			containerHeight,
			objectFit
		);

		assert.deepStrictEqual(result, {
			width: 0,
			height: 0,
		});
	});

	it("should return 0 width and 0 height for negative container dimensions", () => {
		const imageWidth = 600;
		const imageHeight = 800;
		const containerWidth = -200;
		const containerHeight = -100;
		const objectFit = "contain";

		const result = imageRouter.calculateImageSizeForContainer(
			imageWidth,
			imageHeight,
			containerWidth,
			containerHeight,
			objectFit
		);

		assert.deepStrictEqual(result, {
			width: 0,
			height: 0,
		});
	});

	it("should return 0 width and 0 height when container dimensions are zero", () => {
		const imageWidth = 800;
		const imageHeight = 600;
		const containerWidth = 0;
		const containerHeight = 0;
		const objectFit = "cover";

		const result = imageRouter.calculateImageSizeForContainer(
			imageWidth,
			imageHeight,
			containerWidth,
			containerHeight,
			objectFit
		);

		assert.deepStrictEqual(result, {
			width: 0,
			height: 0,
		});
	});

	it("should return 0 width and 0 height when container dimensions are zero", () => {
		const imageWidth = 600;
		const imageHeight = 800;
		const containerWidth = 0;
		const containerHeight = 0;
		const objectFit = "contain";

		const result = imageRouter.calculateImageSizeForContainer(
			imageWidth,
			imageHeight,
			containerWidth,
			containerHeight,
			objectFit
		);

		assert.deepStrictEqual(result, {
			width: 0,
			height: 0,
		});
	});
});
