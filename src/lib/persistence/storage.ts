const WINDOW_NAME_STORAGE_PREFIX = 'np_storage_v1:';

function getStorageScopes(): Storage[] {
	if (typeof window === 'undefined') return [];
	const scopes: Storage[] = [];
	const pushScope = (value: Storage | undefined) => {
		if (!value) return;
		if (scopes.includes(value)) return;
		scopes.push(value);
	};
	try {
		pushScope(window.localStorage);
	} catch {}
	try {
		pushScope(window.parent?.localStorage);
	} catch {}
	try {
		pushScope(window.top?.localStorage);
	} catch {}
	return scopes;
}

function readWindowNameStore(): Record<string, string> {
	if (typeof window === 'undefined') return {};
	const raw = window.name;
	if (!raw.startsWith(WINDOW_NAME_STORAGE_PREFIX)) return {};
	try {
		const parsed = JSON.parse(raw.slice(WINDOW_NAME_STORAGE_PREFIX.length));
		if (!parsed || typeof parsed !== 'object') return {};
		return parsed as Record<string, string>;
	} catch {
		return {};
	}
}

function writeWindowNameStore(store: Record<string, string>) {
	if (typeof window === 'undefined') return;
	try {
		window.name = `${WINDOW_NAME_STORAGE_PREFIX}${JSON.stringify(store)}`;
	} catch {}
}

export function readStoredValue(key: string): string | null {
	for (const scope of getStorageScopes()) {
		try {
			const value = scope.getItem(key);
			if (value !== null) return value;
		} catch {}
	}
	const windowStore = readWindowNameStore();
	if (typeof windowStore[key] === 'string') return windowStore[key];
	return null;
}

export function writeStoredValue(key: string, value: string) {
	for (const scope of getStorageScopes()) {
		try {
			scope.setItem(key, value);
		} catch {}
	}
	const windowStore = readWindowNameStore();
	windowStore[key] = value;
	writeWindowNameStore(windowStore);
}

export function removeStoredValue(key: string) {
	for (const scope of getStorageScopes()) {
		try {
			scope.removeItem(key);
		} catch {}
	}
	const windowStore = readWindowNameStore();
	delete windowStore[key];
	writeWindowNameStore(windowStore);
}

export function parseJson(raw: string | null): unknown {
	if (!raw) return undefined;
	try {
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
}
