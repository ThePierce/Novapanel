<script lang="ts">
	import { entityStore } from '$lib/ha/entities-store';
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';

	type Props = {
		entityId?: string;
		icon?: string;
	};

	let { entityId, icon }: Props = $props();

	const alarmEntity = $derived(
		$entityStore.entities.find((entity) => entity.entityId === (entityId ?? ''))
	);
	const state = $derived((alarmEntity?.state ?? '').toLowerCase());
	const defaultIcon = $derived(
		state === 'armed_home'
			? 'mdi:shield-home-outline'
			: state === 'armed_away'
				? 'mdi:shield-lock-outline'
				: state === 'armed_night'
					? 'mdi:shield-moon-outline'
					: state === 'pending' || state.includes('pending') || state.includes('arming')
						? 'mdi:shield-half-full'
						: state === 'disarmed' || state.includes('disarmed')
							? 'mdi:shield-off-outline'
							: state === 'triggered' || state.includes('triggered')
								? 'mdi:shield-alert-outline'
								: 'mdi:shield-lock-outline'
	);
	const label = $derived(
		state.includes('disarmed')
			? 'Uitgeschakeld'
			: state.includes('arming')
				? 'Wordt ingeschakeld…'
				: state.includes('pending')
					? 'In afwachting'
					: state.includes('triggered')
						? 'ALARM!'
						: 'Ingeschakeld'
	);
	const tone = $derived(
		state.includes('disarmed')
			? 'safe'
			: state.includes('arming') || state.includes('pending')
				? 'pending'
				: state.includes('triggered')
					? 'triggered'
					: 'armed'
	);
</script>

<div class={`alarm-card tone-${tone}`}>
	<div class="alarm-icon-wrap">
		<div class="alarm-ring"></div>
		<StatusIcon icon={defaultIcon} size={26} />
	</div>
	<div class="alarm-body">
		<div class="alarm-name">{alarmEntity?.friendlyName ?? 'Alarmpaneel'}</div>
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
	.tone-safe .alarm-icon-wrap, .tone-safe .alarm-ring { color: #4ade80; }
	.tone-safe .alarm-icon-wrap :global(.mdi-mask) { --mask-color: #4ade80; }
	.tone-armed .alarm-icon-wrap, .tone-armed .alarm-ring { color: #e15241; }
	.tone-armed .alarm-icon-wrap :global(.mdi-mask) { --mask-color: #e15241; }
	.tone-pending .alarm-icon-wrap, .tone-pending .alarm-ring { color: #f5a623; animation: pulse 1.2s ease-in-out infinite; }
	.tone-pending .alarm-icon-wrap :global(.mdi-mask) { --mask-color: #f5a623; }
	.tone-triggered .alarm-icon-wrap, .tone-triggered .alarm-ring { color: #ff4444; animation: pulse 0.5s ease-in-out infinite; }
	.tone-triggered .alarm-icon-wrap :global(.mdi-mask) { --mask-color: #ff4444; }
	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
	.alarm-body { min-width: 0; display: flex; flex-direction: column; gap: 0.1rem; }
	.alarm-name { font-size: 0.88rem; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f5f5f5; opacity: 0.9; }
	.alarm-state { font-size: 0.78rem; font-weight: 600; white-space: nowrap; letter-spacing: 0.02em; }
	.tone-safe .alarm-state { color: #4ade80; }
	.tone-armed .alarm-state { color: #e15241; }
	.tone-pending .alarm-state { color: #f5a623; }
	.tone-triggered .alarm-state { color: #ff4444; }
</style>
