import { createEditHistory, redoEditStep, undoEditStep, type EditHistoryState } from '$lib/edit-mode/history';
import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';

type PanelDraftSnapshot = { viewSections: ViewSectionDraft[]; sidebarCards: CardDraft[] };

type EditSessionState = {
	panelBootstrap: Promise<void> | null;
	panelDraftHistory: EditHistoryState<PanelDraftSnapshot>;
	savedViewSections: ViewSectionDraft[];
	savedSidebarCards: CardDraft[];
	savedLayout: { columns: 1 | 2 | 3; popupWidth: number; popupHeight: number };
	selectedColumns: 1 | 2 | 3;
	savedCardLibraryTab: 'sidebar' | 'view';
	activeCardLibraryTab: 'sidebar' | 'view';
	savedCustomTitles: { cardLibrary?: string; homeviewPreview?: string };
	customTitles: { cardLibrary?: string; homeviewPreview?: string };
	cardLibraryOpen: boolean;
	sectionEditorOpen: boolean;
	cardEditorOpen: boolean;
	editMode: boolean;
};

type CreatePageEditSessionRuntimeParams = {
	getState: () => EditSessionState;
	setState: (patch: Partial<EditSessionState>) => void;
	sanitizeViewSections: (sections: unknown) => ViewSectionDraft[];
	sanitizeSidebarCards: (cards: unknown) => CardDraft[];
	cloneForPersistence: <T>(value: T) => T;
	persistDashboardState: () => Promise<{ localOk: boolean; addonOk: boolean }>;
	countViewCards: (sections: ViewSectionDraft[]) => number;
	debugLog: (event: string, payload: Record<string, unknown>) => void;
};

export function createPageEditSessionRuntime(params: CreatePageEditSessionRuntimeParams) {
	const {
		getState,
		setState,
		sanitizeViewSections,
		sanitizeSidebarCards,
		cloneForPersistence,
		persistDashboardState,
		countViewCards,
		debugLog
	} = params;

	function enterEditMode() {
		const state = getState();
		setState({
			panelDraftHistory: createEditHistory({
				viewSections: sanitizeViewSections(state.savedViewSections),
				sidebarCards: sanitizeSidebarCards(state.savedSidebarCards)
			}),
			editMode: true
		});
	}

	async function saveDraftAndExit() {
		const state = getState();
		const nextSavedViewSections = sanitizeViewSections(state.panelDraftHistory.present.viewSections);
		const nextSavedSidebarCards = sanitizeSidebarCards(state.panelDraftHistory.present.sidebarCards);
		setState({
			savedViewSections: nextSavedViewSections,
			savedSidebarCards: nextSavedSidebarCards,
			savedLayout: {
				columns: state.selectedColumns,
				popupWidth: 850,
				popupHeight: 1140
			},
			savedCardLibraryTab: state.activeCardLibraryTab,
			savedCustomTitles: cloneForPersistence(state.customTitles)
		});
		const persisted = await persistDashboardState();
		if (!persisted.localOk) {
			debugLog('save_draft_blocked_local_verify_failed', {
				viewSections: nextSavedViewSections.length,
				viewCards: countViewCards(nextSavedViewSections),
				sidebarCards: nextSavedSidebarCards.length
			});
			return;
		}
		if (!persisted.addonOk) {
			// Server write failed but local save succeeded — still exit edit mode.
			// The periodic retry will sync to the server in the background.
			debugLog('save_draft_addon_sync_failed_but_local_ok', {
				viewSections: nextSavedViewSections.length,
				viewCards: countViewCards(nextSavedViewSections),
				sidebarCards: nextSavedSidebarCards.length
			});
		}
		setState({ cardLibraryOpen: false, sectionEditorOpen: false, cardEditorOpen: false, editMode: false });
	}

	function cancelDraftAndExit() {
		const state = getState();
		setState({
			panelDraftHistory: createEditHistory({
				viewSections: state.savedViewSections,
				sidebarCards: state.savedSidebarCards
			}),
			selectedColumns: state.savedLayout.columns,
			activeCardLibraryTab: state.savedCardLibraryTab,
			customTitles: JSON.parse(JSON.stringify(state.savedCustomTitles)) as {
				cardLibrary?: string;
				homeviewPreview?: string;
			},
			cardLibraryOpen: false,
			sectionEditorOpen: false,
			cardEditorOpen: false,
			editMode: false
		});
	}

	async function startEditMode() {
		const state = getState();
		if (state.panelBootstrap) await state.panelBootstrap;
		enterEditMode();
	}

	function undoPanelDraftStep() {
		const state = getState();
		if (!state.editMode || state.panelDraftHistory.past.length === 0) return;
		setState({ panelDraftHistory: undoEditStep(state.panelDraftHistory) });
	}

	function redoPanelDraftStep() {
		const state = getState();
		if (!state.editMode || state.panelDraftHistory.future.length === 0) return;
		setState({ panelDraftHistory: redoEditStep(state.panelDraftHistory) });
	}

	return {
		enterEditMode,
		saveDraftAndExit,
		cancelDraftAndExit,
		startEditMode,
		undoPanelDraftStep,
		redoPanelDraftStep
	};
}
