import path from 'node:path';

export const HA_PROXY_ALLOWED_PREFIXES = [
	'/api/camera_proxy',
	'/api/camera_proxy_stream',
	'/api/hls',
	'/api/image',
	'/api/image_proxy',
	'/api/media_player_proxy',
	'/api/media_source',
	'/api/stream',
	'/api/calendars'
];

function normalizeBasePath(pathname) {
	const normalized = path.posix.normalize(`/${String(pathname || '').replace(/^\/+/, '')}`);
	return normalized === '/' ? '' : normalized.replace(/\/+$/, '');
}

function decodePathSegment(segment) {
	try {
		return decodeURIComponent(segment);
	} catch {
		throw new Error('invalid_ha_forward_path');
	}
}

function assertNoTraversal(forwardPath) {
	const raw = String(forwardPath || '/');
	if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(raw) || raw.startsWith('//')) {
		throw new Error('invalid_ha_forward_path');
	}
	const rawPath = raw.split(/[?#]/, 1)[0] || '/';
	for (const segment of rawPath.split('/')) {
		const decoded = decodePathSegment(segment);
		if (decoded === '..' || decoded.includes('/') || decoded.includes('\\')) {
			throw new Error('invalid_ha_forward_path');
		}
	}
}

export function buildHaTargetUrl(hassUrl, forwardPath) {
	assertNoTraversal(forwardPath);
	const base = new URL(
		`${String(hassUrl || '')
			.trim()
			.replace(/\/+$/, '')}/`
	);
	const parsedForward = new URL(
		String(forwardPath || '/').startsWith('/')
			? String(forwardPath || '/')
			: `/${String(forwardPath || '/')}`,
		'http://novapanel.local'
	);
	const target = new URL(base.href);
	const basePath = normalizeBasePath(base.pathname);
	const forwardPathname = path.posix.normalize(parsedForward.pathname || '/');
	target.pathname = `${basePath}${forwardPathname === '/' ? '' : forwardPathname}`;
	target.search = parsedForward.search;
	target.hash = '';
	return target;
}

export function haForwardPathFromTarget(hassUrl, targetUrl) {
	const base = new URL(
		`${String(hassUrl || '')
			.trim()
			.replace(/\/+$/, '')}/`
	);
	const target = targetUrl instanceof URL ? targetUrl : new URL(String(targetUrl || ''));
	const basePath = normalizeBasePath(base.pathname);
	const targetPath = path.posix.normalize(target.pathname || '/');
	if (basePath && targetPath === basePath) return '/';
	if (basePath && targetPath.startsWith(`${basePath}/`)) return targetPath.slice(basePath.length) || '/';
	return targetPath;
}

export function isAllowedHaProxyForwardPath(pathname) {
	const normalized = path.posix.normalize(`/${String(pathname || '').replace(/^\/+/, '')}`);
	return HA_PROXY_ALLOWED_PREFIXES.some(
		(prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
	);
}
