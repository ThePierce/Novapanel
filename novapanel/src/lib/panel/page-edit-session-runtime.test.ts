import { describe, expect, it, vi } from 'vitest';
import { createEditHistory } from '$lib/edit-mode/history';
import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';
import { createPageEditSessionRuntime } from './page-edit-session-runtime';

type RuntimeParams = Parameters<typeof createPageEditSessionRuntime>[0];
type TestState = ReturnType<RuntimeParams['getState']>;

function card(id: string): CardDraft {
	return { id, title: id, cardType: 'clock' };
}

function section(id: string, cards: CardDraft[] = []): ViewSectionDraft {
	return {
		id,
		title: id,
		column: 1,
		order: 0,
		span: 1,
		cardColumns: 1,
		cards
	};
}

function createRuntime(overrides: Partial<RuntimeParams> = {}) {
	const initial: TestState = {
		panelBootstrap: null,
		panelDraftHistory: createEditHistory({
			viewSections: [section('draft', [card('draft-card')])],
			sidebarCards: [card('draft-sidebar')]
		}),
		savedViewSections: [section('saved', [card('saved-card')])],
		savedSidebarCards: [card('saved-sidebar')],
		savedLayout: { columns: 2 as const, popupWidth: 850, popupHeight: 1140 },
		selectedColumns: 2 as const,
		savedCardLibraryTab: 'sidebar' as const,
		activeCardLibraryTab: 'sidebar' as const,
		savedCustomTitles: {},
		customTitles: {},
		cardLibraryOpen: false,
		sectionEditorOpen: false,
		cardEditorOpen: false,
		editMode: true,
		savedUpdatedAt: 100,
		editSessionBaseUpdatedAt: 100
	};
	let state = { ...initial };
	const persistDashboardState = vi.fn(async () => ({ localOk: true, addonOk: true }));
	const runtime = createPageEditSessionRuntime({
		getState: () => state,
		setState: (patch) => {
			state = { ...state, ...patch };
		},
		sanitizeViewSections: (sections) => sections as ViewSectionDraft[],
		sanitizeSidebarCards: (cards) => cards as CardDraft[],
		cloneForPersistence: (value) => JSON.parse(JSON.stringify(value)),
		persistDashboardState,
		countViewCards: (sections) => sections.reduce((count, item) => count + item.cards.length, 0),
		debugLog: vi.fn(),
		...overrides
	});
	return { runtime, getState: () => state, persistDashboardState };
}

describe('page edit session runtime', () => {
	it('stores the dashboard timestamp when edit mode starts', async () => {
		const { runtime, getState } = createRuntime();
		runtime.cancelDraftAndExit();

		await runtime.startEditMode();

		expect(getState().editMode).toBe(true);
		expect(getState().editSessionBaseUpdatedAt).toBe(100);
	});

	it('keeps the draft open when a newer server dashboard is rejected', async () => {
		const confirmServerOverwrite = vi.fn(() => false);
		const { runtime, getState, persistDashboardState } = createRuntime({
			readServerDashboardUpdatedAt: vi.fn(async () => 200),
			confirmServerOverwrite
		});

		await runtime.saveDraftAndExit();

		expect(confirmServerOverwrite).toHaveBeenCalledWith(200, 100);
		expect(persistDashboardState).not.toHaveBeenCalled();
		expect(getState().editMode).toBe(true);
		expect(getState().savedViewSections[0].id).toBe('saved');
	});

	it('saves after confirming overwrite of a newer server dashboard', async () => {
		const { runtime, getState, persistDashboardState } = createRuntime({
			readServerDashboardUpdatedAt: vi.fn(async () => 200),
			confirmServerOverwrite: vi.fn(() => true)
		});
		getState().savedLayout.popupWidth = 980;
		getState().savedLayout.popupHeight = 720;

		await runtime.saveDraftAndExit();

		expect(persistDashboardState).toHaveBeenCalledTimes(1);
		expect(getState().editMode).toBe(false);
		expect(getState().editSessionBaseUpdatedAt).toBe(0);
		expect(getState().savedViewSections[0].id).toBe('draft');
		expect(getState().savedLayout).toEqual({ columns: 2, popupWidth: 980, popupHeight: 720 });
	});
});
