import { writable } from 'svelte/store';
import type { SidebarItemBase, SidebarState } from './types';

const initialState: SidebarState = {
	enabled: true,
	width: 260,
	items: []
};

function areSidebarItemsEqual(a: SidebarItemBase[], b: SidebarItemBase[]) {
	if (a === b) return true;
	if (a.length !== b.length) return false;
	for (let index = 0; index < a.length; index += 1) {
		const left = a[index];
		const right = b[index];
		if (!left || !right) return false;
		if (
			left.id !== right.id ||
			left.type !== right.type ||
			left.title !== right.title ||
			left.analogClockStyle !== right.analogClockStyle ||
			left.digitalClockStyle !== right.digitalClockStyle ||
			left.visible !== right.visible ||
			left.order !== right.order
		) {
			return false;
		}
	}
	return true;
}

function createSidebarState() {
	const { subscribe, update, set } = writable<SidebarState>(initialState);
	let currentState: SidebarState = initialState;
	subscribe((value) => {
		currentState = value;
	});

	return {
		subscribe,
		reset: () => set(initialState),
		toggleSidebar: () => update((state) => ({ ...state, enabled: !state.enabled })),
		setSidebarWidth: (width: number) =>
			update((state) => ({ ...state, width: Math.max(200, Math.min(420, Math.round(width))) })),
		setSidebarItems: (items: SidebarItemBase[]) => {
			if (areSidebarItemsEqual(currentState.items, items)) return;
			update((state) => ({ ...state, items }));
		},
		reorderSidebarItems: (orderedIds: string[]) =>
			update((state) => {
				const indexById = new Map(orderedIds.map((id, index) => [id, index]));
				const items = [...state.items]
					.sort((a, b) => (indexById.get(a.id) ?? a.order) - (indexById.get(b.id) ?? b.order))
					.map((item, index) => ({ ...item, order: index }));
				return { ...state, items };
			})
	};
}

export const sidebarState = createSidebarState();
