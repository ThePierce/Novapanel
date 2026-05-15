export type EditHistoryState<T> = {
	past: T[];
	present: T;
	future: T[];
};

export function createEditHistory<T>(initial: T): EditHistoryState<T> {
	return {
		past: [],
		present: initial,
		future: []
	};
}

export function applyEditStep<T>(state: EditHistoryState<T>, next: T): EditHistoryState<T> {
	if (Object.is(state.present, next)) return state;
	return {
		past: [...state.past, state.present],
		present: next,
		future: []
	};
}

export function undoEditStep<T>(state: EditHistoryState<T>): EditHistoryState<T> {
	const previous = state.past[state.past.length - 1];
	if (previous === undefined) return state;
	return {
		past: state.past.slice(0, -1),
		present: previous,
		future: [state.present, ...state.future]
	};
}

export function redoEditStep<T>(state: EditHistoryState<T>): EditHistoryState<T> {
	const next = state.future[0];
	if (next === undefined) return state;
	return {
		past: [...state.past, state.present],
		present: next,
		future: state.future.slice(1)
	};
}
