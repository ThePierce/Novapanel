import type { CameraConfig, CardDraft, ViewSectionDraft } from '$lib/persistence/panel-state';
import type { ClockStyle } from '$lib/persistence/panel-state-types';
import { coerceEnergyAnchorsFromUnknown } from '$lib/persistence/panel-state-coercion';

function coerceCamerasInPageHelpers(value: unknown): CameraConfig[] | undefined {
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
		if (typeof v.personEntityId === 'string' && v.personEntityId.trim().length > 0) config.personEntityId = v.personEntityId.trim();
		if (v.isLarge === true) config.isLarge = true;
		if (v.useAdvanced === true) config.useAdvanced = true;
		if (typeof v.advancedConfig === 'string' && v.advancedConfig.length > 0) config.advancedConfig = v.advancedConfig;
		out.push(config);
	}
	return out.length > 0 ? out : undefined;
}

export type CardLibraryTab = 'sidebar' | 'view';

type PanelStatePayload = {
	dashboard?: {
		layout?: { columns?: 1 | 2 | 3; popupWidth?: number; popupHeight?: number };
		viewSections?: unknown;
		sidebarCards?: unknown;
		updatedAt?: unknown;
	};
	configuration?: {
		language?: string;
		cardLibraryTab?: CardLibraryTab;
		titles?: { cardLibrary?: string; homeviewPreview?: string };
	};
};

const SYNC_DIAG_READ_KEY = 'np_sync_diag_last_read';
const SYNC_DIAG_WRITE_KEY = 'np_sync_diag_last_write';
const SYNC_DIAG_PROBE_KEY = 'np_sync_diag_probe';
const SYNC_DIAG_VERSION_KEY = 'np_sync_diag_version';
const SYNC_DIAG_VERSION = 'np-syncdiag-2026-05-01T00:35:00Z';

const SESSION_ADDON_READ_OK_KEY = 'np_addon_read_ok';

/** Remember which panel-state URL worked so every device retries it first (ingress vs /local_novapanel). */
const PREFERRED_PANEL_STATE_URL_KEY = 'np_panel_state_api_preferred';

const RESERVED_APP_BASE_SEGMENTS = new Set(['api', '_app', 'favicon.ico', 'hacsfiles', 'energy-asset']);

function getCurrentAppPathBase(pathname = typeof window !== 'undefined' ? window.location.pathname || '/' : '/'): string {
	const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
	const ingressMatch = normalized.match(/^(\/api\/hassio_ingress\/[^/]+)/);
	if (ingressMatch?.[1]) return ingressMatch[1];
	const segments = normalized.split('/').filter(Boolean);
	const firstSegment = segments[0] ?? '';
	if (!firstSegment || RESERVED_APP_BASE_SEGMENTS.has(firstSegment)) return '';
	return `/${firstSegment}`;
}

function loadPreferredPanelStateUrls(): string[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = localStorage.getItem(PREFERRED_PANEL_STATE_URL_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw) as unknown;
		if (typeof parsed === 'string' && parsed.trim()) return [parsed.trim()];
		if (parsed && typeof parsed === 'object' && 'url' in parsed && typeof (parsed as { url: unknown }).url === 'string') {
			const u = (parsed as { url: string }).url.trim();
			return u ? [u] : [];
		}
		return [];
	} catch {
		return [];
	}
}

function rememberPreferredPanelStateUrl(successUrl: string) {
	if (typeof window === 'undefined') return;
	const t = successUrl.trim();
	if (!t) return;
	try {
		const abs = new URL(t, window.location.origin).href;
		localStorage.setItem(PREFERRED_PANEL_STATE_URL_KEY, JSON.stringify({ url: abs, ts: Date.now() }));
	} catch {}
}

function storeSyncDiag(key: string, value: unknown) {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(key, JSON.stringify(value));
	} catch {}
}

if (typeof window !== 'undefined') {
	storeSyncDiag(SYNC_DIAG_VERSION_KEY, {
		version: SYNC_DIAG_VERSION,
		ts: Date.now(),
		pathname: window.location.pathname,
		origin: window.location.origin
	});
	try {
		if (!localStorage.getItem(SYNC_DIAG_READ_KEY)) {
			storeSyncDiag(SYNC_DIAG_READ_KEY, {
				ts: Date.now(),
				status: 'idle',
				note: 'read_not_started_yet'
			});
		}
		if (!localStorage.getItem(SYNC_DIAG_WRITE_KEY)) {
			storeSyncDiag(SYNC_DIAG_WRITE_KEY, {
				ts: Date.now(),
				status: 'idle',
				note: 'write_not_started_yet'
			});
		}
	} catch {}
}

function touchSyncDiagProbe(context: string) {
	if (typeof window === 'undefined') return;
	storeSyncDiag(SYNC_DIAG_PROBE_KEY, {
		ts: Date.now(),
		context,
		pathname: window.location.pathname,
		origin: window.location.origin
	});
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
		value === 'dots'
	) {
		return value;
	}
	return undefined;
}

export function dedupeCards(cards: CardDraft[]): CardDraft[] {
	return cards.filter((card, index, list) => list.findIndex((entry) => entry.id === card.id) === index);
}

