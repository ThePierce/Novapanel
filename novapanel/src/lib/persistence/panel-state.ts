import { parseJson, readStoredValue, removeStoredValue, writeStoredValue } from './storage';
import {
	coerceCardDraftFromUnknown,
	dashboardScore,
	parseDashboardValue,
	sanitizeLayout,
	withCardType
} from './panel-state-coercion';
import type {
	CardDraft,
	LegacyPanelState,
	PanelConfiguration,
	PanelDashboard,
	PanelDashboardLayout
} from './panel-state-types';

export type { CardDraft, PanelConfiguration, PanelDashboard, PanelDashboardLayout, ViewSectionDraft } from './panel-state-types';

const LEGACY_STATE_KEY = 'np_panel_state_v1';
const CONFIG_KEY = 'np_configuration_v1';
const DASHBOARD_KEY = 'np_dashboard_v1';
const DASHBOARD_BACKUP_KEY = 'np_dashboard_v1_backup';

export function loadConfiguration(defaults: PanelConfiguration): PanelConfiguration {
	if (typeof window === 'undefined') return defaults;
	const parsed = parseJson(readStoredValue(CONFIG_KEY));
	if (!parsed || typeof parsed !== 'object') return defaults;
	const value = parsed as Record<string, unknown>;
	const language = typeof value.language === 'string' ? value.language : defaults.language;
	const cardLibraryTab =
		value.cardLibraryTab === 'sidebar' || value.cardLibraryTab === 'view'
			? value.cardLibraryTab
			: defaults.cardLibraryTab;
	const titlesRaw = value.titles;
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
			: undefined;
	const oauthRaw = value.oauth;
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
	const mediaHubRaw = value.mediaHub;
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
	return { language, cardLibraryTab, titles, oauth, mediaHub };
}

export function saveConfiguration(configuration: PanelConfiguration) {
	if (typeof window === 'undefined') return;
	writeStoredValue(CONFIG_KEY, JSON.stringify(configuration));
}

export function loadDashboard(defaults: PanelDashboard): PanelDashboard {
	if (typeof window === 'undefined') return defaults;
	const parsedPrimary = parseJson(readStoredValue(DASHBOARD_KEY));
	const parsedBackup = parseJson(readStoredValue(DASHBOARD_BACKUP_KEY));
	const parseCandidate = (parsed: unknown): PanelDashboard | null => {
		if (!parsed || typeof parsed !== 'object') return null;
		const value = parsed as {
		layout?: Partial<PanelDashboardLayout>;
		cards?: unknown[];
		viewCards?: unknown[];
		viewSections?: unknown[];
		sidebarCards?: unknown[];
	};
		return parseDashboardValue(value, defaults);
	};
	const primary = parseCandidate(parsedPrimary);
	const backup = parseCandidate(parsedBackup);
	if (primary && backup) {
		return dashboardScore(backup) > dashboardScore(primary) ? backup : primary;
	}
	if (primary) return primary;
	if (backup) return backup;
	return defaults;
}

export function saveDashboard(dashboard: PanelDashboard) {
	if (typeof window === 'undefined') return;
	const serialized = JSON.stringify(dashboard);
	writeStoredValue(DASHBOARD_KEY, serialized);
	writeStoredValue(DASHBOARD_BACKUP_KEY, serialized);
}

/** Drop dashboard/config in storage so bootstrap hydrates from the addon (same-origin stale UI fix). Use once via `?np_resync=1`. */
export function clearPersistedPanelStateForResync() {
	if (typeof window === 'undefined') return;
	removeStoredValue(DASHBOARD_KEY);
	removeStoredValue(DASHBOARD_BACKUP_KEY);
	removeStoredValue(CONFIG_KEY);
	removeStoredValue(LEGACY_STATE_KEY);
	removeStoredValue('np_panel_state_api_preferred');
}

export function migrateLegacyPanelState(defaultConfiguration: PanelConfiguration) {
	if (typeof window === 'undefined') return;
	if (readStoredValue(DASHBOARD_KEY)) return;
	const parsed = parseJson(readStoredValue(LEGACY_STATE_KEY));
	if (!parsed || typeof parsed !== 'object') return;
	const legacy = parsed as LegacyPanelState;
	const dashboard: PanelDashboard = {
		layout: sanitizeLayout(legacy.layout ?? {}, {
			columns: 2,
			popupWidth: 850,
			popupHeight: 1140
		}),
		viewSections: Array.isArray(legacy.cards)
			? [
					{
						id: 'section-1',
						title: 'Section 1',
						icon: 'layout-grid',
						column: 1,
						span: 1,
						order: 0,
						cardColumns: 1,
						cards: legacy.cards
							.map((card, index) => coerceCardDraftFromUnknown(card, index))
							.filter((card): card is CardDraft => card !== null)
							.map(withCardType)
					}
				]
			: [],
		sidebarCards: []
	};
	saveDashboard(dashboard);
	if (!readStoredValue(CONFIG_KEY)) {
		saveConfiguration(defaultConfiguration);
	}
	removeStoredValue(LEGACY_STATE_KEY);
}
