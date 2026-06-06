import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';
import { coerceCardDraft } from '$lib/persistence/panel-state-coercion';
import { fetchWithTimeout as fetchWithTimeoutBase } from '$lib/fetch-with-timeout';

export type CardLibraryTab = 'sidebar' | 'view';

type PanelStatePayload = {
	dashboard?: {
		layout?: { columns?: 1 | 2 | 3; popupWidth?: number; popupHeight?: number };
		viewSections?: unknown;
		sidebarCards?: unknown;
		updatedAt?: unknown;
	};
	configuration?: {
		language?: string;
		theme?: string;
		currencyCode?: unknown;
		cardLibraryTab?: CardLibraryTab;
		titles?: { cardLibrary?: string; homeviewPreview?: string };
		updatedAt?: unknown;
	};
};

export type PanelStateWriteAck = {
	ok: boolean;
	dashboardUpdatedAt?: number;
	configurationUpdatedAt?: number;
};

const SYNC_DIAG_READ_KEY = 'np_sync_diag_last_read';
const SYNC_DIAG_WRITE_KEY = 'np_sync_diag_last_write';
const SYNC_DIAG_PROBE_KEY = 'np_sync_diag_probe';
const SYNC_DIAG_VERSION_KEY = 'np_sync_diag_version';
const SYNC_DIAG_VERSION = 'np-syncdiag-2026-05-01T00:35:00Z';

const SESSION_ADDON_READ_OK_KEY = 'np_addon_read_ok';

/** Remember which panel-state URL worked so every device retries it first (ingress vs /local_novapanel). */
const PREFERRED_PANEL_STATE_URL_KEY = 'np_panel_state_api_preferred';

const RESERVED_APP_BASE_SEGMENTS = new Set(['api', '_app', 'favicon.ico', 'hacsfiles', 'energy-asset']);

function getCurrentAppPathBase(
	pathname = typeof window !== 'undefined' ? window.location.pathname || '/' : '/'
): string {
	const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
	const ingressMatch = normalized.match(/^(\/api\/hassio_ingress\/[^/]+)/);
	if (ingressMatch?.[1]) return ingressMatch[1];
	const segments = normalized.split('/').filter(Boolean);
	const firstSegment = segments[0] ?? '';
	if (!firstSegment || RESERVED_APP_BASE_SEGMENTS.has(firstSegment)) return '';
	return `/${firstSegment}`;
}

function loadPreferredPanelStateUrls(): string[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = localStorage.getItem(PREFERRED_PANEL_STATE_URL_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (typeof parsed === 'string' && parsed.trim()) return [parsed.trim()];
		if (
			parsed &&
			typeof parsed === 'object' &&
			'url' in parsed &&
			typeof (parsed as { url: unknown }).url === 'string'
		) {
			const u = (parsed as { url: string }).url.trim();
			return u ? [u] : [];
		}
		return [];
	} catch {
		return [];
	}
}

function rememberPreferredPanelStateUrl(successUrl: string) {
	if (typeof window === 'undefined') return;
	const t = successUrl.trim();
	if (!t) return;
	try {
		const abs = new URL(t, window.location.origin).href;
		localStorage.setItem(PREFERRED_PANEL_STATE_URL_KEY, JSON.stringify({ url: abs, ts: Date.now() }));
	} catch {}
}

function storeSyncDiag(key: string, value: unknown) {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {}
}

if (typeof window !== 'undefined') {
	storeSyncDiag(SYNC_DIAG_VERSION_KEY, {
		version: SYNC_DIAG_VERSION,
		ts: Date.now(),
		pathname: window.location.pathname,
		origin: window.location.origin
	});
	try {
		if (!localStorage.getItem(SYNC_DIAG_READ_KEY)) {
			storeSyncDiag(SYNC_DIAG_READ_KEY, {
				ts: Date.now(),
				status: 'idle',
				note: 'read_not_started_yet'
			});
		}
		if (!localStorage.getItem(SYNC_DIAG_WRITE_KEY)) {
			storeSyncDiag(SYNC_DIAG_WRITE_KEY, {
				ts: Date.now(),
				status: 'idle',
				note: 'write_not_started_yet'
			});
		}
	} catch {}
}

