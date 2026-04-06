// Ambient type declarations for SvelteKit server code.

declare namespace Deno {
	const env: {
		get(key: string): string | undefined;
		set(key: string, value: string): void;
	};

	function openKv(path?: string): Promise<Kv>;

	interface Kv {
		get<T = unknown>(key: KvKey): Promise<KvEntryMaybe<T>>;
		getMany<T extends readonly unknown[]>(
			keys: readonly [...{ [K in keyof T]: KvKey }],
		): Promise<{ [K in keyof T]: KvEntryMaybe<T[K]> }>;
		set(key: KvKey, value: unknown, options?: { expireIn?: number }): Promise<KvCommitResult>;
		delete(key: KvKey): Promise<void>;
		list<T = unknown>(selector: KvListSelector, options?: KvListOptions): KvListIterator<T>;
		atomic(): AtomicOperation;
		close(): void;
	}

	type KvKey = readonly KvKeyPart[];
	type KvKeyPart = string | number | bigint | boolean | Uint8Array;

	interface KvEntryMaybe<T> {
		key: KvKey;
		value: T | null;
		versionstamp: string | null;
	}

	interface KvCommitResult {
		ok: boolean;
		versionstamp: string;
	}

	interface AtomicOperation {
		check(...checks: KvEntryMaybe<unknown>[]): this;
		set(key: KvKey, value: unknown, options?: { expireIn?: number }): this;
		delete(key: KvKey): this;
		commit(): Promise<KvCommitResult | { ok: false }>;
	}

	interface KvListSelector {
		prefix?: KvKey;
		start?: KvKey;
		end?: KvKey;
	}

	interface KvListOptions {
		limit?: number;
		cursor?: string;
		reverse?: boolean;
	}

	interface KvListIterator<T> extends AsyncIterableIterator<KvEntry<T>> {
		cursor: string;
	}

	interface KvEntry<T> {
		key: KvKey;
		value: T;
		versionstamp: string;
	}
}
