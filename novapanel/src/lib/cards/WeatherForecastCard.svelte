<script lang="ts">
	import { entityStore } from '$lib/ha/entities-store';
	import {
		subscribeWeatherForecastDirect,
		type WeatherForecastType
	} from '$lib/ha/weather-forecast-service';
	import WeatherIcon from '$lib/cards/WeatherIcon.svelte';
	import { translations, type LanguageCode } from '$lib/i18n';

	type ForecastType = WeatherForecastType;

	type Props = {
		entityId?: string;
		forecastType?: ForecastType;
		daysToShow?: number;
		locale?: LanguageCode;
	};

	let { entityId, forecastType = 'daily', daysToShow = 5, locale = 'nl' }: Props = $props();

	let forecast = $state<Array<Record<string, unknown>>>([]);
	let unsub: (() => void) | null = null;
	let iconFailed = $state<Record<number, boolean>>({});

	async function subscribeForecast(id?: string, type?: ForecastType) {
		unsub?.();
		unsub = null;
		forecast = [];
		if (!id) return;
		unsub = await subscribeWeatherForecastDirect({
			entityId: id,
			forecastType: type ?? 'daily',
			onForecast: (nextForecast) => {
				forecast = nextForecast;
			}
		});
	}

	$effect(() => {
		const id = entityId;
		const type = forecastType;
		let disposed = false;
		(async () => {
			await subscribeForecast(id, type);
			if (disposed) unsub?.();
		})();
		return () => {
			disposed = true;
			unsub?.();
			unsub = null;
		};
	});

	const shown = $derived(forecast.slice(0, Math.max(1, Math.min(7, daysToShow))));
	const storeSun = $derived(
		$entityStore.entities.find((entity) => entity.entityId === 'sun.sun')
	);
	const belowHorizon = $derived(
		storeSun?.state === 'below_horizon'
	);
	const ingressBase =
		typeof window !== 'undefined' ? (((window as unknown as { __novapanel_ingress?: string }).__novapanel_ingress || '') as string) : '';

	function tCondition(value: string) {
		const key = `weather_${value.replace(/-/g, '_')}` as keyof typeof translations.nl;
		const catalog = translations[locale] as Record<string, string>;
		return catalog[key as string] ?? value;
	}
	function tLocal(key: string, fallback: string) {
		const catalog = translations[locale] as Record<string, string>;
		return catalog[key] ?? fallback;
	}
	function meteoconName(value: string, night: boolean) {
		const base = (value || 'sunny').trim();
		if (!base) return night ? 'sunny-night' : 'sunny-day';
		if (base.endsWith('-night') || base.endsWith('-day')) return base;
		return `${base}-${night ? 'night' : 'day'}`;
	}
</script>

{#if !entityId}
	<div class="empty">{tLocal('cardTypeWeatherForecast', 'Forecast')}</div>
{:else if shown.length === 0}
	<div class="empty">{tLocal('statusNoData', 'No data')}</div>
{:else}
	<div class="container">
		{#each shown as item, idx (idx)}
			{@const dt = typeof item.datetime === 'string' ? item.datetime : ''}
			{@const t = typeof item.temperature === 'number' ? Math.round(item.temperature) : null}
			{@const cond = typeof item.condition === 'string' ? item.condition : ''}
			{@const skipMeteocon = cond.trim().toLowerCase() === 'clear-night'}
			{@const src = `${ingressBase}/weather/meteocons/${meteoconName(cond, belowHorizon)}.svg`}
			<div class="item">
				<div class="day">{dt ? new Date(dt).toLocaleDateString(locale, { weekday: 'short' }) : '-'}</div>
				<div class="icon" title={cond ? tCondition(cond) : ''}>
					{#if !iconFailed[idx] && !skipMeteocon}
						<img
							src={src}
							alt=""
							width="34"
							height="34"
							onerror={() => (iconFailed = { ...iconFailed, [idx]: true })}
						/>
					{:else}
						<WeatherIcon condition={cond} night={belowHorizon} size={34} />
					{/if}
				</div>
				<div class="temp">{t === null ? '-' : t + '°'}</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.container {
		padding: 0.35rem 0.4rem;
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(2.6rem, 1fr);
		gap: 0.35rem;
		overflow-x: auto;
		overflow-y: hidden;
		text-shadow: 0px 0px 5px rgba(0, 0, 0, 0.1);
		width: 100%;
		max-width: 100%;
		min-width: 0;
		box-sizing: border-box;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior-x: contain;
		touch-action: pan-x;
	}
	.container::-webkit-scrollbar { width: 0; height: 0; display: none; }

	.item {
		min-width: 0;
		display: grid;
		justify-items: center;
		gap: 0.1rem;
		overflow: hidden;
	}

	.day {
		font-size: 0.8rem;
		opacity: 0.9;
		white-space: nowrap;
	}

	.icon {
		width: 2.1rem;
		height: 2.1rem;
		display: grid;
		place-items: center;
	}

	.temp {
		font-size: 0.95rem;
		font-weight: 600;
		white-space: nowrap;
	}

	.empty {
		padding: 0.35rem 0.4rem;
		opacity: 0.85;
		white-space: normal;
		overflow: hidden;
		text-overflow: ellipsis;
		overflow-wrap: anywhere;
	}
</style>