function touchSyncDiagProbe(context: string) {
	if (typeof window === 'undefined') return;
	storeSyncDiag(SYNC_DIAG_PROBE_KEY, {
		ts: Date.now(),
		context,
		pathname: window.location.pathname,
		origin: window.location.origin
	});
}

export function dedupeCards(cards: CardDraft[]): CardDraft[] {
	return cards.filter((card, index, list) => list.findIndex((entry) => entry.id === card.id) === index);
}

export function toCardDraft(value: unknown, index: number): CardDraft | null {
	return coerceCardDraft(value, index);
}

export function sanitizeSidebarCardsInput(input: unknown): CardDraft[] {
	if (!Array.isArray(input)) return [];
	return dedupeCards(
		input.map((card, index) => toCardDraft(card, index)).filter((card): card is CardDraft => card !== null)
	);
}

export function sanitizeViewSectionsInput(
	input: unknown,
	tSection: string,
	normalizeSectionPositions: (sections: ViewSectionDraft[]) => ViewSectionDraft[]
): ViewSectionDraft[] {
	if (!Array.isArray(input)) return [];
	const sections = input
		.filter((entry) => entry && typeof entry === 'object')
		.map((entry, sectionIndex) => {
			const value = entry as Record<string, unknown>;
			const rawCards = Array.isArray(value.cards) ? value.cards : [];
			const cards = dedupeCards(
				rawCards
					.map((card, cardIndex) => toCardDraft(card, cardIndex))
					.filter((card): card is CardDraft => card !== null)
			);
			const rawColumn = Number(value.column);
			const rawOrder = Number(value.order);
			const rawSpan = Number(value.span);
			const section: ViewSectionDraft = {
				id:
					typeof value.id === 'string' && value.id.length > 0
						? value.id
						: `section-${Date.now()}-${sectionIndex}`,
				title: typeof value.title === 'string' ? value.title : `${tSection} ${sectionIndex + 1}`,
				icon:
					typeof value.icon === 'string' && value.icon.trim().length > 0 ? value.icon.trim() : 'layout-grid',
				headerTemperatureEntityId:
					typeof value.headerTemperatureEntityId === 'string' &&
					value.headerTemperatureEntityId.trim().length > 0
						? value.headerTemperatureEntityId.trim()
						: undefined,
				headerHumidityEntityId:
					typeof value.headerHumidityEntityId === 'string' && value.headerHumidityEntityId.trim().length > 0
						? value.headerHumidityEntityId.trim()
						: undefined,
				headerPressureEntityId:
					typeof value.headerPressureEntityId === 'string' && value.headerPressureEntityId.trim().length > 0
						? value.headerPressureEntityId.trim()
						: undefined,
				column: Number.isFinite(rawColumn) ? rawColumn : 1,
				span: Number.isFinite(rawSpan) ? rawSpan : 1,
				order: Number.isFinite(rawOrder) ? rawOrder : sectionIndex,
				cardColumns: value.cardColumns === 2 || Number(value.cardColumns) === 2 ? 2 : 1,
				cards
			};
			return section;
		})
		.filter((section): section is ViewSectionDraft => section !== null);
	return normalizeSectionPositions(sections);
}

export function localizeLegacyTitles(
	sections: ViewSectionDraft[],
	tSection: string,
	tCard: string
): ViewSectionDraft[] {
	const sectionPrefixRegex = /^Section\s+(\d+)$/i;
	const cardPrefixRegex = /^Card\s+(\d+)$/i;
	return sections.map((section) => {
		const sectionTitle = typeof section.title === 'string' ? section.title : '';
		const sectionMatch = sectionTitle.trim().match(sectionPrefixRegex);
		const title = sectionMatch ? `${tSection} ${sectionMatch[1]}` : sectionTitle;
		return {
			...section,
			title,
			cards: section.cards.map((card) => {
				const cardTitle = typeof card.title === 'string' ? card.title : '';
				const cardMatch = cardTitle.trim().match(cardPrefixRegex);
				return cardMatch ? { ...card, title: `${tCard} ${cardMatch[1]}` } : { ...card, title: cardTitle };
			})
		};
	});
}

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 2500) {
	return fetchWithTimeoutBase(input, init, timeoutMs);
}

