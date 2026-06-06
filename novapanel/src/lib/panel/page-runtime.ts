import type { LanguageCode } from '$lib/i18n';
import type { PanelTheme } from '$lib/panel/theme';
import type { CardDraft, PanelDashboard, ViewSectionDraft } from '$lib/persistence/panel-state';
import { ensurePanelAuthorityReady, type PanelStateWriteAck } from '$lib/panel/page-helpers';
import { mergeAddonDashboardState } from '$lib/panel/page-addon-merge';
import { applyAddonConfigurationState } from '$lib/panel/page-addon-config';
import { buildPersistDraftData, evaluatePersistLocalMetrics } from '$lib/panel/page-persist';
import { resetHydrationRetry, scheduleHydrationRetry } from '$lib/panel/page-hydration-retry';

type OAuthBlock = {
	spotifyClientId?: string;
	spotifyClientSecret?: string;
	spotifyRedirectUri?: string;
	tuneInUserId?: string;
};

type MediaHubBlock = {
	onkyoBridges?: Array<{ id: string; label: string; zoneEntityId: string; spotifySource?: string }>;
	playerOrder?: string[];
	playerAliases?: Record<string, string>;
};

type AddonStatePayload = {
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
		cardLibraryTab?: 'sidebar' | 'view';
		titles?: { cardLibrary?: string; homeviewPreview?: string };
		oauth?: OAuthBlock;
		mediaHub?: MediaHubBlock;
	};
};

export async function persistDashboardStateRuntime(input: {
	browser: boolean;
	selectedColumns: 1 | 2 | 3;
	popupWidth?: number;
	popupHeight?: number;
	savedViewSections: ViewSectionDraft[];
	savedSidebarCards: CardDraft[];
	selectedLanguage: LanguageCode;
	selectedTheme: PanelTheme;
	selectedCurrencyCode?: string;
	activeCardLibraryTab: 'sidebar' | 'view';
	customTitles: { cardLibrary?: string; homeviewPreview?: string };
	oauth?: OAuthBlock;
	mediaHub?: MediaHubBlock;
	cloneForPersistence: <T>(value: T) => T;
	saveDashboard: (dashboard: PanelDashboard) => void;
	loadDashboard: (defaults: PanelDashboard) => PanelDashboard;
	getPanelStateApiCandidates: () => string[];
	writeAddonPanelState: (
		candidates: string[],
		payload: {
			dashboard?: PanelDashboard;
			configuration?: {
				language: string;
				theme: PanelTheme;
				currencyCode: string;
				cardLibraryTab: 'sidebar' | 'view';
				titles: { cardLibrary?: string; homeviewPreview?: string };
				oauth?: OAuthBlock;
				mediaHub?: MediaHubBlock;
			};
		}
	) => Promise<PanelStateWriteAck>;
}) {
	if (!input.browser) return { localOk: false, addonOk: false, candidates: [] as string[] };

	// Build the payload and save to localStorage IMMEDIATELY — never block on network
	const persistData = buildPersistDraftData({
		selectedColumns: input.selectedColumns,
		popupWidth: input.popupWidth,
		popupHeight: input.popupHeight,
		savedViewSections: input.savedViewSections,
		savedSidebarCards: input.savedSidebarCards,
		selectedLanguage: input.selectedLanguage,
		selectedTheme: input.selectedTheme,
		selectedCurrencyCode: input.selectedCurrencyCode,
		activeCardLibraryTab: input.activeCardLibraryTab,
		customTitles: input.customTitles,
		oauth: input.oauth,
		mediaHub: input.mediaHub,
		cloneForPersistence: input.cloneForPersistence
	});
	const { dashboard, configuration } = persistData;
	input.saveDashboard(dashboard);
	const verify = input.loadDashboard({
		layout: { columns: input.selectedColumns, popupWidth: 850, popupHeight: 1140 },
		viewSections: [],
		sidebarCards: []
	});
	const localMetrics = evaluatePersistLocalMetrics(dashboard, verify);

	// Server sync: resolve authority URL then write (non-blocking path for caller)
	await ensurePanelAuthorityReady();
	const candidates = input.getPanelStateApiCandidates();
	const writeAck = await input.writeAddonPanelState(candidates, {
		dashboard,
		configuration
	});
	if (writeAck.ok && typeof writeAck.dashboardUpdatedAt === 'number') {
		input.saveDashboard({
			...dashboard,
			updatedAt: writeAck.dashboardUpdatedAt
		});
	}
	return {
		...localMetrics,
		addonOk: writeAck.ok,
		candidates,
		dashboardUpdatedAt: writeAck.dashboardUpdatedAt,
		configurationUpdatedAt: writeAck.configurationUpdatedAt
	};
}

