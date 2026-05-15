import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';
import type { ClockStyle } from '$lib/persistence/panel-state-types';

export type CardEditorOpenState = {
	title: string;
	type: string;
	entityId?: string;
	analogStyle: 1 | 2 | 3 | 4;
	digitalStyle: 1 | 2 | 3 | 4;
	clockStyle?: ClockStyle;
	clockShowAnalog?: boolean;
	clockShowDigital?: boolean;
	clockHour12?: boolean;
	clockSeconds?: boolean;
	dateLayout?: CardDraft['dateLayout'];
	dateShortDay?: boolean;
	dateShortMonth?: boolean;
	dateAlign?: CardDraft['dateAlign'];
	dateWeekdayWithDate?: boolean;
	weatherForecastType?: CardDraft['weatherForecastType'];
	weatherForecastDaysToShow?: CardDraft['weatherForecastDaysToShow'];
	statusDomains?: CardDraft['statusDomains'];
	statusDeviceClasses?: CardDraft['statusDeviceClasses'];
	statusEntityIds?: CardDraft['statusEntityIds'];
	statusDiscoveredEntityIds?: CardDraft['statusDiscoveredEntityIds'];
	statusEntityAliases?: CardDraft['statusEntityAliases'];
	statusIcon?: CardDraft['statusIcon'];
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
	initialCameras?: import('../persistence/panel-state-types').CameraConfig[];
	initialNetEntityId?: string;
	initialSolarEntityId?: string;
	initialBatteryEntityId?: string;
	initialGridEntityId?: string;
	initialBatteryChargeEntityId?: string;
	initialImportTodayEntityId?: string;
	initialExportTodayEntityId?: string;
	initialSolarTodayEntityId?: string;
	initialHomeTodayEntityId?: string;
	initialCostTodayEntityId?: string;
	initialCompensationTodayEntityId?: string;
	initialSelfSufficiencyEntityId?: string;
	initialCarChargingEntityId?: string;
	initialCarCableEntityId?: string;
	initialCarChargingPowerEntityId?: string;
	initialHasCustomDayNoCar?: boolean;
	initialHasCustomDayWithCar?: boolean;
	initialHasCustomNightNoCar?: boolean;
	initialHasCustomNightWithCar?: boolean;
	initialAnchorsDayNoCar?: import('../persistence/panel-state-types').EnergyAnchors;
	initialAnchorsDayWithCar?: import('../persistence/panel-state-types').EnergyAnchors;
	initialAnchorsNightNoCar?: import('../persistence/panel-state-types').EnergyAnchors;
	initialAnchorsNightWithCar?: import('../persistence/panel-state-types').EnergyAnchors;
	initialTitle: string;
	initialType: string;
	initialEntityId?: string;
	initialAnalogStyle: 1 | 2 | 3 | 4;
	initialDigitalStyle: 1 | 2 | 3 | 4;
	initialClockStyle?: ClockStyle;
	initialClockShowAnalog?: boolean;
	initialClockShowDigital?: boolean;
	initialClockHour12?: boolean;
	initialClockSeconds?: boolean;
	initialDateLayout?: CardDraft['dateLayout'];
	initialDateShortDay?: boolean;
	initialDateShortMonth?: boolean;
	initialDateAlign?: CardDraft['dateAlign'];
	initialDateWeekdayWithDate?: boolean;
	initialWeatherForecastType?: CardDraft['weatherForecastType'];
	initialWeatherForecastDaysToShow?: CardDraft['weatherForecastDaysToShow'];
	initialStatusDomains?: CardDraft['statusDomains'];
	initialStatusDeviceClasses?: CardDraft['statusDeviceClasses'];
	initialStatusEntityIds?: CardDraft['statusEntityIds'];
	initialStatusDiscoveredEntityIds?: CardDraft['statusDiscoveredEntityIds'];
	initialStatusEntityAliases?: CardDraft['statusEntityAliases'];
	initialStatusIcon?: CardDraft['statusIcon'];
	initialEnergyDeviceAliases?: CardDraft['energyDeviceAliases'];
};

export function resolveCardForEditor(
	zone: 'sidebar' | 'view',
	id: string,
	sidebarCards: CardDraft[],
	viewSections: ViewSectionDraft[]
): CardDraft | null {
	if (zone === 'sidebar') {
		return sidebarCards.find((card) => card.id === id) ?? null;
	}
	return viewSections.flatMap((section) => section.cards).find((card) => card.id === id) ?? null;
}

