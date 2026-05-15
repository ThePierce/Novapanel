<script lang="ts">
	import { selectedLanguageStore, translate, translateState, type TranslationKey } from '$lib/i18n';
	import { entityStore } from '$lib/ha/entities-store';
	import type { HomeAssistantEntity } from '$lib/ha/entities-service-helpers';
	import { callHaService } from '$lib/ha/service-call';
	import {
		buildStatusSummary,
		filterEntitiesForStatusCard,
		isEntityActive,
		type StatusCardKind
	} from '$lib/cards/status/status-engine';
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import MediaHubCard from '$lib/cards/status/MediaHubCard.svelte';
	import { readStoredValue, writeStoredValue } from '$lib/persistence/storage';
	import { loadLightGroups, type LightGroup } from '$lib/cards/light-groups';
	import { areaStore, areaById } from '$lib/ha/area-store';
	import { browser } from '$app/environment';

const EMPTY_RECORD: Record<string, string> = {};

	type Props = {
		t: (key: TranslationKey) => string;
		title: string;
		kind: StatusCardKind;
		cardId?: string;

		domains?: string[];
		deviceClasses?: string[];
		statusEntityIds?: string[];
	statusEntityAliases?: Record<string, string>;
	statusEntityIconOverrides?: Record<string, string>;
		ignoredEntityIds?: string[];
		spotifyConfigured?: boolean;
		mediaHubOnkyoBridges?: Array<{ id: string; label: string; zoneEntityId: string; spotifySource?: string }>;
		mediaHubPlayerOrder?: string[];
		mediaHubPlayerAliases?: Record<string, string>;
		onMediaHubBridgesChange?: (value: Array<{ id: string; label: string; zoneEntityId: string; spotifySource?: string }>) => void;
		onMediaHubPlayerOrderChange?: (value: string[]) => void;
		onClose: () => void;
		onIgnore: (entityId: string) => void;
		onUnignore: (entityId: string) => void;
	onEntityIconChange?: (entityId: string, icon: string | null) => void;
		/** When true, entity rows do not trigger HA toggle on click (editor / arrange mode). */
		editMode?: boolean;
	};

	let {
		t,
		title,
		kind,
		cardId = '',

		domains = [],
		deviceClasses = [],
		statusEntityIds = [],
	statusEntityAliases = EMPTY_RECORD,
	statusEntityIconOverrides = EMPTY_RECORD,
	editMode = false,
	spotifyConfigured = false,
	mediaHubOnkyoBridges = [],
	mediaHubPlayerOrder = [],
	mediaHubPlayerAliases = {},
	onMediaHubBridgesChange,
	onMediaHubPlayerOrderChange,
	onClose,
	onEntityIconChange
	}: Props = $props();

	let actionBusyEntityId = $state('');
	let actionError = $state('');
	const AVAILABILITY_TAB_KEY = 'np_availability_tab_last';
	let availabilityTab = $state<'entities' | 'batteries'>(
		(readStoredValue(AVAILABILITY_TAB_KEY) === 'batteries' ? 'batteries' : 'entities')
	);
	$effect(() => {
		writeStoredValue(AVAILABILITY_TAB_KEY, availabilityTab);
	});
	const showScopedBatteryPane = $derived(
		kind === 'availability_status' && availabilityTab === 'batteries'
	);
	const showScopedEntitiesPane = $derived(
		(kind === 'availability_status' && availabilityTab === 'entities') ||
			kind === 'devices_status' ||
			kind === 'openings_status' ||
			kind === 'lights_status'
	);

	const cardTypeMeta = $derived((() => {
		if (kind === 'lights_status') return { title: translate('Lampen', $selectedLanguageStore), icon: 'bulb', tint: 'rgba(255,211,56,0.18)', color: '#ffd338', subtitle: translate('Welke lampen zijn aan', $selectedLanguageStore) };
		if (kind === 'openings_status') return { title: translate('Openingen', $selectedLanguageStore), icon: 'door', tint: 'rgba(96,165,250,0.18)', color: '#60a5fa', subtitle: translate('Welke deuren en ramen zijn open', $selectedLanguageStore) };
		if (kind === 'devices_status') return { title: translate('Apparaten', $selectedLanguageStore), icon: 'plug', tint: 'rgba(52,211,153,0.18)', color: '#34d399', subtitle: translate('Welke apparaten staan aan', $selectedLanguageStore) };
		if (kind === 'availability_status') return { title: translate('Beschikbaarheid', $selectedLanguageStore), icon: 'wifi', tint: 'rgba(34,211,238,0.18)', color: '#22d3ee', subtitle: translate('Bereikbaarheid en batterijen', $selectedLanguageStore) };
		if (kind === 'media_players_status') return { title: 'Media', icon: 'device-speaker', tint: 'rgba(192,132,252,0.18)', color: '#c084fc', subtitle: translate('Spelers en queue', $selectedLanguageStore) };
		return { title: translate('Status', $selectedLanguageStore), icon: 'note', tint: 'rgba(96,165,250,0.18)', color: '#60a5fa', subtitle: '' };
	})());
	const detailTitle = $derived(
		typeof title === 'string' && title.trim().length > 0 ? title.trim() : cardTypeMeta.title
	);

	let iconOverrideTick = $state(0);
	let iconEditorEntityId = $state('');
	let iconEditorDraft = $state('');
	let iconHoldTimer: ReturnType<typeof setTimeout> | null = null;

	type StatusDetailEntity = (typeof result.relevant)[number];

	function popupLabelForEntity(entityId: string, friendlyName: string): string {
		if (
			kind === 'lights_status' ||
			kind === 'availability_status' ||
			kind === 'devices_status' ||
			kind === 'openings_status'
		) {
			const value = statusEntityAliases?.[entityId];
			if (typeof value === 'string' && value.trim().length > 0) return value.trim();
		}
		if (kind === 'media_players_status') {
			const value = mediaHubPlayerAliases?.[entityId];
			if (typeof value === 'string' && value.trim().length > 0) return value.trim();
		}
		return friendlyName;
	}

	function supportsCustomIconEditor(kindValue: StatusCardKind): boolean {
		return (
			kindValue === 'lights_status' ||
			kindValue === 'availability_status' ||
			kindValue === 'devices_status' ||
			kindValue === 'openings_status'
		);
	}

	function getDefaultEntityDetailIcon(entity: StatusDetailEntity): string {
		if (kind === 'lights_status') {
			const icon = entity.icon?.trim();
			if (icon && icon.length > 0) return icon;
			const state = (entity.state || '').toLowerCase();
			return state === 'on' ? 'mdi:lightbulb-on' : 'mdi:lightbulb-outline';
		}
		if (kind === 'availability_status') {
			return entity.icon && entity.icon.trim().length > 0 ? entity.icon : 'mdi:lan-disconnect';
		}
		if (kind === 'openings_status') {
			return getOpeningDetailIcon(entity);
		}
		return getDeviceDetailIcon(entity);
	}

	function getEntityDetailIcon(entity: StatusDetailEntity): string {
		void iconOverrideTick;
		if (!supportsCustomIconEditor(kind)) return getDefaultEntityDetailIcon(entity);
		const override = statusEntityIconOverrides?.[entity.entityId];
		if (typeof override === 'string' && override.trim().length > 0) {
			const value = override.trim();
			return value.includes(':') ? value : `mdi:${value}`;
		}
		return getDefaultEntityDetailIcon(entity);
	}

	function startIconHold(entity: StatusDetailEntity, event: PointerEvent) {
		if (!supportsCustomIconEditor(kind)) return;
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		cancelIconHold();
		iconHoldTimer = setTimeout(() => {
			iconEditorEntityId = entity.entityId;
			iconEditorDraft = getEntityDetailIcon(entity);
		}, 2000);
	}

	function cancelIconHold() {
		if (!iconHoldTimer) return;
		clearTimeout(iconHoldTimer);
		iconHoldTimer = null;
	}

	function saveIconEditor() {
		const id = iconEditorEntityId.trim();
		if (!id || !supportsCustomIconEditor(kind)) return;
		let value = iconEditorDraft.trim();
		if (value.length > 0 && !value.includes(':')) value = `mdi:${value}`;
		onEntityIconChange?.(id, value.length > 0 ? value : null);
		iconOverrideTick++;
		iconEditorEntityId = '';
	}

	function closeIconEditor() {
		iconEditorEntityId = '';
	}

	// Light groups for this card
	const lightGroups = $derived.by(() => {
		if (!browser || !cardId || kind !== 'lights_status') return [] as LightGroup[];
		return loadLightGroups(cardId);
	});
	const groupedEntityIds = $derived(
		new Set(lightGroups.flatMap(g => g.entityIds.map(id => id.toLowerCase())))
	);

	// Area grouping
	const AREA_KINDS: StatusCardKind[] = ['lights_status','openings_status','devices_status','availability_status','media_players_status'];
	const usesAreaGrouping = $derived(AREA_KINDS.includes(kind) && $areaStore.loaded && $areaStore.areas.length > 0);
	type AreaGroup<T> = { areaId: string | null; areaName: string; entities: T[] };
	function groupByArea<T extends { entityId: string }>(entities: T[]): AreaGroup<T>[] {
		const { entityAreaMap } = $areaStore;
		const areaMap = new Map<string, AreaGroup<T>>();
		const noArea: T[] = [];
		for (const entity of entities) {
			const areaId = entityAreaMap[entity.entityId] ?? null;
			if (!areaId) { noArea.push(entity); continue; }
			const areaName = $areaById[areaId]?.name ?? areaId;
			if (!areaMap.has(areaId)) areaMap.set(areaId, { areaId, areaName, entities: [] });
			areaMap.get(areaId)!.entities.push(entity);
		}
		const groups = [...areaMap.values()].sort((a,b) => a.areaName.localeCompare(b.areaName,'nl'));
		if (noArea.length > 0) groups.push({ areaId: null, areaName: 'Overig', entities: noArea });
		return groups;
	}
	type WithArea<T> = T & { _areaName: string | null };
	function sortByArea<T extends { entityId: string }>(entities: T[]): WithArea<T>[] {
		if (!usesAreaGrouping) return entities.map(e => ({ ...e, _areaName: null }));
		return groupByArea(entities).flatMap(g => g.entities.map(e => ({ ...e, _areaName: g.areaName })));
	}
	type SortedGroup = LightGroup & { _areaName: string | null };
	const sortedLightGroups = $derived.by((): SortedGroup[] => {
		if (!lightGroups.length) return [];
		const { entityAreaMap } = $areaStore;
		return lightGroups.map(group => {
			const areaCounts = new Map<string, number>();
			for (const id of group.entityIds) {
				const areaId = entityAreaMap[id.toLowerCase()] ?? entityAreaMap[id] ?? null;
				if (areaId) areaCounts.set(areaId, (areaCounts.get(areaId) ?? 0) + 1);
			}
			let bestAreaId: string | null = null; let bestCount = 0;
			for (const [aId, cnt] of areaCounts) { if (cnt > bestCount) { bestAreaId = aId; bestCount = cnt; } }
			const areaName = bestAreaId ? ($areaById[bestAreaId]?.name ?? bestAreaId) : null;
			return { ...group, _areaName: areaName };
		}).sort((a,b) => (a._areaName ?? 'zzz').localeCompare(b._areaName ?? 'zzz','nl'));
	});
	const sortedActiveEntities = $derived(sortByArea(
		scopedActiveEntities.filter(e => kind !== 'lights_status' || !groupedEntityIds.has(e.entityId.toLowerCase()))
	));
	const sortedBatteryEntities = $derived(sortByArea(batteryEntities));
	const sortedMediaEntities = $derived(sortByArea(mediaPlayerEntities));









	const result = $derived(
		filterEntitiesForStatusCard({
			entities: $entityStore.entities,
			kind,
			domains,
			deviceClasses,
			ignoredEntityIds: []
		})
	);
	const statusScopeSet = $derived(
		new Set(
			(statusEntityIds ?? [])
				.map((value) => value.trim().toLowerCase())
				.filter((value) => value.length > 0)
		)
	);
	const scopedActiveEntities = $derived.by(() => {
		if (
			kind !== 'lights_status' &&
			kind !== 'availability_status' &&
			kind !== 'devices_status' &&
			kind !== 'openings_status'
		) return result.active;
		if (statusScopeSet.size === 0) return result.active;
		return result.active.filter((entity) => statusScopeSet.has(entity.entityId.toLowerCase()));
	});
	const scopedRelevantEntities = $derived.by(() => {
		if (
			kind !== 'lights_status' &&
			kind !== 'availability_status' &&
			kind !== 'devices_status' &&
			kind !== 'openings_status'
		) return result.relevant;
		if (statusScopeSet.size === 0) return result.relevant;
		return result.relevant.filter((entity) => statusScopeSet.has(entity.entityId.toLowerCase()));
	});
	const batteryEntities = $derived.by(() => {
		if (kind !== 'availability_status' && kind !== 'devices_status')
			return [] as Array<(typeof scopedRelevantEntities)[number] & { batteryLevel: number }>;
		const out: Array<(typeof scopedRelevantEntities)[number] & { batteryLevel: number }> = [];
		for (const entity of scopedRelevantEntities) {
			if (!entityMatchesBatteryNaming(entity)) continue;
			const batteryLevel = getBatteryLevel(entity);
			if (batteryLevel === null) continue;
			out.push({ ...entity, batteryLevel });
		}
		return out.sort((a, b) => a.batteryLevel - b.batteryLevel);
	});
	const summary = $derived(buildStatusSummary({ kind, activeCount: result.active.length, language: $selectedLanguageStore }));

	// Hero stats per kind
	const heroStats = $derived.by(() => {
		const totalScoped = scopedRelevantEntities.length;
		const activeScoped = scopedActiveEntities.length;
		if (kind === 'lights_status') {
			return {
				active: activeScoped,
				total: totalScoped,
				activeLabel: activeScoped === 1 ? translate('lamp aan', $selectedLanguageStore) : translate('lampen aan', $selectedLanguageStore),
				idleLabel: activeScoped === 0 ? translate('Alle lampen uit', $selectedLanguageStore) : `${translate('van', $selectedLanguageStore)} ${totalScoped} ${translate('Totaal', $selectedLanguageStore).toLowerCase()}`,
				accent: '#ffd338',
				accentSoft: 'rgba(255,211,56,0.18)',
				bgGradient: 'radial-gradient(circle at 30% 20%, rgba(255,211,56,0.10), transparent 55%)'
			};
		}
		if (kind === 'openings_status') {
			return {
				active: activeScoped,
				total: totalScoped,
				activeLabel: translate('Open', $selectedLanguageStore).toLowerCase(),
				idleLabel: activeScoped === 0 ? translate('Alles dicht', $selectedLanguageStore) : `${translate('van', $selectedLanguageStore)} ${totalScoped} ${translate('Totaal', $selectedLanguageStore).toLowerCase()}`,
				accent: '#60a5fa',
				accentSoft: 'rgba(96,165,250,0.18)',
				bgGradient: 'radial-gradient(circle at 30% 20%, rgba(96,165,250,0.10), transparent 55%)'
			};
		}
		if (kind === 'devices_status') {
			return {
				active: activeScoped,
				total: totalScoped,
				activeLabel: activeScoped === 1 ? translate('apparaat actief', $selectedLanguageStore) : translate('apparaten actief', $selectedLanguageStore),
				idleLabel: activeScoped === 0 ? translate('Alle apparaten uit', $selectedLanguageStore) : `${translate('van', $selectedLanguageStore)} ${totalScoped} ${translate('Totaal', $selectedLanguageStore).toLowerCase()}`,
				accent: '#34d399',
				accentSoft: 'rgba(52,211,153,0.18)',
				bgGradient: 'radial-gradient(circle at 30% 20%, rgba(52,211,153,0.10), transparent 55%)'
			};
		}
		if (kind === 'availability_status') {
			const offline = activeScoped; // active in availability = offline/unavailable
			const online = Math.max(0, totalScoped - offline);
			const lowestBattery = batteryEntities.length > 0 ? batteryEntities[0].batteryLevel : null;
			return {
				active: offline,
				total: totalScoped,
				activeLabel: offline === 1 ? 'offline' : 'offline',
				idleLabel: offline === 0
					? `${translate('alle', $selectedLanguageStore)} ${totalScoped} ${translate('Apparaten', $selectedLanguageStore).toLowerCase()} online`
					: `${online} online · ${offline} offline`,
				accent: offline > 0 ? '#f87171' : '#22d3ee',
				accentSoft: offline > 0 ? 'rgba(248,113,113,0.18)' : 'rgba(34,211,238,0.18)',
				bgGradient: offline > 0
					? 'radial-gradient(circle at 30% 20%, rgba(248,113,113,0.10), transparent 55%)'
					: 'radial-gradient(circle at 30% 20%, rgba(34,211,238,0.10), transparent 55%)',
				lowestBattery
			};
		}
		return null;
	});
	const mediaPlayerEntities = $derived.by(() => {
		if (kind !== 'media_players_status') return [] as typeof result.relevant;
		const allowed = new Set(
			(statusEntityIds ?? [])
				.map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
				.filter((entry) => entry.length > 0)
		);
		const onlyMedia = result.relevant.filter((entity) => entity.domain === 'media_player');
		if (allowed.size === 0) return onlyMedia;
		const allowedNames = new Set<string>(allowed);
		return onlyMedia.filter((entity) => {
			const fullId = entity.entityId.toLowerCase();
			const shortId = fullId.startsWith('media_player.') ? fullId.slice('media_player.'.length) : fullId;
			const friendlyName = (entity.friendlyName ?? '').trim().toLowerCase();
			return allowed.has(fullId) || allowed.has(shortId) || allowedNames.has(friendlyName);
		});
	});

	async function callHaDomainService(
		domain: string,
		service: string,
		entityId: string,
		serviceData: Record<string, unknown> = {}
	) {
		actionError = '';
		actionBusyEntityId = entityId;
		try {
			await callHaService(domain, service, {
				entity_id: entityId,
				...serviceData
			});
		} catch (error) {
			const message =
				error instanceof Error && error.message.trim().length > 0
					? error.message
					: t('unknownError');
			actionError = `${t('actionFailedPrefix')}: ${message}`;
		} finally {
			actionBusyEntityId = '';
		}
	}

	async function callMediaService(entityId: string, service: string, serviceData: Record<string, unknown> = {}) {
		await callHaDomainService('media_player', service, entityId, serviceData);
	}

	async function toggleLightGroup(group: LightGroup) {
		const groupIdSet = new Set(
			group.entityIds
				.map((id) => id.trim().toLowerCase())
				.filter((id) => id.length > 0)
		);
		const groupEntities = result.relevant.filter((e) =>
			groupIdSet.has(e.entityId.trim().toLowerCase())
		);
		if (groupEntities.length === 0) return;
		const anyOn = groupEntities.some((e) => (e.state || '').toLowerCase() === 'on');
		const service = anyOn ? 'turn_off' : 'turn_on';
		const byDomain = new Map<string, string[]>();
		for (const entity of groupEntities) {
			const domain = (entity.domain || entity.entityId.split('.')[0] || 'light').toLowerCase();
			const list = byDomain.get(domain) ?? [];
			list.push(entity.entityId);
			byDomain.set(domain, list);
		}
		for (const [domain, entityIds] of byDomain.entries()) {
			if (entityIds.length === 0) continue;
			// Lights can toggle in one batched service call; other supported domains use on/off.
			if (domain === 'light' || domain === 'switch') {
				await callHaDomainService(domain, service === 'turn_off' ? 'turn_off' : 'turn_on', entityIds[0], {
					entity_id: entityIds
				});
				continue;
			}
			if (domain === 'fan' || domain === 'climate' || domain === 'media_player') {
				await callHaDomainService(domain, service, entityIds[0], { entity_id: entityIds });
			}
		}
	}














	async function toggleLightOrDeviceEntity(entity: HomeAssistantEntity) {
		if (editMode || actionBusyEntityId) return;
		if (kind !== 'lights_status' && kind !== 'devices_status') return;

		const domain = (entity.domain || entity.entityId.split('.')[0] || '').toLowerCase();
		const entityId = entity.entityId;
		const active =
			kind === 'lights_status'
				? isEntityActive(entity, 'lights_status')
				: isEntityActive(entity, 'devices_status');

		if (domain === 'light') {
			await callHaDomainService('light', 'toggle', entityId);
			return;
		}
		if (domain === 'switch') {
			await callHaDomainService('switch', 'toggle', entityId);
			return;
		}
		if (domain === 'fan') {
			await callHaDomainService('fan', active ? 'turn_off' : 'turn_on', entityId);
			return;
		}
		if (domain === 'climate') {
			await callHaDomainService('climate', active ? 'turn_off' : 'turn_on', entityId);
			return;
		}
		if (domain === 'media_player') {
			await callHaDomainService('media_player', active ? 'turn_off' : 'turn_on', entityId);
			return;
		}
	}

	function handleScopedEntityRowClick(event: MouseEvent | KeyboardEvent, entity: HomeAssistantEntity) {
		if (editMode) return;
		if (kind !== 'lights_status' && kind !== 'devices_status') return;
		const target = event.target as HTMLElement | null;
		if (!target) return;
		if (target.closest('button')) return;
		if (target.closest('.icon-mini-editor')) return;
		if (target.closest('.popup-inline-rename')) return;
		void toggleLightOrDeviceEntity(entity);
	}

	function formatDeviceState(raw: string): string {
		const s = (raw || '').trim().toLowerCase();
		if (s === 'unavailable') return translate('Niet bereikbaar', $selectedLanguageStore);
		if (s === 'playing') return translate('Afspelen', $selectedLanguageStore);
		if (s === 'idle') return translate('Inactief', $selectedLanguageStore);
		if (s === 'heat') return translate('Verwarmen', $selectedLanguageStore);
		if (s === 'cool') return translate('Koelen', $selectedLanguageStore);
		return translateState(s || raw, $selectedLanguageStore);
	}

	function getDeviceDetailIcon(entity: (typeof result.relevant)[number]): string {
		const icon = entity.icon?.trim();
		if (icon && icon.length > 0) return icon;
		return 'mdi:power-plug';
	}

	function getOpeningDetailIcon(entity: (typeof result.relevant)[number]): string {
		const icon = entity.icon?.trim();
		if (icon && icon.length > 0) return icon;
		const state = (entity.state || '').toLowerCase();
		const opened = state === 'on' || state === 'open' || state === 'opening';
		const deviceClass = (entity.deviceClass ?? '').toLowerCase();
		const id = entity.entityId.toLowerCase();
		if (deviceClass.includes('window') || id.includes('window')) {
			return opened ? 'mdi:window-open-variant' : 'mdi:window-closed-variant';
		}
		return opened ? 'mdi:door-open' : 'mdi:door-closed';
	}

	function formatOpeningState(raw: string): string {
		const s = (raw || '').trim().toLowerCase();
		if (s === 'on' || s === 'open' || s === 'opening') return translate('Open', $selectedLanguageStore);
		if (s === 'off' || s === 'closed' || s === 'closing') return translate('Gesloten', $selectedLanguageStore);
		if (s === 'unavailable') return translate('Niet bereikbaar', $selectedLanguageStore);
		if (s === 'unknown' || s === '') return translate('Onbekend', $selectedLanguageStore);
		return raw;
	}

	/** Only show rows whose entity id or friendly name suggests a battery-related sensor. */
	function entityMatchesBatteryNaming(entity: (typeof result.relevant)[number]): boolean {
		const id = (entity.entityId ?? '').toLowerCase();
		const name = (entity.friendlyName ?? '').toLowerCase();
		const haystack = `${id} ${name}`;
		const keywords = ['batterijen', 'batterij', 'batteries', 'battery', 'accu'];
		return keywords.some((kw) => haystack.includes(kw));
	}

	function getBatteryLevel(entity: (typeof result.relevant)[number]): number | null {
		const attrs = entity.attributes ?? {};
		const rawFromAttribute = attrs.battery_level;
		const attributeLevel =
			typeof rawFromAttribute === 'number'
				? rawFromAttribute
				: typeof rawFromAttribute === 'string'
					? Number(rawFromAttribute)
					: NaN;
		const stateLevel = Number(entity.state);
		const candidate = Number.isFinite(attributeLevel) ? attributeLevel : stateLevel;
		if (!Number.isFinite(candidate)) return null;
		return Math.max(0, Math.min(100, Math.round(candidate)));
	}

	function getBatteryIcon(level: number): string {
		if (level >= 95) return 'mdi:battery';
		if (level >= 85) return 'mdi:battery-90';
		if (level >= 75) return 'mdi:battery-80';
		if (level >= 65) return 'mdi:battery-70';
		if (level >= 55) return 'mdi:battery-60';
		if (level >= 45) return 'mdi:battery-50';
		if (level >= 35) return 'mdi:battery-40';
		if (level >= 25) return 'mdi:battery-30';
		if (level >= 15) return 'mdi:battery-20';
		if (level >= 5) return 'mdi:battery-10';
		return 'mdi:battery-alert';
	}

	function getBatteryToneClass(level: number): string {
		if (level >= 100) return 'battery-tone-100';
		if (level >= 90) return 'battery-tone-90';
		if (level >= 80) return 'battery-tone-80';
		if (level >= 70) return 'battery-tone-70';
		if (level >= 60) return 'battery-tone-60';
		if (level >= 50) return 'battery-tone-50';
		if (level >= 40) return 'battery-tone-40';
		if (level >= 30) return 'battery-tone-30';
		if (level >= 20) return 'battery-tone-20';
		if (level >= 10) return 'battery-tone-10';
		return 'battery-tone-0';
	}

	$effect(() => {
		return () => {
			cancelIconHold();
		};
	});
