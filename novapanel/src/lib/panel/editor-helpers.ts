import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';
import type { CardDefinition } from '$lib/cards/store';
import type { ClockStyle } from '$lib/persistence/panel-state-types';

function asClockStyle(value: unknown): ClockStyle | undefined {
	if (
		value === 'digital' ||
		value === 'classic' ||
		value === 'luxury_gold' ||
		value === 'luxury_steel' ||
		value === 'minimal' ||
		value === 'dark' ||
		value === 'dots'
	) {
		return value;
	}
	return undefined;
}

function defaultEntityButtonIcon(cardType: string): string | undefined {
	if (cardType === 'light_button') return 'mdi:lightbulb-outline';
	if (cardType === 'climate_button') return 'mdi:thermostat';
	if (cardType === 'cover_button') return 'mdi:curtains';
	if (cardType === 'vacuum_button') return 'mdi:robot-vacuum';
	if (cardType === 'media_player_button') return 'mdi:speaker';
	return undefined;
}

function isEntityButtonType(cardType: string): boolean {
	return (
		cardType === 'light_button' ||
		cardType === 'climate_button' ||
		cardType === 'cover_button' ||
		cardType === 'vacuum_button' ||
		cardType === 'media_player_button'
	);
}

export function addCatalogCardToSidebar(
	cards: CardDraft[],
	selected: CardDefinition,
	title: string
): CardDraft[] {
	const nextId = `${selected.target}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	return [
		...cards,
		{
			id: nextId,
			title,
			cardType: selected.type,
			entityId: undefined,
			analogClockStyle: selected.type === 'clock' ? selected.preview.analogStyle : undefined,
			digitalClockStyle: selected.type === 'clock' ? selected.preview.digitalStyle : undefined,
			clockStyle: selected.type === 'clock' ? 'digital' : undefined,
			clockShowAnalog: selected.type === 'clock' ? false : undefined,
			clockShowDigital: selected.type === 'clock' ? true : undefined,
			clockHour12: undefined,
			clockSeconds: selected.type === 'clock' ? false : undefined,
			dateLayout: selected.type === 'date' ? 'vertical' : undefined,
			dateShortDay: selected.type === 'date' ? false : undefined,
			dateShortMonth: selected.type === 'date' ? false : undefined,
			dateAlign: selected.type === 'date' ? 'center' : undefined,
			dateWeekdayWithDate: selected.type === 'date' ? false : undefined,
			weatherForecastType: selected.type === 'weather_forecast' ? 'daily' : undefined,
			weatherForecastDaysToShow: selected.type === 'weather_forecast' ? 5 : undefined,
			alarmEntityId: selected.type === 'alarm_panel' ? undefined : undefined,
			statusDomains:
				selected.type === 'lights_status'
					? ['light']
					: selected.type === 'openings_status'
						? ['binary_sensor']
						: selected.type === 'devices_status'
							? ['switch', 'light', 'fan', 'media_player', 'climate']
							: selected.type === 'availability_status'
								? ['all']
								: selected.type === 'media_players_status'
									? ['media_player']
								: undefined,
			statusDeviceClasses:
				selected.type === 'openings_status' ? ['door', 'window', 'opening'] : undefined,
			statusEntityIds: undefined,
			statusDiscoveredEntityIds:
				selected.type === 'lights_status' ||
				selected.type === 'openings_status' ||
				selected.type === 'devices_status' ||
				selected.type === 'availability_status'
					? []
					: undefined,
			statusIcon:
				selected.type === 'lights_status'
					? 'lightbulb'
					: defaultEntityButtonIcon(selected.type)
						? defaultEntityButtonIcon(selected.type)
					: selected.type === 'openings_status'
						? 'door_open'
						: selected.type === 'devices_status'
							? 'plug'
							: selected.type === 'alarm_panel'
								? 'mdi:shield-off-outline'
							: selected.type === 'availability_status'
								? 'availability'
								: selected.type === 'media_players_status'
									? 'mdi:audio-video'
								: undefined,
			ignoredEntityIds: []
		}
	];
}

export function addCatalogCardToSection(
	sections: ViewSectionDraft[],
	sectionId: string,
	selected: CardDefinition,
	title: string
): ViewSectionDraft[] {
	const nextId = `${selected.target}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	return sections.map((section) =>
		section.id === sectionId
			? {
					...section,
					cards: [
						...section.cards,
						{
							id: nextId,
							title,
							cardType: selected.type,
							entityId: undefined,
							analogClockStyle: selected.type === 'clock' ? selected.preview.analogStyle : undefined,
							digitalClockStyle: selected.type === 'clock' ? selected.preview.digitalStyle : undefined,
							clockStyle: selected.type === 'clock' ? 'digital' : undefined,
							clockShowAnalog: selected.type === 'clock' ? false : undefined,
							clockShowDigital: selected.type === 'clock' ? true : undefined,
							clockHour12: undefined,
							clockSeconds: selected.type === 'clock' ? false : undefined,
							dateLayout: selected.type === 'date' ? 'vertical' : undefined,
							dateShortDay: selected.type === 'date' ? false : undefined,
							dateShortMonth: selected.type === 'date' ? false : undefined,
							dateAlign: selected.type === 'date' ? 'center' : undefined,
							dateWeekdayWithDate: selected.type === 'date' ? false : undefined,
							statusDomains:
								selected.type === 'lights_status'
									? ['light']
									: selected.type === 'openings_status'
										? ['binary_sensor']
										: selected.type === 'devices_status'
											? ['switch', 'light', 'fan', 'media_player', 'climate']
											: selected.type === 'availability_status'
												? ['all']
												: selected.type === 'media_players_status'
													? ['media_player']
												: undefined,
							statusDeviceClasses:
								selected.type === 'openings_status' ? ['door', 'window', 'opening'] : undefined,
							statusEntityIds: undefined,
							statusDiscoveredEntityIds:
								selected.type === 'lights_status' ||
								selected.type === 'openings_status' ||
								selected.type === 'devices_status' ||
								selected.type === 'availability_status'
									? []
									: undefined,
							statusIcon:
								selected.type === 'lights_status'
									? 'lightbulb'
									: defaultEntityButtonIcon(selected.type)
										? defaultEntityButtonIcon(selected.type)
									: selected.type === 'openings_status'
										? 'door_open'
										: selected.type === 'devices_status'
											? 'plug'
											: selected.type === 'alarm_panel'
												? 'mdi:shield-off-outline'
											: selected.type === 'availability_status'
												? 'availability'
												: selected.type === 'media_players_status'
													? 'mdi:audio-video'
													: undefined,
							ignoredEntityIds: []
						}
					]
				}
			: section
	);
}

