import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';

export type ResponsiveColumnCount = 1 | 2 | 3;

export type ResponsiveViewSection = ViewSectionDraft & {
	displayColumn: number;
	displaySpan: number;
	displayOrder: number;
};

export function getResponsiveColumnCap(width: number, height: number): ResponsiveColumnCount {
	if (!width || !height) return 3;
	const shortSide = Math.min(width, height);
	const longSide = Math.max(width, height);
	if (shortSide < 600) return 1;
	if (longSide < 1440) return 2;
	return 3;
}

function visibleWeekCalendarCardId(section: { cards?: CardDraft[] }): string {
	return (
		section.cards?.find((card) => card.cardType === 'week_calendar' && card.hiddenInSection !== true)?.id ??
		''
	);
}

export function sectionHasVisibleWeekCalendarCard(section: { cards?: CardDraft[] }, cardId: string): boolean {
	return (
		cardId.length > 0 &&
		(section.cards?.some(
			(card) => card.id === cardId && card.cardType === 'week_calendar' && card.hiddenInSection !== true
		) ??
			false)
	);
}

export function buildResponsiveViewSections(
	sections: ViewSectionDraft[],
	columns: ResponsiveColumnCount,
	expandedCalendarCardId = ''
): ResponsiveViewSection[] {
	type Candidate = ViewSectionDraft & {
		originalColumn: number;
		responsiveColumn: number;
		responsiveSpan: number;
		movedToColumnOne: boolean;
		isExpandedCalendarSection: boolean;
		sourceIndex: number;
	};

	const expandedSource =
		columns >= 2
			? sections.find((section) => sectionHasVisibleWeekCalendarCard(section, expandedCalendarCardId))
			: null;
	const expandedOriginalColumn = expandedSource
		? Math.max(1, Math.min(columns, expandedSource.column || 1))
		: 0;
	const expandedColumn = expandedSource ? Math.min(expandedOriginalColumn, Math.max(1, columns - 1)) : 0;
	const expandedSpan =
		expandedSource && columns >= 2 ? Math.min(2, Math.max(1, columns - expandedColumn + 1)) : 1;
	const coveredColumns = new Set<number>();
	if (expandedSource && columns >= 2) {
		for (
			let column = expandedColumn;
			column < expandedColumn + expandedSpan && column <= columns;
			column += 1
		) {
			if (column !== expandedOriginalColumn) coveredColumns.add(column);
		}
	}

	const candidates: Candidate[] = sections.map((section, sourceIndex) => {
		const calendarCardId = visibleWeekCalendarCardId(section);
		const isCalendarSection = calendarCardId.length > 0;
		const isExpandedCalendarSection =
			columns >= 2 && sectionHasVisibleWeekCalendarCard(section, expandedCalendarCardId);
		const originalColumn = Math.max(1, Math.min(columns, section.column || 1));
		const responsiveColumn = isExpandedCalendarSection
			? Math.min(originalColumn, Math.max(1, columns - 1))
			: originalColumn;
		const movedToColumnOne =
			!isExpandedCalendarSection && coveredColumns.has(originalColumn) && originalColumn !== 1;
		const displayColumn = movedToColumnOne ? 1 : responsiveColumn;
		const maxSpan = Math.max(1, columns - displayColumn + 1);
		const configuredSpan = isCalendarSection ? 1 : (section.span ?? 1);
		const responsiveSpan = movedToColumnOne
			? 1
			: isExpandedCalendarSection
				? Math.min(expandedSpan, maxSpan)
				: Math.max(1, Math.min(maxSpan, configuredSpan));

		return {
			...section,
			originalColumn,
			responsiveColumn: displayColumn,
			responsiveSpan,
			movedToColumnOne,
			isExpandedCalendarSection,
			sourceIndex
		};
	});

	const buckets = new Map<number, Candidate[]>();
	for (const section of candidates) {
		const bucket = buckets.get(section.responsiveColumn) ?? [];
		bucket.push(section);
		buckets.set(section.responsiveColumn, bucket);
	}

	const next: ResponsiveViewSection[] = [];
	for (const [displayColumn, bucket] of buckets.entries()) {
		bucket
			.sort((a, b) => {
				if (displayColumn === 1 && a.movedToColumnOne !== b.movedToColumnOne) {
					return a.movedToColumnOne ? 1 : -1;
				}
				if (a.order !== b.order) return a.order - b.order;
				if (a.originalColumn !== b.originalColumn) return a.originalColumn - b.originalColumn;
				return a.sourceIndex - b.sourceIndex;
			})
			.forEach((section, index) => {
				next.push({
					...section,
					displayColumn,
					displaySpan: section.responsiveSpan,
					displayOrder: index
				});
			});
	}
	return next.sort((a, b) =>
		a.displayColumn === b.displayColumn ? a.displayOrder - b.displayOrder : a.displayColumn - b.displayColumn
	);
}