export async function hydrateFromAddonStateOnlyRuntime(input: {
	readAddonPanelState: () => Promise<AddonStatePayload | null>;
	selectedColumns: 1 | 2 | 3;
	currentPopupWidth?: number;
	currentPopupHeight?: number;
	savedViewSections: ViewSectionDraft[];
	savedSidebarCards: CardDraft[];
	currentUpdatedAt?: number;
	selectedLanguage: LanguageCode;
	selectedTheme: PanelTheme;
	selectedCurrencyCode?: string;
	activeCardLibraryTab: 'sidebar' | 'view';
	customTitles: { cardLibrary?: string; homeviewPreview?: string };
	oauth?: OAuthBlock;
	mediaHub?: MediaHubBlock;
	localizeAndSanitizeSections: (input: unknown) => ViewSectionDraft[];
	sanitizeSidebarCards: (input: unknown) => CardDraft[];
	isRemovedLegacySidebarSeed: (cards: CardDraft[]) => boolean;
	isValidLanguage: (value: string) => value is LanguageCode;
	cloneForPersistence: <T>(value: T) => T;
	saveDashboard: (dashboard: PanelDashboard) => void;
}) {
	const addonState = await input.readAddonPanelState();
	if (!addonState) return null;
	const currentPopupWidth =
		typeof input.currentPopupWidth === 'number' && Number.isFinite(input.currentPopupWidth)
			? input.currentPopupWidth
			: 850;
	const currentPopupHeight =
		typeof input.currentPopupHeight === 'number' && Number.isFinite(input.currentPopupHeight)
			? input.currentPopupHeight
			: 1140;
	let nextSelectedColumns = input.selectedColumns;
	let nextViewSections = input.savedViewSections;
	let nextSidebarCards = input.savedSidebarCards;
	let nextSavedLayout = {
		columns: input.selectedColumns,
		popupWidth: currentPopupWidth,
		popupHeight: currentPopupHeight
	};
	let nextActiveViewSectionId = input.savedViewSections[0]?.id ?? '';
	let nextSavedUpdatedAt = input.currentUpdatedAt;
	let mergedDebug:
		| {
				hasExplicitSections: boolean;
				addonViewSections: number;
				addonViewCards: number;
				addonSidebarCards: number;
				currentSidebarCardsBefore: number;
				serverIsNewer: boolean;
				addonUpdatedAt: number;
				localUpdatedAt: number;
				localHasDashboardContent: boolean;
		  }
		| undefined;

	if (addonState.dashboard) {
		const merged = mergeAddonDashboardState({
			addonDashboard: addonState.dashboard,
			currentColumns: input.selectedColumns,
			currentPopupWidth,
			currentPopupHeight,
			currentViewSections: input.savedViewSections,
			currentSidebarCards: input.savedSidebarCards,
			currentUpdatedAt: input.currentUpdatedAt,
			localizeAndSanitizeSections: input.localizeAndSanitizeSections,
			sanitizeSidebarCards: input.sanitizeSidebarCards,
			isRemovedLegacySidebarSeed: input.isRemovedLegacySidebarSeed
		});
		nextSelectedColumns = merged.layout.columns;
		nextViewSections = merged.viewSections;
		nextSidebarCards = merged.sidebarCards;
		nextSavedLayout = merged.layout;
		nextActiveViewSectionId = merged.activeViewSectionId;
		mergedDebug = merged.debug;
		if (merged.debug.serverIsNewer) {
			nextSavedUpdatedAt = merged.debug.addonUpdatedAt > 0 ? merged.debug.addonUpdatedAt : Date.now();
			input.saveDashboard(
				input.cloneForPersistence<PanelDashboard>({
					layout: nextSavedLayout,
					viewSections: nextViewSections,
					sidebarCards: nextSidebarCards,
					updatedAt: nextSavedUpdatedAt
				})
			);
		}
	}

	let nextSelectedLanguage = input.selectedLanguage;
	let nextSelectedTheme = input.selectedTheme;
	let nextSelectedCurrencyCode = input.selectedCurrencyCode;
	let nextActiveCardLibraryTab = input.activeCardLibraryTab;
	let nextCustomTitles = input.customTitles;
	let nextOauth = input.oauth;
	let nextMediaHub = input.mediaHub;
	if (addonState.configuration) {
		const nextConfig = applyAddonConfigurationState({
			addonConfiguration: addonState.configuration,
			selectedLanguage: input.selectedLanguage,
			selectedTheme: input.selectedTheme,
			selectedCurrencyCode: input.selectedCurrencyCode,
			activeCardLibraryTab: input.activeCardLibraryTab,
			customTitles: input.customTitles,
			oauth: input.oauth,
			mediaHub: input.mediaHub,
			isValidLanguage: input.isValidLanguage
		});
		nextSelectedLanguage = nextConfig.selectedLanguage;
		nextSelectedTheme = nextConfig.selectedTheme;
		nextSelectedCurrencyCode = nextConfig.selectedCurrencyCode;
		nextActiveCardLibraryTab = nextConfig.activeCardLibraryTab;
		nextCustomTitles = nextConfig.customTitles;
		nextOauth = nextConfig.oauth;
		nextMediaHub = nextConfig.mediaHub;
	}

	return {
		addonState,
		mergedDebug,
		selectedColumns: nextSelectedColumns,
		savedViewSections: nextViewSections,
		savedSidebarCards: nextSidebarCards,
		savedLayout: nextSavedLayout,
		savedUpdatedAt: nextSavedUpdatedAt,
		activeViewSectionId: nextActiveViewSectionId,
		selectedLanguage: nextSelectedLanguage,
		selectedTheme: nextSelectedTheme,
		selectedCurrencyCode: nextSelectedCurrencyCode,
		activeCardLibraryTab: nextActiveCardLibraryTab,
		customTitles: nextCustomTitles,
		oauth: nextOauth,
		mediaHub: nextMediaHub
	};
}

