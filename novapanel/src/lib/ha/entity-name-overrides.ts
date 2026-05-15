const STORAGE_KEY = 'novapanel.entity-name-overrides.v1';

let cache: Record<string, string> | null = null;

function normalizeEntityId(entityId: string) {
	return entityId.trim().toLowerCase();
}

function readStorage(): Record<string, string> {
	if (typeof window === 'undefined') return {};
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		if (!parsed || typeof parsed !== 'object') return {};
		const next: Record<string, string> = {};
		for (const [key, value] of Object.entries(parsed)) {
			if (typeof value !== 'string') continue;
			const normalizedKey = normalizeEntityId(key);
			const normalizedValue = value.trim();
			if (!normalizedKey || !normalizedValue) continue;
			next[normalizedKey] = normalizedValue;
		}
		return next;
	} catch {
		return {};
	}
}

function writeStorage() {
	if (typeof window === 'undefined' || !cache) return;
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
	} catch {}
}

function ensureCache() {
	if (cache) return cache;
	cache = readStorage();
	return cache;
}

export function getEntityNameOverride(entityId: string): string | undefined {
	const map = ensureCache();
	return map[normalizeEntityId(entityId)];
}

export function setEntityNameOverride(entityId: string, name: string) {
	const map = ensureCache();
	const key = normalizeEntityId(entityId);
	if (!key) return;
	const value = name.trim();
	if (!value) delete map[key];
	else map[key] = value;
	writeStorage();
}