export function toCardDraft(value: unknown, index: number): CardDraft | null {
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
	const rawNetEntityId = item.netEntityId;
	const rawSolarEntityId = item.solarEntityId;
	const rawBatteryEntityId = item.batteryEntityId;
	const rawGridEntityId = item.gridEntityId;
	const rawBatteryChargeEntityId = item.batteryChargeEntityId;
	const rawImportTodayEntityId = item.importTodayEntityId;
	const rawExportTodayEntityId = item.exportTodayEntityId;
	const rawSolarTodayEntityId = item.solarTodayEntityId;
	const rawHomeTodayEntityId = item.homeTodayEntityId;
	const rawCostTodayEntityId = item.costTodayEntityId;
	const rawCompensationTodayEntityId = item.compensationTodayEntityId;
	const rawSelfSufficiencyEntityId = item.selfSufficiencyEntityId;
	const rawCarChargingEntityId = item.carChargingEntityId;
	const rawCarCableEntityId = item.carCableEntityId;
	const rawCarChargingPowerEntityId = item.carChargingPowerEntityId;
	const rawEnergyDeviceEntityIds = item.energyDeviceEntityIds;
	const rawEnergyDeviceTodayEntityIds = item.energyDeviceTodayEntityIds;
	const rawEnergyDeviceAliases = item.energyDeviceAliases;
	const rawEnergyDeviceSnapshot = item.energyDeviceSnapshot;
	const rawHasCustomDayNoCar = item.hasCustomDayNoCar;
	const rawHasCustomDayWithCar = item.hasCustomDayWithCar;
	const rawHasCustomNightNoCar = item.hasCustomNightNoCar;
	const rawHasCustomNightWithCar = item.hasCustomNightWithCar;
	const rawAnchorsDayNoCar = item.anchorsDayNoCar;
	const rawAnchorsDayWithCar = item.anchorsDayWithCar;
	const rawAnchorsNightNoCar = item.anchorsNightNoCar;
	const rawAnchorsNightWithCar = item.anchorsNightWithCar;
	const id =
		typeof rawId === 'string' && rawId.length > 0
			? rawId
			: `card-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`;
	const title = typeof rawTitle === 'string' ? rawTitle : '';
	const cardType = typeof rawType === 'string' && rawType.length > 0 ? rawType : 'custom';
	const entityId = typeof rawEntityId === 'string' && rawEntityId.length > 0 ? rawEntityId : undefined;
	const alarmEntityId =
		typeof rawAlarmEntityId === 'string' && rawAlarmEntityId.length > 0
			? rawAlarmEntityId
			: undefined;
	const analogClockStyle = getClockStyleValue(Number(rawAnalogClockStyle));
	const digitalClockStyle = getClockStyleValue(Number(rawDigitalClockStyle));
	const clockStyle = getClockStyleName(rawClockStyle);
	const clockShowAnalog =
		typeof rawClockShowAnalog === 'boolean' ? rawClockShowAnalog : undefined;
	const clockShowDigital =
		typeof rawClockShowDigital === 'boolean' ? rawClockShowDigital : undefined;
	const clockHour12 = typeof rawClockHour12 === 'boolean' ? rawClockHour12 : undefined;
	const clockSeconds = typeof rawClockSeconds === 'boolean' ? rawClockSeconds : undefined;
	const dateLayout = rawDateLayout === 'vertical' || rawDateLayout === 'horizontal' ? rawDateLayout : undefined;
	const dateShortDay = typeof rawDateShortDay === 'boolean' ? rawDateShortDay : undefined;
	const dateShortMonth = typeof rawDateShortMonth === 'boolean' ? rawDateShortMonth : undefined;
	const dateAlign =
		rawDateAlign === 'left' || rawDateAlign === 'center' || rawDateAlign === 'right'
			? rawDateAlign
			: undefined;
	const dateWeekdayWithDate =
		typeof rawDateWeekdayWithDate === 'boolean' ? rawDateWeekdayWithDate : undefined;
	const weatherForecastType =
		rawWeatherForecastType === 'daily' || rawWeatherForecastType === 'hourly' || rawWeatherForecastType === 'twice_daily'
			? rawWeatherForecastType
			: undefined;
	const weatherForecastDaysToShow =
		typeof rawWeatherForecastDaysToShow === 'number' && Number.isFinite(rawWeatherForecastDaysToShow)
			? Math.max(1, Math.min(7, Math.round(rawWeatherForecastDaysToShow)))
			: undefined;
	const statusDomains = Array.isArray(rawStatusDomains)
		? rawStatusDomains.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
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
							typeof k === 'string' &&
							k.trim().length > 0 &&
							typeof v === 'string' &&
							v.trim().length > 0
					)
				)
			: undefined;
	const statusEntityIconOverrides =
		rawStatusEntityIconOverrides && typeof rawStatusEntityIconOverrides === 'object'
			? Object.fromEntries(
					Object.entries(rawStatusEntityIconOverrides).filter(
						([k, v]) =>
							typeof k === 'string' &&
							k.trim().length > 0 &&
							typeof v === 'string' &&
							v.trim().length > 0
					)
				)
			: undefined;
	const statusIcon =
		typeof rawStatusIcon === 'string' && rawStatusIcon.trim().length > 0
			? rawStatusIcon.trim()
			: undefined;
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
		dateWeekdayWithDate
		,
		weatherForecastType,
		weatherForecastDaysToShow,
		statusDomains,
		statusDeviceClasses,
		statusEntityIds,
		statusDiscoveredEntityIds,
		statusEntityAliases,
		statusEntityIconOverrides,
		statusIcon,
		ignoredEntityIds,
		netEntityId:
			typeof rawNetEntityId === 'string' && rawNetEntityId.length > 0 ? rawNetEntityId : undefined,
		solarEntityId:
			typeof rawSolarEntityId === 'string' && rawSolarEntityId.length > 0
				? rawSolarEntityId
				: undefined,
		batteryEntityId:
			typeof rawBatteryEntityId === 'string' && rawBatteryEntityId.length > 0
				? rawBatteryEntityId
				: undefined,
		gridEntityId:
			typeof rawGridEntityId === 'string' && rawGridEntityId.length > 0
				? rawGridEntityId
				: undefined,
		batteryChargeEntityId:
			typeof rawBatteryChargeEntityId === 'string' && rawBatteryChargeEntityId.length > 0
				? rawBatteryChargeEntityId
				: undefined,
		importTodayEntityId:
			typeof rawImportTodayEntityId === 'string' && rawImportTodayEntityId.length > 0
				? rawImportTodayEntityId
				: undefined,
		exportTodayEntityId:
			typeof rawExportTodayEntityId === 'string' && rawExportTodayEntityId.length > 0
				? rawExportTodayEntityId
				: undefined,
		solarTodayEntityId:
			typeof rawSolarTodayEntityId === 'string' && rawSolarTodayEntityId.length > 0
				? rawSolarTodayEntityId
				: undefined,
		homeTodayEntityId:
			typeof rawHomeTodayEntityId === 'string' && rawHomeTodayEntityId.length > 0
				? rawHomeTodayEntityId
				: undefined,
		costTodayEntityId:
			typeof rawCostTodayEntityId === 'string' && rawCostTodayEntityId.length > 0
				? rawCostTodayEntityId
				: undefined,
		compensationTodayEntityId:
			typeof rawCompensationTodayEntityId === 'string' && rawCompensationTodayEntityId.length > 0
				? rawCompensationTodayEntityId
				: undefined,
		selfSufficiencyEntityId:
			typeof rawSelfSufficiencyEntityId === 'string' && rawSelfSufficiencyEntityId.length > 0
				? rawSelfSufficiencyEntityId
				: undefined,
		carChargingEntityId:
			typeof rawCarChargingEntityId === 'string' && rawCarChargingEntityId.length > 0
				? rawCarChargingEntityId
				: undefined,
		carCableEntityId:
			typeof rawCarCableEntityId === 'string' && rawCarCableEntityId.length > 0
				? rawCarCableEntityId
				: undefined,
		carChargingPowerEntityId:
			typeof rawCarChargingPowerEntityId === 'string' && rawCarChargingPowerEntityId.length > 0
				? rawCarChargingPowerEntityId
				: undefined,
		energyDeviceEntityIds: Array.isArray(rawEnergyDeviceEntityIds)
			? (rawEnergyDeviceEntityIds as unknown[])
				.filter((v): v is string => typeof v === 'string')
				.map((v) => v.trim())
				.filter((v) => v.length > 0)
			: undefined,
		energyDeviceTodayEntityIds: Array.isArray(rawEnergyDeviceTodayEntityIds)
			? (rawEnergyDeviceTodayEntityIds as unknown[])
				.filter((v): v is string => typeof v === 'string')
				.map((v) => v.trim())
				.filter((v) => v.length > 0)
			: undefined,
		energyDeviceAliases:
			rawEnergyDeviceAliases && typeof rawEnergyDeviceAliases === 'object' && !Array.isArray(rawEnergyDeviceAliases)
				? Object.fromEntries(
						Object.entries(rawEnergyDeviceAliases as Record<string, unknown>).filter(
							(entry): entry is [string, string] =>
								typeof entry[0] === 'string' && entry[0].length > 0 && typeof entry[1] === 'string' && entry[1].trim().length > 0
						)
					)
				: undefined,
		energyDeviceSnapshot:
			rawEnergyDeviceSnapshot &&
			typeof rawEnergyDeviceSnapshot === 'object' &&
			!Array.isArray(rawEnergyDeviceSnapshot) &&
			typeof (rawEnergyDeviceSnapshot as { date?: unknown }).date === 'string' &&
			(rawEnergyDeviceSnapshot as { values?: unknown }).values &&
			typeof (rawEnergyDeviceSnapshot as { values?: unknown }).values === 'object'
				? {
						date: (rawEnergyDeviceSnapshot as { date: string }).date,
						values: Object.fromEntries(
							Object.entries(
								(rawEnergyDeviceSnapshot as { values: Record<string, unknown> }).values
							).filter(
								(entry): entry is [string, number] =>
									typeof entry[1] === 'number' && isFinite(entry[1])
							)
						)
					}
				: undefined,
		hasCustomDayNoCar: typeof rawHasCustomDayNoCar === 'boolean' ? rawHasCustomDayNoCar : undefined,
		hasCustomDayWithCar: typeof rawHasCustomDayWithCar === 'boolean' ? rawHasCustomDayWithCar : undefined,
		hasCustomNightNoCar: typeof rawHasCustomNightNoCar === 'boolean' ? rawHasCustomNightNoCar : undefined,
		hasCustomNightWithCar: typeof rawHasCustomNightWithCar === 'boolean' ? rawHasCustomNightWithCar : undefined,
		anchorsDayNoCar: coerceEnergyAnchorsFromUnknown(rawAnchorsDayNoCar),
		anchorsDayWithCar: coerceEnergyAnchorsFromUnknown(rawAnchorsDayWithCar),
		anchorsNightNoCar: coerceEnergyAnchorsFromUnknown(rawAnchorsNightNoCar),
		anchorsNightWithCar: coerceEnergyAnchorsFromUnknown(rawAnchorsNightWithCar),
		cameras: coerceCamerasInPageHelpers(item.cameras)
	};
}

