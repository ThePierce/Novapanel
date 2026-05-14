import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';
import { toggleCardLibraryState, toggleControlsState, toggleSettingsState } from '$lib/panel/page-modal-state';

type CardEditorState = { zone: 'sidebar' | 'view'; id: string } | null;

type LayoutControlsState = {
	selectedColumns: 1 | 2 | 3;
	editMode: boolean;
	panelDraftViewSections: ViewSectionDraft[];
	savedViewSections: ViewSectionDraft[];
	savedLayout: { columns: 1 | 2 | 3; popupWidth: number; popupHeight: number };
	controlsOpen: boolean;
	settingsOpen: boolean;
	cardLibraryOpen: boolean;
	cardEditorOpen: boolean;
	sectionEditorOpen: boolean;
	cardEditor: CardEditorState;
};

type CreatePageLayoutControlsRuntimeParams = {
	getState: () => LayoutControlsState;
	setState: (patch: Partial<LayoutControlsState>) => void;
	normalizeSectionPositions: (sections: ViewSectionDraft[]) => ViewSectionDraft[];
	applyDraftChange: (nextSections: ViewSectionDraft[]) => void;
	persistDashboardState: () => Promise<{ localOk: boolean; addonOk: boolean }>;
};

export function createPageLayoutControlsRuntime(params: CreatePageLayoutControlsRuntimeParams) {
	const { getState, setState, normalizeSectionPositions, applyDraftChange, persistDashboardState } = params;

	function setColumns(value: 1 | 2 | 3) {
		const state = getState();
		if (state.editMode) {
			setState({ selectedColumns: value });
			applyDraftChange(normalizeSectionPositions(state.panelDraftViewSections));
			return;
		}
		const nextSavedSections = normalizeSectionPositions(state.savedViewSections);
		setState({
			selectedColumns: value,
			savedViewSections: nextSavedSections,
			savedLayout: { columns: value, popupWidth: 850, popupHeight: 1140 }
		});
		void persistDashboardState();
	}

	function toggleControls() {
		const state = getState();
		setState(
			toggleControlsState({
				controlsOpen: state.controlsOpen,
				settingsOpen: state.settingsOpen,
				cardLibraryOpen: state.cardLibraryOpen,
				cardEditorOpen: state.cardEditorOpen,
				sectionEditorOpen: state.sectionEditorOpen
			})
		);
	}

	function openSettings() {
		const state = getState();
		const next = toggleSettingsState({
			controlsOpen: state.controlsOpen,
			settingsOpen: state.settingsOpen,
			cardLibraryOpen: state.cardLibraryOpen,
			cardEditorOpen: state.cardEditorOpen,
			sectionEditorOpen: state.sectionEditorOpen
		});
		setState({
			controlsOpen: next.controlsOpen,
			settingsOpen: next.settingsOpen,
			cardLibraryOpen: next.cardLibraryOpen,
			cardEditorOpen: next.cardEditorOpen,
			sectionEditorOpen: next.sectionEditorOpen,
			cardEditor: next.cardEditorOpen ? state.cardEditor : null
		});
	}

	function closeSettings() {
		setState({ settingsOpen: false });
	}

	function openCardLibrary() {
		const state = getState();
		if (!state.editMode) return;
		const next = toggleCardLibraryState({
			controlsOpen: state.controlsOpen,
			settingsOpen: state.settingsOpen,
			cardLibraryOpen: state.cardLibraryOpen,
			cardEditorOpen: state.cardEditorOpen,
			sectionEditorOpen: state.sectionEditorOpen
		});
		setState({
			controlsOpen: next.controlsOpen,
			settingsOpen: next.settingsOpen,
			cardLibraryOpen: next.cardLibraryOpen,
			cardEditorOpen: next.cardEditorOpen,
			sectionEditorOpen: next.sectionEditorOpen,
			cardEditor: next.cardEditorOpen ? state.cardEditor : null
		});
	}

	function closeCardLibrary() {
		setState({ cardLibraryOpen: false });
	}

	return {
		setColumns,
		toggleControls,
		openSettings,
		closeSettings,
		openCardLibrary,
		closeCardLibrary
	};
}
