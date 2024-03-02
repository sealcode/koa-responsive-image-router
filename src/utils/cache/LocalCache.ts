import Filru from "filru";
import { FilruParameters } from "../../types/cacheManager";
import getProxiedFilru from "../proxiedFilru";
import _locreq from "locreq";
export const locreq = _locreq(__dirname);

export class LocalCache {
	private storagePath = locreq.resolve("");
	private diskCacheSize = 50 * 1024 * 1024; // 50 megabytes
	private maxAge = Infinity;
	private hashSeed = ""; // optional, random seed string
	private pruneInterval = 180000; // optional, defaults to  3 minutes
	protected cache: Filru;

	constructor(params: FilruParameters) {
		if (params.diskCacheSize && params.diskCacheSize > 0) {
			this.diskCacheSize = params.diskCacheSize * 1024 * 1024;
		}

		if (params.pruneInterval && params.pruneInterval > 0) {
			this.pruneInterval = params.pruneInterval;
		}

		if (params.maxAge && params.maxAge > 0) {
			this.maxAge = params.maxAge * 1000;
		}

		if (params.storagePath && params.storagePath !== "") {
			this.storagePath = params.storagePath;
		}

		if (params.hashSeed && params.hashSeed !== "") {
			this.hashSeed = params.hashSeed;
		}

		this.cache = getProxiedFilru(
			this.storagePath,
			this.diskCacheSize,
			this.maxAge,
			this.hashSeed,
			this.pruneInterval
		);
	}

	public async start(): Promise<void> {
		await this.cache.start();
	}

	public stop(): void {
		this.cache.stop();
	}
}
