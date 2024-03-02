import { FilruParameters } from "../../types/cacheManager";
import { LocalCache } from "./LocalCache";
import _locreq from "locreq";
export const locreq = _locreq(__dirname);

export class DiskImageCache extends LocalCache {
	constructor(params: FilruParameters) {
		if (params.storagePath && params.storagePath !== "") {
			super(params);
		} else {
			params.storagePath = locreq.resolve("image-cache");
			super(params);
		}
	}

	public get(key: string): Promise<Buffer> | null {
		return this.cache.get(key);
	}

	public async set(key: string, buffer: Buffer): Promise<void> {
		await this.cache.set(key, buffer);
	}
}