export function saveCardEdits(
	card: CardDraft,
	title: string,
	cardType: string,
	entityId: string | undefined,
	analogStyle: 1 | 2 | 3 | 4,
	digitalStyle: 1 | 2 | 3 | 4,
	clockStyle?: ClockStyle,
	clockShowAnalog?: boolean,
	clockShowDigital?: boolean,
	clockHour12?: boolean,
	clockSeconds?: boolean,
	dateLayout?: CardDraft['dateLayout'],
	dateShortDay?: CardDraft['dateShortDay'],
	dateShortMonth?: CardDraft['dateShortMonth'],
	dateAlign?: CardDraft['dateAlign'],
	dateWeekdayWithDate?: CardDraft['dateWeekdayWithDate'],
	weatherForecastType?: CardDraft['weatherForecastType'],
	weatherForecastDaysToShow?: CardDraft['weatherForecastDaysToShow'],
	statusDomains?: CardDraft['statusDomains'],
	statusDeviceClasses?: CardDraft['statusDeviceClasses'],
	statusEntityIds?: CardDraft['statusEntityIds'],
	statusDiscoveredEntityIds?: CardDraft['statusDiscoveredEntityIds'],
	statusIcon?: CardDraft['statusIcon'],
	ignoredEntityIds?: CardDraft['ignoredEntityIds'],
	netEntityId?: string,
	solarEntityId?: string,
	batteryEntityId?: string,
	gridEntityId?: string,
	batteryChargeEntityId?: string,
	importTodayEntityId?: string,
	exportTodayEntityId?: string,
	solarTodayEntityId?: string,
	homeTodayEntityId?: string,
	costTodayEntityId?: string,
	compensationTodayEntityId?: string,
	selfSufficiencyEntityId?: string,
	carChargingEntityId?: string,
	carCableEntityId?: string,
	carChargingPowerEntityId?: string,
	energyDeviceEntityIds?: string[],
	energyDeviceTodayEntityIds?: string[],
	hasCustomDayNoCar?: boolean,
	hasCustomDayWithCar?: boolean,
	hasCustomNightNoCar?: boolean,
	hasCustomNightWithCar?: boolean,
	anchorsDayNoCar?: import('../persistence/panel-state-types').EnergyAnchors,
	anchorsDayWithCar?: import('../persistence/panel-state-types').EnergyAnchors,
	anchorsNightNoCar?: import('../persistence/panel-state-types').EnergyAnchors,
	anchorsNightWithCar?: import('../persistence/panel-state-types').EnergyAnchors,
	cameras?: import('../persistence/panel-state-types').CameraConfig[]
): CardDraft {
	return {
		...card,
		title,
		cardType,
		entityId: entityId && entityId.trim().length > 0 ? entityId.trim() : undefined,
		alarmEntityId:
			cardType === 'alarm_panel' && entityId && entityId.trim().length > 0
				? entityId.trim()
				: undefined,
		analogClockStyle: cardType === 'clock' ? analogStyle : undefined,
		digitalClockStyle: cardType === 'clock' ? digitalStyle : undefined,
		clockStyle: cardType === 'clock' ? asClockStyle(clockStyle) : undefined,
		clockShowAnalog: cardType === 'clock' ? clockShowAnalog : undefined,
		clockShowDigital: cardType === 'clock' ? clockShowDigital : undefined,
		clockHour12: cardType === 'clock' ? clockHour12 : undefined,
		clockSeconds: cardType === 'clock' ? clockSeconds : undefined,
		dateLayout: cardType === 'date' ? dateLayout : undefined,
		dateShortDay: cardType === 'date' ? dateShortDay : undefined,
		dateShortMonth: cardType === 'date' ? dateShortMonth : undefined,
		dateAlign: cardType === 'date' ? dateAlign : undefined,
		dateWeekdayWithDate: cardType === 'date' ? dateWeekdayWithDate : undefined,
		weatherForecastType: cardType === 'weather_forecast' ? weatherForecastType : undefined,
		weatherForecastDaysToShow: cardType === 'weather_forecast' ? weatherForecastDaysToShow : undefined,
		statusDomains:
			cardType === 'lights_status' ||
			cardType === 'openings_status' ||
			cardType === 'devices_status' ||
			cardType === 'availability_status' ||
			cardType === 'media_players_status'
				? statusDomains
				: undefined,
		statusDeviceClasses: cardType === 'openings_status' ? statusDeviceClasses : undefined,
		statusEntityIds:
			cardType === 'lights_status' ||
			cardType === 'openings_status' ||
			cardType === 'devices_status' ||
			cardType === 'availability_status' ||
			cardType === 'media_players_status'
				? statusEntityIds
				: undefined,
		statusDiscoveredEntityIds:
			cardType === 'lights_status' ||
			cardType === 'openings_status' ||
			cardType === 'devices_status' ||
			cardType === 'availability_status'
				? statusDiscoveredEntityIds
				: undefined,
		statusIcon:
			cardType === 'alarm_panel' ||
			isEntityButtonType(cardType) ||
			cardType === 'lights_status' ||
			cardType === 'openings_status' ||
			cardType === 'devices_status' ||
			cardType === 'availability_status' ||
			cardType === 'media_players_status'
				? statusIcon
				: undefined,
		ignoredEntityIds:
			cardType === 'lights_status' ||
			cardType === 'openings_status' ||
			cardType === 'devices_status' ||
			cardType === 'availability_status' ||
			cardType === 'media_players_status'
				? ignoredEntityIds
				: undefined,
		netEntityId:
			cardType === 'energy' && typeof netEntityId === 'string' && netEntityId.trim().length > 0
				? netEntityId.trim()
				: undefined,
		solarEntityId:
			cardType === 'energy' && typeof solarEntityId === 'string' && solarEntityId.trim().length > 0
				? solarEntityId.trim()
				: undefined,
		batteryEntityId:
			cardType === 'energy' && typeof batteryEntityId === 'string' && batteryEntityId.trim().length > 0
				? batteryEntityId.trim()
				: undefined,
		gridEntityId:
			cardType === 'energy' && typeof gridEntityId === 'string' && gridEntityId.trim().length > 0
				? gridEntityId.trim()
				: undefined,
		batteryChargeEntityId:
			cardType === 'energy' &&
			typeof batteryChargeEntityId === 'string' &&
			batteryChargeEntityId.trim().length > 0
				? batteryChargeEntityId.trim()
				: undefined,
		importTodayEntityId:
			cardType === 'energy' && typeof importTodayEntityId === 'string' && importTodayEntityId.trim().length > 0
				? importTodayEntityId.trim()
				: undefined,
		exportTodayEntityId:
			cardType === 'energy' && typeof exportTodayEntityId === 'string' && exportTodayEntityId.trim().length > 0
				? exportTodayEntityId.trim()
				: undefined,
		solarTodayEntityId:
			cardType === 'energy' && typeof solarTodayEntityId === 'string' && solarTodayEntityId.trim().length > 0
				? solarTodayEntityId.trim()
				: undefined,
		homeTodayEntityId:
			cardType === 'energy' && typeof homeTodayEntityId === 'string' && homeTodayEntityId.trim().length > 0
				? homeTodayEntityId.trim()
				: undefined,
		costTodayEntityId:
			cardType === 'energy' && typeof costTodayEntityId === 'string' && costTodayEntityId.trim().length > 0
				? costTodayEntityId.trim()
				: undefined,
		compensationTodayEntityId:
			cardType === 'energy' && typeof compensationTodayEntityId === 'string' && compensationTodayEntityId.trim().length > 0
				? compensationTodayEntityId.trim()
				: undefined,
		selfSufficiencyEntityId:
			cardType === 'energy' && typeof selfSufficiencyEntityId === 'string' && selfSufficiencyEntityId.trim().length > 0
				? selfSufficiencyEntityId.trim()
				: undefined,
		carChargingEntityId:
			cardType === 'energy' && typeof carChargingEntityId === 'string' && carChargingEntityId.trim().length > 0
				? carChargingEntityId.trim()
				: undefined,
		carCableEntityId:
			cardType === 'energy' && typeof carCableEntityId === 'string' && carCableEntityId.trim().length > 0
				? carCableEntityId.trim()
				: undefined,
		carChargingPowerEntityId:
			cardType === 'energy' && typeof carChargingPowerEntityId === 'string' && carChargingPowerEntityId.trim().length > 0
				? carChargingPowerEntityId.trim()
				: undefined,
		energyDeviceEntityIds:
			cardType === 'energy' && Array.isArray(energyDeviceEntityIds) && energyDeviceEntityIds.length > 0
				? energyDeviceEntityIds.map((v) => v.trim()).filter((v) => v.length > 0)
				: undefined,
		energyDeviceTodayEntityIds:
			cardType === 'energy' && Array.isArray(energyDeviceTodayEntityIds) && energyDeviceTodayEntityIds.length > 0
				? energyDeviceTodayEntityIds.map((v) => v.trim()).filter((v) => v.length > 0)
				: undefined,
		hasCustomDayNoCar: cardType === 'energy' && hasCustomDayNoCar === true ? true : undefined,
		hasCustomDayWithCar: cardType === 'energy' && hasCustomDayWithCar === true ? true : undefined,
		hasCustomNightNoCar: cardType === 'energy' && hasCustomNightNoCar === true ? true : undefined,
		hasCustomNightWithCar: cardType === 'energy' && hasCustomNightWithCar === true ? true : undefined,
		anchorsDayNoCar: cardType === 'energy' ? anchorsDayNoCar : undefined,
		anchorsDayWithCar: cardType === 'energy' ? anchorsDayWithCar : undefined,
		anchorsNightNoCar: cardType === 'energy' ? anchorsNightNoCar : undefined,
		anchorsNightWithCar: cardType === 'energy' ? anchorsNightWithCar : undefined,
		cameras:
			(cardType === 'cameras_strip' || cardType === 'week_calendar') &&
			Array.isArray(cameras) &&
			cameras.length > 0
				? cameras
				: undefined
	};
}

