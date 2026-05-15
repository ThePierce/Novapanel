<script lang="ts">
	import type { TranslationKey } from '$lib/i18n';
	import type { CardDefinition } from '$lib/cards/store';
	import EditorSection from '$lib/cards/editor/EditorSection.svelte';
	import type { ClockStyle } from '$lib/persistence/panel-state-types';
	import { filteredEntities } from '$lib/ha/entities-store';
	import { filterEntitiesForStatusCard, type StatusCardKind } from '$lib/cards/status/status-engine';
	import StatusEntityPickerModal from '$lib/cards/status/StatusEntityPickerModal.svelte';
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import EnergyEditor from '$lib/cards/editor/EnergyEditor.svelte';
	import CamerasEditor from '$lib/cards/editor/CamerasEditor.svelte';
	import WeekCalendarEditor from '$lib/cards/editor/WeekCalendarEditor.svelte';
	import ClockEditor from '$lib/cards/editor/ClockEditor.svelte';
	import DateEditor from '$lib/cards/editor/DateEditor.svelte';
	import WeatherForecastEditor from '$lib/cards/editor/WeatherForecastEditor.svelte';
	import WeatherAlarmEditor from '$lib/cards/editor/WeatherAlarmEditor.svelte';
	import StatusCardEditor from '$lib/cards/editor/StatusCardEditor.svelte';
	import LightGroupsEditor from '$lib/cards/editor/LightGroupsEditor.svelte';
	import LightButtonEditor from '$lib/cards/editor/LightButtonEditor.svelte';
	import EntityButtonEditor from '$lib/cards/editor/EntityButtonEditor.svelte';
	import { browser } from '$app/environment';
	import { loadLightGroups, saveLightGroups, createLightGroup, type LightGroup } from '$lib/cards/light-groups';
	import { entityStore } from '$lib/ha/entities-store';
	import type { EntityButtonKind } from '$lib/cards/entity-button-types';

	function getFriendlyName(entityId: string): string {
		const entity = $entityStore.entities.find(e => e.entityId === entityId);
		return entity?.friendlyName?.trim() || entityId;
	}

	// Light groups state — use reactive $state array, not $derived from localStorage
	let lightGroupsState = $state<LightGroup[]>([]);

	// Load groups when cardEditorId or type changes
	$effect(() => {
		if (browser && cardEditorId && cardEditorType === 'lights_status') {
			void lgGroupsVersion; // reactive dependency — reload when version changes
			lightGroupsState = loadLightGroups(cardEditorId);
		} else {
			lightGroupsState = [];
		}
	});

	const lightGroups = $derived(lightGroupsState);

	let lgEditingId = $state<string | null>(null);
	let lgDraftName = $state('');
	let lgDraftEntityIds = $state<string[]>([]);
	let lgNewGroupName = $state('');
	let lgEntityPickerOpen = $state(false); // popup for entity picker

	function lgStartEdit(group: LightGroup) {
		lgEditingId = group.id;
		lgDraftName = group.name;
		lgDraftEntityIds = [...group.entityIds];
		if (onOpenGroupPicker && cardEditorId) {
			onOpenGroupPicker(group, cardEditorId, lightGroupsState);
		} else {
			lgEntityPickerOpen = true;
		}
	}
	function lgSave() {
		if (!cardEditorId || !lgEditingId) return;
		const updated = lightGroupsState.map(g =>
			g.id === lgEditingId ? { ...g, name: lgDraftName, entityIds: lgDraftEntityIds } : g
		);
		saveLightGroups(cardEditorId, updated);
		lightGroupsState = updated;
		lgEditingId = null;
		lgEntityPickerOpen = false;
	}
	function lgDelete(groupId: string) {
		if (!cardEditorId) return;
		const updated = lightGroupsState.filter(g => g.id !== groupId);
		saveLightGroups(cardEditorId, updated);
		lightGroupsState = updated;
	}
	function lgCreate() {
		if (!cardEditorId || !lgNewGroupName.trim()) return;
		const newGroup = createLightGroup(lgNewGroupName.trim(), []);
		const updated = [...lightGroupsState, newGroup];
		saveLightGroups(cardEditorId, updated);
		lightGroupsState = updated;
		lgNewGroupName = '';
		if (onOpenGroupPicker) {
			onOpenGroupPicker(newGroup, cardEditorId, updated);
		} else {
			lgEditingId = newGroup.id;
			lgDraftName = newGroup.name;
			lgDraftEntityIds = [];
			lgEntityPickerOpen = true;
		}
	}
	function lgToggleEntity(entityId: string) {
		if (lgDraftEntityIds.includes(entityId)) {
			lgDraftEntityIds = lgDraftEntityIds.filter(id => id !== entityId);
		} else {
			lgDraftEntityIds = [...lgDraftEntityIds, entityId];
		}
	}
