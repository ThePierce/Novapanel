import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';

function isWeekCalendarSection(section: ViewSectionDraft): boolean {
	return section.cards.some((card) => card.cardType === 'week_calendar' && card.hiddenInSection !== true);
}

export function normalizeSectionPositions(
	sections: ViewSectionDraft[],
	selectedColumns: 1 | 2 | 3
): ViewSectionDraft[] {
	const byColumn = new Map<number, ViewSectionDraft[]>();
	for (const section of sections) {
		const rawSpan = isWeekCalendarSection(section) ? 1 : section.span ?? 1;
		const span = Math.max(1, Math.min(selectedColumns, rawSpan));
		const maxStart = Math.max(1, selectedColumns - span + 1);
		const column = Math.max(1, Math.min(maxStart, section.column));
		const bucket = byColumn.get(column) ?? [];
		bucket.push({ ...section, column, span, cardColumns: section.cardColumns === 2 ? 2 : 1 });
		byColumn.set(column, bucket);
	}
	const normalized: ViewSectionDraft[] = [];
	for (const [column, bucket] of byColumn.entries()) {
		bucket
			.sort((a, b) => a.order - b.order)
			.forEach((section, index) => normalized.push({ ...section, column, order: index }));
	}
	return normalized;
}

export function moveSectionToColumn(
	sections: ViewSectionDraft[],
	draggingSectionId: string,
	column: number,
	selectedColumns: 1 | 2 | 3
) {
	const dragged = sections.find((section) => section.id === draggingSectionId);
	if (!dragged) return sections;
	const withoutDragged = sections.filter((section) => section.id !== draggingSectionId);
	const moved = { ...dragged, column: Math.max(1, Math.min(selectedColumns, column)) };
	return normalizeSectionPositions([...withoutDragged, moved], selectedColumns);
}

export function moveSectionBeforeSection(
	sections: ViewSectionDraft[],
	draggingSectionId: string,
	targetSectionId: string,
	selectedColumns: 1 | 2 | 3
) {
	if (draggingSectionId === targetSectionId) return sections;
	const target = sections.find((section) => section.id === targetSectionId);
	const dragged = sections.find((section) => section.id === draggingSectionId);
	if (!target || !dragged) return sections;
	const withoutDragged = sections.filter((section) => section.id !== draggingSectionId);
	const targetColumnSections = withoutDragged
		.filter((section) => section.column === target.column)
		.sort((a, b) => a.order - b.order);
	const insertIndex = targetColumnSections.findIndex((section) => section.id === targetSectionId);
	const moved = { ...dragged, column: target.column };
	const reorderedTargetColumn = [...targetColumnSections];
	reorderedTargetColumn.splice(insertIndex < 0 ? reorderedTargetColumn.length : insertIndex, 0, moved);
	const nextSections = withoutDragged.map((section) => {
		if (section.column !== target.column) return section;
		const nextOrder = reorderedTargetColumn.findIndex((entry) => entry.id === section.id);
		return nextOrder < 0 ? section : { ...section, order: nextOrder };
	});
	const movedOrder = reorderedTargetColumn.findIndex((entry) => entry.id === moved.id);
	nextSections.push({ ...moved, order: movedOrder < 0 ? moved.order : movedOrder });
	return normalizeSectionPositions(nextSections, selectedColumns);
}

export function moveSectionAfterSection(
	sections: ViewSectionDraft[],
	draggingSectionId: string,
	targetSectionId: string,
	selectedColumns: 1 | 2 | 3
) {
	if (draggingSectionId === targetSectionId) return sections;
	const target = sections.find((section) => section.id === targetSectionId);
	const dragged = sections.find((section) => section.id === draggingSectionId);
	if (!target || !dragged) return sections;
	const withoutDragged = sections.filter((section) => section.id !== draggingSectionId);
	const targetColumnSections = withoutDragged
		.filter((section) => section.column === target.column)
		.sort((a, b) => a.order - b.order);
	const targetIndex = targetColumnSections.findIndex((section) => section.id === targetSectionId);
	const insertIndex = targetIndex < 0 ? targetColumnSections.length : targetIndex + 1;
	const moved = { ...dragged, column: target.column };
	const reorderedTargetColumn = [...targetColumnSections];
	reorderedTargetColumn.splice(insertIndex, 0, moved);
	const nextSections = withoutDragged.map((section) => {
		if (section.column !== target.column) return section;
		const nextOrder = reorderedTargetColumn.findIndex((entry) => entry.id === section.id);
		return nextOrder < 0 ? section : { ...section, order: nextOrder };
	});
	const movedOrder = reorderedTargetColumn.findIndex((entry) => entry.id === moved.id);
	nextSections.push({ ...moved, order: movedOrder < 0 ? moved.order : movedOrder });
	return normalizeSectionPositions(nextSections, selectedColumns);
}

