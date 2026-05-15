<script lang="ts">
	import { entityStore } from '$lib/ha/entities-store';
	import WeatherIcon from '$lib/cards/WeatherIcon.svelte';
	import { translations, type LanguageCode } from '$lib/i18n';

	type Props = {
		entityId?: string;
		locale?: LanguageCode;
	};

	let { entityId, locale = 'nl' }: Props = $props();

	let iconFailed = $state(false);

	const storeEntity = $derived(
		entityId ? $entityStore.entities.find((entity) => entity.entityId === entityId) : undefined
	);
	const storeSun = $derived(
		$entityStore.entities.find((entity) => entity.entityId === 'sun.sun')
	);
	const state = $derived(
		storeEntity
			? {
					state: storeEntity.state,
					attributes: storeEntity.attributes
				}
			: null
	);
	const attrs = $derived((state?.attributes as Record<string, unknown> | undefined) ?? {});
	const condition = $derived(typeof state?.state === 'string' ? state.state : '');
	const belowHorizon = $derived(storeSun?.state === 'below_horizon');
	function translateCondition(value: string, language: LanguageCode) {
		if (!value) return '';
		const key = `weather_${value.replace(/-/g, '_')}` as keyof typeof translations.nl;
		const catalog = translations[language] as Record<string, string>;
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
	const translatedCondition = $derived(translateCondition(condition, locale));
	const ingressBase =
		typeof window !== 'undefined' ? (((window as unknown as { __novapanel_ingress?: string }).__novapanel_ingress || '') as string) : '';
	const skipMeteocon = $derived((condition || '').trim().toLowerCase() === 'clear-night');
	const meteoconSrc = $derived(
		`${ingressBase}/weather/meteocons/${meteoconName(condition, belowHorizon)}.svg`
	);
	const temperature = $derived(
		typeof attrs.temperature === 'number' ? Math.round(attrs.temperature) : null
	);
	const unit = $derived(typeof attrs.temperature_unit === 'string' ? attrs.temperature_unit : '°');
</script>

{#if !entityId}
	<div class="empty">{tLocal('cardTypeWeather', 'Weather')}</div>
{:else if !state || condition === 'unavailable'}
	<div class="empty">{tLocal('statusUnavailable', 'Unavailable')}</div>
{:else}
	<div class="container">
		<div class="icon">
			{#if !iconFailed && !skipMeteocon}
				<img src={meteoconSrc} alt="" width="46" height="46" onerror={() => (iconFailed = true)} />
			{:else}
				<WeatherIcon condition={condition} night={belowHorizon} size={46} />
			{/if}
		</div>
		<div class="temperature">
			{#if temperature !== null}{temperature}{unit}{/if}
		</div>
		<div class="state">{translatedCondition}</div>
	</div>
{/if}

<style>
	.container {
		padding: 0.35rem 0.4rem;
		display: grid;
		grid-template-columns: min-content 1fr;
		grid-template-rows: auto auto;
		grid-template-areas:
			'icon temp'
			'icon state';
		align-items: center;
		column-gap: 0.45rem;
		row-gap: 0.05rem;
		text-shadow: 0px 0px 5px rgba(0, 0, 0, 0.1);
	}

	.icon {
		grid-area: icon;
		width: 2.9rem;
		height: 2.9rem;
		display: grid;
		place-items: center;
	}

	.temperature {
		grid-area: temp;
		font-size: 1.35rem;
		font-weight: 600;
		line-height: 1.55rem;
	}

	.state {
		grid-area: state;
		opacity: 0.9;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.empty {
		padding: 0.35rem 0.4rem;
		opacity: 0.85;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
