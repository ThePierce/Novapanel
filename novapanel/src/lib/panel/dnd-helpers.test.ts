import { describe, expect, it } from 'vitest';
import { moveSidebarCard, moveViewCard, normalizeSectionPositions } from './dnd-helpers';
import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';

function card(id: string): CardDraft {
	return { id, title: id, cardType: 'clock' };
}

function section(id: string, column: number, order: number, cards: CardDraft[] = []): ViewSectionDraft {
	return {
		id,
		title: id,
		column,
		order,
		span: 1,
		cardColumns: 1,
		cards
	};
}

describe('dnd helpers', () => {
	it('keeps a view card stable when dropped on itself in the same section', () => {
		const sections = [section('main', 1, 0, [card('a'), card('b')])];

		const result = moveViewCard(sections, 'main', 'a', 'main', 'a', 'before');

		expect(result).toBe(sections);
		expect(result[0].cards.map((item) => item.id)).toEqual(['a', 'b']);
	});

	it('moves a view card across sections at the requested placement', () => {
		const sections = [
			section('left', 1, 0, [card('a'), card('b')]),
			section('right', 1, 1, [card('c'), card('d')])
		];

		const result = moveViewCard(sections, 'left', 'b', 'right', 'd', 'after');

		expect(result.find((item) => item.id === 'left')?.cards.map((item) => item.id)).toEqual(['a']);
		expect(result.find((item) => item.id === 'right')?.cards.map((item) => item.id)).toEqual(['c', 'd', 'b']);
	});

	it('returns the original sections for invalid view card moves', () => {
		const sections = [section('main', 1, 0, [card('a')])];

		expect(moveViewCard(sections, 'missing', 'a', 'main')).toBe(sections);
		expect(moveViewCard(sections, 'main', 'missing', 'main')).toBe(sections);
		expect(moveViewCard(sections, 'main', 'a', 'missing')).toBe(sections);
	});

	it('moves a sidebar card after the requested target', () => {
		const result = moveSidebarCard([card('a'), card('b'), card('c')], 'a', 'c', 'after');

		expect(result.map((item) => item.id)).toEqual(['b', 'c', 'a']);
	});

	it('normalizes section order per column and clamps invalid spans', () => {
		const result = normalizeSectionPositions(
			[section('b', 1, 5), { ...section('a', 1, 2), span: 4 }, section('c', 2, 1)],
			2
		);

		expect(result.find((item) => item.id === 'a')).toMatchObject({ column: 1, order: 0, span: 2 });
		expect(result.find((item) => item.id === 'b')).toMatchObject({ column: 1, order: 1 });
		expect(result.find((item) => item.id === 'c')).toMatchObject({ column: 2, order: 0 });
	});
});
