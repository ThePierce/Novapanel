<script lang="ts">
	import { entityStore } from '$lib/ha/entities-store';
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
	import {
		buildStatusSummary,
		filterEntitiesForStatusCard,
		type StatusCardKind
	} from '$lib/cards/status/status-engine';
	import type { LightGroup } from '$lib/cards/light-groups';

	type Props = {
		kind: StatusCardKind;
		name?: string;
		domains?: string[];
		deviceClasses?: string[];
		ignoredEntityIds?: string[];
		statusEntityIds?: string[];
		icon: string;
		cardId?: string;
		lightGroups?: LightGroup[];
	};

	let {
		kind,
		name,
		domains = [],
		deviceClasses = [],
		ignoredEntityIds = [],
		statusEntityIds = [],
		icon,
		cardId = '',
		lightGroups = []
	}: Props = $props();

	const selectedEntityIdSet = $derived(
		new Set(
			(statusEntityIds ?? [])
				.map((value) => value.trim().toLowerCase())
				.filter((value) => value.length > 0)
		)
	);
	const scopedEntities = $derived(
		(kind === 'availability_status' ||
			kind === 'devices_status' ||
			kind === 'openings_status' ||
			kind === 'lights_status' ||
			kind === 'media_players_status') &&
			selectedEntityIdSet.size > 0
			? $entityStore.entities.filter((entity) => selectedEntityIdSet.has(entity.entityId.toLowerCase()))
			: $entityStore.entities
	);

	const result = $derived(
		filterEntitiesForStatusCard({
			entities: scopedEntities,
			kind,
			domains,
			deviceClasses,
			ignoredEntityIds
		})
	);

	// For lights: apply grouping logic
	// - Count all individual lights (ungrouped) for the badge
	// - But display groups as single items when calculating "active"
	const groupedEntityIds = $derived(
		kind === 'lights_status' && lightGroups.length > 0
			? new Set(lightGroups.flatMap((g) => g.entityIds.map((id) => id.toLowerCase())))
			: new Set<string>()
	);

	const activeCount = $derived(result.active.length);

	const totalCount = $derived.by(() => {
		if (kind !== 'lights_status' || lightGroups.length === 0) return result.relevant.length;
		return result.relevant.length;
	});

	const summary = $derived(buildStatusSummary({ kind, activeCount, activeEntities: result.active }));
	const displayName = $derived(
		name && name.trim().length > 0
			? name
			: kind === 'lights_status'
				? 'Lampen'
				: kind === 'openings_status'
					? 'Deuren & Ramen'
					: kind === 'devices_status'
						? 'Apparaten'
						: kind === 'media_players_status'
							? 'Media spelers'
							: 'Bereikbaarheid'
	);
	const iconTone = $derived(
		kind === 'lights_status'
			? activeCount > 0
				? 'tone-yellow'
				: 'tone-gray'
			: kind === 'openings_status'
				? activeCount > 0
					? 'tone-white'
					: 'tone-gray'
				: kind === 'devices_status'
					? activeCount > 0
						? 'tone-blue'
						: 'tone-gray'
					: kind === 'media_players_status'
						? activeCount > 0
							? 'tone-white'
							: 'tone-gray'
					: activeCount > 0
						? 'tone-red'
						: 'tone-green'
	);
	const badgeClass = $derived(
		kind === 'lights_status' ||
			kind === 'openings_status' ||
			kind === 'devices_status' ||
			kind === 'media_players_status'
			? 'count-badge badge-white'
			: 'count-badge'
	);
	const resolvedIcon = $derived(
		(() => {
			if (kind === 'availability_status') {
				return activeCount > 0 ? 'mdi:lan-disconnect' : 'mdi:lan-check';
			}
			if (kind === 'openings_status') {
				if (activeCount <= 0) return 'mdi:door-closed';
				const activeEntities = result.active;
				const hasOnlyWindows =
					activeEntities.length > 0 &&
					activeEntities.every((entity) => {
						const deviceClass = (entity.deviceClass ?? '').toLowerCase();
						if (deviceClass.includes('door')) return false;
						if (deviceClass.includes('window')) return true;
						return entity.entityId.toLowerCase().includes('window');
					});
				return hasOnlyWindows ? 'mdi:window-open-variant' : 'mdi:door-open';
			}
			return icon;
		})()
	);
</script>

<div class="status-card tile">
	<div class="status-icon-wrap">
		<div class={`status-icon ${iconTone}`}><StatusIcon icon={resolvedIcon} size={32} /></div>
		{#if activeCount > 0}
			<div class={badgeClass}>{activeCount}</div>
		{/if}
	</div>
	<div class="info">
		<div class="name">{displayName}</div>
		<div class="summary">{summary}</div>
	</div>
</div>

<style>
	.status-card {
		display: grid;
		grid-template-columns: 2.8rem minmax(0, 1fr);
		gap: 0.75rem;
		align-items: center;
		padding: 0.2rem 0.1rem;
		text-shadow: 0 0 5px rgba(0,0,0,0.15);
		width: 100%;
		min-width: 0;
		max-width: 100%;
		box-sizing: border-box;
		container-type: inline-size;
	}
	.tile { border-radius: 10px; background: transparent; }
	.status-icon-wrap { position: relative; width: 2.4rem; height: 2.4rem; display: grid; place-items: center; }
	.status-icon { width: 2.4rem; height: 2.4rem; border-radius: 999px; background: transparent; display: grid; place-items: center; font-size: 1.2rem; line-height: 1; }
	.status-icon.tone-yellow { color: #ffd338; }
	.status-icon.tone-gray { color: rgba(255,255,255,0.35); }
	.status-icon.tone-white { color: #ffffff; }
	.status-icon.tone-red { color: #ff6b5b; }
	.status-icon.tone-blue { color: #63bcff; }
	.status-icon.tone-green { color: #69d38f; }
	.count-badge { position: absolute; right: -0.22rem; top: -0.22rem; min-width: 1.04rem; height: 1.04rem; border-radius: 999px; background: #ffd338; color: #1b2433; font-size: 0.65rem; font-weight: 700; display: grid; place-items: center; padding: 0 0.2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.25); }
	.count-badge.badge-white { background: #ffffff; color: #1b2433; }
	.info { min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
	.name { font-weight: 500; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f5f5f5; }
	.summary {
		font-size: 0.82rem;
		line-height: 1.08rem;
		white-space: normal;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-top: 0.1rem;
		opacity: 0.78;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow-wrap: anywhere;
	}

	@container (max-width: 220px) {
		.status-card {
			grid-template-columns: 2.2rem minmax(0, 1fr);
			gap: 0.5rem;
		}
		.status-icon-wrap,
		.status-icon {
			width: 2rem;
			height: 2rem;
		}
		.name {
			font-size: 0.88rem;
		}
		.summary {
			font-size: 0.76rem;
			line-height: 0.98rem;
		}
	}
</style>
