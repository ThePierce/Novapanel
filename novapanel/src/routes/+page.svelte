<script lang="ts">
	import { browser } from '$app/environment';
	import { get } from 'svelte/store';
	import { onMount, tick } from 'svelte';
	import {
		createEditHistory,
		type EditHistoryState
	} from '$lib/edit-mode/history';
	import { isLanguageCode, setLanguage, translate, type LanguageCode, type TranslationKey } from '$lib/i18n';
	import {
		clearPersistedPanelStateForResync,
		loadConfiguration,
		loadDashboard,
		migrateLegacyPanelState,
		saveConfiguration,
		saveDashboard,
		type CardDraft,
		type ViewSectionDraft
	} from '$lib/persistence/panel-state';
	import {
		downloadNovaPanelJson,
		parseNovaPanelImportPayload,
		type NovaPanelExportedBundle
	} from '$lib/persistence/panel-state-io';
	import { buildPersistDraftData } from '$lib/panel/page-persist';
	import { readStoredValue, writeStoredValue } from '$lib/persistence/storage';
	import { cardCatalog } from '$lib/cards/store';
	import { getLocalizedCardLabel as getLocalizedCardLabelHelper } from '$lib/cards/label';
	import ClockCard from '$lib/cards/ClockCard.svelte';
	import WelcomeCard from '$lib/cards/WelcomeCard.svelte';
	import LightButtonCard from '$lib/cards/LightButtonCard.svelte';
	import EntityButtonCard from '$lib/cards/EntityButtonCard.svelte';
	import type { EntityButtonKind } from '$lib/cards/entity-button-types';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import { filterEntitiesForStatusCard, type StatusCardKind } from '$lib/cards/status/status-engine';
	import TopDrawer from '$lib/layout/TopDrawer.svelte';
	import SidebarShell from '$lib/sidebar/SidebarShell.svelte';
	import LazyComponent from '$lib/lazy/LazyComponent.svelte';
	import { entityStore } from '$lib/ha/entities-store';
	import { openHASidebar } from '$lib/ha/sidebar-toggle';
	import {
		getClockStyleValue as getClockStyleValueHelper,
		isRemovedLegacySidebarSeed as isRemovedLegacySidebarSeedHelper,
		localizeLegacyTitles as localizeLegacyTitlesHelper,
		sanitizeSidebarCardsInput as sanitizeSidebarCardsInputHelper,
		sanitizeViewSectionsInput as sanitizeViewSectionsInputHelper,
		ensurePanelAuthorityReady,
		writeAddonPanelState
	} from '$lib/panel/page-helpers';
	import { createPageDndRuntime } from '$lib/panel/page-dnd-runtime';
	import {
		safeBuildRenderedSidebarCards,
		safeBuildRenderedViewSections,
		safeBuildSidebarItems
	} from '$lib/panel/page-render-safety';
	import { buildLocalBootstrapState } from '$lib/panel/page-local-bootstrap';
	import { createPageEditSessionRuntime } from '$lib/panel/page-edit-session-runtime';
	import { createPageEditorUiRuntime } from '$lib/panel/page-editor-ui-runtime';
	import { createPageBootstrapRuntime } from '$lib/panel/page-bootstrap-runtime';
	import { createPageLayoutControlsRuntime } from '$lib/panel/page-layout-controls-runtime';
	import { createPageDraftRuntime } from '$lib/panel/page-draft-runtime';
	import {
		persistDashboardStateRuntime
	} from '$lib/panel/page-runtime';
	import { cloneForPersistence, safeCompareJson } from '$lib/panel/page-state-utils';
	import { countViewCards, createDebugLogger, PAGE_DEBUG_BUILD, setupGlobalDebug } from '$lib/panel/page-debug';
	import './+page.css';

	function cachedImport<T>(loader: () => Promise<T>): () => Promise<T> {
		let promise: Promise<T> | null = null;
		return () => {
			if (!promise) {
				promise = loader().catch((error) => {
					promise = null;
					throw error;
				});
			}
			return promise;
		};
	}

	const loadCardLibraryModal = cachedImport(() => import('$lib/cards/library/CardLibraryModal.svelte'));
	const loadCardEditorModal = cachedImport(() => import('$lib/cards/editor/CardEditorModal.svelte'));
	const loadWeatherDetailsModal = cachedImport(() => import('$lib/cards/WeatherDetailsModal.svelte'));
	const loadWeatherForecastDetailsModal = cachedImport(() =>
		import('$lib/cards/WeatherForecastDetailsModal.svelte')
	);
	const loadAlarmPanelDetailsModal = cachedImport(() => import('$lib/cards/AlarmPanelDetailsModal.svelte'));
	const loadEnergyDetailsModal = cachedImport(() => import('$lib/cards/EnergyDetailsModal.svelte'));
	const loadCamerasStripCard = cachedImport(() => import('$lib/cards/CamerasStripCard.svelte'));
	const loadCameraDetailsModal = cachedImport(() => import('$lib/cards/CameraDetailsModal.svelte'));
	const loadWeekCalendarCard = cachedImport(() => import('$lib/cards/WeekCalendarCard.svelte'));
	const loadLightButtonDetailsModal = cachedImport(() => import('$lib/cards/LightButtonDetailsModal.svelte'));
	const loadEntityButtonDetailsModal = cachedImport(() => import('$lib/cards/EntityButtonDetailsModal.svelte'));
	const loadEnergyAnchorEditor = cachedImport(() => import('$lib/cards/EnergyAnchorEditor.svelte'));
	const loadLightGroupPickerOverlay = cachedImport(() => import('$lib/cards/LightGroupPickerOverlay.svelte'));
	const loadStatusDetailsModal = cachedImport(() => import('$lib/cards/status/StatusDetailsModal.svelte'));
	const loadSectionEditorModal = cachedImport(() => import('$lib/sections/SectionEditorModal.svelte'));
	const loadSectionCardsModal = cachedImport(() => import('$lib/sections/SectionCardsModal.svelte'));
	const loadSettingsModal = cachedImport(() => import('$lib/settings/SettingsModal.svelte'));

	type SettingsTab = 'general' | 'layout' | 'theme';
	type CardLibraryTab = 'sidebar' | 'view';
	type CardEditorState = { zone: 'sidebar' | 'view'; id: string } | null;
	type ResponsiveViewSection = ViewSectionDraft & {
		displayColumn: number;
		displaySpan: number;
		displayOrder: number;
	};
	type SectionHeaderMetric = {
		icon: string;
		label: string;
		entity: { entityId: string; friendlyName: string; state: string; unit?: string };
	};

	let selectedColumns = $state<1 | 2 | 3>(2);
	let viewportWidth = $state(0);
	let viewportHeight = $state(0);
	let viewportIsPortrait = $state(false);
	let controlsOpen = $state(false);
	let settingsOpen = $state(false);
	let cardLibraryOpen = $state(false);
	let activeCardLibraryTab = $state<CardLibraryTab>('sidebar');
	let activeSettingsTab = $state<SettingsTab>('general');
	let selectedLanguage = $state<LanguageCode>('nl');
	let customTitles = $state<{ cardLibrary?: string; homeviewPreview?: string }>({});
	let oauthSpotifyClientId = $state('');
	let oauthSpotifyClientSecret = $state('');
	let oauthSpotifyRedirectUri = $state('');
	let oauthTuneInUserId = $state('');
	// Media Hub state (server-synced)
	let mediaHubOnkyoBridges = $state<Array<{ id: string; label: string; zoneEntityId: string; spotifySource?: string }>>([]);
	let mediaHubPlayerOrder = $state<string[]>([]);
	let mediaHubPlayerAliases = $state<Record<string, string>>({});
	let savedCardLibraryTab = $state<CardLibraryTab>('sidebar');
	let savedCustomTitles = $state<{ cardLibrary?: string; homeviewPreview?: string }>({});
	let editMode = $state(false);
	let savedLayout = $state<{ columns: 1 | 2 | 3; popupWidth: number; popupHeight: number }>({
		columns: 2,
		popupWidth: 850,
		popupHeight: 1140
	});
	let savedUpdatedAt = $state<number>(0);

	let savedViewSections = $state<ViewSectionDraft[]>([]);
	let savedSidebarCards = $state<CardDraft[]>([]);
	let sectionMasonryRows = $state<Record<string, number>>({});
	let expandedWeekCalendarCardId = $state('');
	type PanelDraftSnapshot = { viewSections: ViewSectionDraft[]; sidebarCards: CardDraft[] };
	let panelDraftHistory = $state<EditHistoryState<PanelDraftSnapshot>>(
		createEditHistory<PanelDraftSnapshot>({ viewSections: [], sidebarCards: [] })
	);
	let cardEditorOpen = $state(false);
	let cardEditor = $state<CardEditorState>(null);
	let weatherDetailOpen = $state(false);
	let weatherForecastDetailOpen = $state(false);
	let alarmDetailOpen = $state(false);
	let energyDetailOpen = $state(false);
	let cameraDetailOpen = $state(false);
	let cameraDetailCamera = $state<import('$lib/persistence/panel-state-types').CameraConfig | null>(null);
	let lightButtonDetailOpen = $state(false);
	let lightButtonDetailCard = $state<{
		title?: string;
		entityId?: string;
		icon?: string;
	}>({});
	let entityButtonDetailOpen = $state(false);
	let entityButtonDetailCard = $state<{
		kind?: EntityButtonKind;
		title?: string;
		entityId?: string;
		icon?: string;
	}>({});
	type EnergyDetailCardState = {
		id?: string;
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
		energyDeviceAliases?: Record<string, string>;
		energyDeviceSnapshot?: { date: string; values: Record<string, number> };
		hasCustomDayNoCar?: boolean;
		hasCustomDayWithCar?: boolean;
		hasCustomNightNoCar?: boolean;
		hasCustomNightWithCar?: boolean;
		anchorsDayNoCar?: import('$lib/persistence/panel-state-types').EnergyAnchors;
		anchorsDayWithCar?: import('$lib/persistence/panel-state-types').EnergyAnchors;
		anchorsNightNoCar?: import('$lib/persistence/panel-state-types').EnergyAnchors;
		anchorsNightWithCar?: import('$lib/persistence/panel-state-types').EnergyAnchors;
	};
	let energyDetailCard = $state<EnergyDetailCardState>({});
	let statusDetailOpen = $state(false);
	let alarmDetailEntityId = $state<string | undefined>(undefined);
	let statusDetailCardId = $state<string | undefined>(undefined);
	let statusDetailKind = $state<StatusCardKind>('lights_status');
	let statusDetailTitle = $state('');
	let statusDetailDomains = $state<string[]>([]);
	let statusDetailDeviceClasses = $state<string[]>([]);
	let statusDetailEntityIds = $state<string[]>([]);
	let statusDetailEntityAliases = $state<Record<string, string>>({});
	let statusDetailEntityIconOverrides = $state<Record<string, string>>({});
	let statusDetailIgnoredEntityIds = $state<string[]>([]);
	let weatherDetailEntityId = $state<string | undefined>(undefined);
	let weatherForecastEntityId = $state<string | undefined>(undefined);
	let weatherForecastType = $state<'daily' | 'hourly' | 'twice_daily'>('daily');
	let weatherForecastDaysToShow = $state<number>(7);
	let cardEditorTitle = $state('');
	let cardEditorType = $state('clock');
	let cardEditorEntityId = $state<string | undefined>(undefined);
	let cardEditorAnalogStyle = $state<1 | 2 | 3 | 4>(1);
	let cardEditorDigitalStyle = $state<1 | 2 | 3 | 4>(1);
	let cardEditorClockStyle = $state<CardDraft['clockStyle']>('digital');
	let cardEditorClockShowAnalog = $state<boolean>(false);
	let cardEditorClockShowDigital = $state<boolean>(true);
	let cardEditorClockHour12 = $state<boolean>(false);
	let cardEditorClockSeconds = $state<boolean>(false);
	let cardEditorDateLayout = $state<CardDraft['dateLayout']>('vertical');
	let cardEditorDateShortDay = $state<boolean>(false);
	let cardEditorDateShortMonth = $state<boolean>(false);
	let cardEditorDateAlign = $state<CardDraft['dateAlign']>('center');
	let cardEditorDateWeekdayWithDate = $state<boolean>(false);
	let cardEditorWeatherForecastType = $state<CardDraft['weatherForecastType']>('daily');
	let cardEditorWeatherForecastDaysToShow = $state<number>(5);
	let cardEditorStatusDomains = $state<string[]>([]);
	let cardEditorStatusDeviceClasses = $state<string[]>([]);
	let cardEditorStatusEntityIds = $state<string[]>([]);
	let cardEditorStatusEntityAliases = $state<Record<string, string>>({});
	let cardEditorStatusEntityIconOverrides = $state<Record<string, string>>({});
	// Light group picker state — lifted to page.svelte so it renders outside the transformed modal
	let lgPickerOpen = $state(false);
	let lgPickerEditingId = $state<string | null>(null);
	let lgPickerDraftName = $state('');
	let lgPickerDraftEntityIds = $state<string[]>([]);
	let lgPickerCardId = $state('');
	let lgPickerGroups = $state<Array<{id:string;name:string;entityIds:string[]}>>([]);
	let lgGroupsVersion = $state(0); // incremented to force CardEditorModal to reload groups

	import { loadLightGroups, saveLightGroups, type LightGroup } from '$lib/cards/light-groups';

	function lgPickerGetFriendlyName(entityId: string): string {
		const entities = $entityStore?.entities ?? [];
		const e = entities.find((e: any) => e.entityId === entityId);
		return e?.friendlyName?.trim() || entityId;
	}
	function lgPickerToggle(entityId: string) {
		if (lgPickerDraftEntityIds.includes(entityId)) lgPickerDraftEntityIds = lgPickerDraftEntityIds.filter(id => id !== entityId);
		else lgPickerDraftEntityIds = [...lgPickerDraftEntityIds, entityId];
	}
	function lgPickerSave() {
		if (!lgPickerCardId || !lgPickerEditingId) return;
		const groups = loadLightGroups(lgPickerCardId);
		const updated = groups.map(g => g.id === lgPickerEditingId ? { ...g, name: lgPickerDraftName, entityIds: lgPickerDraftEntityIds } : g);
		saveLightGroups(lgPickerCardId, updated);
		lgPickerGroups = updated;
		lgPickerOpen = false;
		lgPickerEditingId = null;
		lgGroupsVersion++;
	}
	function lgPickerDelete() {
		if (!lgPickerCardId || !lgPickerEditingId) return;
		const groups = loadLightGroups(lgPickerCardId);
		const updated = groups.filter(g => g.id !== lgPickerEditingId);
		saveLightGroups(lgPickerCardId, updated);
		lgPickerGroups = updated;
		lgPickerOpen = false;
		lgPickerEditingId = null;
		lgGroupsVersion++;
	}
	let cardEditorStatusDiscoveredEntityIds = $state<string[] | undefined>(undefined);
	let cardEditorStatusIcon = $state('lightbulb');
	let cardEditorNetEntityId = $state('');
	let cardEditorSolarEntityId = $state('');
	let cardEditorBatteryEntityId = $state('');
	let cardEditorGridEntityId = $state('');
	let cardEditorBatteryChargeEntityId = $state('');
	let cardEditorImportTodayEntityId = $state('');
	let cardEditorExportTodayEntityId = $state('');
	let cardEditorSolarTodayEntityId = $state('');
	let cardEditorHomeTodayEntityId = $state('');
	let cardEditorCostTodayEntityId = $state('');
	let cardEditorCompensationTodayEntityId = $state('');
	let cardEditorSelfSufficiencyEntityId = $state('');
	let cardEditorCarChargingEntityId = $state('');
	let cardEditorCarCableEntityId = $state('');
	let cardEditorCarChargingPowerEntityId = $state('');
	let cardEditorEnergyDeviceEntityIds = $state<string[]>([]);
	let cardEditorEnergyDeviceTodayEntityIds = $state<string[]>([]);
	let cardEditorEnergyDeviceAliases = $state<Record<string, string>>({});
	let cardEditorCameras = $state<import('$lib/persistence/panel-state-types').CameraConfig[]>([]);
	let cardEditorHasCustomDayNoCar = $state(false);
	let cardEditorHasCustomDayWithCar = $state(false);
	let cardEditorHasCustomNightNoCar = $state(false);
	let cardEditorHasCustomNightWithCar = $state(false);
	let cardEditorAnchorsDayNoCar = $state<import('$lib/persistence/panel-state-types').EnergyAnchors | undefined>(undefined);
	let cardEditorAnchorsDayWithCar = $state<import('$lib/persistence/panel-state-types').EnergyAnchors | undefined>(undefined);
	let cardEditorAnchorsNightNoCar = $state<import('$lib/persistence/panel-state-types').EnergyAnchors | undefined>(undefined);
	let cardEditorAnchorsNightWithCar = $state<import('$lib/persistence/panel-state-types').EnergyAnchors | undefined>(undefined);
	let cardEditorAnchorOverlayVariant = $state<string | null>(null);
	let cardEditorInitialTitle = $state('');
	let cardEditorInitialType = $state('clock');
	let cardEditorInitialEntityId = $state<string | undefined>(undefined);
	let cardEditorInitialAnalogStyle = $state<1 | 2 | 3 | 4>(1);
	let cardEditorInitialDigitalStyle = $state<1 | 2 | 3 | 4>(1);
	let cardEditorInitialClockStyle = $state<CardDraft['clockStyle']>('digital');
	let cardEditorInitialClockShowAnalog = $state<boolean>(false);
	let cardEditorInitialClockShowDigital = $state<boolean>(true);
	let cardEditorInitialClockHour12 = $state<boolean>(false);
	let cardEditorInitialClockSeconds = $state<boolean>(false);
	let cardEditorInitialDateLayout = $state<CardDraft['dateLayout']>('vertical');
	let cardEditorInitialDateShortDay = $state<boolean>(false);
	let cardEditorInitialDateShortMonth = $state<boolean>(false);
	let cardEditorInitialDateAlign = $state<CardDraft['dateAlign']>('center');
	let cardEditorInitialDateWeekdayWithDate = $state<boolean>(false);
	let cardEditorInitialWeatherForecastType = $state<CardDraft['weatherForecastType']>('daily');
	let cardEditorInitialWeatherForecastDaysToShow = $state<number>(5);
	let cardEditorInitialStatusDomains = $state<string[]>([]);
	let cardEditorInitialStatusDeviceClasses = $state<string[]>([]);
	let cardEditorInitialStatusEntityIds = $state<string[]>([]);
	let cardEditorInitialStatusDiscoveredEntityIds = $state<string[] | undefined>(undefined);
	let cardEditorInitialStatusEntityAliases = $state<Record<string, string>>({});
	let cardEditorInitialStatusEntityIconOverrides = $state<Record<string, string>>({});
	let cardEditorInitialStatusIcon = $state('lightbulb');
	let cardEditorInitialNetEntityId = $state('');
	let cardEditorInitialSolarEntityId = $state('');
	let cardEditorInitialBatteryEntityId = $state('');
	let cardEditorInitialGridEntityId = $state('');
	let cardEditorInitialBatteryChargeEntityId = $state('');
	let cardEditorInitialImportTodayEntityId = $state('');
	let cardEditorInitialExportTodayEntityId = $state('');
	let cardEditorInitialSolarTodayEntityId = $state('');
	let cardEditorInitialHomeTodayEntityId = $state('');
	let cardEditorInitialCostTodayEntityId = $state('');
	let cardEditorInitialCompensationTodayEntityId = $state('');
	let cardEditorInitialSelfSufficiencyEntityId = $state('');
	let cardEditorInitialCarChargingEntityId = $state('');
	let cardEditorInitialCarCableEntityId = $state('');
	let cardEditorInitialCarChargingPowerEntityId = $state('');
	let cardEditorInitialEnergyDeviceEntityIds = $state<string[]>([]);
	let cardEditorInitialEnergyDeviceTodayEntityIds = $state<string[]>([]);
	let cardEditorInitialEnergyDeviceAliases = $state<Record<string, string>>({});
	let cardEditorInitialCameras = $state<import('$lib/persistence/panel-state-types').CameraConfig[]>([]);
	let cardEditorInitialHasCustomDayNoCar = $state(false);
	let cardEditorInitialHasCustomDayWithCar = $state(false);
	let cardEditorInitialHasCustomNightNoCar = $state(false);
	let cardEditorInitialHasCustomNightWithCar = $state(false);
	let cardEditorInitialAnchorsDayNoCar = $state<import('$lib/persistence/panel-state-types').EnergyAnchors | undefined>(undefined);
	let cardEditorInitialAnchorsDayWithCar = $state<import('$lib/persistence/panel-state-types').EnergyAnchors | undefined>(undefined);
	let cardEditorInitialAnchorsNightNoCar = $state<import('$lib/persistence/panel-state-types').EnergyAnchors | undefined>(undefined);
	let cardEditorInitialAnchorsNightWithCar = $state<import('$lib/persistence/panel-state-types').EnergyAnchors | undefined>(undefined);
	let sectionEditorOpen = $state(false);
	let sectionCardsOpen = $state(false);
	let sectionCardsSection = $state<ViewSectionDraft | null>(null);
	let sectionEditorId = $state('');
	let sectionEditorTitle = $state('');
	let sectionEditorIcon = $state('layout-grid');
	let sectionEditorHeaderTemperatureEntityId = $state('');
	let sectionEditorHeaderHumidityEntityId = $state('');
	let sectionEditorHeaderPressureEntityId = $state('');
	let sectionEditorColumn = $state(1);
	let sectionEditorSpan = $state(1);
	let sectionEditorCardColumns = $state<1 | 2>(1);
	let sectionEditorInitialTitle = $state('');
	let sectionEditorInitialIcon = $state('layout-grid');
	let sectionEditorInitialHeaderTemperatureEntityId = $state('');
	let sectionEditorInitialHeaderHumidityEntityId = $state('');
	let sectionEditorInitialHeaderPressureEntityId = $state('');
	let sectionEditorInitialColumn = $state(1);
	let sectionEditorInitialSpan = $state(1);
	let sectionEditorInitialCardColumns = $state<1 | 2>(1);
	let activeViewSectionId = $state('');
	let draggingSectionId = $state('');
	let draggingViewCardId = $state('');
	let viewCardDropTargetId = $state('');
	let viewCardDropPlacement = $state<'before' | 'after'>('before');
	let draggingViewCardFromSectionId = $state('');
	let draggingSidebarCardId = $state('');