export async function retryHydrateAddonUntilVisibleRuntime(input: {
	browser: boolean;
	hasVisibleViewCards: () => boolean;
	/** True once GET /panel-state returned a parsed payload this tab session (see readAddonPanelState). */
	addonReadConfirmed: () => boolean;
	hydrate: () => Promise<void>;
	currentRetries: number;
	timer: ReturnType<typeof setTimeout> | null;
	setRetries: (value: number) => void;
	setTimer: (value: ReturnType<typeof setTimeout> | null) => void;
	maxRetries: number;
	baseDelayMs: number;
	maxDelayMs: number;
}) {
	if (!input.browser) return;
	// Never bail only because localStorage already had cards: first addon GET may fail on slow mobile
	// while stale layout stays visible — keep retrying until the server read succeeds at least once.
	if (input.hasVisibleViewCards() && input.addonReadConfirmed()) {
		const reset = resetHydrationRetry(input.timer);
		input.setRetries(reset.retries);
		input.setTimer(reset.timer);
		return;
	}
	try {
		await input.hydrate();
	} catch {}
	if (input.hasVisibleViewCards() && input.addonReadConfirmed()) {
		const reset = resetHydrationRetry(input.timer);
		input.setRetries(reset.retries);
		input.setTimer(reset.timer);
		return;
	}
	const next = scheduleHydrationRetry({
		currentRetries: input.currentRetries,
		maxRetries: input.maxRetries,
		baseDelayMs: input.baseDelayMs,
		maxDelayMs: input.maxDelayMs,
		timer: input.timer,
		onRetry: () => {
			input.setTimer(null);
			void retryHydrateAddonUntilVisibleRuntime(input);
		}
	});
	input.setRetries(next.retries);
	input.setTimer(next.timer);
}