export function moveSectionOrderInColumn(
	sections: ViewSectionDraft[],
	sectionEditorId: string,
	sectionEditorColumn: number,
	direction: -1 | 1,
	selectedColumns: 1 | 2 | 3
) {
	const siblings = sections
		.filter((section) => section.column === sectionEditorColumn)
		.sort((a, b) => a.order - b.order);
	const currentIndex = siblings.findIndex((section) => section.id === sectionEditorId);
	const nextIndex = Math.max(0, Math.min(siblings.length - 1, currentIndex + direction));
	if (currentIndex < 0 || currentIndex === nextIndex) return sections;
	const reordered = [...siblings];
	const [moved] = reordered.splice(currentIndex, 1);
	reordered.splice(nextIndex, 0, moved);
	const rankMap = new Map(reordered.map((section, index) => [section.id, index]));
	return normalizeSectionPositions(
		sections.map((section) =>
			section.column === sectionEditorColumn
				? { ...section, order: rankMap.get(section.id) ?? section.order }
				: section
		),
		selectedColumns
	);
}

export function moveViewCard(
	sections: ViewSectionDraft[],
	draggingViewCardFromSectionId: string,
	draggingViewCardId: string,
	targetSectionId: string,
	targetCardId: string | null = null,
	placement: 'before' | 'after' = 'before'
) {
	const sourceSection = sections.find((section) => section.id === draggingViewCardFromSectionId);
	const targetSection = sections.find((section) => section.id === targetSectionId);
	if (!sourceSection || !targetSection) return sections;
	const draggedCard = sourceSection.cards.find((card) => card.id === draggingViewCardId);
	if (!draggedCard) return sections;
	const sectionsWithoutCard = sections.map((section) =>
		section.id === draggingViewCardFromSectionId
			? { ...section, cards: section.cards.filter((card) => card.id !== draggingViewCardId) }
			: section
	);
	const targetAfterRemoval = sectionsWithoutCard.find((section) => section.id === targetSectionId);
	if (!targetAfterRemoval) return sections;
	const targetCards = [...targetAfterRemoval.cards];
	let insertIndex: number;
	if (targetCardId === null) {
		insertIndex = targetCards.length;
	} else {
		const rawIndex = targetCards.findIndex((card) => card.id === targetCardId);
		const baseIndex = rawIndex < 0 ? targetCards.length : rawIndex;
		insertIndex = placement === 'after' ? baseIndex + 1 : baseIndex;
	}
	targetCards.splice(insertIndex < 0 ? targetCards.length : insertIndex, 0, draggedCard);
	return sectionsWithoutCard.map((section) =>
		section.id === targetSectionId ? { ...section, cards: targetCards } : section
	);
}

export function moveSidebarCard(
	cards: CardDraft[],
	draggingSidebarCardId: string,
	targetCardId: string | null = null,
	placement: 'before' | 'after' = 'before'
) {
	const nextCards = [...cards];
	const sourceIndex = nextCards.findIndex((card) => card.id === draggingSidebarCardId);
	if (sourceIndex < 0) return cards;
	const [dragged] = nextCards.splice(sourceIndex, 1);
	const rawTargetIndex = targetCardId ? nextCards.findIndex((card) => card.id === targetCardId) : nextCards.length;
	const targetIndex =
		targetCardId && rawTargetIndex >= 0 && placement === 'after' ? rawTargetIndex + 1 : rawTargetIndex;
	nextCards.splice(targetIndex < 0 ? nextCards.length : targetIndex, 0, dragged);
	return nextCards;
}
