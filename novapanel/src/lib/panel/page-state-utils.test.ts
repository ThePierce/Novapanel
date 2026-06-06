import { describe, expect, it } from 'vitest';
import { safeCompareJson } from './page-state-utils';

describe('page state utils', () => {
	it('compares JSON-safe values', () => {
		expect(safeCompareJson({ a: 1 }, { a: 1 })).toEqual({ equal: true });
		expect(safeCompareJson({ a: 1 }, { a: 2 })).toEqual({ equal: false });
	});

	it('returns an error instead of throwing for circular values', () => {
		const value: Record<string, unknown> = {};
		value.self = value;

		const result = safeCompareJson(value, {});

		expect(result.equal).toBe(false);
		expect(result.error).toContain('circular');
	});
});