let availabilityIgnoredOpen = $state(false);

	type Props = {
		t: (key: TranslationKey | string) => string;
	cardEditorId?: string;
		cardCatalog: CardDefinition[];
		getLocalizedCardLabel: (type: string) => string;
		cardEditorType: string;
		cardEditorTitle: string;
		cardEditorEntityId?: string;
		cardEditorAnalogStyle: 1 | 2 | 3 | 4;
		cardEditorDigitalStyle: 1 | 2 | 3 | 4;
		cardEditorClockStyle?: ClockStyle;
		cardEditorClockShowAnalog?: boolean;
		cardEditorClockShowDigital?: boolean;
		cardEditorClockHour12?: boolean;
		cardEditorClockSeconds?: boolean;
		cardEditorDateLayout?: 'vertical' | 'horizontal';
		cardEditorDateShortDay?: boolean;
		cardEditorDateShortMonth?: boolean;
		cardEditorDateAlign?: 'left' | 'center' | 'right';
		cardEditorDateWeekdayWithDate?: boolean;
		cardEditorWeatherForecastType?: 'daily' | 'hourly' | 'twice_daily';
		cardEditorWeatherForecastDaysToShow?: number;
		cardEditorStatusDomains?: string[];
		cardEditorStatusDeviceClasses?: string[];
		cardEditorStatusEntityIds?: string[];
		cardEditorStatusEntityAliases?: Record<string, string>;
		cardEditorStatusEntityIconOverrides?: Record<string, string>;
		mediaHubPlayerAliases?: Record<string, string>;
		lightButtonEntityIds?: string[];
		cardEditorStatusDiscoveredEntityIds?: string[];
		cardEditorStatusIcon?: string;
		cardEditorHasChanges: boolean;
		onClose: () => void;
		onDelete: () => void;
		onSave: () => void;
		onTitleChange: (value: string) => void;
		onEntityIdChange: (value: string) => void;
		onAnalogStyleChange: (value: 1 | 2 | 3 | 4) => void;
		onDigitalStyleChange: (value: 1 | 2 | 3 | 4) => void;
		onClockStyleChange: (value: ClockStyle) => void;
		onClockShowAnalogChange: (value: boolean) => void;
		onClockShowDigitalChange: (value: boolean) => void;
		onClockHour12Change: (value: boolean) => void;
		onClockSecondsChange: (value: boolean) => void;
		onDateLayoutChange: (value: 'vertical' | 'horizontal') => void;
		onDateShortDayChange: (value: boolean) => void;
		onDateShortMonthChange: (value: boolean) => void;
		onDateAlignChange: (value: 'left' | 'center' | 'right') => void;
		onDateWeekdayWithDateChange: (value: boolean) => void;
		onWeatherForecastTypeChange: (value: 'daily' | 'hourly' | 'twice_daily') => void;
		onWeatherForecastDaysToShowChange: (value: number) => void;
		onStatusDomainsChange: (value: string[]) => void;
		onStatusDeviceClassesChange: (value: string[]) => void;
		onStatusEntityIdsChange: (value: string[]) => void;
		onStatusEntityAliasesChange: (value: Record<string, string>) => void;
		onStatusEntityIconOverridesChange: (value: Record<string, string>) => void;
		onMediaHubPlayerAliasesChange?: (value: Record<string, string>) => void;
		onStatusDiscoveredEntityIdsChange: (value: string[]) => void;
		onStatusIconChange: (value: string) => void;
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
		cardEditorEnergyDeviceAliases?: Record<string, string>;
		cardEditorCameras?: import('$lib/persistence/panel-state-types').CameraConfig[];
		cardEditorHasCustomDayNoCar?: boolean;
		cardEditorHasCustomDayWithCar?: boolean;
		cardEditorHasCustomNightNoCar?: boolean;
		cardEditorHasCustomNightWithCar?: boolean;
		cardEditorAnchorsDayNoCar?: import('$lib/persistence/panel-state-types').EnergyAnchors;
		cardEditorAnchorsDayWithCar?: import('$lib/persistence/panel-state-types').EnergyAnchors;
		cardEditorAnchorsNightNoCar?: import('$lib/persistence/panel-state-types').EnergyAnchors;
		cardEditorAnchorsNightWithCar?: import('$lib/persistence/panel-state-types').EnergyAnchors;
		onNetEntityIdChange: (value: string) => void;
		onSolarEntityIdChange: (value: string) => void;
		onBatteryEntityIdChange: (value: string) => void;
		onGridEntityIdChange: (value: string) => void;
		onBatteryChargeEntityIdChange: (value: string) => void;
		onImportTodayEntityIdChange: (value: string) => void;
		onExportTodayEntityIdChange: (value: string) => void;
		onSolarTodayEntityIdChange: (value: string) => void;
		onHomeTodayEntityIdChange: (value: string) => void;
		onCostTodayEntityIdChange: (value: string) => void;
		onCompensationTodayEntityIdChange: (value: string) => void;
		onSelfSufficiencyEntityIdChange: (value: string) => void;
		onCarChargingEntityIdChange: (value: string) => void;
		onCarCableEntityIdChange: (value: string) => void;
		onCarChargingPowerEntityIdChange: (value: string) => void;
		onEnergyDeviceEntityIdsChange: (value: string[]) => void;
		onEnergyDeviceTodayEntityIdsChange: (value: string[]) => void;
		onEnergyDeviceAliasesChange: (value: Record<string, string>) => void;
		onCamerasChange: (value: import('$lib/persistence/panel-state-types').CameraConfig[]) => void;
		onEnergyUploadClick: (variant: string) => void;
		onEnergyResetClick: (variant: string) => void;
		onEnergyAnchorsClick: (variant: string) => void;
		onOpenGroupPicker?: (group: LightGroup, cardId: string, allGroups: LightGroup[]) => void;
		lgGroupsVersion?: number;
	};

	let {
		t,
		cardEditorId,
		cardCatalog,
		getLocalizedCardLabel,
		cardEditorType,
		cardEditorTitle,
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
		cardEditorStatusEntityAliases = {},
		cardEditorStatusEntityIconOverrides = {},
		mediaHubPlayerAliases = {},
		lightButtonEntityIds = [],
		cardEditorStatusDiscoveredEntityIds,
		cardEditorStatusIcon,
		cardEditorHasChanges,
		onClose,
		onDelete,
		onSave,
		onTitleChange,
		onEntityIdChange,
		onAnalogStyleChange,
		onDigitalStyleChange,
		onClockStyleChange,
		onClockShowAnalogChange,
		onClockShowDigitalChange,
		onClockHour12Change,
		onClockSecondsChange,
		onDateLayoutChange,
		onDateShortDayChange,
		onDateShortMonthChange,
		onDateAlignChange,
		onDateWeekdayWithDateChange,
		onWeatherForecastTypeChange,
		onWeatherForecastDaysToShowChange,
		onStatusDomainsChange,
		onStatusDeviceClassesChange,
		onStatusEntityIdsChange,
		onStatusEntityAliasesChange,
		onStatusEntityIconOverridesChange,
		onMediaHubPlayerAliasesChange,
		onStatusDiscoveredEntityIdsChange,
		onStatusIconChange,
		cardEditorNetEntityId = '',
		cardEditorSolarEntityId = '',
		cardEditorBatteryEntityId = '',
		cardEditorGridEntityId = '',
		cardEditorBatteryChargeEntityId = '',
		cardEditorImportTodayEntityId = '',
		cardEditorExportTodayEntityId = '',
		cardEditorSolarTodayEntityId = '',
		cardEditorHomeTodayEntityId = '',
		cardEditorCostTodayEntityId = '',
		cardEditorCompensationTodayEntityId = '',
		cardEditorSelfSufficiencyEntityId = '',
		cardEditorCarChargingEntityId = '',
		cardEditorCarCableEntityId = '',
		cardEditorCarChargingPowerEntityId = '',
		cardEditorEnergyDeviceEntityIds = [],
		cardEditorEnergyDeviceTodayEntityIds = [],
		cardEditorEnergyDeviceAliases = {},
		cardEditorCameras = [],
		cardEditorHasCustomDayNoCar = false,
		cardEditorHasCustomDayWithCar = false,
		cardEditorHasCustomNightNoCar = false,
		cardEditorHasCustomNightWithCar = false,
		cardEditorAnchorsDayNoCar,
		cardEditorAnchorsDayWithCar,
		cardEditorAnchorsNightNoCar,
		cardEditorAnchorsNightWithCar,
		onNetEntityIdChange,
		onSolarEntityIdChange,
		onBatteryEntityIdChange,
		onGridEntityIdChange,
		onBatteryChargeEntityIdChange,
		onImportTodayEntityIdChange,
		onExportTodayEntityIdChange,
		onSolarTodayEntityIdChange,
		onHomeTodayEntityIdChange,
		onCostTodayEntityIdChange,
		onCompensationTodayEntityIdChange,
		onSelfSufficiencyEntityIdChange,
		onCarChargingEntityIdChange,
		onCarCableEntityIdChange,
		onCarChargingPowerEntityIdChange,
		onEnergyDeviceEntityIdsChange,
		onEnergyDeviceTodayEntityIdsChange,
		onEnergyDeviceAliasesChange,
		onCamerasChange,
		onEnergyUploadClick,
		onEnergyResetClick,
		onEnergyAnchorsClick,
		onOpenGroupPicker,
		lgGroupsVersion = 0
	}: Props = $props();

	let clockMode = $derived(
		(() => {
			const showAnalog = cardEditorClockShowAnalog ?? false;
			const showDigital = cardEditorClockShowDigital ?? true;
			if (showAnalog && showDigital) return 'both';
			if (showAnalog) return 'analog';
			return 'digital';
		})()
	);

	const weatherEntities = $derived(
		$filteredEntities.filter((entity) => entity.domain === 'weather')
	);
	const alarmEntities = $derived(
		$filteredEntities.filter((entity) => entity.domain === 'alarm_control_panel')
	);
	const statusKind = $derived<StatusCardKind | null>(
		cardEditorType === 'lights_status' ||
			cardEditorType === 'openings_status' ||
			cardEditorType === 'devices_status' ||
			cardEditorType === 'availability_status' ||
			cardEditorType === 'media_players_status'
			? (cardEditorType as StatusCardKind)
			: null
	);
	const statusCandidates = $derived(
		statusKind
			? filterEntitiesForStatusCard({
					entities: $filteredEntities,
					kind: statusKind,
					domains: cardEditorStatusDomains ?? [],
					deviceClasses: cardEditorStatusDeviceClasses ?? [],
					ignoredEntityIds: []
				}).relevant
			: []
	);
	const availabilitySelectedSet = $derived(
		new Set((cardEditorStatusEntityIds ?? []).map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0))
	);
	const usesScopedEntityPicker = $derived(
		cardEditorType === 'availability_status' ||
			cardEditorType === 'devices_status' ||
			cardEditorType === 'openings_status' ||
			cardEditorType === 'lights_status' ||
			cardEditorType === 'media_players_status'
	);
	const entityButtonKind = $derived<EntityButtonKind | null>(
		cardEditorType === 'climate_button'
			? 'climate'
			: cardEditorType === 'cover_button'
				? 'cover'
				: cardEditorType === 'vacuum_button'
					? 'vacuum'
					: cardEditorType === 'media_player_button'
						? 'media_player'
						: null
	);

	const cardTypeMeta = $derived((() => {
		const type = cardEditorType ?? '';
		if (type === 'energy') return { icon: 'bolt', tone: 'amber', tint: 'rgba(250,204,21,0.18)', color: '#facc15', subtitle: t('Bewerk hoe deze kaart leest en weergeeft') };
		if (type === 'cameras_strip') return { icon: 'device-cctv', tone: 'blue', tint: 'rgba(96,165,250,0.18)', color: '#60a5fa', subtitle: t("Camera's selecteren en in Apple Home stijl tonen") };
		if (type === 'week_calendar') return { icon: 'calendar-week', tone: 'cyan', tint: 'rgba(56,189,248,0.18)', color: '#38bdf8', subtitle: t('Weekkalender met CalDAV personen en kleuren') };
		if (type === 'light_button') return { icon: 'bulb', tone: 'gold', tint: 'rgba(255,211,56,0.18)', color: '#ffd338', subtitle: t('Lampknop met helderheid en kleur') };
		if (type === 'climate_button') return { icon: 'temperature', tone: 'orange', tint: 'rgba(251,146,60,0.18)', color: '#fb923c', subtitle: t('Thermostaatknop met temperatuur en modus') };
		if (type === 'cover_button') return { icon: 'curtains', tone: 'blue', tint: 'rgba(96,165,250,0.18)', color: '#60a5fa', subtitle: t('Gordijnknop met positiebediening') };
		if (type === 'vacuum_button') return { icon: 'robot', tone: 'green', tint: 'rgba(52,211,153,0.18)', color: '#34d399', subtitle: t('Robotstofzuiger met start, pauze en dock') };
		if (type === 'media_player_button') return { icon: 'device-speaker', tone: 'purple', tint: 'rgba(192,132,252,0.18)', color: '#c084fc', subtitle: t('Media player met afspelen en volume') };
		if (type === 'alarm_panel') return { icon: 'shield-lock', tone: 'rose', tint: 'rgba(248,113,113,0.18)', color: '#f87171', subtitle: t('Koppel aan een alarm-entiteit') };
		if (type === 'lights_status') return { icon: 'bulb', tone: 'gold', tint: 'rgba(255,211,56,0.18)', color: '#ffd338', subtitle: t('Selecteer welke lampen meedoen') };
		if (type === 'openings_status') return { icon: 'door', tone: 'blue', tint: 'rgba(96,165,250,0.18)', color: '#60a5fa', subtitle: t('Welke deuren en ramen zijn open') };
		if (type === 'devices_status') return { icon: 'plug', tone: 'green', tint: 'rgba(52,211,153,0.18)', color: '#34d399', subtitle: t('Welke apparaten staan aan') };
		if (type === 'availability_status') return { icon: 'wifi', tone: 'cyan', tint: 'rgba(34,211,238,0.18)', color: '#22d3ee', subtitle: t('Welke apparaten zijn bereikbaar') };
		if (type === 'media_players_status') return { icon: 'device-speaker', tone: 'purple', tint: 'rgba(192,132,252,0.18)', color: '#c084fc', subtitle: t('Welke spelers worden gevolgd') };
		if (type === 'clock') return { icon: 'clock', tone: 'cyan', tint: 'rgba(34,211,238,0.18)', color: '#22d3ee', subtitle: t('Stijl en weergave van de klok') };
		if (type === 'date') return { icon: 'calendar', tone: 'blue', tint: 'rgba(96,165,250,0.18)', color: '#60a5fa', subtitle: t('Datumweergave instellen') };
		if (type === 'weather') return { icon: 'cloud', tone: 'cyan', tint: 'rgba(34,211,238,0.18)', color: '#22d3ee', subtitle: t('Koppel aan een weer-entiteit') };
		if (type === 'weather_forecast') return { icon: 'cloud-storm', tone: 'cyan', tint: 'rgba(34,211,238,0.18)', color: '#22d3ee', subtitle: t('Voorspelling weergeven') };
		return { icon: 'note', tone: 'blue', tint: 'rgba(96,165,250,0.18)', color: '#60a5fa', subtitle: t('Kaart bewerken') };
	})());

	const scopedPickerRows = $derived(
		usesScopedEntityPicker
			? statusCandidates.map((entity) => {
					const aliases = cardEditorType === 'media_players_status' ? mediaHubPlayerAliases : cardEditorStatusEntityAliases;
					const alias = aliases?.[entity.entityId];
					const displayName =
						typeof alias === 'string' && alias.trim().length > 0 ? alias.trim() : entity.friendlyName;
					return {
						id: entity.entityId,
						key: entity.entityId.trim().toLowerCase(),
						displayName,
						label: displayName
					};
				})
			: []
	);
	const scopedPickerSelectedRows = $derived(
		usesScopedEntityPicker ? scopedPickerRows.filter((row) => availabilitySelectedSet.has(row.key)) : []
	);
	const scopedPickerIgnoredRows = $derived(
		usesScopedEntityPicker ? scopedPickerRows.filter((row) => !availabilitySelectedSet.has(row.key)) : []
	);
	const usesScopedSeenTracking = $derived(
		cardEditorType === 'availability_status' ||
			cardEditorType === 'devices_status' ||
			cardEditorType === 'openings_status' ||
			cardEditorType === 'lights_status'
	);

	// === Energy device-picker (live W + kWh vandaag) ===
	// Toon alleen entiteiten die bij energie passen, op basis van unit_of_measurement of device_class.
	const energyPowerCandidates = $derived((() => {
		if (cardEditorType !== 'energy') return [] as typeof $filteredEntities;
		return $filteredEntities.filter((entity) => {
			const unit = (entity.unit ?? '').toLowerCase().trim();
			const cls = (entity.deviceClass ?? '').toLowerCase().trim();
			return unit === 'w' || unit === 'kw' || cls === 'power';
		});
	})());
	const energyEnergyCandidates = $derived((() => {
		if (cardEditorType !== 'energy') return [] as typeof $filteredEntities;
		return $filteredEntities.filter((entity) => {
			const unit = (entity.unit ?? '').toLowerCase().trim();
			const cls = (entity.deviceClass ?? '').toLowerCase().trim();
			return unit === 'wh' || unit === 'kwh' || unit === 'mwh' || cls === 'energy';
		});
	})());

	function entityToRow(entity: { entityId: string; friendlyName: string }) {
		const displayName = entity.friendlyName && entity.friendlyName.trim().length > 0 ? entity.friendlyName : entity.entityId;
		return {
			id: entity.entityId,
			key: entity.entityId.trim().toLowerCase(),
			displayName,
			label: displayName
		};
	}

	const energyPowerSelectedSet = $derived(
		new Set((cardEditorEnergyDeviceEntityIds ?? []).map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0))
	);
	const energyEnergySelectedSet = $derived(
		new Set((cardEditorEnergyDeviceTodayEntityIds ?? []).map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0))
	);

	const energyPowerPickerRows = $derived(
		cardEditorType === 'energy' ? energyPowerCandidates.map(entityToRow) : []
	);
	const energyEnergyPickerRows = $derived(
		cardEditorType === 'energy' ? energyEnergyCandidates.map(entityToRow) : []
	);

	const energyPowerSelectedRows = $derived(
		energyPowerPickerRows.filter((row) => energyPowerSelectedSet.has(row.key))
	);
	const energyPowerIgnoredRows = $derived(
		energyPowerPickerRows.filter((row) => !energyPowerSelectedSet.has(row.key))
	);
	const energyEnergySelectedRows = $derived(
		energyEnergyPickerRows.filter((row) => energyEnergySelectedSet.has(row.key))
	);
	const energyEnergyIgnoredRows = $derived(
		energyEnergyPickerRows.filter((row) => !energyEnergySelectedSet.has(row.key))
	);

	function toggleEnergyDevicePowerEntity(entityId: string, checked: boolean) {
		const key = entityId.trim().toLowerCase();
		const next = (cardEditorEnergyDeviceEntityIds ?? []).filter((value) => value.trim().toLowerCase() !== key);
		if (checked) next.push(entityId);
		onEnergyDeviceEntityIdsChange(next);
	}
	function toggleEnergyDeviceTodayEntity(entityId: string, checked: boolean) {
		const key = entityId.trim().toLowerCase();
		const next = (cardEditorEnergyDeviceTodayEntityIds ?? []).filter((value) => value.trim().toLowerCase() !== key);
		if (checked) next.push(entityId);
		onEnergyDeviceTodayEntityIdsChange(next);
	}
	function selectAllEnergyDevicePower() {
		onEnergyDeviceEntityIdsChange(energyPowerPickerRows.map((row) => row.id));
	}
	function clearEnergyDevicePower() {
		onEnergyDeviceEntityIdsChange([]);
	}
	function selectAllEnergyDeviceToday() {
		onEnergyDeviceTodayEntityIdsChange(energyEnergyPickerRows.map((row) => row.id));
	}
	function clearEnergyDeviceToday() {
		onEnergyDeviceTodayEntityIdsChange([]);
	}
	let pickerOpen = $state(false);
	let iconValidationState = $state<'idle' | 'checking' | 'ok' | 'error'>('idle');
	let iconValidationMessage = $state('');
	const iconPreviewSrc = $derived(
		(() => {
			const value = (cardEditorStatusIcon ?? '').trim();
			if (!value.startsWith('mdi:')) return '';
			const ingressBase =
				typeof window !== 'undefined'
					? (((window as unknown as { __novapanel_ingress?: string }).__novapanel_ingress || '') as string)
					: '';
			return `${ingressBase}/api/mdi-icon/${encodeURIComponent(value.slice(4))}`;
		})()
	);

	const iconValidationNeeded = $derived(
		cardEditorType === 'light_button' ||
		cardEditorType === 'climate_button' ||
		cardEditorType === 'cover_button' ||
		cardEditorType === 'vacuum_button' ||
		cardEditorType === 'media_player_button' ||
		cardEditorType === 'lights_status' ||
			cardEditorType === 'devices_status' ||
			cardEditorType === 'media_players_status'
	);

	function normalizeDiscoveredKeys(ids: string[] | undefined): Set<string> {
		const s = new Set<string>();
		if (!ids) return s;
		for (const id of ids) {
			const k = id.trim().toLowerCase();
			if (k) s.add(k);
		}
		return s;
	}

	function discoveredBaseSet(): Set<string> {
		const fromProp = cardEditorStatusDiscoveredEntityIds;
		if (fromProp !== undefined) return normalizeDiscoveredKeys(fromProp);
		return new Set(
			statusCandidates
				.map((e) => e.entityId.trim().toLowerCase())
				.filter((k) => k.length > 0)
		);
	}

	$effect(() => {
		if (!usesScopedEntityPicker || statusCandidates.length === 0) return;
		const candidateKeys = new Set(
			statusCandidates
				.map((entity) => entity.entityId.trim().toLowerCase())
				.filter((value) => value.length > 0)
		);
		if (candidateKeys.size === 0) return;
		const selected = cardEditorStatusEntityIds ?? [];
		const cleaned = selected.filter((entityId) => candidateKeys.has(entityId.trim().toLowerCase()));
		if (cleaned.length === selected.length) return;
		onStatusEntityIdsChange(cleaned);
	});

	$effect(() => {
		if (!iconValidationNeeded) {
			iconValidationState = 'idle';
			iconValidationMessage = '';
			return;
		}
		const value = (cardEditorStatusIcon ?? '').trim();
		if (value.length === 0) {
			iconValidationState = 'error';
			iconValidationMessage = t('mdiIconEmpty');
			return;
		}
		if (!value.startsWith('mdi:')) {
			iconValidationState = 'error';
			iconValidationMessage = t('mdiIconPrefixError');
			return;
		}
		iconValidationState = 'checking';
		iconValidationMessage = t('mdiIconChecking');
		let cancelled = false;
		const img = new Image();
		img.onload = () => {
			if (cancelled) return;
			iconValidationState = 'ok';
			iconValidationMessage = t('mdiIconFound');
		};
		img.onerror = () => {
			if (cancelled) return;
			iconValidationState = 'error';
			iconValidationMessage = t('mdiIconNotFound');
		};
		const ingressBase =
			typeof window !== 'undefined'
				? (((window as unknown as { __novapanel_ingress?: string }).__novapanel_ingress || '') as string)
				: '';
		img.src = `${ingressBase}/api/mdi-icon/${encodeURIComponent(value.slice(4))}`;
		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		if (!usesScopedSeenTracking) {
			availabilityIgnoredOpen = false;
			return;
		}

		const candidateKeys = statusCandidates
			.map((e) => e.entityId.trim().toLowerCase())
			.filter((k) => k.length > 0);

		const seen = new Set<string>();
		const rawDiscovered = cardEditorStatusDiscoveredEntityIds;

		if (rawDiscovered === undefined) {
			for (const k of candidateKeys) seen.add(k);
		} else {
			for (const id of rawDiscovered) {
				const k = id.trim().toLowerCase();
				if (k) seen.add(k);
			}
		}

		const migratedLegacy = rawDiscovered === undefined;

		const selected = [...(cardEditorStatusEntityIds ?? [])];
		const selectedSet = new Set(
			selected.map((v) => v.trim().toLowerCase()).filter((v) => v.length > 0)
		);

		let discoveredDirty = migratedLegacy;
		let selectedDirty = false;
		let nextSelected = selected;

		for (const entity of statusCandidates) {
			const id = entity.entityId.trim();
			if (!id) continue;
			const key = id.toLowerCase();
			if (!seen.has(key)) {
				seen.add(key);
				discoveredDirty = true;
				if (!selectedSet.has(key)) {
					nextSelected = [...nextSelected, id];
					selectedSet.add(key);
					selectedDirty = true;
				}
			}
		}

		const nextDiscovered = Array.from(seen);

		if (discoveredDirty) {
			onStatusDiscoveredEntityIdsChange(nextDiscovered);
		}
		if (selectedDirty) {
			onStatusEntityIdsChange(nextSelected);
		}
	});

	function toggleStatusEntityId(entityId: string, checked: boolean) {
		const key = entityId.trim().toLowerCase();
		const next = (cardEditorStatusEntityIds ?? []).filter((value) => value.trim().toLowerCase() !== key);
		if (checked) next.push(entityId);
		if (!checked && key.length > 0 && usesScopedSeenTracking) {
			const seen = discoveredBaseSet();
			seen.add(key);
			onStatusDiscoveredEntityIdsChange(Array.from(seen));
		}
		onStatusEntityIdsChange(next);
	}

	function clearScopedPickerSelectionOnce() {
		const nextSeen = statusCandidates
			.map((entity) => entity.entityId.trim().toLowerCase())
			.filter((value) => value.length > 0);
		onStatusDiscoveredEntityIdsChange(nextSeen);
		onStatusEntityIdsChange([]);
	}

	function selectAllScopedPickerEntities() {
		const nextSeen = statusCandidates
			.map((entity) => entity.entityId.trim().toLowerCase())
			.filter((value) => value.length > 0);
		const next = statusCandidates
			.map((entity) => entity.entityId.trim())
			.filter((value) => value.length > 0);
		onStatusDiscoveredEntityIdsChange(nextSeen);
		onStatusEntityIdsChange(next);
	}
