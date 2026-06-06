import { describe, expect, it } from 'vitest';
import type { ViewSectionDraft } from '$lib/persistence/panel-state';
import { dedupeCards, sanitizeViewSectionsInput } from './page-helpers';

describe('page helpers', () => {
	it('dedupes cards by first id occurrence', () => {
		const cards = [
			{ id: 'one', title: 'One', cardType: 'weather' },
			{ id: 'one', title: 'Duplicate', cardType: 'date' },
			{ id: 'two', title: 'Two', cardType: 'clock' }
		];

		expect(dedupeCards(cards)).toEqual([cards[0], cards[2]]);
	});

	it('sanitizes view sections and removes duplicate cards inside a section', () => {
		const normalize = (sections: ViewSectionDraft[]) =>
			sections.map((section, index) => ({ ...section, order: index }));

		const result = sanitizeViewSectionsInput(
			[
				{
					title: 42,
					column: '2',
					span: '3',
					cardColumns: '2',
					cards: [
						{ id: 'a', title: 'A', cardType: 'weather' },
						{ id: 'a', title: 'A duplicate', cardType: 'date' },
						{ id: 'b', title: 'B', cardType: 'clock' }
					]
				}
			],
			'Sectie',
			normalize
		);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			title: 'Sectie 1',
			icon: 'layout-grid',
			column: 2,
			span: 3,
			order: 0,
			cardColumns: 2
		});
		expect(result[0].cards.map((card) => card.id)).toEqual(['a', 'b']);
	});
});