export function sanitizeSidebarCardsInput(input: unknown): CardDraft[] {
	if (!Array.isArray(input)) return [];
	return dedupeCards(
		input
			.map((card, index) => toCardDraft(card, index))
			.filter((card): card is CardDraft => card !== null)
	);
}

export function sanitizeViewSectionsInput(
	input: unknown,
	tSection: string,
	normalizeSectionPositions: (sections: ViewSectionDraft[]) => ViewSectionDraft[]
): ViewSectionDraft[] {
	if (!Array.isArray(input)) return [];
	const sections = input
		.filter((entry) => entry && typeof entry === 'object')
		.map((entry, sectionIndex) => {
			const value = entry as Record<string, unknown>;
			const rawCards = Array.isArray(value.cards) ? value.cards : [];
			const cards = dedupeCards(
				rawCards
					.map((card, cardIndex) => toCardDraft(card, cardIndex))
					.filter((card): card is CardDraft => card !== null)
			);
			const rawColumn = Number(value.column);
			const rawOrder = Number(value.order);
			const rawSpan = Number(value.span);
			return {
				id:
					typeof value.id === 'string' && value.id.length > 0
						? value.id
						: `section-${Date.now()}-${sectionIndex}`,
				title:
					typeof value.title === 'string'
						? value.title
						: `${tSection} ${sectionIndex + 1}`,
				icon:
					typeof value.icon === 'string' && value.icon.trim().length > 0
						? value.icon.trim()
						: 'layout-grid',
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
			} satisfies ViewSectionDraft;
		})
		.filter((section): section is ViewSectionDraft => section !== null);
	return normalizeSectionPositions(sections);
}

