import type { LanguageCode } from '$lib/i18n';
import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';
import { seedDefaultViewIfEmpty } from '$lib/panel/page-default-view';
import {
	ensurePanelAuthorityReady,
	getPanelStateApiCandidates as getPanelStateApiCandidatesHelper,
	readAddonPanelState as readAddonPanelStateHelper
} from '$lib/panel/page-helpers';
import {
	hydrateFromAddonStateOnlyRuntime,
	retryHydrateAddonUntilVisibleRuntime
} from '$lib/panel/page-runtime';

type CardLibraryTab = 'sidebar' | 'view';

type BootstrapState = {
	selectedColumns: 1 | 2 | 3;
	savedViewSections: ViewSectionDraft[];
	savedSidebarCards: CardDraft[];
	savedLayout: { columns: 1 | 2 | 3; popupWidth: number; popupHeight: number };
	savedUpdatedAt: number;
	activeViewSectionId: string;
	selectedLanguage: LanguageCode;
	activeCardLibraryTab: CardLibraryTab;
	customTitles: { cardLibrary?: string; homeviewPreview?: string };
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
	addonHydrationRetryTimer: ReturnType<typeof setTimeout> | null;
	addonHydrationRetries: number;
};

type CreatePageBootstrapRuntimeParams = {
	browser: boolean;
	panelStateApiPath: string;
	getState: () => BootstrapState;
	setState: (patch: Partial<BootstrapState>) => void;
	localizeAndSanitizeSections: (input: unknown) => ViewSectionDraft[];
	sanitizeSidebarCards: (input: unknown) => CardDraft[];
	isRemovedLegacySidebarSeed: (cards: CardDraft[]) => boolean;
	isValidLanguage: (value: unknown) => value is LanguageCode;
	cloneForPersistence: <T>(value: T) => T;
	saveDashboard: (dashboard: {
		layout: { columns: 1 | 2 | 3; popupWidth: number; popupHeight: number };
		viewSections: ViewSectionDraft[];
		sidebarCards: CardDraft[];
	}) => void;
	persistDashboardState: () => Promise<{ localOk: boolean; addonOk: boolean }>;
	countViewCards: (sections: ViewSectionDraft[]) => number;
};

