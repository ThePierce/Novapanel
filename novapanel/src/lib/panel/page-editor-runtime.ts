import type { CardDefinition } from '$lib/cards/store';
import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';
import {
	addCatalogCardToSection,
	addCatalogCardToSidebar,
	deleteCardInSections,
	deleteCardInSidebar,
	deleteSectionById,
	saveCardInSections,
	saveCardInSidebar,
	saveSectionEdits
} from '$lib/panel/editor-helpers';
import { moveSectionOrderInColumn } from '$lib/panel/dnd-helpers';

export function addCardFromCatalogRuntime(input: {
	selected: CardDefinition;
	activeViewSectionId: string;
	viewSections: ViewSectionDraft[];
	sidebarCards: CardDraft[];
	getLocalizedCardLabel: (type: string) => string;
	defaultCardTitle: string;
}) {
	if (input.selected.target === 'sidebar') {
		return {
			nextSidebarCards: addCatalogCardToSidebar(
				input.sidebarCards,
				input.selected,
				'' // Empty title by default — user can set it in the card editor
			),
			nextViewSections: input.viewSections,
			needsSection: false
		};
	}
	const sectionId = input.activeViewSectionId || input.viewSections[0]?.id;
	if (!sectionId) {
		return {
			nextSidebarCards: input.sidebarCards,
			nextViewSections: input.viewSections,
			needsSection: true
		};
	}
	const isEntityButton =
		input.selected.type === 'light_button' ||
		input.selected.type === 'climate_button' ||
		input.selected.type === 'cover_button' ||
		input.selected.type === 'vacuum_button' ||
		input.selected.type === 'media_player_button';
	return {
		nextSidebarCards: input.sidebarCards,
		nextViewSections: addCatalogCardToSection(
			input.viewSections,
			sectionId,
			input.selected,
			isEntityButton
				? ''
				: input.selected.type === 'custom'
					? input.defaultCardTitle
					: input.getLocalizedCardLabel(input.selected.type)
		),
		needsSection: false
	};
}

export function saveCardEditorRuntime(input: {
	zone: 'sidebar' | 'view';
	id: string;
	viewSections: ViewSectionDraft[];
	sidebarCards: CardDraft[];
	title: string;
	type: string;
	entityId?: string;
	analogStyle: 1 | 2 | 3 | 4;
	digitalStyle: 1 | 2 | 3 | 4;
	clockStyle?: CardDraft['clockStyle'];
	clockShowAnalog?: CardDraft['clockShowAnalog'];
	clockShowDigital?: CardDraft['clockShowDigital'];
	clockHour12?: CardDraft['clockHour12'];
	clockSeconds?: CardDraft['clockSeconds'];
	dateLayout?: CardDraft['dateLayout'];
	dateShortDay?: CardDraft['dateShortDay'];
	dateShortMonth?: CardDraft['dateShortMonth'];
	dateAlign?: CardDraft['dateAlign'];
	dateWeekdayWithDate?: CardDraft['dateWeekdayWithDate'];
	weatherForecastType?: CardDraft['weatherForecastType'];
	weatherForecastDaysToShow?: CardDraft['weatherForecastDaysToShow'];
	statusDomains?: CardDraft['statusDomains'];
	statusDeviceClasses?: CardDraft['statusDeviceClasses'];
	statusEntityIds?: CardDraft['statusEntityIds'];
	statusDiscoveredEntityIds?: CardDraft['statusDiscoveredEntityIds'];
	statusEntityAliases?: CardDraft['statusEntityAliases'];
	statusEntityIconOverrides?: CardDraft['statusEntityIconOverrides'];
	statusIcon?: CardDraft['statusIcon'];
	ignoredEntityIds?: CardDraft['ignoredEntityIds'];
	netEntityId?: string;
	solarEntityId?: string;
	batteryEntityId?: string;
	gridEntityId?: string;
	batteryChargeEntityId?: string;
	importTodayEntityId?: string;
	exportTodayEntityId?: string;
	solarTodayEntityId?: string;
	homeTodayEntityId?: string;
	costTodayEntityId?: string;
	compensationTodayEntityId?: string;
	selfSufficiencyEntityId?: string;
	carChargingEntityId?: string;
	carCableEntityId?: string;
	carChargingPowerEntityId?: string;
	energyDeviceEntityIds?: string[];
	energyDeviceTodayEntityIds?: string[];
	energyDeviceAliases?: CardDraft['energyDeviceAliases'];
	hasCustomDayNoCar?: boolean;
	hasCustomDayWithCar?: boolean;
	hasCustomNightNoCar?: boolean;
	hasCustomNightWithCar?: boolean;
	anchorsDayNoCar?: import('../persistence/panel-state-types').EnergyAnchors;
	anchorsDayWithCar?: import('../persistence/panel-state-types').EnergyAnchors;
	anchorsNightNoCar?: import('../persistence/panel-state-types').EnergyAnchors;
	anchorsNightWithCar?: import('../persistence/panel-state-types').EnergyAnchors;
	cameras?: import('../persistence/panel-state-types').CameraConfig[];
}) {
	if (input.zone === 'sidebar') {
		return {
			nextSidebarCards: saveCardInSidebar(
				input.sidebarCards,
				input.id,
				input.title,
				input.type,
				input.entityId,
				input.analogStyle,
				input.digitalStyle,
				input.clockStyle,
				input.clockShowAnalog,
				input.clockShowDigital,
				input.clockHour12,
				input.clockSeconds,
				input.dateLayout,
				input.dateShortDay,
				input.dateShortMonth,
				input.dateAlign,
				input.dateWeekdayWithDate,
				input.weatherForecastType,
				input.weatherForecastDaysToShow,
				input.statusDomains,
				input.statusDeviceClasses,
				input.statusEntityIds,
				input.statusDiscoveredEntityIds,
				input.statusEntityAliases,
				input.statusEntityIconOverrides,
				input.statusIcon,
				input.ignoredEntityIds,
				input.netEntityId,
				input.solarEntityId,
				input.batteryEntityId,
				input.gridEntityId,
				input.batteryChargeEntityId,
				input.importTodayEntityId,
				input.exportTodayEntityId,
				input.solarTodayEntityId,
				input.homeTodayEntityId,
				input.costTodayEntityId,
				input.compensationTodayEntityId,
				input.selfSufficiencyEntityId,
				input.carChargingEntityId,
				input.carCableEntityId,
				input.carChargingPowerEntityId,
				input.energyDeviceEntityIds,
				input.energyDeviceTodayEntityIds,
				input.energyDeviceAliases,
				input.hasCustomDayNoCar,
				input.hasCustomDayWithCar,
				input.hasCustomNightNoCar,
				input.hasCustomNightWithCar,
				input.anchorsDayNoCar,
				input.anchorsDayWithCar,
				input.anchorsNightNoCar,
				input.anchorsNightWithCar,
				input.cameras
			),
			nextViewSections: input.viewSections
		};
	}
	return {
		nextSidebarCards: input.sidebarCards,
		nextViewSections: saveCardInSections(
			input.viewSections,
			input.id,
			input.title,
			input.type,
			input.entityId,
			input.analogStyle,
			input.digitalStyle,
			input.clockStyle,
			input.clockShowAnalog,
			input.clockShowDigital,
			input.clockHour12,
			input.clockSeconds,
			input.dateLayout,
			input.dateShortDay,
			input.dateShortMonth,
			input.dateAlign,
			input.dateWeekdayWithDate,
			input.weatherForecastType,
			input.weatherForecastDaysToShow,
			input.statusDomains,
			input.statusDeviceClasses,
			input.statusEntityIds,
			input.statusDiscoveredEntityIds,
			input.statusEntityAliases,
			input.statusEntityIconOverrides,
			input.statusIcon,
			input.ignoredEntityIds,
			input.netEntityId,
			input.solarEntityId,
			input.batteryEntityId,
			input.gridEntityId,
			input.batteryChargeEntityId,
			input.importTodayEntityId,
			input.exportTodayEntityId,
			input.solarTodayEntityId,
			input.homeTodayEntityId,
			input.costTodayEntityId,
			input.compensationTodayEntityId,
			input.selfSufficiencyEntityId,
			input.carChargingEntityId,
			input.carCableEntityId,
			input.carChargingPowerEntityId,
			input.energyDeviceEntityIds,
			input.energyDeviceTodayEntityIds,
			input.energyDeviceAliases,
			input.hasCustomDayNoCar,
			input.hasCustomDayWithCar,
			input.hasCustomNightNoCar,
			input.hasCustomNightWithCar,
			input.anchorsDayNoCar,
			input.anchorsDayWithCar,
			input.anchorsNightNoCar,
			input.anchorsNightWithCar,
			input.cameras
		)
	};
}

