import { getEntityNameOverride } from './entity-name-overrides';

export type HassConnection = {
	subscribeMessage?: (
		callback: (message: unknown) => void,
		params: Record<string, unknown>
	) => Promise<() => void>;
	subscribeEvents?: (
		callback: (message: unknown) => void,
		eventType?: string
	) => Promise<() => void>;
	sendMessage?: (params: Record<string, unknown>) => void;
	sendMessagePromise?: (params: Record<string, unknown>) => Promise<unknown>;
	connected?: boolean;
};

export type HassLike = {
	states?: Record<string, Record<string, unknown>>;
	connection?: HassConnection;
	callWS?: (params: Record<string, unknown>) => Promise<unknown>;
};

export type HaConnectionConfig = {
	hassUrl: string;
	token: string;
};

type NovaWindow = Window & {
	__novapanel_ingress?: string;
};

const RESERVED_NOVA_BASE_SEGMENTS = new Set(['api', '_app', 'favicon.ico', 'hacsfiles', 'energy-asset']);

function getCurrentNovaAppBase(pathname = typeof window !== 'undefined' ? window.location.pathname || '/' : '/'): string {
	const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
	const ingressMatch = normalized.match(/^(\/api\/hassio_ingress\/[^/]+)/);
	if (ingressMatch?.[1]) return ingressMatch[1];
	const firstSegment = normalized.split('/').filter(Boolean)[0] ?? '';
	if (!firstSegment || RESERVED_NOVA_BASE_SEGMENTS.has(firstSegment)) return '';
	return `/${firstSegment}`;
}

export type HomeAssistantEntity = {
	entityId: string;
	friendlyName: string;
	domain: string;
	state: string;
	unit: string;
	icon: string;
	deviceClass: string;
	attributes: Record<string, unknown>;
};

function findHassInRoot(root: ParentNode | ShadowRoot): HassLike | null {
	const direct = root.querySelector('home-assistant') as { hass?: unknown } | null;
	if (direct?.hass) return direct.hass as HassLike;
	const nodes = root.querySelectorAll('*');
	for (const node of nodes) {
		const shadow = (node as HTMLElement).shadowRoot;
		if (!shadow) continue;
		const nested = findHassInRoot(shadow);
		if (nested) return nested;
	}
	return null;
}

function getParentHass(): HassLike | null {
	try {
		const documents: Document[] = [];
		if (window.document) documents.push(window.document);
		try {
			if (window.parent?.document && window.parent.document !== window.document) {
				documents.push(window.parent.document);
			}
		} catch {}
		try {
			if (
				window.top?.document &&
				window.top.document !== window.document &&
				window.top.document !== window.parent?.document
			) {
				documents.push(window.top.document);
			}
		} catch {}
		for (const doc of documents) {
			const hass = findHassInRoot(doc);
			if (hass) return hass;
		}
		return null;
	} catch {
		return null;
	}
}

