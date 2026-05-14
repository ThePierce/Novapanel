<script lang="ts">
	import type { SidebarItemBase } from '../types';
	import ClockCard from '$lib/cards/ClockCard.svelte';
	import DateCard from '$lib/cards/DateCard.svelte';
	import DividerCard from '$lib/cards/DividerCard.svelte';
	import WeatherCard from '$lib/cards/WeatherCard.svelte';
	import WeatherForecastCard from '$lib/cards/WeatherForecastCard.svelte';
	import AlarmPanelCard from '$lib/cards/AlarmPanelCard.svelte';
	import LightsStatusCard from '$lib/cards/LightsStatusCard.svelte';
	import OpeningsStatusCard from '$lib/cards/OpeningsStatusCard.svelte';
	import DevicesStatusCard from '$lib/cards/DevicesStatusCard.svelte';
	import AvailabilityStatusCard from '$lib/cards/AvailabilityStatusCard.svelte';
	import MediaPlayersStatusCard from '$lib/cards/MediaPlayersStatusCard.svelte';
	import EnergyCard from '$lib/cards/EnergyCard.svelte';
	import CamerasStripCard from '$lib/cards/CamerasStripCard.svelte';

	type Props = {
		item: SidebarItemBase;
		editable?: boolean;
		onSelectItem?: (item: SidebarItemBase) => void;
		onDragStart?: (id: string) => void;
		onDragEnd?: () => void;
		onDragOverValid?: (event: DragEvent) => void;
		onCameraClick?: (camera: import('$lib/persistence/panel-state-types').CameraConfig) => void;
	};

let { item, editable = false, onSelectItem, onDragStart, onDragEnd, onDragOverValid, onCameraClick }: Props =
		$props();
let dragGhostImage: HTMLImageElement | null = null;

function applyDragCursorIndicatorOnly(event: DragEvent) {
	const transfer = event.dataTransfer;
	if (!transfer) return;
	transfer.effectAllowed = 'move';
	transfer.dropEffect = 'move';
	transfer.setData('text/plain', 'novapanel-sidebar-drag');
	if (!dragGhostImage) {
		dragGhostImage = new Image();
		dragGhostImage.src =
			'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
	}
	transfer.setDragImage(dragGhostImage, 0, 0);
}
</script>

<article
	class="placeholder-card"
	class:editable={editable}
	class:has-title={!!(item.title && item.title.trim().length > 0)}
	draggable={editable}
	data-type={item.type}
	onclick={() => onSelectItem?.(item)}
	ondragstart={(event) => {
		if (!editable) return;
		applyDragCursorIndicatorOnly(event);
		onDragStart?.(item.id);
	}}
	ondragend={() => editable && onDragEnd?.()}
	ondragover={(event) => editable && onDragOverValid?.(event)}
>
	{#if item.title && item.title.trim().length > 0}
		<h3 class="card-title">{item.title}</h3>
	{/if}
	{#if item.type === 'clock'}
		<ClockCard
			analogStyle={item.analogClockStyle ?? 1}
			digitalStyle={item.digitalClockStyle ?? 1}
			clockStyle={item.clockStyle}
			showAnalog={item.clockShowAnalog ?? false}
			showDigital={item.clockShowDigital ?? true}
			hour12={item.clockHour12}
			seconds={item.clockSeconds ?? false}
			compact
		/>
	{:else if item.type === 'date'}
		<DateCard
			layout={item.dateLayout ?? 'vertical'}
			shortDay={item.dateShortDay ?? false}
			shortMonth={item.dateShortMonth ?? false}
			align={item.dateAlign ?? 'center'}
			weekdayWithDate={item.dateWeekdayWithDate ?? false}
		/>
	{:else if item.type === 'divider'}
		<DividerCard editable={editable} />
	{:else if item.type === 'weather'}
		<WeatherCard entityId={item.entityId} locale={item.locale as any} />
	{:else if item.type === 'weather_forecast'}
		<WeatherForecastCard
			entityId={item.entityId}
			forecastType={item.weatherForecastType}
			daysToShow={item.weatherForecastDaysToShow}
			locale={item.locale as any}
		/>
	{:else if item.type === 'alarm_panel'}
		<AlarmPanelCard entityId={item.alarmEntityId ?? item.entityId} icon={item.statusIcon} />
	{:else if item.type === 'lights_status'}
		<LightsStatusCard
			cardId={item.id}
			domains={item.statusDomains}
			ignoredEntityIds={item.ignoredEntityIds}
			statusEntityIds={item.statusEntityIds}
			icon={item.statusIcon}
		/>
	{:else if item.type === 'openings_status'}
		<OpeningsStatusCard
			domains={item.statusDomains}
			deviceClasses={item.statusDeviceClasses}
			ignoredEntityIds={item.ignoredEntityIds}
			statusEntityIds={item.statusEntityIds}
			icon={item.statusIcon}
		/>
	{:else if item.type === 'devices_status'}
		<DevicesStatusCard
			domains={item.statusDomains}
			ignoredEntityIds={item.ignoredEntityIds}
			statusEntityIds={item.statusEntityIds}
			icon={item.statusIcon}
		/>
	{:else if item.type === 'availability_status'}
		<AvailabilityStatusCard
			domains={item.statusDomains}
			ignoredEntityIds={item.ignoredEntityIds}
			statusEntityIds={item.statusEntityIds}
			icon={item.statusIcon}
		/>
	{:else if item.type === 'media_players_status'}
		<MediaPlayersStatusCard
			domains={item.statusDomains}
			ignoredEntityIds={item.ignoredEntityIds}
			statusEntityIds={item.statusEntityIds}
			icon={item.statusIcon}
		/>
	{:else if item.type === 'energy'}
		<EnergyCard
			netEntityId={item.netEntityId}
			solarEntityId={item.solarEntityId}
			batteryEntityId={item.batteryEntityId}
			gridEntityId={item.gridEntityId}
			batteryChargeEntityId={item.batteryChargeEntityId}
		/>
	{:else if item.type === 'cameras_strip'}
		<CamerasStripCard
			cameras={item.cameras}
			title={item.title}
			onCameraClick={onCameraClick}
		/>
	{:else}
		<p>{item.type}</p>
	{/if}
</article>

<style>
	.placeholder-card {
		width: 100%;
		min-width: 0;
		max-width: 100%;
		box-sizing: border-box;
		border: 0;
		background: transparent;
		border-radius: 10px;
		padding: 0.45rem 0.55rem;
		display: grid;
		gap: 0.15rem;
		overflow: visible;
		container-type: inline-size;
	}

	.placeholder-card > :global(*) {
		min-width: 0;
		max-width: 100%;
	}

	.placeholder-card.has-title {
		padding: 0.55rem 0.6rem;
		gap: 0.25rem;
	}

	.card-title {
		margin: 0;
		font-size: 0.92rem;
		color: #f5f5f5;
		text-align: center;
		justify-self: center;
		max-width: 100%;
		line-height: 1.18;
		overflow-wrap: anywhere;
	}

	p {
		margin: 0;
		font-size: 0.74rem;
		opacity: 0.68;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
</style>