function withNoCacheParam(url: string): string {
	try {
		const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
		const parsed = new URL(url, base);
		parsed.searchParams.set('np_ts', String(Date.now()));
		return parsed.toString();
	} catch {
		const separator = url.includes('?') ? '&' : '?';
		return `${url}${separator}np_ts=${Date.now()}`;
	}
}

function dedupeUrlOrder(urls: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const u of urls) {
		if (!u || seen.has(u)) continue;
		seen.add(u);
		out.push(u);
	}
	return out;
}

/** Public Nova API origin discovered from the active ingress/local route for panel-state sync. */
let resolvedPanelAuthorityOrigin: string | null | undefined = undefined;
let panelAuthorityResolutionPromise: Promise<void> | null = null;

async function resolvePanelAuthorityOriginInner(): Promise<void> {
	resolvedPanelAuthorityOrigin = null;
	const urls = dedupeUrlOrder(collectPanelStateDiscoveryCandidates('api/panel-sync-config')).slice(0, 14);
	const syncFetchInit: RequestInit = {
		credentials: 'include',
		cache: 'no-store',
		headers: {
			'cache-control': 'no-cache, no-store, must-revalidate',
			pragma: 'no-cache'
		}
	};
	const tryUrl = async (url: string) => {
		try {
			const response = await fetchWithTimeout(withNoCacheParam(url), syncFetchInit, 3500);
			if (!response.ok) return null;
			return ((await response.json()) as { ok?: unknown; authorityBaseUrl?: unknown }) ?? null;
		} catch {
			return null;
		}
	};
	/** Parallel waves avoid sequential multi‑minute waits when ingress/SW misbehaves on early URLs. */
	const WAVE = 5;
	for (let i = 0; i < urls.length; i += WAVE) {
		const chunk = urls.slice(i, i + WAVE);
		const parsed = await Promise.all(chunk.map((u) => tryUrl(u)));
		for (const raw of parsed) {
			if (!raw || raw.ok !== true) continue;
			if (typeof raw.authorityBaseUrl === 'string' && raw.authorityBaseUrl.trim()) {
				try {
					const u = new URL(raw.authorityBaseUrl.trim());
					// Preserve ingress path when present (e.g. /api/hassio_ingress/TOKEN)
					if (u.pathname && u.pathname.length > 1) {
						resolvedPanelAuthorityOrigin = `${u.protocol}//${u.host}${u.pathname}`.replace(/\/+$/, '');
					} else {
						resolvedPanelAuthorityOrigin = `${u.protocol}//${u.host}`;
					}
				} catch {}
			}
			return;
		}
	}
}

/** Resolve once per tab load so candidate URLs can prepend the configured public HA origin. Call before getPanelStateApiCandidates. */
export async function ensurePanelAuthorityReady(): Promise<void> {
	if (typeof window === 'undefined') return;
	if (!panelAuthorityResolutionPromise) {
		panelAuthorityResolutionPromise = resolvePanelAuthorityOriginInner();
	}
	await panelAuthorityResolutionPromise;
}

function buildAuthorityOriginPanelApiUrls(panelStateApiPath: string): string[] {
	if (!resolvedPanelAuthorityOrigin) return [];
	const normalizedApiPath = panelStateApiPath.replace(/^\/+/, '');
	const base = resolvedPanelAuthorityOrigin.replace(/\/+$/, '');
	// Direct path first (works when base already contains ingress path)
	const urls: string[] = [`${base}/${normalizedApiPath}`];
	// Only add /local_novapanel/ variant when the base is a plain origin (no ingress path)
	if (!base.includes('/api/hassio_ingress/')) {
		urls.push(`${base}/local_novapanel/${normalizedApiPath}`);
	}
	return urls;
}