</script>

<button type="button" class="modal-overlay" onclick={onClose} aria-label={t('closeOverlay')}></button>
<section class="settings-modal app-popup status-detail-modal np-detail" data-kind={kind} role="dialog" aria-modal="true" aria-label={detailTitle}>
	<div class="np-detail-head" style="--np-tint: {cardTypeMeta.tint}; --np-color: {cardTypeMeta.color};">
		<div class="np-detail-head-glow" aria-hidden="true"></div>
		<div class="np-detail-head-icon"><TablerIcon name={cardTypeMeta.icon} size={22} /></div>
		<div class="np-detail-head-text">
			<div class="np-detail-head-title">{detailTitle}</div>
			<div class="np-detail-head-sub">{cardTypeMeta.subtitle}</div>
		</div>
	</div>
	<div class="status-detail-body np-detail-body">
		{#if actionError}
			<div class="np-detail-error">{actionError}</div>
		{/if}

		{#if heroStats && (kind === 'lights_status' || kind === 'openings_status' || kind === 'devices_status' || kind === 'availability_status')}
			<div class="status-hero" style="--hero-accent: {heroStats.accent}; --hero-accent-soft: {heroStats.accentSoft}; --hero-bg: {heroStats.bgGradient};">
				<div class="status-hero-bg" aria-hidden="true"></div>
				<div class="status-hero-icon">
					<TablerIcon name={cardTypeMeta.icon} size={28} />
				</div>
				<div class="status-hero-text">
					<div class="status-hero-number">
						<span class="status-hero-num">{heroStats.active}</span>
						<span class="status-hero-num-label">{heroStats.activeLabel}</span>
					</div>
					<div class="status-hero-sub">{heroStats.idleLabel}</div>
				</div>
				{#if kind === 'availability_status' && heroStats.lowestBattery !== null && heroStats.lowestBattery !== undefined}
					<div class="status-hero-extra">
						<div class="status-hero-extra-label">Laagste batterij</div>
						<div class="status-hero-extra-value" style="color: {heroStats.lowestBattery <= 20 ? '#f87171' : heroStats.lowestBattery <= 40 ? '#fbbf24' : '#4ade80'};">
							{heroStats.lowestBattery}%
						</div>
					</div>
				{/if}
			</div>
		{/if}

		{#if kind === 'availability_status'}
			<div class="np-detail-tabs" role="tablist" aria-label="Entity tabs">
				<button
					type="button"
					role="tab"
					class:active={availabilityTab === 'entities'}
					aria-selected={availabilityTab === 'entities'}
					onclick={() => (availabilityTab = 'entities')}
				>
					Entiteiten
				</button>
				<button
					type="button"
					role="tab"
					class:active={availabilityTab === 'batteries'}
					aria-selected={availabilityTab === 'batteries'}
					onclick={() => (availabilityTab = 'batteries')}
				>
					Batterijen
				</button>
			</div>
		{/if}
		{#if kind === 'media_players_status'}
			<MediaHubCard
				{t}
				entities={sortedMediaEntities}
				allEntities={$entityStore.entities.filter((e) => e.domain === 'media_player')}
				callService={callHaDomainService}
				labelFor={popupLabelForEntity}
				{actionBusyEntityId}
				{spotifyConfigured}
				onkyoBridges={mediaHubOnkyoBridges}
				playerOrder={mediaHubPlayerOrder}
				playerAliases={mediaHubPlayerAliases}
				onBridgesChange={(value) => onMediaHubBridgesChange?.(value)}
				onPlayerOrderChange={(value) => onMediaHubPlayerOrderChange?.(value)}
			/>
		{:else if showScopedBatteryPane}
			<div class="entity-list availability-grid">
				{#if batteryEntities.length === 0}
					<div class="empty-row">-</div>
				{:else}
					{#each sortedBatteryEntities as entity, idx (entity.entityId)}
						{#if usesAreaGrouping && (idx === 0 || sortedBatteryEntities[idx-1]._areaName !== entity._areaName)}
							<div class="area-header">{entity._areaName ?? 'Overig'}</div>
						{/if}
						<div class="entity-row availability-card popup-card-editable">
							<div class={`availability-cover availability-cover-battery ${getBatteryToneClass(entity.batteryLevel)}`}>
								<StatusIcon icon={getBatteryIcon(entity.batteryLevel)} size={20} />
							</div>
							<div class="entity-main availability-main">
								<span>{popupLabelForEntity(entity.entityId, entity.friendlyName)}</span>
								<div class="availability-sub">{entity.batteryLevel}% batterij</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		{:else if kind !== 'media_players_status'}
			{#if showScopedEntitiesPane}
				<div class="entity-list availability-grid">
					{#if scopedActiveEntities.length === 0}
						{#if kind === 'availability_status'}
							<div class="availability-all-ok">
								<div class="availability-ok-icon">
									<StatusIcon icon="mdi:check-circle" size={72} />
								</div>
								<div class="availability-ok-title">{t('availabilityEntitiesAllOk').split('.')[0]}</div>
								<div class="availability-ok-sub">{t('availabilityEntitiesAllOk').split('.').slice(1).join('.').trim()}</div>
							</div>
						{:else}
							<div class="empty-row">-</div>
						{/if}
					{:else}
						{#if kind === 'lights_status' && sortedLightGroups.length > 0}
						{#each sortedLightGroups as group, gIdx (group.id)}
							{@const groupActive = group.entityIds.some(id => scopedActiveEntities.some(e => e.entityId.toLowerCase() === id.toLowerCase()))}
							{@const groupCount = group.entityIds.filter(id => scopedActiveEntities.some(e => e.entityId.toLowerCase() === id.toLowerCase())).length}
							{#if groupCount > 0}
								{#if usesAreaGrouping && (gIdx === 0 || sortedLightGroups[gIdx-1]._areaName !== group._areaName)}
									<div class="area-header">{group._areaName ?? 'Overig'}</div>
								{/if}
								<div class="entity-row availability-card entity-row-toggleable"
									role="button"
									tabindex={editMode ? -1 : 0}
									class:entity-group-active={groupActive}
									onclick={() => !editMode && toggleLightGroup(group)}
									onkeydown={(event) => {
										if (!editMode && (event.key === 'Enter' || event.key === ' ')) {
											event.preventDefault();
											toggleLightGroup(group);
										}
									}}>
									<div class="availability-cover-wrap"><div class="availability-cover">
										<StatusIcon icon={groupActive ? 'mdi:lightbulb-group' : 'mdi:lightbulb-group-outline'} size={20} />
									</div></div>
									<div class="entity-main availability-main">
										<span class="entity-name">{group.name}</span>
										<span class="entity-state">{groupCount}/{group.entityIds.length} aan</span>
									</div>
								</div>
							{/if}
						{/each}
					{/if}
					{#each sortedActiveEntities as entity, idx (entity.entityId)}
						{#if usesAreaGrouping && (idx === 0 || sortedActiveEntities[idx-1]._areaName !== entity._areaName)}
							<div class="area-header">{entity._areaName ?? 'Overig'}</div>
						{/if}
							<div
								class="entity-row availability-card popup-card-editable"
								data-active="1"
								role="button"
								tabindex={!editMode && (kind === 'lights_status' || kind === 'devices_status') ? 0 : -1}
								class:entity-row-toggleable={!editMode &&
									(kind === 'lights_status' || kind === 'devices_status')}
								onclick={(e) => handleScopedEntityRowClick(e, entity)}
								onkeydown={(e) => {
									if (!editMode && (kind === 'lights_status' || kind === 'devices_status') && (e.key === 'Enter' || e.key === ' ')) {
										e.preventDefault();
										handleScopedEntityRowClick(e, entity);
									}
								}}
							>
								<div
									class="availability-cover-wrap"
									onpointerdown={(event) => startIconHold(entity, event)}
									onpointerup={cancelIconHold}
									onpointerleave={cancelIconHold}
									onpointercancel={cancelIconHold}
								>
									<div class="availability-cover">
										<StatusIcon icon={getEntityDetailIcon(entity)} size={20} />
									</div>
									{#if iconEditorEntityId === entity.entityId}
										<div class="icon-mini-editor" role="presentation" onpointerdown={(e) => e.stopPropagation()} onclick={(e) => e.stopPropagation()}>
											<div class="icon-mini-preview">
												<StatusIcon icon={iconEditorDraft && iconEditorDraft.trim().length > 0 ? iconEditorDraft : getEntityDetailIcon(entity)} size={18} />
											</div>
											<input
												class="icon-mini-input"
												type="text"
												value={iconEditorDraft}
												placeholder="mdi:door-open"
												oninput={(e) => (iconEditorDraft = (e.currentTarget as HTMLInputElement).value)}
												onkeydown={(e) => {
													if (e.key === 'Enter') saveIconEditor();
													if (e.key === 'Escape') closeIconEditor();
												}}
											/>
											<div class="icon-mini-actions">
												<button type="button" class="icon-mini-btn icon-mini-btn-save" onclick={saveIconEditor} aria-label={t('save')}>
													<StatusIcon icon="mdi:check" size={12} />
												</button>
												<button type="button" class="icon-mini-btn icon-mini-btn-cancel" onclick={closeIconEditor} aria-label={t('cancel')}>
													<StatusIcon icon="mdi:close" size={12} />
												</button>
											</div>
										</div>
									{/if}
								</div>
								<div class="entity-main availability-main">
									<span>{popupLabelForEntity(entity.entityId, entity.friendlyName)}</span>
									{#if kind === 'availability_status'}
										<div class="availability-sub">{entity.state === 'unavailable' ? 'Niet bereikbaar' : (entity.state || 'Onbekend')}</div>
									{:else if kind === 'openings_status'}
										<div class="availability-sub">{formatOpeningState(entity.state)}</div>
									{:else}
										<div class="availability-sub">{formatDeviceState(entity.state)}</div>
									{/if}
								</div>
							</div>
						{/each}
					{/if}
				</div>
			{/if}
		{/if}
	</div>
</section>

<style>
	.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.36); border: 0; padding: 0; margin: 0; z-index: 40; cursor: default; }
	.np-detail.settings-modal {
		position: fixed; top: 50%; left: 50%;
		background: linear-gradient(180deg, #1a2238 0%, #0f1424 100%);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 18px; padding: 0; z-index: 60;
		transform: translate(-50%, -50%);
		overflow: hidden;
	}
	.np-detail.settings-modal::before {
		content: ''; position: absolute; top: 0; left: 50%;
		width: 60%; height: 1px;
		background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
		transform: translateX(-50%); pointer-events: none; z-index: 5;
	}

	/* Premium detail-modal header */
	.np-detail-head {
		padding: 18px 22px 14px;
		border-bottom: 0.5px solid rgba(255,255,255,0.06);
		display: flex; align-items: center; gap: 12px;
		position: relative; overflow: hidden; flex-shrink: 0;
	}
	.np-detail-head-glow {
		position: absolute; top: -100px; left: -40px;
		width: 220px; height: 220px;
		background: radial-gradient(circle, var(--np-tint, rgba(96,165,250,0.18)), transparent 70%);
		pointer-events: none; filter: blur(20px);
	}
	.np-detail-head-icon {
		width: 38px; height: 38px;
		border-radius: 10px; display: grid; place-items: center;
		background: var(--np-tint);
		border: 0.5px solid rgba(255,255,255,0.10);
		color: var(--np-color);
		flex-shrink: 0; position: relative; z-index: 1;
	}
	.np-detail-head-text { flex: 1; min-width: 0; position: relative; z-index: 1; }
	.np-detail-head-title {
		font-size: 15px; font-weight: 500;
		letter-spacing: -0.01em; line-height: 1.2;
		color: #f5f5f5;
		white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
	}
	.np-detail-head-sub { font-size: 11.5px; color: rgba(255,255,255,0.5); margin-top: 3px; }

	.app-popup {
		width: clamp(
			var(--np-popup-safe-min-width, min(26.25rem, calc(100vw - 1.5rem))),
			var(--popup-width, 850px),
			var(--np-popup-max-width, calc(100vw - 1.5rem))
		);
		height: clamp(
			var(--np-popup-safe-min-height, min(27.5rem, calc(100dvh - 1.5rem))),
			var(--popup-height, 1140px),
			var(--np-popup-max-height, calc(100dvh - 1.5rem))
		);
		max-width: var(--np-popup-max-width, calc(100vw - 1.5rem));
		max-height: var(--np-popup-max-height, calc(100dvh - 1.5rem));
		min-width: var(--np-popup-safe-min-width, min(26.25rem, calc(100vw - 1.5rem)));
		min-height: min(20rem, var(--np-popup-max-height, calc(100dvh - 1.5rem)));
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		overflow: hidden;
		box-sizing: border-box;
	}
	@supports not (height: 100dvh) {
		.app-popup {
			height: clamp(
				var(--np-popup-safe-min-height, min(27.5rem, calc(100vh - 1.5rem))),
				var(--popup-height, 1140px),
				var(--np-popup-max-height, calc(100vh - 1.5rem))
			);
			max-height: var(--np-popup-max-height, calc(100vh - 1.5rem));
			min-height: min(20rem, var(--np-popup-max-height, calc(100vh - 1.5rem)));
		}
	}
	.status-detail-modal.app-popup { grid-template-rows: auto minmax(0, 1fr); }
	.status-detail-modal {
		--green-100: #004d00;
		--green-90: #197a19;
		--green-80: #339933;
		--green-70: #66bb66;
		--green-60: #99cc99;
		--yellow-50: #cccc00;
		--orange-40: #ff9900;
		--red-30: #ff3300;
		--red-20: #cc0000;
		--red-10: #990000;
		--red-0: #660000;
	}
	.status-detail-body {
		padding: clamp(10px, 2.2vmin, 14px) clamp(12px, 2.6vmin, 22px) clamp(12px, 2.2vmin, 16px);
		min-height: 0;
	}

	/* ============================================
	 * STATUS HERO TILE — hero summary at top of body
	 * ============================================ */
	.status-hero {
		position: relative;
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: clamp(10px, 2.2cqw, 16px);
		padding: clamp(12px, 2.6cqw, 18px) clamp(14px, 3cqw, 20px);
		background:
			linear-gradient(135deg, var(--hero-accent-soft, rgba(255,255,255,0.04)), transparent 60%),
			rgba(255,255,255,0.03);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 16px;
		overflow: hidden;
		isolation: isolate;
		box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
		flex: 0 0 auto;
		min-width: 0;
	}
	.status-hero-bg {
		position: absolute;
		inset: 0;
		background: var(--hero-bg);
		filter: blur(20px);
		opacity: 0.85;
		pointer-events: none;
		z-index: 0;
		animation: hero-shift 16s ease-in-out infinite;
	}
	@keyframes hero-shift {
		0%, 100% { transform: scale(1) rotate(0deg); }
		50% { transform: scale(1.1) rotate(5deg); }
	}
	.status-hero-icon {
		position: relative;
		z-index: 1;
		width: clamp(44px, 9cqw, 56px);
		height: clamp(44px, 9cqw, 56px);
		border-radius: 16px;
		display: grid;
		place-items: center;
		background: var(--hero-accent-soft);
		border: 0.5px solid rgba(255,255,255,0.12);
		color: var(--hero-accent);
		box-shadow:
			0 0 24px var(--hero-accent-soft),
			inset 0 1px 0 rgba(255,255,255,0.10);
	}
	.status-hero-text {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.status-hero-number {
		display: flex;
		align-items: baseline;
		gap: 8px;
		min-width: 0;
	}
	.status-hero-num {
		font-size: clamp(1.9rem, 7cqw, 2.6rem);
		font-weight: 200;
		color: #fff;
		line-height: 1;
		letter-spacing: -0.03em;
		font-variant-numeric: tabular-nums;
		text-shadow: 0 2px 16px rgba(0,0,0,0.4), 0 0 24px var(--hero-accent-soft);
	}
	.status-hero-num-label {
		font-size: 13px;
		font-weight: 500;
		color: rgba(255,255,255,0.78);
		letter-spacing: -0.005em;
	}
	.status-hero-sub {
		font-size: 11.5px;
		color: rgba(255,255,255,0.55);
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-top: 2px;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}
	.status-hero-progress {
		position: relative;
		z-index: 1;
		width: 56px; height: 56px;
		display: grid;
		place-items: center;
	}
	.status-hero-progress-svg {
		position: absolute;
		inset: 0;
		width: 100%; height: 100%;
	}
	.status-hero-progress-pct {
		position: relative;
		font-size: 13px;
		font-weight: 600;
		color: #fff;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
	}
	.status-hero-extra {
		position: relative;
		z-index: 1;
		text-align: right;
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.status-hero-extra-label {
		font-size: 10.5px;
		color: rgba(255,255,255,0.55);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		line-height: 1.2;
		overflow-wrap: anywhere;
	}
	.status-hero-extra-value {
		font-size: 1.4rem;
		font-weight: 300;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.02em;
	}

	/* Per-kind active tile styling — accent border + soft glow */
	.status-detail-modal[data-kind="lights_status"] .entity-row.availability-card.popup-card-editable[data-active="1"],
	.status-detail-modal[data-kind="lights_status"] .entity-row.availability-card.entity-group-active {
		background: linear-gradient(135deg, rgba(255,211,56,0.08), transparent 60%), rgba(255,255,255,0.04);
		border-color: rgba(255,211,56,0.30);
		box-shadow: 0 0 12px rgba(255,211,56,0.10);
	}
	.status-detail-modal[data-kind="openings_status"] .entity-row.availability-card.popup-card-editable[data-active="1"] {
		background: linear-gradient(135deg, rgba(96,165,250,0.10), transparent 60%), rgba(255,255,255,0.04);
		border-color: rgba(96,165,250,0.32);
		box-shadow: 0 0 12px rgba(96,165,250,0.12);
	}
	.status-detail-modal[data-kind="devices_status"] .entity-row.availability-card.popup-card-editable[data-active="1"] {
		background: linear-gradient(135deg, rgba(52,211,153,0.08), transparent 60%), rgba(255,255,255,0.04);
		border-color: rgba(52,211,153,0.30);
		box-shadow: 0 0 12px rgba(52,211,153,0.10);
	}
	.status-detail-modal[data-kind="availability_status"] .entity-row.availability-card.popup-card-editable[data-active="1"] {
		background: linear-gradient(135deg, rgba(248,113,113,0.08), transparent 60%), rgba(255,255,255,0.04);
		border-color: rgba(248,113,113,0.30);
		box-shadow: 0 0 12px rgba(248,113,113,0.12);
	}
	.status-detail-body {
		margin-top: 0.45rem;
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		overflow: hidden;
		scrollbar-width: none;
		-ms-overflow-style: none;
		min-height: 0;
		height: 100%;
		flex: 1;
		container-type: inline-size;
	}
	.status-detail-body::-webkit-scrollbar { width: 0; height: 0; display: none; }
	.status-detail-body > .status-hero,
	.status-detail-body > .np-detail-tabs,
	.status-detail-body > .np-detail-error {
		flex: 0 0 auto;
	}
	.status-detail-body > .entity-list {
		flex: 1 1 0;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		touch-action: pan-y;
		padding-right: 0.1rem;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}
	.status-detail-body > .entity-list::-webkit-scrollbar {
		width: 0;
		height: 0;
		display: none;
	}
	.entity-list { display: grid; gap: 0.45rem; align-content: start; min-width: 0; min-height: 0; max-width: 100%; }
	.entity-list:has(.availability-all-ok) { display: flex; flex: 1; min-height: 0; align-items: center; justify-content: center; }
	.availability-grid {
		grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr));
		align-items: start;
	}
	.media-players-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		align-items: start;
	}
	.entity-row { display: flex; justify-content: space-between; gap: 0.7rem; align-items: center; background: rgba(255,255,255,0.04); border-radius: 0.4rem; padding: 0.5rem 0.6rem; min-width: 0; box-sizing: border-box; }
	.availability-card {
		gap: 12px;
		padding: 12px 14px;
		background: rgba(255,255,255,0.025);
		border-radius: 13px;
		border: 0.5px solid rgba(255,255,255,0.07);
		min-height: 4.35rem;
		min-width: 0;
		box-sizing: border-box;
		transition: border-color 0.2s, background 0.2s, transform 0.2s;
	}
	.entity-row.availability-card.entity-row-toggleable {
		cursor: pointer;
	}
	.entity-row.availability-card.entity-row-toggleable:hover {
		background: rgba(255, 255, 255, 0.045);
		border-color: rgba(255, 255, 255, 0.13);
		transform: translateY(-1px);
	}
	.entity-row.availability-card.entity-group-active {
		background: linear-gradient(135deg, rgba(96,165,250,0.05), transparent 60%), rgba(255,255,255,0.035);
		border-color: rgba(96,165,250,0.20);
	}
	.availability-cover {
		width: 3rem;
		height: 3rem;
		border-radius: 0.5rem;
		background: rgba(255,255,255,0.08);
		display: grid;
		place-items: center;
		color: rgba(255,255,255,0.55);
		flex: 0 0 auto;
	}
	.availability-cover-wrap { position: relative; flex: 0 0 auto; }
	.icon-mini-editor {
		position: absolute;
		top: calc(100% + 0.3rem);
		left: 0;
		width: 6.6rem;
		z-index: 6;
		background: #182132;
		border: 1px solid rgba(255,255,255,0.12);
		border-radius: 0.45rem;
		padding: 0.35rem;
		display: grid;
		gap: 0.3rem;
		box-shadow: 0 6px 18px rgba(0,0,0,0.35);
	}
	.icon-mini-preview {
		width: 100%;
		height: 2.1rem;
		border-radius: 0.35rem;
		background: rgba(255,255,255,0.08);
		display: grid;
		place-items: center;
		color: rgba(255,255,255,0.8);
	}
	.icon-mini-input {
		width: 100%;
		height: 1.8rem;
		border-radius: 0.35rem;
		border: 0;
		background: rgba(255,255,255,0.08);
		color: #f5f5f5;
		padding: 0 0.4rem;
		font-size: 0.72rem;
		box-sizing: border-box;
	}
	.icon-mini-actions { display: flex; gap: 0.25rem; justify-content: flex-end; }
	.icon-mini-btn {
		width: 1.4rem;
		height: 1.4rem;
		border: 0;
		border-radius: 0.3rem;
		display: grid;
		place-items: center;
		cursor: pointer;
		padding: 0;
		line-height: 0;
	}
	.icon-mini-btn-save { background: #c89d1b; color: #fff; }
	.icon-mini-btn-cancel { background: rgba(255,255,255,0.12); color: #f5f5f5; }
	.availability-cover-battery { color: var(--green-90); }
	.availability-cover-battery.battery-tone-100 { color: var(--green-100); }
	.availability-cover-battery.battery-tone-90 { color: var(--green-90); }
	.availability-cover-battery.battery-tone-80 { color: var(--green-80); }
	.availability-cover-battery.battery-tone-70 { color: var(--green-70); }
	.availability-cover-battery.battery-tone-60 { color: var(--green-60); }
	.availability-cover-battery.battery-tone-50 { color: var(--yellow-50); }
	.availability-cover-battery.battery-tone-40 { color: var(--orange-40); }
	.availability-cover-battery.battery-tone-30 { color: var(--red-30); }
	.availability-cover-battery.battery-tone-20 { color: var(--red-20); }
	.availability-cover-battery.battery-tone-10 { color: var(--red-10); }
	.availability-cover-battery.battery-tone-0 { color: var(--red-0); }
	.entity-main { min-width: 0; display: grid; gap: 3px; }
	.availability-main { align-content: center; justify-items: start; text-align: left; flex: 1; min-width: 0; width: 100%; }
	.availability-main span {
		width: 100%;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: normal;
		line-height: 1.15;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow-wrap: anywhere;
	}
	.availability-sub {
		font-size: 11.5px;
		color: rgba(255,255,255,0.55);
		font-weight: 400;
		width: 100%;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.entity-main span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: normal; overflow-wrap: anywhere; }
	.entity-main .entity-name { font-size: 13px; font-weight: 500; color: #f5f5f5; letter-spacing: -0.005em; }
	.entity-state {
		font-size: 11.5px;
		color: rgba(255,255,255,0.55);
		font-weight: 400;
		width: 100%;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.entity-actions { display: flex; gap: 0.3rem; align-items: center; justify-content: flex-end; }
	@container (max-width: 540px) {
		.status-hero { grid-template-columns: auto minmax(0, 1fr); }
		.status-hero-extra {
			grid-column: 1 / -1;
			text-align: left;
			flex-direction: row;
			align-items: baseline;
			justify-content: space-between;
			gap: 0.75rem;
		}
		.availability-grid { grid-template-columns: 1fr; }
		.availability-card { min-height: 4rem; padding: 10px 12px; }
		.availability-cover {
			width: 2.75rem;
			height: 2.75rem;
		}
	}
	@media (max-width: 1100px) {
		.availability-grid { grid-template-columns: repeat(auto-fit, minmax(min(15rem, 100%), 1fr)); }
	}
	@media (max-width: 700px) {
		.availability-grid { grid-template-columns: 1fr; }
	}
	.empty-row { opacity: 0.68; }
	.area-header { font-size: 10.5px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.35); padding: 8px 4px 2px; grid-column: 1 / -1; }
	.entity-group-active { background: rgba(250,204,21,0.06); }
	.entity-group-active .availability-cover { color: #facc15; }
	.availability-all-ok { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; padding: 0; text-align: center; height: 100%; min-height: 16rem; }
	.availability-ok-icon { color: #4ade80; filter: drop-shadow(0 0 16px rgba(74,222,128,0.5)); }
	.availability-ok-title { font-size: 1.2rem; font-weight: 600; color: #f5f5f5; }
	.availability-ok-sub { font-size: 0.85rem; opacity: 0.5; }
</style>
