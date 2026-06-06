import type {
	CameraConfig,
	CardDraft,
	ClockStyle,
	EnergyAnchors,
	EnergyFlowKey,
	EnergyFlowWaypoints,
	PanelDashboard,
	PanelDashboardLayout,
	ViewSectionDraft
} from './panel-state-types';
import { deriveEnergyCostMode } from '$lib/energy-costs';

function coerceCamerasFromUnknown(value: unknown): CameraConfig[] | undefined {
	if (!Array.isArray(value)) return undefined;
	const out: CameraConfig[] = [];
	for (const raw of value) {
		if (!raw || typeof raw !== 'object') continue;
		const v = raw as Record<string, unknown>;
		const entityId = typeof v.entityId === 'string' ? v.entityId.trim() : '';
		if (!entityId) continue;
		const config: CameraConfig = { entityId };
		if (typeof v.alias === 'string' && v.alias.trim().length > 0) config.alias = v.alias.trim();
		if (typeof v.color === 'string' && /^#[0-9a-f]{6}$/i.test(v.color.trim())) config.color = v.color.trim();
		if (typeof v.personEntityId === 'string' && v.personEntityId.trim().length > 0)
			config.personEntityId = v.personEntityId.trim();
		if (v.isLarge === true) config.isLarge = true;
		if (v.useAdvanced === true) config.useAdvanced = true;
		if (typeof v.advancedConfig === 'string' && v.advancedConfig.length > 0)
			config.advancedConfig = v.advancedConfig;
		out.push(config);
	}
	return out.length > 0 ? out : undefined;
}

function coerceEntityIdFromUnknown(value: unknown): string | undefined {
	return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function coerceTariffFromUnknown(value: unknown): number | undefined {
	const n =
		typeof value === 'number'
			? value
			: typeof value === 'string'
				? Number(value.trim().replace(',', '.'))
				: NaN;
	return Number.isFinite(n) && n >= 0 ? n : undefined;
}

function clampCoord(n: number): number {
	if (!Number.isFinite(n)) return 0;
	// Allow anchors to extend just outside the frame (e.g. street going off-screen)
	if (n < -0.5) return -0.5;
	if (n > 1.5) return 1.5;
	return n;
}
function clampRail(n: number): number {
	if (!Number.isFinite(n)) return 0.5;
	if (n < 0) return 0;
	if (n > 1) return 1;
	return n;
}

const VALID_FLOW_KEYS: EnergyFlowKey[] = [
	'solarToBattery',
	'solarToCar',
	'solarToHome',
	'solarToGrid',
	'gridToHome',
	'gridToCar',
	'gridToBattery',
	'batteryToHome',
	'batteryToCar'
];

function coerceFlowWaypointsFromUnknown(value: unknown): EnergyFlowWaypoints | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const o = value as Record<string, unknown>;
	const out: EnergyFlowWaypoints = {};
	let hasAny = false;
	for (const key of VALID_FLOW_KEYS) {
		const arr = o[key];
		if (!Array.isArray(arr)) continue;
		const points: { x: number; y: number }[] = [];
		for (const item of arr) {
			if (!item || typeof item !== 'object') continue;
			const p = item as Record<string, unknown>;
			const x = typeof p.x === 'number' ? p.x : Number(p.x);
			const y = typeof p.y === 'number' ? p.y : Number(p.y);
			if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
			points.push({ x: clampCoord(x), y: clampCoord(y) });
		}
		if (points.length > 0) {
			out[key] = points;
			hasAny = true;
		}
	}
	return hasAny ? out : undefined;
}

export function coerceEnergyAnchorsFromUnknown(value: unknown): EnergyAnchors | undefined {
	if (!value || typeof value !== 'object') return undefined;
	const o = value as Record<string, unknown>;
	function point(v: unknown): { x: number; y: number } | null {
		if (!v || typeof v !== 'object') return null;
		const p = v as Record<string, unknown>;
		const x = typeof p.x === 'number' ? p.x : Number(p.x);
		const y = typeof p.y === 'number' ? p.y : Number(p.y);
		if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
		return { x: clampCoord(x), y: clampCoord(y) };
	}
	const solar = point(o.solar);
	const battery = point(o.battery);
	const door = point(o.door);
	const car = point(o.car);
	const street = point(o.street);
	const railXRaw = typeof o.railX === 'number' ? o.railX : Number(o.railX);
	if (!solar || !battery || !door || !car || !street || !Number.isFinite(railXRaw)) return undefined;
	const flowWaypoints = coerceFlowWaypointsFromUnknown(o.flowWaypoints);
	const result: EnergyAnchors = { solar, battery, door, car, street, railX: clampRail(railXRaw) };
	if (flowWaypoints) result.flowWaypoints = flowWaypoints;
	return result;
}

export function getClockStyleValue(value: unknown): 1 | 2 | 3 | 4 | undefined {
	return value === 1 || value === 2 || value === 3 || value === 4 ? value : undefined;
}

export function getClockStyleName(value: unknown): ClockStyle | undefined {
	if (
		value === 'digital' ||
		value === 'classic' ||
		value === 'luxury_gold' ||
		value === 'luxury_steel' ||
		value === 'minimal' ||
		value === 'dark' ||
		value === 'dots' ||
		value === 'aurora'
	) {
		return value;
	}
	return undefined;
}

export function coerceCardDraft(value: unknown, index: number): CardDraft | null {
	if (!value || typeof value !== 'object') return null;
	const item = value as Record<string, unknown>;
	const rawId = item.id;
	const rawTitle = item.title;
	const rawType = item.cardType;
	const rawHiddenInSection = item.hiddenInSection;
	const rawEntityId = item.entityId;
	const rawAlarmEntityId = item.alarmEntityId;
	const rawAnalogClockStyle = item.analogClockStyle;
	const rawDigitalClockStyle = item.digitalClockStyle;
	const rawClockStyle = item.clockStyle;
	const rawClockShowAnalog = item.clockShowAnalog;
	const rawClockShowDigital = item.clockShowDigital;
	const rawClockHour12 = item.clockHour12;
	const rawClockSeconds = item.clockSeconds;
	const rawDateLayout = item.dateLayout;
	const rawDateShortDay = item.dateShortDay;
	const rawDateShortMonth = item.dateShortMonth;
	const rawDateAlign = item.dateAlign;
	const rawDateWeekdayWithDate = item.dateWeekdayWithDate;
	const rawWeatherForecastType = item.weatherForecastType;
	const rawWeatherForecastDaysToShow = item.weatherForecastDaysToShow;
	const rawStatusDomains = item.statusDomains;
	const rawStatusDeviceClasses = item.statusDeviceClasses;
	const rawStatusEntityIds = item.statusEntityIds;
	const rawStatusDiscoveredEntityIds = item.statusDiscoveredEntityIds;
	const rawStatusEntityAliases = item.statusEntityAliases;
	const rawStatusEntityIconOverrides = item.statusEntityIconOverrides;
	const rawStatusIcon = item.statusIcon;
	const rawIgnoredEntityIds = item.ignoredEntityIds;
	const id =
		typeof rawId === 'string' && rawId.length > 0
			? rawId
			: `card-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
	const title = typeof rawTitle === 'string' ? rawTitle : '';
	const cardType = typeof rawType === 'string' && rawType.length > 0 ? rawType : 'custom';
	const entityId = typeof rawEntityId === 'string' && rawEntityId.length > 0 ? rawEntityId : undefined;
	const alarmEntityId =
		typeof rawAlarmEntityId === 'string' && rawAlarmEntityId.length > 0 ? rawAlarmEntityId : undefined;
	const analogClockStyle = getClockStyleValue(Number(rawAnalogClockStyle));
	const digitalClockStyle = getClockStyleValue(Number(rawDigitalClockStyle));
	const clockStyle = getClockStyleName(rawClockStyle);
	const clockShowAnalog = typeof rawClockShowAnalog === 'boolean' ? rawClockShowAnalog : undefined;
	const clockShowDigital = typeof rawClockShowDigital === 'boolean' ? rawClockShowDigital : undefined;
	const clockHour12 = typeof rawClockHour12 === 'boolean' ? rawClockHour12 : undefined;
	const clockSeconds = typeof rawClockSeconds === 'boolean' ? rawClockSeconds : undefined;
	const dateLayout =
		rawDateLayout === 'vertical' || rawDateLayout === 'horizontal' ? rawDateLayout : undefined;
	const dateShortDay = typeof rawDateShortDay === 'boolean' ? rawDateShortDay : undefined;
	const dateShortMonth = typeof rawDateShortMonth === 'boolean' ? rawDateShortMonth : undefined;
	const dateAlign =
		rawDateAlign === 'left' || rawDateAlign === 'center' || rawDateAlign === 'right'
			? rawDateAlign
			: undefined;
	const dateWeekdayWithDate =
		typeof rawDateWeekdayWithDate === 'boolean' ? rawDateWeekdayWithDate : undefined;
	const weatherForecastType =
		rawWeatherForecastType === 'daily' ||
		rawWeatherForecastType === 'hourly' ||
		rawWeatherForecastType === 'twice_daily'
			? rawWeatherForecastType
			: undefined;
	const weatherForecastDaysToShow =
		typeof rawWeatherForecastDaysToShow === 'number' && Number.isFinite(rawWeatherForecastDaysToShow)
			? Math.max(1, Math.min(7, Math.round(rawWeatherForecastDaysToShow)))
			: undefined;
	const statusDomains = Array.isArray(rawStatusDomains)
		? rawStatusDomains.filter(
				(value): value is string => typeof value === 'string' && value.trim().length > 0
			)
		: undefined;
	const statusDeviceClasses = Array.isArray(rawStatusDeviceClasses)
		? rawStatusDeviceClasses.filter(
				(value): value is string => typeof value === 'string' && value.trim().length > 0
			)
		: undefined;
	const statusEntityIds = Array.isArray(rawStatusEntityIds)
		? rawStatusEntityIds.filter(
				(value): value is string => typeof value === 'string' && value.trim().length > 0
			)
		: undefined;
	const statusDiscoveredEntityIds = Array.isArray(rawStatusDiscoveredEntityIds)
		? rawStatusDiscoveredEntityIds
				.map((value) => (typeof value === 'string' ? value.trim().toLowerCase() : ''))
				.filter((value) => value.length > 0)
		: undefined;
	const statusEntityAliases =
		rawStatusEntityAliases && typeof rawStatusEntityAliases === 'object'
			? Object.fromEntries(
					Object.entries(rawStatusEntityAliases).filter(
						([k, v]) =>
							typeof k === 'string' && k.trim().length > 0 && typeof v === 'string' && v.trim().length > 0
					)
				)
			: undefined;
	const statusEntityIconOverrides =
		rawStatusEntityIconOverrides && typeof rawStatusEntityIconOverrides === 'object'
			? Object.fromEntries(
					Object.entries(rawStatusEntityIconOverrides).filter(
						([k, v]) =>
							typeof k === 'string' && k.trim().length > 0 && typeof v === 'string' && v.trim().length > 0
					)
				)
			: undefined;
	const statusIcon =
		typeof rawStatusIcon === 'string' && rawStatusIcon.trim().length > 0 ? rawStatusIcon.trim() : undefined;
	const statusIconNormalized =
		cardType === 'media_players_status' && statusIcon === 'mdi:play-network' ? 'mdi:audio-video' : statusIcon;
	const ignoredEntityIds = Array.isArray(rawIgnoredEntityIds)
		? rawIgnoredEntityIds.filter(
				(value): value is string => typeof value === 'string' && value.trim().length > 0
			)
		: undefined;
	return {
		id,
		title,
		cardType,
		hiddenInSection: rawHiddenInSection === true ? true : undefined,
		entityId,
		alarmEntityId,
		analogClockStyle,
		digitalClockStyle,
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
		statusEntityAliases,
		statusEntityIconOverrides,
		statusIcon: statusIconNormalized,
		ignoredEntityIds,
		netEntityId:
			typeof item.netEntityId === 'string' && item.netEntityId.length > 0 ? item.netEntityId : undefined,
		solarEntityId:
			typeof item.solarEntityId === 'string' && item.solarEntityId.length > 0
				? item.solarEntityId
				: undefined,
		batteryEntityId:
			typeof item.batteryEntityId === 'string' && item.batteryEntityId.length > 0
				? item.batteryEntityId
				: undefined,
		gridEntityId:
			typeof item.gridEntityId === 'string' && item.gridEntityId.length > 0 ? item.gridEntityId : undefined,
		batteryChargeEntityId:
			typeof item.batteryChargeEntityId === 'string' && item.batteryChargeEntityId.length > 0
				? item.batteryChargeEntityId
				: undefined,
		importTodayEntityId:
			typeof item.importTodayEntityId === 'string' && item.importTodayEntityId.length > 0
				? item.importTodayEntityId
				: undefined,
		exportTodayEntityId:
			typeof item.exportTodayEntityId === 'string' && item.exportTodayEntityId.length > 0
				? item.exportTodayEntityId
				: undefined,
		solarTodayEntityId:
			typeof item.solarTodayEntityId === 'string' && item.solarTodayEntityId.length > 0
				? item.solarTodayEntityId
				: undefined,
		homeTodayEntityId:
			typeof item.homeTodayEntityId === 'string' && item.homeTodayEntityId.length > 0
				? item.homeTodayEntityId
				: undefined,
		costTodayEntityId:
			typeof item.costTodayEntityId === 'string' && item.costTodayEntityId.length > 0
				? item.costTodayEntityId
				: undefined,
		compensationTodayEntityId:
			typeof item.compensationTodayEntityId === 'string' && item.compensationTodayEntityId.length > 0
				? item.compensationTodayEntityId
				: undefined,
		energyCostMode: deriveEnergyCostMode({
			energyCostMode: item.energyCostMode as CardDraft['energyCostMode'],
			costTodayEntityId: coerceEntityIdFromUnknown(item.costTodayEntityId),
			compensationTodayEntityId: coerceEntityIdFromUnknown(item.compensationTodayEntityId),
			importPeakTodayEntityId: coerceEntityIdFromUnknown(item.importPeakTodayEntityId),
			importOffPeakTodayEntityId: coerceEntityIdFromUnknown(item.importOffPeakTodayEntityId),
			exportPeakTodayEntityId: coerceEntityIdFromUnknown(item.exportPeakTodayEntityId),
			exportOffPeakTodayEntityId: coerceEntityIdFromUnknown(item.exportOffPeakTodayEntityId),
			importTariffEntityId: coerceEntityIdFromUnknown(item.importTariffEntityId),
			exportTariffEntityId: coerceEntityIdFromUnknown(item.exportTariffEntityId),
			importPeakTariff: coerceTariffFromUnknown(item.importPeakTariff),
			importOffPeakTariff: coerceTariffFromUnknown(item.importOffPeakTariff),
			exportPeakTariff: coerceTariffFromUnknown(item.exportPeakTariff),
			exportOffPeakTariff: coerceTariffFromUnknown(item.exportOffPeakTariff),
			exportTariff: coerceTariffFromUnknown(item.exportTariff)
		}),
		importPeakTodayEntityId: coerceEntityIdFromUnknown(item.importPeakTodayEntityId),
		importOffPeakTodayEntityId: coerceEntityIdFromUnknown(item.importOffPeakTodayEntityId),
		exportPeakTodayEntityId: coerceEntityIdFromUnknown(item.exportPeakTodayEntityId),
		exportOffPeakTodayEntityId: coerceEntityIdFromUnknown(item.exportOffPeakTodayEntityId),
		importTariffEntityId: coerceEntityIdFromUnknown(item.importTariffEntityId),
		exportTariffEntityId: coerceEntityIdFromUnknown(item.exportTariffEntityId),
		importPeakTariff: coerceTariffFromUnknown(item.importPeakTariff),
		importOffPeakTariff: coerceTariffFromUnknown(item.importOffPeakTariff),
		exportPeakTariff: coerceTariffFromUnknown(item.exportPeakTariff),
		exportOffPeakTariff: coerceTariffFromUnknown(item.exportOffPeakTariff),
		exportTariff: coerceTariffFromUnknown(item.exportTariff),
		selfSufficiencyEntityId:
			typeof item.selfSufficiencyEntityId === 'string' && item.selfSufficiencyEntityId.length > 0
				? item.selfSufficiencyEntityId
				: undefined,
		carChargingEntityId:
			typeof item.carChargingEntityId === 'string' && item.carChargingEntityId.length > 0
				? item.carChargingEntityId
				: undefined,
		carCableEntityId:
			typeof item.carCableEntityId === 'string' && item.carCableEntityId.length > 0
				? item.carCableEntityId
				: undefined,
		carChargingPowerEntityId:
			typeof item.carChargingPowerEntityId === 'string' && item.carChargingPowerEntityId.length > 0
				? item.carChargingPowerEntityId
				: undefined,
		energyDeviceEntityIds: Array.isArray(item.energyDeviceEntityIds)
			? item.energyDeviceEntityIds
					.filter((v: unknown): v is string => typeof v === 'string')
					.map((v) => v.trim())
					.filter((v) => v.length > 0)
			: undefined,
		energyDeviceTodayEntityIds: Array.isArray(item.energyDeviceTodayEntityIds)
			? item.energyDeviceTodayEntityIds
					.filter((v: unknown): v is string => typeof v === 'string')
					.map((v) => v.trim())
					.filter((v) => v.length > 0)
			: undefined,
		energyDeviceAliases:
			item.energyDeviceAliases &&
			typeof item.energyDeviceAliases === 'object' &&
			!Array.isArray(item.energyDeviceAliases)
				? Object.fromEntries(
						Object.entries(item.energyDeviceAliases as Record<string, unknown>).filter(
							(entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1].trim().length > 0
						)
					)
				: undefined,
		energyDeviceSnapshot:
			item.energyDeviceSnapshot &&
			typeof item.energyDeviceSnapshot === 'object' &&
			!Array.isArray(item.energyDeviceSnapshot) &&
			typeof (item.energyDeviceSnapshot as { date?: unknown }).date === 'string' &&
			(item.energyDeviceSnapshot as { values?: unknown }).values &&
			typeof (item.energyDeviceSnapshot as { values?: unknown }).values === 'object'
				? {
						date: (item.energyDeviceSnapshot as { date: string }).date,
						values: Object.fromEntries(
							Object.entries(
								(item.energyDeviceSnapshot as { values: Record<string, unknown> }).values
							).filter(
								(entry): entry is [string, number] => typeof entry[1] === 'number' && isFinite(entry[1])
							)
						)
					}
				: undefined,
		hasCustomDayNoCar: typeof item.hasCustomDayNoCar === 'boolean' ? item.hasCustomDayNoCar : undefined,
		hasCustomDayWithCar: typeof item.hasCustomDayWithCar === 'boolean' ? item.hasCustomDayWithCar : undefined,
		hasCustomNightNoCar: typeof item.hasCustomNightNoCar === 'boolean' ? item.hasCustomNightNoCar : undefined,
		hasCustomNightWithCar:
			typeof item.hasCustomNightWithCar === 'boolean' ? item.hasCustomNightWithCar : undefined,
		anchorsDayNoCar: coerceEnergyAnchorsFromUnknown(item.anchorsDayNoCar),
		anchorsDayWithCar: coerceEnergyAnchorsFromUnknown(item.anchorsDayWithCar),
		anchorsNightNoCar: coerceEnergyAnchorsFromUnknown(item.anchorsNightNoCar),
		anchorsNightWithCar: coerceEnergyAnchorsFromUnknown(item.anchorsNightWithCar),
		cameras: coerceCamerasFromUnknown(item.cameras)
	};
}

export const coerceCardDraftFromUnknown = coerceCardDraft;

export function coerceViewSectionFromUnknown(entry: unknown, sectionIndex: number): ViewSectionDraft | null {
	if (!entry || typeof entry !== 'object') return null;
	const value = entry as Record<string, unknown>;
	const rawCards = Array.isArray(value.cards) ? value.cards : [];
	const cards = rawCards
		.map((card, cardIndex) => coerceCardDraftFromUnknown(card, cardIndex))
		.filter((card): card is CardDraft => card !== null);
	const rawColumn = Number(value.column);
	const rawOrder = Number(value.order);
	const rawSpan = Number(value.span);
	const rawTitle = value.title;
	const title = typeof rawTitle === 'string' ? rawTitle : `Section ${sectionIndex + 1}`;
	return {
		id:
			typeof value.id === 'string' && value.id.length > 0
				? value.id
				: `section-${Date.now()}-${sectionIndex}`,
		title,
		icon: typeof value.icon === 'string' && value.icon.trim().length > 0 ? value.icon.trim() : 'layout-grid',
		headerTemperatureEntityId:
			typeof value.headerTemperatureEntityId === 'string' && value.headerTemperatureEntityId.trim().length > 0
				? value.headerTemperatureEntityId.trim()
				: undefined,
		headerHumidityEntityId:
			typeof value.headerHumidityEntityId === 'string' && value.headerHumidityEntityId.trim().length > 0
				? value.headerHumidityEntityId.trim()
				: undefined,
		headerPressureEntityId:
			typeof value.headerPressureEntityId === 'string' && value.headerPressureEntityId.trim().length > 0
				? value.headerPressureEntityId.trim()
				: undefined,
		column: Number.isFinite(rawColumn) ? rawColumn : 1,
		span: Number.isFinite(rawSpan) ? rawSpan : 1,
		order: Number.isFinite(rawOrder) ? rawOrder : sectionIndex,
		cardColumns: value.cardColumns === 2 || Number(value.cardColumns) === 2 ? 2 : 1,
		cards
	};
}

export function withCardType(card: CardDraft): CardDraft {
	return (
		coerceCardDraft(card, 0) ?? {
			id: card.id,
			title: card.title,
			cardType: typeof card.cardType === 'string' ? card.cardType : 'custom'
		}
	);
}

export function withSectionCards(section: ViewSectionDraft): ViewSectionDraft {
	const span = Number.isFinite(section.span) ? Math.max(1, Math.floor(section.span)) : 1;
	return {
		...section,
		icon:
			typeof section.icon === 'string' && section.icon.trim().length > 0
				? section.icon.trim()
				: 'layout-grid',
		span,
		cardColumns: section.cardColumns === 2 ? 2 : 1,
		cards: section.cards.map(withCardType)
	};
}

export function normalizeSectionsForLayout(
	sections: ViewSectionDraft[],
	columns: 1 | 2 | 3
): ViewSectionDraft[] {
	const byColumn = new Map<number, ViewSectionDraft[]>();
	for (const raw of sections) {
		const span = Math.max(1, Math.min(columns, raw.span ?? 1));
		const maxStart = Math.max(1, columns - span + 1);
		const column = Math.max(1, Math.min(maxStart, raw.column));
		const list = byColumn.get(column) ?? [];
		list.push({ ...raw, column, span });
		byColumn.set(column, list);
	}
	const normalized: ViewSectionDraft[] = [];
	for (const [column, list] of byColumn.entries()) {
		list
			.sort((a, b) => a.order - b.order)
			.forEach((section, index) => normalized.push({ ...section, column, order: index }));
	}
	return normalized;
}

export function sanitizeLayout(
	layout: Partial<PanelDashboardLayout>,
	fallback: PanelDashboardLayout
): PanelDashboardLayout {
	const clampNumber = (value: unknown, min: number, max: number, fallbackValue: number) =>
		typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallbackValue;
	const columns =
		layout.columns === 1 || layout.columns === 2 || layout.columns === 3 ? layout.columns : fallback.columns;
	const popupWidth = clampNumber(layout.popupWidth, 420, 1640, fallback.popupWidth);
	const popupHeight = clampNumber(layout.popupHeight, 440, 1200, fallback.popupHeight);
	return { columns, popupWidth, popupHeight };
}

export function parseDashboardValue(
	value: {
		layout?: Partial<PanelDashboardLayout>;
		cards?: unknown[];
		viewCards?: unknown[];
		viewSections?: unknown[];
		sidebarCards?: unknown[];
		updatedAt?: unknown;
	},
	defaults: PanelDashboard
): PanelDashboard {
	const layout = sanitizeLayout(value.layout ?? {}, defaults.layout);
	const legacyCards = Array.isArray(value.cards)
		? value.cards
				.map((card, index) => coerceCardDraftFromUnknown(card, index))
				.filter((card): card is CardDraft => card !== null)
				.map(withCardType)
		: [];
	const viewCards = Array.isArray(value.viewCards)
		? value.viewCards
				.map((card, index) => coerceCardDraftFromUnknown(card, index))
				.filter((card): card is CardDraft => card !== null)
				.map(withCardType)
		: legacyCards;
	const rawViewSections = Array.isArray(value.viewSections) ? value.viewSections : undefined;
	const hasExplicitViewSections = rawViewSections !== undefined;
	const parsedSections = hasExplicitViewSections
		? rawViewSections
				.map((entry, sectionIndex) => coerceViewSectionFromUnknown(entry, sectionIndex))
				.filter((section): section is ViewSectionDraft => section !== null)
				.map(withSectionCards)
		: [];
	const viewSections = normalizeSectionsForLayout(parsedSections, layout.columns);
	const sidebarCards = Array.isArray(value.sidebarCards)
		? value.sidebarCards
				.map((card, index) => coerceCardDraftFromUnknown(card, index))
				.filter((card): card is CardDraft => card !== null)
				.map(withCardType)
		: defaults.sidebarCards;
	const fallbackFromViewCards =
		viewCards.length > 0
			? [
					{
						id: 'section-1',
						title: 'Section 1',
						icon: 'layout-grid',
						column: 1,
						span: 1,
						order: 0,
						cardColumns: 1 as const,
						cards: viewCards
					}
				]
			: defaults.viewSections;
	return {
		layout,
		viewSections: viewSections.length > 0 ? viewSections : fallbackFromViewCards,
		sidebarCards: sidebarCards.length > 0 ? sidebarCards : defaults.sidebarCards,
		updatedAt:
			typeof value.updatedAt === 'number' && Number.isFinite(value.updatedAt)
				? value.updatedAt
				: defaults.updatedAt
	};
}

export function dashboardScore(dashboard: PanelDashboard): number {
	const updatedAt =
		typeof dashboard.updatedAt === 'number' && Number.isFinite(dashboard.updatedAt) ? dashboard.updatedAt : 0;
	if (updatedAt > 0) return updatedAt;
	const viewCards = dashboard.viewSections.reduce(
		(total, section) => total + (Array.isArray(section.cards) ? section.cards.length : 0),
		0
	);
	return viewCards + dashboard.sidebarCards.length;
}