/** Discovery URLs for a panel API path (same-origin), without preferred-memory or authority prepend. */
function collectPanelStateDiscoveryCandidates(panelStateApiPath: string): string[] {
	const origin = window.location.origin;
	const pathname = window.location.pathname || '/';
	const pageDir = pathname.endsWith('/') ? pathname : `${pathname}/`;
	const pathnameBase = pathname.replace(/\/+$/, '');
	const normalizedApiPath = panelStateApiPath.replace(/^\/+/, '');
	const absoluteApiPath = `/${normalizedApiPath}`;
	const currentAppBase = getCurrentAppPathBase(pathname);

	const ingressPath = (window as Window & { __novapanel_ingress?: string }).__novapanel_ingress;
	const normalizedIngress =
		typeof ingressPath === 'string' && ingressPath.length > 0 ? ingressPath.replace(/\/+$/, '') : '';
	let perfIngressBase = '';
	try {
		const perfIngress = performance
			.getEntriesByType('resource')
			.map((entry) => entry.name)
			.find((url) => url.includes('/api/hassio_ingress/'));
		perfIngressBase = perfIngress?.match(/\/api\/hassio_ingress\/[^/]+/)?.[0] ?? '';
	} catch {}

	const ordered: string[] = [];
	const append = (value: string) => {
		if (value) ordered.push(value);
	};

	const appendIngressPairForBase = (ingressBase: string) => {
		const base = ingressBase.replace(/\/+$/, '');
		if (!base) return;
		append(`${origin}${base}/${normalizedApiPath}`);
		append(`${base}/${normalizedApiPath}`);
	};

	const appendCurrentAppBasePair = (appBase: string) => {
		const base = appBase.replace(/\/+$/, '');
		if (!base) return;
		append(`${origin}${base}/${normalizedApiPath}`);
		append(`${base}/${normalizedApiPath}`);
	};

	if (currentAppBase) {
		appendCurrentAppBasePair(currentAppBase);
	}

	// Highest priority: derive ingress base from the loaded module URL itself.
	try {
		const modulePath = new URL(import.meta.url).pathname;
		const moduleIngressBase = modulePath.match(/^(\/api\/hassio_ingress\/[^/]+)/)?.[1] ?? '';
		if (moduleIngressBase) {
			appendIngressPairForBase(moduleIngressBase);
		}
	} catch {}

	if (perfIngressBase) {
		appendIngressPairForBase(perfIngressBase);
	}
	const pathnameIngressMatchEarly = pathname.match(/^(\/api\/hassio_ingress\/[^/]+)/);
	if (pathnameIngressMatchEarly?.[1]) {
		appendIngressPairForBase(pathnameIngressMatchEarly[1]);
	}
	try {
		const base = new URL(document.baseURI);
		const basePath = base.pathname.replace(/\/+$/, '');
		if (basePath.includes('/api/hassio_ingress/')) {
			const m = basePath.match(/^(\/api\/hassio_ingress\/[^/]+)(.*)$/);
			if (m?.[1]) {
				const under = m[2] && m[2].length > 0 ? m[2] : '';
				if (under) {
					const pathWith = `${m[1]}${under}`.replace(/\/+$/, '');
					append(`${base.origin}${pathWith}/${panelStateApiPath}`);
				}
				appendIngressPairForBase(m[1]);
			}
		}
	} catch {}
	if (normalizedIngress) {
		appendIngressPairForBase(normalizedIngress);
	}

	// Onder HA Ingress is /api/panel-state zonder prefix nooit valide (HA proxiet 404).
	// Sla die fallbacks alleen aan voor non-ingress setups (lokale dev / direct-LAN).
	const runningUnderIngress = Boolean(
		normalizedIngress || perfIngressBase || pathnameIngressMatchEarly || currentAppBase
	);
	if (!runningUnderIngress) {
		append(`${origin}/local_novapanel/${normalizedApiPath}`);
		append(`/local_novapanel/${normalizedApiPath}`);
		append(`${origin}${absoluteApiPath}`);
		append(absoluteApiPath);
	}
	try {
		const parentOrigin = window.parent?.location?.origin;
		if (parentOrigin && currentAppBase) {
			append(`${parentOrigin}${currentAppBase}/${normalizedApiPath}`);
		}
		if (parentOrigin && !runningUnderIngress) {
			append(`${parentOrigin}${absoluteApiPath}`);
			append(`${parentOrigin}/local_novapanel/${normalizedApiPath}`);
		}
	} catch {}
	try {
		const topOrigin = window.top?.location?.origin;
		if (topOrigin && currentAppBase) {
			append(`${topOrigin}${currentAppBase}/${normalizedApiPath}`);
		}
		if (topOrigin && !runningUnderIngress) {
			append(`${topOrigin}${absoluteApiPath}`);
			append(`${topOrigin}/local_novapanel/${normalizedApiPath}`);
		}
	} catch {}

	append(new URL(panelStateApiPath, `${origin}${pageDir}`).toString());
	if (pathnameBase.length > 0) {
		append(`${pathnameBase}/${panelStateApiPath}`);
		append(`${origin}${pathnameBase}/${panelStateApiPath}`);
	}
	try {
		const parentOrigin = window.parent?.location?.origin;
		if (parentOrigin && normalizedIngress) {
			append(`${parentOrigin}${normalizedIngress}/${normalizedApiPath}`);
		}
	} catch {}
	return ordered;
}