let recentDraggingSidebarCardId = $state('');
let sidebarDropTargetId = $state('');
let sidebarDropPlacement = $state<'before' | 'after'>('before');
let sectionDropTargetId = $state('');
let sectionDropPlacement = $state<'before' | 'after'>('before');
	let dragIndicatorActive = $state(false);
	let dragIndicatorValid = $state(false);
	let dragIndicatorX = $state(0);
	let dragIndicatorY = $state(0);
	const sidebarEnabled = true;
	const sidebarWidth = 325;
	const sidebarVisible = $derived(
		sidebarEnabled &&
			!(
				viewportWidth > 0 &&
				viewportHeight > 0 &&
				Math.min(viewportWidth, viewportHeight) < 600 &&
				viewportIsPortrait
			)
	);
	const isMobile = $derived(
		viewportWidth > 0 &&
			viewportHeight > 0 &&
			Math.min(viewportWidth, viewportHeight) < 600 &&
			viewportIsPortrait
	);
	let mobileSidebarOpen = $state(false);
	let touchStartX = $state(0);
	let touchStartY = $state(0);
	let touchTracking = $state(false);
	function onTouchStart(event: TouchEvent) {
		if (!isMobile) return;
		const touch = event.touches[0];
		if (!touch) return;
		if (!mobileSidebarOpen && touch.clientX > 24) return;
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
		touchTracking = true;
	}
	function onTouchMove(event: TouchEvent) {
		if (!touchTracking) return;
		const touch = event.touches[0];
		if (!touch) return;
		const dx = touch.clientX - touchStartX;
		const dy = touch.clientY - touchStartY;
		if (Math.abs(dy) > Math.abs(dx) + 10) {
			touchTracking = false;
		}
	}
	function onTouchEnd(event: TouchEvent) {
		if (!touchTracking) return;
		touchTracking = false;
		const touch = event.changedTouches[0];
		if (!touch) return;
		const dx = touch.clientX - touchStartX;
		const dy = touch.clientY - touchStartY;
		if (Math.abs(dy) > Math.abs(dx)) return;
		if (!mobileSidebarOpen && dx > 60) {
			mobileSidebarOpen = true;
		} else if (mobileSidebarOpen && dx < -60) {
			mobileSidebarOpen = false;
		}
	}
	const appGridColumns = $derived(sidebarVisible ? `${sidebarWidth}px 1fr` : '1fr');
	let isHydrated = $state(false);
	let panelBootstrap: Promise<void> | null = null;
	let addonHydrationRetryTimer: ReturnType<typeof setTimeout> | null = null;
	let addonHydrationRetries = 0;
	const PANEL_STATE_API_PATH = 'api/panel-state';
const debugEnabled = false;
const debugLog = createDebugLogger(debugEnabled);
setupGlobalDebug(debugEnabled, debugLog, PAGE_DEBUG_BUILD);
const CLIENT_BUILD = 'np-client-2026-05-03T16:32:00Z';
if (browser) {
	try { localStorage.setItem('np_diag_sync', String(Date.now())); } catch {}
	const win = window as Window & {
		__npForceServerSync?: () => Promise<boolean>;
	};
	try {
		const params = new URLSearchParams(window.location.search);
		if (params.get('np_resync') === '1') {
			clearPersistedPanelStateForResync();
			params.delete('np_resync');
			const qs = params.toString();
			const next = `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`;
			window.history.replaceState({}, '', next);
		}
	} catch {}
	try {
		localStorage.setItem('np_client_build', CLIENT_BUILD);
	} catch {}
	if (typeof win.__npForceServerSync !== 'function') {
		win.__npForceServerSync = async () => false;
	}
}

	function t(key: TranslationKey) {
		return translate(key, selectedLanguage);
	}

	/** Sidebar: geen detail-popup voor Lampen / Deuren & Ramen / Apparaten als er niets “actief” is. */
	function shouldSuppressQuietStatusDetailPopup(item: {
		type: string;
		statusDomains?: string[];
		statusDeviceClasses?: string[];
		statusEntityIds?: string[];
		ignoredEntityIds?: string[];
	}): boolean {
		if (
			item.type !== 'lights_status' &&
			item.type !== 'openings_status' &&
			item.type !== 'devices_status'
		) {
			return false;
		}
		const kind = item.type as StatusCardKind;
		const domains = item.statusDomains ?? [];
		const deviceClasses = item.statusDeviceClasses ?? [];
		const statusEntityIds = item.statusEntityIds ?? [];
		const ignoredEntityIds = item.ignoredEntityIds ?? [];
		const allEntities = get(entityStore).entities;

		const selectedEntityIdSet = new Set(
			statusEntityIds.map((v) => v.trim().toLowerCase()).filter((v) => v.length > 0)
		);
		const scopedEntities =
			selectedEntityIdSet.size > 0
				? allEntities.filter((e) => selectedEntityIdSet.has(e.entityId.toLowerCase()))
				: allEntities;

		const { active } = filterEntitiesForStatusCard({
			entities: scopedEntities,
			kind,
			domains,
			deviceClasses,
			ignoredEntityIds
		});
		return active.length === 0;
	}

	function onSidebarItemSelect(item: {
		id: string;
		type: string;
		title?: string;
		entityId?: string;
		alarmEntityId?: string;
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
		energyDeviceAliases?: Record<string, string>;
		energyDeviceSnapshot?: { date: string; values: Record<string, number> };
		hasCustomDayNoCar?: boolean;
		hasCustomDayWithCar?: boolean;
		hasCustomNightNoCar?: boolean;
		hasCustomNightWithCar?: boolean;
		anchorsDayNoCar?: import('$lib/persistence/panel-state-types').EnergyAnchors;
		anchorsDayWithCar?: import('$lib/persistence/panel-state-types').EnergyAnchors;
		anchorsNightNoCar?: import('$lib/persistence/panel-state-types').EnergyAnchors;
		anchorsNightWithCar?: import('$lib/persistence/panel-state-types').EnergyAnchors;
		statusDomains?: string[];
		statusDeviceClasses?: string[];
		statusEntityIds?: string[];
		statusEntityAliases?: Record<string, string>;
		statusEntityIconOverrides?: Record<string, string>;
		statusIcon?: string;
		ignoredEntityIds?: string[];
		weatherForecastType?: 'daily' | 'hourly' | 'twice_daily';
		weatherForecastDaysToShow?: number;
	}) {
		if (editMode) {
			openCardEditor('sidebar', item.id);
			return;
		}
		if (item.type === 'weather') {
			weatherDetailEntityId = item.entityId;
			weatherDetailOpen = true;
			return;
		}
		if (item.type === 'weather_forecast') {
			weatherForecastEntityId = item.entityId;
			weatherForecastType = item.weatherForecastType ?? 'daily';
			weatherForecastDaysToShow = item.weatherForecastDaysToShow ?? 7;
			weatherForecastDetailOpen = true;
			return;
		}
		if (item.type === 'alarm_panel') {
			alarmDetailEntityId = item.alarmEntityId ?? item.entityId;
			alarmDetailOpen = true;
			return;
		}
		if (item.type === 'energy') {
			energyDetailCard = {
				id: item.id,
				netEntityId: item.netEntityId ?? '',
				solarEntityId: item.solarEntityId ?? '',
				batteryEntityId: item.batteryEntityId ?? '',
				gridEntityId: item.gridEntityId ?? '',
				batteryChargeEntityId: item.batteryChargeEntityId ?? '',
				importTodayEntityId: item.importTodayEntityId ?? '',
				exportTodayEntityId: item.exportTodayEntityId ?? '',
				solarTodayEntityId: item.solarTodayEntityId ?? '',
				homeTodayEntityId: item.homeTodayEntityId ?? '',
				costTodayEntityId: item.costTodayEntityId ?? '',
				compensationTodayEntityId: item.compensationTodayEntityId ?? '',
				selfSufficiencyEntityId: item.selfSufficiencyEntityId ?? '',
				carChargingEntityId: item.carChargingEntityId ?? '',
				carCableEntityId: item.carCableEntityId ?? '',
				carChargingPowerEntityId: item.carChargingPowerEntityId ?? '',
				energyDeviceEntityIds: item.energyDeviceEntityIds ?? [],
				energyDeviceTodayEntityIds: item.energyDeviceTodayEntityIds ?? [],
				energyDeviceAliases: item.energyDeviceAliases ?? {},
				energyDeviceSnapshot: item.energyDeviceSnapshot,
				hasCustomDayNoCar: item.hasCustomDayNoCar,
				hasCustomDayWithCar: item.hasCustomDayWithCar,
				hasCustomNightNoCar: item.hasCustomNightNoCar,
				hasCustomNightWithCar: item.hasCustomNightWithCar,
				anchorsDayNoCar: item.anchorsDayNoCar,
				anchorsDayWithCar: item.anchorsDayWithCar,
				anchorsNightNoCar: item.anchorsNightNoCar,
				anchorsNightWithCar: item.anchorsNightWithCar
			};
			energyDetailOpen = true;
			return;
		}
		if (
			item.type === 'lights_status' ||
			item.type === 'openings_status' ||
			item.type === 'devices_status' ||
			item.type === 'availability_status' ||
			item.type === 'media_players_status'
		) {
			if (shouldSuppressQuietStatusDetailPopup(item)) {
				return;
			}
			statusDetailCardId = item.id;
			statusDetailKind = item.type as StatusCardKind;
			statusDetailTitle = item.title ?? getLocalizedCardLabel(item.type);
			statusDetailDomains = item.statusDomains ?? [];
			statusDetailDeviceClasses = item.statusDeviceClasses ?? [];
			statusDetailEntityIds = item.statusEntityIds ?? [];
			statusDetailEntityAliases = item.statusEntityAliases ?? {};
			statusDetailEntityIconOverrides = item.statusEntityIconOverrides ?? {};
			statusDetailIgnoredEntityIds = item.ignoredEntityIds ?? [];
			statusDetailOpen = true;
		}
	}

	async function updateIgnoredEntities(cardId: string | undefined, entityId: string, ignored: boolean) {
		if (!cardId) return;
		const nextSidebarCards = savedSidebarCards.map((card) => {
			if (card.id !== cardId) return card;
			const current = new Set(card.ignoredEntityIds ?? []);
			if (ignored) current.add(entityId);
			else current.delete(entityId);
			return { ...card, ignoredEntityIds: Array.from(current) };
		});
		savedSidebarCards = nextSidebarCards;
		statusDetailIgnoredEntityIds =
			nextSidebarCards.find((card) => card.id === cardId)?.ignoredEntityIds ?? [];
		await persistDashboardState();
	}

	async function updateEnergyDeviceSnapshot(
		cardId: string | undefined,
		snapshot: { date: string; values: Record<string, number> }
	) {
		if (!cardId) return;
		const updateCard = (card: import('$lib/persistence/panel-state-types').CardDraft) => {
			if (card.id !== cardId) return card;
			return { ...card, energyDeviceSnapshot: snapshot };
		};
		const nextSidebarCards = savedSidebarCards.map(updateCard);
		const nextViewSections = savedViewSections.map((section) => ({
			...section,
			cards: section.cards.map(updateCard)
		}));
		savedSidebarCards = nextSidebarCards;
		savedViewSections = nextViewSections;
		energyDetailCard = { ...energyDetailCard, energyDeviceSnapshot: snapshot };
		await persistDashboardState();
	}

	async function updateStatusDetailEntityIcon(
		cardId: string | undefined,
		entityId: string,
		icon: string | null
	) {
		if (!cardId) return;
		const trimmed = typeof icon === 'string' ? icon.trim() : '';
		const nextSidebarCards = savedSidebarCards.map((card) => {
			if (card.id !== cardId) return card;
			const next = { ...(card.statusEntityIconOverrides ?? {}) };
			if (trimmed.length > 0) next[entityId] = trimmed;
			else delete next[entityId];
			return {
				...card,
				statusEntityIconOverrides: next
			};
		});
		savedSidebarCards = nextSidebarCards;
		statusDetailEntityIconOverrides =
			nextSidebarCards.find((card) => card.id === cardId)?.statusEntityIconOverrides ?? {};
		await persistDashboardState();
	}

function getLocalizedCardLabel(type: string) {
	return getLocalizedCardLabelHelper(type, t);
}

function getClockStyleValue(value: unknown): 1 | 2 | 3 | 4 | undefined {
	return getClockStyleValueHelper(value);
}

function localizeLegacyTitles(sections: ViewSectionDraft[]) {
	return localizeLegacyTitlesHelper(sections, t('section'), t('card'));
}

function sanitizeSidebarCardsInput(input: unknown): CardDraft[] {
	return sanitizeSidebarCardsInputHelper(input);
}

function sanitizeViewSectionsInput(input: unknown): ViewSectionDraft[] {
	return sanitizeViewSectionsInputHelper(input, t('section'), normalizeSectionPositions);
}


// Runtime adapters (get*/set*State) are intentionally grouped here.
// Initialization order matters for const-bound runtime exports:
// draft -> layout/editor/dnd.

// Bootstrap runtime adapter
function getBootstrapState() {
	return {
		selectedColumns,
		savedViewSections,
		savedSidebarCards,
		savedLayout,
		savedUpdatedAt,
		activeViewSectionId,
		selectedLanguage,
		activeCardLibraryTab,
		customTitles,
		oauth: {
			spotifyClientId: oauthSpotifyClientId || undefined,
			spotifyClientSecret: oauthSpotifyClientSecret || undefined,
			spotifyRedirectUri: oauthSpotifyRedirectUri || undefined,
			tuneInUserId: oauthTuneInUserId || undefined
		},
		mediaHub: {
			onkyoBridges: mediaHubOnkyoBridges.length > 0 ? mediaHubOnkyoBridges : undefined,
			playerOrder: mediaHubPlayerOrder.length > 0 ? mediaHubPlayerOrder : undefined,
			playerAliases: Object.keys(mediaHubPlayerAliases).length > 0 ? mediaHubPlayerAliases : undefined
		},
		addonHydrationRetryTimer,
		addonHydrationRetries
	};
}