export function saveCardInSidebar(
	cards: CardDraft[],
	cardId: string,
	title: string,
	cardType: string,
	entityId: string | undefined,
	analogStyle: 1 | 2 | 3 | 4,
	digitalStyle: 1 | 2 | 3 | 4,
	clockStyle?: ClockStyle,
	clockShowAnalog?: boolean,
	clockShowDigital?: boolean,
	clockHour12?: boolean,
	clockSeconds?: boolean,
	dateLayout?: CardDraft['dateLayout'],
	dateShortDay?: CardDraft['dateShortDay'],
	dateShortMonth?: CardDraft['dateShortMonth'],
	dateAlign?: CardDraft['dateAlign'],
	dateWeekdayWithDate?: CardDraft['dateWeekdayWithDate'],
	weatherForecastType?: CardDraft['weatherForecastType'],
	weatherForecastDaysToShow?: CardDraft['weatherForecastDaysToShow'],
	statusDomains?: CardDraft['statusDomains'],
	statusDeviceClasses?: CardDraft['statusDeviceClasses'],
	statusEntityIds?: CardDraft['statusEntityIds'],
	statusDiscoveredEntityIds?: CardDraft['statusDiscoveredEntityIds'],
	statusIcon?: CardDraft['statusIcon'],
	ignoredEntityIds?: CardDraft['ignoredEntityIds'],
	netEntityId?: string,
	solarEntityId?: string,
	batteryEntityId?: string,
	gridEntityId?: string,
	batteryChargeEntityId?: string,
	importTodayEntityId?: string,
	exportTodayEntityId?: string,
	solarTodayEntityId?: string,
	homeTodayEntityId?: string,
	costTodayEntityId?: string,
	compensationTodayEntityId?: string,
	selfSufficiencyEntityId?: string,
	carChargingEntityId?: string,
	carCableEntityId?: string,
	carChargingPowerEntityId?: string,
	energyDeviceEntityIds?: string[],
	energyDeviceTodayEntityIds?: string[],
	hasCustomDayNoCar?: boolean,
	hasCustomDayWithCar?: boolean,
	hasCustomNightNoCar?: boolean,
	hasCustomNightWithCar?: boolean,
	anchorsDayNoCar?: import('../persistence/panel-state-types').EnergyAnchors,
	anchorsDayWithCar?: import('../persistence/panel-state-types').EnergyAnchors,
	anchorsNightNoCar?: import('../persistence/panel-state-types').EnergyAnchors,
	anchorsNightWithCar?: import('../persistence/panel-state-types').EnergyAnchors,
	cameras?: import('../persistence/panel-state-types').CameraConfig[]
): CardDraft[] {
	return cards.map((card) =>
		card.id === cardId
			? saveCardEdits(
					card,
					title,
					cardType,
					entityId,
					analogStyle,
					digitalStyle,
					clockStyle,
					clockShowAnalog,
					clockShowDigital,
					clockHour12,
					clockSeconds,
					dateLayout,
					dateShortDay,
					dateShortMonth,
					dateAlign,
					dateWeekdayWithDate,
					weatherForecastType,
					weatherForecastDaysToShow,
					statusDomains,
					statusDeviceClasses,
					statusEntityIds,
					statusDiscoveredEntityIds,
					statusIcon,
					ignoredEntityIds,
					netEntityId,
					solarEntityId,
					batteryEntityId,
					gridEntityId,
					batteryChargeEntityId,
					importTodayEntityId,
					exportTodayEntityId,
					solarTodayEntityId,
					homeTodayEntityId,
					costTodayEntityId,
					compensationTodayEntityId,
					selfSufficiencyEntityId,
					carChargingEntityId,
					carCableEntityId,
					carChargingPowerEntityId,
					energyDeviceEntityIds,
					energyDeviceTodayEntityIds,
					hasCustomDayNoCar,
					hasCustomDayWithCar,
					hasCustomNightNoCar,
					hasCustomNightWithCar,
					anchorsDayNoCar,
					anchorsDayWithCar,
					anchorsNightNoCar,
					anchorsNightWithCar,
					cameras
				)
			: card
	);
}