export function getPanelStateApiCandidates(panelStateApiPath: string): string[] {
	if (typeof window === 'undefined') return [];
	touchSyncDiagProbe('getPanelStateApiCandidates');
	const ordered = collectPanelStateDiscoveryCandidates(panelStateApiPath);
	return dedupeUrlOrder([
		...buildAuthorityOriginPanelApiUrls(panelStateApiPath),
		...ordered,
		...loadPreferredPanelStateUrls()
	]);
}

function normalizePanelStateCandidateUrl(url: string): string {
	if (typeof window === 'undefined') return url;
	try {
		const u = new URL(url, window.location.origin);
		u.hash = '';
		return u.href;
	} catch {
		return url;
	}
}

export async function readAddonPanelState(candidates: string[]): Promise<PanelStatePayload | null> {
	if (typeof window === 'undefined') return null;
	touchSyncDiagProbe('readAddonPanelState');
	// Parallel GETs: sequential tries stacked ~8s each on slow networks and never finished on mobile.
	const readTimeoutMs = 9000;
	let uniqueCandidates: string[] = [];
	let fatalError: string | undefined;
	let bestPayload: PanelStatePayload | null = null;
	let bestScore = -1;
	let bestUpdatedAt = -1;
	let bestUrl = '';
	const attempts: Array<{
		url: string;
		ok: boolean;
		score?: number;
		updatedAt?: number;
		note?: string;
	}> = [];
	const scorePayload = (payload: PanelStatePayload): number => {
		const sections = Array.isArray(payload.dashboard?.viewSections) ? payload.dashboard?.viewSections : [];
		const sidebar = Array.isArray(payload.dashboard?.sidebarCards) ? payload.dashboard?.sidebarCards : [];
		let viewCards = 0;
		for (const section of sections) {
			if (!section || typeof section !== 'object') continue;
			const cards = (section as Record<string, unknown>).cards;
			if (Array.isArray(cards)) viewCards += cards.length;
		}
		const hasConfig = payload.configuration ? 1 : 0;
		return viewCards + sidebar.length + hasConfig;
	};
	const getUpdatedAt = (payload: PanelStatePayload): number =>
		typeof payload.dashboard?.updatedAt === 'number' && Number.isFinite(payload.dashboard.updatedAt)
			? payload.dashboard.updatedAt
			: -1;

	const fetchInit: RequestInit = {
		credentials: 'include',
		cache: 'no-store',
		headers: {
			'cache-control': 'no-cache, no-store, must-revalidate',
			pragma: 'no-cache'
		}
	};

	type TryRow =
		| { url: string; ok: false; note: string }
		| { url: string; ok: true; score: number; updatedAt: number; payload: PanelStatePayload };

	const parsePanelStateResponse = async (response: Response, url: string): Promise<TryRow> => {
		if (!response.ok) {
			return { url, ok: false, note: `http_${response.status}` };
		}
		const novapanelHeader = response.headers.get('x-novapanel-state');
		const payload = (await response.json()) as unknown;
		if (!payload || typeof payload !== 'object') {
			return { url, ok: false, note: 'invalid_payload' };
		}
		const p = payload as Record<string, unknown>;
		const hasNovaPanelHeader = novapanelHeader === '1';
		const hasExpectedStructure = 'dashboard' in p || 'configuration' in p;
		if (!hasNovaPanelHeader && !hasExpectedStructure) {
			return { url, ok: false, note: 'unexpected_shape' };
		}
		// Count keys ignoring the internal _np_api_base hint field
		const relevantKeys = Object.keys(p).filter((k) => k !== '_np_api_base');
		if (relevantKeys.length === 0) {
			return { url, ok: false, note: 'empty_payload' };
		}
		const typedPayload = payload as PanelStatePayload;
		const score = scorePayload(typedPayload);
		const updatedAt = getUpdatedAt(typedPayload);
		return { url, ok: true, score, updatedAt, payload: typedPayload };
	};

	const toReadPostUrl = (url: string): string => {
		const replaced = url.replace(/\/panel-state(?=\/?$|\?)/, '/panel-state/read');
		return replaced;
	};

	async function tryOne(url: string): Promise<TryRow> {
		try {
			const requestUrl = withNoCacheParam(url);
			const response = await fetchWithTimeout(requestUrl, fetchInit, readTimeoutMs);
			return await parsePanelStateResponse(response, url);
		} catch {
			return { url, ok: false, note: 'exception' };
		}
	}

	async function tryOneReadPost(url: string): Promise<TryRow> {
		const readPostUrl = toReadPostUrl(url);
		try {
			const requestUrl = withNoCacheParam(readPostUrl);
			const response = await fetchWithTimeout(
				requestUrl,
				{
					method: 'POST',
					credentials: 'include',
					cache: 'no-store',
					headers: {
						'content-type': 'application/json',
						'cache-control': 'no-cache, no-store, must-revalidate',
						pragma: 'no-cache'
					},
					body: '{}'
				},
				readTimeoutMs
			);
			return await parsePanelStateResponse(response, readPostUrl);
		} catch {
			return { url: readPostUrl, ok: false, note: 'exception' };
		}
	}

	try {
		uniqueCandidates = dedupeUrlOrder(candidates.map((c) => normalizePanelStateCandidateUrl(c)));

		/** Few parallel sockets avoids addons/nginx rejecting thundering herds; still faster than fully sequential. */
		const READ_PARALLEL_BATCH = 5;
		const rows: TryRow[] = [];
		for (let offset = 0; offset < uniqueCandidates.length; offset += READ_PARALLEL_BATCH) {
			const slice = uniqueCandidates.slice(offset, offset + READ_PARALLEL_BATCH);
			const batch = await Promise.all(slice.map((url) => tryOne(url)));
			for (const r of batch) rows.push(r);
			if (batch.some((row) => row.ok)) break;
		}
		for (const row of rows) {
			if (!row.ok) {
				attempts.push({ url: row.url, ok: false, note: row.note });
				continue;
			}
			attempts.push({ url: row.url, ok: true, score: row.score, updatedAt: row.updatedAt });
			const { updatedAt, score, payload: typedPayload, url } = row;
			if (updatedAt > bestUpdatedAt || (updatedAt === bestUpdatedAt && score > bestScore)) {
				bestUpdatedAt = updatedAt;
				bestScore = score;
				bestPayload = typedPayload;
				bestUrl = url;
			}
		}
		if (bestPayload === null) {
			const fallbackRows: TryRow[] = [];
			for (let offset = 0; offset < uniqueCandidates.length; offset += READ_PARALLEL_BATCH) {
				const slice = uniqueCandidates.slice(offset, offset + READ_PARALLEL_BATCH);
				const batch = await Promise.all(slice.map((url) => tryOneReadPost(url)));
				for (const r of batch) fallbackRows.push(r);
				if (batch.some((row) => row.ok)) break;
			}
			for (const row of fallbackRows) {
				if (!row.ok) {
					attempts.push({ url: row.url, ok: false, note: `fallback_${row.note}` });
					continue;
				}
				attempts.push({
					url: row.url,
					ok: true,
					score: row.score,
					updatedAt: row.updatedAt,
					note: 'fallback_post_read'
				});
				const { updatedAt, score, payload: typedPayload, url } = row;
				if (updatedAt > bestUpdatedAt || (updatedAt === bestUpdatedAt && score > bestScore)) {
					bestUpdatedAt = updatedAt;
					bestScore = score;
					bestPayload = typedPayload;
					bestUrl = url;
				}
			}
		}
	} catch (e) {
		fatalError = e instanceof Error ? e.message : String(e);
	} finally {
		let diagPayload: Record<string, unknown> = {
			ts: Date.now(),
			chosenUrl: bestUrl || null,
			chosenUpdatedAt: bestUpdatedAt,
			chosenScore: bestScore,
			attempts,
			candidateCount: uniqueCandidates.length,
			fatalError: fatalError ?? null
		};
		try {
			diagPayload = JSON.parse(JSON.stringify(diagPayload)) as Record<string, unknown>;
		} catch {
			diagPayload = {
				ts: Date.now(),
				chosenUrl: null,
				chosenUpdatedAt: -1,
				chosenScore: -1,
				attempts: [],
				candidateCount: uniqueCandidates.length,
				fatalError: 'diag_json_roundtrip_failed',
				originalFatalError: fatalError ?? null
			};
		}
		storeSyncDiag(SYNC_DIAG_READ_KEY, diagPayload);
		try {
			if (typeof sessionStorage !== 'undefined') {
				if (bestPayload !== null) sessionStorage.setItem(SESSION_ADDON_READ_OK_KEY, '1');
				else sessionStorage.removeItem(SESSION_ADDON_READ_OK_KEY);
			}
		} catch {}
		if (bestUrl) rememberPreferredPanelStateUrl(bestUrl);
	}
	return bestPayload;
}

