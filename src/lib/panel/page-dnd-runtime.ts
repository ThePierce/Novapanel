import type { EditHistoryState } from '$lib/edit-mode/history';
import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';
import { createSidebarDndHandlers } from '$lib/panel/page-dnd-sidebar-runtime';
import { createSectionViewDndHandlers } from '$lib/panel/page-dnd-section-view-runtime';

type PanelDraftSnapshot = { viewSections: ViewSectionDraft[]; sidebarCards: CardDraft[] };

type DndRuntimeState = {
	editMode: boolean;
	selectedColumns: 1 | 2 | 3;
	panelDraftHistory: EditHistoryState<PanelDraftSnapshot>;
	draggingSectionId: string;
	draggingViewCardId: string;
	draggingViewCardFromSectionId: string;
	draggingSidebarCardId: string;
	recentDraggingSidebarCardId: string;
	sidebarDropTargetId: string;
	sidebarDropPlacement: 'before' | 'after';
	sectionDropTargetId: string;
	sectionDropPlacement: 'before' | 'after';
	dragIndicatorActive: boolean;
	dragIndicatorValid: boolean;
	dragIndicatorX: number;
	dragIndicatorY: number;
};

type DebugLogFn = (event: string, payload: Record<string, unknown>) => void;

type CreatePageDndRuntimeParams = {
	browser: boolean;
	debugLog: DebugLogFn;
	getState: () => DndRuntimeState;
	setState: (patch: Partial<DndRuntimeState>) => void;
	applyDraftChange: (nextSections: ViewSectionDraft[]) => void;
	applySidebarDraftChange: (nextCards: CardDraft[]) => void;
};

let dragGhostImage: HTMLImageElement | null = null;

export function createPageDndRuntime(params: CreatePageDndRuntimeParams) {
	const { browser, debugLog, getState, setState, applyDraftChange, applySidebarDraftChange } = params;

	function applyDragCursorIndicatorOnly(event: DragEvent) {
		if (!browser) return;
		const transfer = event.dataTransfer;
		if (!transfer) return;
		transfer.effectAllowed = 'move';
		transfer.dropEffect = 'move';
		transfer.setData('text/plain', 'novapanel-drag');
		if (!dragGhostImage) {
			dragGhostImage = new Image();
			dragGhostImage.src =
				'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
		}
		transfer.setDragImage(dragGhostImage, 0, 0);
	}

	const {
		startSectionDrag: startSectionDragBase,
		endSectionDrag: endSectionDragBase,
		dropSectionOnColumn: dropSectionOnColumnBase,
		dropSectionOnSection: dropSectionOnSectionBase,
		startViewCardDrag,
		endViewCardDrag,
		dropViewCard
	} = createSectionViewDndHandlers({
		getState,
		setState,
		applyDraftChange,
		debugLog
	});

	function startSectionDrag(sectionId: string) {
		startSectionDragBase(sectionId);
		setState({ sectionDropTargetId: '' });
	}

	function endSectionDrag() {
		endSectionDragBase();
		setState({ sectionDropTargetId: '' });
	}

	function dropSectionOnColumn(column: number) {
		dropSectionOnColumnBase(column);
		setState({ sectionDropTargetId: '' });
	}

	function dropSectionOnSection(targetSectionId: string, placement: 'before' | 'after' = 'before') {
		dropSectionOnSectionBase(targetSectionId, placement);
		setState({ sectionDropTargetId: '' });
	}

	function updateDragIndicator(event: DragEvent, isValid: boolean) {
		const state = getState();
		if (!state.dragIndicatorActive) return;
		setState({
			dragIndicatorX: event.clientX + 16,
			dragIndicatorY: event.clientY + 14,
			dragIndicatorValid: isValid
		});
	}

	function trackDragOverInvalid(event: DragEvent) {
		const state = getState();
		if (!state.dragIndicatorActive) return;
		updateDragIndicator(event, false);
	}

	function allowValidDrop(event: DragEvent) {
		event.preventDefault();
		if (event.dataTransfer) {
			event.dataTransfer.dropEffect = 'move';
		}
		const state = getState();
		if (!state.dragIndicatorValid) {
			debugLog('drag_allow_valid_drop', {
				clientX: event.clientX,
				clientY: event.clientY,
				draggingSectionId: state.draggingSectionId,
				draggingViewCardId: state.draggingViewCardId,
				draggingSidebarCardId: state.draggingSidebarCardId
			});
		}
		updateDragIndicator(event, true);
	}

	const {
		startSidebarCardDrag,
		endSidebarCardDrag,
		dropSidebarCard,
		setSidebarDropPreview,
		handleSidebarValidDragOver
	} = createSidebarDndHandlers({
		getState,
		setState,
		applySidebarDraftChange,
		debugLog,
		allowValidDrop
	});

	return {
		applyDragCursorIndicatorOnly,
		startSectionDrag,
		endSectionDrag,
		dropSectionOnColumn,
		dropSectionOnSection,
		startViewCardDrag,
		endViewCardDrag,
		dropViewCard,
		startSidebarCardDrag,
		endSidebarCardDrag,
		dropSidebarCard,
		setSidebarDropPreview,
		updateDragIndicator,
		trackDragOverInvalid,
		allowValidDrop,
		handleSidebarValidDragOver
	};
}