export function saveCardInSections(
	sections: ViewSectionDraft[],
	cardId: string,
	title: string,
	cardType: string,
	entityId: string | undefined,
	analogStyle: 1 | 2 | 3 | 4,
	digitalStyle: 1 | 2 | 3 | 4,
	clockStyle?: ClockStyle,
	clockShowAnalog?: boolean,
	clockShowDigital?: boolean,
	clockHour12?: boolean,
	clockSeconds?: boolean,
	dateLayout?: CardDraft['dateLayout'],
	dateShortDay?: CardDraft['dateShortDay'],
	dateShortMonth?: CardDraft['dateShortMonth'],
	dateAlign?: CardDraft['dateAlign'],
	dateWeekdayWithDate?: CardDraft['dateWeekdayWithDate'],
	weatherForecastType?: CardDraft['weatherForecastType'],
	weatherForecastDaysToShow?: CardDraft['weatherForecastDaysToShow'],
	statusDomains?: CardDraft['statusDomains'],
	statusDeviceClasses?: CardDraft['statusDeviceClasses'],
	statusEntityIds?: CardDraft['statusEntityIds'],
	statusDiscoveredEntityIds?: CardDraft['statusDiscoveredEntityIds'],
	statusIcon?: CardDraft['statusIcon'],
	ignoredEntityIds?: CardDraft['ignoredEntityIds'],
	netEntityId?: string,
	solarEntityId?: string,
	batteryEntityId?: string,
	gridEntityId?: string,
	batteryChargeEntityId?: string,
	importTodayEntityId?: string,
	exportTodayEntityId?: string,
	solarTodayEntityId?: string,
	homeTodayEntityId?: string,
	costTodayEntityId?: string,
	compensationTodayEntityId?: string,
	selfSufficiencyEntityId?: string,
	carChargingEntityId?: string,
	carCableEntityId?: string,
	carChargingPowerEntityId?: string,
	energyDeviceEntityIds?: string[],
	energyDeviceTodayEntityIds?: string[],
	hasCustomDayNoCar?: boolean,
	hasCustomDayWithCar?: boolean,
	hasCustomNightNoCar?: boolean,
	hasCustomNightWithCar?: boolean,
	anchorsDayNoCar?: import('../persistence/panel-state-types').EnergyAnchors,
	anchorsDayWithCar?: import('../persistence/panel-state-types').EnergyAnchors,
	anchorsNightNoCar?: import('../persistence/panel-state-types').EnergyAnchors,
	anchorsNightWithCar?: import('../persistence/panel-state-types').EnergyAnchors,
	cameras?: import('../persistence/panel-state-types').CameraConfig[]
): ViewSectionDraft[] {
	return sections.map((section) => ({
		...section,
		cards: section.cards.map((card) =>
			card.id === cardId
				? saveCardEdits(
						card,
						title,
						cardType,
						entityId,
						analogStyle,
						digitalStyle,
						clockStyle,
						clockShowAnalog,
						clockShowDigital,
						clockHour12,
						clockSeconds,
						dateLayout,
						dateShortDay,
						dateShortMonth,
						dateAlign,
						dateWeekdayWithDate,
						weatherForecastType,
						weatherForecastDaysToShow,
						statusDomains,
						statusDeviceClasses,
						statusEntityIds,
						statusDiscoveredEntityIds,
						statusIcon,
						ignoredEntityIds,
						netEntityId,
						solarEntityId,
						batteryEntityId,
						gridEntityId,
						batteryChargeEntityId,
						importTodayEntityId,
						exportTodayEntityId,
						solarTodayEntityId,
						homeTodayEntityId,
						costTodayEntityId,
						compensationTodayEntityId,
						selfSufficiencyEntityId,
						carChargingEntityId,
						carCableEntityId,
						carChargingPowerEntityId,
						energyDeviceEntityIds,
						energyDeviceTodayEntityIds,
						hasCustomDayNoCar,
						hasCustomDayWithCar,
						hasCustomNightNoCar,
						hasCustomNightWithCar,
						anchorsDayNoCar,
						anchorsDayWithCar,
						anchorsNightNoCar,
						anchorsNightWithCar,
						cameras
					)
				: card
		)
	}));
}

