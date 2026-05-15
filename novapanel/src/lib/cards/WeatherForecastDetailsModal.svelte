<script lang="ts">
	import type { TranslationKey } from '$lib/i18n';
	import WeatherIcon from '$lib/cards/WeatherIcon.svelte';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import { getHassWithRetry, type HassLike } from '$lib/ha/entities-service-helpers';
	import { entityStore } from '$lib/ha/entities-store';
	import { extractWeatherForecast, subscribeWeatherForecastDirect } from '$lib/ha/weather-forecast-service';
	import { translations, type LanguageCode } from '$lib/i18n';

	type Props = {
		t: (key: TranslationKey) => string;
		entityId?: string;
		locale?: string;
		forecastType?: 'daily' | 'hourly' | 'twice_daily';
		daysToShow?: number;
		onClose: () => void;
	};

	let { t, entityId, locale = 'nl', forecastType = 'daily', daysToShow = 7, onClose }: Props = $props();

	let hass = $state<HassLike | null>(null);
	let forecast = $state<Array<Record<string, unknown>>>([]);
	let unsub: (() => void) | null = null;
	let iconFailed = $state<Record<number, boolean>>({});

	$effect(() => {
		let disposed = false;
		(async () => {
			const next = await getHassWithRetry();
			if (disposed) return;
			hass = next;
		})();
		return () => { disposed = true; };
	});

	async function subscribeForecast(next: HassLike | null, id?: string, type?: 'daily' | 'hourly' | 'twice_daily') {
		unsub?.();
		unsub = null;
		forecast = [];
		const connection = next?.connection;
		if (!id) return;
		if (connection?.subscribeMessage) {
			unsub = await connection.subscribeMessage((message) => {
				const nextForecast = extractWeatherForecast(message);
				if (nextForecast) forecast = nextForecast;
			}, { type: 'weather/subscribe_forecast', entity_id: id, forecast_type: type ?? 'daily' });
			return;
		}
		unsub = await subscribeWeatherForecastDirect({
			entityId: id,
			forecastType: type ?? 'daily',
			onForecast: (nextForecast) => {
				forecast = nextForecast;
			}
		});
	}

	$effect(() => {
		const nextHass = hass;
		const id = entityId;
		const type = forecastType;
		void subscribeForecast(nextHass, id, type);
		return () => { unsub?.(); unsub = null; };
	});

	const shown = $derived(forecast.slice(0, Math.max(1, Math.min(7, daysToShow))));
	const storeSun = $derived(
		$entityStore.entities.find((entity) => entity.entityId === 'sun.sun')
	);
	const belowHorizon = $derived(
		(typeof hass?.states?.['sun.sun']?.state === 'string' && hass.states['sun.sun'].state === 'below_horizon') ||
			(!hass?.states?.['sun.sun'] && storeSun?.state === 'below_horizon')
	);
	const sunAttrs = $derived(
		(hass?.states?.['sun.sun']?.attributes as Record<string, unknown> | undefined) ?? storeSun?.attributes ?? {}
	);

	const ingressBase = typeof window !== 'undefined'
		? (((window as unknown as { __novapanel_ingress?: string }).__novapanel_ingress || '') as string)
		: '';

	// --- helpers ---
	const COMPASS_NL = ['N','NNO','NO','ONO','O','OZO','ZO','ZZO','Z','ZZW','ZW','WZW','W','WNW','NW','NNW'];
	function bearingToCompass(deg: number): string {
		return COMPASS_NL[Math.round(deg / 22.5) % 16] ?? '';
	}
	function toBeaufort(kmh: number): number {
		if (kmh < 1) return 0; if (kmh < 6) return 1; if (kmh < 12) return 2;
		if (kmh < 20) return 3; if (kmh < 29) return 4; if (kmh < 39) return 5;
		if (kmh < 50) return 6; if (kmh < 62) return 7; if (kmh < 75) return 8;
		if (kmh < 89) return 9; if (kmh < 103) return 10; if (kmh < 118) return 11;
		return 12;
	}
	function meteoconName(value: string, night: boolean): string {
		const base = (value || 'sunny').trim();
		if (!base) return night ? 'clear-night' : 'sunny-day';
		if (base.endsWith('-night') || base.endsWith('-day')) return base;
		return `${base}-${night ? 'night' : 'day'}`;
	}
	function tCondition(value: string): string {
		if (!value) return '';
		const key = `weather_${value.replace(/-/g, '_')}`;
		const catalog = translations[locale as LanguageCode] as Record<string, string>;
		return catalog[key as string] ?? value;
	}
	function getTodaySunTime(isoStr: unknown): string {
		if (typeof isoStr !== 'string') return '';
		try {
			const d = new Date(isoStr);
			const today = new Date(); today.setHours(0, 0, 0, 0);
			const tomorrow = new Date(today.getTime() + 86400000);
			const target = d >= tomorrow ? new Date(d.getTime() - 86400000) : d;
			return target.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
		} catch { return ''; }
	}
	function dayLabel(dt: string): { name: string; date: string } {
		if (!dt) return { name: '-', date: '' };
		try {
			const d = new Date(dt);
			const today = new Date(); today.setHours(0, 0, 0, 0);
			const tomorrow = new Date(today.getTime() + 86400000);
			const isToday = d >= today && d < tomorrow;
			const isTomorrow = d >= tomorrow && d < new Date(tomorrow.getTime() + 86400000);
			const name = isToday ? 'Vandaag' : isTomorrow ? 'Morgen'
				: d.toLocaleDateString(locale, { weekday: 'long' });
			const date = d.toLocaleDateString(locale, { day: 'numeric', month: 'short' });
			return { name, date };
		} catch { return { name: '-', date: '' }; }
	}

	// --- derived ---
	const sunriseTime = $derived(getTodaySunTime(sunAttrs.next_rising));
	const sunsetTime = $derived(getTodaySunTime(sunAttrs.next_setting));
	// Shared min/max across all days for the temp-range bar
	const globalRange = $derived.by(() => {
		const highs = shown.map((i) => (typeof i.temperature === 'number' ? i.temperature : null)).filter((v): v is number => v !== null);
		const lows = shown.map((i) => (typeof i.templow === 'number' ? i.templow : null)).filter((v): v is number => v !== null);
		const all = [...highs, ...lows];
		if (all.length === 0) return { min: 0, max: 1 };
		const min = Math.floor(Math.min(...all));
		const max = Math.ceil(Math.max(...all));
		return { min, max: max === min ? min + 1 : max };
	});
