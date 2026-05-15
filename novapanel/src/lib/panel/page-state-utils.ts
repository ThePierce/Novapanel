export function cloneForPersistence<T>(value: T): T {
	try {
		return JSON.parse(JSON.stringify(value)) as T;
	} catch {
		return value;
	}
}

export function safeCompareJson(a: unknown, b: unknown): { equal: boolean; error?: string } {
	try {
		return { equal: JSON.stringify(a) === JSON.stringify(b) };
	} catch (error) {
		return { equal: false, error: String(error) };
	}
}
