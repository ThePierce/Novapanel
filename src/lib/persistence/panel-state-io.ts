import type { LanguageCode } from '$lib/i18n';
import type { PanelDashboard } from './panel-state-types';
import { parseDashboardValue } from './panel-state-coercion';

export type NovaPanelExportedBundle = {
	npExportVersion: 1;
	exportedAt: string;
	dashboard: PanelDashboard;
	configuration: {
		language: LanguageCode;
		cardLibraryTab: 'sidebar' | 'view';
		titles: { cardLibrary?: string; homeviewPreview?: string };
		oauth?: {
			spotifyClientId?: string;
			spotifyClientSecret?: string;
			spotifyRedirectUri?: string;
			tuneInUserId?: string;
		};
		mediaHub?: {
			onkyoBridges?: Array<{ id: string; label: string; zoneEntityId: string; spotifySource?: string }>;
			playerOrder?: string[];
			playerAliases?: Record<string, string>;
		};
	};
};

export type NovaPanelImportParsed = {
	dashboard: PanelDashboard;
	configuration?: NovaPanelExportedBundle['configuration'];
};

const EMPTY_DASHBOARD: PanelDashboard = {
	layout: { columns: 2, popupWidth: 850, popupHeight: 1140 },
	viewSections: [],
	sidebarCards: []
};

const LANGS = new Set<LanguageCode>(['nl', 'en', 'de', 'fr', 'es']);

function parseConfiguration(raw: unknown): NovaPanelExportedBundle['configuration'] | undefined {
	if (!raw || typeof raw !== 'object') return undefined;
	const c = raw as Record<string, unknown>;
	const language =
		typeof c.language === 'string' && LANGS.has(c.language as LanguageCode)
			? (c.language as LanguageCode)
			: undefined;
	const cardLibraryTab =
		c.cardLibraryTab === 'sidebar' || c.cardLibraryTab === 'view' ? c.cardLibraryTab : undefined;
	const titlesRaw = c.titles;
	const titles =
		titlesRaw && typeof titlesRaw === 'object'
			? {
					cardLibrary:
						typeof (titlesRaw as Record<string, unknown>).cardLibrary === 'string'
							? ((titlesRaw as Record<string, unknown>).cardLibrary as string)
							: undefined,
					homeviewPreview:
						typeof (titlesRaw as Record<string, unknown>).homeviewPreview === 'string'
							? ((titlesRaw as Record<string, unknown>).homeviewPreview as string)
							: undefined
				}
			: {};
	const oauthRaw = c.oauth;
	const oauth =
		oauthRaw && typeof oauthRaw === 'object'
			? (() => {
					const o = oauthRaw as Record<string, unknown>;
					const str = (k: string) => (typeof o[k] === 'string' ? (o[k] as string) : undefined);
					return {
						spotifyClientId: str('spotifyClientId'),
						spotifyClientSecret: str('spotifyClientSecret'),
						spotifyRedirectUri: str('spotifyRedirectUri'),
						tuneInUserId: str('tuneInUserId')
					};
				})()
			: undefined;
	const mediaHubRaw = c.mediaHub;
	const mediaHub =
		mediaHubRaw && typeof mediaHubRaw === 'object'
			? (() => {
					const m = mediaHubRaw as Record<string, unknown>;
					const onkyoBridges = Array.isArray(m.onkyoBridges)
						? (m.onkyoBridges as unknown[])
								.filter((b): b is Record<string, unknown> => Boolean(b) && typeof b === 'object')
								.map((b) => ({
									id: typeof b.id === 'string' ? b.id : '',
									label: typeof b.label === 'string' ? b.label : '',
									zoneEntityId: typeof b.zoneEntityId === 'string' ? b.zoneEntityId : '',
									spotifySource: typeof b.spotifySource === 'string' ? b.spotifySource : undefined
								}))
								.filter((b) => b.id && b.label && b.zoneEntityId)
						: undefined;
					const playerOrder = Array.isArray(m.playerOrder)
						? (m.playerOrder as unknown[]).filter((x): x is string => typeof x === 'string')
						: undefined;
					const playerAliases =
						m.playerAliases && typeof m.playerAliases === 'object'
							? Object.fromEntries(
									Object.entries(m.playerAliases as Record<string, unknown>).filter(
										([, v]) => typeof v === 'string'
									)
								) as Record<string, string>
							: undefined;
					return { onkyoBridges, playerOrder, playerAliases };
				})()
			: undefined;
	if (!language || !cardLibraryTab) return undefined;
	return { language, cardLibraryTab, titles, oauth, mediaHub };
}

/**
 * Accepts our export envelope or a raw addon/server JSON (`{ dashboard?, configuration? }`).
 */
export function parseNovaPanelImportPayload(text: string): NovaPanelImportParsed {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new Error('invalid_json');
	}
	if (!parsed || typeof parsed !== 'object') throw new Error('invalid_shape');
	const root = parsed as Record<string, unknown>;
	const inner =
		root.npExportVersion === 1 && root.dashboard && typeof root.dashboard === 'object'
			? root
			: root;
	const dashUnknown = inner.dashboard;
	if (!dashUnknown || typeof dashUnknown !== 'object') throw new Error('missing_dashboard');
	const dashboard = parseDashboardValue(
		dashUnknown as Parameters<typeof parseDashboardValue>[0],
		EMPTY_DASHBOARD
	);
	const configuration = parseConfiguration(inner.configuration);
	return { dashboard, configuration };
}

export function downloadNovaPanelJson(filename: string, data: unknown) {
	const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = filename;
	a.click();
	URL.revokeObjectURL(a.href);
}