export function deleteCardInSidebar(cards: CardDraft[], cardId: string): CardDraft[] {
	return cards.filter((card) => card.id !== cardId);
}

export function deleteCardInSections(
	sections: ViewSectionDraft[],
	cardId: string
): ViewSectionDraft[] {
	return sections.map((section) => ({
		...section,
		cards: section.cards.filter((card) => card.id !== cardId)
	}));
}

export function saveSectionEdits(
	sections: ViewSectionDraft[],
	sectionId: string,
	title: string,
	icon: string,
	headerTemperatureEntityId: string,
	headerHumidityEntityId: string,
	headerPressureEntityId: string,
	column: number,
	span: number,
	cardColumns: 1 | 2
): ViewSectionDraft[] {
	return sections.map((section) =>
		section.id === sectionId
			? {
					...section,
					title,
					icon: icon.trim().length > 0 ? icon.trim() : 'layout-grid',
					headerTemperatureEntityId: headerTemperatureEntityId.trim() || undefined,
					headerHumidityEntityId: headerHumidityEntityId.trim() || undefined,
					headerPressureEntityId: headerPressureEntityId.trim() || undefined,
					column,
					span,
					cardColumns
				}
			: section
	);
}

export function deleteSectionById(
	sections: ViewSectionDraft[],
	sectionId: string
): ViewSectionDraft[] {
	return sections.filter((section) => section.id !== sectionId);
}
