import type { EditHistoryState } from '$lib/edit-mode/history';
import { cardCatalog } from '$lib/cards/store';
import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';
import {
	addCardFromCatalogRuntime,
	deleteCardEditorRuntime,
	deleteSectionEditorRuntime,
	moveSectionOrderRuntime,
	saveCardEditorRuntime,
	saveSectionEditorRuntime
} from '$lib/panel/page-editor-runtime';
import {
	buildCardEditorOpenState,
	buildSectionEditorOpenState,
	resolveCardForEditor,
	resolveSectionForEditor
} from '$lib/panel/page-editor-open';

type CardLibraryTab = 'sidebar' | 'view';
type CardEditorState = { zone: 'sidebar' | 'view'; id: string } | null;
type PanelDraftSnapshot = { viewSections: ViewSectionDraft[]; sidebarCards: CardDraft[] };

type EditorUiState = {
	editMode: boolean;
	panelDraftHistory: EditHistoryState<PanelDraftSnapshot>;
	activeViewSectionId: string;
	cardEditorOpen: boolean;
	cardEditor: CardEditorState;
	cardEditorTitle: string;
	cardEditorType: string;
	cardEditorEntityId?: string;
	cardEditorAnalogStyle: 1 | 2 | 3 | 4;
	cardEditorDigitalStyle: 1 | 2 | 3 | 4;
	cardEditorClockStyle?: CardDraft['clockStyle'];
	cardEditorClockShowAnalog?: boolean;
	cardEditorClockShowDigital?: boolean;
	cardEditorClockHour12?: boolean;
	cardEditorClockSeconds?: boolean;
	cardEditorDateLayout?: CardDraft['dateLayout'];
	cardEditorDateShortDay?: boolean;
	cardEditorDateShortMonth?: boolean;
	cardEditorDateAlign?: CardDraft['dateAlign'];
	cardEditorDateWeekdayWithDate?: boolean;
	cardEditorWeatherForecastType?: CardDraft['weatherForecastType'];
	cardEditorWeatherForecastDaysToShow?: CardDraft['weatherForecastDaysToShow'];
	cardEditorStatusDomains?: CardDraft['statusDomains'];
	cardEditorStatusDeviceClasses?: CardDraft['statusDeviceClasses'];
	cardEditorStatusEntityIds?: CardDraft['statusEntityIds'];
	cardEditorStatusDiscoveredEntityIds?: CardDraft['statusDiscoveredEntityIds'];
	cardEditorStatusEntityAliases?: CardDraft['statusEntityAliases'];
	cardEditorStatusEntityIconOverrides?: CardDraft['statusEntityIconOverrides'];
	cardEditorStatusIcon?: CardDraft['statusIcon'];
	cardEditorNetEntityId?: string;
	cardEditorSolarEntityId?: string;
	cardEditorBatteryEntityId?: string;
	cardEditorGridEntityId?: string;
	cardEditorBatteryChargeEntityId?: string;
	cardEditorImportTodayEntityId?: string;
	cardEditorExportTodayEntityId?: string;
	cardEditorSolarTodayEntityId?: string;
	cardEditorHomeTodayEntityId?: string;
	cardEditorCostTodayEntityId?: string;
	cardEditorCompensationTodayEntityId?: string;
	cardEditorSelfSufficiencyEntityId?: string;
	cardEditorCarChargingEntityId?: string;
	cardEditorCarCableEntityId?: string;
	cardEditorCarChargingPowerEntityId?: string;
	cardEditorEnergyDeviceEntityIds?: string[];
	cardEditorEnergyDeviceTodayEntityIds?: string[];
	cardEditorEnergyDeviceAliases?: CardDraft['energyDeviceAliases'];
	cardEditorCameras?: import('../persistence/panel-state-types').CameraConfig[];
	cardEditorHasCustomDayNoCar?: boolean;
	cardEditorHasCustomDayWithCar?: boolean;
	cardEditorHasCustomNightNoCar?: boolean;
	cardEditorHasCustomNightWithCar?: boolean;
	cardEditorAnchorsDayNoCar?: import('../persistence/panel-state-types').EnergyAnchors;
	cardEditorAnchorsDayWithCar?: import('../persistence/panel-state-types').EnergyAnchors;
	cardEditorAnchorsNightNoCar?: import('../persistence/panel-state-types').EnergyAnchors;
	cardEditorAnchorsNightWithCar?: import('../persistence/panel-state-types').EnergyAnchors;
	cardEditorInitialNetEntityId?: string;
	cardEditorInitialSolarEntityId?: string;
	cardEditorInitialBatteryEntityId?: string;
	cardEditorInitialGridEntityId?: string;
	cardEditorInitialBatteryChargeEntityId?: string;
	cardEditorInitialImportTodayEntityId?: string;
	cardEditorInitialExportTodayEntityId?: string;
	cardEditorInitialSolarTodayEntityId?: string;
	cardEditorInitialHomeTodayEntityId?: string;
	cardEditorInitialCostTodayEntityId?: string;
	cardEditorInitialCompensationTodayEntityId?: string;
	cardEditorInitialSelfSufficiencyEntityId?: string;
	cardEditorInitialCarChargingEntityId?: string;
	cardEditorInitialCarCableEntityId?: string;
	cardEditorInitialCarChargingPowerEntityId?: string;
	cardEditorInitialHasCustomDayNoCar?: boolean;
	cardEditorInitialHasCustomDayWithCar?: boolean;
	cardEditorInitialHasCustomNightNoCar?: boolean;
	cardEditorInitialHasCustomNightWithCar?: boolean;
	cardEditorInitialAnchorsDayNoCar?: import('../persistence/panel-state-types').EnergyAnchors;
	cardEditorInitialAnchorsDayWithCar?: import('../persistence/panel-state-types').EnergyAnchors;
	cardEditorInitialAnchorsNightNoCar?: import('../persistence/panel-state-types').EnergyAnchors;
	cardEditorInitialAnchorsNightWithCar?: import('../persistence/panel-state-types').EnergyAnchors;
	cardEditorInitialTitle: string;
	cardEditorInitialType: string;
	cardEditorInitialEntityId?: string;
	cardEditorInitialAnalogStyle: 1 | 2 | 3 | 4;
	cardEditorInitialDigitalStyle: 1 | 2 | 3 | 4;
	cardEditorInitialClockStyle?: CardDraft['clockStyle'];
	cardEditorInitialClockShowAnalog?: boolean;
	cardEditorInitialClockShowDigital?: boolean;
	cardEditorInitialClockHour12?: boolean;
	cardEditorInitialClockSeconds?: boolean;
	cardEditorInitialDateLayout?: CardDraft['dateLayout'];
	cardEditorInitialDateShortDay?: boolean;
	cardEditorInitialDateShortMonth?: boolean;
	cardEditorInitialDateAlign?: CardDraft['dateAlign'];
	cardEditorInitialDateWeekdayWithDate?: boolean;
	cardEditorInitialWeatherForecastType?: CardDraft['weatherForecastType'];
	cardEditorInitialWeatherForecastDaysToShow?: CardDraft['weatherForecastDaysToShow'];
	cardEditorInitialStatusDomains?: CardDraft['statusDomains'];
	cardEditorInitialStatusDeviceClasses?: CardDraft['statusDeviceClasses'];
	cardEditorInitialStatusEntityIds?: CardDraft['statusEntityIds'];
	cardEditorInitialStatusDiscoveredEntityIds?: CardDraft['statusDiscoveredEntityIds'];
	cardEditorInitialStatusEntityAliases?: CardDraft['statusEntityAliases'];
	cardEditorInitialStatusEntityIconOverrides?: CardDraft['statusEntityIconOverrides'];
	cardEditorInitialStatusIcon?: CardDraft['statusIcon'];
	cardEditorInitialEnergyDeviceEntityIds?: string[];
	cardEditorInitialEnergyDeviceTodayEntityIds?: string[];
	cardEditorInitialEnergyDeviceAliases?: CardDraft['energyDeviceAliases'];
	cardEditorInitialCameras?: import('../persistence/panel-state-types').CameraConfig[];
	sectionEditorOpen: boolean;
	sectionEditorId: string;
	sectionEditorTitle: string;
	sectionEditorIcon: string;
	sectionEditorHeaderTemperatureEntityId: string;
	sectionEditorHeaderHumidityEntityId: string;
	sectionEditorHeaderPressureEntityId: string;
	sectionEditorColumn: number;
	sectionEditorSpan: number;
	sectionEditorCardColumns: 1 | 2;
	sectionEditorInitialTitle: string;
	sectionEditorInitialIcon: string;
	sectionEditorInitialHeaderTemperatureEntityId: string;
	sectionEditorInitialHeaderHumidityEntityId: string;
	sectionEditorInitialHeaderPressureEntityId: string;
	sectionEditorInitialColumn: number;
	sectionEditorInitialSpan: number;
	sectionEditorInitialCardColumns: 1 | 2;
	settingsOpen: boolean;
	cardLibraryOpen: boolean;
	selectedColumns: 1 | 2 | 3;
	activeCardLibraryTab: CardLibraryTab;
};

