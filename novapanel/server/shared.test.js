import { describe, expect, it } from 'vitest';
import {
	asTrimmedString,
	hostnameMatchesAllowed,
	isBlockedHostname,
	parsePublicHttpUrl,
	splitCsv
} from './shared.js';

describe('asTrimmedString', () => {
	it('trims strings and rejects non-strings', () => {
		expect(asTrimmedString('  hi  ')).toBe('hi');
		expect(asTrimmedString('')).toBe('');
		expect(asTrimmedString(42)).toBe('');
		expect(asTrimmedString(null)).toBe('');
		expect(asTrimmedString(undefined)).toBe('');
	});
});

describe('splitCsv', () => {
	it('splits, trims and drops empty entries', () => {
		expect(splitCsv('a, b ,,c ')).toEqual(['a', 'b', 'c']);
		expect(splitCsv('')).toEqual([]);
		expect(splitCsv(null)).toEqual([]);
		expect(splitCsv('   ')).toEqual([]);
	});
});

describe('isBlockedHostname (SSRF guard)', () => {
	it('blocks loopback, private and link-local IPv4', () => {
		for (const host of [
			'127.0.0.1',
			'10.0.0.5',
			'192.168.1.1',
			'172.16.0.1',
			'172.31.255.255',
			'169.254.1.1',
			'0.0.0.0'
		]) {
			expect(isBlockedHostname(host), host).toBe(true);
		}
	});
	it('allows public IPv4 and the gap above the private 172 range', () => {
		for (const host of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '172.15.0.1']) {
			expect(isBlockedHostname(host), host).toBe(false);
		}
	});
	it('blocks local-style hostnames and empty input', () => {
		for (const host of ['localhost', 'box.local', 'svc.internal', 'host.home.arpa', '']) {
			expect(isBlockedHostname(host), host).toBe(true);
		}
		expect(isBlockedHostname('example.com')).toBe(false);
	});
	it('blocks loopback/private IPv6 including IPv4-mapped', () => {
		for (const host of [
			'::1',
			'::',
			'fe80::1',
			'fc00::1',
			'fd12::1',
			'::ffff:127.0.0.1',
			'::ffff:10.0.0.1'
		]) {
			expect(isBlockedHostname(host), host).toBe(true);
		}
		expect(isBlockedHostname('2606:4700:4700::1111')).toBe(false);
	});
});

describe('parsePublicHttpUrl', () => {
	it('accepts public http(s) URLs', () => {
		expect(parsePublicHttpUrl('https://example.com/path').hostname).toBe('example.com');
		expect(parsePublicHttpUrl('http://radiotime.com').hostname).toBe('radiotime.com');
	});
	it('rejects non-http(s) schemes', () => {
		expect(() => parsePublicHttpUrl('ftp://example.com')).toThrow('invalid_url_scheme');
		expect(() => parsePublicHttpUrl('file:///etc/passwd')).toThrow('invalid_url_scheme');
	});
	it('rejects embedded credentials', () => {
		expect(() => parsePublicHttpUrl('http://user:pass@example.com')).toThrow('url_credentials_not_allowed');
	});
	it('rejects blocked hosts', () => {
		expect(() => parsePublicHttpUrl('http://127.0.0.1/x')).toThrow('blocked_url_host');
		expect(() => parsePublicHttpUrl('http://192.168.0.1')).toThrow('blocked_url_host');
		expect(() => parsePublicHttpUrl('http://localhost:8123')).toThrow('blocked_url_host');
	});
	it('rejects non-URL input', () => {
		expect(() => parsePublicHttpUrl('not a url')).toThrow();
	});
});

describe('hostnameMatchesAllowed', () => {
	const allowed = ['radiotime.com', 'tunein.com'];
	it('matches exact host and subdomains only', () => {
		expect(hostnameMatchesAllowed('radiotime.com', allowed)).toBe(true);
		expect(hostnameMatchesAllowed('opml.radiotime.com', allowed)).toBe(true);
		expect(hostnameMatchesAllowed('tunein.com', allowed)).toBe(true);
	});
	it('does not match look-alike or unrelated hosts', () => {
		expect(hostnameMatchesAllowed('notradiotime.com', allowed)).toBe(false);
		expect(hostnameMatchesAllowed('radiotime.com.evil.com', allowed)).toBe(false);
		expect(hostnameMatchesAllowed('evil.com', allowed)).toBe(false);
	});
});