function setBootstrapState(
	patch: Partial<ReturnType<typeof getBootstrapState>>
) {
	if (patch.selectedColumns !== undefined) selectedColumns = patch.selectedColumns;
	if (patch.savedViewSections !== undefined) savedViewSections = patch.savedViewSections;
	if (patch.savedSidebarCards !== undefined) savedSidebarCards = patch.savedSidebarCards;
	if (patch.savedLayout !== undefined) savedLayout = patch.savedLayout;
	if (patch.savedUpdatedAt !== undefined) savedUpdatedAt = patch.savedUpdatedAt;
	if (patch.activeViewSectionId !== undefined) activeViewSectionId = patch.activeViewSectionId;
	if (patch.selectedLanguage !== undefined) selectedLanguage = patch.selectedLanguage;
	if (patch.activeCardLibraryTab !== undefined) activeCardLibraryTab = patch.activeCardLibraryTab;
	if (patch.customTitles !== undefined) customTitles = patch.customTitles;
	if (patch.oauth !== undefined && patch.oauth) {
		oauthSpotifyClientId = patch.oauth.spotifyClientId ?? '';
		oauthSpotifyClientSecret = patch.oauth.spotifyClientSecret ?? '';
		oauthSpotifyRedirectUri = patch.oauth.spotifyRedirectUri ?? '';
		oauthTuneInUserId = patch.oauth.tuneInUserId ?? '';
	}
	if (patch.mediaHub !== undefined && patch.mediaHub) {
		mediaHubOnkyoBridges = patch.mediaHub.onkyoBridges ?? [];
		mediaHubPlayerOrder = patch.mediaHub.playerOrder ?? [];
		mediaHubPlayerAliases = patch.mediaHub.playerAliases ?? {};
	}
	if (patch.addonHydrationRetryTimer !== undefined)
		addonHydrationRetryTimer = patch.addonHydrationRetryTimer;
	if (patch.addonHydrationRetries !== undefined) addonHydrationRetries = patch.addonHydrationRetries;
}

const {
	getPanelStateApiCandidates,
	readAddonPanelState,
	hydrateFromAddonStateOnly,
	hydrateFromAddonPayload,
	applyDefaultViewIfEmpty,
	retryHydrateAddonUntilVisible
} = createPageBootstrapRuntime({
	browser,
	panelStateApiPath: PANEL_STATE_API_PATH,
	getState: getBootstrapState,
	setState: setBootstrapState,
	localizeAndSanitizeSections: (input) => localizeLegacyTitles(sanitizeViewSectionsInput(input)),
	sanitizeSidebarCards: sanitizeSidebarCardsInput,
	isRemovedLegacySidebarSeed,
	isValidLanguage: isLanguageCode,
	cloneForPersistence,
	saveDashboard,
	persistDashboardState,
	countViewCards
});
if (browser) { try { localStorage.setItem('np_diag_after_bootstrap_runtime', '1'); } catch {} }

// Editor UI runtime adapter
function getEditorUiState() {
	return {
		editMode,
		panelDraftHistory,
		activeViewSectionId,
		cardEditorOpen,
		cardEditor,
		cardEditorTitle,
		cardEditorType,
		cardEditorEntityId,
		cardEditorAnalogStyle,
		cardEditorDigitalStyle,
			cardEditorClockStyle,
			cardEditorClockShowAnalog,
			cardEditorClockShowDigital,
			cardEditorClockHour12,
			cardEditorClockSeconds,
			cardEditorDateLayout,
			cardEditorDateShortDay,
			cardEditorDateShortMonth,
			cardEditorDateAlign,
			cardEditorDateWeekdayWithDate,
			cardEditorWeatherForecastType,
			cardEditorWeatherForecastDaysToShow,
			cardEditorStatusDomains,
			cardEditorStatusDeviceClasses,
			cardEditorStatusEntityIds,
			cardEditorStatusDiscoveredEntityIds,
			cardEditorStatusEntityAliases,
			cardEditorStatusEntityIconOverrides,
			cardEditorStatusIcon,
			cardEditorNetEntityId,
			cardEditorSolarEntityId,
			cardEditorBatteryEntityId,
			cardEditorGridEntityId,
			cardEditorBatteryChargeEntityId,
			cardEditorImportTodayEntityId,
			cardEditorExportTodayEntityId,
			cardEditorSolarTodayEntityId,
			cardEditorHomeTodayEntityId,
			cardEditorCostTodayEntityId,
			cardEditorCompensationTodayEntityId,
			cardEditorSelfSufficiencyEntityId,
			cardEditorCarChargingEntityId,
			cardEditorCarCableEntityId,
			cardEditorCarChargingPowerEntityId,
			cardEditorEnergyDeviceEntityIds,
			cardEditorEnergyDeviceTodayEntityIds,
			cardEditorEnergyDeviceAliases,
			cardEditorCameras,
			cardEditorHasCustomDayNoCar,
			cardEditorHasCustomDayWithCar,
			cardEditorHasCustomNightNoCar,
			cardEditorHasCustomNightWithCar,
			cardEditorAnchorsDayNoCar,
			cardEditorAnchorsDayWithCar,
			cardEditorAnchorsNightNoCar,
			cardEditorAnchorsNightWithCar,
			cardEditorInitialNetEntityId,
			cardEditorInitialSolarEntityId,
			cardEditorInitialBatteryEntityId,
			cardEditorInitialGridEntityId,
			cardEditorInitialBatteryChargeEntityId,
			cardEditorInitialImportTodayEntityId,
			cardEditorInitialExportTodayEntityId,
			cardEditorInitialSolarTodayEntityId,
			cardEditorInitialHomeTodayEntityId,
			cardEditorInitialCostTodayEntityId,
			cardEditorInitialCompensationTodayEntityId,
			cardEditorInitialSelfSufficiencyEntityId,
			cardEditorInitialCarChargingEntityId,
			cardEditorInitialCarCableEntityId,
			cardEditorInitialCarChargingPowerEntityId,
			cardEditorInitialEnergyDeviceEntityIds,
			cardEditorInitialEnergyDeviceTodayEntityIds,
			cardEditorInitialEnergyDeviceAliases,
			cardEditorInitialCameras,
			cardEditorInitialHasCustomDayNoCar,
			cardEditorInitialHasCustomDayWithCar,
			cardEditorInitialHasCustomNightNoCar,
			cardEditorInitialHasCustomNightWithCar,
			cardEditorInitialAnchorsDayNoCar,
			cardEditorInitialAnchorsDayWithCar,
			cardEditorInitialAnchorsNightNoCar,
			cardEditorInitialAnchorsNightWithCar,
		cardEditorInitialTitle,
		cardEditorInitialType,
		cardEditorInitialEntityId,
		cardEditorInitialAnalogStyle,
		cardEditorInitialDigitalStyle,
			cardEditorInitialClockStyle,
			cardEditorInitialClockShowAnalog,
			cardEditorInitialClockShowDigital,
			cardEditorInitialClockHour12,
			cardEditorInitialClockSeconds,
			cardEditorInitialDateLayout,
			cardEditorInitialDateShortDay,
			cardEditorInitialDateShortMonth,
			cardEditorInitialDateAlign,
			cardEditorInitialDateWeekdayWithDate,
			cardEditorInitialWeatherForecastType,
			cardEditorInitialWeatherForecastDaysToShow,
			cardEditorInitialStatusDomains,
			cardEditorInitialStatusDeviceClasses,
			cardEditorInitialStatusEntityIds,
			cardEditorInitialStatusDiscoveredEntityIds,
			cardEditorInitialStatusEntityAliases,
			cardEditorInitialStatusEntityIconOverrides,
			cardEditorInitialStatusIcon,
		sectionEditorOpen,
		sectionEditorId,
		sectionEditorTitle,
		sectionEditorIcon,
		sectionEditorHeaderTemperatureEntityId,
		sectionEditorHeaderHumidityEntityId,
		sectionEditorHeaderPressureEntityId,
		sectionEditorColumn,
		sectionEditorSpan,
		sectionEditorCardColumns,
		sectionEditorInitialTitle,
		sectionEditorInitialIcon,
		sectionEditorInitialHeaderTemperatureEntityId,
		sectionEditorInitialHeaderHumidityEntityId,
		sectionEditorInitialHeaderPressureEntityId,
		sectionEditorInitialColumn,
		sectionEditorInitialSpan,
		sectionEditorInitialCardColumns,
		settingsOpen,
		cardLibraryOpen,
		selectedColumns,
		activeCardLibraryTab
	};
}

function setEditorUiState(
	patch: Partial<ReturnType<typeof getEditorUiState>>
) {
	if (patch.editMode !== undefined) editMode = patch.editMode;
	if (patch.panelDraftHistory !== undefined) panelDraftHistory = patch.panelDraftHistory;
	if (patch.activeViewSectionId !== undefined) activeViewSectionId = patch.activeViewSectionId;
	if (patch.cardEditorOpen !== undefined) cardEditorOpen = patch.cardEditorOpen;
	if (patch.cardEditor !== undefined) cardEditor = patch.cardEditor;
	if (patch.cardEditorTitle !== undefined) cardEditorTitle = patch.cardEditorTitle;
	if (patch.cardEditorType !== undefined) cardEditorType = patch.cardEditorType;
	if (patch.cardEditorEntityId !== undefined) cardEditorEntityId = patch.cardEditorEntityId;
	if (patch.cardEditorAnalogStyle !== undefined) cardEditorAnalogStyle = patch.cardEditorAnalogStyle;
	if (patch.cardEditorDigitalStyle !== undefined) cardEditorDigitalStyle = patch.cardEditorDigitalStyle;
		if (patch.cardEditorClockStyle !== undefined) cardEditorClockStyle = patch.cardEditorClockStyle;
		if (patch.cardEditorClockShowAnalog !== undefined) cardEditorClockShowAnalog = patch.cardEditorClockShowAnalog;
		if (patch.cardEditorClockShowDigital !== undefined) cardEditorClockShowDigital = patch.cardEditorClockShowDigital;
		if (patch.cardEditorClockHour12 !== undefined) cardEditorClockHour12 = patch.cardEditorClockHour12;
		if (patch.cardEditorClockSeconds !== undefined) cardEditorClockSeconds = patch.cardEditorClockSeconds;
		if (patch.cardEditorDateLayout !== undefined) cardEditorDateLayout = patch.cardEditorDateLayout;
		if (patch.cardEditorDateShortDay !== undefined) cardEditorDateShortDay = patch.cardEditorDateShortDay;
		if (patch.cardEditorDateShortMonth !== undefined) cardEditorDateShortMonth = patch.cardEditorDateShortMonth;
		if (patch.cardEditorDateAlign !== undefined) cardEditorDateAlign = patch.cardEditorDateAlign;
		if (patch.cardEditorDateWeekdayWithDate !== undefined) cardEditorDateWeekdayWithDate = patch.cardEditorDateWeekdayWithDate;
		if (patch.cardEditorWeatherForecastType !== undefined) cardEditorWeatherForecastType = patch.cardEditorWeatherForecastType;
		if (patch.cardEditorWeatherForecastDaysToShow !== undefined) cardEditorWeatherForecastDaysToShow = patch.cardEditorWeatherForecastDaysToShow;
		if (patch.cardEditorStatusDomains !== undefined) cardEditorStatusDomains = patch.cardEditorStatusDomains;
		if (patch.cardEditorStatusDeviceClasses !== undefined) cardEditorStatusDeviceClasses = patch.cardEditorStatusDeviceClasses;
		if (patch.cardEditorStatusEntityIds !== undefined) cardEditorStatusEntityIds = patch.cardEditorStatusEntityIds;
		if ('cardEditorStatusDiscoveredEntityIds' in patch)
			cardEditorStatusDiscoveredEntityIds = patch.cardEditorStatusDiscoveredEntityIds;
		if (patch.cardEditorStatusEntityAliases !== undefined) cardEditorStatusEntityAliases = patch.cardEditorStatusEntityAliases;
		if (patch.cardEditorStatusEntityIconOverrides !== undefined)
			cardEditorStatusEntityIconOverrides = patch.cardEditorStatusEntityIconOverrides;
		if (patch.cardEditorStatusIcon !== undefined) cardEditorStatusIcon = patch.cardEditorStatusIcon;
		if (patch.cardEditorNetEntityId !== undefined) cardEditorNetEntityId = patch.cardEditorNetEntityId;
		if (patch.cardEditorSolarEntityId !== undefined) cardEditorSolarEntityId = patch.cardEditorSolarEntityId;
		if (patch.cardEditorBatteryEntityId !== undefined) cardEditorBatteryEntityId = patch.cardEditorBatteryEntityId;
		if (patch.cardEditorGridEntityId !== undefined) cardEditorGridEntityId = patch.cardEditorGridEntityId;
		if (patch.cardEditorBatteryChargeEntityId !== undefined) cardEditorBatteryChargeEntityId = patch.cardEditorBatteryChargeEntityId;
		if (patch.cardEditorImportTodayEntityId !== undefined) cardEditorImportTodayEntityId = patch.cardEditorImportTodayEntityId;
		if (patch.cardEditorExportTodayEntityId !== undefined) cardEditorExportTodayEntityId = patch.cardEditorExportTodayEntityId;
		if (patch.cardEditorSolarTodayEntityId !== undefined) cardEditorSolarTodayEntityId = patch.cardEditorSolarTodayEntityId;
		if (patch.cardEditorHomeTodayEntityId !== undefined) cardEditorHomeTodayEntityId = patch.cardEditorHomeTodayEntityId;
		if (patch.cardEditorCostTodayEntityId !== undefined) cardEditorCostTodayEntityId = patch.cardEditorCostTodayEntityId;
		if (patch.cardEditorCompensationTodayEntityId !== undefined) cardEditorCompensationTodayEntityId = patch.cardEditorCompensationTodayEntityId;
		if (patch.cardEditorSelfSufficiencyEntityId !== undefined) cardEditorSelfSufficiencyEntityId = patch.cardEditorSelfSufficiencyEntityId;
		if (patch.cardEditorCarChargingEntityId !== undefined) cardEditorCarChargingEntityId = patch.cardEditorCarChargingEntityId;
		if (patch.cardEditorCarCableEntityId !== undefined) cardEditorCarCableEntityId = patch.cardEditorCarCableEntityId;
		if (patch.cardEditorCarChargingPowerEntityId !== undefined) cardEditorCarChargingPowerEntityId = patch.cardEditorCarChargingPowerEntityId;
		if (patch.cardEditorEnergyDeviceEntityIds !== undefined) cardEditorEnergyDeviceEntityIds = patch.cardEditorEnergyDeviceEntityIds;
		if (patch.cardEditorEnergyDeviceTodayEntityIds !== undefined) cardEditorEnergyDeviceTodayEntityIds = patch.cardEditorEnergyDeviceTodayEntityIds;
		if (patch.cardEditorEnergyDeviceAliases !== undefined) cardEditorEnergyDeviceAliases = patch.cardEditorEnergyDeviceAliases;
		if (patch.cardEditorCameras !== undefined) cardEditorCameras = patch.cardEditorCameras;
		if (patch.cardEditorHasCustomDayNoCar !== undefined) cardEditorHasCustomDayNoCar = patch.cardEditorHasCustomDayNoCar;
		if (patch.cardEditorHasCustomDayWithCar !== undefined) cardEditorHasCustomDayWithCar = patch.cardEditorHasCustomDayWithCar;
		if (patch.cardEditorHasCustomNightNoCar !== undefined) cardEditorHasCustomNightNoCar = patch.cardEditorHasCustomNightNoCar;
		if (patch.cardEditorHasCustomNightWithCar !== undefined) cardEditorHasCustomNightWithCar = patch.cardEditorHasCustomNightWithCar;
		if (patch.cardEditorAnchorsDayNoCar !== undefined) cardEditorAnchorsDayNoCar = patch.cardEditorAnchorsDayNoCar;
		if (patch.cardEditorAnchorsDayWithCar !== undefined) cardEditorAnchorsDayWithCar = patch.cardEditorAnchorsDayWithCar;
		if (patch.cardEditorAnchorsNightNoCar !== undefined) cardEditorAnchorsNightNoCar = patch.cardEditorAnchorsNightNoCar;
		if (patch.cardEditorAnchorsNightWithCar !== undefined) cardEditorAnchorsNightWithCar = patch.cardEditorAnchorsNightWithCar;
	if (patch.cardEditorInitialTitle !== undefined) cardEditorInitialTitle = patch.cardEditorInitialTitle;
	if (patch.cardEditorInitialType !== undefined) cardEditorInitialType = patch.cardEditorInitialType;
	if (patch.cardEditorInitialEntityId !== undefined) cardEditorInitialEntityId = patch.cardEditorInitialEntityId;
	if (patch.cardEditorInitialAnalogStyle !== undefined)
		cardEditorInitialAnalogStyle = patch.cardEditorInitialAnalogStyle;
	if (patch.cardEditorInitialDigitalStyle !== undefined)
		cardEditorInitialDigitalStyle = patch.cardEditorInitialDigitalStyle;
		if (patch.cardEditorInitialClockStyle !== undefined) cardEditorInitialClockStyle = patch.cardEditorInitialClockStyle;
		if (patch.cardEditorInitialClockShowAnalog !== undefined) cardEditorInitialClockShowAnalog = patch.cardEditorInitialClockShowAnalog;
		if (patch.cardEditorInitialClockShowDigital !== undefined) cardEditorInitialClockShowDigital = patch.cardEditorInitialClockShowDigital;
		if (patch.cardEditorInitialClockHour12 !== undefined) cardEditorInitialClockHour12 = patch.cardEditorInitialClockHour12;
		if (patch.cardEditorInitialClockSeconds !== undefined) cardEditorInitialClockSeconds = patch.cardEditorInitialClockSeconds;
		if (patch.cardEditorInitialDateLayout !== undefined) cardEditorInitialDateLayout = patch.cardEditorInitialDateLayout;
		if (patch.cardEditorInitialDateShortDay !== undefined) cardEditorInitialDateShortDay = patch.cardEditorInitialDateShortDay;
		if (patch.cardEditorInitialDateShortMonth !== undefined) cardEditorInitialDateShortMonth = patch.cardEditorInitialDateShortMonth;
		if (patch.cardEditorInitialDateAlign !== undefined) cardEditorInitialDateAlign = patch.cardEditorInitialDateAlign;
		if (patch.cardEditorInitialDateWeekdayWithDate !== undefined) cardEditorInitialDateWeekdayWithDate = patch.cardEditorInitialDateWeekdayWithDate;
		if (patch.cardEditorInitialWeatherForecastType !== undefined) cardEditorInitialWeatherForecastType = patch.cardEditorInitialWeatherForecastType;
		if (patch.cardEditorInitialWeatherForecastDaysToShow !== undefined) cardEditorInitialWeatherForecastDaysToShow = patch.cardEditorInitialWeatherForecastDaysToShow;
		if (patch.cardEditorInitialStatusDomains !== undefined) cardEditorInitialStatusDomains = patch.cardEditorInitialStatusDomains;
		if (patch.cardEditorInitialStatusDeviceClasses !== undefined) cardEditorInitialStatusDeviceClasses = patch.cardEditorInitialStatusDeviceClasses;
		if (patch.cardEditorInitialStatusEntityIds !== undefined) cardEditorInitialStatusEntityIds = patch.cardEditorInitialStatusEntityIds;
		if ('cardEditorInitialStatusDiscoveredEntityIds' in patch)
			cardEditorInitialStatusDiscoveredEntityIds = patch.cardEditorInitialStatusDiscoveredEntityIds;
		if (patch.cardEditorInitialStatusEntityAliases !== undefined)
			cardEditorInitialStatusEntityAliases = patch.cardEditorInitialStatusEntityAliases;
		if (patch.cardEditorInitialStatusEntityIconOverrides !== undefined)
			cardEditorInitialStatusEntityIconOverrides = patch.cardEditorInitialStatusEntityIconOverrides;
		if (patch.cardEditorInitialStatusIcon !== undefined) cardEditorInitialStatusIcon = patch.cardEditorInitialStatusIcon;
		if (patch.cardEditorInitialNetEntityId !== undefined) cardEditorInitialNetEntityId = patch.cardEditorInitialNetEntityId;
		if (patch.cardEditorInitialSolarEntityId !== undefined) cardEditorInitialSolarEntityId = patch.cardEditorInitialSolarEntityId;
		if (patch.cardEditorInitialBatteryEntityId !== undefined) cardEditorInitialBatteryEntityId = patch.cardEditorInitialBatteryEntityId;
		if (patch.cardEditorInitialGridEntityId !== undefined) cardEditorInitialGridEntityId = patch.cardEditorInitialGridEntityId;
		if (patch.cardEditorInitialBatteryChargeEntityId !== undefined) cardEditorInitialBatteryChargeEntityId = patch.cardEditorInitialBatteryChargeEntityId;
		if (patch.cardEditorInitialImportTodayEntityId !== undefined) cardEditorInitialImportTodayEntityId = patch.cardEditorInitialImportTodayEntityId;
		if (patch.cardEditorInitialExportTodayEntityId !== undefined) cardEditorInitialExportTodayEntityId = patch.cardEditorInitialExportTodayEntityId;
		if (patch.cardEditorInitialSolarTodayEntityId !== undefined) cardEditorInitialSolarTodayEntityId = patch.cardEditorInitialSolarTodayEntityId;
		if (patch.cardEditorInitialHomeTodayEntityId !== undefined) cardEditorInitialHomeTodayEntityId = patch.cardEditorInitialHomeTodayEntityId;
		if (patch.cardEditorInitialCostTodayEntityId !== undefined) cardEditorInitialCostTodayEntityId = patch.cardEditorInitialCostTodayEntityId;
		if (patch.cardEditorInitialCompensationTodayEntityId !== undefined) cardEditorInitialCompensationTodayEntityId = patch.cardEditorInitialCompensationTodayEntityId;
		if (patch.cardEditorInitialSelfSufficiencyEntityId !== undefined) cardEditorInitialSelfSufficiencyEntityId = patch.cardEditorInitialSelfSufficiencyEntityId;
		if (patch.cardEditorInitialCarChargingEntityId !== undefined) cardEditorInitialCarChargingEntityId = patch.cardEditorInitialCarChargingEntityId;
		if (patch.cardEditorInitialCarCableEntityId !== undefined) cardEditorInitialCarCableEntityId = patch.cardEditorInitialCarCableEntityId;
		if (patch.cardEditorInitialCarChargingPowerEntityId !== undefined) cardEditorInitialCarChargingPowerEntityId = patch.cardEditorInitialCarChargingPowerEntityId;
		if (patch.cardEditorInitialEnergyDeviceEntityIds !== undefined) cardEditorInitialEnergyDeviceEntityIds = patch.cardEditorInitialEnergyDeviceEntityIds;
		if (patch.cardEditorInitialEnergyDeviceTodayEntityIds !== undefined) cardEditorInitialEnergyDeviceTodayEntityIds = patch.cardEditorInitialEnergyDeviceTodayEntityIds;
		if (patch.cardEditorInitialEnergyDeviceAliases !== undefined) cardEditorInitialEnergyDeviceAliases = patch.cardEditorInitialEnergyDeviceAliases;
		if (patch.cardEditorInitialHasCustomDayNoCar !== undefined) cardEditorInitialHasCustomDayNoCar = patch.cardEditorInitialHasCustomDayNoCar;
		if (patch.cardEditorInitialHasCustomDayWithCar !== undefined) cardEditorInitialHasCustomDayWithCar = patch.cardEditorInitialHasCustomDayWithCar;
		if (patch.cardEditorInitialHasCustomNightNoCar !== undefined) cardEditorInitialHasCustomNightNoCar = patch.cardEditorInitialHasCustomNightNoCar;
		if (patch.cardEditorInitialHasCustomNightWithCar !== undefined) cardEditorInitialHasCustomNightWithCar = patch.cardEditorInitialHasCustomNightWithCar;
		if (patch.cardEditorInitialAnchorsDayNoCar !== undefined) cardEditorInitialAnchorsDayNoCar = patch.cardEditorInitialAnchorsDayNoCar;
		if (patch.cardEditorInitialAnchorsDayWithCar !== undefined) cardEditorInitialAnchorsDayWithCar = patch.cardEditorInitialAnchorsDayWithCar;
		if (patch.cardEditorInitialAnchorsNightNoCar !== undefined) cardEditorInitialAnchorsNightNoCar = patch.cardEditorInitialAnchorsNightNoCar;
		if (patch.cardEditorInitialAnchorsNightWithCar !== undefined) cardEditorInitialAnchorsNightWithCar = patch.cardEditorInitialAnchorsNightWithCar;
		if (patch.cardEditorInitialCameras !== undefined) cardEditorInitialCameras = patch.cardEditorInitialCameras;
	if (patch.sectionEditorOpen !== undefined) sectionEditorOpen = patch.sectionEditorOpen;
	if (patch.sectionEditorId !== undefined) sectionEditorId = patch.sectionEditorId;
	if (patch.sectionEditorTitle !== undefined) sectionEditorTitle = patch.sectionEditorTitle;
	if (patch.sectionEditorIcon !== undefined) sectionEditorIcon = patch.sectionEditorIcon;
	if (patch.sectionEditorHeaderTemperatureEntityId !== undefined)
		sectionEditorHeaderTemperatureEntityId = patch.sectionEditorHeaderTemperatureEntityId;
	if (patch.sectionEditorHeaderHumidityEntityId !== undefined)
		sectionEditorHeaderHumidityEntityId = patch.sectionEditorHeaderHumidityEntityId;
	if (patch.sectionEditorHeaderPressureEntityId !== undefined)
		sectionEditorHeaderPressureEntityId = patch.sectionEditorHeaderPressureEntityId;
	if (patch.sectionEditorColumn !== undefined) sectionEditorColumn = patch.sectionEditorColumn;
	if (patch.sectionEditorSpan !== undefined) sectionEditorSpan = patch.sectionEditorSpan;
	if (patch.sectionEditorCardColumns !== undefined) sectionEditorCardColumns = patch.sectionEditorCardColumns;
	if (patch.sectionEditorInitialTitle !== undefined) sectionEditorInitialTitle = patch.sectionEditorInitialTitle;
	if (patch.sectionEditorInitialIcon !== undefined)
		sectionEditorInitialIcon = patch.sectionEditorInitialIcon;
	if (patch.sectionEditorInitialHeaderTemperatureEntityId !== undefined)
		sectionEditorInitialHeaderTemperatureEntityId =
			patch.sectionEditorInitialHeaderTemperatureEntityId;
	if (patch.sectionEditorInitialHeaderHumidityEntityId !== undefined)
		sectionEditorInitialHeaderHumidityEntityId = patch.sectionEditorInitialHeaderHumidityEntityId;
	if (patch.sectionEditorInitialHeaderPressureEntityId !== undefined)
		sectionEditorInitialHeaderPressureEntityId = patch.sectionEditorInitialHeaderPressureEntityId;
	if (patch.sectionEditorInitialColumn !== undefined)
		sectionEditorInitialColumn = patch.sectionEditorInitialColumn;
	if (patch.sectionEditorInitialSpan !== undefined) sectionEditorInitialSpan = patch.sectionEditorInitialSpan;
	if (patch.sectionEditorInitialCardColumns !== undefined)
		sectionEditorInitialCardColumns = patch.sectionEditorInitialCardColumns;
	if (patch.settingsOpen !== undefined) settingsOpen = patch.settingsOpen;
	if (patch.cardLibraryOpen !== undefined) cardLibraryOpen = patch.cardLibraryOpen;
	if (patch.selectedColumns !== undefined) selectedColumns = patch.selectedColumns;
	if (patch.activeCardLibraryTab !== undefined) activeCardLibraryTab = patch.activeCardLibraryTab;
}

	function setSettingsTab(tab: SettingsTab) {
		activeSettingsTab = tab;
	}