function wait(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getHassWithRetry(attempts = 8, delayMs = 500): Promise<HassLike | null> {
	for (let index = 0; index < attempts; index += 1) {
		const hass = getParentHass();
		if (hass) return hass;
		await wait(delayMs);
	}
	return null;
}

function toWebsocketUrl(baseUrl: string): string {
	const normalized = baseUrl.trim().replace(/\/+$/, '');
	if (normalized.startsWith('ws://') || normalized.startsWith('wss://')) {
		return `${normalized}/api/websocket`;
	}
	if (normalized.startsWith('https://')) {
		return `wss://${normalized.slice(8)}/api/websocket`;
	}
	if (normalized.startsWith('http://')) {
		return `ws://${normalized.slice(7)}/api/websocket`;
	}
	return `ws://${normalized}/api/websocket`;
}

export function getSocketCandidates(hassUrl: string): string[] {
	const candidates = new Set<string>();
	for (const candidate of getNovaWebSocketCandidates('/api/ha/websocket')) {
		candidates.add(candidate);
	}
	const add = (value: string) => {
		const socketUrl = toWebsocketUrl(value);
		if (socketUrl) candidates.add(socketUrl);
	};
	add(hassUrl);
	try {
		if (window.location?.origin) add(window.location.origin);
	} catch {}
	const isHttpsPage = window.location.protocol === 'https:';
	if (!isHttpsPage) return [...candidates];
	return [...candidates].filter((url) => url.startsWith('wss://'));
}

export function getNovaApiCandidates(apiPath: string): string[] {
	const endpoint = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
	const candidates = new Set<string>();
	const pathname = window.location.pathname || '/';
	const currentBase = getCurrentNovaAppBase(pathname);
	if (currentBase) candidates.add(`${currentBase}${endpoint}`);
	const ingressPath = (window as NovaWindow).__novapanel_ingress?.trim() ?? '';
	if (ingressPath) candidates.add(`${ingressPath}${endpoint}`);
	try {
		const perfIngress = performance
			.getEntriesByType('resource')
			.map((entry) => entry.name)
			.find((url) => url.includes('/api/hassio_ingress/'));
		const perfIngressBase = perfIngress?.match(/\/api\/hassio_ingress\/[^/]+/)?.[0] ?? '';
		if (perfIngressBase) candidates.add(`${perfIngressBase}${endpoint}`);
	} catch {}
	try {
		const base = new URL(document.baseURI);
		const basePath = base.pathname.replace(/\/+$/, '');
		const documentBase = getCurrentNovaAppBase(basePath);
		if (documentBase) candidates.add(`${documentBase}${endpoint}`);
		if (basePath.includes('/api/hassio_ingress/')) {
			const ingressBase = basePath.match(/^\/api\/hassio_ingress\/[^/]+/)?.[0] ?? '';
			if (ingressBase) candidates.add(`${ingressBase}${endpoint}`);
		}
		if (basePath.includes('/local_novapanel')) {
			const localBase = basePath.match(/^\/local_novapanel/)?.[0] ?? '';
			if (localBase) candidates.add(`${localBase}${endpoint}`);
		}
	} catch {}
	const ingressMatch = pathname.match(/^\/api\/hassio_ingress\/[^/]+/);
	if (ingressMatch?.[0]) candidates.add(`${ingressMatch[0]}${endpoint}`);
	candidates.add(endpoint);
	candidates.add(`/local_novapanel${endpoint}`);
	return [...candidates];
}

export function getNovaWebSocketCandidates(apiPath: string): string[] {
	const origin = window.location.origin || '';
	return getNovaApiCandidates(apiPath)
		.map((candidate) => {
			try {
				const url = new URL(candidate, origin);
				url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
				return url.href;
			} catch {
				return '';
			}
		})
		.filter((url): url is string => url.length > 0);
}

export async function getHaConnectionConfig(): Promise<HaConnectionConfig | null> {
	for (const candidate of getNovaApiCandidates('/api/ha/connection')) {
		try {
			const response = await fetch(candidate, {
				credentials: 'same-origin',
				cache: 'no-store'
			});
			if (!response.ok) continue;
			const contentType = response.headers.get('content-type') || '';
			if (!contentType.includes('application/json')) continue;
			const payload = (await response.json()) as { hassUrl?: string; token?: string };
			let hassUrl = typeof payload.hassUrl === 'string' ? payload.hassUrl.trim() : '';
			const token = typeof payload.token === 'string' ? payload.token.trim() : '';
			if (!hassUrl || !token) continue;
			try {
				const parentOrigin =
					window.parent?.location?.origin && window.parent.location.origin !== window.location.origin
						? window.parent.location.origin
						: '';
				const hassLooksLikeIngress =
					hassUrl.includes('/api/hassio_ingress/') || hassUrl.includes('/local_novapanel');
				const hassLooksLikeAddonOrigin = hassUrl === window.location.origin;
				if (parentOrigin && (hassLooksLikeIngress || hassLooksLikeAddonOrigin)) {
					hassUrl = parentOrigin;
				}
			} catch {}
			return { hassUrl, token };
		} catch {}
	}
	return null;
}

function normalizeEntity(entityId: string, value: Record<string, unknown>): HomeAssistantEntity {
	const attributes = (value.attributes ?? {}) as Record<string, unknown>;
	const domain = entityId.includes('.') ? entityId.split('.')[0] : 'unknown';
	const friendlyName =
		typeof attributes.friendly_name === 'string' && attributes.friendly_name.length > 0
			? attributes.friendly_name
			: entityId;
	const overrideName = getEntityNameOverride(entityId);
	return {
		entityId,
		friendlyName: overrideName && overrideName.length > 0 ? overrideName : friendlyName,
		domain,
		state: typeof value.state === 'string' ? value.state : '',
		unit: typeof attributes.unit_of_measurement === 'string' ? attributes.unit_of_measurement : '',
		icon: typeof attributes.icon === 'string' ? attributes.icon : '',
		deviceClass:
			typeof attributes.device_class === 'string' && attributes.device_class.length > 0
				? attributes.device_class
				: '',
		attributes
	};
}

export function normalizeStates(states: Record<string, Record<string, unknown>>): HomeAssistantEntity[] {
	return Object.entries(states)
		.map(([entityId, state]) => normalizeEntity(entityId, state))
		.sort((a, b) => a.friendlyName.localeCompare(b.friendlyName));
}
