import sharp from "sharp";
import { ImageData } from "../types/imageRouter";

export const ImageInfoTool = new (class {
	hashToImageData: Record<string, ImageData> = {};
	pathToMetadata: Record<string, Promise<sharp.Metadata> | undefined> = {};

	public getImageData(hash: string): ImageData {
		if (this.hashToImageData[hash]) {
			return this.hashToImageData[hash];
		}
		this.initImageData(hash);
		return this.hashToImageData[hash];
	}

	public initImageData(hash: string) {
		this.hashToImageData[hash] = {
			resolutions: [],
			lossless: false,
			originalPath: "",
			targetRatio: 0,
			ratioDiffThreshold: 0,
			container: {
				width: 0,
				height: 0,
			},
			crop: false,
			thumbnailSize: 0,
		};
	}

	public consoleLogError(hash: string) {
		console.error(`Hash ${hash} not found in hashToImageData.`);
	}

	public updateProperty<K extends keyof ImageData>(
		hash: string,
		propertyName: K,
		param: ImageData[K]
	) {
		if (!this.hashToImageData[hash]) {
			this.consoleLogError(hash);
			return;
		}
		this.hashToImageData[hash][propertyName] = param;
	}

	public async getMetadata(path: string): Promise<sharp.Metadata> {
		const value = this.pathToMetadata[path];
		if (value) {
			return value;
		} else {
			const metadata: Promise<sharp.Metadata> = sharp(path).metadata();
			this.pathToMetadata[path] = metadata;
			return metadata;
		}
	}
})();