export function localizeLegacyTitles(
	sections: ViewSectionDraft[],
	tSection: string,
	tCard: string
): ViewSectionDraft[] {
	const sectionPrefixRegex = /^Section\s+(\d+)$/i;
	const cardPrefixRegex = /^Card\s+(\d+)$/i;
	return sections.map((section) => {
		const sectionTitle = typeof section.title === 'string' ? section.title : '';
		const sectionMatch = sectionTitle.trim().match(sectionPrefixRegex);
		const title = sectionMatch ? `${tSection} ${sectionMatch[1]}` : sectionTitle;
		return {
			...section,
			title,
			cards: section.cards.map((card) => {
				const cardTitle = typeof card.title === 'string' ? card.title : '';
				const cardMatch = cardTitle.trim().match(cardPrefixRegex);
				return cardMatch ? { ...card, title: `${tCard} ${cardMatch[1]}` } : { ...card, title: cardTitle };
			})
		};
	});
}

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 2500) {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), timeoutMs);
	try {
		return await fetch(input, { ...init, signal: controller.signal });
	} finally {
		clearTimeout(timeout);
	}
}

function withNoCacheParam(url: string): string {
	try {
		const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
		const parsed = new URL(url, base);
		parsed.searchParams.set('np_ts', String(Date.now()));
		return parsed.toString();
	} catch {
		const separator = url.includes('?') ? '&' : '?';
		return `${url}${separator}np_ts=${Date.now()}`;
	}
}

function dedupeUrlOrder(urls: string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const u of urls) {
		if (!u || seen.has(u)) continue;
		seen.add(u);
		out.push(u);
	}
	return out;
}

/** Public Nova API origin discovered from the active ingress/local route for panel-state sync. */
let resolvedPanelAuthorityOrigin: string | null | undefined = undefined;
let panelAuthorityResolutionPromise: Promise<void> | null = null;

