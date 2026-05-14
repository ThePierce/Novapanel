import type { LanguageCode } from '$lib/i18n';
import type { CardDraft, PanelConfiguration, PanelDashboard, PanelDashboardLayout, ViewSectionDraft } from '$lib/persistence/panel-state';

type LocalBootstrapInput = {
	selectedLanguage: LanguageCode;
	selectedColumns: 1 | 2 | 3;
	savedViewSections: ViewSectionDraft[];
	savedSidebarCards: CardDraft[];
	loadConfiguration: (defaults: PanelConfiguration) => PanelConfiguration;
	loadDashboard: (defaults: PanelDashboard) => PanelDashboard;
	migrateLegacyPanelState: (defaultConfiguration: PanelConfiguration) => void;
	localizeAndSanitizeSections: (input: unknown) => ViewSectionDraft[];
	sanitizeSidebarCards: (input: unknown) => CardDraft[];
	isRemovedLegacySidebarSeed: (cards: CardDraft[]) => boolean;
	cloneForPersistence: <T>(value: T) => T;
	isValidLanguage: (value: string) => value is LanguageCode;
	/** When true, skip loadDashboard() so we do not flash stale per-origin storage before addon sync. */
	skipDashboardFromStorage?: boolean;
};

export type LocalBootstrapOutput = {
	selectedLanguage: LanguageCode;
	activeCardLibraryTab: 'sidebar' | 'view';
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
	savedCardLibraryTab: 'sidebar' | 'view';
	savedCustomTitles: { cardLibrary?: string; homeviewPreview?: string };
	selectedColumns: 1 | 2 | 3;
	savedViewSections: ViewSectionDraft[];
	savedSidebarCards: CardDraft[];
	savedLayout: PanelDashboardLayout;
	activeViewSectionId: string;
};

export function buildLocalBootstrapState(input: LocalBootstrapInput): LocalBootstrapOutput {
	input.migrateLegacyPanelState({ language: input.selectedLanguage });
	const configuration = input.loadConfiguration({ language: input.selectedLanguage });
	const nextLanguage =
		typeof configuration.language === 'string' && input.isValidLanguage(configuration.language)
			? configuration.language
			: input.selectedLanguage;
	const activeCardLibraryTab = configuration.cardLibraryTab ?? 'sidebar';
	const customTitles = configuration.titles ?? {};
	const oauth = configuration.oauth;
	const mediaHub = configuration.mediaHub;
	const savedCardLibraryTab = activeCardLibraryTab;
	const savedCustomTitles = input.cloneForPersistence(customTitles);
	const dashboard = input.skipDashboardFromStorage
		? {
				layout: {
					columns: input.selectedColumns,
					popupWidth: 850,
					popupHeight: 1140
				},
				viewSections: [],
				sidebarCards: []
			}
		: input.loadDashboard({
				layout: { columns: input.selectedColumns, popupWidth: 850, popupHeight: 1140 },
				viewSections: input.savedViewSections,
				sidebarCards: input.savedSidebarCards
			});
	const savedViewSections = input.localizeAndSanitizeSections(dashboard.viewSections);
	const localSidebar = input.sanitizeSidebarCards(dashboard.sidebarCards);
	const savedSidebarCards = input.isRemovedLegacySidebarSeed(localSidebar) ? [] : localSidebar;
	const savedLayout: PanelDashboardLayout = {
		columns: dashboard.layout.columns,
		popupWidth: dashboard.layout.popupWidth,
		popupHeight: dashboard.layout.popupHeight
	};
	return {
		selectedLanguage: nextLanguage,
		activeCardLibraryTab,
		customTitles,
		oauth,
		mediaHub,
		savedCardLibraryTab,
		savedCustomTitles,
		selectedColumns: dashboard.layout.columns,
		savedViewSections,
		savedSidebarCards,
		savedLayout,
		activeViewSectionId: savedViewSections[0]?.id ?? ''
	};
}
