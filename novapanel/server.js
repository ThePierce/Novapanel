import 'dotenv/config';
import express from 'express';
import { promises as fs } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { Readable } from 'node:stream';
import { WebSocket as WsClient, WebSocketServer } from 'ws';

const app = express();
const PORT = process.env.PORT || 8099;
const HOST = process.env.HOST || '0.0.0.0';
const IS_DEVELOPMENT = process.env.NODE_ENV !== 'production';
const DATA_DIR = process.env.DATA_DIR || '/data';
const SERVER_BUILD = 'np-server-2026-05-02T00:00:00Z';
const STATE_FILE = path.join(DATA_DIR, 'novapanel-state.json');
const OPTIONS_FILE = path.join(DATA_DIR, 'options.json');
const SPOTIFY_TOKEN_FILE = path.join(DATA_DIR, 'spotify-token.json');
const mdiIconCache = new Map();
const spotifyAuthStateMap = new Map();

function log(msg) { console.log(`[${new Date().toISOString()}] ${msg}`); }

log('=== Nova Panel Starting ===');
log(`Port: ${PORT}`);
log(`Host: ${HOST}`);
log(`Mode: ${IS_DEVELOPMENT ? 'development' : 'production'}`);
log(`Build: ${SERVER_BUILD}`);
log(`Data dir: ${DATA_DIR}`);

app.use(express.json({ limit: '1mb' }));

const RESERVED_INGRESS_PREFIXES = new Set(['api', 'local_novapanel', '_app', 'favicon.ico', 'hacsfiles', 'energy-asset']);