async function resolvePanelAuthorityOriginInner(): Promise<void> {
	resolvedPanelAuthorityOrigin = null;
	const urls = dedupeUrlOrder(collectPanelStateDiscoveryCandidates('api/panel-sync-config')).slice(0, 14);
	const syncFetchInit: RequestInit = {
		credentials: 'include',
		cache: 'no-store',
		headers: {
			'cache-control': 'no-cache, no-store, must-revalidate',
			pragma: 'no-cache'
		}
	};
	const tryUrl = async (url: string) => {
		try {
			const response = await fetchWithTimeout(withNoCacheParam(url), syncFetchInit, 3500);
			if (!response.ok) return null;
			return ((await response.json()) as { ok?: unknown; authorityBaseUrl?: unknown }) ?? null;
		} catch {
			return null;
		}
	};
	/** Parallel waves avoid sequential multi‑minute waits when ingress/SW misbehaves on early URLs. */
	const WAVE = 5;
	for (let i = 0; i < urls.length; i += WAVE) {
		const chunk = urls.slice(i, i + WAVE);
		const parsed = await Promise.all(chunk.map((u) => tryUrl(u)));
		for (const raw of parsed) {
			if (!raw || raw.ok !== true) continue;
			if (typeof raw.authorityBaseUrl === 'string' && raw.authorityBaseUrl.trim()) {
				try {
					const u = new URL(raw.authorityBaseUrl.trim());
					// Preserve ingress path when present (e.g. /api/hassio_ingress/TOKEN)
					if (u.pathname && u.pathname.length > 1) {
						resolvedPanelAuthorityOrigin = `${u.protocol}//${u.host}${u.pathname}`.replace(/\/+$/, '');
					} else {
						resolvedPanelAuthorityOrigin = `${u.protocol}//${u.host}`;
					}
				} catch {}
			}
			return;
		}
	}
}

/** Resolve once per tab load so candidate URLs can prepend the configured public HA origin. Call before getPanelStateApiCandidates. */
export async function ensurePanelAuthorityReady(): Promise<void> {
	if (typeof window === 'undefined') return;
	if (!panelAuthorityResolutionPromise) {
		panelAuthorityResolutionPromise = resolvePanelAuthorityOriginInner();
	}
	await panelAuthorityResolutionPromise;
}

function buildAuthorityOriginPanelApiUrls(panelStateApiPath: string): string[] {
	if (!resolvedPanelAuthorityOrigin) return [];
	const normalizedApiPath = panelStateApiPath.replace(/^\/+/, '');
	const base = resolvedPanelAuthorityOrigin.replace(/\/+$/, '');
	// Direct path first (works when base already contains ingress path)
	const urls: string[] = [`${base}/${normalizedApiPath}`];
	// Only add /local_novapanel/ variant when the base is a plain origin (no ingress path)
	if (!base.includes('/api/hassio_ingress/')) {
		urls.push(`${base}/local_novapanel/${normalizedApiPath}`);
	}
	return urls;
}