export function deleteCardEditorRuntime(input: {
	zone: 'sidebar' | 'view';
	id: string;
	viewSections: ViewSectionDraft[];
	sidebarCards: CardDraft[];
}) {
	if (input.zone === 'sidebar') {
		return {
			nextSidebarCards: deleteCardInSidebar(input.sidebarCards, input.id),
			nextViewSections: input.viewSections
		};
	}
	return {
		nextSidebarCards: input.sidebarCards,
		nextViewSections: deleteCardInSections(input.viewSections, input.id)
	};
}

export function saveSectionEditorRuntime(input: {
	sectionEditorId: string;
	sectionEditorTitle: string;
	sectionEditorIcon: string;
	sectionEditorHeaderTemperatureEntityId: string;
	sectionEditorHeaderHumidityEntityId: string;
	sectionEditorHeaderPressureEntityId: string;
	sectionEditorColumn: number;
	sectionEditorSpan: number;
	sectionEditorCardColumns: 1 | 2;
	selectedColumns: 1 | 2 | 3;
	viewSections: ViewSectionDraft[];
	normalizeSectionPositions: (sections: ViewSectionDraft[]) => ViewSectionDraft[];
}) {
	const span = Math.max(1, Math.min(input.selectedColumns, input.sectionEditorSpan));
	const maxStartColumn = Math.max(1, input.selectedColumns - span + 1);
	const column = Math.max(1, Math.min(maxStartColumn, input.sectionEditorColumn));
	return input.normalizeSectionPositions(
		saveSectionEdits(
			input.viewSections,
			input.sectionEditorId,
			input.sectionEditorTitle,
			input.sectionEditorIcon,
			input.sectionEditorHeaderTemperatureEntityId,
			input.sectionEditorHeaderHumidityEntityId,
			input.sectionEditorHeaderPressureEntityId,
			column,
			span,
			input.sectionEditorCardColumns
		)
	);
}

export function deleteSectionEditorRuntime(input: {
	sectionEditorId: string;
	viewSections: ViewSectionDraft[];
	normalizeSectionPositions: (sections: ViewSectionDraft[]) => ViewSectionDraft[];
}) {
	return input.normalizeSectionPositions(deleteSectionById(input.viewSections, input.sectionEditorId));
}

export function moveSectionOrderRuntime(input: {
	viewSections: ViewSectionDraft[];
	sectionEditorId: string;
	sectionEditorColumn: number;
	direction: -1 | 1;
	selectedColumns: 1 | 2 | 3;
}) {
	return moveSectionOrderInColumn(
		input.viewSections,
		input.sectionEditorId,
		input.sectionEditorColumn,
		input.direction,
		input.selectedColumns
	);
}
