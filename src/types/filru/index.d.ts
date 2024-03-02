/// <reference types="node" />

declare module "filru" {
	export default class Filru {
		constructor(config: {
			dir: string;
			maxBytes: number;
			loadFunc?: (key: string) => Promise<Buffer>;
			maxAge?: number;
			hashSeed?: number | string;
			pruneInterval?: number;
		});

		start(): Promise<void>;
		stop(): void;
		get(key: string): Promise<Buffer>;
		set(key: string, contents: Buffer): Promise<Buffer>;
		touch(key: string): void;
		del(key: string): Promise<string>;
		clear(): Promise<void>;
		run(): Promise<void>;
	}

	// export = Filru;
}
