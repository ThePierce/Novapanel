import { describe, expect, it } from 'vitest';
import { buildHaTargetUrl, haForwardPathFromTarget, isAllowedHaProxyForwardPath } from './ha-proxy-paths.js';

describe('buildHaTargetUrl', () => {
	it('preserves the configured HA base path and query', () => {
		const target = buildHaTargetUrl('http://supervisor/core', '/api/camera_proxy/camera.front?token=abc');
		expect(target.href).toBe('http://supervisor/core/api/camera_proxy/camera.front?token=abc');
		expect(haForwardPathFromTarget('http://supervisor/core', target)).toBe('/api/camera_proxy/camera.front');
	});

	it('rejects literal and encoded path traversal before URL resolution', () => {
		expect(() =>
			buildHaTargetUrl('http://supervisor/core', '/api/camera_proxy/../../config/core/check_config')
		).toThrow('invalid_ha_forward_path');
		expect(() => buildHaTargetUrl('http://supervisor/core', '/api/camera_proxy/%2e%2e/states')).toThrow(
			'invalid_ha_forward_path'
		);
		expect(() => buildHaTargetUrl('http://supervisor/core', '/api/camera_proxy/..%2fstates')).toThrow(
			'invalid_ha_forward_path'
		);
	});

	it('rejects absolute and protocol-relative forward URLs', () => {
		expect(() => buildHaTargetUrl('http://supervisor/core', 'http://evil.example/api/states')).toThrow(
			'invalid_ha_forward_path'
		);
		expect(() => buildHaTargetUrl('http://supervisor/core', '//evil.example/api/states')).toThrow(
			'invalid_ha_forward_path'
		);
	});
});

describe('isAllowedHaProxyForwardPath', () => {
	it('allows only the HA proxy prefixes after target resolution', () => {
		expect(isAllowedHaProxyForwardPath('/api/camera_proxy/camera.front')).toBe(true);
		expect(isAllowedHaProxyForwardPath('/api/media_source/local/file')).toBe(true);
		expect(isAllowedHaProxyForwardPath('/api/states')).toBe(false);
		expect(isAllowedHaProxyForwardPath('/config/core/check_config')).toBe(false);
	});
});