// Home Assistant add-on ingress normally strips the add-on slug before forwarding,
// but some routes/webviews keep it. Accept both /api/... and /<addon_slug>/api/....
app.use((req, _res, next) => {
    const requestUrl = req.url || '';
    const match = requestUrl.match(/^\/([^/?#]+)(?=\/api(?:\/|$))/);
    const prefix = match?.[1] || '';
    if (prefix && !RESERVED_INGRESS_PREFIXES.has(prefix)) {
        req.url = requestUrl.replace(/^\/[^/?#]+(?=\/api(?:\/|$))/, '');
    }
    next();
});

/** Lets LAN-origin pages call panel-state / sync-config on the public HTTPS HA URL (credentials + reflected Origin). */
app.use((req, res, next) => {
    const url = req.originalUrl || req.url || '';
    const needsCors = url.includes('panel-state') || url.includes('panel-sync-config');
    if (!needsCors) return next();
    const origin = req.headers.origin;
    if (origin && /^https?:\/\/.+/i.test(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader(
            'Access-Control-Allow-Headers',
            'Content-Type, Cache-Control, Pragma, Authorization'
        );
        res.setHeader('Vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }
    next();
});

// Prevent stale frontend html/js from sticking in HA companion webviews after updates.
app.use((req, res, next) => {
    if (req.method === 'GET' && !String(req.originalUrl || '').includes('/api/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

function mergePanelStatePayload(current, body) {
    const c = current && typeof current === 'object' ? { ...current } : {};
    if (!body || typeof body !== 'object') return c;
    const out = { ...c };
    for (const [key, value] of Object.entries(body)) {
        if (key === 'dashboard' && value && typeof value === 'object') {
            const prev = c.dashboard && typeof c.dashboard === 'object' ? c.dashboard : {};
            out.dashboard = { ...prev, ...value };
        } else if (key === 'configuration' && value && typeof value === 'object') {
            const prev = c.configuration && typeof c.configuration === 'object' ? c.configuration : {};
            out.configuration = { ...prev, ...value };
        } else if (key !== 'dashboard' && key !== 'configuration') {
            out[key] = value;
        }
    }
    return out;
}

/** Same backing store for every URL Home Assistant may forward (sidebar vs ingress vs raw /api). */
const PANEL_STATE_HTTP_PATHS = [
    '/api/panel-state',
    '/local_novapanel/api/panel-state',
    '/api/hassio_ingress/:ingressToken/api/panel-state'
];
const PANEL_STATE_READ_HTTP_PATHS = [
    '/api/panel-state/read',
    '/local_novapanel/api/panel-state/read',
    '/api/hassio_ingress/:ingressToken/api/panel-state/read'
];

async function handlePanelStateGet(_req, res) {
    const requestUrl = _req.originalUrl || _req.url || '/api/panel-state';
    res.setHeader('x-novapanel-state', '1');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    try {
        const raw = await fs.readFile(STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        log(`panel-state GET ${requestUrl} -> 200 (file)`);
        res.status(200).json(parsed);
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            log(`panel-state GET ${requestUrl} -> 200 (empty)`);
            res.status(200).json({});
            return;
        }
        log(`state read error: ${error instanceof Error ? error.message : String(error)}`);
        log(`panel-state GET ${requestUrl} -> 500`);
        res.status(500).json({ error: 'read_failed' });
    }
}

async function handlePanelStatePost(req, res) {
    const requestUrl = req.originalUrl || req.url || '/api/panel-state';
    res.setHeader('x-novapanel-state', '1');
    res.setHeader('Cache-Control', 'no-store');
    try {
        const body = req.body;
        if (!body || typeof body !== 'object') {
            log(`panel-state POST ${requestUrl} -> 400 (invalid_body)`);
            res.status(400).json({ error: 'invalid_body' });
            return;
        }
        let current = {};
        try {
            const raw = await fs.readFile(STATE_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') current = parsed;
        } catch {}
        let merged = mergePanelStatePayload(current, body);
        // Embed the requesting device's working API base so other devices can discover it
        const requestApiBase = extractRequestApiBase(req);
        if (requestApiBase) {
            merged = { ...merged, _np_api_base: requestApiBase };
        }
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(STATE_FILE, JSON.stringify(merged), 'utf8');
        log(`panel-state POST ${requestUrl} -> 200 (ok)`);
        res.status(200).json({ ok: true });
    } catch (error) {
        log(`state write error: ${error instanceof Error ? error.message : String(error)}`);
        log(`panel-state POST ${requestUrl} -> 500`);
        res.status(500).json({ error: 'write_failed' });
    }
}

app.get(PANEL_STATE_HTTP_PATHS, handlePanelStateGet);
app.post(PANEL_STATE_HTTP_PATHS, handlePanelStatePost);
app.post(PANEL_STATE_READ_HTTP_PATHS, async (req, res) => {
    const requestUrl = req.originalUrl || req.url || '/api/panel-state/read';
    res.setHeader('x-novapanel-state', '1');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    try {
        const raw = await fs.readFile(STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        log(`panel-state READ-POST ${requestUrl} -> 200 (file)`);
        res.status(200).json(parsed);
    } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            log(`panel-state READ-POST ${requestUrl} -> 200 (empty)`);
            res.status(200).json({});
            return;
        }
        log(`state read-post error: ${error instanceof Error ? error.message : String(error)}`);
        log(`panel-state READ-POST ${requestUrl} -> 500`);
        res.status(500).json({ error: 'read_failed' });
    }
});

app.get(
    ['/api/build-info', '/local_novapanel/api/build-info', '/api/hassio_ingress/:ingressToken/api/build-info'],
    (_req, res) => {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.status(200).json({
            ok: true,
            serverBuild: SERVER_BUILD
        });
    }
);

async function readAddonOptions() {
    try {
        const raw = await fs.readFile(OPTIONS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed;
    } catch {
        return {};
    }
}

const PANEL_SYNC_CONFIG_HTTP_PATHS = [
    '/api/panel-sync-config',
    '/local_novapanel/api/panel-sync-config',
    '/api/hassio_ingress/:ingressToken/api/panel-sync-config'
];

function extractRequestApiBase(req) {
    const proto = asTrimmedString(req.headers['x-forwarded-proto'] || req.headers['x-scheme'] || req.protocol || 'https').split(',')[0].trim();
    const host = asTrimmedString(req.headers['x-forwarded-host'] || req.headers.host).split(',')[0].trim();
    const ingressPath = asTrimmedString(req.headers['x-ingress-path']).replace(/\/+$/, '');
    if (!host) return '';
    if (ingressPath) return `${proto}://${host}${ingressPath}`;
    const requestUrl = req.originalUrl || req.url || '';
    const hassIngressMatch = requestUrl.match(/^(\/api\/hassio_ingress\/[^/]+)(?=\/api(?:\/|$))/);
    if (hassIngressMatch?.[1]) return `${proto}://${host}${hassIngressMatch[1]}`;
    const slugMatch = requestUrl.match(/^\/([^/?#]+)(?=\/api(?:\/|$))/);
    const slug = slugMatch?.[1] || '';
    if (slug && !RESERVED_INGRESS_PREFIXES.has(slug)) return `${proto}://${host}/${slug}`;
    if (requestUrl.startsWith('/local_novapanel/api/')) return `${proto}://${host}/local_novapanel`;
    return `${proto}://${host}`;
}

async function handlePanelSyncConfig(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    try {
        let authorityBaseUrl = null;
        const detectedBase = extractRequestApiBase(req);
        if (detectedBase) {
            authorityBaseUrl = detectedBase;
            log(`panel-sync-config auto-detected authority=${authorityBaseUrl}`);
        }
        log(`panel-sync-config GET -> 200 authority=${authorityBaseUrl || 'none'}`);
        res.status(200).json({ ok: true, authorityBaseUrl });
    } catch (error) {
        log(`panel-sync-config error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ ok: false, error: 'sync_config_failed' });
    }
}

app.get(PANEL_SYNC_CONFIG_HTTP_PATHS, handlePanelSyncConfig);

async function readPanelState() {
    try {
        const raw = await fs.readFile(STATE_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed;
    } catch {
        return {};
    }
}

async function readSpotifyToken() {
    try {
        const raw = await fs.readFile(SPOTIFY_TOKEN_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return null;
        return parsed;
    } catch {
        return null;
    }
}

async function writeSpotifyToken(tokenPayload) {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
        await fs.writeFile(SPOTIFY_TOKEN_FILE, JSON.stringify(tokenPayload), 'utf8');
        return true;
    } catch {
        return false;
    }
}

function asTrimmedString(value) {
    return typeof value === 'string' ? value.trim() : '';
}

async function getSpotifyOauthConfig() {
    const options = await readAddonOptions();
    const panelState = await readPanelState();
    const panelOauth =
        panelState &&
        typeof panelState === 'object' &&
        panelState.configuration &&
        typeof panelState.configuration === 'object' &&
        panelState.configuration.oauth &&
        typeof panelState.configuration.oauth === 'object'
            ? panelState.configuration.oauth
            : {};
    const clientId =
        asTrimmedString(panelOauth.spotifyClientId) ||
        asTrimmedString(options.spotify_client_id) ||
        asTrimmedString(process.env.SPOTIFY_CLIENT_ID);
    const clientSecret =
        asTrimmedString(panelOauth.spotifyClientSecret) ||
        asTrimmedString(options.spotify_client_secret) ||
        asTrimmedString(process.env.SPOTIFY_CLIENT_SECRET);
    const redirectUri = normalizeSpotifyRedirectUri(
        asTrimmedString(panelOauth.spotifyRedirectUri) ||
        asTrimmedString(options.spotify_redirect_uri) ||
        asTrimmedString(process.env.SPOTIFY_REDIRECT_URI)
    );
    return {
        clientId,
        clientSecret,
        redirectUri
    };
}

function buildSpotifyAuthUrl(config, stateToken) {
    const base = new URL('https://accounts.spotify.com/authorize');
    base.searchParams.set('client_id', config.clientId);
    base.searchParams.set('response_type', 'code');
    base.searchParams.set('redirect_uri', config.redirectUri);
    base.searchParams.set(
        'scope',
        'user-read-private user-read-email user-read-playback-state user-modify-playback-state user-library-read user-read-recently-played playlist-read-private streaming'
    );
    base.searchParams.set('state', stateToken);
    return base.toString();
}

function spotifyPaths(pathname) {
    return [
        `/api/spotify${pathname}`,
        `/local_novapanel/api/spotify${pathname}`,
        `/api/hassio_ingress/:ingressToken/api/spotify${pathname}`
    ];
}

function normalizeSpotifyRedirectUri(raw) {
    const value = asTrimmedString(raw);
    if (!value) return '';
    try {
        const url = new URL(value);
        if (/\/api\/spotify\/auth\/callback\/?$/i.test(url.pathname)) {
            url.search = '';
            url.hash = '';
            return url.toString();
        }
    } catch {
        return value;
    }
    return value;
}

function getRequestIngressBasePath(req) {
    const ingressPath = asTrimmedString(req.headers['x-ingress-path']).replace(/\/+$/, '');
    if (ingressPath) return ingressPath;
    const requestUrl = req.originalUrl || req.url || '';
    const hassIngressMatch = requestUrl.match(/^(\/api\/hassio_ingress\/[^/]+)(?=\/api(?:\/|$))/);
    if (hassIngressMatch?.[1]) return hassIngressMatch[1];
    return '';
}

function getRequestBaseUrl(req) {
    const proto = asTrimmedString(req.headers['x-forwarded-proto']) || req.protocol || 'http';
    const host = asTrimmedString(req.headers.host);
    if (!host) return '';
    return `${proto}://${host}`;
}

function buildHaTargetUrl(hassUrl, forwardPath) {
    const base = `${String(hassUrl || '').trim().replace(/\/+$/, '')}/`;
    const relativePath = String(forwardPath || '/').replace(/^\/+/, '');
    return new URL(relativePath, base);
}

function getConfiguredHaToken(options) {
    return (
        asTrimmedString(process.env.HASS_TOKEN) ||
        asTrimmedString(process.env.HA_TOKEN) ||
        asTrimmedString(options?.token)
    );
}

function getConfiguredHaTokenSource(options) {
    if (asTrimmedString(process.env.HASS_TOKEN)) return 'HASS_TOKEN';
    if (asTrimmedString(process.env.HA_TOKEN)) return 'HA_TOKEN';
    if (asTrimmedString(options?.token)) return 'options.token';
    return 'none';
}

function isSupervisorCoreUrl(value) {
    const raw = asTrimmedString(value).replace(/\/+$/, '');
    if (!raw) return false;
    try {
        const url = new URL(raw);
        return url.hostname === 'supervisor' && url.pathname.replace(/\/+$/, '') === '/core';
    } catch {
        return /^https?:\/\/supervisor(?::\d+)?\/core(?:\/|$)/i.test(raw);
    }
}

function selectHaProxyToken(hassUrl, options) {
    const supervisorToken = asTrimmedString(process.env.SUPERVISOR_TOKEN);
    if (isSupervisorCoreUrl(hassUrl) && supervisorToken) {
        return { token: supervisorToken, source: 'SUPERVISOR_TOKEN' };
    }
    const configuredToken = getConfiguredHaToken(options);
    return { token: configuredToken, source: getConfiguredHaTokenSource(options) };
}

function getSpotifyRedirectUriForRequest(req, config) {
    const configuredRedirectUri = normalizeSpotifyRedirectUri(config.redirectUri);
    const ingressPath = getRequestIngressBasePath(req);
    const baseUrl = getRequestBaseUrl(req);
    if (baseUrl && ingressPath) return `${baseUrl}${ingressPath}/api/spotify/auth/callback`;
    if (configuredRedirectUri) return configuredRedirectUri;
    if (baseUrl && req.originalUrl?.includes('/local_novapanel/')) {
        return `${baseUrl}/local_novapanel/api/spotify/auth/callback`;
    }
    if (baseUrl) return `${baseUrl}/api/spotify/auth/callback`;
    return configuredRedirectUri;
}

async function exchangeSpotifyCodeForToken(config, code) {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: config.redirectUri
    });
    const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            authorization: `Basic ${auth}`,
            'content-type': 'application/x-www-form-urlencoded'
        },
        body
    });
    if (!response.ok) return null;
    const token = await response.json();
    if (!token || typeof token !== 'object' || !token.access_token) return null;
    const now = Date.now();
    return {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: now + Math.max(1, Number(token.expires_in || 3600) - 30) * 1000,
        token_type: token.token_type || 'Bearer',
        scope: token.scope || ''
    };
}

async function refreshSpotifyToken(config, refreshToken) {
    const body = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
    });
    const auth = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
    const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
            authorization: `Basic ${auth}`,
            'content-type': 'application/x-www-form-urlencoded'
        },
        body
    });
    if (!response.ok) return null;
    const token = await response.json();
    if (!token || typeof token !== 'object' || !token.access_token) return null;
    const now = Date.now();
    return {
        access_token: token.access_token,
        refresh_token: token.refresh_token || refreshToken,
        expires_at: now + Math.max(1, Number(token.expires_in || 3600) - 30) * 1000,
        token_type: token.token_type || 'Bearer',
        scope: token.scope || ''
    };
}

async function ensureSpotifyAccessToken() {
    const config = await getSpotifyOauthConfig();
    if (!config.clientId || !config.clientSecret || !config.redirectUri) {
        return { ok: false, reason: 'missing_config', config };
    }
    const token = await readSpotifyToken();
    if (!token || typeof token !== 'object') {
        return { ok: false, reason: 'missing_token', config };
    }
    const now = Date.now();
    if (typeof token.access_token === 'string' && typeof token.expires_at === 'number' && token.expires_at > now + 10000) {
        return { ok: true, accessToken: token.access_token, config, token };
    }
    if (typeof token.refresh_token !== 'string' || token.refresh_token.trim().length === 0) {
        return { ok: false, reason: 'missing_refresh_token', config };
    }
    const refreshed = await refreshSpotifyToken(config, token.refresh_token);
    if (!refreshed) return { ok: false, reason: 'refresh_failed', config };
    await writeSpotifyToken(refreshed);
    return { ok: true, accessToken: refreshed.access_token, config, token: refreshed };
}

async function spotifyApi(accessToken, endpoint, init = {}) {
    const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        ...init,
        headers: {
            authorization: `Bearer ${accessToken}`,
            'content-type': 'application/json',
            ...(init.headers || {})
        }
    });
    return response;
}

const handleHaConnection = async (req, res) => {
	res.setHeader('x-novapanel-ha', '1');
	try {
        const options = await readAddonOptions();
        const envHassUrl = typeof process.env.HASS_URL === 'string' ? process.env.HASS_URL.trim() : '';
        const proxyTarget = typeof req.headers['x-proxy-target'] === 'string' ? req.headers['x-proxy-target'].trim() : '';
        const forwardedProto = typeof req.headers['x-forwarded-proto'] === 'string' ? req.headers['x-forwarded-proto'].trim() : '';
        const host = typeof req.headers.host === 'string' ? req.headers.host.trim() : '';
        const fallbackOrigin = host ? `${forwardedProto || 'http'}://${host}` : '';
        const internalHassUrl = envHassUrl || proxyTarget || (IS_DEVELOPMENT ? '' : 'http://supervisor/core');
        const hassUrl = envHassUrl || proxyTarget || fallbackOrigin || internalHassUrl;
        const token = getConfiguredHaToken(options);
        const proxyAuth = selectHaProxyToken(internalHassUrl, options);
        log(`ha connection requested: hassUrl=${hassUrl || '-'} internal=${internalHassUrl || '-'} browserToken=${token ? 'present' : 'missing'} proxyToken=${proxyAuth.token ? proxyAuth.source : 'missing'} envHassUrl=${envHassUrl ? 'present' : 'missing'} proxyTarget=${proxyTarget || '-'}`);
        res.status(200).json({
            hassUrl,
            token
        });
    } catch (error) {
        log(`ha connection config error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'ha_connection_config_failed' });
	}
};

app.get(
	['/api/ha/connection', '/local_novapanel/api/ha/connection', '/api/hassio_ingress/:ingressToken/api/ha/connection'],
	handleHaConnection
);

async function getHaProxyConfig(req) {
	const options = await readAddonOptions();
	const envHassUrl = typeof process.env.HASS_URL === 'string' ? process.env.HASS_URL.trim() : '';
	const proxyTarget = typeof req.headers['x-proxy-target'] === 'string' ? req.headers['x-proxy-target'].trim() : '';
	const hassUrl = (envHassUrl || proxyTarget || (IS_DEVELOPMENT ? '' : 'http://supervisor/core')).replace(/\/+$/, '');
	const auth = selectHaProxyToken(hassUrl, options);
	return {
		hassUrl,
		token: auth.token,
		tokenSource: auth.source
	};
}

function getHaWebSocketUrls(hassUrl) {
	const normalized = String(hassUrl || '').trim().replace(/\/+$/, '');
	if (!normalized) return [];
	const socketBase = normalized.startsWith('ws://') || normalized.startsWith('wss://')
		? normalized
		: normalized.startsWith('https://')
			? `wss://${normalized.slice(8)}`
			: normalized.startsWith('http://')
				? `ws://${normalized.slice(7)}`
				: `ws://${normalized}`;
	try {
		const parsed = new URL(socketBase);
		const basePath = parsed.pathname.replace(/\/+$/, '');
		const origin = `${parsed.protocol}//${parsed.host}`;
		if (basePath.endsWith('/core')) {
			return [
				`${origin}${basePath}/websocket`,
				`${origin}${basePath}/api/websocket`
			];
		}
		return [`${origin}${basePath}/api/websocket`];
	} catch {
		return [`${socketBase}/api/websocket`];
	}
}

function validateHaServicePart(value, label) {
	const normalized = String(value || '').trim();
	if (!/^[A-Za-z0-9_]+$/.test(normalized)) {
		throw new Error(`invalid_${label}`);
	}
	return normalized;
}

async function callHaRestService(req, domain, service, serviceData = {}) {
	const { hassUrl, token } = await getHaProxyConfig(req);
	if (!hassUrl) throw new Error('hass_url_unavailable');
	if (!token) throw new Error('hass_token_unavailable');
	const safeDomain = validateHaServicePart(domain, 'domain');
	const safeService = validateHaServicePart(service, 'service');
	const response = await fetch(`${hassUrl}/api/services/${safeDomain}/${safeService}`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${token}`,
			'content-type': 'application/json'
		},
		body: JSON.stringify(serviceData && typeof serviceData === 'object' && !Array.isArray(serviceData) ? serviceData : {})
	});
	const text = await response.text();
	let body = null;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		body = text;
	}
	if (!response.ok) {
		const error = new Error(`ha_service_http_${response.status}`);
		error.details = body;
		throw error;
	}
	return body;
}

async function handleHaService(req, res) {
	res.setHeader('Cache-Control', 'no-store');
	try {
		const body = req.body && typeof req.body === 'object' ? req.body : {};
		const result = await callHaRestService(req, body.domain, body.service, body.serviceData ?? {});
		res.status(200).json({ ok: true, result });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		log(`ha service proxy error: ${message}`);
		res.status(message.startsWith('invalid_') ? 400 : 502).json({ ok: false, error: message });
	}
}

app.post(
	['/api/ha/service', '/local_novapanel/api/ha/service', '/api/hassio_ingress/:ingressToken/api/ha/service'],
	handleHaService
);

async function handleHaApiService(req, res) {
	res.setHeader('Cache-Control', 'no-store');
	try {
		const result = await callHaRestService(req, req.params.domain, req.params.service, req.body ?? {});
		res.status(200).json(result ?? {});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		log(`ha api service proxy error: ${message}`);
		res.status(message.startsWith('invalid_') ? 400 : 502).json({ error: message });
	}
}

app.post(
	[
		'/api/services/:domain/:service',
		'/local_novapanel/api/services/:domain/:service',
		'/api/hassio_ingress/:ingressToken/api/services/:domain/:service'
	],
	handleHaApiService
);

async function callHaWebSocketOnce(socketUrl, token, payload, timeoutMs = 15000) {
	const resolvesWithFirstEvent = payload.type === 'calendar/event/subscribe';

	return await new Promise((resolve, reject) => {
		const id = Math.floor(Date.now() + Math.random() * 100000);
		const ws = new WsClient(socketUrl);
		let settled = false;
		const finish = (error, value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			try { ws.close(); } catch {}
			if (error) reject(error);
			else resolve(value);
		};
		const timeout = setTimeout(() => finish(new Error('ha_ws_timeout')), timeoutMs);
		ws.onmessage = (event) => {
			try {
				const raw = typeof event.data === 'string' ? event.data : event.data?.toString?.() ?? '';
				const message = JSON.parse(raw);
				const type = typeof message.type === 'string' ? message.type : '';
				if (type === 'auth_required') {
					ws.send(JSON.stringify({ type: 'auth', access_token: token }));
					return;
				}
				if (type === 'auth_invalid') {
					finish(new Error('ha_ws_auth_invalid'));
					return;
				}
				if (type === 'auth_ok') {
					ws.send(JSON.stringify({ id, ...payload }));
					return;
				}
				if (type === 'result' && message.id === id) {
					if (message.success === false) {
						const error = new Error('ha_ws_result_failed');
						error.details = message.error;
						finish(error);
						return;
					}
					if (resolvesWithFirstEvent) return;
					finish(null, message.result ?? null);
				}
				if (resolvesWithFirstEvent && type === 'event' && message.id === id) {
					finish(null, message.event ?? null);
				}
			} catch (error) {
				finish(error);
			}
		};
		ws.onerror = () => finish(new Error('ha_ws_connection_error'));
		ws.onclose = () => {
			if (!settled) finish(new Error('ha_ws_closed'));
		};
	});
}

async function callHaWebSocket(req, payload, timeoutMs = 15000) {
	const { hassUrl, token } = await getHaProxyConfig(req);
	if (!hassUrl) throw new Error('hass_url_unavailable');
	if (!token) throw new Error('hass_token_unavailable');
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
		throw new Error('invalid_ws_payload');
	}
	const socketUrls = getHaWebSocketUrls(hassUrl);
	if (socketUrls.length === 0) throw new Error('ha_ws_url_unavailable');
	let lastError = null;
	for (const socketUrl of socketUrls) {
		try {
			return await callHaWebSocketOnce(socketUrl, token, payload, timeoutMs);
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError ?? new Error('ha_ws_failed');
}

async function handleHaWs(req, res) {
	res.setHeader('Cache-Control', 'no-store');
	try {
		const body = req.body && typeof req.body === 'object' ? req.body : {};
		const payload = body.payload && typeof body.payload === 'object' ? body.payload : body;
		const timeoutMs = Number.isFinite(Number(body.timeoutMs))
			? Math.max(1000, Math.min(30000, Number(body.timeoutMs)))
			: 15000;
		const result = await callHaWebSocket(req, payload, timeoutMs);
		res.status(200).json({ ok: true, result });
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		log(`ha ws proxy error: ${message}`);
		res.status(message === 'invalid_ws_payload' ? 400 : 502).json({ ok: false, error: message });
	}
}

app.post(
	['/api/ha/ws', '/local_novapanel/api/ha/ws', '/api/hassio_ingress/:ingressToken/api/ha/ws'],
	handleHaWs
);

function setupHaWebSocketProxy(server) {
	const wsProxy = new WebSocketServer({ noServer: true });

	server.on('upgrade', (req, socket, head) => {
		let pathname = '';
		try {
			pathname = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`).pathname;
		} catch {
			pathname = req.url || '';
		}
		if (!pathname.endsWith('/api/ha/websocket')) return;
		wsProxy.handleUpgrade(req, socket, head, (client) => {
			wsProxy.emit('connection', client, req);
		});
	});

	wsProxy.on('connection', async (client, req) => {
		let upstream = null;
		let closed = false;
		let upstreamAuthenticated = false;
		let clientAuthenticated = false;
		let clientAuthOkSent = false;
		const queuedClientMessages = [];
		const closeBoth = (code = 1000, reason = '') => {
			if (closed) return;
			closed = true;
			try { client.close(code, reason); } catch {}
			try { upstream?.close(code, reason); } catch {}
		};
		const sendClientAuthOk = () => {
			if (clientAuthOkSent || !clientAuthenticated || !upstreamAuthenticated) return;
			clientAuthOkSent = true;
			if (client.readyState === WsClient.OPEN) {
				client.send(JSON.stringify({ type: 'auth_ok', ha_version: '2026.5.0' }));
			}
			for (const [data, isBinary] of queuedClientMessages.splice(0)) {
				if (upstream?.readyState === WsClient.OPEN) upstream.send(data, { binary: isBinary });
			}
		};
		try {
			const { hassUrl, token } = await getHaProxyConfig(req);
			const socketUrls = getHaWebSocketUrls(hassUrl);
			if (socketUrls.length === 0) {
				closeBoth(1011, 'hass_url_unavailable');
				return;
			}
			if (client.readyState === WsClient.OPEN) {
				client.send(JSON.stringify({ type: 'auth_required', ha_version: '2026.5.0' }));
			}
			let socketUrlIndex = 0;
			const connectUpstream = () => {
				if (closed) return;
				upstreamAuthenticated = false;
				const socketUrl = socketUrls[socketUrlIndex];
				upstream = new WsClient(socketUrl);
				upstream.on('open', () => {
					// HA always starts websocket sessions with auth_required. The message handler below
					// will authenticate server-side before client messages are forwarded.
				});
				const currentUpstream = upstream;
				upstream.on('message', (data, isBinary) => {
					if (upstream !== currentUpstream) return;
					try {
						const raw = typeof data === 'string' ? data : data?.toString?.() ?? '';
						const message = JSON.parse(raw);
						if (message?.type === 'auth_required') {
							upstream?.send(JSON.stringify({ type: 'auth', access_token: token }));
							return;
						}
						if (message?.type === 'auth_ok') {
							upstreamAuthenticated = true;
							sendClientAuthOk();
							return;
						}
						if (message?.type === 'auth_invalid') {
							if (client.readyState === WsClient.OPEN) client.send(data, { binary: isBinary });
							closeBoth(1008, 'upstream_auth_invalid');
							return;
						}
					} catch {}
					if (!clientAuthenticated || !upstreamAuthenticated) return;
					if (client.readyState === WsClient.OPEN) client.send(data, { binary: isBinary });
				});
				const retryOrClose = (reason) => {
					if (upstream !== currentUpstream) return;
					if (!closed && !upstreamAuthenticated && socketUrlIndex < socketUrls.length - 1) {
						socketUrlIndex += 1;
						connectUpstream();
						return;
					}
					closeBoth(1011, reason);
				};
				upstream.on('close', () => retryOrClose('upstream_closed'));
				upstream.on('error', () => retryOrClose('upstream_error'));
			};
			client.on('message', (data, isBinary) => {
				if (!clientAuthenticated) {
					try {
						const raw = typeof data === 'string' ? data : data?.toString?.() ?? '';
						const message = JSON.parse(raw);
						if (message?.type === 'auth') {
							clientAuthenticated = true;
							sendClientAuthOk();
							return;
						}
					} catch {}
				}
				if (!clientAuthenticated || !upstreamAuthenticated || upstream?.readyState !== WsClient.OPEN) {
					queuedClientMessages.push([data, isBinary]);
					return;
				}
				upstream.send(data, { binary: isBinary });
			});
			client.on('close', () => closeBoth());
			client.on('error', () => closeBoth(1011, 'client_error'));
			connectUpstream();
		} catch (error) {
			log(`ha websocket proxy error: ${error instanceof Error ? error.message : String(error)}`);
			closeBoth(1011, 'proxy_error');
		}
	});
}

app.get(
	[
		'/hacsfiles/*',
		'/local/community/advanced-camera-card/*',
		'/local/advanced-camera-card/*'
	],
	async (req, res) => {
		try {
			const { hassUrl, token } = await getHaProxyConfig(req);
			if (!hassUrl) {
				res.status(502).send('hass_url_unavailable');
				return;
			}
			const target = buildHaTargetUrl(hassUrl, req.originalUrl || req.url);
			const upstream = await fetch(target, {
				headers: token ? { authorization: `Bearer ${token}` } : {}
			});
			res.status(upstream.status);
			const contentType = upstream.headers.get('content-type');
			if (contentType) res.setHeader('content-type', contentType);
			res.setHeader('cache-control', 'no-store, no-cache, must-revalidate, private');
			const body = Buffer.from(await upstream.arrayBuffer());
			res.send(body);
		} catch (error) {
			log(`ha static proxy error: ${error instanceof Error ? error.message : String(error)}`);
			res.status(502).send('ha_static_proxy_failed');
		}
	}
);

async function proxyHaRequest(req, res) {
	try {
		const { hassUrl, token, tokenSource } = await getHaProxyConfig(req);
		if (!hassUrl) {
			res.status(502).send('hass_url_unavailable');
			return;
		}
		const forwardUrl = String(req.originalUrl || req.url || '/')
			.replace(/^\/api\/hassio_ingress\/[^/]+(?=\/api\/)/, '')
			.replace(/^\/local_novapanel(?=\/api\/)/, '');
		const target = buildHaTargetUrl(hassUrl, forwardUrl);
		const headers = {
			accept: req.headers.accept || '*/*',
			'accept-encoding': 'identity',
			...(token ? { authorization: `Bearer ${token}` } : {})
		};
		const method = req.method.toUpperCase();
		const init = {
			method,
			headers
		};
		if (method !== 'GET' && method !== 'HEAD' && req.body && Object.keys(req.body).length > 0) {
			init.headers['content-type'] = 'application/json';
			init.body = JSON.stringify(req.body);
		}
		const upstream = await fetch(target, init);
		if (!upstream.ok) {
			const cleanForwardPath = forwardUrl.split('?')[0] || '/';
			log(`ha api proxy ${method} ${cleanForwardPath} -> ${upstream.status} target=${target.origin}${target.pathname} auth=${token ? tokenSource : 'none'}`);
		}
		res.status(upstream.status);
		for (const header of ['content-type', 'cache-control']) {
			const value = upstream.headers.get(header);
			if (value) res.setHeader(header, value);
		}
		if ((req.originalUrl || req.url || '').includes('/api/hls/')) {
			res.setHeader('cache-control', 'no-store, no-cache, must-revalidate, private');
		}
		if (!upstream.body) {
			res.end();
			return;
		}
		Readable.fromWeb(upstream.body).pipe(res);
	} catch (error) {
		log(`ha api proxy error: ${error instanceof Error ? error.message : String(error)}`);
		res.status(502).send('ha_api_proxy_failed');
	}
}

app.use(
	[
		'/api/camera_proxy',
		'/api/camera_proxy_stream',
		'/api/hls',
		'/api/image_proxy',
		'/api/media_source',
		'/api/stream',
		'/local_novapanel/api/camera_proxy',
		'/local_novapanel/api/camera_proxy_stream',
		'/local_novapanel/api/hls',
		'/local_novapanel/api/image_proxy',
		'/local_novapanel/api/media_source',
		'/local_novapanel/api/stream',
		'/api/hassio_ingress/:ingressToken/api/camera_proxy',
		'/api/hassio_ingress/:ingressToken/api/camera_proxy_stream',
		'/api/hassio_ingress/:ingressToken/api/hls',
		'/api/hassio_ingress/:ingressToken/api/image_proxy',
		'/api/hassio_ingress/:ingressToken/api/media_source',
		'/api/hassio_ingress/:ingressToken/api/stream'
	],
	proxyHaRequest
);

app.get('/api/mdi-icon/:name', async (req, res) => {
	try {
        const raw = typeof req.params.name === 'string' ? req.params.name.trim() : '';
        if (!raw || !/^[a-z0-9-]+$/i.test(raw)) {
            res.status(400).send('invalid_icon_name');
            return;
        }
        if (mdiIconCache.has(raw)) {
            res.setHeader('content-type', 'image/svg+xml; charset=utf-8');
            res.setHeader('cache-control', 'public, max-age=86400');
            res.status(200).send(mdiIconCache.get(raw));
            return;
        }
        const url = `https://cdn.jsdelivr.net/npm/@mdi/svg/svg/${encodeURIComponent(raw)}.svg`;
        const upstream = await fetch(url);
        if (!upstream.ok) {
            res.status(404).send('icon_not_found');
            return;
        }
        const svg = await upstream.text();
        mdiIconCache.set(raw, svg);
        res.setHeader('content-type', 'image/svg+xml; charset=utf-8');
        res.setHeader('cache-control', 'public, max-age=86400');
        res.status(200).send(svg);
    } catch (error) {
        log(`mdi icon proxy error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).send('mdi_proxy_failed');
    }
});


app.get(spotifyPaths('/auth/start'), async (req, res) => {
    try {
        const config = await getSpotifyOauthConfig();
        const redirectUri = getSpotifyRedirectUriForRequest(req, config);
        if (!config.clientId || !config.clientSecret || !redirectUri) {
            res.status(400).json({ error: 'missing_spotify_oauth_config' });
            return;
        }
        const stateToken = Math.random().toString(36).slice(2, 14);
        const authConfig = { ...config, redirectUri };
        spotifyAuthStateMap.set(stateToken, {
            redirectUri,
            createdAt: Date.now()
        });
        const authUrl = buildSpotifyAuthUrl(authConfig, stateToken);
        res.status(200).json({ url: authUrl, redirectUri });
    } catch (error) {
        log(`spotify auth start error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'spotify_auth_start_failed' });
    }
});

app.get(spotifyPaths('/auth/callback'), async (req, res) => {
    try {
        const code = asTrimmedString(req.query.code);
        const stateToken = asTrimmedString(req.query.state);
        const config = await getSpotifyOauthConfig();
        const stateEntry = stateToken ? spotifyAuthStateMap.get(stateToken) : null;
        const redirectUri =
            stateEntry && typeof stateEntry === 'object' && typeof stateEntry.redirectUri === 'string'
                ? stateEntry.redirectUri
                : getSpotifyRedirectUriForRequest(req, config);
        if (!code || !config.clientId || !config.clientSecret || !redirectUri) {
            res.status(400).send('spotify_oauth_invalid_callback');
            return;
        }
        const exchangeConfig = { ...config, redirectUri };
        const token = await exchangeSpotifyCodeForToken(exchangeConfig, code);
        if (!token) {
            res.status(500).send('spotify_oauth_token_exchange_failed');
            return;
        }
        await writeSpotifyToken(token);
        if (stateToken) spotifyAuthStateMap.delete(stateToken);
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.status(200).send(`<!doctype html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>Spotify gekoppeld</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    background: #121722; color: #f5f5f5; font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    display: flex; align-items: center; justify-content: center; padding: 1.5rem;
  }
  .card {
    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 0.7rem; padding: 1.6rem 1.8rem; max-width: 26rem; text-align: center;
  }
  h1 { font-size: 1.1rem; margin: 0 0 0.5rem; }
  p { font-size: 0.9rem; line-height: 1.45; opacity: 0.85; margin: 0.4rem 0 0; }
  .ok { color: #4eae5b; font-weight: 600; }
  .badge { display: inline-block; width: 2rem; height: 2rem; line-height: 2rem; border-radius: 50%; background: #1db954; color: #fff; font-size: 1.1rem; margin-bottom: 0.5rem; }
</style>
</head>
<body>
  <div class="card">
    <div class="badge">✓</div>
    <h1 class="ok">Spotify is gekoppeld</h1>
    <p>Je kunt dit tabblad sluiten — Novapanel pikt de verbinding zelf op.</p>
    <p id="auto-close" style="opacity:0.55; font-size:0.78rem; margin-top:1rem;">Dit tabblad sluit automatisch…</p>
  </div>
  <script>
    (function() {
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'novapanel-spotify-auth', status: 'connected' }, '*');
        }
      } catch (e) {}
      setTimeout(function() {
        try { window.close(); } catch (e) {}
        var el = document.getElementById('auto-close');
        if (el) el.textContent = 'Je kunt dit tabblad sluiten.';
      }, 1500);
    })();
  </script>
</body>
</html>`);
    } catch (error) {
        log(`spotify auth callback error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).send('spotify_oauth_callback_failed');
    }
});

app.get(spotifyPaths('/auth/status'), async (_req, res) => {
    try {
        const ensured = await ensureSpotifyAccessToken();
        if (!ensured.ok) {
            res.status(200).json({ connected: false, reason: ensured.reason || 'not_connected' });
            return;
        }
        const profileResp = await spotifyApi(ensured.accessToken, '/me');
        if (!profileResp.ok) {
            res.status(200).json({ connected: false, reason: 'profile_failed' });
            return;
        }
        const profile = await profileResp.json();
        res.status(200).json({
            connected: true,
            profile: {
                id: profile?.id || '',
                display_name: profile?.display_name || '',
                email: profile?.email || ''
            }
        });
    } catch (error) {
        log(`spotify auth status error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'spotify_auth_status_failed' });
    }
});

app.post(spotifyPaths('/search'), async (req, res) => {
    try {
        const action = asTrimmedString(req.body?.action);
        if (action === 'play') {
            const ensured = await ensureSpotifyAccessToken();
            if (!ensured.ok) {
                res.status(401).json({ error: 'spotify_not_connected', reason: ensured.reason || 'not_connected' });
                return;
            }
            const uri = asTrimmedString(req.body?.uri);
            const deviceId = asTrimmedString(req.body?.deviceId);
            if (!uri || !uri.startsWith('spotify:')) {
                res.status(400).json({ error: 'missing_or_invalid_uri' });
                return;
            }
            const body = uri.includes(':track:')
                ? { uris: [uri] }
                : { context_uri: uri };
            const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
            const response = await spotifyApi(ensured.accessToken, `/me/player/play${query}`, {
                method: 'PUT',
                body: JSON.stringify(body)
            });
            if (!response.ok) {
                const errorText = await response.text();
                res.status(response.status).json({ error: 'spotify_play_failed', details: errorText || '' });
                return;
            }
            res.status(200).json({ ok: true });
            return;
        }
        const query = asTrimmedString(req.body?.query);
        const type = asTrimmedString(req.body?.type) || 'track,album,artist,playlist';
        const limit = Math.max(1, Math.min(30, Number(req.body?.limit || 10)));
        if (!query) {
            res.status(400).json({ error: 'missing_query' });
            return;
        }
        const ensured = await ensureSpotifyAccessToken();
        if (!ensured.ok) {
            res.status(401).json({ error: 'spotify_not_connected', reason: ensured.reason || 'not_connected' });
            return;
        }
        const endpoint = `/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}&limit=${limit}`;
        const response = await spotifyApi(ensured.accessToken, endpoint);
        if (!response.ok) {
            res.status(response.status).json({ error: 'spotify_search_failed' });
            return;
        }
        const payload = await response.json();
        res.status(200).json(payload);
    } catch (error) {
        log(`spotify search error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'spotify_search_failed' });
    }
});

app.get(spotifyPaths('/recommendations'), async (req, res) => {
    try {
        const ensured = await ensureSpotifyAccessToken();
        if (!ensured.ok) {
            res.status(401).json({ error: 'spotify_not_connected', reason: ensured.reason || 'not_connected' });
            return;
        }
        const limit = Math.max(1, Math.min(20, Number(req.query.limit || 8)));
        const response = await spotifyApi(ensured.accessToken, `/browse/new-releases?limit=${limit}`);
        if (!response.ok) {
            res.status(response.status).json({ error: 'spotify_recommendations_failed' });
            return;
        }
        const payload = await response.json();
        res.status(200).json(payload);
    } catch (error) {
        log(`spotify recommendations error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'spotify_recommendations_failed' });
    }
});

app.get(spotifyPaths('/recent'), async (req, res) => {
    try {
        const ensured = await ensureSpotifyAccessToken();
        if (!ensured.ok) {
            res.status(401).json({ error: 'spotify_not_connected', reason: ensured.reason || 'not_connected' });
            return;
        }
        const limit = Math.max(1, Math.min(20, Number(req.query.limit || 8)));
        const response = await spotifyApi(ensured.accessToken, `/me/player/recently-played?limit=${limit}`);
        if (!response.ok) {
            res.status(response.status).json({ error: 'spotify_recent_failed' });
            return;
        }
        const payload = await response.json();
        res.status(200).json(payload);
    } catch (error) {
        log(`spotify recent error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'spotify_recent_failed' });
    }
});

app.get(spotifyPaths('/playlists'), async (req, res) => {
    try {
        const ensured = await ensureSpotifyAccessToken();
        if (!ensured.ok) {
            res.status(401).json({ error: 'spotify_not_connected', reason: ensured.reason || 'not_connected' });
            return;
        }
        const limit = Math.max(1, Math.min(50, Number(req.query.limit || 20)));
        const response = await spotifyApi(ensured.accessToken, `/me/playlists?limit=${limit}`);
        if (!response.ok) {
            res.status(response.status).json({ error: 'spotify_playlists_failed' });
            return;
        }
        const payload = await response.json();
        res.status(200).json(payload);
    } catch (error) {
        log(`spotify playlists error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'spotify_playlists_failed' });
    }
});

app.get(spotifyPaths('/ping'), async (_req, res) => {
    res.status(200).json({ ok: true, route: 'spotify_ping' });
});

async function handleSpotifyPlay(req, res) {
    try {
        log(`spotify play requested via ${req.url}`);
        const ensured = await ensureSpotifyAccessToken();
        if (!ensured.ok) {
            res.status(401).json({ error: 'spotify_not_connected', reason: ensured.reason || 'not_connected' });
            return;
        }
        const uri =
            asTrimmedString(req.body?.uri) ||
            asTrimmedString(req.query?.uri);
        const deviceId =
            asTrimmedString(req.body?.deviceId) ||
            asTrimmedString(req.query?.deviceId);
        if (!uri || !uri.startsWith('spotify:')) {
            res.status(400).json({ error: 'missing_or_invalid_uri' });
            return;
        }
        const body = uri.includes(':track:')
            ? { uris: [uri] }
            : { context_uri: uri };
        const query = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
        const response = await spotifyApi(ensured.accessToken, `/me/player/play${query}`, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
        if (!response.ok) {
            const errorText = await response.text();
            res.status(response.status).json({ error: 'spotify_play_failed', details: errorText || '' });
            return;
        }
        res.status(200).json({ ok: true });
    } catch (error) {
        log(`spotify play error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'spotify_play_failed' });
    }
}

app.post(spotifyPaths('/play'), handleSpotifyPlay);
app.get(spotifyPaths('/play'), handleSpotifyPlay);

// ====================================================================
// Extra Spotify endpoints: control, queue, devices, player-state
// ====================================================================

async function handleSpotifyControl(req, res) {
    try {
        const ensured = await ensureSpotifyAccessToken();
        if (!ensured.ok) {
            res.status(401).json({ error: 'spotify_not_connected', reason: ensured.reason || 'not_connected' });
            return;
        }
        const action = asTrimmedString(req.body?.action) || asTrimmedString(req.query?.action);
        const deviceId = asTrimmedString(req.body?.deviceId) || asTrimmedString(req.query?.deviceId);
        const deviceQuery = deviceId ? `?device_id=${encodeURIComponent(deviceId)}` : '';
        let endpoint = '';
        let method = 'PUT';
        let body = undefined;
        switch (action) {
            case 'play':
                endpoint = `/me/player/play${deviceQuery}`;
                break;
            case 'pause':
                endpoint = `/me/player/pause${deviceQuery}`;
                break;
            case 'next':
                endpoint = `/me/player/next${deviceQuery}`;
                method = 'POST';
                break;
            case 'previous':
                endpoint = `/me/player/previous${deviceQuery}`;
                method = 'POST';
                break;
            case 'volume': {
                const volume = Math.max(0, Math.min(100, Math.round(Number(req.body?.volume ?? req.query?.volume))));
                if (!Number.isFinite(volume)) {
                    res.status(400).json({ error: 'invalid_volume' });
                    return;
                }
                endpoint = `/me/player/volume?volume_percent=${volume}${deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ''}`;
                break;
            }
            case 'shuffle': {
                const enabled = req.body?.enabled === true || req.body?.enabled === 'true';
                endpoint = `/me/player/shuffle?state=${enabled ? 'true' : 'false'}${deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ''}`;
                break;
            }
            case 'repeat': {
                const mode = asTrimmedString(req.body?.mode) || 'off';
                if (!['track', 'context', 'off'].includes(mode)) {
                    res.status(400).json({ error: 'invalid_repeat_mode' });
                    return;
                }
                endpoint = `/me/player/repeat?state=${mode}${deviceId ? `&device_id=${encodeURIComponent(deviceId)}` : ''}`;
                break;
            }
            case 'transfer': {
                if (!deviceId) {
                    res.status(400).json({ error: 'missing_deviceId' });
                    return;
                }
                endpoint = '/me/player';
                method = 'PUT';
                body = JSON.stringify({ device_ids: [deviceId], play: req.body?.play === true });
                break;
            }
            default:
                res.status(400).json({ error: 'unknown_action', action });
                return;
        }
        const init = { method };
        if (body) {
            init.body = body;
            init.headers = { 'content-type': 'application/json' };
        }
        const response = await spotifyApi(ensured.accessToken, endpoint, init);
        if (!response.ok) {
            const errorText = await response.text();
            res.status(response.status).json({ error: 'spotify_control_failed', details: errorText || '' });
            return;
        }
        res.status(200).json({ ok: true });
    } catch (error) {
        log(`spotify control error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'spotify_control_failed' });
    }
}

app.post(spotifyPaths('/control'), handleSpotifyControl);

async function handleSpotifyQueueAdd(req, res) {
    try {
        const ensured = await ensureSpotifyAccessToken();
        if (!ensured.ok) {
            res.status(401).json({ error: 'spotify_not_connected', reason: ensured.reason || 'not_connected' });
            return;
        }
        const uri = asTrimmedString(req.body?.uri) || asTrimmedString(req.query?.uri);
        const deviceId = asTrimmedString(req.body?.deviceId) || asTrimmedString(req.query?.deviceId);
        if (!uri || !uri.startsWith('spotify:')) {
            res.status(400).json({ error: 'invalid_uri' });
            return;
        }
        const params = new URLSearchParams({ uri });
        if (deviceId) params.set('device_id', deviceId);
        const response = await spotifyApi(ensured.accessToken, `/me/player/queue?${params.toString()}`, { method: 'POST' });
        if (!response.ok) {
            const errorText = await response.text();
            res.status(response.status).json({ error: 'spotify_queue_failed', details: errorText || '' });
            return;
        }
        res.status(200).json({ ok: true });
    } catch (error) {
        log(`spotify queue error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'spotify_queue_failed' });
    }
}
app.post(spotifyPaths('/queue'), handleSpotifyQueueAdd);

app.get(spotifyPaths('/queue'), async (_req, res) => {
    try {
        const ensured = await ensureSpotifyAccessToken();
        if (!ensured.ok) {
            res.status(401).json({ error: 'spotify_not_connected', reason: ensured.reason || 'not_connected' });
            return;
        }
        const response = await spotifyApi(ensured.accessToken, '/me/player/queue');
        if (!response.ok) {
            res.status(response.status).json({ error: 'spotify_queue_get_failed' });
            return;
        }
        const payload = await response.json();
        res.status(200).json(payload);
    } catch (error) {
        log(`spotify queue get error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'spotify_queue_get_failed' });
    }
});