// Draft runtime adapter (must be initialized before layout/editor/dnd runtimes)
function getDraftState() {
	return {
		editMode,
		selectedColumns,
		activeViewSectionId,
		panelDraftHistory
	};
}

function setDraftState(
	patch: Partial<ReturnType<typeof getDraftState>>
) {
	if (patch.editMode !== undefined) editMode = patch.editMode;
	if (patch.selectedColumns !== undefined) selectedColumns = patch.selectedColumns;
	if (patch.activeViewSectionId !== undefined) activeViewSectionId = patch.activeViewSectionId;
	if (patch.panelDraftHistory !== undefined) panelDraftHistory = patch.panelDraftHistory;
}

const {
	applyDraftChange,
	normalizeSectionPositions,
	addSection,
	applySidebarDraftChange,
	setSidebarCardType,
	removeSidebarCard
} = createPageDraftRuntime({
	getState: getDraftState,
	setState: setDraftState,
	getSectionLabel: (index) => `${t('section')} ${index}`,
	getLocalizedCardLabel
});

// Layout controls runtime adapter (depends on draft runtime functions)
function getLayoutControlsState() {
	return {
		selectedColumns,
		editMode,
		panelDraftViewSections: panelDraftHistory.present.viewSections,
		savedViewSections,
		savedLayout,
		controlsOpen,
		settingsOpen,
		cardLibraryOpen,
		cardEditorOpen,
		sectionEditorOpen,
		cardEditor
	};
}

function setLayoutControlsState(
	patch: Partial<ReturnType<typeof getLayoutControlsState>>
) {
	if (patch.selectedColumns !== undefined) selectedColumns = patch.selectedColumns;
	if (patch.editMode !== undefined) editMode = patch.editMode;
	if (patch.savedViewSections !== undefined) savedViewSections = patch.savedViewSections;
	if (patch.savedLayout !== undefined) savedLayout = patch.savedLayout;
	if (patch.controlsOpen !== undefined) controlsOpen = patch.controlsOpen;
	if (patch.settingsOpen !== undefined) settingsOpen = patch.settingsOpen;
	if (patch.cardLibraryOpen !== undefined) cardLibraryOpen = patch.cardLibraryOpen;
	if (patch.cardEditorOpen !== undefined) cardEditorOpen = patch.cardEditorOpen;
	if (patch.sectionEditorOpen !== undefined) sectionEditorOpen = patch.sectionEditorOpen;
	if (patch.cardEditor !== undefined) cardEditor = patch.cardEditor;
}

const {
	setColumns,
	toggleControls,
	openSettings,
	closeSettings,
	openCardLibrary,
	closeCardLibrary
} = createPageLayoutControlsRuntime({
	getState: getLayoutControlsState,
	setState: setLayoutControlsState,
	normalizeSectionPositions,
	applyDraftChange,
	persistDashboardState
});

// Edit session runtime adapter
function getEditSessionState() {
	return {
		panelBootstrap,
		panelDraftHistory,
		savedViewSections,
		savedSidebarCards,
		savedLayout,
		selectedColumns,
		savedCardLibraryTab,
		activeCardLibraryTab,
		savedCustomTitles,
		customTitles,
		cardLibraryOpen,
		sectionEditorOpen,
		cardEditorOpen,
		editMode
	};
}

function setEditSessionState(
	patch: Partial<ReturnType<typeof getEditSessionState>>
) {
	if (patch.panelBootstrap !== undefined) panelBootstrap = patch.panelBootstrap;
	if (patch.panelDraftHistory !== undefined) panelDraftHistory = patch.panelDraftHistory;
	if (patch.savedViewSections !== undefined) savedViewSections = patch.savedViewSections;
	if (patch.savedSidebarCards !== undefined) savedSidebarCards = patch.savedSidebarCards;
	if (patch.savedLayout !== undefined) savedLayout = patch.savedLayout;
	if (patch.selectedColumns !== undefined) selectedColumns = patch.selectedColumns;
	if (patch.savedCardLibraryTab !== undefined) savedCardLibraryTab = patch.savedCardLibraryTab;
	if (patch.activeCardLibraryTab !== undefined) activeCardLibraryTab = patch.activeCardLibraryTab;
	if (patch.savedCustomTitles !== undefined) savedCustomTitles = patch.savedCustomTitles;
	if (patch.customTitles !== undefined) customTitles = patch.customTitles;
	if (patch.cardLibraryOpen !== undefined) cardLibraryOpen = patch.cardLibraryOpen;
	if (patch.sectionEditorOpen !== undefined) sectionEditorOpen = patch.sectionEditorOpen;
	if (patch.cardEditorOpen !== undefined) cardEditorOpen = patch.cardEditorOpen;
	if (patch.editMode !== undefined) editMode = patch.editMode;
}

const {
	enterEditMode,
	saveDraftAndExit,
	cancelDraftAndExit,
	startEditMode,
	undoPanelDraftStep,
	redoPanelDraftStep
} = createPageEditSessionRuntime({
	getState: getEditSessionState,
	setState: setEditSessionState,
	sanitizeViewSections: sanitizeViewSectionsInput,
	sanitizeSidebarCards: sanitizeSidebarCardsInput,
	cloneForPersistence,
	persistDashboardState,
	countViewCards,
	debugLog
});

// Editor runtime wiring (depends on draft runtime functions)
const {
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
} = createPageEditorUiRuntime({
	getState: getEditorUiState,
	setState: setEditorUiState,
	applyDraftChange,
	applySidebarDraftChange,
	normalizeSectionPositions,
	addSection,
	getLocalizedCardLabel,
	getCardLabelFallback: (index) => `${t('card')} ${index}`
});

// === Energy custom assets / anchors ===
function getIngressBase(): string {
	if (typeof window === 'undefined') return '';
	return ((window as unknown as { __novapanel_ingress?: string }).__novapanel_ingress || '') as string;
}

function setHasCustomVariant(variant: string, has: boolean) {
	if (variant === 'day-no-car') cardEditorHasCustomDayNoCar = has;
	else if (variant === 'day-with-car') cardEditorHasCustomDayWithCar = has;
	else if (variant === 'night-no-car') cardEditorHasCustomNightNoCar = has;
	else if (variant === 'night-with-car') cardEditorHasCustomNightWithCar = has;
}

async function onEnergyUploadClick(variant: string) {
	const cardId = cardEditor?.id;
	if (!cardId) return;
	const input = document.createElement('input');
	input.type = 'file';
	input.accept = 'image/png,image/jpeg';
	input.onchange = async () => {
		const file = input.files?.[0];
		if (!file) return;
		try {
			const fd = new FormData();
			fd.append('file', file);
			const url = `${getIngressBase()}/api/energy-asset/upload?cardId=${encodeURIComponent(cardId)}&variant=${encodeURIComponent(variant)}`;
			const res = await fetch(url, { method: 'POST', body: fd });
			if (!res.ok) {
				console.error('Upload failed', res.status);
				return;
			}
			setHasCustomVariant(variant, true);
		} catch (e) {
			console.error('Upload error', e);
		}
	};
	input.click();
}

async function onEnergyResetClick(variant: string) {
	const cardId = cardEditor?.id;
	if (!cardId) return;
	try {
		const url = `${getIngressBase()}/api/energy-asset?cardId=${encodeURIComponent(cardId)}&variant=${encodeURIComponent(variant)}`;
		await fetch(url, { method: 'DELETE' });
		setHasCustomVariant(variant, false);
	} catch (e) {
		console.error('Reset error', e);
	}
}

function onEnergyAnchorsClick(variant: string) {
	cardEditorAnchorOverlayVariant = variant;
}

function getCurrentAnchorsForVariant(variant: string): import('$lib/persistence/panel-state-types').EnergyAnchors | undefined {
	if (variant === 'day-no-car') return cardEditorAnchorsDayNoCar;
	if (variant === 'day-with-car') return cardEditorAnchorsDayWithCar;
	if (variant === 'night-no-car') return cardEditorAnchorsNightNoCar;
	return cardEditorAnchorsNightWithCar;
}

function setAnchorsForVariant(variant: string, a: import('$lib/persistence/panel-state-types').EnergyAnchors) {
	if (variant === 'day-no-car') cardEditorAnchorsDayNoCar = a;
	else if (variant === 'day-with-car') cardEditorAnchorsDayWithCar = a;
	else if (variant === 'night-no-car') cardEditorAnchorsNightNoCar = a;
	else if (variant === 'night-with-car') cardEditorAnchorsNightWithCar = a;
}

