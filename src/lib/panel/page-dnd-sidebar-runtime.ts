import type { CardDraft } from '$lib/persistence/panel-state';
import { moveSidebarCard } from '$lib/panel/dnd-helpers';

type SidebarPlacement = 'before' | 'after';

type SidebarDndState = {
	editMode: boolean;
	draggingSidebarCardId: string;
	recentDraggingSidebarCardId: string;
	sidebarDropTargetId: string;
	sidebarDropPlacement: SidebarPlacement;
	dragIndicatorActive: boolean;
	dragIndicatorValid: boolean;
	panelDraftHistory: { present: { sidebarCards: CardDraft[] } };
};

type DebugLogFn = (event: string, payload: Record<string, unknown>) => void;

type CreateSidebarDndHandlersParams = {
	getState: () => SidebarDndState;
	setState: (patch: Partial<SidebarDndState>) => void;
	applySidebarDraftChange: (nextCards: CardDraft[]) => void;
	debugLog: DebugLogFn;
	allowValidDrop: (event: DragEvent) => void;
};

export function createSidebarDndHandlers(params: CreateSidebarDndHandlersParams) {
	const { getState, setState, applySidebarDraftChange, debugLog, allowValidDrop } = params;

	function startSidebarCardDrag(cardId: string) {
		const state = getState();
		if (!state.editMode) {
			debugLog('drag_start_sidebar_card_blocked', { reason: 'not_edit_mode', cardId });
			return;
		}
		debugLog('drag_start_sidebar_card', { cardId });
		setState({
			draggingSidebarCardId: cardId,
			recentDraggingSidebarCardId: cardId,
			sidebarDropTargetId: '',
			dragIndicatorActive: true,
			dragIndicatorValid: false
		});
	}

	function endSidebarCardDrag() {
		const state = getState();
		debugLog('drag_end_sidebar_card', { draggingSidebarCardId: state.draggingSidebarCardId });
		setState({
			sidebarDropTargetId: '',
			dragIndicatorActive: false,
			dragIndicatorValid: false
		});
		const endedCardId = state.draggingSidebarCardId;
		setTimeout(() => {
			const latest = getState();
			if (latest.draggingSidebarCardId === endedCardId) {
				const patch: Partial<SidebarDndState> = { draggingSidebarCardId: '' };
				if (latest.recentDraggingSidebarCardId === endedCardId) {
					patch.recentDraggingSidebarCardId = '';
				}
				setState(patch);
			}
		}, 0);
	}

	function dropSidebarCard(targetCardId: string | null = null, placement: SidebarPlacement = 'before') {
		const state = getState();
		const sourceCardId = state.draggingSidebarCardId || state.recentDraggingSidebarCardId;
		if (!state.editMode || !sourceCardId) {
			debugLog('drag_drop_sidebar_card_blocked', {
				reason: !state.editMode ? 'not_edit_mode' : 'no_dragging_sidebar_card',
				targetCardId,
				draggingSidebarCardId: state.draggingSidebarCardId,
				recentDraggingSidebarCardId: state.recentDraggingSidebarCardId
			});
			return;
		}
		debugLog('drag_drop_sidebar_card', {
			targetCardId,
			placement,
			draggingSidebarCardId: sourceCardId
		});
		applySidebarDraftChange(
			moveSidebarCard(state.panelDraftHistory.present.sidebarCards, sourceCardId, targetCardId, placement)
		);
		setState({
			draggingSidebarCardId: '',
			recentDraggingSidebarCardId: '',
			sidebarDropTargetId: '',
			dragIndicatorActive: false,
			dragIndicatorValid: false
		});
	}

	function setSidebarDropPreview(targetCardId: string, placement: SidebarPlacement) {
		const state = getState();
		if (!state.editMode || !state.draggingSidebarCardId) return;
		setState({
			sidebarDropTargetId: targetCardId,
			sidebarDropPlacement: placement
		});
	}

	function handleSidebarValidDragOver(event: DragEvent) {
		const state = getState();
		if (!state.editMode || !state.draggingSidebarCardId) {
			debugLog('drag_sidebar_over_blocked', {
				reason: !state.editMode ? 'not_edit_mode' : 'no_dragging_sidebar_card'
			});
			return;
		}
		allowValidDrop(event);
	}

	return {
		startSidebarCardDrag,
		endSidebarCardDrag,
		dropSidebarCard,
		setSidebarDropPreview,
		handleSidebarValidDragOver
	};
}
