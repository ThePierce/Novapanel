export type ModalUiState = {
	controlsOpen: boolean;
	settingsOpen: boolean;
	cardLibraryOpen: boolean;
	cardEditorOpen: boolean;
	sectionEditorOpen: boolean;
};

export function toggleControlsState(state: ModalUiState): ModalUiState {
	const controlsOpen = !state.controlsOpen;
	return {
		...state,
		controlsOpen,
		settingsOpen: controlsOpen ? state.settingsOpen : false
	};
}

export function toggleSettingsState(state: ModalUiState): ModalUiState {
	const settingsOpen = !state.settingsOpen;
	if (!settingsOpen) {
		return { ...state, settingsOpen: false };
	}
	return {
		...state,
		settingsOpen: true,
		cardLibraryOpen: false,
		cardEditorOpen: false
	};
}

export function toggleCardLibraryState(state: ModalUiState): ModalUiState {
	const cardLibraryOpen = !state.cardLibraryOpen;
	if (!cardLibraryOpen) {
		return { ...state, cardLibraryOpen: false };
	}
	return {
		...state,
		cardLibraryOpen: true,
		settingsOpen: false,
		cardEditorOpen: false
	};
}