function getResponsiveColumnCap(width: number, height: number): 1 | 2 | 3 {
	if (!width || !height) return 3;
	const shortSide = Math.min(width, height);
	const longSide = Math.max(width, height);
	if (shortSide < 600) return 1;
	if (longSide < 1440) return 2;
	return 3;
}

	function visibleWeekCalendarCardId(section: { cards?: CardDraft[] }): string {
		return (
			section.cards?.find(
				(card) => card.cardType === 'week_calendar' && card.hiddenInSection !== true
			)?.id ?? ''
		);
	}

	function sectionHasVisibleWeekCalendarCard(section: { cards?: CardDraft[] }, cardId: string): boolean {
		return (
			cardId.length > 0 &&
			(section.cards?.some(
				(card) =>
					card.id === cardId &&
					card.cardType === 'week_calendar' &&
					card.hiddenInSection !== true
			) ?? false)
		);
	}

	function buildResponsiveViewSections(
		sections: ViewSectionDraft[],
		columns: 1 | 2 | 3,
		expandedCalendarCardId = ''
): ResponsiveViewSection[] {
	type Candidate = ViewSectionDraft & {
		originalColumn: number;
		responsiveColumn: number;
		responsiveSpan: number;
		movedToColumnOne: boolean;
		isExpandedCalendarSection: boolean;
		sourceIndex: number;
	};

	const expandedSource = columns >= 2
		? sections.find((section) => sectionHasVisibleWeekCalendarCard(section, expandedCalendarCardId))
		: null;
	const expandedOriginalColumn = expandedSource
		? Math.max(1, Math.min(columns, expandedSource.column || 1))
		: 0;
	const expandedColumn = expandedSource
		? Math.min(expandedOriginalColumn, Math.max(1, columns - 1))
		: 0;
	const expandedSpan = expandedSource && columns >= 2
		? Math.min(2, Math.max(1, columns - expandedColumn + 1))
		: 1;
	const coveredColumns = new Set<number>();
	if (expandedSource && columns >= 2) {
		for (
			let column = expandedColumn;
			column < expandedColumn + expandedSpan && column <= columns;
			column += 1
		) {
			if (column !== expandedOriginalColumn) coveredColumns.add(column);
		}
	}

	const candidates: Candidate[] = sections.map((section, sourceIndex) => {
		const calendarCardId = visibleWeekCalendarCardId(section);
		const isCalendarSection = calendarCardId.length > 0;
		const isExpandedCalendarSection =
			columns >= 2 && sectionHasVisibleWeekCalendarCard(section, expandedCalendarCardId);
		const originalColumn = Math.max(1, Math.min(columns, section.column || 1));
		const responsiveColumn = isExpandedCalendarSection
			? Math.min(originalColumn, Math.max(1, columns - 1))
			: originalColumn;
		const movedToColumnOne =
			!isExpandedCalendarSection && coveredColumns.has(originalColumn) && originalColumn !== 1;
		const displayColumn = movedToColumnOne ? 1 : responsiveColumn;
		const maxSpan = Math.max(1, columns - displayColumn + 1);
		const configuredSpan = isCalendarSection ? 1 : section.span ?? 1;
		const responsiveSpan = movedToColumnOne
			? 1
			: isExpandedCalendarSection
				? Math.min(expandedSpan, maxSpan)
				: Math.max(1, Math.min(maxSpan, configuredSpan));

		return {
			...section,
			originalColumn,
			responsiveColumn: displayColumn,
			responsiveSpan,
			movedToColumnOne,
			isExpandedCalendarSection,
			sourceIndex
		};
	});

	const buckets = new Map<number, Candidate[]>();
	for (const section of candidates) {
		const bucket = buckets.get(section.responsiveColumn) ?? [];
		bucket.push(section);
		buckets.set(section.responsiveColumn, bucket);
	}

	const next: ResponsiveViewSection[] = [];
	for (const [displayColumn, bucket] of buckets.entries()) {
		bucket
			.sort((a, b) => {
				if (displayColumn === 1 && a.movedToColumnOne !== b.movedToColumnOne) {
					return a.movedToColumnOne ? 1 : -1;
				}
				if (a.order !== b.order) return a.order - b.order;
				if (a.originalColumn !== b.originalColumn) return a.originalColumn - b.originalColumn;
				return a.sourceIndex - b.sourceIndex;
			})
			.forEach((section, index) => {
				next.push({
					...section,
					displayColumn,
					displaySpan: section.responsiveSpan,
					displayOrder: index
				});
			});
	}
	return next.sort((a, b) =>
		a.displayColumn === b.displayColumn
			? a.displayOrder - b.displayOrder
			: a.displayColumn - b.displayColumn
	);
}

function getBgUrlForVariant(variant: string): string {
	const ib = getIngressBase();
	const has =
		variant === 'day-no-car' ? cardEditorHasCustomDayNoCar
		: variant === 'day-with-car' ? cardEditorHasCustomDayWithCar
		: variant === 'night-no-car' ? cardEditorHasCustomNightNoCar
		: cardEditorHasCustomNightWithCar;
	if (has && cardEditor?.id) {
		return `${ib}/energy-asset/${cardEditor.id}/${variant}?t=${Date.now()}`;
	}
	return `${ib}/energy/${variant}.png`;
}

const VARIANT_LABELS: Record<string, string> = {
	'day-no-car': 'Overdag, geen auto',
	'day-with-car': 'Overdag, met auto',
	'night-no-car': "'s Avonds, geen auto",
	'night-with-car': "'s Avonds, met auto"
};

// DnD runtime adapter
function getDndState() {
	return {
		editMode,
		selectedColumns,
		panelDraftHistory,
		draggingSectionId,
		draggingViewCardId,
		draggingViewCardFromSectionId,
		draggingSidebarCardId,
		recentDraggingSidebarCardId,
		sidebarDropTargetId,
		sidebarDropPlacement,
		sectionDropTargetId,
		sectionDropPlacement,
		dragIndicatorActive,
		dragIndicatorValid,
		dragIndicatorX,
		dragIndicatorY
	};
}

function setDndState(
	patch: Partial<ReturnType<typeof getDndState>>
) {
	if (patch.draggingSectionId !== undefined) draggingSectionId = patch.draggingSectionId;
	if (patch.draggingViewCardId !== undefined) draggingViewCardId = patch.draggingViewCardId;
	if (patch.draggingViewCardFromSectionId !== undefined)
		draggingViewCardFromSectionId = patch.draggingViewCardFromSectionId;
	if (patch.draggingSidebarCardId !== undefined) draggingSidebarCardId = patch.draggingSidebarCardId;
	if (patch.recentDraggingSidebarCardId !== undefined)
		recentDraggingSidebarCardId = patch.recentDraggingSidebarCardId;
	if (patch.sidebarDropTargetId !== undefined) sidebarDropTargetId = patch.sidebarDropTargetId;
	if (patch.sidebarDropPlacement !== undefined) sidebarDropPlacement = patch.sidebarDropPlacement;
	if (patch.sectionDropTargetId !== undefined) sectionDropTargetId = patch.sectionDropTargetId;
	if (patch.sectionDropPlacement !== undefined) sectionDropPlacement = patch.sectionDropPlacement;
	if (patch.dragIndicatorActive !== undefined) dragIndicatorActive = patch.dragIndicatorActive;
	if (patch.dragIndicatorValid !== undefined) dragIndicatorValid = patch.dragIndicatorValid;
	if (patch.dragIndicatorX !== undefined) dragIndicatorX = patch.dragIndicatorX;
	if (patch.dragIndicatorY !== undefined) dragIndicatorY = patch.dragIndicatorY;
}

const {
	applyDragCursorIndicatorOnly,
	startSectionDrag,
	endSectionDrag,
	dropSectionOnColumn,
	dropSectionOnSection,
	startViewCardDrag,
	endViewCardDrag,
	dropViewCard,
	startSidebarCardDrag,
	endSidebarCardDrag,
	dropSidebarCard,
	setSidebarDropPreview,
	updateDragIndicator,
	trackDragOverInvalid,
	allowValidDrop,
	handleSidebarValidDragOver
} = createPageDndRuntime({
	browser,
	debugLog,
	getState: getDndState,
	setState: setDndState,
	applyDraftChange,
	applySidebarDraftChange
});

async function persistDashboardState(): Promise<{ localOk: boolean; addonOk: boolean }> {
	const result = await persistDashboardStateRuntime({
		browser,
		selectedColumns,
		savedViewSections,
		savedSidebarCards,
		selectedLanguage,
		activeCardLibraryTab,
		customTitles,
		oauth: {
			spotifyClientId: oauthSpotifyClientId || undefined,
			spotifyClientSecret: oauthSpotifyClientSecret || undefined,
			spotifyRedirectUri: oauthSpotifyRedirectUri || undefined,
			tuneInUserId: oauthTuneInUserId || undefined
		},
		mediaHub: {
			onkyoBridges: mediaHubOnkyoBridges.length > 0 ? mediaHubOnkyoBridges : undefined,
			playerOrder: mediaHubPlayerOrder.length > 0 ? mediaHubPlayerOrder : undefined,
			playerAliases: Object.keys(mediaHubPlayerAliases).length > 0 ? mediaHubPlayerAliases : undefined
		},
		cloneForPersistence,
		saveDashboard,
		loadDashboard,
		getPanelStateApiCandidates,
		writeAddonPanelState
	});
	debugLog('persist_dashboard_state', {
		candidates: result.candidates,
		expectedViewCards: result.expectedViewCards,
		actualViewCards: result.actualViewCards,
		expectedSidebarCards: result.expectedSidebarCards,
		actualSidebarCards: result.actualSidebarCards,
		localOk: result.localOk,
		addonOk: result.addonOk
	});
	if (result.localOk) {
		// Update savedUpdatedAt so future server reads know this is the newest state
		const stored = loadDashboard({ layout: savedLayout, viewSections: [], sidebarCards: [] });
		if (typeof stored.updatedAt === 'number' && stored.updatedAt > savedUpdatedAt) {
			savedUpdatedAt = stored.updatedAt;
		}
	}
	return { localOk: result.localOk, addonOk: result.addonOk };
}

function persistConfigurationState() {
	if (!browser) return;
	const configuration = cloneForPersistence({
		language: selectedLanguage,
		cardLibraryTab: activeCardLibraryTab,
		titles: customTitles,
		oauth: {
			spotifyClientId: oauthSpotifyClientId || undefined,
			spotifyClientSecret: oauthSpotifyClientSecret || undefined,
			spotifyRedirectUri: oauthSpotifyRedirectUri || undefined,
			tuneInUserId: oauthTuneInUserId || undefined
		},
		mediaHub: {
			onkyoBridges: mediaHubOnkyoBridges.length > 0 ? mediaHubOnkyoBridges : undefined,
			playerOrder: mediaHubPlayerOrder.length > 0 ? mediaHubPlayerOrder : undefined,
			playerAliases: Object.keys(mediaHubPlayerAliases).length > 0 ? mediaHubPlayerAliases : undefined
		}
	});
	saveConfiguration(configuration);
}

function exportNovaPanelJsonBundle() {
	const data = buildPersistDraftData({
		selectedColumns,
		savedViewSections,
		savedSidebarCards,
		selectedLanguage,
		activeCardLibraryTab,
		customTitles,
		oauth: {
			spotifyClientId: oauthSpotifyClientId || undefined,
			spotifyClientSecret: oauthSpotifyClientSecret || undefined,
			spotifyRedirectUri: oauthSpotifyRedirectUri || undefined,
			tuneInUserId: oauthTuneInUserId || undefined
		},
		mediaHub: {
			onkyoBridges: mediaHubOnkyoBridges.length > 0 ? mediaHubOnkyoBridges : undefined,
			playerOrder: mediaHubPlayerOrder.length > 0 ? mediaHubPlayerOrder : undefined,
			playerAliases: Object.keys(mediaHubPlayerAliases).length > 0 ? mediaHubPlayerAliases : undefined
		},
		cloneForPersistence
	});
	const bundle: NovaPanelExportedBundle = {
		npExportVersion: 1,
		exportedAt: new Date().toISOString(),
		dashboard: data.dashboard,
		configuration: data.configuration
	};
	const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
	downloadNovaPanelJson(`novapanel-export-${stamp}.json`, bundle);
}

async function importNovaPanelJsonBundle(file: File): Promise<{ serverOk: boolean }> {
	const text = await file.text();
	const parsed = parseNovaPanelImportPayload(text);
	const configuration =
		parsed.configuration ??
		({
			language: selectedLanguage,
			cardLibraryTab: activeCardLibraryTab,
			titles: customTitles
		});
	const payload = {
		dashboard: {
			layout: parsed.dashboard.layout,
			viewSections: parsed.dashboard.viewSections,
			sidebarCards: parsed.dashboard.sidebarCards,
			updatedAt: Date.now()
		},
		configuration
	};
	await ensurePanelAuthorityReady();
	const candidates = getPanelStateApiCandidates();
	const ok = await writeAddonPanelState(candidates, payload);
	await hydrateFromAddonPayload({
		dashboard: payload.dashboard,
		configuration: payload.configuration
	});
	await tick();
	persistConfigurationState();
	return { serverOk: ok };
}

async function saveSettingsState() {
	const persisted = await persistDashboardState();
	// Always save configuration locally, regardless of server reachability
	persistConfigurationState();
	return persisted;
}

function setCustomTitle(key: 'cardLibrary' | 'homeviewPreview', value: string) {
	customTitles = { ...customTitles, [key]: value };
}

function getTitleValue(key: 'cardLibrary' | 'homeviewPreview', fallbackKey: TranslationKey) {
	return key in customTitles ? (customTitles[key] ?? '') : t(fallbackKey);
}

function isRemovedLegacySidebarSeed(cards: CardDraft[]) {
	return isRemovedLegacySidebarSeedHelper(cards);
}

function isIgnoredTransitionAbort(reason: unknown): boolean {
	if (!reason) return false;
	const name =
		typeof reason === 'object' && reason && 'name' in reason
			? String((reason as { name?: unknown }).name ?? '')
			: '';
	const message =
		typeof reason === 'object' && reason && 'message' in reason
			? String((reason as { message?: unknown }).message ?? '')
			: String(reason);
	return name === 'AbortError' && message.includes('Transition was skipped');
}

/** When fetch/SW never settles, unblock bootstrap instead of hanging on "Panel laden…". */
function promiseWithTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
	return Promise.race([
		promise,
		new Promise<T>((resolve) => {
			setTimeout(() => resolve(fallback), ms);
		})
	]);
}

function applyLocalBootstrapNow(skipDashboardFromStorage: boolean) {
	if (!browser) return;
	const next = buildLocalBootstrapState({
		selectedLanguage,
		selectedColumns,
		savedViewSections,
		savedSidebarCards,
		loadConfiguration,
		loadDashboard,
		migrateLegacyPanelState,
		localizeAndSanitizeSections: (input) => localizeLegacyTitles(sanitizeViewSectionsInput(input)),
		sanitizeSidebarCards: sanitizeSidebarCardsInput,
		isRemovedLegacySidebarSeed,
		cloneForPersistence,
	isValidLanguage: isLanguageCode,
		skipDashboardFromStorage
	});
	selectedLanguage = next.selectedLanguage;
	activeCardLibraryTab = next.activeCardLibraryTab;
	customTitles = next.customTitles;
	if (next.oauth) {
		oauthSpotifyClientId = next.oauth.spotifyClientId ?? oauthSpotifyClientId;
		oauthSpotifyClientSecret = next.oauth.spotifyClientSecret ?? oauthSpotifyClientSecret;
		oauthSpotifyRedirectUri = next.oauth.spotifyRedirectUri ?? oauthSpotifyRedirectUri;
		oauthTuneInUserId = next.oauth.tuneInUserId ?? oauthTuneInUserId;
	}
	if (next.mediaHub) {
		if (next.mediaHub.onkyoBridges) mediaHubOnkyoBridges = next.mediaHub.onkyoBridges;
		if (next.mediaHub.playerOrder) mediaHubPlayerOrder = next.mediaHub.playerOrder;
		if (next.mediaHub.playerAliases) mediaHubPlayerAliases = next.mediaHub.playerAliases;
	}
	// Eenmalige migratie: legacy player-aliases uit localStorage overhevelen naar server-state
	if (browser && Object.keys(mediaHubPlayerAliases).length === 0) {
		try {
			const legacy = localStorage.getItem('np_ma_target_aliases');
			if (legacy) {
				const parsed = JSON.parse(legacy);
				if (parsed && typeof parsed === 'object') {
					const cleaned = Object.fromEntries(
						Object.entries(parsed as Record<string, unknown>).filter(([, v]) => typeof v === 'string')
					) as Record<string, string>;
					if (Object.keys(cleaned).length > 0) {
						mediaHubPlayerAliases = cleaned;
						// Persist na hydratie zodat het ook server-side staat
						setTimeout(() => { void persistDashboardState(); }, 100);
					}
				}
			}
		} catch {}
	}
	savedCardLibraryTab = next.savedCardLibraryTab;
	savedCustomTitles = next.savedCustomTitles;
	selectedColumns = next.selectedColumns;
	savedViewSections = next.savedViewSections;
	savedSidebarCards = next.savedSidebarCards;
	savedLayout = next.savedLayout;
	try {
		localStorage.setItem('np_diag_local_bootstrap', JSON.stringify({
			ts: Date.now(),
			sc: next.savedSidebarCards.length,
			vs: next.savedViewSections.length
		}));
	} catch {}
	// Load updatedAt from the stored dashboard so the merge can compare timestamps
	if (!skipDashboardFromStorage) {
		const storedDashboard = loadDashboard({ layout: savedLayout, viewSections: [], sidebarCards: [] });
		if (typeof storedDashboard.updatedAt === 'number' && storedDashboard.updatedAt > 0) {
			savedUpdatedAt = storedDashboard.updatedAt;
		}
	}
	activeViewSectionId = next.activeViewSectionId;
	debugLog('local_bootstrap_sync_applied', {
		viewSections: savedViewSections.length,
		viewCards: countViewCards(savedViewSections),
		sidebarCards: savedSidebarCards.length
	});
}

