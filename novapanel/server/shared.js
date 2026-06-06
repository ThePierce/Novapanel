import net from 'node:net';

/** Shared, side-effect-free helpers used by server.js and the route modules.
 *  Kept here as a single source of truth so the implementations cannot drift,
 *  and so the security-relevant URL guards can be unit-tested in isolation. */

export function asTrimmedString(value) {
	return typeof value === 'string' ? value.trim() : '';
}

export function splitCsv(value) {
	return String(value || '')
		.split(',')
		.map((entry) => entry.trim())
		.filter(Boolean);
}

/** True when a hostname points at the local machine or a private/internal
 *  network range, i.e. anything an SSRF attempt would want to reach. */
export function isBlockedHostname(hostname) {
	const value = String(hostname || '')
		.trim()
		.toLowerCase();
	if (!value) return true;
	if (
		value === 'localhost' ||
		value.endsWith('.localhost') ||
		value.endsWith('.local') ||
		value.endsWith('.home.arpa') ||
		value.endsWith('.internal')
	)
		return true;
	const ipVersion = net.isIP(value);
	if (ipVersion === 4) {
		const parts = value.split('.').map((part) => Number(part));
		const [a, b] = parts;
		return (
			a === 0 ||
			a === 10 ||
			a === 127 ||
			(a === 169 && b === 254) ||
			(a === 172 && b >= 16 && b <= 31) ||
			(a === 192 && b === 168)
		);
	}
	if (ipVersion === 6) {
		if (value.startsWith('::ffff:')) {
			return isBlockedHostname(value.slice('::ffff:'.length));
		}
		return (
			value === '::1' ||
			value === '::' ||
			value.startsWith('fc') ||
			value.startsWith('fd') ||
			value.startsWith('fe80:')
		);
	}
	return false;
}

/** Parse a URL and reject non-http(s) schemes, embedded credentials, and
 *  hosts that resolve to local/private ranges. Throws on rejection. */
export function parsePublicHttpUrl(value) {
	const parsed = new URL(String(value || '').trim());
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error('invalid_url_scheme');
	}
	if (parsed.username || parsed.password) {
		throw new Error('url_credentials_not_allowed');
	}
	if (isBlockedHostname(parsed.hostname)) {
		throw new Error('blocked_url_host');
	}
	return parsed;
}

/** True when hostname equals, or is a subdomain of, any allow-listed host. */
export function hostnameMatchesAllowed(hostname, allowedHosts) {
	const value = String(hostname || '').toLowerCase();
	return allowedHosts.some((host) => value === host || value.endsWith(`.${host}`));
}
