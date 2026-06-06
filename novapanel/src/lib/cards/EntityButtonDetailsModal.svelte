<script lang="ts">
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import { entityStore } from '$lib/ha/entities-store';
	import { callHaService } from '$lib/ha/service-call';
	import type { HomeAssistantEntity } from '$lib/ha/entities-service';
	import { browserSafeHomeAssistantUrl, getNovaApiUrl } from '$lib/ha/entities-service-helpers';
	import type { EntityButtonKind } from '$lib/cards/entity-button-types';
	import { selectedLanguageStore, translate, translateState } from '$lib/i18n';
	import { modalBehavior } from '$lib/modal/modal-behavior';

	type Props = {
		kind: EntityButtonKind;
		title?: string;
		entityId?: string;
		icon?: string;
		onClose: () => void;
	};

	let { kind, title = '', entityId, icon, onClose }: Props = $props();
	let busy = $state(false);
	let error = $state('');
	let temperatureDraft = $state(20);
	let positionDraft = $state(0);
	let volumeDraft = $state(0);
	let draggingTemperature = $state(false);
	let draggingPosition = $state(false);
	let draggingVolume = $state(false);
	let vacuumMapImageFailed = $state(false);
	let temperatureTimer: ReturnType<typeof setTimeout> | null = null;
	let positionTimer: ReturnType<typeof setTimeout> | null = null;
	let volumeTimer: ReturnType<typeof setTimeout> | null = null;

	const entity = $derived(
		$entityStore.entities.find((entry: HomeAssistantEntity) => entry.entityId === (entityId ?? ''))
	);
	const entityState = $derived((entity?.state ?? '').toLowerCase());
	const isUnavailable = $derived(!entity || entityState === 'unavailable' || entityState === 'unknown');
	const serviceDomain = $derived((entity?.domain || entityId?.split('.')[0] || '').toLowerCase());
	const displayName = $derived(
		title && title.trim().length > 0 ? title.trim() : (entity?.friendlyName ?? entityId ?? fallbackName(kind))
	);
	const accent = $derived(accentForKind(kind));
	const accentSoft = $derived(softAccentForKind(kind));

	const currentTemperature = $derived(numericAttribute(entity, 'current_temperature'));
	const targetTemperature = $derived(numericAttribute(entity, 'temperature'));
	const hasTargetTemperature = $derived(targetTemperature !== null);
	const minTemperature = $derived(numericAttribute(entity, 'min_temp') ?? 5);
	const maxTemperature = $derived(numericAttribute(entity, 'max_temp') ?? 35);
	const temperatureStep = $derived(numericAttribute(entity, 'target_temp_step') ?? 0.5);
	const hvacModes = $derived(stringListAttribute(entity, 'hvac_modes'));
	const presetModes = $derived(stringListAttribute(entity, 'preset_modes'));
	const rawCoverPosition = $derived(numericAttribute(entity, 'current_position'));
	const currentPosition = $derived(
		rawCoverPosition !== null
			? clampPercent(rawCoverPosition)
			: entityState === 'open' || entityState === 'opening'
				? 100
				: 0
	);
	const cardIcon = $derived(iconForEntity(kind, icon, rawCoverPosition, entityState));
	const batteryLevel = $derived(numericAttribute(entity, 'battery_level'));
	const fanSpeeds = $derived(stringListAttribute(entity, 'fan_speed_list'));
	const currentFanSpeed = $derived(stringAttribute(entity, 'fan_speed'));
	const volumeLevel = $derived(Math.round((numericAttribute(entity, 'volume_level') ?? 0) * 100));
	const isMuted = $derived(entity?.attributes?.is_volume_muted === true);
	const sources = $derived(stringListAttribute(entity, 'source_list'));
	const currentSource = $derived(stringAttribute(entity, 'source'));
	const mediaTitle = $derived(stringAttribute(entity, 'media_title'));
	const mediaArtist = $derived(stringAttribute(entity, 'media_artist'));
	const stateLabel = $derived(summaryLabel());
	const vacuumArea = $derived(
		numericAttribute(entity, 'cleaned_area') ?? numericAttribute(entity, 'cleaning_area')
	);
	const vacuumDuration = $derived(
		numericAttribute(entity, 'cleaning_time') ?? numericAttribute(entity, 'cleaning_duration')
	);
	const vacuumMapCamera = $derived.by(() => {
		if (kind !== 'vacuum') return null as HomeAssistantEntity | null;
		const all = $entityStore.entities;
		const vacuumTokens = tokensForMapMatch(entityId, displayName);
		const cameras = all.filter(
			(entry) => entry.domain === 'camera' || entry.entityId.toLowerCase().includes('map')
		);
		return cameras.find((entry) => isVacuumMapCandidate(entry, vacuumTokens)) ?? null;
	});
	const vacuumMapImageUrl = $derived.by(() => {
		if (kind !== 'vacuum') return '';
		const direct = firstStringAttribute(entity, [
			'map_image',
			'map_url',
			'map',
			'map_picture',
			'map_snapshot',
			'snapshot_image',
			'image_url',
			'entity_picture'
		]);
		if (direct) return browserSafeHomeAssistantUrl(direct);
		const cameraPicture = firstStringAttribute(vacuumMapCamera ?? undefined, ['entity_picture']);
		if (cameraPicture) return browserSafeHomeAssistantUrl(cameraPicture);
		return vacuumMapCamera
			? getNovaApiUrl(`/api/camera_proxy/${encodeURIComponent(vacuumMapCamera.entityId)}`)
			: '';
	});
	const vacuumMapTitle = $derived(
		vacuumMapCamera?.friendlyName ?? translate('Kaart', $selectedLanguageStore)
	);

	$effect(() => {
		vacuumMapImageUrl;
		vacuumMapImageFailed = false;
	});

	$effect(() => {
		if (!draggingTemperature && targetTemperature !== null) temperatureDraft = targetTemperature;
	});

	$effect(() => {
		if (!draggingPosition) positionDraft = currentPosition;
	});

	$effect(() => {
		if (!draggingVolume) volumeDraft = volumeLevel;
	});

	$effect(() => {
		return () => {
			if (temperatureTimer) clearTimeout(temperatureTimer);
			if (positionTimer) clearTimeout(positionTimer);
			if (volumeTimer) clearTimeout(volumeTimer);
		};
	});

	function fallbackName(value: EntityButtonKind) {
		if (value === 'device') return translate('Apparaat', $selectedLanguageStore);
		if (value === 'climate') return 'Climate';
		if (value === 'cover') return translate('Gordijn', $selectedLanguageStore);
		if (value === 'vacuum') return translate('Stofzuiger', $selectedLanguageStore);
		return translate('Media player', $selectedLanguageStore);
	}

	function fallbackIcon(value: EntityButtonKind) {
		if (value === 'device') return 'mdi:power-plug-outline';
		if (value === 'climate') return 'mdi:thermostat';
		if (value === 'cover') return 'mdi:blinds-horizontal';
		if (value === 'vacuum') return 'mdi:robot-vacuum';
		return 'mdi:speaker';
	}

	function isCoverClosed(position: number | null, coverState: string) {
		if (position !== null) {
			return Math.round(clampPercent(position)) <= 0;
		}
		return coverState === 'closed' || coverState === 'closing';
	}

	function coverIconForState(
		position: number | null,
		coverState: string,
		configuredIcon: string | undefined
	) {
		const configured = (configuredIcon ?? '').trim();
		const normalized = configured.toLowerCase().replace(/^mdi:/, '');
		const closed = isCoverClosed(position, coverState);
		if (normalized.includes('blinds-horizontal'))
			return closed ? 'mdi:blinds-horizontal-closed' : 'mdi:blinds-horizontal';
		if (normalized.includes('blinds')) return closed ? 'mdi:blinds' : 'mdi:blinds-open';
		if (normalized.includes('window-shutter'))
			return closed ? 'mdi:window-shutter' : 'mdi:window-shutter-open';
		if (normalized && !normalized.includes('curtains')) return configured;
		if (normalized.includes('curtains')) return closed ? 'mdi:curtains-closed' : 'mdi:curtains';
		return closed ? 'mdi:blinds-horizontal-closed' : 'mdi:blinds-horizontal';
	}

	function iconForEntity(
		value: EntityButtonKind,
		configuredIcon: string | undefined,
		position: number | null,
		currentState: string
	) {
		if (value === 'cover') return coverIconForState(position, currentState, configuredIcon);
		if (value === 'device' && serviceDomain === 'lock') {
			const configured = (configuredIcon ?? '').trim();
			if (configured.length > 0) return configured;
			return currentState === 'unlocked' || currentState === 'unlocking'
				? 'mdi:lock-open-outline'
				: 'mdi:lock-outline';
		}
		return configuredIcon && configuredIcon.trim().length > 0 ? configuredIcon.trim() : fallbackIcon(value);
	}

	function accentForKind(value: EntityButtonKind) {
		if (value === 'device') return '#34d399';
		if (value === 'climate') return '#fb923c';
		if (value === 'cover') return '#60a5fa';
		if (value === 'vacuum') return '#34d399';
		return '#c084fc';
	}

	function softAccentForKind(value: EntityButtonKind) {
		if (value === 'device') return 'rgba(52,211,153,0.18)';
		if (value === 'climate') return 'rgba(251,146,60,0.18)';
		if (value === 'cover') return 'rgba(96,165,250,0.18)';
		if (value === 'vacuum') return 'rgba(52,211,153,0.18)';
		return 'rgba(192,132,252,0.18)';
	}

	function numericAttribute(entry: HomeAssistantEntity | undefined, key: string): number | null {
		const raw = entry?.attributes?.[key];
		return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
	}

	function stringAttribute(entry: HomeAssistantEntity | undefined, key: string): string {
		const raw = entry?.attributes?.[key];
		return typeof raw === 'string' ? raw : '';
	}

	function firstStringAttribute(entry: HomeAssistantEntity | undefined, keys: string[]): string {
		for (const key of keys) {
			const raw = entry?.attributes?.[key];
			if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
		}
		return '';
	}

	function stringListAttribute(entry: HomeAssistantEntity | undefined, key: string): string[] {
		const raw = entry?.attributes?.[key];
		return Array.isArray(raw) ? raw.map(String).filter((value) => value.trim().length > 0) : [];
	}

	function clampPercent(value: number): number {
		return Math.max(0, Math.min(100, value));
	}

	function tokensForMapMatch(id: string | undefined, name: string): string[] {
		return `${id ?? ''} ${name ?? ''}`
			.toLowerCase()
			.replace(/sensor|vacuum|camera|map|kaart|entity|robot|stofzuiger/g, ' ')
			.split(/[^a-z0-9]+/i)
			.map((token) => token.trim())
			.filter((token) => token.length >= 3);
	}

	function isVacuumMapCandidate(entry: HomeAssistantEntity, vacuumTokens: string[]): boolean {
		const attrs = entry.attributes ?? {};
		const haystack =
			`${entry.entityId} ${entry.friendlyName} ${String(attrs.device_class ?? '')} ${String(attrs.icon ?? '')}`.toLowerCase();
		const mentionsMap = /\b(map|kaart|plattegrond)\b/.test(haystack);
		const mentionsVacuum = /\b(vacuum|robo|roborock|robovac|stofzuiger)\b/.test(haystack);
		if (mentionsMap && (mentionsVacuum || vacuumTokens.some((token) => haystack.includes(token))))
			return true;
		const picture = firstStringAttribute(entry, [
			'entity_picture',
			'map_image',
			'map_url',
			'image_url'
		]).toLowerCase();
		return mentionsMap && picture.length > 0;
	}

	function readableState(value: string) {
		return translateState(value, $selectedLanguageStore);
	}

	function summaryLabel() {
		if (isUnavailable) return translate('Niet beschikbaar', $selectedLanguageStore);
		if (kind === 'device') return readableState(entityState);
		if (kind === 'climate') {
			if (currentTemperature !== null) return `${readableState(entityState)} · ${currentTemperature}°`;
			return readableState(entityState);
		}
		if (kind === 'cover') return coverStatusLabel();
		if (kind === 'vacuum') {
			return batteryLevel !== null
				? `${readableState(entityState)} · ${Math.round(batteryLevel)}%`
				: readableState(entityState);
		}
		return mediaTitle || readableState(entityState);
	}

	function parseRange(event: Event): number {
		return Number((event.currentTarget as HTMLInputElement).value);
	}

	async function callService(domain: string, service: string, data: Record<string, unknown> = {}) {
		if (!entityId || busy) return;
		busy = true;
		error = '';
		try {
			await callHaService(domain, service, { entity_id: entityId, ...data });
		} catch (err) {
			error =
				err instanceof Error && err.message
					? err.message
					: translate('Actie mislukt', $selectedLanguageStore);
		} finally {
			busy = false;
		}
	}

	function lockServiceForState(targetUnlocked: boolean): 'lock' | 'unlock' {
		return targetUnlocked ? 'unlock' : 'lock';
	}

	function scheduleTemperature(value: number, delay = 140) {
		if (temperatureTimer) clearTimeout(temperatureTimer);
		temperatureTimer = setTimeout(() => {
			temperatureTimer = null;
			void callService('climate', 'set_temperature', { temperature: Number(value.toFixed(1)) });
		}, delay);
	}

	function schedulePosition(value: number, delay = 140) {
		if (positionTimer) clearTimeout(positionTimer);
		positionTimer = setTimeout(() => {
			positionTimer = null;
			const openPct = clampPercent(Math.round(value));
			void callService('cover', 'set_cover_position', { position: openPct });
		}, delay);
	}

	function scheduleVolume(value: number, delay = 100) {
		if (volumeTimer) clearTimeout(volumeTimer);
		volumeTimer = setTimeout(() => {
			volumeTimer = null;
			void callService('media_player', 'volume_set', { volume_level: Math.max(0, Math.min(1, value / 100)) });
		}, delay);
	}

	function onTemperatureInput(event: Event) {
		const value = parseRange(event);
		temperatureDraft = value;
		scheduleTemperature(value);
	}

	function onVolumeInput(event: Event) {
		const value = parseRange(event);
		volumeDraft = value;
		scheduleVolume(value);
	}

	function updatePositionFromPointer(event: PointerEvent, immediate = false) {
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		if (rect.height <= 0) return;
		const pct = ((rect.bottom - event.clientY) / rect.height) * 100;
		const rounded = clampPercent(Math.round(pct));
		positionDraft = rounded;
		schedulePosition(rounded, immediate ? 0 : 120);
	}

	function startPositionDrag(event: PointerEvent) {
		if (busy || isUnavailable) return;
		draggingPosition = true;
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
		updatePositionFromPointer(event);
	}

	function movePositionDrag(event: PointerEvent) {
		if (!draggingPosition) return;
		updatePositionFromPointer(event);
	}

	function endPositionDrag(event: PointerEvent) {
		if (!draggingPosition) return;
		updatePositionFromPointer(event, true);
		draggingPosition = false;
		(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
	}

	function coverStatusLabel() {
		const pct = Math.round(currentPosition);
		const label = readableState(entityState);
		return rawCoverPosition !== null ? `${label} · ${pct}% open` : label;
	}
</script>

<button
	type="button"
	class="modal-overlay entity-modal-overlay"
	onclick={onClose}
	aria-label={translate('close', $selectedLanguageStore)}
></button>
<div
	class="settings-modal app-popup entity-detail-modal np-detail"
	class:vacuum-detail={kind === 'vacuum'}
	role="dialog"
	aria-modal="true"
	aria-label={displayName}
	use:modalBehavior={{ onClose }}
	style={`--entity-accent: ${accent}; --entity-soft: ${accentSoft};`}
>
	<div class="np-detail-head" style={`--np-tint: ${accentSoft}; --np-color: ${accent};`}>
		<div class="np-detail-head-glow" aria-hidden="true"></div>
		<div class="np-detail-head-icon"><StatusIcon icon={cardIcon} size={24} /></div>
		<div class="np-detail-head-text">
			<div class="np-detail-head-title">{displayName}</div>
			<div class="np-detail-head-sub">{stateLabel}</div>
		</div>
	</div>

	<div class="entity-detail-body">
		{#if !entity}
			<div class="entity-empty">
				<StatusIcon icon={cardIcon} size={46} />
				<span>{translate('Geen entiteit gekoppeld', $selectedLanguageStore)}</span>
			</div>
		{:else if kind === 'device'}
			<div class="vacuum-status">
				<div>
					<span>{translate('Status', $selectedLanguageStore)}</span>
					<strong>{readableState(entityState)}</strong>
				</div>
				<div>
					<span>{translate('Domein', $selectedLanguageStore)}</span>
					<strong>{serviceDomain || '--'}</strong>
				</div>
			</div>
			<div class="action-row">
				{#if serviceDomain === 'lock'}
					<button
						type="button"
						class="np-btn ghost"
						onclick={() => void callService('lock', lockServiceForState(false))}
						disabled={busy || isUnavailable}>{translate('Vergrendelen', $selectedLanguageStore)}</button
					>
					<button
						type="button"
						class="np-btn primary"
						onclick={() => void callService('lock', lockServiceForState(true))}
						disabled={busy || isUnavailable}>{translate('Ontgrendelen', $selectedLanguageStore)}</button
					>
				{:else}
					<button
						type="button"
						class="np-btn ghost"
						onclick={() => void callService(serviceDomain || 'switch', 'turn_off')}
						disabled={busy || isUnavailable}>{translate('Uit', $selectedLanguageStore)}</button
					>
					<button
						type="button"
						class="np-btn primary"
						onclick={() => void callService(serviceDomain || 'switch', 'turn_on')}
						disabled={busy || isUnavailable}>{translate('Aan', $selectedLanguageStore)}</button
					>
				{/if}
			</div>
		{:else if kind === 'climate'}
			<div class="climate-temp-readout">
				<span>{currentTemperature !== null ? `${currentTemperature}°` : '--°'}</span>
				<small>{translate('Nu', $selectedLanguageStore)}</small>
			</div>
			{#if hasTargetTemperature}
				<label class="entity-control">
					<span class="control-head">
						<span>{translate('Doeltemperatuur', $selectedLanguageStore)}</span>
						<strong>{temperatureDraft}°</strong>
					</span>
					<input
						type="range"
						min={minTemperature}
						max={maxTemperature}
						step={temperatureStep}
						value={temperatureDraft}
						onpointerdown={() => (draggingTemperature = true)}
						onpointerup={() => (draggingTemperature = false)}
						oninput={onTemperatureInput}
						onchange={(event) => scheduleTemperature(parseRange(event), 0)}
						disabled={busy || isUnavailable}
					/>
				</label>
			{:else}
				<div class="entity-control">
					<span class="control-head">
						<span>{translate('Doeltemperatuur', $selectedLanguageStore)}</span>
						<strong>--°</strong>
					</span>
					<small>{translate('Geen doeltemperatuur beschikbaar', $selectedLanguageStore)}</small>
				</div>
			{/if}
			{#if hvacModes.length > 0}
				<label class="entity-control">
					<span class="control-head"><span>{translate('Modus', $selectedLanguageStore)}</span></span>
					<select
						value={entityState}
						onchange={(event) =>
							void callService('climate', 'set_hvac_mode', {
								hvac_mode: (event.currentTarget as HTMLSelectElement).value
							})}
						disabled={busy || isUnavailable}
					>
						{#each hvacModes as mode (mode)}
							<option value={mode}>{readableState(mode)}</option>
						{/each}
					</select>
				</label>
			{/if}
			{#if presetModes.length > 0}
				<label class="entity-control">
					<span class="control-head"><span>{translate('Preset', $selectedLanguageStore)}</span></span>
					<select
						value={stringAttribute(entity, 'preset_mode')}
						onchange={(event) =>
							void callService('climate', 'set_preset_mode', {
								preset_mode: (event.currentTarget as HTMLSelectElement).value
							})}
						disabled={busy || isUnavailable}
					>
						<option value="">{translate('Geen preset', $selectedLanguageStore)}</option>
						{#each presetModes as preset (preset)}
							<option value={preset}>{preset}</option>
						{/each}
					</select>
				</label>
			{/if}
			<div class="action-row">
				<button
					type="button"
					class="np-btn ghost"
					onclick={() => void callService('climate', 'turn_off')}
					disabled={busy || isUnavailable}>{translate('Uit', $selectedLanguageStore)}</button
				>
				<button
					type="button"
					class="np-btn primary"
					onclick={() => void callService('climate', 'turn_on')}
					disabled={busy || isUnavailable}>{translate('Aan', $selectedLanguageStore)}</button
				>
			</div>
		{:else if kind === 'cover'}
			<div class="cover-position-wrap">
				<button
					type="button"
					class="cover-position-pill"
					class:is-empty={positionDraft <= 0}
					aria-label={`${translate('Gordijn', $selectedLanguageStore)} ${Math.round(positionDraft)} ${translate('procent', $selectedLanguageStore)} ${translate('Open', $selectedLanguageStore)}`}
					style={`--cover-position-pct: ${Math.round(positionDraft)}%;`}
					disabled={busy || isUnavailable}
					onpointerdown={startPositionDrag}
					onpointermove={movePositionDrag}
					onpointerup={endPositionDrag}
					onpointercancel={endPositionDrag}
				>
					<span class="cover-position-fill" aria-hidden="true"></span>
					<span class="cover-position-icon" aria-hidden="true">
						<StatusIcon icon={cardIcon} size={52} />
					</span>
				</button>
				<div class="cover-position-label">
					<strong>{readableState(entityState)}</strong>
				</div>
			</div>
			<div class="action-grid">
				<button
					type="button"
					class="control-action"
					onclick={() => void callService('cover', 'open_cover')}
					disabled={busy || isUnavailable}
				>
					<TablerIcon name="arrow-up" size={16} />
					{translate('Open', $selectedLanguageStore)}
				</button>
				<button
					type="button"
					class="control-action"
					onclick={() => void callService('cover', 'stop_cover')}
					disabled={busy || isUnavailable}
				>
					<TablerIcon name="player-stop" size={16} />
					Stop
				</button>
				<button
					type="button"
					class="control-action"
					onclick={() => void callService('cover', 'close_cover')}
					disabled={busy || isUnavailable}
				>
					<TablerIcon name="arrow-down" size={16} />
					{translate('Dicht', $selectedLanguageStore)}
				</button>
			</div>
		{:else if kind === 'vacuum'}
			<div class="vacuum-map-card">
				<div class="vacuum-map-head">
					<span>{vacuumMapTitle}</span>
					{#if vacuumMapCamera}
						<strong>{translate('Live', $selectedLanguageStore)}</strong>
					{/if}
				</div>
				{#if vacuumMapImageUrl && !vacuumMapImageFailed}
					<img
						class="vacuum-map-image"
						src={vacuumMapImageUrl}
						alt={vacuumMapTitle}
						onerror={() => (vacuumMapImageFailed = true)}
					/>
				{:else}
					<div class="vacuum-map-fallback" aria-hidden="true">
						<span class="room room-living"></span>
						<span class="room room-kitchen"></span>
						<span class="room room-hall"></span>
						<span class="room room-office"></span>
						<span class="vacuum-path"></span>
						<span class="vacuum-dot"></span>
						<span class="dock-dot"></span>
					</div>
				{/if}
			</div>
			<div class="vacuum-status">
				<div>
					<span>{translate('Status', $selectedLanguageStore)}</span>
					<strong>{readableState(entityState)}</strong>
				</div>
				<div>
					<span>{translate('Batterij', $selectedLanguageStore)}</span>
					<strong>{batteryLevel !== null ? `${Math.round(batteryLevel)}%` : '--'}</strong>
				</div>
				<div>
					<span>{translate('Oppervlak', $selectedLanguageStore)}</span>
					<strong>{vacuumArea !== null ? `${Math.round(vacuumArea)} m²` : '--'}</strong>
				</div>
				<div>
					<span>{translate('Tijd', $selectedLanguageStore)}</span>
					<strong>{vacuumDuration !== null ? `${Math.round(vacuumDuration)} min` : '--'}</strong>
				</div>
			</div>
			<div class="action-grid vacuum-action-grid">
				<button
					type="button"
					class="control-action"
					onclick={() => void callService('vacuum', 'start')}
					disabled={busy || isUnavailable}
				>
					<TablerIcon name="player-play" size={16} />
					Start
				</button>
				<button
					type="button"
					class="control-action"
					onclick={() => void callService('vacuum', 'pause')}
					disabled={busy || isUnavailable}
				>
					<TablerIcon name="player-pause" size={16} />
					{translate('Pauze', $selectedLanguageStore)}
				</button>
				<button
					type="button"
					class="control-action"
					onclick={() => void callService('vacuum', 'return_to_base')}
					disabled={busy || isUnavailable}
				>
					<TablerIcon name="home" size={16} />
					Dock
				</button>
				<button
					type="button"
					class="control-action"
					onclick={() => void callService('vacuum', 'locate')}
					disabled={busy || isUnavailable}
				>
					<TablerIcon name="radar" size={16} />
					{translate('Zoek', $selectedLanguageStore)}
				</button>
			</div>
			{#if fanSpeeds.length > 0}
				<label class="entity-control">
					<span class="control-head"><span>{translate('Zuigkracht', $selectedLanguageStore)}</span></span>
					<select
						value={currentFanSpeed}
						onchange={(event) =>
							void callService('vacuum', 'set_fan_speed', {
								fan_speed: (event.currentTarget as HTMLSelectElement).value
							})}
						disabled={busy || isUnavailable}
					>
						{#each fanSpeeds as speed (speed)}
							<option value={speed}>{speed}</option>
						{/each}
					</select>
				</label>
			{/if}
		{:else if kind === 'media_player'}
			<div class="media-now">
				<div class="media-cover">
					<StatusIcon icon={cardIcon} size={42} />
				</div>
				<div>
					<strong>{mediaTitle || readableState(entityState)}</strong>
					<span>{mediaArtist || currentSource || translate('Media player', $selectedLanguageStore)}</span>
				</div>
			</div>
			<div class="media-controls">
				<button
					type="button"
					class="round-action"
					onclick={() => void callService('media_player', 'media_previous_track')}
					disabled={busy || isUnavailable}
					aria-label={translate('Vorige', $selectedLanguageStore)}
				>
					<TablerIcon name="player-skip-back" size={17} />
				</button>
				<button
					type="button"
					class="round-action primary"
					onclick={() =>
						void callService('media_player', entityState === 'playing' ? 'media_pause' : 'media_play')}
					disabled={busy || isUnavailable}
					aria-label={translate('Afspelen of pauzeren', $selectedLanguageStore)}
				>
					<TablerIcon name={entityState === 'playing' ? 'player-pause' : 'player-play'} size={20} />
				</button>
				<button
					type="button"
					class="round-action"
					onclick={() => void callService('media_player', 'media_next_track')}
					disabled={busy || isUnavailable}
					aria-label={translate('Volgende', $selectedLanguageStore)}
				>
					<TablerIcon name="player-skip-forward" size={17} />
				</button>
			</div>
			<label class="entity-control">
				<span class="control-head">
					<span>{translate('volume', $selectedLanguageStore)}</span>
					<strong>{Math.round(volumeDraft)}%</strong>
				</span>
				<input
					type="range"
					min="0"
					max="100"
					step="1"
					value={volumeDraft}
					onpointerdown={() => (draggingVolume = true)}
					onpointerup={() => (draggingVolume = false)}
					oninput={onVolumeInput}
					onchange={(event) => scheduleVolume(parseRange(event), 0)}
					disabled={busy || isUnavailable}
				/>
			</label>
			<div class="action-row">
				<button
					type="button"
					class="np-btn ghost"
					onclick={() => void callService('media_player', 'volume_mute', { is_volume_muted: !isMuted })}
					disabled={busy || isUnavailable}
				>
					{isMuted ? 'Unmute' : 'Mute'}
				</button>
				<button
					type="button"
					class="np-btn ghost"
					onclick={() => void callService('media_player', entityState === 'off' ? 'turn_on' : 'turn_off')}
					disabled={busy || isUnavailable}
				>
					{entityState === 'off'
						? translate('Aan', $selectedLanguageStore)
						: translate('Uit', $selectedLanguageStore)}
				</button>
			</div>
			{#if sources.length > 0}
				<label class="entity-control">
					<span class="control-head"><span>{translate('Bron', $selectedLanguageStore)}</span></span>
					<select
						value={currentSource}
						onchange={(event) =>
							void callService('media_player', 'select_source', {
								source: (event.currentTarget as HTMLSelectElement).value
							})}
						disabled={busy || isUnavailable}
					>
						{#each sources as source (source)}
							<option value={source}>{source}</option>
						{/each}
					</select>
				</label>
			{/if}
		{/if}

		{#if error}
			<div class="entity-error">{error}</div>
		{/if}
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 40;
		margin: 0;
		padding: 0;
		border: 0;
		background: rgba(0, 0, 0, 0.36);
	}
	.entity-detail-modal {
		--popup-width: var(--np-detail-popup-width, min(850px, calc(100vw - 1.5rem)));
		--popup-height: var(--np-detail-popup-height, min(1140px, calc(100vh - 1.5rem)));
		z-index: 50;
		padding: 0 !important;
		width: min(var(--popup-width, 850px), calc(100vw - 1.5rem));
		height: min(var(--popup-height, 1140px), calc(100vh - 1.5rem));
		max-height: calc(100vh - 1.5rem);
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		border: 0.5px solid rgba(255, 255, 255, 0.08);
		border-radius: 18px;
		background:
			radial-gradient(circle at 50% 8%, var(--entity-soft), transparent 42%),
			linear-gradient(180deg, #1a2238 0%, #0f1424 100%);
		overflow: hidden;
		box-sizing: border-box;
	}
	.entity-detail-modal::before {
		content: '';
		position: absolute;
		top: 0;
		left: 50%;
		width: 60%;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.12), transparent);
		transform: translateX(-50%);
		pointer-events: none;
		z-index: 5;
	}
	.entity-detail-body {
		min-height: 0;
		overflow: auto;
		padding: 1rem;
		display: grid;
		gap: 0.9rem;
		align-content: start;
		scrollbar-width: none;
	}
	.entity-detail-body::-webkit-scrollbar {
		display: none;
	}
	.entity-empty {
		min-height: 14rem;
		display: grid;
		place-items: center;
		gap: 0.55rem;
		color: rgba(255, 255, 255, 0.48);
	}
	.climate-temp-readout {
		display: grid;
		place-items: center;
		padding: 1rem;
		border-radius: 0.9rem;
		background:
			radial-gradient(circle at 50% 20%, var(--entity-soft), transparent 60%), rgba(255, 255, 255, 0.045);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
	}
	.climate-temp-readout span {
		font-size: 3.1rem;
		line-height: 1;
		font-weight: 800;
		color: #fff;
	}
	.climate-temp-readout small {
		margin-top: 0.35rem;
		color: rgba(255, 255, 255, 0.55);
		font-weight: 700;
	}
	.entity-control {
		display: grid;
		gap: 0.5rem;
		padding: 0.85rem;
		border-radius: 0.85rem;
		background: rgba(255, 255, 255, 0.045);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
	}
	.control-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.82rem;
		font-weight: 750;
		color: rgba(255, 255, 255, 0.68);
	}
	.control-head strong {
		color: #fff;
	}
	input[type='range'] {
		width: 100%;
		accent-color: var(--entity-accent);
	}
	.cover-position-wrap {
		display: grid;
		justify-items: center;
		gap: 0.7rem;
	}
	.cover-position-pill {
		position: relative;
		width: clamp(7.8rem, 24vw, 10.5rem);
		height: clamp(18rem, 42vh, 24rem);
		border: 0;
		border-radius: clamp(2.6rem, 7vw, 3.8rem);
		background: rgba(255, 255, 255, 0.1);
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.06),
			inset 0 -24px 60px rgba(0, 0, 0, 0.16),
			0 18px 48px rgba(0, 0, 0, 0.24);
		overflow: hidden;
		cursor: ns-resize;
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
	}
	.cover-position-fill {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: var(--cover-position-pct);
		background: var(--entity-accent);
		transition:
			height 120ms ease,
			background 160ms ease;
	}
	.cover-position-icon {
		position: absolute;
		left: 50%;
		bottom: clamp(2rem, 5vh, 3.2rem);
		z-index: 2;
		display: grid;
		place-items: center;
		color: #ffffff;
		transform: translateX(-50%);
		filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.18));
		pointer-events: none;
	}
	.cover-position-pill.is-empty .cover-position-icon {
		color: var(--entity-accent);
	}
	.cover-position-label {
		display: inline-flex;
		align-items: baseline;
		gap: 0.35rem;
		color: rgba(255, 255, 255, 0.72);
		font-size: 0.86rem;
		font-weight: 750;
	}
	.cover-position-label strong {
		color: #ffffff;
		font-size: 1.1rem;
	}
	select {
		width: 100%;
		height: 2.45rem;
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: 0.55rem;
		background: rgba(255, 255, 255, 0.075);
		color: #f5f5f5;
		padding: 0 0.75rem;
		font: inherit;
		box-sizing: border-box;
	}
	.action-row,
	.action-grid {
		display: grid;
		gap: 0.65rem;
	}
	.action-row {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.action-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}
	.vacuum-action-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.vacuum-map-card {
		display: grid;
		gap: 0.55rem;
		padding: 0.75rem;
		border-radius: 0.95rem;
		background: rgba(255, 255, 255, 0.045);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
	}
	.vacuum-map-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		font-size: 0.78rem;
		font-weight: 800;
		color: rgba(255, 255, 255, 0.58);
	}
	.vacuum-map-head strong {
		color: var(--entity-accent);
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.vacuum-map-image,
	.vacuum-map-fallback {
		width: 100%;
		aspect-ratio: 4 / 3;
		border-radius: 0.75rem;
		background: #111827;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
		overflow: hidden;
	}
	.vacuum-map-image {
		object-fit: contain;
		display: block;
	}
	.vacuum-map-fallback {
		position: relative;
		display: grid;
		grid-template-columns: 1.2fr 0.85fr;
		grid-template-rows: 1fr 0.82fr;
		gap: 0.35rem;
		padding: 0.45rem;
		box-sizing: border-box;
	}
	.vacuum-map-fallback::before {
		content: '';
		position: absolute;
		inset: 0;
		background:
			linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
			linear-gradient(0deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px);
		background-size: 32px 32px;
		pointer-events: none;
	}
	.vacuum-map-fallback .room {
		position: relative;
		border-radius: 0.55rem;
		background: rgba(52, 211, 153, 0.1);
		box-shadow: inset 0 0 0 1px rgba(52, 211, 153, 0.22);
	}
	.room-living {
		grid-row: 1 / 3;
	}
	.room-kitchen {
		background: rgba(96, 165, 250, 0.11) !important;
		box-shadow: inset 0 0 0 1px rgba(96, 165, 250, 0.24) !important;
	}
	.room-hall,
	.room-office {
		background: rgba(255, 255, 255, 0.065) !important;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.11) !important;
	}
	.vacuum-path {
		position: absolute;
		left: 16%;
		top: 18%;
		width: 62%;
		height: 58%;
		border: 2px dashed rgba(52, 211, 153, 0.65);
		border-left-color: transparent;
		border-bottom-color: transparent;
		border-radius: 999px;
		transform: rotate(8deg);
	}
	.vacuum-dot,
	.dock-dot {
		position: absolute;
		border-radius: 999px;
		z-index: 2;
	}
	.vacuum-dot {
		left: 58%;
		top: 56%;
		width: 1.1rem;
		height: 1.1rem;
		background: var(--entity-accent);
		box-shadow: 0 0 18px rgba(52, 211, 153, 0.55);
	}
	.dock-dot {
		left: 12%;
		bottom: 13%;
		width: 0.75rem;
		height: 0.75rem;
		background: rgba(255, 255, 255, 0.82);
		box-shadow: 0 0 12px rgba(255, 255, 255, 0.28);
	}
	.control-action {
		min-height: 3.35rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.45rem;
		border: 0;
		border-radius: 0.75rem;
		color: rgba(255, 255, 255, 0.86);
		background: rgba(255, 255, 255, 0.06);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.075);
		font-weight: 800;
		cursor: pointer;
	}
	.control-action:hover,
	.round-action:hover,
	.np-btn:hover {
		background: rgba(255, 255, 255, 0.09);
	}
	.vacuum-status {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}
	.vacuum-status > div {
		padding: 0.85rem;
		border-radius: 0.85rem;
		background: rgba(255, 255, 255, 0.045);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
	}
	.vacuum-status span,
	.media-now span {
		display: block;
		font-size: 0.76rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.52);
	}
	.vacuum-status strong,
	.media-now strong {
		display: block;
		margin-top: 0.18rem;
		color: rgba(255, 255, 255, 0.92);
		font-size: 1rem;
	}
	.media-now {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 0.75rem;
		padding: 0.85rem;
		border-radius: 0.85rem;
		background: rgba(255, 255, 255, 0.045);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.07);
	}
	.media-cover {
		width: 4rem;
		height: 4rem;
		display: grid;
		place-items: center;
		border-radius: 0.8rem;
		color: var(--entity-accent);
		background: var(--entity-soft);
	}
	.media-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.7rem;
	}
	.round-action {
		width: 3rem;
		height: 3rem;
		border: 0;
		border-radius: 999px;
		display: grid;
		place-items: center;
		color: rgba(255, 255, 255, 0.86);
		background: rgba(255, 255, 255, 0.06);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.075);
		cursor: pointer;
	}
	.round-action.primary {
		width: 3.7rem;
		height: 3.7rem;
		color: #0f1424;
		background: var(--entity-accent);
	}
	.np-btn {
		min-height: 2.6rem;
		border: 0;
		border-radius: 0.7rem;
		color: rgba(255, 255, 255, 0.86);
		background: rgba(255, 255, 255, 0.06);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.075);
		font-weight: 800;
		cursor: pointer;
	}
	.np-btn.primary {
		color: #0f1424;
		background: var(--entity-accent);
	}
	button:disabled,
	select:disabled,
	input:disabled {
		opacity: 0.55;
		cursor: not-allowed;
	}
	.entity-error {
		padding: 0.75rem;
		border-radius: 0.75rem;
		background: rgba(248, 113, 113, 0.12);
		color: #fecaca;
		font-size: 0.82rem;
		font-weight: 700;
	}
	.entity-detail-modal.vacuum-detail {
		--popup-width: var(--np-detail-popup-width, min(850px, calc(100vw - 1.5rem)));
		--popup-height: min(1140px, calc(100vh - 1.5rem));
	}
	.vacuum-detail .entity-detail-body {
		padding: 1rem;
		gap: 0.85rem;
	}
	.vacuum-detail .vacuum-map-card {
		padding: 1rem;
		border-radius: 1rem;
		background: #0a0e1a;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.075);
	}
	.vacuum-detail .vacuum-map-image,
	.vacuum-detail .vacuum-map-fallback {
		aspect-ratio: 16 / 9;
		min-height: clamp(18rem, 54vh, 34rem);
		border-radius: 0.85rem;
		background: #050812;
	}
	@media (max-width: 520px) {
		.action-grid {
			grid-template-columns: 1fr;
		}
		.action-row,
		.vacuum-status {
			grid-template-columns: 1fr;
		}
		.vacuum-detail .vacuum-map-image,
		.vacuum-detail .vacuum-map-fallback {
			min-height: clamp(14rem, 42vh, 24rem);
		}
	}
</style>