if (browser) {
	try { localStorage.setItem('np_diag_pre_mount', String(Date.now())); } catch {}

	// Portrait mode detection for iOS Safari:
	// window.screen.width/height always return portrait dimensions on iOS regardless of rotation.
	// Use screen.orientation.type when available, fall back to window.orientation (deprecated but reliable on iOS).
	const getIsPortrait = (): boolean => {
		try {
			if (window.screen.orientation?.type) {
				return window.screen.orientation.type.startsWith('portrait');
			}
		} catch {}
		try {
			// window.orientation: 0 or 180 = portrait, ±90 = landscape
			if (typeof window.orientation === 'number') {
				return window.orientation === 0 || window.orientation === 180;
			}
		} catch {}
		// Final fallback: viewport dimensions (works when iframe reflects real orientation)
		return window.innerHeight > window.innerWidth;
	};
	const updateOrientation = () => {
		try {
			const isPortrait = getIsPortrait();
			const width = window.innerWidth || 0;
			const height = window.innerHeight || 0;
			const isPhone = width > 0 && height > 0 && Math.min(width, height) < 600;
			viewportWidth = width;
			viewportHeight = height;
			viewportIsPortrait = isPortrait;
			document.documentElement.classList.toggle('np-portrait', isPortrait);
			document.documentElement.classList.toggle('np-phone', isPhone);
		} catch {}
	};
	updateOrientation();
	try {
		window.screen.orientation?.addEventListener('change', updateOrientation);
		window.addEventListener('orientationchange', updateOrientation);
		window.addEventListener('resize', updateOrientation);
	} catch {}

	// Bootstrap Phase 1: load from localStorage synchronously — runs even when
	// SvelteKit aborts the navigation transition (which prevents onMount from firing).
	applyLocalBootstrapNow(false);
	applyDefaultViewIfEmpty();
	isHydrated = true;
	// Bootstrap Phase 2: server sync — fire-and-forget, runs at module load time
	// so it works even when onMount is never called (SvelteKit navigation abort).
	void (async () => {
		try {
			const addonState = await readAddonPanelState();
			if (addonState !== null) {
				await hydrateFromAddonStateOnly();
				applyDefaultViewIfEmpty();
			}
		} catch {
			// Non-fatal: panel already shows local state from Phase 1
		}
	})();
	debugLog('instance_checkpoint_before_mount', {
		build: PAGE_DEBUG_BUILD
	});
}

	onMount(() => {
		try { localStorage.setItem('np_diag_mount', String(Date.now())); } catch {}
		let disposed = false;
		const onUnhandledRejection = (event: PromiseRejectionEvent) => {
			if (!isIgnoredTransitionAbort(event.reason)) return;
			// Home Assistant logs this known transition abort as an app error.
			// Preventing default keeps console/system log noise down.
			event.preventDefault();
			event.stopImmediatePropagation();
		};
		window.addEventListener('unhandledrejection', onUnhandledRejection);
		const win = window as Window & {
			__npForceServerSync?: () => Promise<boolean>;
		};
		win.__npForceServerSync = async () => {
			try {
				await hydrateFromAddonStateOnly();
				return true;
			} catch {
				return false;
			}
		};
		const forceReadProbe = async () => {
			try {
				await readAddonPanelState();
			} catch {}
		};
		void forceReadProbe();
		const syncFromAddon = async () => {
			if (disposed || editMode) return;
			try {
				await hydrateFromAddonStateOnly();
			} catch {}
		};
		const onVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				void syncFromAddon();
			}
		};
		const onFocus = () => {
			void syncFromAddon();
		};
		const onPageShow = () => {
			if (disposed || editMode) return;
			void syncFromAddon();
		};
		const syncEveryMs =
			typeof navigator !== 'undefined' &&
			/iPhone|iPad|iPod|Android|Mobile/i.test(navigator.userAgent)
				? 6000
				: 12000;
		const syncInterval = window.setInterval(() => {
			void syncFromAddon();
		}, syncEveryMs);
		const forceReadInterval = window.setInterval(() => {
			void forceReadProbe();
		}, 15000);
		window.addEventListener('visibilitychange', onVisibilityChange);
		window.addEventListener('focus', onFocus);
		window.addEventListener('pageshow', onPageShow);
		debugLog('mount_enter', {
			build: PAGE_DEBUG_BUILD,
			pathname: window.location.pathname
		});
		entityStore.start();
		let panelBootstrapSafetyTimer: ReturnType<typeof window.setTimeout> | null = null;
		panelBootstrap = (async () => {
			const BOOTSTRAP_READ_MS = 16000;
			const BOOTSTRAP_HYDRATE_MS = 12000;
			const BOOTSTRAP_SAFETY_MS = 20000;
			panelBootstrapSafetyTimer = window.setTimeout(() => {
				panelBootstrapSafetyTimer = null;
				if (disposed || isHydrated) return;
				debugLog('bootstrap_safety_timeout', { ms: BOOTSTRAP_SAFETY_MS });
				try {
					applyLocalBootstrapNow(false);
				} catch {
					/* ignore */
				}
				if (!disposed) isHydrated = true;
				void hydrateFromAddonStateOnly().then(() => {
					if (!disposed) applyDefaultViewIfEmpty();
				});
				void retryHydrateAddonUntilVisible();
			}, BOOTSTRAP_SAFETY_MS);

			const clearSafety = () => {
				if (panelBootstrapSafetyTimer !== null) {
					window.clearTimeout(panelBootstrapSafetyTimer);
					panelBootstrapSafetyTimer = null;
				}
			};

			try {
				if (disposed) return;

				// Phase 1 + initial Phase 2 already ran at module level.
				// Just clear the safety timer and start periodic sync.
				clearSafety();
				void retryHydrateAddonUntilVisible();
			} catch (error) {
				void error;
				debugLog('bootstrap_error', { error: String(error) });
				if (!disposed) {
					try { applyLocalBootstrapNow(false); } catch {}
					// Don't applyDefaultViewIfEmpty here — it would persist empty state to the server.
					// retryHydrateAddonUntilVisible will call applyDefaultViewIfEmpty after server read.
					if (!disposed) isHydrated = true;
				}
				void retryHydrateAddonUntilVisible();
				clearSafety();
			}
		})();
		return () => {
			disposed = true;
			if (panelBootstrapSafetyTimer !== null) {
				window.clearTimeout(panelBootstrapSafetyTimer);
				panelBootstrapSafetyTimer = null;
			}
			if (addonHydrationRetryTimer) {
				clearTimeout(addonHydrationRetryTimer);
				addonHydrationRetryTimer = null;
			}
			window.removeEventListener('visibilitychange', onVisibilityChange);
			window.removeEventListener('focus', onFocus);
			window.removeEventListener('pageshow', onPageShow);
			window.clearInterval(syncInterval);
			window.clearInterval(forceReadInterval);
			window.removeEventListener('unhandledrejection', onUnhandledRejection);
			try {
				delete win.__npForceServerSync;
			} catch {}
			entityStore.stop();
		};
	});

if (browser) {
	debugLog('instance_checkpoint_after_mount_registration', {
		build: PAGE_DEBUG_BUILD
	});
}

	const activeViewSections = $derived(
		editMode ? panelDraftHistory.present.viewSections : savedViewSections
	);
	const activeSidebarCards = $derived(
		editMode ? panelDraftHistory.present.sidebarCards : savedSidebarCards
	);
	const hasUserConfiguredCards = $derived.by(() =>
		activeSidebarCards.length > 0 ||
		activeViewSections.some((section) =>
			(section.cards ?? []).some((card) => card.hiddenInSection !== true && card.cardType !== 'welcome')
		)
	);
	const sidebarLightEntityIds = $derived.by(() => {
		const ids: string[] = [];
		const seen = new Set<string>();
		const allEntities = get(entityStore).entities;
		for (const card of activeSidebarCards) {
			if (card.type !== 'lights_status') continue;
			const scopedIds = new Set(
				(card.statusEntityIds ?? []).map((value) => value.trim().toLowerCase()).filter(Boolean)
			);
			const sourceEntities = scopedIds.size > 0
				? allEntities.filter((entity) => scopedIds.has(entity.entityId.toLowerCase()))
				: filterEntitiesForStatusCard({
						entities: allEntities,
						kind: 'lights_status',
						domains: card.statusDomains ?? ['light'],
						deviceClasses: card.statusDeviceClasses ?? [],
						ignoredEntityIds: card.ignoredEntityIds ?? []
					}).relevant;
			for (const entity of sourceEntities) {
				const id = entity.entityId.trim();
				const key = id.toLowerCase();
				if (!id || seen.has(key)) continue;
				seen.add(key);
				ids.push(id);
			}
		}
		return ids;
	});
	const effectiveColumns = $derived(
		Math.max(
			1,
			Math.min(selectedColumns, getResponsiveColumnCap(viewportWidth, viewportHeight))
		) as 1 | 2 | 3
	);
	const canUndo = $derived(panelDraftHistory.past.length > 0);
	const canRedo = $derived(panelDraftHistory.future.length > 0);
	const cardEditorHasChanges = $derived(
		cardEditorOpen &&
			(cardEditorTitle !== cardEditorInitialTitle ||
				cardEditorType !== cardEditorInitialType ||
				cardEditorEntityId !== cardEditorInitialEntityId ||
				cardEditorAnalogStyle !== cardEditorInitialAnalogStyle ||
				cardEditorDigitalStyle !== cardEditorInitialDigitalStyle ||
				cardEditorClockStyle !== cardEditorInitialClockStyle ||
				cardEditorClockShowAnalog !== cardEditorInitialClockShowAnalog ||
				cardEditorClockShowDigital !== cardEditorInitialClockShowDigital ||
				cardEditorClockHour12 !== cardEditorInitialClockHour12 ||
				cardEditorClockSeconds !== cardEditorInitialClockSeconds ||
				cardEditorDateLayout !== cardEditorInitialDateLayout ||
				cardEditorDateShortDay !== cardEditorInitialDateShortDay ||
				cardEditorDateShortMonth !== cardEditorInitialDateShortMonth ||
				cardEditorDateAlign !== cardEditorInitialDateAlign ||
				cardEditorDateWeekdayWithDate !== cardEditorInitialDateWeekdayWithDate ||
				cardEditorWeatherForecastType !== cardEditorInitialWeatherForecastType ||
				cardEditorWeatherForecastDaysToShow !== cardEditorInitialWeatherForecastDaysToShow ||
				JSON.stringify(cardEditorStatusDomains ?? []) !== JSON.stringify(cardEditorInitialStatusDomains ?? []) ||
				JSON.stringify(cardEditorStatusDeviceClasses ?? []) !== JSON.stringify(cardEditorInitialStatusDeviceClasses ?? []) ||
				JSON.stringify(cardEditorStatusEntityIds ?? []) !== JSON.stringify(cardEditorInitialStatusEntityIds ?? []) ||
				JSON.stringify([...(cardEditorStatusDiscoveredEntityIds ?? [])].sort()) !==
					JSON.stringify([...(cardEditorInitialStatusDiscoveredEntityIds ?? [])].sort()) ||
				JSON.stringify(cardEditorStatusEntityAliases ?? {}) !== JSON.stringify(cardEditorInitialStatusEntityAliases ?? {}) ||
				JSON.stringify(cardEditorStatusEntityIconOverrides ?? {}) !== JSON.stringify(cardEditorInitialStatusEntityIconOverrides ?? {}) ||
				cardEditorStatusIcon !== cardEditorInitialStatusIcon ||
			cardEditorNetEntityId !== (cardEditorInitialNetEntityId ?? '') ||
			cardEditorSolarEntityId !== (cardEditorInitialSolarEntityId ?? '') ||
			cardEditorBatteryEntityId !== (cardEditorInitialBatteryEntityId ?? '') ||
			cardEditorGridEntityId !== (cardEditorInitialGridEntityId ?? '') ||
			cardEditorBatteryChargeEntityId !== (cardEditorInitialBatteryChargeEntityId ?? '') ||
			cardEditorImportTodayEntityId !== (cardEditorInitialImportTodayEntityId ?? '') ||
			cardEditorExportTodayEntityId !== (cardEditorInitialExportTodayEntityId ?? '') ||
			cardEditorSolarTodayEntityId !== (cardEditorInitialSolarTodayEntityId ?? '') ||
			cardEditorHomeTodayEntityId !== (cardEditorInitialHomeTodayEntityId ?? '') ||
			cardEditorCostTodayEntityId !== (cardEditorInitialCostTodayEntityId ?? '') ||
			cardEditorCompensationTodayEntityId !== (cardEditorInitialCompensationTodayEntityId ?? '') ||
			cardEditorSelfSufficiencyEntityId !== (cardEditorInitialSelfSufficiencyEntityId ?? '') ||
			cardEditorCarChargingEntityId !== (cardEditorInitialCarChargingEntityId ?? '') ||
			cardEditorCarCableEntityId !== (cardEditorInitialCarCableEntityId ?? '') ||
			cardEditorCarChargingPowerEntityId !== (cardEditorInitialCarChargingPowerEntityId ?? '') ||
			JSON.stringify(cardEditorEnergyDeviceEntityIds ?? []) !== JSON.stringify(cardEditorInitialEnergyDeviceEntityIds ?? []) ||
			JSON.stringify(cardEditorEnergyDeviceTodayEntityIds ?? []) !== JSON.stringify(cardEditorInitialEnergyDeviceTodayEntityIds ?? []) ||
			JSON.stringify(cardEditorEnergyDeviceAliases ?? {}) !== JSON.stringify(cardEditorInitialEnergyDeviceAliases ?? {}) ||
			cardEditorHasCustomDayNoCar !== (cardEditorInitialHasCustomDayNoCar ?? false) ||
			cardEditorHasCustomDayWithCar !== (cardEditorInitialHasCustomDayWithCar ?? false) ||
			cardEditorHasCustomNightNoCar !== (cardEditorInitialHasCustomNightNoCar ?? false) ||
			cardEditorHasCustomNightWithCar !== (cardEditorInitialHasCustomNightWithCar ?? false) ||
			JSON.stringify(cardEditorAnchorsDayNoCar ?? null) !== JSON.stringify(cardEditorInitialAnchorsDayNoCar ?? null) ||
			JSON.stringify(cardEditorAnchorsDayWithCar ?? null) !== JSON.stringify(cardEditorInitialAnchorsDayWithCar ?? null) ||
			JSON.stringify(cardEditorAnchorsNightNoCar ?? null) !== JSON.stringify(cardEditorInitialAnchorsNightNoCar ?? null) ||
			JSON.stringify(cardEditorAnchorsNightWithCar ?? null) !== JSON.stringify(cardEditorInitialAnchorsNightWithCar ?? null) ||
			JSON.stringify(cardEditorCameras ?? []) !== JSON.stringify(cardEditorInitialCameras ?? []))
	);
	const sectionEditorHasChanges = $derived(
		sectionEditorOpen &&
			(sectionEditorTitle !== sectionEditorInitialTitle ||
				sectionEditorIcon !== sectionEditorInitialIcon ||
				sectionEditorHeaderTemperatureEntityId !== sectionEditorInitialHeaderTemperatureEntityId ||
				sectionEditorHeaderHumidityEntityId !== sectionEditorInitialHeaderHumidityEntityId ||
				sectionEditorHeaderPressureEntityId !== sectionEditorInitialHeaderPressureEntityId ||
				sectionEditorColumn !== sectionEditorInitialColumn ||
				sectionEditorSpan !== sectionEditorInitialSpan ||
				sectionEditorCardColumns !== sectionEditorInitialCardColumns)
	);
	const sectionEditorCards = $derived(
		panelDraftHistory.present.viewSections.find((section) => section.id === sectionEditorId)?.cards ?? []
	);
	const draftHasChanges = $derived(
		editMode &&
			(!safeCompareJson(panelDraftHistory.present.viewSections, savedViewSections).equal ||
				!safeCompareJson(panelDraftHistory.present.sidebarCards, savedSidebarCards).equal ||
				selectedColumns !== savedLayout.columns ||
				activeCardLibraryTab !== savedCardLibraryTab ||
				!safeCompareJson(customTitles, savedCustomTitles).equal)
	);
	const renderedViewSections = $derived(safeBuildRenderedViewSections(activeViewSections, debugLog));
	const renderedResponsiveViewSections = $derived(
		buildResponsiveViewSections(
			renderedViewSections,
			effectiveColumns,
			editMode ? '' : expandedWeekCalendarCardId
		)
	);
	const renderedSidebarCards = $derived(safeBuildRenderedSidebarCards(activeSidebarCards, debugLog));
	const renderedSidebarItems = $derived(
		safeBuildSidebarItems(renderedSidebarCards, getLocalizedCardLabel, selectedLanguage, debugLog)
	);
	const welcomeCardVisible = $derived.by(() =>
		!hasUserConfiguredCards &&
		renderedResponsiveViewSections.some((section) =>
			(section.cards ?? []).some((card) => shouldRenderViewCard(card) && card.cardType === 'welcome')
		)
	);

	function shouldRenderViewCard(card: CardDraft) {
		return card.hiddenInSection !== true && (card.cardType !== 'welcome' || !hasUserConfiguredCards);
	}

	function shouldRenderViewSection(section: ViewSectionDraft) {
		return sectionHasHeader(section) || (section.cards ?? []).some((card) => shouldRenderViewCard(card));
	}

	function isCameraStripSection(section: { cards?: Array<{ cardType?: string }> }): boolean {
		return (
			Array.isArray(section.cards) &&
			section.cards.length > 0 &&
			section.cards.every((card) => card.cardType === 'cameras_strip')
		);
	}

	function sectionMetricEntity(entityId: string | undefined) {
		const normalized = entityId?.trim();
		if (!normalized) return null;
		return $entityStore.entities.find((entity) => entity.entityId === normalized) ?? null;
	}

	function formatSectionMetricState(entity: { state: string; unit?: string }) {
		const state = entity.state?.trim();
		if (!state || state === 'unknown') return translate('Geen data', selectedLanguage);
		if (state === 'unavailable') return translate('Niet beschikbaar', selectedLanguage);
		const unit = entity.unit?.trim() ?? '';
		if (!unit || state.endsWith(unit)) return state;
		const separator = unit === '%' || unit.startsWith('°') ? '' : ' ';
		return `${state}${separator}${unit}`;
	}

	function sectionHeaderMetrics(section: ViewSectionDraft): SectionHeaderMetric[] {
		const metrics: SectionHeaderMetric[] = [];
		for (const metric of [
			{ icon: 'temperature', label: 'Temperatuur', entity: sectionMetricEntity(section.headerTemperatureEntityId) },
			{ icon: 'droplet', label: 'Luchtvochtigheid', entity: sectionMetricEntity(section.headerHumidityEntityId) },
			{ icon: 'gauge', label: 'Luchtdruk', entity: sectionMetricEntity(section.headerPressureEntityId) }
		]) {
			if (metric.entity) metrics.push(metric as SectionHeaderMetric);
		}
		return metrics;
	}

	function sectionHasHeader(section: ViewSectionDraft) {
		return section.title.trim().length > 0 || sectionHeaderMetrics(section).length > 0;
	}

	function isExpandedWeekCalendarCard(cardId: string): boolean {
		return !editMode && effectiveColumns >= 2 && expandedWeekCalendarCardId === cardId;
	}

	function toggleWeekCalendarExpansion(cardId: string) {
		if (editMode || effectiveColumns < 2) return;
		expandedWeekCalendarCardId = expandedWeekCalendarCardId === cardId ? '' : cardId;
	}

	function handleViewCardClick(card: CardDraft) {
		if (editMode) {
			openCardEditor('view', card.id);
		}
	}

	function handleViewCardKeydown(event: KeyboardEvent, card: CardDraft) {
		if (!editMode) return;
		if (event.target !== event.currentTarget) return;
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		openCardEditor('view', card.id);
	}

	const SECTION_MASONRY_ROW_PX = 8;
	const SECTION_MASONRY_GAP_PX = 26;

	function measureSectionMasonry(node: HTMLElement, sectionId: string) {
		let id = sectionId;
		let frame = 0;
		const updateRows = () => {
			if (!browser) return;
			window.cancelAnimationFrame(frame);
			frame = window.requestAnimationFrame(() => {
				const height = node.getBoundingClientRect().height;
				const rows = Math.max(
					1,
					Math.ceil((height + SECTION_MASONRY_GAP_PX) / SECTION_MASONRY_ROW_PX)
				);
				if (sectionMasonryRows[id] !== rows) {
					sectionMasonryRows = { ...sectionMasonryRows, [id]: rows };
				}
			});
		};
		const observer =
			browser && typeof ResizeObserver !== 'undefined'
				? new ResizeObserver(updateRows)
				: null;
		observer?.observe(node);
		updateRows();
		return {
			update(nextId: string) {
				id = nextId;
				updateRows();
			},
			destroy() {
				window.cancelAnimationFrame(frame);
				observer?.disconnect();
			}
		};
	}

	function openLightButtonDetails(card: CardDraft) {
		lightButtonDetailCard = {
			title: card.title,
			entityId: card.entityId,
			icon: card.statusIcon
		};
		lightButtonDetailOpen = true;
	}

	function openCameraDetails(cam: import('$lib/persistence/panel-state-types').CameraConfig) {
		cameraDetailCamera = cam;
		cameraDetailOpen = true;
	}

	function entityButtonKindForCard(cardType: string): EntityButtonKind | null {
		if (cardType === 'device_button') return 'device';
		if (cardType === 'climate_button') return 'climate';
		if (cardType === 'cover_button') return 'cover';
		if (cardType === 'vacuum_button') return 'vacuum';
		if (cardType === 'media_player_button') return 'media_player';
		return null;
	}

	function openEntityButtonDetails(card: CardDraft) {
		const kind = entityButtonKindForCard(card.cardType);
		if (!kind) return;
		entityButtonDetailCard = {
			kind,
			title: card.title,
			entityId: card.entityId,
			icon: card.statusIcon
		};
		entityButtonDetailOpen = true;
	}

	function renameViewSectionFromLibrary(sectionId: string, title: string) {
		if (!editMode || !sectionId) return;
		const nextSections = panelDraftHistory.present.viewSections.map((section) =>
			section.id === sectionId ? { ...section, title } : section
		);
		applyDraftChange(nextSections);
	}

	function setSectionCardVisible(sectionId: string, cardId: string, visible: boolean) {
		if (!editMode || !sectionId || !cardId) return;
		const nextSections = panelDraftHistory.present.viewSections.map((section) =>
			section.id === sectionId
				? {
						...section,
						cards: section.cards.map((card) =>
							card.id === cardId
								? { ...card, hiddenInSection: visible ? undefined : true }
								: card
						)
					}
				: section
		);
		applyDraftChange(nextSections);
	}

	function openSectionCards(section: ViewSectionDraft) {
		if (editMode) {
			openSectionEditor(section.id);
			return;
		}
		sectionCardsSection = section;
		sectionCardsOpen = true;
	}

	$effect(() => {
		if (browser) {
			debugLog('instance_checkpoint_after_deriveds', {
				build: PAGE_DEBUG_BUILD,
				activeViewSections: activeViewSections.length,
				activeSidebarCards: activeSidebarCards.length
			});
		}
	});

	$effect(() => {
		if (browser) {
			setLanguage(selectedLanguage);
			document.title = `Nova Panel - ${t('home')}`;
		}
	});
	$effect(() => {
		if (browser && isHydrated && !editMode) {
			persistConfigurationState();
		}
	});
	$effect(() => {
		if (!editMode) return;
		const hasActive = panelDraftHistory.present.viewSections.some(
			(section) => section.id === activeViewSectionId
		);
		if (!hasActive) {
			const next = panelDraftHistory.present.viewSections[0]?.id ?? '';
			if (activeViewSectionId !== next) {
				activeViewSectionId = next;
			}
		}
	});