/** Discovery URLs for a panel API path (same-origin), without preferred-memory or authority prepend. */
function collectPanelStateDiscoveryCandidates(panelStateApiPath: string): string[] {
	const origin = window.location.origin;
	const pathname = window.location.pathname || '/';
	const pageDir = pathname.endsWith('/') ? pathname : `${pathname}/`;
	const pathnameBase = pathname.replace(/\/+$/, '');
	const normalizedApiPath = panelStateApiPath.replace(/^\/+/, '');
	const absoluteApiPath = `/${normalizedApiPath}`;
	const currentAppBase = getCurrentAppPathBase(pathname);

	const ingressPath = (window as Window & { __novapanel_ingress?: string }).__novapanel_ingress;
	const normalizedIngress =
		typeof ingressPath === 'string' && ingressPath.length > 0 ? ingressPath.replace(/\/+$/, '') : '';
	let perfIngressBase = '';
	try {
		const perfIngress = performance
			.getEntriesByType('resource')
			.map((entry) => entry.name)
			.find((url) => url.includes('/api/hassio_ingress/'));
		perfIngressBase = perfIngress?.match(/\/api\/hassio_ingress\/[^/]+/)?.[0] ?? '';
	} catch {}

	const ordered: string[] = [];
	const append = (value: string) => {
		if (value) ordered.push(value);
	};

	const appendIngressPairForBase = (ingressBase: string) => {
		const base = ingressBase.replace(/\/+$/, '');
		if (!base) return;
		append(`${origin}${base}/${normalizedApiPath}`);
		append(`${base}/${normalizedApiPath}`);
	};

	const appendCurrentAppBasePair = (appBase: string) => {
		const base = appBase.replace(/\/+$/, '');
		if (!base) return;
		append(`${origin}${base}/${normalizedApiPath}`);
		append(`${base}/${normalizedApiPath}`);
	};

	if (currentAppBase) {
		appendCurrentAppBasePair(currentAppBase);
	}

	// Highest priority: derive ingress base from the loaded module URL itself.
	try {
		const modulePath = new URL(import.meta.url).pathname;
		const moduleIngressBase = modulePath.match(/^(\/api\/hassio_ingress\/[^/]+)/)?.[1] ?? '';
		if (moduleIngressBase) {
			appendIngressPairForBase(moduleIngressBase);
		}
	} catch {}

	if (perfIngressBase) {
		appendIngressPairForBase(perfIngressBase);
	}
	const pathnameIngressMatchEarly = pathname.match(/^(\/api\/hassio_ingress\/[^/]+)/);
	if (pathnameIngressMatchEarly?.[1]) {
		appendIngressPairForBase(pathnameIngressMatchEarly[1]);
	}
	try {
		const base = new URL(document.baseURI);
		const basePath = base.pathname.replace(/\/+$/, '');
		if (basePath.includes('/api/hassio_ingress/')) {
			const m = basePath.match(/^(\/api\/hassio_ingress\/[^/]+)(.*)$/);
			if (m?.[1]) {
				const under = m[2] && m[2].length > 0 ? m[2] : '';
				if (under) {
					const pathWith = `${m[1]}${under}`.replace(/\/+$/, '');
					append(`${base.origin}${pathWith}/${panelStateApiPath}`);
				}
				appendIngressPairForBase(m[1]);
			}
		}
	} catch {}
	if (normalizedIngress) {
		appendIngressPairForBase(normalizedIngress);
	}

	// Onder HA Ingress is /api/panel-state zonder prefix nooit valide (HA proxiet 404).
	// Sla die fallbacks alleen aan voor non-ingress setups (lokale dev / direct-LAN).
	const runningUnderIngress = Boolean(normalizedIngress || perfIngressBase || pathnameIngressMatchEarly || currentAppBase);
	if (!runningUnderIngress) {
		append(`${origin}/local_novapanel/${normalizedApiPath}`);
		append(`/local_novapanel/${normalizedApiPath}`);
		append(`${origin}${absoluteApiPath}`);
		append(absoluteApiPath);
	}
	try {
		const parentOrigin = window.parent?.location?.origin;
		if (parentOrigin && currentAppBase) {
			append(`${parentOrigin}${currentAppBase}/${normalizedApiPath}`);
		}
		if (parentOrigin && !runningUnderIngress) {
			append(`${parentOrigin}${absoluteApiPath}`);
			append(`${parentOrigin}/local_novapanel/${normalizedApiPath}`);
		}
	} catch {}
	try {
		const topOrigin = window.top?.location?.origin;
		if (topOrigin && currentAppBase) {
			append(`${topOrigin}${currentAppBase}/${normalizedApiPath}`);
		}
		if (topOrigin && !runningUnderIngress) {
			append(`${topOrigin}${absoluteApiPath}`);
			append(`${topOrigin}/local_novapanel/${normalizedApiPath}`);
		}
	} catch {}

	append(new URL(panelStateApiPath, `${origin}${pageDir}`).toString());
	if (pathnameBase.length > 0) {
		append(`${pathnameBase}/${panelStateApiPath}`);
		append(`${origin}${pathnameBase}/${panelStateApiPath}`);
	}
	try {
		const parentOrigin = window.parent?.location?.origin;
		if (parentOrigin && normalizedIngress) {
			append(`${parentOrigin}${normalizedIngress}/${normalizedApiPath}`);
		}
	} catch {}
	return ordered;
}

export function getPanelStateApiCandidates(panelStateApiPath: string): string[] {
	if (typeof window === 'undefined') return [];
	touchSyncDiagProbe('getPanelStateApiCandidates');
	const ordered = collectPanelStateDiscoveryCandidates(panelStateApiPath);
	return dedupeUrlOrder([
		...buildAuthorityOriginPanelApiUrls(panelStateApiPath),
		...ordered,
		...loadPreferredPanelStateUrls()
	]);
}

function normalizePanelStateCandidateUrl(url: string): string {
	if (typeof window === 'undefined') return url;
	try {
		const u = new URL(url, window.location.origin);
		u.hash = '';
		return u.href;
	} catch {
		return url;
	}
}