export function buildCardEditorOpenState(card: CardDraft): CardEditorOpenState {
	const analogStyle = card.analogClockStyle ?? 1;
	const digitalStyle = card.digitalClockStyle ?? 1;
	const statusIcon =
		card.statusIcon ??
		(card.cardType === 'light_button'
			? 'mdi:lightbulb-outline'
			: card.cardType === 'climate_button'
				? 'mdi:thermostat'
				: card.cardType === 'cover_button'
					? 'mdi:curtains'
					: card.cardType === 'vacuum_button'
						? 'mdi:robot-vacuum'
						: card.cardType === 'media_player_button'
							? 'mdi:speaker'
							: undefined);
	return {
		title: card.title,
		type: card.cardType,
		entityId: card.cardType === 'alarm_panel' ? card.alarmEntityId ?? card.entityId : card.entityId,
		analogStyle,
		digitalStyle,
		clockStyle: card.clockStyle,
		clockShowAnalog: card.clockShowAnalog,
		clockShowDigital: card.clockShowDigital,
		clockHour12: card.clockHour12,
		clockSeconds: card.clockSeconds,
		dateLayout: card.dateLayout,
		dateShortDay: card.dateShortDay,
		dateShortMonth: card.dateShortMonth,
		dateAlign: card.dateAlign,
		dateWeekdayWithDate: card.dateWeekdayWithDate,
		weatherForecastType: card.weatherForecastType,
		weatherForecastDaysToShow: card.weatherForecastDaysToShow,
		statusDomains: card.statusDomains,
		statusDeviceClasses: card.statusDeviceClasses,
		statusEntityIds: card.statusEntityIds,
		statusDiscoveredEntityIds: card.statusDiscoveredEntityIds,
		statusEntityAliases: card.statusEntityAliases,
		statusIcon,
		netEntityId: card.netEntityId,
		solarEntityId: card.solarEntityId,
		batteryEntityId: card.batteryEntityId,
		gridEntityId: card.gridEntityId,
		batteryChargeEntityId: card.batteryChargeEntityId,
		importTodayEntityId: card.importTodayEntityId,
		exportTodayEntityId: card.exportTodayEntityId,
		solarTodayEntityId: card.solarTodayEntityId,
		homeTodayEntityId: card.homeTodayEntityId,
		costTodayEntityId: card.costTodayEntityId,
		compensationTodayEntityId: card.compensationTodayEntityId,
		selfSufficiencyEntityId: card.selfSufficiencyEntityId,
		carChargingEntityId: card.carChargingEntityId,
		carCableEntityId: card.carCableEntityId,
		carChargingPowerEntityId: card.carChargingPowerEntityId,
		energyDeviceEntityIds: card.energyDeviceEntityIds,
		energyDeviceTodayEntityIds: card.energyDeviceTodayEntityIds,
		energyDeviceAliases: card.energyDeviceAliases,
		hasCustomDayNoCar: card.hasCustomDayNoCar,
		hasCustomDayWithCar: card.hasCustomDayWithCar,
		hasCustomNightNoCar: card.hasCustomNightNoCar,
		hasCustomNightWithCar: card.hasCustomNightWithCar,
		anchorsDayNoCar: card.anchorsDayNoCar,
		anchorsDayWithCar: card.anchorsDayWithCar,
		anchorsNightNoCar: card.anchorsNightNoCar,
		anchorsNightWithCar: card.anchorsNightWithCar,
		cameras: card.cameras,
		initialTitle: card.title,
		initialType: card.cardType,
		initialEntityId: card.cardType === 'alarm_panel' ? card.alarmEntityId ?? card.entityId : card.entityId,
		initialAnalogStyle: analogStyle,
		initialDigitalStyle: digitalStyle,
		initialClockStyle: card.clockStyle,
		initialClockShowAnalog: card.clockShowAnalog,
		initialClockShowDigital: card.clockShowDigital,
		initialClockHour12: card.clockHour12,
		initialClockSeconds: card.clockSeconds,
		initialDateLayout: card.dateLayout,
		initialDateShortDay: card.dateShortDay,
		initialDateShortMonth: card.dateShortMonth,
		initialDateAlign: card.dateAlign,
		initialDateWeekdayWithDate: card.dateWeekdayWithDate,
		initialWeatherForecastType: card.weatherForecastType,
		initialWeatherForecastDaysToShow: card.weatherForecastDaysToShow,
		initialStatusDomains: card.statusDomains,
		initialStatusDeviceClasses: card.statusDeviceClasses,
		initialStatusEntityIds: card.statusEntityIds,
		initialStatusDiscoveredEntityIds: card.statusDiscoveredEntityIds,
		initialStatusEntityAliases: card.statusEntityAliases,
		initialStatusIcon: statusIcon,
		initialNetEntityId: card.netEntityId,
		initialSolarEntityId: card.solarEntityId,
		initialBatteryEntityId: card.batteryEntityId,
		initialGridEntityId: card.gridEntityId,
		initialBatteryChargeEntityId: card.batteryChargeEntityId,
		initialImportTodayEntityId: card.importTodayEntityId,
		initialExportTodayEntityId: card.exportTodayEntityId,
		initialSolarTodayEntityId: card.solarTodayEntityId,
		initialHomeTodayEntityId: card.homeTodayEntityId,
		initialCostTodayEntityId: card.costTodayEntityId,
		initialCompensationTodayEntityId: card.compensationTodayEntityId,
		initialSelfSufficiencyEntityId: card.selfSufficiencyEntityId,
		initialCarChargingEntityId: card.carChargingEntityId,
		initialCarCableEntityId: card.carCableEntityId,
		initialCarChargingPowerEntityId: card.carChargingPowerEntityId,
		initialEnergyDeviceEntityIds: card.energyDeviceEntityIds,
		initialEnergyDeviceTodayEntityIds: card.energyDeviceTodayEntityIds,
		initialEnergyDeviceAliases: card.energyDeviceAliases,
		initialHasCustomDayNoCar: card.hasCustomDayNoCar,
		initialHasCustomDayWithCar: card.hasCustomDayWithCar,
		initialHasCustomNightNoCar: card.hasCustomNightNoCar,
		initialHasCustomNightWithCar: card.hasCustomNightWithCar,
		initialAnchorsDayNoCar: card.anchorsDayNoCar,
		initialAnchorsDayWithCar: card.anchorsDayWithCar,
		initialAnchorsNightNoCar: card.anchorsNightNoCar,
		initialAnchorsNightWithCar: card.anchorsNightWithCar,
		initialCameras: card.cameras
	};
}

