import type { CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';
import type { SidebarItemBase } from '$lib/sidebar/types';

export function buildRenderedViewSections(activeViewSections: ViewSectionDraft[]) {
	return [...activeViewSections]
		.filter(
			(section): section is ViewSectionDraft =>
				Boolean(section) &&
				typeof section.id === 'string' &&
				section.id.length > 0 &&
				Array.isArray(section.cards)
		)
		.map((section) => ({
			...section,
			cards: section.cards
				.filter(
					(card): card is CardDraft =>
						Boolean(card) && typeof card.id === 'string' && card.id.length > 0
				)
				.filter((card, index, list) => list.findIndex((entry) => entry.id === card.id) === index)
		}))
		.filter((section, index, list) => list.findIndex((entry) => entry.id === section.id) === index)
		.sort((a, b) => (a.column === b.column ? a.order - b.order : a.column - b.column));
}

export function buildRenderedSidebarCards(activeSidebarCards: CardDraft[]) {
	return activeSidebarCards
		.filter((card): card is CardDraft => Boolean(card) && typeof card.id === 'string' && card.id.length > 0)
		.filter((card, index, list) => list.findIndex((entry) => entry.id === card.id) === index);
}

export function buildSidebarItems(
	cards: CardDraft[],
	getLocalizedCardLabel: (type: string) => string,
	locale: string
): SidebarItemBase[] {
	return cards.map((card, order) => ({
		id: card.id,
		type: card.cardType,
		title: card.title,
		locale,
		entityId: card.entityId,
		alarmEntityId: card.alarmEntityId,
		solarEntityId: card.solarEntityId,
		batteryEntityId: card.batteryEntityId,
		gridEntityId: card.gridEntityId,
		batteryChargeEntityId: card.batteryChargeEntityId,
		netEntityId: card.netEntityId,
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
		energyDeviceSnapshot: card.energyDeviceSnapshot,
		cameras: card.cameras,
		hasCustomDayNoCar: card.hasCustomDayNoCar,
		hasCustomDayWithCar: card.hasCustomDayWithCar,
		hasCustomNightNoCar: card.hasCustomNightNoCar,
		hasCustomNightWithCar: card.hasCustomNightWithCar,
		anchorsDayNoCar: card.anchorsDayNoCar,
		anchorsDayWithCar: card.anchorsDayWithCar,
		anchorsNightNoCar: card.anchorsNightNoCar,
		anchorsNightWithCar: card.anchorsNightWithCar,
		statusDomains: card.statusDomains,
		statusDeviceClasses: card.statusDeviceClasses,
		statusEntityIds: card.statusEntityIds,
		statusEntityAliases: card.statusEntityAliases,
		statusEntityIconOverrides: card.statusEntityIconOverrides,
		statusIcon: card.statusIcon,
		ignoredEntityIds: card.ignoredEntityIds,
		analogClockStyle: card.analogClockStyle,
		digitalClockStyle: card.digitalClockStyle,
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
		visible: true,
		order
	}));
}
