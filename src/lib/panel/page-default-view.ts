import type { ViewSectionDraft } from '$lib/persistence/panel-state';
import { countViewCards } from '$lib/panel/page-debug';

type Input = {
	savedViewSections: ViewSectionDraft[];
	savedSidebarCardsLength: number;
	selectedColumns: 1 | 2 | 3;
	localizeAndSanitizeSections: (input: unknown) => ViewSectionDraft[];
};

export type DefaultViewSeedOutput = {
	savedViewSections: ViewSectionDraft[];
	activeViewSectionId: string;
	savedLayout: { columns: 1 | 2 | 3; popupWidth: number; popupHeight: number };
} | null;

export function seedDefaultViewIfEmpty(input: Input): DefaultViewSeedOutput {
	if (countViewCards(input.savedViewSections) > 0 || input.savedSidebarCardsLength > 0) return null;
	const sid = `section-${Date.now()}`;
	const cid = `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const raw: ViewSectionDraft[] = [
		{
			id: sid,
			title: '',
			icon: 'layout-grid',
			column: 1,
			span: 1,
			order: 0,
			cardColumns: 1,
			cards: [
				{
					id: cid,
					title: '',
					cardType: 'welcome'
				}
			]
		}
	];
	const savedViewSections = input.localizeAndSanitizeSections(raw);
	return {
		savedViewSections,
		activeViewSectionId: savedViewSections[0]?.id ?? '',
		savedLayout: { columns: input.selectedColumns, popupWidth: 850, popupHeight: 1140 }
	};
}
