<script lang="ts">
	import { getHassWithRetry, type HassLike } from '$lib/ha/entities-service-helpers';
	import { entityStore } from '$lib/ha/entities-store';
	import WeatherIcon from '$lib/cards/WeatherIcon.svelte';
	import { translations, type LanguageCode } from '$lib/i18n';

	type Props = {
		entityId?: string;
		locale?: LanguageCode;
	};

	let { entityId, locale = 'nl' }: Props = $props();

	let hass = $state<HassLike | null>(null);
	let embeddedState = $state<Record<string, unknown> | null>(null);
	let unsub: (() => void) | null = null;
	let iconFailed = $state(false);

	function pickState(next: HassLike | null, id?: string) {
		if (!next?.states || !id) return null;
		return (next.states[id] as Record<string, unknown> | undefined) ?? null;
	}

	$effect(() => {
		let disposed = false;
		(async () => {
			const next = await getHassWithRetry();
			if (disposed) return;
			hass = next;
			embeddedState = pickState(next, entityId);
		})();
		return () => {
			disposed = true;
		};
	});

	$effect(() => {
		unsub?.();
		unsub = null;
		const id = entityId;
		const connection = hass?.connection;
		if (!id || !connection?.subscribeMessage) return;
		(async () => {
			unsub = await connection.subscribeMessage((message) => {
				const payload = message as {
					event?: { data?: { entity_id?: string; new_state?: Record<string, unknown> | null } };
				};
				const entityChanged = payload.event?.data?.entity_id;
				if (entityChanged !== id) return;
				embeddedState = payload.event?.data?.new_state ?? null;
			}, { type: 'subscribe_events', event_type: 'state_changed' });
		})();
		return () => {
			unsub?.();
			unsub = null;
		};
	});

	const storeEntity = $derived(
		entityId ? $entityStore.entities.find((entity) => entity.entityId === entityId) : undefined
	);
	const storeSun = $derived(
		$entityStore.entities.find((entity) => entity.entityId === 'sun.sun')
	);
	const state = $derived(
		embeddedState ??
			(storeEntity
				? {
						state: storeEntity.state,
						attributes: storeEntity.attributes
					}
				: null)
	);
	const attrs = $derived((state?.attributes as Record<string, unknown> | undefined) ?? {});
	const condition = $derived(typeof state?.state === 'string' ? state.state : '');
	const belowHorizon = $derived(
		(typeof hass?.states?.['sun.sun']?.state === 'string' && hass.states['sun.sun'].state === 'below_horizon') ||
			(!hass?.states?.['sun.sun'] && storeSun?.state === 'below_horizon')
	);
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
				<img src={meteoconSrc} alt="" width="46" height="46" on:error={() => (iconFailed = true)} />
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
