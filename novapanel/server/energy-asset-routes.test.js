import { describe, expect, it } from 'vitest';
import { ENERGY_VARIANTS, detectImageFormat, isSafeCardId } from './energy-asset-routes.js';

describe('isSafeCardId (path-traversal guard)', () => {
	it('accepts slug-like ids up to 64 chars', () => {
		expect(isSafeCardId('card_123')).toBe(true);
		expect(isSafeCardId('Energy-Card-1')).toBe(true);
		expect(isSafeCardId('a'.repeat(64))).toBe(true);
	});
	it('rejects traversal, separators, dots and over-length', () => {
		expect(isSafeCardId('../etc/passwd')).toBe(false);
		expect(isSafeCardId('card/id')).toBe(false);
		expect(isSafeCardId('card.id')).toBe(false);
		expect(isSafeCardId('a'.repeat(65))).toBe(false);
		expect(isSafeCardId('')).toBe(false);
		expect(isSafeCardId(null)).toBe(false);
	});
});

describe('detectImageFormat (magic bytes)', () => {
	it('detects PNG', () => {
		expect(detectImageFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('png');
	});
	it('detects JPEG', () => {
		expect(detectImageFormat(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]))).toBe('jpg');
	});
	it('rejects other/short content', () => {
		expect(detectImageFormat(Buffer.from([0x47, 0x49, 0x46, 0x38]))).toBeNull(); // GIF
		expect(detectImageFormat(Buffer.from([0x89, 0x50]))).toBeNull(); // too short
		expect(detectImageFormat(Buffer.alloc(0))).toBeNull();
		expect(detectImageFormat(null)).toBeNull();
	});
});

describe('ENERGY_VARIANTS', () => {
	it('contains exactly the four supported variants', () => {
		expect([...ENERGY_VARIANTS].sort()).toEqual([
			'day-no-car',
			'day-with-car',
			'night-no-car',
			'night-with-car'
		]);
		expect(ENERGY_VARIANTS.has('day-no-car')).toBe(true);
		expect(ENERGY_VARIANTS.has('bogus')).toBe(false);
	});
});
