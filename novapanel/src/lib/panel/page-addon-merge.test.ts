import { describe, expect, it } from 'vitest';
import { mergeAddonDashboardState } from './page-addon-merge';
import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';

function card(id: string): CardDraft {
	return { id, title: id, cardType: 'clock' };
}

function section(id: string, cards: CardDraft[] = []): ViewSectionDraft {
	return {
		id,
		title: id,
		column: 1,
		span: 1,
		order: 0,
		cardColumns: 1,
		cards
	};
}

function merge(overrides: Partial<Parameters<typeof mergeAddonDashboardState>[0]> = {}) {
	return mergeAddonDashboardState({
		addonDashboard: {},
		currentColumns: 2,
		currentPopupWidth: 850,
		currentPopupHeight: 1140,
		currentViewSections: [],
		currentSidebarCards: [],
		currentUpdatedAt: 0,
		localizeAndSanitizeSections: (input) => (Array.isArray(input) ? (input as ViewSectionDraft[]) : []),
		sanitizeSidebarCards: (input) => (Array.isArray(input) ? (input as CardDraft[]) : []),
		isRemovedLegacySidebarSeed: () => false,
		...overrides
	});
}

describe('mergeAddonDashboardState', () => {
	it('does not let untimestamped server state wipe a populated local dashboard', () => {
		const localSections = [section('local', [card('local-card')])];
		const localSidebar = [card('local-sidebar')];
		const serverSections = [section('server', [card('server-card')])];

		const result = merge({
			addonDashboard: {
				layout: { columns: 3, popupWidth: 700, popupHeight: 900 },
				viewSections: serverSections,
				sidebarCards: []
			},
			currentViewSections: localSections,
			currentSidebarCards: localSidebar,
			currentUpdatedAt: 10
		});

		expect(result.debug.serverIsNewer).toBe(false);
		expect(result.viewSections).toBe(localSections);
		expect(result.sidebarCards).toBe(localSidebar);
		expect(result.layout).toEqual({ columns: 2, popupWidth: 850, popupHeight: 1140 });
	});

	it('hydrates an empty local dashboard from untimestamped server state', () => {
		const serverSections = [section('server', [card('server-card')])];
		const serverSidebar = [card('server-sidebar')];

		const result = merge({
			addonDashboard: {
				layout: { columns: 3, popupWidth: 720, popupHeight: 960 },
				viewSections: serverSections,
				sidebarCards: serverSidebar
			}
		});

		expect(result.debug.serverIsNewer).toBe(true);
		expect(result.viewSections).toBe(serverSections);
		expect(result.sidebarCards).toBe(serverSidebar);
		expect(result.layout).toEqual({ columns: 3, popupWidth: 720, popupHeight: 960 });
	});

	it('keeps local popup dimensions when server state is older', () => {
		const result = merge({
			addonDashboard: {
				layout: { columns: 1, popupWidth: 640, popupHeight: 480 },
				updatedAt: 5
			},
			currentUpdatedAt: 10,
			currentPopupWidth: 900,
			currentPopupHeight: 1200
		});

		expect(result.debug.serverIsNewer).toBe(false);
		expect(result.layout).toEqual({ columns: 2, popupWidth: 900, popupHeight: 1200 });
	});

	it('does not reapply equal-timestamp server state over populated local state', () => {
		const localSections = [section('local', [card('local-card')])];
		const localSidebar = [card('local-sidebar')];
		const serverSections = [section('local', [card('local-card')])];
		const serverSidebar = [card('local-sidebar')];

		const result = merge({
			addonDashboard: {
				layout: { columns: 3, popupWidth: 700, popupHeight: 900 },
				viewSections: serverSections,
				sidebarCards: serverSidebar,
				updatedAt: 42
			},
			currentViewSections: localSections,
			currentSidebarCards: localSidebar,
			currentUpdatedAt: 42
		});

		expect(result.debug.serverIsNewer).toBe(false);
		expect(result.viewSections).toBe(localSections);
		expect(result.sidebarCards).toBe(localSidebar);
		expect(result.layout).toEqual({ columns: 2, popupWidth: 850, popupHeight: 1140 });
	});
});
