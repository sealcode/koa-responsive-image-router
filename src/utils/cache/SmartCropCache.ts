import { hasShape } from "@sealcode/ts-predicates";
import {
	CropResult,
	FilruParameters,
	JsonCropResultShape,
} from "../../types/cacheManager";
import { LocalCache } from "./LocalCache";

export class SmartcropCache extends LocalCache {
	public async get(key: string): Promise<CropResult | null> {
		const buffer = await this.cache.get(key);
		if (buffer) {
			try {
				const jsonString = buffer.toString();
				const cropResult: unknown = JSON.parse(jsonString);
				if (hasShape(JsonCropResultShape, cropResult)) {
					return Promise.resolve(cropResult);
				} else {
					console.error("Incorrect Json Shape");
					return null;
				}
			} catch (error) {
				console.error("Error parsing buffer:", error);
				return null;
			}
		}
		return null;
	}

	public async set(key: string, buffer: Buffer): Promise<void> {
		await this.cache.set(key, buffer);
	}
}