export async function readAddonPanelState(candidates: string[]): Promise<PanelStatePayload | null> {
	if (typeof window === 'undefined') return null;
	touchSyncDiagProbe('readAddonPanelState');
	// Parallel GETs: sequential tries stacked ~8s each on slow networks and never finished on mobile.
	const readTimeoutMs = 9000;
	let uniqueCandidates: string[] = [];
	let fatalError: string | undefined;
	let bestPayload: PanelStatePayload | null = null;
	let bestScore = -1;
	let bestUpdatedAt = -1;
	let bestUrl = '';
	const attempts: Array<{
		url: string;
		ok: boolean;
		score?: number;
		updatedAt?: number;
		note?: string;
	}> = [];
	const scorePayload = (payload: PanelStatePayload): number => {
		const sections = Array.isArray(payload.dashboard?.viewSections) ? payload.dashboard?.viewSections : [];
		const sidebar = Array.isArray(payload.dashboard?.sidebarCards) ? payload.dashboard?.sidebarCards : [];
		let viewCards = 0;
		for (const section of sections) {
			if (!section || typeof section !== 'object') continue;
			const cards = (section as Record<string, unknown>).cards;
			if (Array.isArray(cards)) viewCards += cards.length;
		}
		const hasConfig = payload.configuration ? 1 : 0;
		return viewCards + sidebar.length + hasConfig;
	};
	const getUpdatedAt = (payload: PanelStatePayload): number =>
		typeof payload.dashboard?.updatedAt === 'number' && Number.isFinite(payload.dashboard.updatedAt)
			? payload.dashboard.updatedAt
			: -1;

	const fetchInit: RequestInit = {
		credentials: 'include',
		cache: 'no-store',
		headers: {
			'cache-control': 'no-cache, no-store, must-revalidate',
			pragma: 'no-cache'
		}
	};

	type TryRow =
		| { url: string; ok: false; note: string }
		| { url: string; ok: true; score: number; updatedAt: number; payload: PanelStatePayload };

	const parsePanelStateResponse = async (response: Response, url: string): Promise<TryRow> => {
		if (!response.ok) {
			return { url, ok: false, note: `http_${response.status}` };
		}
		const novapanelHeader = response.headers.get('x-novapanel-state');
		const payload = (await response.json()) as unknown;
		if (!payload || typeof payload !== 'object') {
			return { url, ok: false, note: 'invalid_payload' };
		}
		const p = payload as Record<string, unknown>;
		const hasNovaPanelHeader = novapanelHeader === '1';
		const hasExpectedStructure = 'dashboard' in p || 'configuration' in p;
		if (!hasNovaPanelHeader && !hasExpectedStructure) {
			return { url, ok: false, note: 'unexpected_shape' };
		}
		// Count keys ignoring the internal _np_api_base hint field
		const relevantKeys = Object.keys(p).filter(k => k !== '_np_api_base');
		if (relevantKeys.length === 0) {
			return { url, ok: false, note: 'empty_payload' };
		}
		const typedPayload = payload as PanelStatePayload;
		const score = scorePayload(typedPayload);
		const updatedAt = getUpdatedAt(typedPayload);
		// Extract and register the writing device's canonical API base as a preferred URL hint
		const apiBaseHint = typeof p._np_api_base === 'string' ? p._np_api_base.trim() : '';
		if (apiBaseHint) {
			try {
				const hintUrl = `${apiBaseHint.replace(/\/+$/, '')}/api/panel-state`;
				rememberPreferredPanelStateUrl(hintUrl);
				// Also seed it into the authority resolution if not set yet
				if (!resolvedPanelAuthorityOrigin) {
					const u = new URL(apiBaseHint);
					resolvedPanelAuthorityOrigin = u.pathname && u.pathname.length > 1
						? `${u.protocol}//${u.host}${u.pathname}`.replace(/\/+$/, '')
						: `${u.protocol}//${u.host}`;
				}
			} catch {}
		}
		return { url, ok: true, score, updatedAt, payload: typedPayload };
	};

	const toReadPostUrl = (url: string): string => {
		const replaced = url.replace(/\/panel-state(?=\/?$|\?)/, '/panel-state/read');
		return replaced;
	};

	async function tryOne(url: string): Promise<TryRow> {
		try {
			const requestUrl = withNoCacheParam(url);
			const response = await fetchWithTimeout(requestUrl, fetchInit, readTimeoutMs);
			return await parsePanelStateResponse(response, url);
		} catch {
			return { url, ok: false, note: 'exception' };
		}
	}

	async function tryOneReadPost(url: string): Promise<TryRow> {
		const readPostUrl = toReadPostUrl(url);
		try {
			const requestUrl = withNoCacheParam(readPostUrl);
			const response = await fetchWithTimeout(
				requestUrl,
				{
					method: 'POST',
					credentials: 'include',
					cache: 'no-store',
					headers: {
						'content-type': 'application/json',
						'cache-control': 'no-cache, no-store, must-revalidate',
						pragma: 'no-cache'
					},
					body: '{}'
				},
				readTimeoutMs
			);
			return await parsePanelStateResponse(response, readPostUrl);
		} catch {
			return { url: readPostUrl, ok: false, note: 'exception' };
		}
	}

	try {
		uniqueCandidates = dedupeUrlOrder(candidates.map((c) => normalizePanelStateCandidateUrl(c)));

		/** Few parallel sockets avoids addons/nginx rejecting thundering herds; still faster than fully sequential. */
		const READ_PARALLEL_BATCH = 5;
		const rows: TryRow[] = [];
		for (let offset = 0; offset < uniqueCandidates.length; offset += READ_PARALLEL_BATCH) {
			const slice = uniqueCandidates.slice(offset, offset + READ_PARALLEL_BATCH);
			const batch = await Promise.all(slice.map((url) => tryOne(url)));
			for (const r of batch) rows.push(r);
			if (batch.some((row) => row.ok)) break;
		}
		for (const row of rows) {
			if (!row.ok) {
				attempts.push({ url: row.url, ok: false, note: row.note });
				continue;
			}
			attempts.push({ url: row.url, ok: true, score: row.score, updatedAt: row.updatedAt });
			const { updatedAt, score, payload: typedPayload, url } = row;
			if (updatedAt > bestUpdatedAt || (updatedAt === bestUpdatedAt && score > bestScore)) {
				bestUpdatedAt = updatedAt;
				bestScore = score;
				bestPayload = typedPayload;
				bestUrl = url;
			}
		}
		if (bestPayload === null) {
			const fallbackRows: TryRow[] = [];
			for (let offset = 0; offset < uniqueCandidates.length; offset += READ_PARALLEL_BATCH) {
				const slice = uniqueCandidates.slice(offset, offset + READ_PARALLEL_BATCH);
				const batch = await Promise.all(slice.map((url) => tryOneReadPost(url)));
				for (const r of batch) fallbackRows.push(r);
				if (batch.some((row) => row.ok)) break;
			}
			for (const row of fallbackRows) {
				if (!row.ok) {
					attempts.push({ url: row.url, ok: false, note: `fallback_${row.note}` });
					continue;
				}
				attempts.push({ url: row.url, ok: true, score: row.score, updatedAt: row.updatedAt, note: 'fallback_post_read' });
				const { updatedAt, score, payload: typedPayload, url } = row;
				if (updatedAt > bestUpdatedAt || (updatedAt === bestUpdatedAt && score > bestScore)) {
					bestUpdatedAt = updatedAt;
					bestScore = score;
					bestPayload = typedPayload;
					bestUrl = url;
				}
			}
		}
	} catch (e) {
		fatalError = e instanceof Error ? e.message : String(e);
	} finally {
		let diagPayload: Record<string, unknown> = {
			ts: Date.now(),
			chosenUrl: bestUrl || null,
			chosenUpdatedAt: bestUpdatedAt,
			chosenScore: bestScore,
			attempts,
			candidateCount: uniqueCandidates.length,
			fatalError: fatalError ?? null
		};
		try {
			diagPayload = JSON.parse(JSON.stringify(diagPayload)) as Record<string, unknown>;
		} catch {
			diagPayload = {
				ts: Date.now(),
				chosenUrl: null,
				chosenUpdatedAt: -1,
				chosenScore: -1,
				attempts: [],
				candidateCount: uniqueCandidates.length,
				fatalError: 'diag_json_roundtrip_failed',
				originalFatalError: fatalError ?? null
			};
		}
		storeSyncDiag(SYNC_DIAG_READ_KEY, diagPayload);
		try {
			if (typeof sessionStorage !== 'undefined') {
				if (bestPayload !== null) sessionStorage.setItem(SESSION_ADDON_READ_OK_KEY, '1');
				else sessionStorage.removeItem(SESSION_ADDON_READ_OK_KEY);
			}
		} catch {}
		if (bestUrl) rememberPreferredPanelStateUrl(bestUrl);
	}
	return bestPayload;
}

