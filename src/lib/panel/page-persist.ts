import type { LanguageCode } from '$lib/i18n';
import type { CardDraft, PanelDashboard, ViewSectionDraft } from '$lib/persistence/panel-state';
import { countViewCards } from '$lib/panel/page-debug';

export type OAuthState = {
	spotifyClientId?: string;
	spotifyClientSecret?: string;
	spotifyRedirectUri?: string;
	tuneInUserId?: string;
};

export type MediaHubState = {
	onkyoBridges?: Array<{ id: string; label: string; zoneEntityId: string; spotifySource?: string }>;
	playerOrder?: string[];
	playerAliases?: Record<string, string>;
};

export type PersistDraftInput = {
	selectedColumns: 1 | 2 | 3;
	popupWidth?: number;
	popupHeight?: number;
	savedViewSections: ViewSectionDraft[];
	savedSidebarCards: CardDraft[];
	selectedLanguage: LanguageCode;
	activeCardLibraryTab: 'sidebar' | 'view';
	customTitles: { cardLibrary?: string; homeviewPreview?: string };
	oauth?: OAuthState;
	mediaHub?: MediaHubState;
	cloneForPersistence: <T>(value: T) => T;
};

export type PersistDraftData = {
	dashboard: PanelDashboard;
	configuration: {
		language: LanguageCode;
		cardLibraryTab: 'sidebar' | 'view';
		titles: { cardLibrary?: string; homeviewPreview?: string };
		oauth?: OAuthState;
		mediaHub?: MediaHubState;
	};
};

export function buildPersistDraftData(input: PersistDraftInput): PersistDraftData {
	const popupWidth = input.popupWidth ?? 760;
	const popupHeight = input.popupHeight ?? 560;
	const dashboard = input.cloneForPersistence<PanelDashboard>({
		layout: {
			columns: input.selectedColumns,
			popupWidth,
			popupHeight
		},
		viewSections: input.savedViewSections,
		sidebarCards: input.savedSidebarCards,
		updatedAt: Date.now()
	});
	const configuration = input.cloneForPersistence({
		language: input.selectedLanguage,
		cardLibraryTab: input.activeCardLibraryTab,
		titles: input.customTitles,
		oauth: input.oauth,
		mediaHub: input.mediaHub
	});
	return { dashboard, configuration };
}

export type PersistLocalMetrics = {
	expectedViewCards: number;
	actualViewCards: number;
	expectedSidebarCards: number;
	actualSidebarCards: number;
	localOk: boolean;
};

export function evaluatePersistLocalMetrics(dashboard: PanelDashboard, verify: PanelDashboard): PersistLocalMetrics {
	const expectedViewCards = countViewCards(dashboard.viewSections);
	const actualViewCards = countViewCards(verify.viewSections);
	const expectedSidebarCards = dashboard.sidebarCards.length;
	const actualSidebarCards = verify.sidebarCards.length;
	const localOk = actualViewCards >= expectedViewCards && actualSidebarCards >= expectedSidebarCards;
	return {
		expectedViewCards,
		actualViewCards,
		expectedSidebarCards,
		actualSidebarCards,
		localOk
	};
}
