import { LRUCache } from "lru-cache";
import { ThumbnailCacheParams } from "../../types/cacheManager";

export class ThumbnailCache {
	private cache: LRUCache<string, Buffer>;
	private maxCacheSize = 10000;

	constructor(params: ThumbnailCacheParams) {
		if (params.maxCacheSize && params.maxCacheSize > 0)
			[(this.maxCacheSize = params.maxCacheSize)];

		this.cache = new LRUCache<string, Buffer>({
			max: this.maxCacheSize,
		});
	}

	public set(hash: string, imageDataPromise: Buffer): void {
		this.cache.set(hash, imageDataPromise);
	}

	public get(hash: string): Buffer | null {
		const buffer = this.cache.get(hash);
		if (buffer === undefined) {
			return null;
		}
		return buffer;
	}

	public clearCache(): void {
		this.cache.clear();
	}
}