export async function writeAddonPanelState(candidates: string[], payload: {
	dashboard?: {
		layout: { columns: 1 | 2 | 3; popupWidth: number; popupHeight: number };
		viewSections: ViewSectionDraft[];
		sidebarCards: CardDraft[];
		updatedAt?: number;
	};
	configuration?: {
		language: string;
		cardLibraryTab: CardLibraryTab;
		titles: { cardLibrary?: string; homeviewPreview?: string };
	};
}): Promise<boolean> {
	if (typeof window === 'undefined') return false;
	await ensurePanelAuthorityReady();
	touchSyncDiagProbe('writeAddonPanelState');
	const writeTimeoutMs = 8000;
	const body = JSON.stringify(payload);
	let wroteAny = false;
	const attempts: Array<{ url: string; ok: boolean; note?: string }> = [];
	for (let round = 0; round < 2; round += 1) {
		if (round > 0) {
			await new Promise((resolve) => setTimeout(resolve, 300));
		}
		try {
			for (const url of candidates) {
				try {
					const requestUrl = withNoCacheParam(url);
					const response = await fetchWithTimeout(
						requestUrl,
						{
							method: 'POST',
							headers: {
								'content-type': 'application/json',
								'cache-control': 'no-cache, no-store, must-revalidate',
								pragma: 'no-cache'
							},
							credentials: 'include',
							body
						},
						writeTimeoutMs
					);
					if (!response.ok) {
						attempts.push({ url, ok: false, note: `http_${response.status}` });
						continue;
					}
					const headerOk = response.headers.get('x-novapanel-state') === '1';
					let bodyOk = false;
					try {
						const ack = (await response.json()) as { ok?: boolean };
						bodyOk = ack?.ok === true;
					} catch {
						bodyOk = false;
					}
					if (bodyOk || headerOk) {
						wroteAny = true;
						attempts.push({ url, ok: true });
						rememberPreferredPanelStateUrl(url);
						break;
					} else {
						attempts.push({ url, ok: false, note: 'ack_failed' });
					}
				} catch {
					attempts.push({ url, ok: false, note: 'exception' });
					continue;
				}
			}
		} catch {}
		if (wroteAny) {
			storeSyncDiag(SYNC_DIAG_WRITE_KEY, {
				ts: Date.now(),
				wroteAny: true,
				attempts
			});
			return true;
		}
	}
	storeSyncDiag(SYNC_DIAG_WRITE_KEY, {
		ts: Date.now(),
		wroteAny,
		attempts
	});
	return wroteAny;
}

export function isRemovedLegacySidebarSeed(cards: CardDraft[]) {
	return (
		cards.length === 3 &&
		cards[0]?.id === 'sidebar-1' &&
		cards[1]?.id === 'sidebar-2' &&
		cards[2]?.id === 'sidebar-3'
	);
}
