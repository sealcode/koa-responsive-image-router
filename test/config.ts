import * as path from "path";

const projectRoot: string = process.cwd();

import _locreq from "locreq";
const locreq = _locreq(__dirname);

export const paths = {
	tmpImages: "/tmp/images",
	storageImages: locreq.resolve("image-cache"),
	staticImages: "/static/images",
	inputDir: path.join(projectRoot, "example"),
	exampleImg: path.join(projectRoot, "example", "image.png"),
	exampleSmartCropImg: path.join(projectRoot, "example", "image.png"),
};

export const imageRouterConfig = {
	thumbnailsSize: 10,
	maxCacheSize: 10000,
	cacheManagerResolutionThreshold: 25,
};