export type SectionEditorOpenState = {
	id: string;
	title: string;
	icon: string;
	headerTemperatureEntityId: string;
	headerHumidityEntityId: string;
	headerPressureEntityId: string;
	column: number;
	span: number;
	cardColumns: 1 | 2;
	initialTitle: string;
	initialIcon: string;
	initialHeaderTemperatureEntityId: string;
	initialHeaderHumidityEntityId: string;
	initialHeaderPressureEntityId: string;
	initialColumn: number;
	initialSpan: number;
	initialCardColumns: 1 | 2;
};

export function resolveSectionForEditor(
	sectionId: string,
	viewSections: ViewSectionDraft[]
): ViewSectionDraft | null {
	return viewSections.find((entry) => entry.id === sectionId) ?? null;
}

export function buildSectionEditorOpenState(section: ViewSectionDraft): SectionEditorOpenState {
	const span = section.span ?? 1;
	const cardColumns = section.cardColumns === 2 ? 2 : 1;
	const icon = section.icon?.trim() || 'layout-grid';
	const headerTemperatureEntityId = section.headerTemperatureEntityId?.trim() || '';
	const headerHumidityEntityId = section.headerHumidityEntityId?.trim() || '';
	const headerPressureEntityId = section.headerPressureEntityId?.trim() || '';
	return {
		id: section.id,
		title: section.title,
		icon,
		headerTemperatureEntityId,
		headerHumidityEntityId,
		headerPressureEntityId,
		column: section.column,
		span,
		cardColumns,
		initialTitle: section.title,
		initialIcon: icon,
		initialHeaderTemperatureEntityId: headerTemperatureEntityId,
		initialHeaderHumidityEntityId: headerHumidityEntityId,
		initialHeaderPressureEntityId: headerPressureEntityId,
		initialColumn: section.column,
		initialSpan: span,
		initialCardColumns: cardColumns
	};
}
