import { applyEditStep, type EditHistoryState } from '$lib/edit-mode/history';
import { normalizeSectionPositions as normalizeSectionPositionsHelper } from '$lib/panel/dnd-helpers';
import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';

type PanelDraftSnapshot = { viewSections: ViewSectionDraft[]; sidebarCards: CardDraft[] };

type DraftState = {
	editMode: boolean;
	selectedColumns: 1 | 2 | 3;
	activeViewSectionId: string;
	panelDraftHistory: EditHistoryState<PanelDraftSnapshot>;
};

type CreatePageDraftRuntimeParams = {
	getState: () => DraftState;
	setState: (patch: Partial<DraftState>) => void;
	getSectionLabel: (index: number) => string;
	getLocalizedCardLabel: (type: string) => string;
};

export function createPageDraftRuntime(params: CreatePageDraftRuntimeParams) {
	const { getState, setState, getSectionLabel, getLocalizedCardLabel } = params;

	function applyDraftChange(nextSections: ViewSectionDraft[]) {
		const state = getState();
		setState({
			panelDraftHistory: applyEditStep(state.panelDraftHistory, {
				viewSections: nextSections,
				sidebarCards: state.panelDraftHistory.present.sidebarCards
			})
		});
	}

	function normalizeSectionPositions(sections: ViewSectionDraft[]) {
		const state = getState();
		return normalizeSectionPositionsHelper(sections, state.selectedColumns);
	}

	function addSection() {
		const state = getState();
		if (!state.editMode) return;
		const nextIndex = state.panelDraftHistory.present.viewSections.length + 1;
		const section: ViewSectionDraft = {
			id: `section-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			title: getSectionLabel(nextIndex),
			icon: 'layout-grid',
			column: 1,
			span: 1,
			order: state.panelDraftHistory.present.viewSections.filter((entry) => entry.column === 1).length,
			cardColumns: 1,
			cards: []
		};
		applyDraftChange(normalizeSectionPositions([...state.panelDraftHistory.present.viewSections, section]));
		setState({ activeViewSectionId: section.id });
	}

	function applySidebarDraftChange(nextCards: CardDraft[]) {
		const state = getState();
		setState({
			panelDraftHistory: applyEditStep(state.panelDraftHistory, {
				viewSections: state.panelDraftHistory.present.viewSections,
				sidebarCards: nextCards
			})
		});
	}

	function setSidebarCardType(id: string, cardType: string) {
		const state = getState();
		if (!state.editMode) return;
		applySidebarDraftChange(
			state.panelDraftHistory.present.sidebarCards.map((card) =>
				card.id === id ? { ...card, cardType } : card
			)
		);
	}

	function removeSidebarCard(id: string) {
		const state = getState();
		if (!state.editMode) return;
		applySidebarDraftChange(state.panelDraftHistory.present.sidebarCards.filter((card) => card.id !== id));
	}

	return {
		applyDraftChange,
		normalizeSectionPositions,
		addSection,
		applySidebarDraftChange,
		setSidebarCardType,
		removeSidebarCard
	};
}
