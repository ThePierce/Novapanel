<script lang="ts">
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
	import { entityStore } from '$lib/ha/entities-store';
	import { callHaService } from '$lib/ha/service-call';
	import type { HomeAssistantEntity } from '$lib/ha/entities-service';
	import { selectedLanguageStore, translate } from '$lib/i18n';

	type Props = {
		title?: string;
		entityId?: string;
		icon?: string;
		editMode?: boolean;
		onOpen: () => void;
	};

	let { title = '', entityId, icon = 'mdi:lightbulb-outline', editMode = false, onOpen }: Props = $props();
	let busy = $state(false);

	const entity = $derived(
		$entityStore.entities.find((entry: HomeAssistantEntity) => entry.entityId === (entityId ?? ''))
	);
	const isUnavailable = $derived(!entity || entity.state === 'unavailable' || entity.state === 'unknown');
	const isOn = $derived((entity?.state ?? '').toLowerCase() === 'on');
	const serviceDomain = $derived(
		(entity?.domain || entityId?.split('.')[0] || 'light').toLowerCase()
	);
	const brightnessPct = $derived(
		(() => {
			const raw = entity?.attributes?.brightness;
			if (typeof raw !== 'number' || !Number.isFinite(raw)) return isOn ? 100 : 0;
			return Math.max(0, Math.min(100, Math.round((raw / 255) * 100)));
		})()
	);
	const displayName = $derived(
		(title && title.trim().length > 0)
			? title.trim()
			: entity?.friendlyName ?? entityId ?? translate('Lamp', $selectedLanguageStore)
	);
	const stateLabel = $derived(
		isUnavailable ? translate('Niet beschikbaar', $selectedLanguageStore) : isOn ? `${brightnessPct}%` : translate('Uit', $selectedLanguageStore)
	);
	const accent = $derived(isOn ? '#ffd338' : '#8d98aa');
	const accentSoft = $derived(isOn ? 'rgba(255,211,56,0.22)' : 'rgba(141,152,170,0.16)');
	const cardIcon = $derived((icon && icon.trim().length > 0) ? icon.trim() : 'mdi:lightbulb-outline');

	function handleOpen(event: MouseEvent | KeyboardEvent) {
		if (editMode) return;
		event.stopPropagation();
		onOpen();
	}

	async function toggleLight(event: MouseEvent) {
		if (editMode) return;
		event.stopPropagation();
		if (!entityId || busy) {
			onOpen();
			return;
		}
		busy = true;
		try {
			await callHaService(serviceDomain, isOn ? 'turn_off' : 'turn_on', { entity_id: entityId });
		} catch (error) {
			console.error('Light toggle failed', error);
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
	class="light-button-card"
	class:is-on={isOn}
	class:is-unavailable={isUnavailable}
	class:is-busy={busy}
	role="button"
	tabindex={editMode ? undefined : 0}
	aria-label={`${translate('Open', $selectedLanguageStore)} ${displayName}`}
	style={`--light-accent: ${accent}; --light-soft: ${accentSoft}; --light-level: ${brightnessPct}%;`}
	onclick={handleOpen}
	onkeydown={handleKeydown}
>
	<div class="light-bg" aria-hidden="true"></div>
	<button type="button" class="light-icon-button" aria-label={`${displayName} ${isOn ? translate('uitzetten', $selectedLanguageStore) : translate('aanzetten', $selectedLanguageStore)}`} onclick={toggleLight}>
		<StatusIcon icon={cardIcon} size={20} />
	</button>
	<div class="light-copy">
		<div class="light-name">{displayName}</div>
		<div class="light-state">{stateLabel}</div>
	</div>
</div>

<style>
	.light-button-card {
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
		background:
			linear-gradient(145deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02)),
			#1f2738;
		box-shadow: inset 0 0 0 0.5px rgba(255,255,255,0.05);
		box-sizing: border-box;
		overflow: hidden;
		cursor: pointer;
		transition: transform 160ms ease, background 180ms ease, box-shadow 180ms ease;
	}
	.light-button-card:hover {
		transform: translateY(-1px);
		box-shadow:
			inset 0 0 0 0.5px rgba(255,255,255,0.08),
			0 8px 22px rgba(0,0,0,0.22);
	}
	.light-button-card.is-on {
		background:
			radial-gradient(circle at 22% 18%, var(--light-soft), transparent 44%),
			linear-gradient(145deg, rgba(255,255,255,0.09), rgba(255,255,255,0.03)),
			#222b3c;
	}
	.light-button-card.is-unavailable {
		opacity: 0.74;
	}
	.light-bg {
		position: absolute;
		inset: 0;
		background: radial-gradient(circle at 85% 15%, var(--light-soft), transparent 40%);
		pointer-events: none;
	}
	.light-icon-button {
		position: relative;
		z-index: 1;
		width: 2.3rem;
		height: 2.3rem;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 11px;
		color: var(--light-accent);
		background: var(--light-soft);
		box-shadow: inset 0 0 0 0.5px rgba(255,255,255,0.07);
		cursor: pointer;
		transition: transform 140ms ease, background 160ms ease;
	}
	.light-icon-button :global(.status-icon) {
		font-size: 1.25rem !important;
		width: 1.25rem !important;
		height: 1.25rem !important;
	}
	.light-icon-button :global(.mdi-mask) {
		width: 1.25rem !important;
		height: 1.25rem !important;
	}
	.light-icon-button:hover {
		transform: scale(1.04);
	}
	.light-icon-button:active {
		transform: scale(0.97);
	}
	.light-copy {
		position: relative;
		z-index: 1;
		min-width: 0;
	}
	.light-name {
		font-size: 0.82rem;
		line-height: 1.15;
		font-weight: 600;
		letter-spacing: -0.01em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.light-state {
		margin-top: 0.12rem;
		font-size: 0.7rem;
		font-weight: 500;
		color: rgba(255,255,255,0.5);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	@container (max-width: 220px) {
		.light-button-card {
			grid-template-columns: auto 1fr;
			min-height: 3.4rem;
		}
	}
</style>