export async function writeAddonPanelState(
	candidates: string[],
	payload: {
		dashboard?: {
			layout: { columns: 1 | 2 | 3; popupWidth: number; popupHeight: number };
			viewSections: ViewSectionDraft[];
			sidebarCards: CardDraft[];
			updatedAt?: number;
		};
		configuration?: {
			language: string;
			theme?: string;
			currencyCode?: string;
			cardLibraryTab?: CardLibraryTab;
			titles?: { cardLibrary?: string; homeviewPreview?: string };
			oauth?: unknown;
			mediaHub?: unknown;
			updatedAt?: number;
		};
	}
): Promise<PanelStateWriteAck> {
	if (typeof window === 'undefined') return { ok: false };
	await ensurePanelAuthorityReady();
	touchSyncDiagProbe('writeAddonPanelState');
	const writeTimeoutMs = 8000;
	const body = JSON.stringify(payload);
	let writeAck: PanelStateWriteAck = { ok: false };
	const attempts: Array<{ url: string; ok: boolean; note?: string }> = [];
	for (let round = 0; round < 2; round += 1) {
		if (round > 0) {
			await new Promise((resolve) => setTimeout(resolve, 300));
		}
		try {
			for (const url of candidates) {
				try {
					const requestUrl = withNoCacheParam(url);
					const response = await fetchWithTimeout(
						requestUrl,
						{
							method: 'POST',
							headers: {
								'content-type': 'application/json',
								'cache-control': 'no-cache, no-store, must-revalidate',
								pragma: 'no-cache'
							},
							credentials: 'include',
							body
						},
						writeTimeoutMs
					);
					if (!response.ok) {
						attempts.push({ url, ok: false, note: `http_${response.status}` });
						continue;
					}
					const headerOk = response.headers.get('x-novapanel-state') === '1';
					let bodyOk = false;
					let ack: PanelStateWriteAck = { ok: false };
					try {
						ack = (await response.json()) as PanelStateWriteAck;
						bodyOk = ack?.ok === true;
					} catch {
						bodyOk = false;
					}
					if (bodyOk || headerOk) {
						writeAck = bodyOk ? ack : { ok: true };
						attempts.push({ url, ok: true });
						rememberPreferredPanelStateUrl(url);
						break;
					} else {
						attempts.push({ url, ok: false, note: 'ack_failed' });
					}
				} catch {
					attempts.push({ url, ok: false, note: 'exception' });
					continue;
				}
			}
		} catch {}
		if (writeAck.ok) {
			storeSyncDiag(SYNC_DIAG_WRITE_KEY, {
				ts: Date.now(),
				wroteAny: true,
				attempts
			});
			return writeAck;
		}
	}
	storeSyncDiag(SYNC_DIAG_WRITE_KEY, {
		ts: Date.now(),
		wroteAny: writeAck.ok,
		attempts
	});
	return writeAck;
}

export function isRemovedLegacySidebarSeed(cards: CardDraft[]) {
	return (
		cards.length === 3 &&
		cards[0]?.id === 'sidebar-1' &&
		cards[1]?.id === 'sidebar-2' &&
		cards[2]?.id === 'sidebar-3'
	);
}