</script>

<button type="button" class="modal-overlay" onclick={onClose} aria-label={t('closeOverlay')}></button>
<section class="settings-modal app-popup card-editor-modal np-editor" class:camera-editor-wide={cardEditorType === 'cameras_strip'} role="dialog" aria-modal="true" aria-label={t('selectCardType')}>
	<div class="np-editor-head" style="--np-tint: {cardTypeMeta.tint}; --np-color: {cardTypeMeta.color};">
		<div class="np-editor-head-glow" aria-hidden="true"></div>
		<div class="np-editor-head-icon">
			<TablerIcon name={cardTypeMeta.icon} size={22} />
		</div>
		<div class="np-editor-head-text">
			<div class="np-editor-head-title">
				{cardEditorTitle && cardEditorTitle.trim().length > 0 ? cardEditorTitle : t('cardTitle')}
				{#if cardEditorHasChanges}
					<span class="np-saved-pill dirty">
						<span class="np-saved-dot"></span>
						niet opgeslagen
					</span>
				{:else}
					<span class="np-saved-pill">
						<span class="np-saved-dot"></span>
						opgeslagen
					</span>
				{/if}
			</div>
			<div class="np-editor-head-sub">{cardTypeMeta.subtitle}</div>
		</div>
		</div>
	<div class="tab-content card-editor-content np-editor-body">
		<div class="np-name-block">
			<label for="card-editor-title" class="np-label">{t('cardTitle')}</label>
			<input id="card-editor-title" type="text" class="np-input" value={cardEditorTitle} oninput={(event) => onTitleChange((event.currentTarget as HTMLInputElement).value)} />
		</div>
		{#if cardEditorType === 'weather' || cardEditorType === 'weather_forecast' || cardEditorType === 'alarm_panel'}
			<WeatherAlarmEditor
				{t}
				isAlarm={cardEditorType === 'alarm_panel'}
				entityId={cardEditorEntityId}
				entities={cardEditorType === 'alarm_panel' ? alarmEntities : weatherEntities}
				{onEntityIdChange}
			/>
		{/if}
		{#if cardEditorType === 'energy'}
			<EnergyEditor
				netEntityId={cardEditorNetEntityId}
				solarEntityId={cardEditorSolarEntityId}
				batteryEntityId={cardEditorBatteryEntityId}
				gridEntityId={cardEditorGridEntityId}
				batteryChargeEntityId={cardEditorBatteryChargeEntityId}
				importTodayEntityId={cardEditorImportTodayEntityId}
				exportTodayEntityId={cardEditorExportTodayEntityId}
				solarTodayEntityId={cardEditorSolarTodayEntityId}
				homeTodayEntityId={cardEditorHomeTodayEntityId}
				costTodayEntityId={cardEditorCostTodayEntityId}
				compensationTodayEntityId={cardEditorCompensationTodayEntityId}
				selfSufficiencyEntityId={cardEditorSelfSufficiencyEntityId}
				carChargingEntityId={cardEditorCarChargingEntityId}
				carCableEntityId={cardEditorCarCableEntityId}
				carChargingPowerEntityId={cardEditorCarChargingPowerEntityId}
				energyDeviceEntityIds={cardEditorEnergyDeviceEntityIds}
				energyDeviceTodayEntityIds={cardEditorEnergyDeviceTodayEntityIds}
				energyDeviceAliases={cardEditorEnergyDeviceAliases}
				hasCustomDayNoCar={cardEditorHasCustomDayNoCar}
				hasCustomDayWithCar={cardEditorHasCustomDayWithCar}
				hasCustomNightNoCar={cardEditorHasCustomNightNoCar}
				hasCustomNightWithCar={cardEditorHasCustomNightWithCar}
				anchorsDayNoCar={cardEditorAnchorsDayNoCar}
				anchorsDayWithCar={cardEditorAnchorsDayWithCar}
				anchorsNightNoCar={cardEditorAnchorsNightNoCar}
				anchorsNightWithCar={cardEditorAnchorsNightWithCar}
				{onNetEntityIdChange}
				{onSolarEntityIdChange}
				{onBatteryEntityIdChange}
				{onGridEntityIdChange}
				{onBatteryChargeEntityIdChange}
				{onImportTodayEntityIdChange}
				{onExportTodayEntityIdChange}
				{onSolarTodayEntityIdChange}
				{onHomeTodayEntityIdChange}
				{onCostTodayEntityIdChange}
				{onCompensationTodayEntityIdChange}
				{onSelfSufficiencyEntityIdChange}
				{onCarChargingEntityIdChange}
				{onCarCableEntityIdChange}
				{onCarChargingPowerEntityIdChange}
				{onEnergyDeviceEntityIdsChange}
				{onEnergyDeviceTodayEntityIdsChange}
				{onEnergyDeviceAliasesChange}
				energyPowerSelectedRows={energyPowerSelectedRows}
				energyPowerIgnoredRows={energyPowerIgnoredRows}
				energyEnergySelectedRows={energyEnergySelectedRows}
				energyEnergyIgnoredRows={energyEnergyIgnoredRows}
				{toggleEnergyDevicePowerEntity}
				{toggleEnergyDeviceTodayEntity}
				{selectAllEnergyDevicePower}
				{clearEnergyDevicePower}
				{selectAllEnergyDeviceToday}
				{clearEnergyDeviceToday}
				{onEnergyUploadClick}
				{onEnergyResetClick}
				{onEnergyAnchorsClick}
			/>
		{/if}
		{#if cardEditorType === 'cameras_strip'}
			<CamerasEditor
				cameras={cardEditorCameras}
				{onCamerasChange}
			/>
		{/if}
		{#if cardEditorType === 'week_calendar'}
			<WeekCalendarEditor
				sources={cardEditorCameras}
				onSourcesChange={onCamerasChange}
			/>
		{/if}
		{#if cardEditorType === 'light_button'}
			<LightButtonEditor
				entityId={cardEditorEntityId}
				statusIcon={cardEditorStatusIcon}
				linkedLightEntityIds={lightButtonEntityIds}
				{iconValidationState}
				{iconValidationMessage}
				{iconPreviewSrc}
				{onEntityIdChange}
				{onStatusIconChange}
			/>
		{/if}
		{#if entityButtonKind}
			<EntityButtonEditor
				kind={entityButtonKind}
				entityId={cardEditorEntityId}
				statusIcon={cardEditorStatusIcon}
				{iconValidationState}
				{iconValidationMessage}
				{iconPreviewSrc}
				{onEntityIdChange}
				{onStatusIconChange}
			/>
		{/if}
		{#if cardEditorType === 'lights_status' || cardEditorType === 'openings_status' || cardEditorType === 'devices_status' || cardEditorType === 'availability_status' || cardEditorType === 'media_players_status'}
			<StatusCardEditor
				{t}
				cardType={cardEditorType}
				statusDomains={cardEditorStatusDomains}
				statusEntityIds={cardEditorStatusEntityIds}
				statusEntityAliases={cardEditorStatusEntityAliases}
				statusEntityIconOverrides={cardEditorStatusEntityIconOverrides}
				mediaHubPlayerAliases={mediaHubPlayerAliases}
				statusDeviceClasses={cardEditorStatusDeviceClasses}
				statusIcon={cardEditorStatusIcon}
				{usesScopedEntityPicker}
				{scopedPickerSelectedRows}
				{scopedPickerIgnoredRows}
				{statusCandidates}
				{iconValidationState}
				{iconValidationMessage}
				{iconPreviewSrc}
				{onStatusDomainsChange}
				{onStatusDeviceClassesChange}
				{onStatusIconChange}
				{onStatusEntityAliasesChange}
				{onStatusEntityIconOverridesChange}
				{onMediaHubPlayerAliasesChange}
				{toggleStatusEntityId}
				{selectAllScopedPickerEntities}
				{clearScopedPickerSelectionOnce}
				openPicker={() => (pickerOpen = true)}
			/>
		{/if}
		{#if cardEditorType === 'lights_status' && cardEditorId}
			<LightGroupsEditor
				{lightGroups}
				{lgEditingId}
				{lgNewGroupName}
				{getFriendlyName}
				{lgStartEdit}
				{lgDelete}
				{lgCreate}
				onLgNewGroupNameChange={(v) => (lgNewGroupName = v)}
			/>
		{/if}
		{#if cardEditorType === 'clock'}
			<ClockEditor
				{t}
				analogStyle={cardEditorAnalogStyle}
				digitalStyle={cardEditorDigitalStyle}
				clockStyle={cardEditorClockStyle}
				clockShowAnalog={cardEditorClockShowAnalog}
				clockShowDigital={cardEditorClockShowDigital}
				clockHour12={cardEditorClockHour12}
				clockSeconds={cardEditorClockSeconds}
				{clockMode}
				{onClockShowAnalogChange}
				{onClockShowDigitalChange}
				{onClockStyleChange}
				{onClockHour12Change}
				{onClockSecondsChange}
			/>
		{/if}
		{#if cardEditorType === 'date'}
			<DateEditor
				{t}
				dateLayout={cardEditorDateLayout}
				dateAlign={cardEditorDateAlign}
				dateShortDay={cardEditorDateShortDay}
				dateShortMonth={cardEditorDateShortMonth}
				dateWeekdayWithDate={cardEditorDateWeekdayWithDate}
				{onDateLayoutChange}
				{onDateAlignChange}
				{onDateShortDayChange}
				{onDateShortMonthChange}
				{onDateWeekdayWithDateChange}
			/>
		{/if}
		{#if cardEditorType === 'weather_forecast'}
			<WeatherForecastEditor
				{t}
				weatherForecastType={cardEditorWeatherForecastType}
				weatherForecastDaysToShow={cardEditorWeatherForecastDaysToShow}
				{onWeatherForecastTypeChange}
				{onWeatherForecastDaysToShowChange}
			/>
		{/if}
	</div>
	<div class="np-editor-foot">
		<button type="button" class="np-btn danger" onclick={onDelete}>
			<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1.5 14a2 2 0 0 1-2 1.8H8.5A2 2 0 0 1 6.5 20L5 6m5 0V4a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v2"></path></svg>
			{t('delete')}
		</button>
		<div class="np-foot-spacer"></div>
		<button type="button" class="np-btn ghost" onclick={onClose}>{t('closeOverlay')}</button>
		<button type="button" class="np-btn primary" class:dirty={cardEditorHasChanges} onclick={onSave}>
			<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"></polyline></svg>
			{t('save')}
		</button>
	</div>
</section>

{#if pickerOpen}
	<StatusEntityPickerModal
		{t}
		title={t('statusEntityPickerTitle')}
		entities={statusCandidates}
		onClose={() => (pickerOpen = false)}
	/>
{/if}

<!-- Light group picker - rendered outside modal to avoid overflow:hidden clipping -->
{#if lgEntityPickerOpen && lgEditingId}
	<button type="button" class="lg-picker-overlay" onclick={() => lgSave()} aria-label={t('closeOverlay')}></button>
	<div class="lg-picker-modal" role="dialog" aria-modal="true" aria-label={t('Selecteer lampen voor deze groep')}>
		<div class="lg-picker-head">
			<input class="lg-name-input" type="text" value={lgDraftName}
				oninput={(e) => lgDraftName = (e.currentTarget as HTMLInputElement).value}
				placeholder={t('Groepsnaam')} />
			<span class="lg-picker-hint">{t('Selecteer lampen voor deze groep')}</span>
		</div>
		<div class="lg-picker-list">
			{#each (cardEditorStatusEntityIds ?? []) as entityId}
				{@const inOtherGroup = lightGroups.some(g => g.id !== lgEditingId && g.entityIds.includes(entityId))}
				<label class="lg-entity-row" class:lg-in-other={inOtherGroup}>
					<input type="checkbox"
						checked={lgDraftEntityIds.includes(entityId)}
						disabled={inOtherGroup}
						onchange={() => lgToggleEntity(entityId)} />
					<span class="lg-entity-name">{getFriendlyName(entityId)}</span>
					{#if inOtherGroup}<span class="lg-entity-tag">{t('in andere groep')}</span>{/if}
				</label>
			{/each}
			{#if (cardEditorStatusEntityIds ?? []).length === 0}
				<div class="lg-empty">{t('Voeg eerst lampen toe via de entiteitenlijst hierboven.')}</div>
			{/if}
		</div>
		<div class="lg-picker-actions">
			<button type="button" class="lg-btn-delete-group" onclick={() => { lgDelete(lgEditingId!); lgEntityPickerOpen = false; lgEditingId = null; }}>
				<StatusIcon icon="mdi:delete-outline" size={14} /> {t('Verwijder groep')}
			</button>
			<button type="button" class="lg-btn-save" onclick={lgSave}>{t('save')}</button>
		</div>
	</div>
{/if}

<style>
	.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.36); border: 0; padding: 0; margin: 0; z-index: 40; cursor: default; }
	.settings-modal { position: fixed; top: 50%; left: 50%; background: #121722; border: 1px solid #2e384d; border-radius: 0.6rem; padding: 1rem; z-index: 60; transform: translate(-50%, -50%); }
	.app-popup {
		width: min(var(--popup-width, 850px), calc(100vw - 1.5rem));
		height: min(var(--popup-height, 1140px), calc(100vh - 1.5rem));
		height: min(var(--popup-height, 1140px), calc(100dvh - 1.5rem));
		max-height: calc(100vh - 1.5rem);
		max-height: calc(100dvh - 1.5rem);
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
		overflow: hidden;
		min-height: 0;
	}
	.card-editor-modal { grid-template-rows: auto minmax(0, 1fr) auto; min-height: 0; }
	.card-editor-modal.camera-editor-wide { width: min(980px, calc(100vw - 1.5rem)); }
	.tab-content { min-height: 0; overflow-y: auto; overflow-x: hidden; padding-right: 0.2rem; scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; touch-action: pan-y; }
	.tab-content::-webkit-scrollbar { width: 0; height: 0; display: none; }
	.card-editor-content { display: grid; gap: 0.6rem; align-content: start; }
	/* Picker popup */
	.lg-name-input { flex: 1; height: 2rem; border-radius: 0.35rem; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); color: #f5f5f5; padding: 0 0.5rem; font-size: 0.85rem; min-width: 0; }
	.lg-picker-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200; border: 0; padding: 0; cursor: default; }
	.lg-picker-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 201; background: #121722; border: 1px solid #2e384d; border-radius: 0.85rem; width: min(340px, calc(100vw - 2rem)); display: flex; flex-direction: column; max-height: 80vh; overflow: hidden; }
	.lg-picker-head { padding: 0.85rem 1rem 0; display: flex; flex-direction: column; gap: 0.3rem; }
	.lg-picker-hint { font-size: 0.75rem; opacity: 0.5; }
	.lg-picker-list { flex: 1; overflow-y: auto; scrollbar-width: none; padding: 0.5rem 1rem; display: flex; flex-direction: column; gap: 0.2rem; }
	.lg-picker-list::-webkit-scrollbar { display: none; }
	.lg-entity-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.5rem; border-radius: 0.4rem; cursor: pointer; }
	.lg-entity-row:hover { background: rgba(255,255,255,0.04); }
	.lg-entity-row.lg-in-other { opacity: 0.4; cursor: not-allowed; }
	.lg-entity-name { flex: 1; font-size: 0.85rem; }
	.lg-entity-tag { font-size: 0.68rem; opacity: 0.5; white-space: nowrap; }
	.lg-empty { font-size: 0.82rem; opacity: 0.45; padding: 1rem 0; text-align: center; }
	.lg-picker-actions { display: flex; gap: 0.4rem; padding: 0.75rem 1rem; border-top: 1px solid rgba(255,255,255,0.07); }
	.lg-btn-save { flex: 1; height: 2.2rem; border-radius: 0.4rem; border: 0; background: rgba(79,113,168,0.45); color: #f5f5f5; cursor: pointer; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 0.35rem; }
	.lg-btn-save:hover { background: rgba(79,113,168,0.65); }
	.lg-btn-delete-group { height: 2.2rem; padding: 0 0.85rem; border-radius: 0.4rem; border: 0; background: rgba(225,82,65,0.15); color: #e15241; cursor: pointer; font-size: 0.82rem; display: flex; align-items: center; gap: 0.3rem; }
	.lg-btn-delete-group:hover { background: rgba(225,82,65,0.3); }
	/* === New editor shell + sections (np-* prefix) === */
	.np-editor.settings-modal {
		background: linear-gradient(180deg, #1a2238 0%, #0f1424 100%);
		border-radius: 18px;
		border: 0.5px solid rgba(255,255,255,0.08);
		padding: 0;
		grid-template-rows: auto minmax(0, 1fr) auto;
		overflow: hidden;
		min-height: 0;
	}
	.np-editor::before {
		content: '';
		position: absolute;
		top: 0; left: 50%;
		width: 60%; height: 1px;
		background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
		transform: translateX(-50%);
		pointer-events: none;
	}
	.np-editor-head {
		padding: 18px 22px 14px;
		border-bottom: 0.5px solid rgba(255,255,255,0.06);
		display: flex;
		align-items: center;
		gap: 12px;
		position: relative;
		overflow: hidden;
	}
	.np-editor-head-glow {
		position: absolute;
		top: -100px; left: -40px;
		width: 220px; height: 220px;
		background: radial-gradient(circle, var(--np-tint, rgba(96,165,250,0.18)), transparent 70%);
		pointer-events: none;
		filter: blur(20px);
	}
	.np-editor-head-icon {
		width: 38px; height: 38px;
		border-radius: 10px;
		display: grid; place-items: center;
		background: var(--np-tint);
		border: 0.5px solid rgba(255,255,255,0.10);
		color: var(--np-color);
		flex-shrink: 0;
		position: relative;
		z-index: 1;
	}
	.np-editor-head-text { flex: 1; min-width: 0; position: relative; z-index: 1; }
	.np-editor-head-title {
		font-size: 15px;
		font-weight: 500;
		letter-spacing: -0.01em;
		line-height: 1.2;
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
		color: #f5f5f5;
	}
	.np-editor-head-sub {
		font-size: 11.5px;
		color: rgba(255,255,255,0.5);
		margin-top: 3px;
	}
	.np-saved-pill {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 10.5px;
		padding: 3px 9px 3px 7px;
		border-radius: 999px;
		background: rgba(74,222,128,0.10);
		border: 0.5px solid rgba(74,222,128,0.22);
		color: #4ade80;
		font-weight: 500;
	}
	.np-saved-pill.dirty {
		background: rgba(250,204,21,0.10);
		border-color: rgba(250,204,21,0.22);
		color: #facc15;
	}
	.np-saved-dot {
		width: 6px; height: 6px;
		border-radius: 50%;
		background: currentColor;
	}
	.np-saved-pill.dirty .np-saved-dot {
		animation: npPulse 1.6s ease-in-out infinite;
	}
	@keyframes npPulse {
		0%, 100% { opacity: 1; transform: scale(1); }
		50% { opacity: 0.4; transform: scale(1.4); }
	}
	.np-editor-body {
		padding: 14px 22px calc(28px + env(safe-area-inset-bottom, 0px));
		display: flex;
		flex-direction: column;
		gap: 9px;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		grid-template-rows: none;
		grid-template-columns: none;
		align-content: initial;
		scrollbar-width: none;
		-ms-overflow-style: none;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		scroll-padding-bottom: calc(28px + env(safe-area-inset-bottom, 0px));
	}
	.np-editor-body::-webkit-scrollbar { width: 0; height: 0; display: none; }
	.np-name-block {
		margin-bottom: 4px;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.np-label {
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: rgba(255,255,255,0.5);
		font-weight: 500;
		display: block;
	}
	.np-input {
		background: rgba(255,255,255,0.04);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 9px;
		padding: 9px 11px;
		color: #f5f5f5;
		font-size: 13px;
		font-family: inherit;
		width: 100%;
		box-sizing: border-box;
		height: auto;
		transition: border-color 0.15s, background 0.15s;
	}
	.np-input::placeholder { color: rgba(255,255,255,0.3); }
	.np-input:focus {
		outline: none;
		border-color: rgba(96,165,250,0.45);
		background: rgba(96,165,250,0.06);
		box-shadow: 0 0 0 3px rgba(96,165,250,0.08);
	}
	/* Footer */
	.np-editor-foot {
		display: flex;
		gap: 8px;
		padding: 12px 22px;
		background: linear-gradient(180deg, rgba(15,20,36,0.4) 0%, rgba(15,20,36,0.92) 60%, rgba(15,20,36,0.96) 100%);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		border-top: 0.5px solid rgba(255,255,255,0.08);
	}
	.np-foot-spacer { flex: 1; }
	.np-btn {
		padding: 8px 14px;
		border-radius: 9px;
		font-size: 12.5px;
		font-weight: 500;
		font-family: inherit;
		border: 0.5px solid transparent;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: auto;
		transition: transform 0.1s, background 0.15s, box-shadow 0.15s;
	}
	.np-btn:hover { transform: translateY(-1px); }
	.np-btn:active { transform: translateY(0); }
	.np-btn.danger {
		background: rgba(239,68,68,0.10);
		border-color: rgba(239,68,68,0.20);
		color: #f87171;
	}
	.np-btn.danger:hover { background: rgba(239,68,68,0.16); }
	.np-btn.ghost {
		background: rgba(255,255,255,0.05);
		border-color: rgba(255,255,255,0.10);
		color: rgba(255,255,255,0.85);
	}
	.np-btn.ghost:hover { background: rgba(255,255,255,0.10); }
	.np-btn.primary {
		background: rgba(255,255,255,0.06);
		color: rgba(255,255,255,0.7);
		border-color: rgba(255,255,255,0.10);
	}
	.np-btn.primary.dirty {
		background: linear-gradient(135deg, #2563eb, #1d4ed8);
		color: #fff;
		border-color: rgba(96,165,250,0.40);
		box-shadow: 0 4px 14px rgba(37,99,235,0.30);
	}
	.np-btn.primary.dirty:hover {
		background: linear-gradient(135deg, #3b82f6, #2563eb);
		box-shadow: 0 6px 18px rgba(37,99,235,0.40);
	}
</style>
