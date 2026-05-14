import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';
import { buildRenderedSidebarCards, buildRenderedViewSections, buildSidebarItems } from '$lib/panel/render-helpers';

type DebugLogFn = (event: string, payload: Record<string, unknown>) => void;

export function safeBuildRenderedViewSections(input: ViewSectionDraft[], debugLog: DebugLogFn) {
	try {
		return buildRenderedViewSections(input);
	} catch (error) {
		debugLog('build_rendered_view_sections_error', {
			error: String(error),
			inputLength: Array.isArray(input) ? input.length : -1
		});
		return [];
	}
}

export function safeBuildRenderedSidebarCards(input: CardDraft[], debugLog: DebugLogFn) {
	try {
		return buildRenderedSidebarCards(input);
	} catch (error) {
		debugLog('build_rendered_sidebar_cards_error', {
			error: String(error),
			inputLength: Array.isArray(input) ? input.length : -1
		});
		return [];
	}
}

export function safeBuildSidebarItems(
	input: CardDraft[],
	getLocalizedCardLabel: (type: string) => string,
	locale: string,
	debugLog: DebugLogFn
) {
	try {
		return buildSidebarItems(input, getLocalizedCardLabel, locale);
	} catch (error) {
		debugLog('build_sidebar_items_error', {
			error: String(error),
			inputLength: Array.isArray(input) ? input.length : -1
		});
		return [];
	}
}
