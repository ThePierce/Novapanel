<script lang="ts">
	import { entityStore } from '$lib/ha/entities-store';
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
	import { selectedLanguageStore, translate, type LanguageCode } from '$lib/i18n';

	type Props = {
		entityId?: string;
		icon?: string;
	};

	let { entityId, icon }: Props = $props();

	function alarmIconForState(state: string, unavailable: boolean): string {
		if (unavailable) return 'mdi:shield-alert-outline';
		if (state === 'armed_home') return 'mdi:shield-home-outline';
		if (state === 'armed_away') return 'mdi:shield-lock-outline';
		if (state === 'armed_night') return 'mdi:shield-moon-outline';
		if (state === 'pending' || state.includes('pending') || state.includes('arming')) {
			return 'mdi:shield-half-full';
		}
		if (state === 'disarmed' || state.includes('disarmed')) return 'mdi:shield-off-outline';
		if (state === 'triggered' || state.includes('triggered')) return 'mdi:shield-alert-outline';
		return 'mdi:shield-lock-outline';
	}

	function alarmLabelForState(
		state: string,
		hasEntityId: boolean,
		foundEntity: boolean,
		language: LanguageCode
	): string {
		if (!hasEntityId) return translate('Geen entiteit gekoppeld', language);
		if (!foundEntity || state === '' || state === 'unknown') return translate('Onbekend', language);
		if (state === 'unavailable') return translate('Niet beschikbaar', language);
		if (state.includes('disarmed')) return translate('Uitgeschakeld', language);
		if (state.includes('arming')) return translate('Wordt ingeschakeld…', language);
		if (state.includes('pending')) return translate('In afwachting', language);
		if (state.includes('triggered')) return translate('ALARM!', language);
		return translate('Ingeschakeld', language);
	}

	function alarmToneForState(state: string, unavailable: boolean): string {
		if (unavailable) return 'unavailable';
		if (state.includes('disarmed')) return 'safe';
		if (state.includes('arming') || state.includes('pending')) return 'pending';
		if (state.includes('triggered')) return 'triggered';
		return 'armed';
	}

	const alarmEntity = $derived($entityStore.entities.find((entity) => entity.entityId === (entityId ?? '')));
	const state = $derived((alarmEntity?.state ?? '').toLowerCase());
	const isMissing = $derived(!entityId || !alarmEntity);
	const isUnavailable = $derived(isMissing || state === '' || state === 'unknown' || state === 'unavailable');
	const defaultIcon = $derived(icon?.trim() || alarmIconForState(state, isUnavailable));
	const label = $derived(
		alarmLabelForState(state, Boolean(entityId), Boolean(alarmEntity), $selectedLanguageStore)
	);
	const tone = $derived(alarmToneForState(state, isUnavailable));
</script>

<div class={`alarm-card tone-${tone}`}>
	<div class="alarm-icon-wrap">
		<div class="alarm-ring"></div>
		<StatusIcon icon={defaultIcon} size={26} />
	</div>
	<div class="alarm-body">
		<div class="alarm-name">
			{alarmEntity?.friendlyName ?? translate('cardTypeAlarmPanel', $selectedLanguageStore)}
		</div>
		<div class="alarm-state">{label}</div>
	</div>
</div>

<style>
	.alarm-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.15rem 0;
	}
	.alarm-icon-wrap {
		position: relative;
		width: 2.6rem;
		height: 2.6rem;
		display: grid;
		place-items: center;
		flex-shrink: 0;
	}
	.alarm-ring {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		border: 2px solid currentColor;
		opacity: 0.25;
	}
	.tone-safe .alarm-icon-wrap,
	.tone-safe .alarm-ring {
		color: #4ade80;
	}
	.tone-safe .alarm-icon-wrap :global(.mdi-mask) {
		--mask-color: #4ade80;
	}
	.tone-armed .alarm-icon-wrap,
	.tone-armed .alarm-ring {
		color: #e15241;
	}
	.tone-armed .alarm-icon-wrap :global(.mdi-mask) {
		--mask-color: #e15241;
	}
	.tone-unavailable .alarm-icon-wrap,
	.tone-unavailable .alarm-ring {
		color: #94a3b8;
	}
	.tone-unavailable .alarm-icon-wrap :global(.mdi-mask) {
		--mask-color: #94a3b8;
	}
	.tone-pending .alarm-icon-wrap,
	.tone-pending .alarm-ring {
		color: #f5a623;
		animation: pulse 1.2s ease-in-out infinite;
	}
	.tone-pending .alarm-icon-wrap :global(.mdi-mask) {
		--mask-color: #f5a623;
	}
	.tone-triggered .alarm-icon-wrap,
	.tone-triggered .alarm-ring {
		color: #ff4444;
		animation: pulse 0.5s ease-in-out infinite;
	}
	.tone-triggered .alarm-icon-wrap :global(.mdi-mask) {
		--mask-color: #ff4444;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.3;
		}
	}
	.alarm-body {
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
	}
	.alarm-name {
		font-size: 0.88rem;
		font-weight: 500;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: #f5f5f5;
		opacity: 0.9;
	}
	.alarm-state {
		font-size: 0.78rem;
		font-weight: 600;
		white-space: nowrap;
		letter-spacing: 0.02em;
	}
	.tone-safe .alarm-state {
		color: #4ade80;
	}
	.tone-armed .alarm-state {
		color: #e15241;
	}
	.tone-unavailable .alarm-state {
		color: #94a3b8;
	}
	.tone-pending .alarm-state {
		color: #f5a623;
	}
	.tone-triggered .alarm-state {
		color: #ff4444;
	}
</style>
