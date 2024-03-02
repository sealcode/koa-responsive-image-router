import Filru from "filru";
/**
 * Returns a proxied instance of Filru with error handling for the "get" method.
 * The original Filru throws an error when a requested key is not found,
 * and this proxy ensures that the "get" method returns null instead of propagating the error.
 * @param dir - The directory path for Filru.
 * @param maxBytes - The maximum size of the cache in bytes.
 * @param maxAge - The maximum age of an item in milliseconds.
 * @param hashSeed - The seed used for hashing keys.
 * @param pruneInterval - The interval at which to prune expired items.
 * @returns Proxied Filru instance with error-handled "get" method.
 */
function getProxiedFilru(
	dir: string,
	maxBytes: number,
	maxAge: number,
	hashSeed: string,
	pruneInterval: number
): Filru {
	const filru = new Filru({ dir, maxBytes, maxAge, hashSeed, pruneInterval });
	const handler = {
		get(target: Filru, prop: string): unknown {
			if (prop === "get") {
				return async (hash: string): Promise<Buffer | null> => {
					try {
						return await target.get(hash);
					} catch (error: unknown) {
						if (
							error instanceof Error &&
							error.message.includes(
								"ENOENT: no such file or directory, open"
							)
						) {
							return null;
						} else {
							throw error;
						}
					}
				};
			}
			return Reflect.get(target, prop);
		},
	};
	return new Proxy<Filru>(filru, handler);
}

export default getProxiedFilru;
