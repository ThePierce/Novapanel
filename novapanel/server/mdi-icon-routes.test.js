import { describe, expect, it } from 'vitest';
import { createMdiIconCache, isValidMdiIconName } from './mdi-icon-routes.js';

describe('isValidMdiIconName', () => {
	it('accepts letters, digits and dashes', () => {
		expect(isValidMdiIconName('home')).toBe(true);
		expect(isValidMdiIconName('account-circle-outline')).toBe(true);
		expect(isValidMdiIconName('Alpha123')).toBe(true);
	});
	it('rejects unsafe names', () => {
		expect(isValidMdiIconName('bad/name')).toBe(false);
		expect(isValidMdiIconName('with space')).toBe(false);
		expect(isValidMdiIconName('../secret')).toBe(false);
		expect(isValidMdiIconName('')).toBe(false);
		expect(isValidMdiIconName(null)).toBe(false);
	});
});

describe('createMdiIconCache (LRU)', () => {
	it('stores and returns values, null on miss', () => {
		const cache = createMdiIconCache(10);
		expect(cache.get('a')).toBeNull();
		cache.set('a', '<svg-a/>');
		expect(cache.get('a')).toBe('<svg-a/>');
	});
	it('evicts the least-recently-used entry past the cap', () => {
		const cache = createMdiIconCache(2);
		cache.set('a', '1');
		cache.set('b', '2');
		cache.set('c', '3'); // evicts 'a'
		expect(cache.get('a')).toBeNull();
		expect(cache.get('b')).toBe('2');
		expect(cache.get('c')).toBe('3');
		expect(cache.size).toBe(2);
	});
	it('treats a get as a recency bump', () => {
		const cache = createMdiIconCache(2);
		cache.set('a', '1');
		cache.set('b', '2');
		cache.get('a'); // 'a' is now most-recently-used
		cache.set('c', '3'); // should evict 'b', not 'a'
		expect(cache.get('a')).toBe('1');
		expect(cache.get('b')).toBeNull();
		expect(cache.get('c')).toBe('3');
	});
});