app.get(spotifyPaths('/devices'), async (_req, res) => {
    try {
        const ensured = await ensureSpotifyAccessToken();
        if (!ensured.ok) {
            res.status(401).json({ error: 'spotify_not_connected', reason: ensured.reason || 'not_connected' });
            return;
        }
        const response = await spotifyApi(ensured.accessToken, '/me/player/devices');
        if (!response.ok) {
            res.status(response.status).json({ error: 'spotify_devices_failed' });
            return;
        }
        const payload = await response.json();
        res.status(200).json(payload);
    } catch (error) {
        log(`spotify devices error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'spotify_devices_failed' });
    }
});

// Korte cache voor /me/player om Spotify rate-limiting te voorkomen bij meerdere tabs
let spotifyPlayerCache = { ts: 0, status: 0, body: null };
const SPOTIFY_PLAYER_CACHE_MS = 2000;

app.get(spotifyPaths('/player'), async (_req, res) => {
    try {
        const ensured = await ensureSpotifyAccessToken();
        if (!ensured.ok) {
            res.status(401).json({ error: 'spotify_not_connected', reason: ensured.reason || 'not_connected' });
            return;
        }
        // Serve uit cache als die nog vers is
        const now = Date.now();
        if (spotifyPlayerCache.body && (now - spotifyPlayerCache.ts) < SPOTIFY_PLAYER_CACHE_MS) {
            res.status(spotifyPlayerCache.status).json(spotifyPlayerCache.body);
            return;
        }
        const response = await spotifyApi(ensured.accessToken, '/me/player');
        if (response.status === 204) {
            const body = { active: false };
            spotifyPlayerCache = { ts: now, status: 200, body };
            res.status(200).json(body);
            return;
        }
        if (response.status === 429) {
            // Geef Retry-After door aan de client zodat hij de polling pauzeert
            const retryAfter = response.headers.get('retry-after');
            if (retryAfter) res.set('retry-after', retryAfter);
            res.status(429).json({ error: 'spotify_rate_limited', retryAfter });
            return;
        }
        if (!response.ok) {
            res.status(response.status).json({ error: 'spotify_player_failed' });
            return;
        }
        const payload = await response.json();
        const body = { active: true, ...payload };
        spotifyPlayerCache = { ts: now, status: 200, body };
        res.status(200).json(body);
    } catch (error) {
        log(`spotify player error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'spotify_player_failed' });
    }
});

