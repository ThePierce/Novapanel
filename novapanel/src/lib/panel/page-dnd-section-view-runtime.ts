import { moveSectionAfterSection, moveSectionBeforeSection, moveSectionToColumn, moveViewCard } from '$lib/panel/dnd-helpers';
import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';

type PanelDraftSnapshot = { viewSections: ViewSectionDraft[]; sidebarCards: CardDraft[] };
type DebugLogFn = (event: string, payload: Record<string, unknown>) => void;

type SectionViewDndState = {
	editMode: boolean;
	selectedColumns: 1 | 2 | 3;
	panelDraftHistory: { present: PanelDraftSnapshot };
	draggingSectionId: string;
	draggingViewCardId: string;
	draggingViewCardFromSectionId: string;
	dragIndicatorActive: boolean;
	dragIndicatorValid: boolean;
};

type CreateSectionViewDndHandlersParams = {
	getState: () => SectionViewDndState;
	setState: (patch: Partial<SectionViewDndState>) => void;
	applyDraftChange: (nextSections: ViewSectionDraft[]) => void;
	debugLog: DebugLogFn;
};

export function createSectionViewDndHandlers(params: CreateSectionViewDndHandlersParams) {
	const { getState, setState, applyDraftChange, debugLog } = params;

	function startSectionDrag(sectionId: string) {
		const state = getState();
		if (!state.editMode) {
			debugLog('drag_start_section_blocked', { reason: 'not_edit_mode', sectionId });
			return;
		}
		debugLog('drag_start_section', { sectionId });
		setState({
			draggingViewCardId: '',
			draggingViewCardFromSectionId: '',
			draggingSectionId: sectionId,
			dragIndicatorActive: true,
			dragIndicatorValid: false
		});
	}

	function endSectionDrag() {
		const state = getState();
		debugLog('drag_end_section', { draggingSectionId: state.draggingSectionId });
		setState({
			draggingSectionId: '',
			dragIndicatorActive: false,
			dragIndicatorValid: false
		});
	}

	function dropSectionOnColumn(column: number) {
		const state = getState();
		if (!state.editMode || !state.draggingSectionId) {
			debugLog('drag_drop_section_column_blocked', {
				reason: !state.editMode ? 'not_edit_mode' : 'no_dragging_section',
				column,
				draggingSectionId: state.draggingSectionId
			});
			return;
		}
		debugLog('drag_drop_section_column', { column, draggingSectionId: state.draggingSectionId });
		applyDraftChange(
			moveSectionToColumn(
				state.panelDraftHistory.present.viewSections,
				state.draggingSectionId,
				column,
				state.selectedColumns
			)
		);
		setState({ draggingSectionId: '' });
	}

	function dropSectionOnSection(targetSectionId: string, placement: 'before' | 'after' = 'before') {
		const state = getState();
		if (!state.editMode || !state.draggingSectionId || state.draggingSectionId === targetSectionId) {
			debugLog('drag_drop_section_section_blocked', {
				reason: !state.editMode
					? 'not_edit_mode'
					: !state.draggingSectionId
						? 'no_dragging_section'
						: 'same_target',
				targetSectionId,
				draggingSectionId: state.draggingSectionId
			});
			return;
		}
		const before = state.panelDraftHistory.present.viewSections.map((section) => ({
			id: section.id,
			column: section.column,
			order: section.order
		}));
		const next =
			placement === 'after'
				? moveSectionAfterSection(
						state.panelDraftHistory.present.viewSections,
						state.draggingSectionId,
						targetSectionId,
						state.selectedColumns
					)
				: moveSectionBeforeSection(
						state.panelDraftHistory.present.viewSections,
						state.draggingSectionId,
						targetSectionId,
						state.selectedColumns
					);
		const after = next.map((section) => ({
			id: section.id,
			column: section.column,
			order: section.order
		}));
		debugLog('drag_drop_section_section', {
			targetSectionId,
			draggingSectionId: state.draggingSectionId,
			placement
		});
		debugLog('drag_drop_section_section_reorder', {
			before: JSON.stringify(before),
			after: JSON.stringify(after)
		});
		applyDraftChange(next);
		setState({ draggingSectionId: '' });
	}

	function startViewCardDrag(sectionId: string, cardId: string) {
		const state = getState();
		if (!state.editMode) {
			debugLog('drag_start_view_card_blocked', { reason: 'not_edit_mode', sectionId, cardId });
			return;
		}
		debugLog('drag_start_view_card', { sectionId, cardId });
		setState({
			draggingSectionId: '',
			draggingViewCardFromSectionId: sectionId,
			draggingViewCardId: cardId,
			dragIndicatorActive: true,
			dragIndicatorValid: false
		});
	}

	function endViewCardDrag() {
		const state = getState();
		debugLog('drag_end_view_card', {
			draggingViewCardId: state.draggingViewCardId,
			draggingViewCardFromSectionId: state.draggingViewCardFromSectionId
		});
		setState({
			draggingViewCardId: '',
			draggingViewCardFromSectionId: '',
			dragIndicatorActive: false,
			dragIndicatorValid: false
		});
	}

	function dropViewCard(targetSectionId: string, targetCardId: string | null = null, placement: 'before' | 'after' = 'before') {
		const state = getState();
		if (!state.editMode || !state.draggingViewCardId || !state.draggingViewCardFromSectionId) {
			debugLog('drag_drop_view_card_blocked', {
				reason: !state.editMode
					? 'not_edit_mode'
					: !state.draggingViewCardId
						? 'no_dragging_card'
						: 'no_source_section',
				targetSectionId,
				targetCardId,
				draggingViewCardId: state.draggingViewCardId,
				draggingViewCardFromSectionId: state.draggingViewCardFromSectionId
			});
			return;
		}
		debugLog('drag_drop_view_card', {
			targetSectionId,
			targetCardId,
			placement,
			draggingViewCardId: state.draggingViewCardId,
			draggingViewCardFromSectionId: state.draggingViewCardFromSectionId
		});
		applyDraftChange(
			moveViewCard(
				state.panelDraftHistory.present.viewSections,
				state.draggingViewCardFromSectionId,
				state.draggingViewCardId,
				targetSectionId,
				targetCardId,
				placement
			)
		);
		setState({
			draggingViewCardId: '',
			draggingViewCardFromSectionId: ''
		});
	}

	return {
		startSectionDrag,
		endSectionDrag,
		dropSectionOnColumn,
		dropSectionOnSection,
		startViewCardDrag,
		endViewCardDrag,
		dropViewCard
	};
}