</script>

<div
	class="app-shell"
	class:drawer-open={controlsOpen}
	class:mobile-sidebar-open={mobileSidebarOpen}
	class:is-mobile={isMobile}
	style:grid-template-columns={appGridColumns}
	style:--drawer-offset={controlsOpen ? '4.75rem' : '0px'}
	ondragovercapture={trackDragOverInvalid}
	ontouchstart={onTouchStart}
	ontouchmove={onTouchMove}
	ontouchend={onTouchEnd}
>
	{#if browser && !isHydrated}
		<!-- Loading overlay removed: panel loads synchronously from localStorage -->
		<!-- isHydrated is still set for the persistConfigurationState effect -->
	{/if}
	<TopDrawer
		{t}
		{controlsOpen}
		{editMode}
		{draftHasChanges}
		{canUndo}
		{canRedo}
		onStartEdit={startEditMode}
		onSaveEdit={saveDraftAndExit}
		onCancelEdit={cancelDraftAndExit}
		onUndo={undoPanelDraftStep}
		onRedo={redoPanelDraftStep}
		onOpenCardLibrary={openCardLibrary}
		onOpenSettings={openSettings}
		onOpenHASidebar={openHASidebar}
		onToggleControls={toggleControls}
		showDrawerHint={welcomeCardVisible}
	/>

	<SidebarShell
		state={{ enabled: sidebarVisible || (isMobile && mobileSidebarOpen), width: sidebarWidth, items: renderedSidebarItems }}
		editable={editMode}
		onSelectItem={(item) => {
			onSidebarItemSelect(item);
			if (isMobile) mobileSidebarOpen = false;
		}}
		onDragStartItem={startSidebarCardDrag}
		onDragEndItem={endSidebarCardDrag}
		onDragOverValid={handleSidebarValidDragOver}
		onDragOverItem={setSidebarDropPreview}
		onDropOnItem={(id, placement) => dropSidebarCard(id, placement)}
		onDropAtEnd={() => dropSidebarCard(null)}
		activeDropTargetId={sidebarDropTargetId}
		activeDropPlacement={sidebarDropPlacement}
	/>

	{#if isMobile && mobileSidebarOpen}
		<button
			type="button"
			class="mobile-sidebar-scrim"
			aria-label="Sluit zijbalk"
			onclick={() => (mobileSidebarOpen = false)}
		></button>
	{/if}

	<div class="main-zone" style:grid-column={sidebarVisible ? '2' : '1'}>
		<main class="home-content">
				<section class="main-cards-grid">
					<div class="sections-grid" style:grid-template-columns={`repeat(${effectiveColumns}, minmax(0, 1fr))`}>
						{#if editMode}
							<div class="sections-drop-layer" style:grid-template-columns={`repeat(${effectiveColumns}, minmax(0, 1fr))`}>
								{#each Array.from({ length: effectiveColumns }, (_, index) => index + 1) as column (column)}
									<div
										class="sections-column-drop"
										role="presentation"
										ondragover={(event) => {
											if (!draggingSectionId) return;
											allowValidDrop(event);
										}}
										ondrop={(event) => {
											event.preventDefault();
											event.stopPropagation();
											dropSectionOnColumn(column);
										}}
									></div>
								{/each}
							</div>
						{/if}
						{#each renderedResponsiveViewSections.filter((section) => shouldRenderViewSection(section)) as section (section.id)}
							<section
								class="view-section"
								class:editable={editMode}
								class:camera-strip-section={isCameraStripSection(section)}
								class:week-calendar-expanded-section={sectionHasVisibleWeekCalendarCard(section, expandedWeekCalendarCardId) && isExpandedWeekCalendarCard(expandedWeekCalendarCardId)}
								class:drop-before={draggingSectionId === section.id ? false : sectionDropTargetId === section.id && sectionDropPlacement === 'before'}
								class:drop-after={draggingSectionId === section.id ? false : sectionDropTargetId === section.id && sectionDropPlacement === 'after'}
								role="group"
								draggable={editMode}
								use:measureSectionMasonry={section.id}
								style:grid-column={`${section.displayColumn} / span ${section.displaySpan}`}
								style:grid-row={`span ${sectionMasonryRows[section.id] ?? 1}`}
								ondragstart={(event) => {
										applyDragCursorIndicatorOnly(event);
										startSectionDrag(section.id);
									}}
								ondragend={endSectionDrag}
								ondragover={(event) => {
									if ((!draggingSectionId && !draggingViewCardId) || !editMode) return;
									if (draggingSectionId && draggingSectionId === section.id) return;
									if (draggingSectionId) {
										const target = event.currentTarget as HTMLElement | null;
										const rect = target?.getBoundingClientRect();
										sectionDropTargetId = section.id;
										sectionDropPlacement =
											rect && event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
									}
									allowValidDrop(event);
								}}
								ondrop={(event) => {
									event.preventDefault();
									event.stopPropagation();
									if (draggingSectionId) {
										const target = event.currentTarget as HTMLElement | null;
										const rect = target?.getBoundingClientRect();
										const placement =
											rect && event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
										dropSectionOnSection(section.id, placement);
									}
								}}
							>
								{#if sectionHasHeader(section)}
									{@const metrics = sectionHeaderMetrics(section)}
									<div
										class="view-section-head"
										class:editable={editMode}
										role="button"
										tabindex="0"
										onclick={() => openSectionCards(section)}
										onkeydown={(event) => {
											if (event.key !== 'Enter' && event.key !== ' ') return;
											event.preventDefault();
											openSectionCards(section);
										}}
									>
										{#if section.title && section.title.trim().length > 0}
											<h3>{section.title.trim()}</h3>
										{/if}
										{#if metrics.length > 0}
											<div class="view-section-metrics" aria-label={translate('Sectie waarden', selectedLanguage)}>
												{#each metrics as metric (metric.label)}
													<span class="view-section-metric" title={`${metric.label}: ${formatSectionMetricState(metric.entity)}`}>
														<TablerIcon name={metric.icon} size={14} />
														<span>{formatSectionMetricState(metric.entity)}</span>
													</span>
												{/each}
											</div>
										{/if}
									</div>
								{/if}
								<div
									class={`cards-grid ${section.cardColumns === 2 ? 'two' : 'one'}`}
									role="list"
									ondragover={(event) => {
										if (!editMode || !draggingViewCardId) return;
										allowValidDrop(event);
									}}
									ondrop={() => {
										dropViewCard(section.id, null);
										viewCardDropTargetId = '';
									}}
								>
									{#each section.cards.filter((card) => shouldRenderViewCard(card)) as card (card.id)}
										{@const entityButtonKind = entityButtonKindForCard(card.cardType)}
										<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
										<div
											class="card-item"
											class:editable={editMode}
											class:has-title={!!(card.title && card.title.trim().length > 0 && card.cardType !== 'light_button' && card.cardType !== 'week_calendar' && !entityButtonKind)}
											class:camera-strip-card-item={card.cardType === 'cameras_strip'}
											class:week-calendar-card-item={card.cardType === 'week_calendar'}
											class:week-calendar-expanded={card.cardType === 'week_calendar' && isExpandedWeekCalendarCard(card.id)}
											class:light-button-card-item={card.cardType === 'light_button' || !!entityButtonKind}
											class:drop-before={draggingViewCardId !== card.id && viewCardDropTargetId === card.id && viewCardDropPlacement === 'before'}
											class:drop-after={draggingViewCardId !== card.id && viewCardDropTargetId === card.id && viewCardDropPlacement === 'after'}
											role={card.cardType === 'week_calendar' && !editMode ? undefined : 'button'}
											tabindex={card.cardType === 'week_calendar' && !editMode ? undefined : '0'}
											draggable={editMode}
											onclick={() => handleViewCardClick(card)}
											onkeydown={(event) => handleViewCardKeydown(event, card)}
											ondragstart={(event) => {
												event.stopPropagation();
												applyDragCursorIndicatorOnly(event);
												startViewCardDrag(section.id, card.id);
											}}
											ondragend={() => {
												endViewCardDrag();
												viewCardDropTargetId = '';
											}}
											ondragover={(event) => {
												if (!editMode || !draggingViewCardId) return;
												allowValidDrop(event);
												const target = event.currentTarget as HTMLElement;
												const rect = target.getBoundingClientRect();
												const midY = rect.top + rect.height / 2;
												viewCardDropTargetId = card.id;
												viewCardDropPlacement = event.clientY < midY ? 'before' : 'after';
											}}
											ondragleave={() => {
												if (viewCardDropTargetId === card.id) viewCardDropTargetId = '';
											}}
											ondrop={() => {
												dropViewCard(section.id, card.id, viewCardDropPlacement);
												viewCardDropTargetId = '';
											}}
										>
											{#if card.title && card.title.trim().length > 0 && card.cardType !== 'light_button' && card.cardType !== 'week_calendar' && !entityButtonKind}
												<h3 class="card-title">{card.title}</h3>
											{/if}
											{#if card.cardType === 'clock'}
												<ClockCard
													analogStyle={card.analogClockStyle ?? 1}
													digitalStyle={card.digitalClockStyle ?? 1}
													clockStyle={card.clockStyle}
													showAnalog={card.clockShowAnalog ?? true}
													showDigital={card.clockShowDigital ?? true}
													hour12={card.clockHour12}
													seconds={card.clockSeconds ?? false}
												/>
											{:else if card.cardType === 'welcome'}
												<WelcomeCard />
											{:else if card.cardType === 'cameras_strip'}
												<LazyComponent
													loader={loadCamerasStripCard}
													props={{
														cameras: card.cameras,
														title: card.title,
														onCameraClick: openCameraDetails
													}}
												/>
											{:else if card.cardType === 'week_calendar'}
												<LazyComponent
													loader={loadWeekCalendarCard}
													props={{
														title: card.title,
														sources: card.cameras,
														expanded: isExpandedWeekCalendarCard(card.id),
														canToggleExpansion: !editMode && effectiveColumns >= 2,
														onToggleExpansion: () => toggleWeekCalendarExpansion(card.id)
													}}
												/>
											{:else if card.cardType === 'light_button'}
												<LightButtonCard
													title={card.title}
													entityId={card.entityId}
													icon={card.statusIcon}
													{editMode}
													onOpen={() => openLightButtonDetails(card)}
												/>
											{:else if entityButtonKind}
												<EntityButtonCard
													kind={entityButtonKind}
													title={card.title}
													entityId={card.entityId}
													icon={card.statusIcon}
													{editMode}
													onOpen={() => openEntityButtonDetails(card)}
												/>
											{/if}
										</div>
									{/each}
								</div>
							</section>
						{/each}
					</div>
				</section>
		</main>

		{#if settingsOpen}
			{#await loadSettingsModal() then module}
				{@const SettingsModal = module.default}
				<SettingsModal
					{t}
					{activeSettingsTab}
					{selectedColumns}
					{selectedLanguage}
					spotifyClientId={oauthSpotifyClientId}
					spotifyClientSecret={oauthSpotifyClientSecret}
					spotifyRedirectUri={oauthSpotifyRedirectUri}
					onClose={closeSettings}
					onSetSettingsTab={setSettingsTab}
					onSetColumns={setColumns}
					onSetLanguage={(value) => (selectedLanguage = value)}
					onSetSpotifyClientId={(v) => (oauthSpotifyClientId = v)}
					onSetSpotifyClientSecret={(v) => (oauthSpotifyClientSecret = v)}
					onSetSpotifyRedirectUri={(v) => (oauthSpotifyRedirectUri = v)}
					onExportPanelState={exportNovaPanelJsonBundle}
					onImportPanelState={importNovaPanelJsonBundle}
					onSave={saveSettingsState}
				/>
			{/await}
		{/if}

		{#if cardLibraryOpen}
			{#await loadCardLibraryModal() then module}
				{@const CardLibraryModal = module.default}
				<CardLibraryModal
					{t}
					title={getTitleValue('cardLibrary', 'cardLibrary')}
					{editMode}
					activeTab={activeCardLibraryTab}
					activeViewSectionId={activeViewSectionId}
					sections={renderedViewSections.map((section) => ({ id: section.id, title: section.title }))}
					cards={cardCatalog}
					{getLocalizedCardLabel}
					onClose={closeCardLibrary}
					onTitleBlur={(value) => setCustomTitle('cardLibrary', value)}
					onSetTab={setCardLibraryTab}
					onAddSection={addSection}
					onSetActiveSection={(id) => (activeViewSectionId = id)}
					onRenameSection={renameViewSectionFromLibrary}
					onAddCard={addCardFromCatalog}
				/>
			{/await}
		{/if}

		{#if cardEditorOpen}
			{#await loadCardEditorModal() then module}
				{@const CardEditorModal = module.default}
				<CardEditorModal
				cardEditorId={cardEditor?.id}
				{t}
				{cardCatalog}
				{getLocalizedCardLabel}
				{cardEditorType}
				{cardEditorTitle}
				cardEditorEntityId={cardEditorEntityId}
				{cardEditorAnalogStyle}
				{cardEditorDigitalStyle}
				{cardEditorClockStyle}
				{cardEditorClockShowAnalog}
				{cardEditorClockShowDigital}
				{cardEditorClockHour12}
				{cardEditorClockSeconds}
				{cardEditorDateLayout}
				{cardEditorDateShortDay}
				{cardEditorDateShortMonth}
				{cardEditorDateAlign}
				{cardEditorDateWeekdayWithDate}
				{cardEditorWeatherForecastType}
				{cardEditorWeatherForecastDaysToShow}
				{cardEditorStatusDomains}
				{cardEditorStatusDeviceClasses}
				{cardEditorStatusEntityIds}
				{cardEditorStatusEntityAliases}
				{cardEditorStatusEntityIconOverrides}
				mediaHubPlayerAliases={mediaHubPlayerAliases}
				lightButtonEntityIds={sidebarLightEntityIds}
				cardEditorStatusDiscoveredEntityIds={cardEditorStatusDiscoveredEntityIds}
				{cardEditorStatusIcon}
				{cardEditorHasChanges}
				onClose={closeCardEditor}
				onDelete={deleteCardFromEditor}
				onSave={saveCardEditor}
				onTitleChange={(value) => (cardEditorTitle = value)}
				onEntityIdChange={(value) => (cardEditorEntityId = value)}
				onAnalogStyleChange={(value) => (cardEditorAnalogStyle = value)}
				onDigitalStyleChange={(value) => (cardEditorDigitalStyle = value)}
				onClockStyleChange={(value) => (cardEditorClockStyle = value)}
				onClockShowAnalogChange={(value) => (cardEditorClockShowAnalog = value)}
				onClockShowDigitalChange={(value) => (cardEditorClockShowDigital = value)}
				onClockHour12Change={(value) => (cardEditorClockHour12 = value)}
				onClockSecondsChange={(value) => (cardEditorClockSeconds = value)}
				onDateLayoutChange={(value) => (cardEditorDateLayout = value)}
				onDateShortDayChange={(value) => (cardEditorDateShortDay = value)}
				onDateShortMonthChange={(value) => (cardEditorDateShortMonth = value)}
				onDateAlignChange={(value) => (cardEditorDateAlign = value)}
				onDateWeekdayWithDateChange={(value) => (cardEditorDateWeekdayWithDate = value)}
				onWeatherForecastTypeChange={(value) => (cardEditorWeatherForecastType = value)}
				onWeatherForecastDaysToShowChange={(value) => (cardEditorWeatherForecastDaysToShow = value)}
				onStatusDomainsChange={(value) => (cardEditorStatusDomains = value)}
				onStatusDeviceClassesChange={(value) => (cardEditorStatusDeviceClasses = value)}
				onStatusEntityIdsChange={(value) => (cardEditorStatusEntityIds = value)}
				onStatusEntityAliasesChange={(value) => (cardEditorStatusEntityAliases = value)}
				onStatusEntityIconOverridesChange={(value) => (cardEditorStatusEntityIconOverrides = value)}
				onMediaHubPlayerAliasesChange={(value) => {
					mediaHubPlayerAliases = value;
					void persistDashboardState();
				}}
				onStatusDiscoveredEntityIdsChange={(value) =>
					(cardEditorStatusDiscoveredEntityIds = [...value])}
				onStatusIconChange={(value) => (cardEditorStatusIcon = value)}
				cardEditorNetEntityId={cardEditorNetEntityId}
				cardEditorSolarEntityId={cardEditorSolarEntityId}
				cardEditorBatteryEntityId={cardEditorBatteryEntityId}
				cardEditorGridEntityId={cardEditorGridEntityId}
				cardEditorBatteryChargeEntityId={cardEditorBatteryChargeEntityId}
				cardEditorImportTodayEntityId={cardEditorImportTodayEntityId}
				cardEditorExportTodayEntityId={cardEditorExportTodayEntityId}
				cardEditorSolarTodayEntityId={cardEditorSolarTodayEntityId}
				cardEditorHomeTodayEntityId={cardEditorHomeTodayEntityId}
				cardEditorCostTodayEntityId={cardEditorCostTodayEntityId}
				cardEditorCompensationTodayEntityId={cardEditorCompensationTodayEntityId}
				cardEditorSelfSufficiencyEntityId={cardEditorSelfSufficiencyEntityId}
				cardEditorCarChargingEntityId={cardEditorCarChargingEntityId}
				cardEditorCarCableEntityId={cardEditorCarCableEntityId}
				cardEditorCarChargingPowerEntityId={cardEditorCarChargingPowerEntityId}
				cardEditorEnergyDeviceEntityIds={cardEditorEnergyDeviceEntityIds}
				cardEditorEnergyDeviceTodayEntityIds={cardEditorEnergyDeviceTodayEntityIds}
				cardEditorEnergyDeviceAliases={cardEditorEnergyDeviceAliases}
				cardEditorHasCustomDayNoCar={cardEditorHasCustomDayNoCar}
				cardEditorHasCustomDayWithCar={cardEditorHasCustomDayWithCar}
				cardEditorHasCustomNightNoCar={cardEditorHasCustomNightNoCar}
				cardEditorHasCustomNightWithCar={cardEditorHasCustomNightWithCar}
				cardEditorAnchorsDayNoCar={cardEditorAnchorsDayNoCar}
				cardEditorAnchorsDayWithCar={cardEditorAnchorsDayWithCar}
				cardEditorAnchorsNightNoCar={cardEditorAnchorsNightNoCar}
				cardEditorAnchorsNightWithCar={cardEditorAnchorsNightWithCar}
				onNetEntityIdChange={(value) => (cardEditorNetEntityId = value)}
				onSolarEntityIdChange={(value) => (cardEditorSolarEntityId = value)}
				onBatteryEntityIdChange={(value) => (cardEditorBatteryEntityId = value)}
				onGridEntityIdChange={(value) => (cardEditorGridEntityId = value)}
				onBatteryChargeEntityIdChange={(value) => (cardEditorBatteryChargeEntityId = value)}
				onImportTodayEntityIdChange={(value) => (cardEditorImportTodayEntityId = value)}
				onExportTodayEntityIdChange={(value) => (cardEditorExportTodayEntityId = value)}
				onSolarTodayEntityIdChange={(value) => (cardEditorSolarTodayEntityId = value)}
				onHomeTodayEntityIdChange={(value) => (cardEditorHomeTodayEntityId = value)}
				onCostTodayEntityIdChange={(value) => (cardEditorCostTodayEntityId = value)}
				onCompensationTodayEntityIdChange={(value) => (cardEditorCompensationTodayEntityId = value)}
				onSelfSufficiencyEntityIdChange={(value) => (cardEditorSelfSufficiencyEntityId = value)}
				onCarChargingEntityIdChange={(value) => (cardEditorCarChargingEntityId = value)}
				onCarCableEntityIdChange={(value) => (cardEditorCarCableEntityId = value)}
				onCarChargingPowerEntityIdChange={(value) => (cardEditorCarChargingPowerEntityId = value)}
				onEnergyDeviceEntityIdsChange={(value) => (cardEditorEnergyDeviceEntityIds = [...value])}
				onEnergyDeviceTodayEntityIdsChange={(value) => (cardEditorEnergyDeviceTodayEntityIds = [...value])}
				onEnergyDeviceAliasesChange={(value) => (cardEditorEnergyDeviceAliases = value)}
				cardEditorCameras={cardEditorCameras}
				onCamerasChange={(value) => (cardEditorCameras = [...value])}
				onEnergyUploadClick={onEnergyUploadClick}
				onEnergyResetClick={onEnergyResetClick}
				onEnergyAnchorsClick={onEnergyAnchorsClick}
				onOpenGroupPicker={(group, cardId, allGroups) => {
					lgPickerEditingId = group.id;
					lgPickerDraftName = group.name;
					lgPickerDraftEntityIds = [...group.entityIds];
					lgPickerCardId = cardId;
					lgPickerGroups = allGroups;
					lgPickerOpen = true;
				}}
				lgGroupsVersion={lgGroupsVersion}
				/>
			{/await}
		{/if}

		{#if cardEditorAnchorOverlayVariant !== null}
			{#await loadEnergyAnchorEditor() then module}
				{@const EnergyAnchorEditor = module.default}
				<EnergyAnchorEditor
					bgUrl={getBgUrlForVariant(cardEditorAnchorOverlayVariant)}
					variantLabel={VARIANT_LABELS[cardEditorAnchorOverlayVariant] ?? cardEditorAnchorOverlayVariant}
					initialAnchors={getCurrentAnchorsForVariant(cardEditorAnchorOverlayVariant)}
					onCancel={() => (cardEditorAnchorOverlayVariant = null)}
					onSave={(a) => {
						if (cardEditorAnchorOverlayVariant) setAnchorsForVariant(cardEditorAnchorOverlayVariant, a);
						cardEditorAnchorOverlayVariant = null;
					}}
				/>
			{/await}
		{/if}

		{#if lgPickerOpen}
			{#await loadLightGroupPickerOverlay() then module}
				{@const LightGroupPickerOverlay = module.default}
				<LightGroupPickerOverlay
					open={lgPickerOpen}
					editingId={lgPickerEditingId}
					draftName={lgPickerDraftName}
					draftEntityIds={lgPickerDraftEntityIds}
					statusEntityIds={cardEditorStatusEntityIds ?? []}
					groups={lgPickerGroups}
					getFriendlyName={lgPickerGetFriendlyName}
					onDraftNameChange={(name) => (lgPickerDraftName = name)}
					onToggleEntity={lgPickerToggle}
					onSave={lgPickerSave}
					onDelete={lgPickerDelete}
				/>
			{/await}
		{/if}

		{#if weatherDetailOpen}
			{#await loadWeatherDetailsModal() then module}
				{@const WeatherDetailsModal = module.default}
				<WeatherDetailsModal
					{t}
					entityId={weatherDetailEntityId}
					locale={selectedLanguage}
					onClose={() => (weatherDetailOpen = false)}
				/>
			{/await}
		{/if}

		{#if weatherForecastDetailOpen}
			{#await loadWeatherForecastDetailsModal() then module}
				{@const WeatherForecastDetailsModal = module.default}
				<WeatherForecastDetailsModal
					{t}
					entityId={weatherForecastEntityId}
					locale={selectedLanguage}
					forecastType={weatherForecastType}
					daysToShow={weatherForecastDaysToShow}
					onClose={() => (weatherForecastDetailOpen = false)}
				/>
			{/await}
		{/if}
		{#if alarmDetailOpen}
			{#await loadAlarmPanelDetailsModal() then module}
				{@const AlarmPanelDetailsModal = module.default}
				<AlarmPanelDetailsModal
					{t}
					entityId={alarmDetailEntityId}
					onClose={() => (alarmDetailOpen = false)}
				/>
			{/await}
		{/if}
		{#if energyDetailOpen}
			{#await loadEnergyDetailsModal() then module}
				{@const EnergyDetailsModal = module.default}
				<EnergyDetailsModal
					netEntityId={energyDetailCard.netEntityId}
					solarEntityId={energyDetailCard.solarEntityId}
					batteryEntityId={energyDetailCard.batteryEntityId}
					gridEntityId={energyDetailCard.gridEntityId}
					batteryChargeEntityId={energyDetailCard.batteryChargeEntityId}
					importTodayEntityId={energyDetailCard.importTodayEntityId}
					exportTodayEntityId={energyDetailCard.exportTodayEntityId}
					solarTodayEntityId={energyDetailCard.solarTodayEntityId}
					homeTodayEntityId={energyDetailCard.homeTodayEntityId}
					costTodayEntityId={energyDetailCard.costTodayEntityId}
					compensationTodayEntityId={energyDetailCard.compensationTodayEntityId}
					selfSufficiencyEntityId={energyDetailCard.selfSufficiencyEntityId}
					carChargingEntityId={energyDetailCard.carChargingEntityId}
					carCableEntityId={energyDetailCard.carCableEntityId}
					carChargingPowerEntityId={energyDetailCard.carChargingPowerEntityId}
					energyDeviceEntityIds={energyDetailCard.energyDeviceEntityIds}
					energyDeviceTodayEntityIds={energyDetailCard.energyDeviceTodayEntityIds}
					energyDeviceAliases={energyDetailCard.energyDeviceAliases}
					energyDeviceSnapshot={energyDetailCard.energyDeviceSnapshot}
					onSnapshotChange={(snapshot) => updateEnergyDeviceSnapshot(energyDetailCard.id, snapshot)}
					cardId={energyDetailCard.id}
					hasCustomDayNoCar={energyDetailCard.hasCustomDayNoCar}
					hasCustomDayWithCar={energyDetailCard.hasCustomDayWithCar}
					hasCustomNightNoCar={energyDetailCard.hasCustomNightNoCar}
					hasCustomNightWithCar={energyDetailCard.hasCustomNightWithCar}
					anchorsDayNoCar={energyDetailCard.anchorsDayNoCar}
					anchorsDayWithCar={energyDetailCard.anchorsDayWithCar}
					anchorsNightNoCar={energyDetailCard.anchorsNightNoCar}
					anchorsNightWithCar={energyDetailCard.anchorsNightWithCar}
					onClose={() => (energyDetailOpen = false)}
				/>
			{/await}
		{/if}
		{#if cameraDetailOpen && cameraDetailCamera}
			{#await loadCameraDetailsModal() then module}
				{@const CameraDetailsModal = module.default}
				<CameraDetailsModal
					camera={cameraDetailCamera}
					onClose={() => {
						cameraDetailOpen = false;
						cameraDetailCamera = null;
					}}
				/>
			{/await}
		{/if}
		{#if lightButtonDetailOpen}
			{#await loadLightButtonDetailsModal() then module}
				{@const LightButtonDetailsModal = module.default}
				<LightButtonDetailsModal
					title={lightButtonDetailCard.title}
					entityId={lightButtonDetailCard.entityId}
					icon={lightButtonDetailCard.icon}
					onClose={() => {
						lightButtonDetailOpen = false;
						lightButtonDetailCard = {};
					}}
				/>
			{/await}
		{/if}
		{#if entityButtonDetailOpen && entityButtonDetailCard.kind}
			{#await loadEntityButtonDetailsModal() then module}
				{@const EntityButtonDetailsModal = module.default}
				<EntityButtonDetailsModal
					kind={entityButtonDetailCard.kind}
					title={entityButtonDetailCard.title}
					entityId={entityButtonDetailCard.entityId}
					icon={entityButtonDetailCard.icon}
					onClose={() => {
						entityButtonDetailOpen = false;
						entityButtonDetailCard = {};
					}}
				/>
			{/await}
		{/if}
		{#if statusDetailOpen}
			{#await loadStatusDetailsModal() then module}
				{@const StatusDetailsModal = module.default}
				<StatusDetailsModal
					{t}
					{editMode}
					title={statusDetailTitle}
					kind={statusDetailKind}
					cardId={statusDetailCardId}
					domains={statusDetailDomains}
					deviceClasses={statusDetailDeviceClasses}
					statusEntityIds={statusDetailEntityIds}
					statusEntityAliases={statusDetailEntityAliases}
					statusEntityIconOverrides={statusDetailEntityIconOverrides}
					ignoredEntityIds={statusDetailIgnoredEntityIds}
					spotifyConfigured={Boolean(oauthSpotifyClientId && oauthSpotifyClientSecret)}
					mediaHubOnkyoBridges={mediaHubOnkyoBridges}
					mediaHubPlayerOrder={mediaHubPlayerOrder}
					mediaHubPlayerAliases={mediaHubPlayerAliases}
					onMediaHubBridgesChange={(value) => {
						mediaHubOnkyoBridges = value;
						void persistDashboardState();
					}}
					onMediaHubPlayerOrderChange={(value) => {
						mediaHubPlayerOrder = value;
						void persistDashboardState();
					}}
					onClose={() => (statusDetailOpen = false)}
					onIgnore={(entityId) => void updateIgnoredEntities(statusDetailCardId, entityId, true)}
					onUnignore={(entityId) => void updateIgnoredEntities(statusDetailCardId, entityId, false)}
					onEntityIconChange={(entityId, icon) =>
						void updateStatusDetailEntityIcon(statusDetailCardId, entityId, icon)
					}
				/>
			{/await}
		{/if}

		{#if sectionEditorOpen}
			{#await loadSectionEditorModal() then module}
				{@const SectionEditorModal = module.default}
				<SectionEditorModal
					{t}
					{selectedColumns}
					{sectionEditorTitle}
					{sectionEditorIcon}
					{sectionEditorHeaderTemperatureEntityId}
					{sectionEditorHeaderHumidityEntityId}
					{sectionEditorHeaderPressureEntityId}
					{sectionEditorColumn}
					{sectionEditorSpan}
					{sectionEditorCardColumns}
					sectionCards={sectionEditorCards}
					{getLocalizedCardLabel}
					{sectionEditorHasChanges}
					onClose={closeSectionEditor}
					onDelete={deleteSectionFromEditor}
					onSave={saveSectionEditor}
					onMoveOrder={moveSectionOrder}
					onSetTitle={(value) => (sectionEditorTitle = value)}
					onSetIcon={(value) => (sectionEditorIcon = value)}
					onSetHeaderTemperatureEntityId={(value) =>
						(sectionEditorHeaderTemperatureEntityId = value)
					}
					onSetHeaderHumidityEntityId={(value) => (sectionEditorHeaderHumidityEntityId = value)}
					onSetHeaderPressureEntityId={(value) => (sectionEditorHeaderPressureEntityId = value)}
					onSetColumn={(value) => (sectionEditorColumn = value)}
					onSetSpan={(value) => (sectionEditorSpan = value)}
					onSetCardColumns={(value) => (sectionEditorCardColumns = value)}
					onSetCardVisible={(cardId, visible) =>
						setSectionCardVisible(sectionEditorId, cardId, visible)
					}
				/>
			{/await}
		{/if}
		{#if sectionCardsOpen && sectionCardsSection}
			{#await loadSectionCardsModal() then module}
				{@const SectionCardsModal = module.default}
				<SectionCardsModal
					title={sectionCardsSection.title?.trim() || t('section')}
					icon={sectionCardsSection.icon}
					cardColumns={sectionCardsSection.cardColumns}
					cards={sectionCardsSection.cards}
					{getLocalizedCardLabel}
					onClose={() => {
						sectionCardsOpen = false;
						sectionCardsSection = null;
					}}
				/>
			{/await}
		{/if}
	</div>
	{#if dragIndicatorActive}
		<div
			class="drag-indicator"
			class:valid={dragIndicatorValid}
			class:invalid={!dragIndicatorValid}
			style:left={`${dragIndicatorX}px`}
			style:top={`${dragIndicatorY}px`}
		>
			{dragIndicatorValid ? '✔' : '✕'}
		</div>
	{/if}
</div>