// ====================================================================
// TuneIn — publieke OPML-feed proxy (favorieten via user-ID)
// ====================================================================

function parseTuneInOpml(xml) {
    // Parse de OPML feed — bevat <outline> elementen met text, URL, image, etc.
    // We doen een simpele regex-parse omdat we geen XML parser willen toevoegen.
    const items = [];
    const outlineRe = /<outline\b([^>]*)\/?\s*>/g;
    let match;
    while ((match = outlineRe.exec(xml)) !== null) {
        const attrs = match[1];
        const get = (name) => {
            const re = new RegExp(`\\s${name}="([^"]*)"`, 'i');
            const m = re.exec(attrs);
            return m ? m[1].replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>') : '';
        };
        const type = get('type');
        const url = get('URL');
        if (type !== 'audio' || !url) continue; // alleen afspeelbare items
        items.push({
            text: get('text'),
            url,
            image: get('image'),
            subtext: get('subtext'),
            bitrate: get('bitrate'),
            formats: get('formats'),
            guideId: get('guide_id') || get('preset_id') || ''
        });
    }
    return items;
}

app.get(['/api/tunein/search', '/local_novapanel/api/tunein/search'], async (req, res) => {
    try {
        const query = asTrimmedString(req.query?.q);
        if (!query) {
            res.status(400).json({ error: 'missing_query' });
            return;
        }
        // TuneIn's publieke search-API. Geen partnerId nodig voor lichte gebruik.
        const params = new URLSearchParams({ query, types: 'station' });
        const opmlUrl = `https://opml.radiotime.com/Search.ashx?${params.toString()}`;
        const response = await fetch(opmlUrl, {
            headers: {
                'user-agent': 'Mozilla/5.0 Novapanel',
                'accept': 'text/xml,application/xml,*/*'
            }
        });
        if (!response.ok) {
            res.status(response.status).json({ error: 'tunein_search_failed', status: response.status });
            return;
        }
        const xml = await response.text();
        const items = parseTuneInOpml(xml);
        res.status(200).json({ ok: true, items });
    } catch (error) {
        log(`tunein search error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'tunein_search_failed' });
    }
});

// TuneIn streams worden via een redirect-URL geleverd — we proxy'en niet de audio
// zelf (dat zou de receiver moeten doen). Wel resolven we de uiteindelijke
// stream-URL voor receivers die geen redirects volgen.
app.get(['/api/tunein/resolve', '/local_novapanel/api/tunein/resolve'], async (req, res) => {
    try {
        const tuneUrl = asTrimmedString(req.query?.url);
        if (!tuneUrl) {
            res.status(400).json({ error: 'missing_url' });
            return;
        }
        const response = await fetch(tuneUrl, { headers: { 'user-agent': 'Novapanel/1.0' } });
        const text = await response.text();
        // OPML response — eerste audio outline
        if (text.includes('<outline')) {
            const items = parseTuneInOpml(text);
            const first = items[0];
            if (first?.url) {
                res.status(200).json({ ok: true, streamUrl: first.url });
                return;
            }
        }
        // .pls of .m3u response — pak eerste File1=... regel
        const plsMatch = /File\d+=(\S+)/i.exec(text);
        if (plsMatch) {
            res.status(200).json({ ok: true, streamUrl: plsMatch[1] });
            return;
        }
        // Plain m3u — eerste niet-comment regel
        const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
        if (lines.length > 0 && /^https?:\/\//i.test(lines[0])) {
            res.status(200).json({ ok: true, streamUrl: lines[0] });
            return;
        }
        res.status(404).json({ error: 'no_stream_found' });
    } catch (error) {
        log(`tunein resolve error: ${error instanceof Error ? error.message : String(error)}`);
        res.status(500).json({ error: 'tunein_resolve_failed' });
    }
});

app.use((req, res, next) => {
    const ingressPath = (req.headers['x-ingress-path'] || '').replace(/\/+$/, '');
    if (!ingressPath) return next();

    req.ingressPath = ingressPath;

    const origWriteHead = res.writeHead.bind(res);
    res.writeHead = function(statusCode, statusMessage, headers) {
        res.removeHeader('content-length');
        if (typeof statusMessage === 'object' && statusMessage) {
            delete statusMessage['content-length'];
            delete statusMessage['Content-Length'];
        }
        if (headers) {
            delete headers['content-length'];
            delete headers['Content-Length'];
        }
        return origWriteHead(statusCode, statusMessage, headers);
    };

    const origWrite = res.write.bind(res);
    const origEnd = res.end.bind(res);
    let processed = false;

    function tryRewrite(chunk) {
        if (processed || chunk == null) return null;
        try {
            const str = typeof chunk === 'string'
                ? chunk
                : Buffer.from(chunk).toString('utf8');

            if (!str.includes('<head>')) return null;
            processed = true;

            let modified = str;

            
            
            modified = modified.split('./_app/').join(`${ingressPath}/_app/`);
            modified = modified.split('./__data').join(`${ingressPath}/__data`);

            
            modified = modified.replace('<head>',
                `<head><script>window.__novapanel_ingress="${ingressPath}";</script>`);

            log(`URLs rewritten for ingress: ${ingressPath}`);
            return Buffer.from(modified, 'utf8');
        } catch(e) { log(`rewrite error: ${e.message}`); }
        return null;
    }

    res.write = function(chunk, enc, cb) {
        const mod = tryRewrite(chunk);
        return mod ? origWrite(mod, 'binary', cb) : origWrite(chunk, enc, cb);
    };

    res.end = function(chunk, enc, cb) {
        const mod = chunk != null ? tryRewrite(chunk) : null;
        return mod ? origEnd(mod, 'binary', cb) : origEnd(chunk, enc, cb);
    };

    next();
});

app.use((req, res, next) => {
    res.on('finish', () => log(`${req.method} ${req.url} → ${res.statusCode}`));
    next();
});

/* ============================================================
 * Energy Assets — upload/serve custom photos per energy card
 * ============================================================ */

const ENERGY_ASSETS_DIR = path.join(DATA_DIR, 'energy-assets');
const ENERGY_VARIANTS = new Set(['day-no-car', 'day-with-car', 'night-no-car', 'night-with-car']);
const ENERGY_MAX_BYTES = 5 * 1024 * 1024; // 5 MB per file

async function ensureEnergyAssetsDir(cardId) {
    const dir = path.join(ENERGY_ASSETS_DIR, cardId);
    await fs.mkdir(dir, { recursive: true });
    return dir;
}

function isSafeCardId(id) {
    return typeof id === 'string' && /^[a-z0-9_-]{1,64}$/i.test(id);
}

/** Read raw body up to maxBytes. */
function readRawBody(req, maxBytes) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let total = 0;
        req.on('data', (chunk) => {
            total += chunk.length;
            if (total > maxBytes) {
                reject(new Error('payload-too-large'));
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

/** Very small multipart/form-data parser; expects exactly one file field. */
function parseSingleFileMultipart(req, body) {
    const ct = String(req.headers['content-type'] || '');
    const m = ct.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!m) return null;
    const boundary = `--${m[1] || m[2]}`;
    const data = body.toString('binary');
    const parts = data.split(boundary);
    for (const part of parts) {
        if (!part || part === '--' || part === '--\r\n') continue;
        const headerEnd = part.indexOf('\r\n\r\n');
        if (headerEnd === -1) continue;
        const headers = part.slice(0, headerEnd);
        const content = part.slice(headerEnd + 4, part.length - 2); // strip trailing CRLF
        if (!/Content-Disposition:.+filename=/i.test(headers)) continue;
        const fileBuf = Buffer.from(content, 'binary');
        return fileBuf;
    }
    return null;
}

app.post(
    ['/api/energy-asset/upload', '/local_novapanel/api/energy-asset/upload'],
    async (req, res) => {
        try {
            const cardId = String(req.query.cardId || '');
            const variant = String(req.query.variant || '');
            if (!isSafeCardId(cardId)) return res.status(400).json({ error: 'invalid-cardId' });
            if (!ENERGY_VARIANTS.has(variant)) return res.status(400).json({ error: 'invalid-variant' });

            const body = await readRawBody(req, ENERGY_MAX_BYTES);
            const fileBuf = parseSingleFileMultipart(req, body);
            if (!fileBuf || fileBuf.length === 0) return res.status(400).json({ error: 'no-file' });

            // PNG magic check
            const magic = fileBuf.slice(0, 8);
            const isPng =
                magic[0] === 0x89 && magic[1] === 0x50 && magic[2] === 0x4e && magic[3] === 0x47;
            const isJpg = magic[0] === 0xff && magic[1] === 0xd8 && magic[2] === 0xff;
            if (!isPng && !isJpg) return res.status(400).json({ error: 'unsupported-format' });

            const dir = await ensureEnergyAssetsDir(cardId);
            const ext = isPng ? 'png' : 'jpg';
            // remove other-extension counterpart if present so only one variant lives there
            const otherExt = isPng ? 'jpg' : 'png';
            try {
                await fs.unlink(path.join(dir, `${variant}.${otherExt}`));
            } catch {
                /* noop */
            }
            const fp = path.join(dir, `${variant}.${ext}`);
            await fs.writeFile(fp, fileBuf);

            res.json({ ok: true, ext, size: fileBuf.length });
        } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            log(`energy-asset upload error: ${msg}`);
            if (msg === 'payload-too-large') return res.status(413).json({ error: 'too-large' });
            res.status(500).json({ error: 'upload-failed' });
        }
    }
);

app.delete(
    ['/api/energy-asset', '/local_novapanel/api/energy-asset'],
    async (req, res) => {
        try {
            const cardId = String(req.query.cardId || '');
            const variant = String(req.query.variant || '');
            if (!isSafeCardId(cardId)) return res.status(400).json({ error: 'invalid-cardId' });
            if (!ENERGY_VARIANTS.has(variant)) return res.status(400).json({ error: 'invalid-variant' });
            const dir = path.join(ENERGY_ASSETS_DIR, cardId);
            for (const ext of ['png', 'jpg']) {
                try {
                    await fs.unlink(path.join(dir, `${variant}.${ext}`));
                } catch {
                    /* noop */
                }
            }
            res.json({ ok: true });
        } catch {
            res.status(500).json({ error: 'delete-failed' });
        }
    }
);

app.get(
    ['/energy-asset/:cardId/:variant', '/local_novapanel/energy-asset/:cardId/:variant'],
    async (req, res) => {
        try {
            const cardId = String(req.params.cardId || '');
            // strip optional extension that might be appended for cache-busting/pathlike requests
            const variantRaw = String(req.params.variant || '');
            const variant = variantRaw.replace(/\.(png|jpg|jpeg)$/i, '');
            if (!isSafeCardId(cardId)) return res.status(400).end();
            if (!ENERGY_VARIANTS.has(variant)) return res.status(400).end();
            const dir = path.join(ENERGY_ASSETS_DIR, cardId);
            for (const ext of ['png', 'jpg']) {
                const fp = path.join(dir, `${variant}.${ext}`);
                try {
                    const data = await fs.readFile(fp);
                    res.setHeader('Content-Type', ext === 'png' ? 'image/png' : 'image/jpeg');
                    res.setHeader('Cache-Control', 'no-cache');
                    return res.end(data);
                } catch {
                    /* try next */
                }
            }
            res.status(404).end();
        } catch {
            res.status(500).end();
        }
    }
);

app.get(
    ['/api/energy-asset/manifest', '/local_novapanel/api/energy-asset/manifest'],
    async (req, res) => {
        try {
            const cardId = String(req.query.cardId || '');
            if (!isSafeCardId(cardId)) return res.status(400).json({ error: 'invalid-cardId' });
            const dir = path.join(ENERGY_ASSETS_DIR, cardId);
            const out = {};
            for (const variant of ENERGY_VARIANTS) {
                let found = false;
                for (const ext of ['png', 'jpg']) {
                    try {
                        await fs.access(path.join(dir, `${variant}.${ext}`));
                        found = true;
                        break;
                    } catch {
                        /* noop */
                    }
                }
                out[variant] = found;
            }
            res.json(out);
        } catch {
            res.status(500).json({ error: 'manifest-failed' });
        }
    }
);

function getImmutableAssetContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.js') return 'application/javascript; charset=utf-8';
    if (ext === '.css') return 'text/css; charset=utf-8';
    if (ext === '.json') return 'application/json; charset=utf-8';
    if (ext === '.woff2') return 'font/woff2';
    if (ext === '.woff') return 'font/woff';
    if (ext === '.ttf') return 'font/ttf';
    if (ext === '.svg') return 'image/svg+xml';
    return 'application/octet-stream';
}

function staleBuildReloadModule(requestUrl) {
    const safeUrl = JSON.stringify(String(requestUrl || ''));
    return `
const requestUrl = ${safeUrl};
try {
  const key = 'np_stale_build_reload_at';
  const now = Date.now();
  const last = Number(sessionStorage.getItem(key) || '0');
  if (!last || now - last > 15000) {
    sessionStorage.setItem(key, String(now));
    try {
      if (window.caches && caches.keys) {
        caches.keys().then((keys) => keys.forEach((cacheKey) => caches.delete(cacheKey))).catch(() => {});
      }
    } catch {}
    const url = new URL(location.href);
    url.searchParams.set('np_reload', String(now));
    url.searchParams.set('np_missing_chunk', requestUrl.split('/').pop() || '1');
    location.replace(url.toString());
  }
} catch {
  try { location.reload(); } catch {}
}
export default {};
`;
}

// Old browser sessions may request hashed chunks from the previous add-on build.
// Serve current immutable assets even when HA keeps the ingress prefix in the URL,
// and return a tiny reload module for missing JS chunks instead of a hard 404.
app.get('*', async (req, res, next) => {
    const requestPath = req.path || '';
    const match = requestPath.match(/\/_app\/immutable\/(.+)$/);
    if (!match?.[1]) return next();
    const relativePath = match[1];
    const normalized = path.normalize(relativePath);
    if (path.isAbsolute(normalized) || normalized.startsWith('..') || normalized.includes(`..${path.sep}`)) {
        return next();
    }
    const assetPath = path.join(process.cwd(), 'build', 'client', '_app', 'immutable', normalized);
    try {
        const data = await fs.readFile(assetPath);
        res.setHeader('Content-Type', getImmutableAssetContentType(assetPath));
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        res.status(200).end(data);
        return;
    } catch {
        if (normalized.endsWith('.js')) {
            log(`stale frontend chunk requested: ${req.originalUrl || req.url}`);
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.status(200).send(staleBuildReloadModule(req.originalUrl || req.url));
            return;
        }
        if (normalized.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.status(200).send('/* stale Nova Panel stylesheet ignored */');
            return;
        }
        next();
    }
});

async function attachFrontend(httpServer) {
    if (IS_DEVELOPMENT) {
        const { createServer: createViteServer } = await import('vite');
        const vite = await createViteServer({
            server: {
                middlewareMode: true,
                hmr: {
                    server: httpServer
                }
            }
        });
        app.use(vite.middlewares);
        log('Frontend: Vite middleware');
        return;
    }

    const { handler } = await import('./build/handler.js');
    app.use(handler);
    log('Frontend: SvelteKit build handler');
}

const httpServer = createServer(app);
setupHaWebSocketProxy(httpServer);
await attachFrontend(httpServer);

httpServer.listen(PORT, HOST, () => log(`✅ Listening on ${HOST}:${PORT}`));

process.on('SIGTERM', () => { log('Stopped'); process.exit(0); });
process.on('SIGINT',  () => { log('Stopped'); process.exit(0); });