function resolveEditingCardDraft(
	sidebarCards: CardDraft[],
	viewSections: ViewSectionDraft[],
	editor: { zone: 'sidebar' | 'view'; id: string }
): CardDraft | undefined {
	if (editor.zone === 'sidebar') {
		return sidebarCards.find((card) => card.id === editor.id);
	}
	for (const section of viewSections) {
		const hit = section.cards.find((card) => card.id === editor.id);
		if (hit) return hit;
	}
	return undefined;
}

type CreatePageEditorUiRuntimeParams = {
	getState: () => EditorUiState;
	setState: (patch: Partial<EditorUiState>) => void;
	applyDraftChange: (nextSections: ViewSectionDraft[]) => void;
	applySidebarDraftChange: (nextCards: CardDraft[]) => void;
	normalizeSectionPositions: (sections: ViewSectionDraft[]) => ViewSectionDraft[];
	addSection: () => void;
	getLocalizedCardLabel: (type: string) => string;
	getCardLabelFallback: (index: number) => string;
};

export function createPageEditorUiRuntime(params: CreatePageEditorUiRuntimeParams) {
	const {
		getState,
		setState,
		applyDraftChange,
		applySidebarDraftChange,
		normalizeSectionPositions,
		addSection,
		getLocalizedCardLabel,
		getCardLabelFallback
	} = params;

	function openCardEditor(zone: 'sidebar' | 'view', id: string) {
		const state = getState();
		if (!state.editMode) return;
		if (state.cardEditorOpen && state.cardEditor?.zone === zone && state.cardEditor?.id === id) {
			closeCardEditor();
			return;
		}
		const selected = resolveCardForEditor(
			zone,
			id,
			state.panelDraftHistory.present.sidebarCards,
			state.panelDraftHistory.present.viewSections
		);
		if (!selected) return;
		const next = buildCardEditorOpenState(selected);
		setState({
			cardEditor: { zone, id },
			cardEditorTitle: next.title,
			cardEditorType: next.type,
			cardEditorEntityId: next.entityId,
			cardEditorAnalogStyle: next.analogStyle,
			cardEditorDigitalStyle: next.digitalStyle,
			cardEditorClockStyle: next.clockStyle,
			cardEditorClockShowAnalog: next.clockShowAnalog,
			cardEditorClockShowDigital: next.clockShowDigital,
			cardEditorClockHour12: next.clockHour12,
			cardEditorClockSeconds: next.clockSeconds,
			cardEditorDateLayout: next.dateLayout,
			cardEditorDateShortDay: next.dateShortDay,
			cardEditorDateShortMonth: next.dateShortMonth,
			cardEditorDateAlign: next.dateAlign,
			cardEditorDateWeekdayWithDate: next.dateWeekdayWithDate,
			cardEditorWeatherForecastType: next.weatherForecastType,
			cardEditorWeatherForecastDaysToShow: next.weatherForecastDaysToShow,
			cardEditorStatusDomains: next.statusDomains,
			cardEditorStatusDeviceClasses: next.statusDeviceClasses,
			cardEditorStatusEntityIds: next.statusEntityIds,
			cardEditorStatusDiscoveredEntityIds: next.statusDiscoveredEntityIds,
			cardEditorStatusEntityAliases: next.statusEntityAliases ?? {},
			cardEditorStatusEntityIconOverrides: next.statusEntityIconOverrides ?? {},
			cardEditorStatusIcon: next.statusIcon,
				cardEditorNetEntityId: next.netEntityId ?? '',
				cardEditorSolarEntityId: next.solarEntityId ?? '',
				cardEditorBatteryEntityId: next.batteryEntityId ?? '',
				cardEditorGridEntityId: next.gridEntityId ?? '',
				cardEditorBatteryChargeEntityId: next.batteryChargeEntityId ?? '',
				cardEditorImportTodayEntityId: next.importTodayEntityId ?? '',
				cardEditorExportTodayEntityId: next.exportTodayEntityId ?? '',
				cardEditorSolarTodayEntityId: next.solarTodayEntityId ?? '',
				cardEditorHomeTodayEntityId: next.homeTodayEntityId ?? '',
				cardEditorCostTodayEntityId: next.costTodayEntityId ?? '',
				cardEditorCompensationTodayEntityId: next.compensationTodayEntityId ?? '',
				cardEditorSelfSufficiencyEntityId: next.selfSufficiencyEntityId ?? '',
				cardEditorCarChargingEntityId: next.carChargingEntityId ?? '',
				cardEditorCarCableEntityId: next.carCableEntityId ?? '',
				cardEditorCarChargingPowerEntityId: next.carChargingPowerEntityId ?? '',
				cardEditorEnergyDeviceEntityIds: next.energyDeviceEntityIds ?? [],
				cardEditorEnergyDeviceTodayEntityIds: next.energyDeviceTodayEntityIds ?? [],
				cardEditorEnergyDeviceAliases: next.energyDeviceAliases ?? {},
				cardEditorHasCustomDayNoCar: next.hasCustomDayNoCar ?? false,
				cardEditorHasCustomDayWithCar: next.hasCustomDayWithCar ?? false,
				cardEditorHasCustomNightNoCar: next.hasCustomNightNoCar ?? false,
				cardEditorHasCustomNightWithCar: next.hasCustomNightWithCar ?? false,
				cardEditorAnchorsDayNoCar: next.anchorsDayNoCar,
				cardEditorAnchorsDayWithCar: next.anchorsDayWithCar,
				cardEditorAnchorsNightNoCar: next.anchorsNightNoCar,
				cardEditorAnchorsNightWithCar: next.anchorsNightWithCar,
				cardEditorInitialNetEntityId: next.netEntityId ?? '',
				cardEditorInitialSolarEntityId: next.solarEntityId ?? '',
				cardEditorInitialBatteryEntityId: next.batteryEntityId ?? '',
				cardEditorInitialGridEntityId: next.gridEntityId ?? '',
				cardEditorInitialBatteryChargeEntityId: next.batteryChargeEntityId ?? '',
				cardEditorInitialImportTodayEntityId: next.importTodayEntityId ?? '',
				cardEditorInitialExportTodayEntityId: next.exportTodayEntityId ?? '',
				cardEditorInitialSolarTodayEntityId: next.solarTodayEntityId ?? '',
				cardEditorInitialHomeTodayEntityId: next.homeTodayEntityId ?? '',
				cardEditorInitialCostTodayEntityId: next.costTodayEntityId ?? '',
				cardEditorInitialCompensationTodayEntityId: next.compensationTodayEntityId ?? '',
				cardEditorInitialSelfSufficiencyEntityId: next.selfSufficiencyEntityId ?? '',
				cardEditorInitialCarChargingEntityId: next.carChargingEntityId ?? '',
				cardEditorInitialCarCableEntityId: next.carCableEntityId ?? '',
				cardEditorInitialCarChargingPowerEntityId: next.carChargingPowerEntityId ?? '',
				cardEditorInitialEnergyDeviceEntityIds: next.energyDeviceEntityIds ?? [],
				cardEditorInitialEnergyDeviceTodayEntityIds: next.energyDeviceTodayEntityIds ?? [],
				cardEditorInitialHasCustomDayNoCar: next.hasCustomDayNoCar ?? false,
				cardEditorInitialHasCustomDayWithCar: next.hasCustomDayWithCar ?? false,
				cardEditorInitialHasCustomNightNoCar: next.hasCustomNightNoCar ?? false,
				cardEditorInitialHasCustomNightWithCar: next.hasCustomNightWithCar ?? false,
				cardEditorInitialAnchorsDayNoCar: next.anchorsDayNoCar,
				cardEditorInitialAnchorsDayWithCar: next.anchorsDayWithCar,
				cardEditorInitialAnchorsNightNoCar: next.anchorsNightNoCar,
				cardEditorInitialAnchorsNightWithCar: next.anchorsNightWithCar,
				cardEditorCameras: next.cameras ?? [],
				cardEditorInitialCameras: next.cameras ?? [],
			cardEditorInitialTitle: next.initialTitle,
			cardEditorInitialType: next.initialType,
			cardEditorInitialEntityId: next.initialEntityId,
			cardEditorInitialAnalogStyle: next.initialAnalogStyle,
			cardEditorInitialDigitalStyle: next.initialDigitalStyle,
			cardEditorInitialClockStyle: next.initialClockStyle,
			cardEditorInitialClockShowAnalog: next.initialClockShowAnalog,
			cardEditorInitialClockShowDigital: next.initialClockShowDigital,
			cardEditorInitialClockHour12: next.initialClockHour12,
			cardEditorInitialClockSeconds: next.initialClockSeconds,
			cardEditorInitialDateLayout: next.initialDateLayout,
			cardEditorInitialDateShortDay: next.initialDateShortDay,
			cardEditorInitialDateShortMonth: next.initialDateShortMonth,
			cardEditorInitialDateAlign: next.initialDateAlign,
			cardEditorInitialDateWeekdayWithDate: next.initialDateWeekdayWithDate,
			cardEditorInitialWeatherForecastType: next.initialWeatherForecastType,
			cardEditorInitialWeatherForecastDaysToShow: next.initialWeatherForecastDaysToShow,
			cardEditorInitialStatusDomains: next.initialStatusDomains,
			cardEditorInitialStatusDeviceClasses: next.initialStatusDeviceClasses,
			cardEditorInitialStatusEntityIds: next.initialStatusEntityIds,
			cardEditorInitialStatusDiscoveredEntityIds: next.initialStatusDiscoveredEntityIds,
			cardEditorInitialStatusEntityAliases: next.initialStatusEntityAliases ?? {},
			cardEditorInitialStatusEntityIconOverrides: next.initialStatusEntityIconOverrides ?? {},
			cardEditorInitialStatusIcon: next.initialStatusIcon,
				cardEditorInitialEnergyDeviceAliases: next.initialEnergyDeviceAliases ?? {},
			cardEditorOpen: true,
			settingsOpen: false,
			cardLibraryOpen: false,
			sectionEditorOpen: false
		});
	}

	function closeCardEditor() {
		setState({ cardEditorOpen: false, cardEditor: null });
	}

	function openSectionEditor(sectionId: string) {
		const state = getState();
		if (!state.editMode) return;
		const section = resolveSectionForEditor(sectionId, state.panelDraftHistory.present.viewSections);
		if (!section) return;
		const next = buildSectionEditorOpenState(section);
		setState({
			sectionEditorId: next.id,
			sectionEditorTitle: next.title,
			sectionEditorIcon: next.icon,
			sectionEditorHeaderTemperatureEntityId: next.headerTemperatureEntityId,
			sectionEditorHeaderHumidityEntityId: next.headerHumidityEntityId,
			sectionEditorHeaderPressureEntityId: next.headerPressureEntityId,
			sectionEditorColumn: next.column,
			sectionEditorSpan: next.span,
			sectionEditorCardColumns: next.cardColumns,
			sectionEditorInitialTitle: next.initialTitle,
			sectionEditorInitialIcon: next.initialIcon,
			sectionEditorInitialHeaderTemperatureEntityId: next.initialHeaderTemperatureEntityId,
			sectionEditorInitialHeaderHumidityEntityId: next.initialHeaderHumidityEntityId,
			sectionEditorInitialHeaderPressureEntityId: next.initialHeaderPressureEntityId,
			sectionEditorInitialColumn: next.initialColumn,
			sectionEditorInitialSpan: next.initialSpan,
			sectionEditorInitialCardColumns: next.initialCardColumns,
			sectionEditorOpen: true,
			cardEditorOpen: false,
			settingsOpen: false,
			cardLibraryOpen: false
		});
	}

	function closeSectionEditor() {
		setState({ sectionEditorOpen: false, sectionEditorId: '' });
	}

	function addCardFromCatalog(cardCatalogId: string) {
		const state = getState();
		const selected = cardCatalog.find((card) => card.id === cardCatalogId);
		if (!selected || !state.editMode) return;
		const nextIndex = state.panelDraftHistory.present.viewSections.flatMap((section) => section.cards).length + 1;
		const result = addCardFromCatalogRuntime({
			selected,
			activeViewSectionId: state.activeViewSectionId,
			viewSections: state.panelDraftHistory.present.viewSections,
			sidebarCards: state.panelDraftHistory.present.sidebarCards,
			getLocalizedCardLabel,
			defaultCardTitle: getCardLabelFallback(nextIndex)
		});
		if (result.needsSection) {
			addSection();
			return;
		}
		if (result.nextSidebarCards !== state.panelDraftHistory.present.sidebarCards) {
			applySidebarDraftChange(result.nextSidebarCards);
		} else if (result.nextViewSections !== state.panelDraftHistory.present.viewSections) {
			applyDraftChange(result.nextViewSections);
		}
	}

	function setCardLibraryTab(tab: CardLibraryTab) {
		setState({ activeCardLibraryTab: tab });
	}

	function saveCardEditor() {
		const state = getState();
		if (!state.cardEditor) return;
		const existing = resolveEditingCardDraft(
			state.panelDraftHistory.present.sidebarCards,
			state.panelDraftHistory.present.viewSections,
			state.cardEditor
		);
		const result = saveCardEditorRuntime({
			zone: state.cardEditor.zone,
			id: state.cardEditor.id,
			viewSections: state.panelDraftHistory.present.viewSections,
			sidebarCards: state.panelDraftHistory.present.sidebarCards,
			title: state.cardEditorTitle,
			type: state.cardEditorType,
			entityId: state.cardEditorEntityId,
			analogStyle: state.cardEditorAnalogStyle,
			digitalStyle: state.cardEditorDigitalStyle,
			clockStyle: state.cardEditorClockStyle,
			clockShowAnalog: state.cardEditorClockShowAnalog,
			clockShowDigital: state.cardEditorClockShowDigital,
			clockHour12: state.cardEditorClockHour12,
			clockSeconds: state.cardEditorClockSeconds,
			dateLayout: state.cardEditorDateLayout,
			dateShortDay: state.cardEditorDateShortDay,
			dateShortMonth: state.cardEditorDateShortMonth,
			dateAlign: state.cardEditorDateAlign,
			dateWeekdayWithDate: state.cardEditorDateWeekdayWithDate,
			weatherForecastType: state.cardEditorWeatherForecastType,
			weatherForecastDaysToShow: state.cardEditorWeatherForecastDaysToShow,
			statusDomains: state.cardEditorStatusDomains,
			statusDeviceClasses: state.cardEditorStatusDeviceClasses,
			statusEntityIds: state.cardEditorStatusEntityIds,
			statusDiscoveredEntityIds:
				state.cardEditorStatusDiscoveredEntityIds ?? existing?.statusDiscoveredEntityIds,
			statusEntityAliases: state.cardEditorStatusEntityAliases,
			statusEntityIconOverrides: state.cardEditorStatusEntityIconOverrides,
			statusIcon: state.cardEditorStatusIcon,
			netEntityId: state.cardEditorNetEntityId,
			solarEntityId: state.cardEditorSolarEntityId,
			batteryEntityId: state.cardEditorBatteryEntityId,
			gridEntityId: state.cardEditorGridEntityId,
			batteryChargeEntityId: state.cardEditorBatteryChargeEntityId,
			importTodayEntityId: state.cardEditorImportTodayEntityId,
			exportTodayEntityId: state.cardEditorExportTodayEntityId,
			solarTodayEntityId: state.cardEditorSolarTodayEntityId,
			homeTodayEntityId: state.cardEditorHomeTodayEntityId,
			costTodayEntityId: state.cardEditorCostTodayEntityId,
			compensationTodayEntityId: state.cardEditorCompensationTodayEntityId,
			selfSufficiencyEntityId: state.cardEditorSelfSufficiencyEntityId,
			carChargingEntityId: state.cardEditorCarChargingEntityId,
			carCableEntityId: state.cardEditorCarCableEntityId,
			carChargingPowerEntityId: state.cardEditorCarChargingPowerEntityId,
			energyDeviceEntityIds: state.cardEditorEnergyDeviceEntityIds,
			energyDeviceTodayEntityIds: state.cardEditorEnergyDeviceTodayEntityIds,
			energyDeviceAliases: state.cardEditorEnergyDeviceAliases,
			hasCustomDayNoCar: state.cardEditorHasCustomDayNoCar,
			hasCustomDayWithCar: state.cardEditorHasCustomDayWithCar,
			hasCustomNightNoCar: state.cardEditorHasCustomNightNoCar,
			hasCustomNightWithCar: state.cardEditorHasCustomNightWithCar,
			anchorsDayNoCar: state.cardEditorAnchorsDayNoCar,
			anchorsDayWithCar: state.cardEditorAnchorsDayWithCar,
			anchorsNightNoCar: state.cardEditorAnchorsNightNoCar,
			anchorsNightWithCar: state.cardEditorAnchorsNightWithCar,
			cameras: state.cardEditorCameras,
			ignoredEntityIds: existing?.ignoredEntityIds ?? []
		});
		if (result.nextSidebarCards !== state.panelDraftHistory.present.sidebarCards) {
			applySidebarDraftChange(result.nextSidebarCards);
		} else if (result.nextViewSections !== state.panelDraftHistory.present.viewSections) {
			applyDraftChange(result.nextViewSections);
		}
		closeCardEditor();
	}

	function deleteCardFromEditor() {
		const state = getState();
		if (!state.cardEditor) return;
		const result = deleteCardEditorRuntime({
			zone: state.cardEditor.zone,
			id: state.cardEditor.id,
			viewSections: state.panelDraftHistory.present.viewSections,
			sidebarCards: state.panelDraftHistory.present.sidebarCards
		});
		if (result.nextSidebarCards !== state.panelDraftHistory.present.sidebarCards) {
			applySidebarDraftChange(result.nextSidebarCards);
		} else if (result.nextViewSections !== state.panelDraftHistory.present.viewSections) {
			applyDraftChange(result.nextViewSections);
		}
		closeCardEditor();
	}

	function saveSectionEditor() {
		const state = getState();
		if (!state.sectionEditorId) return;
		applyDraftChange(
			saveSectionEditorRuntime({
				sectionEditorId: state.sectionEditorId,
				sectionEditorTitle: state.sectionEditorTitle,
				sectionEditorIcon: state.sectionEditorIcon,
				sectionEditorHeaderTemperatureEntityId: state.sectionEditorHeaderTemperatureEntityId,
				sectionEditorHeaderHumidityEntityId: state.sectionEditorHeaderHumidityEntityId,
				sectionEditorHeaderPressureEntityId: state.sectionEditorHeaderPressureEntityId,
				sectionEditorColumn: state.sectionEditorColumn,
				sectionEditorSpan: state.sectionEditorSpan,
				sectionEditorCardColumns: state.sectionEditorCardColumns,
				selectedColumns: state.selectedColumns,
				viewSections: state.panelDraftHistory.present.viewSections,
				normalizeSectionPositions
			})
		);
		closeSectionEditor();
	}

	function deleteSectionFromEditor() {
		const state = getState();
		if (!state.sectionEditorId) return;
		applyDraftChange(
			deleteSectionEditorRuntime({
				sectionEditorId: state.sectionEditorId,
				viewSections: state.panelDraftHistory.present.viewSections,
				normalizeSectionPositions
			})
		);
		closeSectionEditor();
	}

	function moveSectionOrder(direction: -1 | 1) {
		const state = getState();
		if (!state.sectionEditorId) return;
		applyDraftChange(
			moveSectionOrderRuntime({
				viewSections: state.panelDraftHistory.present.viewSections,
				sectionEditorId: state.sectionEditorId,
				sectionEditorColumn: state.sectionEditorColumn,
				direction,
				selectedColumns: state.selectedColumns
			})
		);
	}

	return {
		openCardEditor,
		closeCardEditor,
		openSectionEditor,
		closeSectionEditor,
		addCardFromCatalog,
		setCardLibraryTab,
		saveCardEditor,
		deleteCardFromEditor,
		saveSectionEditor,
		deleteSectionFromEditor,
		moveSectionOrder
	};
}
