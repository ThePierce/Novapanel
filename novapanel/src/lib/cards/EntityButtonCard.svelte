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

	let {
		kind,
		title = '',
		entityId,
		icon,
		editMode = false,
		onOpen
	}: Props = $props();

	let busy = $state(false);

	const entity = $derived(
		$entityStore.entities.find((entry: HomeAssistantEntity) => entry.entityId === (entityId ?? ''))
	);
	const state = $derived((entity?.state ?? '').toLowerCase());
	const isUnavailable = $derived(!entity || state === 'unavailable' || state === 'unknown');
	const isActive = $derived(
		kind === 'climate'
			? state !== 'off' && !isUnavailable
			: kind === 'cover'
				? state === 'open' || state === 'opening'
				: kind === 'vacuum'
					? ['cleaning', 'returning', 'docked'].includes(state)
					: ['playing', 'buffering', 'on'].includes(state)
	);
	const displayName = $derived(
		title && title.trim().length > 0
			? title.trim()
			: entity?.friendlyName ?? entityId ?? fallbackName(kind)
	);
	const cardIcon = $derived((icon && icon.trim().length > 0) ? icon.trim() : fallbackIcon(kind));
	const accent = $derived(accentForKind(kind, isActive));
	const accentSoft = $derived(softAccentForKind(kind, isActive));
	const stateLabel = $derived(labelForEntity(kind, entity, isUnavailable));

	function fallbackName(value: EntityButtonKind) {
		if (value === 'climate') return 'Climate';
		if (value === 'cover') return translate('Gordijn', $selectedLanguageStore);
		if (value === 'vacuum') return translate('Stofzuiger', $selectedLanguageStore);
		return translate('Media player', $selectedLanguageStore);
	}

	function fallbackIcon(value: EntityButtonKind) {
		if (value === 'climate') return 'mdi:thermostat';
		if (value === 'cover') return 'mdi:curtains';
		if (value === 'vacuum') return 'mdi:robot-vacuum';
		return 'mdi:speaker';
	}

	function accentForKind(value: EntityButtonKind, active: boolean) {
		if (!active) return '#8d98aa';
		if (value === 'climate') return '#fb923c';
		if (value === 'cover') return '#60a5fa';
		if (value === 'vacuum') return '#34d399';
		return '#c084fc';
	}

	function softAccentForKind(value: EntityButtonKind, active: boolean) {
		if (!active) return 'rgba(141,152,170,0.16)';
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

	function labelForEntity(value: EntityButtonKind, entry: HomeAssistantEntity | undefined, unavailable: boolean) {
		if (unavailable) return translate('Niet beschikbaar', $selectedLanguageStore);
		if (value === 'climate') {
			const current = numericAttribute(entry, 'current_temperature');
			const target = numericAttribute(entry, 'temperature');
			if (current !== null && target !== null) return `${Math.round(current)}° · ${translate('doel', $selectedLanguageStore)} ${Math.round(target)}°`;
			if (target !== null) return `${translate('Doel', $selectedLanguageStore)} ${Math.round(target)}°`;
		}
		if (value === 'cover') {
			const position = numericAttribute(entry, 'current_position');
			if (position !== null) {
				const openPct = Math.round(Math.max(0, Math.min(100, position)));
				return `${formatState(state)} · ${openPct}% open`;
			}
			if (state === 'open' || state === 'opening') return `${formatState(state)} · 100% open`;
			if (state === 'closed' || state === 'closing') return `${formatState(state)} · 0% open`;
		}
		if (value === 'vacuum') {
			const battery = numericAttribute(entry, 'battery_level');
			if (battery !== null) return `${formatState(state)} · ${Math.round(battery)}%`;
		}
		if (value === 'media_player') {
			const title = entry?.attributes?.media_title;
			if (typeof title === 'string' && title.trim().length > 0) return title.trim();
		}
		return formatState(state);
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
				await callHaService('climate', state === 'off' ? 'turn_on' : 'turn_off', { entity_id: entityId });
			} else if (kind === 'cover') {
				await callHaService('cover', state === 'open' || state === 'opening' ? 'close_cover' : 'open_cover', { entity_id: entityId });
			} else if (kind === 'vacuum') {
				await callHaService('vacuum', state === 'cleaning' ? 'pause' : 'start', { entity_id: entityId });
			} else {
				await callHaService('media_player', state === 'playing' ? 'media_pause' : 'media_play', { entity_id: entityId });
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
	<button type="button" class="entity-icon-button" aria-label={`${displayName} ${translate('apply', $selectedLanguageStore)}`} onclick={quickAction}>
		<StatusIcon icon={cardIcon} size={34} />
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
		min-height: 4.1rem;
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: 0.72rem;
		padding: 0.55rem 0.62rem;
		border-radius: 14px;
		color: rgba(255, 255, 255, 0.9);
		background:
			linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025)),
			#20293a;
		box-shadow: inset 0 0 0 1px rgba(255,255,255,0.055);
		box-sizing: border-box;
		overflow: hidden;
		cursor: pointer;
		transition: transform 160ms ease, background 180ms ease, box-shadow 180ms ease;
	}
	.entity-button-card:hover {
		transform: translateY(-1px);
		box-shadow:
			inset 0 0 0 1px rgba(255,255,255,0.08),
			0 12px 32px rgba(0,0,0,0.2);
	}
	.entity-button-card.is-active {
		background:
			radial-gradient(circle at 22% 18%, var(--entity-soft), transparent 44%),
			linear-gradient(145deg, rgba(255,255,255,0.11), rgba(255,255,255,0.035)),
			#222b3c;
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
		width: 2.85rem;
		height: 2.85rem;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 13px;
		color: var(--entity-accent);
		background: var(--entity-soft);
		box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
		cursor: pointer;
		transition: transform 140ms ease, background 160ms ease;
	}
	.entity-icon-button:hover {
		transform: scale(1.035);
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
		font-size: 0.98rem;
		line-height: 1.12;
		font-weight: 750;
		overflow-wrap: anywhere;
	}
	.entity-state {
		margin-top: 0.22rem;
		font-size: 0.78rem;
		font-weight: 650;
		color: rgba(255,255,255,0.54);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