</script>

<button type="button" class="modal-overlay" onclick={onClose} aria-label={t('closeOverlay')}></button>
<section class="settings-modal app-popup weather-forecast-detail-modal np-detail" role="dialog" aria-modal="true" aria-label={t('cardTypeWeatherForecast')}>
	<div class="np-detail-head" style="--np-tint: rgba(34,211,238,0.18); --np-color: #22d3ee;">
		<div class="np-detail-head-glow" aria-hidden="true"></div>
		<div class="np-detail-head-icon"><TablerIcon name="cloud-storm" size={22} /></div>
		<div class="np-detail-head-text">
			<div class="np-detail-head-title">{t('cardTypeWeatherForecast')}</div>
			<div class="np-detail-head-sub">Voorspelling voor de komende dagen</div>
		</div>
		<div class="np-forecast-sun-times">
			{#if sunriseTime}
				<span class="sun-item">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path d="M12 3v2M5.22 5.22l1.42 1.42M3 12h2M5.22 18.78l1.42-1.42M12 21v-2M18.78 18.78l-1.42-1.42M21 12h-2M18.78 5.22l-1.42 1.42" stroke="#ffd35a" stroke-width="2" stroke-linecap="round"/>
						<path d="M4 17h16" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linecap="round"/>
						<path d="M12 7a5 5 0 0 1 5 5" stroke="#ffd35a" stroke-width="2" stroke-linecap="round" fill="none"/>
						<path d="M12 7a5 5 0 0 0-5 5" stroke="#ffd35a" stroke-width="2" stroke-linecap="round" fill="none"/>
					</svg>
					{sunriseTime}
				</span>
			{/if}
			{#if sunsetTime}
				<span class="sun-item sun-item-set">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
						<path d="M12 3v2M5.22 5.22l1.42 1.42M3 12h2M5.22 18.78l1.42-1.42M12 21v-2M18.78 18.78l-1.42-1.42M21 12h-2M18.78 5.22l-1.42 1.42" stroke="#e57373" stroke-width="2" stroke-linecap="round"/>
						<path d="M4 17h16" stroke="rgba(255,255,255,0.4)" stroke-width="1.5" stroke-linecap="round"/>
						<path d="M12 17a5 5 0 0 1-5-5" stroke="#e57373" stroke-width="2" stroke-linecap="round" fill="none"/>
						<path d="M12 17a5 5 0 0 0 5-5" stroke="#e57373" stroke-width="2" stroke-linecap="round" fill="none"/>
					</svg>
					{sunsetTime}
				</span>
			{/if}
		</div>
		</div>

	<div class="forecast-body">
		{#if !entityId}
			<div class="empty-state">{t('cardTypeWeatherForecast')}</div>
		{:else if shown.length === 0}
			<div class="empty-state">Voorspelling laden…</div>
		{:else}
			<div class="day-list">
				{#each shown as item, idx (idx)}
					{@const dt = typeof item.datetime === 'string' ? item.datetime : ''}
					{@const high = typeof item.temperature === 'number' ? Math.round(item.temperature) : null}
					{@const low = typeof item.templow === 'number' ? Math.round(item.templow) : null}
					{@const precip = typeof item.precipitation === 'number' ? item.precipitation : null}
					{@const precipProb = typeof item.precipitation_probability === 'number' ? item.precipitation_probability : null}
					{@const speed = typeof item.wind_speed === 'number' ? item.wind_speed : null}
					{@const bearing = typeof item.wind_bearing === 'number' ? item.wind_bearing : null}
					{@const cond = typeof item.condition === 'string' ? item.condition : ''}
					{@const skipMc = cond.trim().toLowerCase() === 'clear-night'}
					{@const src = `${ingressBase}/weather/meteocons/${meteoconName(cond, false)}.svg`}
					{@const label = dayLabel(dt)}
					{@const range = globalRange.max - globalRange.min}
					{@const lowPct = low !== null ? ((low - globalRange.min) / range) * 100 : null}
					{@const highPct = high !== null ? ((high - globalRange.min) / range) * 100 : null}
					<div class="day-card" class:today={idx === 0}>
						<div class="day-label">
							<span class="day-name">{label.name}</span>
							{#if label.date}
								<span class="day-date">{label.date}</span>
							{/if}
						</div>
						<div class="day-icon">
							{#if !iconFailed[idx] && !skipMc && cond}
								<img src={src} alt={tCondition(cond)} width="44" height="44"
									onerror={() => (iconFailed = { ...iconFailed, [idx]: true })} />
							{:else if cond}
								<WeatherIcon condition={cond} night={false} size={44} />
							{/if}
						</div>
						<div class="day-condition">{cond ? tCondition(cond) : ''}</div>
						<div class="day-temp-row">
							<span class="day-temp-low">{low === null ? '' : `${low}°`}</span>
							<div class="day-temp-bar">
								{#if lowPct !== null && highPct !== null}
									<div class="day-temp-fill" style="left: {lowPct}%; width: {Math.max(2, highPct - lowPct)}%;"></div>
								{:else if highPct !== null}
									<div class="day-temp-fill" style="left: {Math.max(0, highPct - 2)}%; width: 2%;"></div>
								{/if}
							</div>
							<span class="day-temp-high">{high === null ? '–' : `${high}°`}</span>
						</div>
						<div class="day-extras">
							{#if precipProb !== null && precipProb > 0}
								<span class="day-extra precip">💧 {precipProb}%</span>
							{:else if precip !== null && precip > 0}
								<span class="day-extra precip">💧 {precip.toFixed(1)}mm</span>
							{/if}
							{#if speed !== null}
								<span class="day-extra wind">
									{#if bearing !== null}
										<span class="day-wind-arrow" style="transform:rotate({bearing + 180}deg)">↑</span>
										{bearingToCompass(bearing)}{toBeaufort(speed)}
									{:else}
										💨 {Math.round(speed)} km/h
									{/if}
								</span>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</section>

<style>
	.modal-overlay {
		position: fixed; inset: 0; background: rgba(0,0,0,0.45);
		border: 0; padding: 0; margin: 0; z-index: 40; cursor: default;
	}
	.np-detail.settings-modal {
		position: fixed; top: 50%; left: 50%;
		background: linear-gradient(180deg, #1a2238 0%, #0f1424 100%);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 18px; padding: 0; z-index: 60;
		transform: translate(-50%, -50%);
		overflow: hidden;
	}
	.np-detail.settings-modal::before { content: ''; position: absolute; top: 0; left: 50%; width: 60%; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent); transform: translateX(-50%); pointer-events: none; }
	.app-popup {
		width: min(var(--popup-width, 850px), calc(100vw - 1.5rem));
		height: min(var(--popup-height, 1140px), calc(100vh - 1.5rem));
		max-height: calc(100vh - 1.5rem);
		display: grid; grid-template-rows: auto 1fr; overflow: hidden;
	}

	/* Premium detail-modal header */
	.np-detail-head { padding: 18px 22px 14px; border-bottom: 0.5px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 12px; position: relative; overflow: hidden; flex-shrink: 0; }
	.np-detail-head-glow { position: absolute; top: -100px; left: -40px; width: 220px; height: 220px; background: radial-gradient(circle, var(--np-tint, rgba(96,165,250,0.18)), transparent 70%); pointer-events: none; filter: blur(20px); }
	.np-detail-head-icon { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; background: var(--np-tint); border: 0.5px solid rgba(255,255,255,0.10); color: var(--np-color); flex-shrink: 0; position: relative; z-index: 1; }
	.np-detail-head-text { flex: 1; min-width: 0; position: relative; z-index: 1; }
	.np-detail-head-title { font-size: 15px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.2; color: #f5f5f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.np-detail-head-sub { font-size: 11.5px; color: rgba(255,255,255,0.5); margin-top: 3px; }
	.np-detail-head-close { background: rgba(255,255,255,0.05); border: 0.5px solid rgba(255,255,255,0.08); width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: rgba(255,255,255,0.6); cursor: pointer; position: relative; z-index: 1; transition: background 0.15s, transform 0.15s; flex-shrink: 0; }
	.np-detail-head-close:hover { background: rgba(255,255,255,0.10); transform: scale(1.05); }
	.np-forecast-sun-times { display: flex; align-items: center; gap: 0.7rem; position: relative; z-index: 1; flex-shrink: 0; }

	.sun-item {
		display: flex; align-items: center; gap: 5px;
		font-size: 12.5px; font-weight: 500; white-space: nowrap;
		color: rgba(255,255,255,0.85);
	}
	.sun-item-set { opacity: 0.85; }

	.forecast-body {
		overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column;
		min-height: 0;
		padding: 14px 22px 22px;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		touch-action: pan-y;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}
	.forecast-body::-webkit-scrollbar { width: 0; height: 0; display: none; }

	.empty-state {
		display: flex; align-items: center; justify-content: center;
		flex: 1; color: rgba(255,255,255,0.45); font-size: 13px; padding: 32px 0;
	}

	/* Day list */
	.day-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
		overflow-y: auto;
		overflow-x: hidden;
		flex: 1;
		min-height: 0;
		scrollbar-width: none;
		padding-right: 4px;
	}
	.day-list::-webkit-scrollbar { width: 0; height: 0; display: none; }

	.day-card {
		display: grid;
		grid-template-columns: 110px 56px minmax(0, 1fr) auto;
		grid-template-rows: auto auto;
		grid-template-areas:
			"label icon condition extras"
			"label icon temp temp";
		align-items: center;
		gap: 4px 14px;
		padding: 12px 14px;
		background: rgba(255,255,255,0.025);
		border: 0.5px solid rgba(255,255,255,0.07);
		border-radius: 13px;
		transition: background 0.15s, border-color 0.15s, transform 0.15s;
	}
	.day-card:hover {
		background: rgba(255,255,255,0.04);
		border-color: rgba(255,255,255,0.13);
		transform: translateY(-1px);
	}
	.day-card.today {
		background: linear-gradient(135deg, rgba(34,211,238,0.06), transparent 60%), rgba(255,255,255,0.035);
		border-color: rgba(34,211,238,0.20);
	}

	.day-label {
		grid-area: label;
		display: flex; flex-direction: column; gap: 2px;
		min-width: 0;
		align-self: center;
	}
	.day-name {
		font-weight: 600; font-size: 14px;
		text-transform: capitalize;
		color: #fff;
		letter-spacing: -0.005em;
	}
	.day-date {
		font-size: 11px;
		color: rgba(255,255,255,0.45);
		font-weight: 500;
	}

	.day-icon {
		grid-area: icon;
		display: grid;
		place-items: center;
		width: 56px; height: 56px;
	}
	.day-icon img { display: block; }

	.day-condition {
		grid-area: condition;
		font-size: 12.5px;
		color: rgba(255,255,255,0.75);
		font-weight: 500;
		text-transform: capitalize;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.day-temp-row {
		grid-area: temp;
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.day-temp-low {
		font-size: 12.5px;
		color: rgba(255,255,255,0.55);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		min-width: 22px;
		text-align: right;
	}
	.day-temp-high {
		font-size: 14px;
		color: #fff;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		min-width: 28px;
	}
	.day-temp-bar {
		flex: 1;
		height: 4px;
		background: rgba(255,255,255,0.06);
		border-radius: 999px;
		position: relative;
		overflow: hidden;
		min-width: 50px;
	}
	.day-temp-fill {
		position: absolute;
		top: 0; bottom: 0;
		background: linear-gradient(90deg, #60a5fa 0%, #22d3ee 50%, #fbbf24 100%);
		border-radius: 999px;
	}

	.day-extras {
		grid-area: extras;
		display: flex;
		align-items: center;
		gap: 8px;
		justify-self: end;
	}
	.day-extra {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 11.5px;
		color: rgba(255,255,255,0.7);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		white-space: nowrap;
	}
	.day-extra.precip { color: #93c5fd; }
	.day-wind-arrow {
		display: inline-block;
		font-size: 12px;
		line-height: 1;
		opacity: 0.75;
	}

	/* Hide column-style classes that may still be referenced elsewhere */
	.col-r, .col-wind { /* legacy */ }
</style>