export function createPageBootstrapRuntime(params: CreatePageBootstrapRuntimeParams) {
	const {
		browser,
		panelStateApiPath,
		getState,
		setState,
		localizeAndSanitizeSections,
		sanitizeSidebarCards,
		isRemovedLegacySidebarSeed,
		isValidLanguage,
		cloneForPersistence,
		saveDashboard,
		persistDashboardState,
		countViewCards
	} = params;

	function getPanelStateApiCandidates(): string[] {
		return getPanelStateApiCandidatesHelper(panelStateApiPath);
	}

	async function readAddonPanelState(): Promise<{
		dashboard?: {
			layout?: { columns?: 1 | 2 | 3; popupWidth?: number; popupHeight?: number };
			viewSections?: unknown;
			sidebarCards?: unknown;
		};
		configuration?: {
			language?: string;
			cardLibraryTab?: CardLibraryTab;
			titles?: { cardLibrary?: string; homeviewPreview?: string };
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
	} | null> {
		await ensurePanelAuthorityReady();
		return (await readAddonPanelStateHelper(getPanelStateApiCandidates())) as {
			dashboard?: {
				layout?: { columns?: 1 | 2 | 3; popupWidth?: number; popupHeight?: number };
				viewSections?: unknown;
				sidebarCards?: unknown;
			};
			configuration?: {
				language?: string;
				cardLibraryTab?: CardLibraryTab;
				titles?: { cardLibrary?: string; homeviewPreview?: string };
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
		} | null;
	}

	async function hydrateFromAddonStateOnly() {
		const state = getState();
		const next = await hydrateFromAddonStateOnlyRuntime({
			readAddonPanelState,
			selectedColumns: state.selectedColumns,
			savedViewSections: state.savedViewSections,
			savedSidebarCards: state.savedSidebarCards,
			currentUpdatedAt: state.savedUpdatedAt,
			selectedLanguage: state.selectedLanguage,
			activeCardLibraryTab: state.activeCardLibraryTab,
			customTitles: state.customTitles,
			oauth: state.oauth,
			mediaHub: state.mediaHub,
			localizeAndSanitizeSections,
			sanitizeSidebarCards,
			isRemovedLegacySidebarSeed,
			isValidLanguage,
			cloneForPersistence,
			saveDashboard
		});
		if (!next) { try { localStorage.setItem('np_diag_hydrate', JSON.stringify({ts: Date.now(), result: 'null'})); } catch {} return; }
		try {
			localStorage.setItem('np_diag_hydrate', JSON.stringify({
				ts: Date.now(),
				sc: next.savedSidebarCards.length,
				vs: next.savedViewSections.length,
				updatedAt: next.savedUpdatedAt,
				debug: next.mergedDebug
			}));
		} catch {}
		setState({
			selectedColumns: next.selectedColumns,
			savedViewSections: next.savedViewSections,
			savedSidebarCards: next.savedSidebarCards,
			savedLayout: next.savedLayout,
			savedUpdatedAt: next.savedUpdatedAt ?? state.savedUpdatedAt,
			activeViewSectionId: next.activeViewSectionId,
			selectedLanguage: next.selectedLanguage,
			activeCardLibraryTab: next.activeCardLibraryTab,
			customTitles: next.customTitles,
			oauth: next.oauth,
			mediaHub: next.mediaHub
		});
	}

	type ImportedAddonPayload = {
		dashboard?: {
			layout?: { columns?: 1 | 2 | 3; popupWidth?: number; popupHeight?: number };
			viewSections?: unknown;
			sidebarCards?: unknown;
			updatedAt?: unknown;
		};
		configuration?: {
			language?: string;
			cardLibraryTab?: CardLibraryTab;
			titles?: { cardLibrary?: string; homeviewPreview?: string };
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

	async function hydrateFromAddonPayload(payload: ImportedAddonPayload) {
		const state = getState();
		const next = await hydrateFromAddonStateOnlyRuntime({
			readAddonPanelState: async () => payload,
			selectedColumns: state.selectedColumns,
			savedViewSections: state.savedViewSections,
			savedSidebarCards: state.savedSidebarCards,
			selectedLanguage: state.selectedLanguage,
			activeCardLibraryTab: state.activeCardLibraryTab,
			customTitles: state.customTitles,
			oauth: state.oauth,
			mediaHub: state.mediaHub,
			localizeAndSanitizeSections,
			sanitizeSidebarCards,
			isRemovedLegacySidebarSeed,
			isValidLanguage,
			cloneForPersistence,
			saveDashboard
		});
		if (!next) return;
		setState({
			selectedColumns: next.selectedColumns,
			savedViewSections: next.savedViewSections,
			savedSidebarCards: next.savedSidebarCards,
			savedLayout: next.savedLayout,
			activeViewSectionId: next.activeViewSectionId,
			selectedLanguage: next.selectedLanguage,
			activeCardLibraryTab: next.activeCardLibraryTab,
			customTitles: next.customTitles,
			oauth: next.oauth,
			mediaHub: next.mediaHub
		});
	}

	function applyDefaultViewIfEmpty() {
		const state = getState();
		const seeded = seedDefaultViewIfEmpty({
			savedViewSections: state.savedViewSections,
			savedSidebarCardsLength: state.savedSidebarCards.length,
			selectedColumns: state.selectedColumns,
			localizeAndSanitizeSections
		});
		if (!seeded) return;
		setState({
			savedViewSections: seeded.savedViewSections,
			activeViewSectionId: seeded.activeViewSectionId,
			savedLayout: seeded.savedLayout
		});
		// NOTE: intentionally NOT calling persistDashboardState() here.
		// We only seed defaults in-memory so the UI has something to show.
		// The actual save only happens when the user explicitly saves via edit mode.
	}

	async function retryHydrateAddonUntilVisible() {
		const state = getState();
		await retryHydrateAddonUntilVisibleRuntime({
			browser,
			hasVisibleViewCards: () => {
				const nextState = getState();
				return nextState.savedViewSections.length > 0 && countViewCards(nextState.savedViewSections) > 0;
			},
			addonReadConfirmed: () => {
				try {
					return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('np_addon_read_ok') === '1';
				} catch {
					return false;
				}
			},
			hydrate: hydrateFromAddonStateOnly,
			currentRetries: state.addonHydrationRetries,
			timer: state.addonHydrationRetryTimer,
			setRetries: (value) => {
				setState({ addonHydrationRetries: value });
			},
			setTimer: (value) => {
				setState({ addonHydrationRetryTimer: value });
			},
			maxRetries: 12,
			baseDelayMs: 200,
			maxDelayMs: 2500
		});
	}

	return {
		getPanelStateApiCandidates,
		readAddonPanelState,
		hydrateFromAddonStateOnly,
		hydrateFromAddonPayload,
		applyDefaultViewIfEmpty,
		retryHydrateAddonUntilVisible
	};
}
