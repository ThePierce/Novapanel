import type { CardDraft, PanelDashboardLayout, ViewSectionDraft } from '$lib/persistence/panel-state';
import { countViewCards } from '$lib/panel/page-debug';

type MergeInput = {
	addonDashboard: {
		layout?: { columns?: 1 | 2 | 3; popupWidth?: number; popupHeight?: number };
		viewSections?: unknown;
		sidebarCards?: unknown;
		updatedAt?: unknown;
	};
	currentColumns: 1 | 2 | 3;
	currentPopupWidth: number;
	currentPopupHeight: number;
	currentViewSections: ViewSectionDraft[];
	currentSidebarCards: CardDraft[];
	currentUpdatedAt?: number;
	localizeAndSanitizeSections: (input: unknown) => ViewSectionDraft[];
	sanitizeSidebarCards: (input: unknown) => CardDraft[];
	isRemovedLegacySidebarSeed: (cards: CardDraft[]) => boolean;
};

export type MergeOutput = {
	layout: PanelDashboardLayout;
	viewSections: ViewSectionDraft[];
	sidebarCards: CardDraft[];
	activeViewSectionId: string;
	debug: {
		hasExplicitSections: boolean;
		addonViewSections: number;
		addonViewCards: number;
		addonSidebarCards: number;
		currentSidebarCardsBefore: number;
		serverIsNewer: boolean;
		addonUpdatedAt: number;
		localUpdatedAt: number;
	};
};

export function mergeAddonDashboardState(input: MergeInput): MergeOutput {
	const addonColumns =
		input.addonDashboard.layout?.columns === 1 ||
		input.addonDashboard.layout?.columns === 2 ||
		input.addonDashboard.layout?.columns === 3
			? input.addonDashboard.layout.columns
			: input.currentColumns;
	const addonPopupWidth =
		typeof input.addonDashboard.layout?.popupWidth === 'number' &&
		Number.isFinite(input.addonDashboard.layout.popupWidth)
			? input.addonDashboard.layout.popupWidth
			: input.currentPopupWidth;
	const addonPopupHeight =
		typeof input.addonDashboard.layout?.popupHeight === 'number' &&
		Number.isFinite(input.addonDashboard.layout.popupHeight)
			? input.addonDashboard.layout.popupHeight
			: input.currentPopupHeight;

	const hasExplicitSections = Array.isArray(input.addonDashboard.viewSections);
	const addonSections = input.localizeAndSanitizeSections(input.addonDashboard.viewSections);

	// Only apply server sections/cards if server state is at least as recent as local state.
	// This prevents a stale server (failed writes) from wiping newer local changes.
	const addonUpdatedAt =
		typeof input.addonDashboard.updatedAt === 'number' && Number.isFinite(input.addonDashboard.updatedAt)
			? input.addonDashboard.updatedAt
			: 0;
	const localUpdatedAt =
		typeof input.currentUpdatedAt === 'number' && Number.isFinite(input.currentUpdatedAt)
			? input.currentUpdatedAt
			: 0;
	const serverIsNewer = addonUpdatedAt >= localUpdatedAt;

	let viewSections = input.currentViewSections;
	if (hasExplicitSections && serverIsNewer) {
		viewSections = addonSections;
	}

	const hasExplicitSidebarCards = Array.isArray(input.addonDashboard.sidebarCards);
	const addonSidebarCards = hasExplicitSidebarCards
		? input.sanitizeSidebarCards(input.addonDashboard.sidebarCards)
		: input.currentSidebarCards;
	let sidebarCards = input.currentSidebarCards;
	if (input.isRemovedLegacySidebarSeed(addonSidebarCards)) {
		sidebarCards = [];
	} else if (hasExplicitSidebarCards && serverIsNewer) {
		sidebarCards = addonSidebarCards;
	}

	const layout: PanelDashboardLayout = {
		columns: serverIsNewer ? addonColumns : input.currentColumns,
		popupWidth: serverIsNewer ? addonPopupWidth : input.currentPopupWidth,
		popupHeight: serverIsNewer ? addonPopupHeight : input.currentPopupHeight
	};
	return {
		layout,
		viewSections,
		sidebarCards,
		activeViewSectionId: viewSections[0]?.id ?? '',
		debug: {
			hasExplicitSections,
			addonViewSections: addonSections.length,
			addonViewCards: countViewCards(addonSections),
			addonSidebarCards: addonSidebarCards.length,
			currentSidebarCardsBefore: input.currentSidebarCards.length,
			serverIsNewer,
			addonUpdatedAt,
			localUpdatedAt
		}
	};
}
