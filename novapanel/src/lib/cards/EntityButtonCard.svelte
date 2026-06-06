<script lang="ts">
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
	import { entityStore } from '$lib/ha/entities-store';
	import { callHaService } from '$lib/ha/service-call';
	import type { HomeAssistantEntity } from '$lib/ha/entities-service';
	import type { EntityButtonKind } from '$lib/cards/entity-button-types';
	import { selectedLanguageStore, translate, translateState } from '$lib/i18n';

	type Props = {
		kind: EntityButtonKind;
		title?: string;
		entityId?: string;
		icon?: string;
		editMode?: boolean;
		onOpen: () => void;
	};

	let { kind, title = '', entityId, icon, editMode = false, onOpen }: Props = $props();

	let busy = $state(false);

	const entity = $derived(
		$entityStore.entities.find((entry: HomeAssistantEntity) => entry.entityId === (entityId ?? ''))
	);
	const entityState = $derived((entity?.state ?? '').toLowerCase());
	const isUnavailable = $derived(!entity || entityState === 'unavailable' || entityState === 'unknown');
	const serviceDomain = $derived((entity?.domain || entityId?.split('.')[0] || '').toLowerCase());
	const isActive = $derived(
		kind === 'device'
			? serviceDomain === 'lock'
				? entityState === 'unlocked' || entityState === 'unlocking'
				: entityState === 'on'
			: kind === 'climate'
				? entityState !== 'off' && !isUnavailable
				: kind === 'cover'
					? entityState === 'open' || entityState === 'opening'
					: kind === 'vacuum'
						? ['cleaning', 'returning'].includes(entityState)
						: ['playing', 'buffering', 'on'].includes(entityState)
	);
	const displayName = $derived(
		title && title.trim().length > 0 ? title.trim() : (entity?.friendlyName ?? entityId ?? fallbackName(kind))
	);
	const coverPosition = $derived(numericAttribute(entity, 'current_position'));
	const cardIcon = $derived(iconForEntity(kind, icon, coverPosition, entityState));
	const accent = $derived(accentForKind(kind, isActive));
	const accentSoft = $derived(softAccentForKind(kind, isActive));
	const stateLabel = $derived(labelForEntity(kind, entity, isUnavailable));

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
			return Math.round(Math.max(0, Math.min(100, position))) <= 0;
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

	function accentForKind(value: EntityButtonKind, active: boolean) {
		if (!active) return '#8d98aa';
		if (value === 'device') return '#34d399';
		if (value === 'climate') return '#fb923c';
		if (value === 'cover') return '#60a5fa';
		if (value === 'vacuum') return '#34d399';
		return '#c084fc';
	}

	function softAccentForKind(value: EntityButtonKind, active: boolean) {
		if (!active) return 'rgba(141,152,170,0.16)';
		if (value === 'device') return 'rgba(52,211,153,0.22)';
		if (value === 'climate') return 'rgba(251,146,60,0.22)';
		if (value === 'cover') return 'rgba(96,165,250,0.22)';
		if (value === 'vacuum') return 'rgba(52,211,153,0.22)';
		return 'rgba(192,132,252,0.22)';
	}

	function formatState(value: string) {
		return translateState(value, $selectedLanguageStore);
	}

	function numericAttribute(entry: HomeAssistantEntity | undefined, key: string): number | null {
		const raw = entry?.attributes?.[key];
		return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
	}

	function labelForEntity(
		value: EntityButtonKind,
		entry: HomeAssistantEntity | undefined,
		unavailable: boolean
	) {
		if (unavailable) return translate('Niet beschikbaar', $selectedLanguageStore);
		if (value === 'device') return formatState(entityState);
		if (value === 'climate') {
			const current = numericAttribute(entry, 'current_temperature');
			const target = numericAttribute(entry, 'temperature');
			if (current !== null && target !== null)
				return `${Math.round(current)}° · ${translate('doel', $selectedLanguageStore)} ${Math.round(target)}°`;
			if (target !== null) return `${translate('Doel', $selectedLanguageStore)} ${Math.round(target)}°`;
		}
		if (value === 'cover') {
			const position = numericAttribute(entry, 'current_position');
			if (position !== null) {
				const openPct = Math.round(Math.max(0, Math.min(100, position)));
				return `${openPct}%`;
			}
			if (entityState === 'open' || entityState === 'opening') return '100%';
			if (entityState === 'closed' || entityState === 'closing') return '0%';
		}
		if (value === 'vacuum') {
			const battery = numericAttribute(entry, 'battery_level');
			if (battery !== null) return `${formatState(entityState)} · ${Math.round(battery)}%`;
		}
		if (value === 'media_player') {
			const title = entry?.attributes?.media_title;
			if (typeof title === 'string' && title.trim().length > 0) return title.trim();
		}
		return formatState(entityState);
	}

	function handleOpen(event: MouseEvent | KeyboardEvent) {
		if (editMode) return;
		event.stopPropagation();
		onOpen();
	}

	async function quickAction(event: MouseEvent) {
		if (editMode) return;
		event.stopPropagation();
		if (!entityId || busy) {
			onOpen();
			return;
		}
		busy = true;
		try {
			if (kind === 'climate') {
				await callHaService('climate', entityState === 'off' ? 'turn_on' : 'turn_off', {
					entity_id: entityId
				});
			} else if (kind === 'device') {
				if (serviceDomain === 'lock') {
					await callHaService(
						'lock',
						entityState === 'unlocked' || entityState === 'unlocking' ? 'lock' : 'unlock',
						{ entity_id: entityId }
					);
				} else {
					await callHaService(serviceDomain || 'switch', entityState === 'on' ? 'turn_off' : 'turn_on', {
						entity_id: entityId
					});
				}
			} else if (kind === 'cover') {
				await callHaService(
					'cover',
					entityState === 'open' || entityState === 'opening' ? 'close_cover' : 'open_cover',
					{ entity_id: entityId }
				);
			} else if (kind === 'vacuum') {
				await callHaService('vacuum', entityState === 'cleaning' ? 'pause' : 'start', {
					entity_id: entityId
				});
			} else {
				await callHaService('media_player', entityState === 'playing' ? 'media_pause' : 'media_play', {
					entity_id: entityId
				});
			}
		} catch (error) {
			console.error('Entity button action failed', error);
		} finally {
			busy = false;
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		handleOpen(event);
	}
</script>

<div
	class="entity-button-card"
	class:is-active={isActive}
	class:is-unavailable={isUnavailable}
	class:is-busy={busy}
	role="button"
	tabindex={editMode ? undefined : 0}
	aria-label={`${translate('Open', $selectedLanguageStore)} ${displayName}`}
	style={`--entity-accent: ${accent}; --entity-soft: ${accentSoft};`}
	onclick={handleOpen}
	onkeydown={handleKeydown}
>
	<div class="entity-bg" aria-hidden="true"></div>
	<button
		type="button"
		class="entity-icon-button"
		aria-label={`${displayName} ${translate('apply', $selectedLanguageStore)}`}
		onclick={quickAction}
	>
		<StatusIcon icon={cardIcon} size={20} />
	</button>
	<div class="entity-copy">
		<div class="entity-name">{displayName}</div>
		<div class="entity-state">{stateLabel}</div>
	</div>
</div>

<style>
	.entity-button-card {
		position: relative;
		width: 100%;
		min-height: 3.4rem;
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 0.6rem;
		padding: 0.45rem 0.6rem;
		border-radius: 12px;
		color: rgba(255, 255, 255, 0.92);
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)), #1f2738;
		box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.05);
		box-sizing: border-box;
		overflow: hidden;
		cursor: pointer;
		transition:
			transform 160ms ease,
			background 180ms ease,
			box-shadow 180ms ease;
	}
	.entity-button-card:hover {
		transform: translateY(-1px);
		box-shadow:
			inset 0 0 0 0.5px rgba(255, 255, 255, 0.08),
			0 8px 22px rgba(0, 0, 0, 0.22);
	}
	.entity-button-card.is-active {
		background:
			radial-gradient(circle at 22% 18%, var(--entity-soft), transparent 44%),
			linear-gradient(145deg, rgba(255, 255, 255, 0.09), rgba(255, 255, 255, 0.03)), #222b3c;
	}
	.entity-button-card.is-unavailable {
		opacity: 0.74;
	}
	.entity-bg {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 85% 15%, var(--entity-soft), transparent 40%);
		pointer-events: none;
	}
	.entity-icon-button {
		position: relative;
		z-index: 1;
		width: 2.3rem;
		height: 2.3rem;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 11px;
		color: var(--entity-accent);
		background: var(--entity-soft);
		box-shadow: inset 0 0 0 0.5px rgba(255, 255, 255, 0.07);
		cursor: pointer;
		transition:
			transform 140ms ease,
			background 160ms ease;
		line-height: 0;
	}
	.entity-icon-button :global(svg) {
		display: block;
	}
	.entity-icon-button :global(.mdi-mask) {
		width: 1.25rem !important;
		height: 1.25rem !important;
	}
	.entity-icon-button:hover {
		transform: scale(1.04);
	}
	.entity-icon-button:active {
		transform: scale(0.97);
	}
	.entity-copy {
		position: relative;
		z-index: 1;
		min-width: 0;
	}
	.entity-name {
		font-size: 0.82rem;
		line-height: 1.15;
		font-weight: 600;
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.entity-state {
		margin-top: 0.12rem;
		font-size: 0.7rem;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
