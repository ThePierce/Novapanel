<script lang="ts">
	import WeatherIcon from '$lib/cards/WeatherIcon.svelte';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import { entityStore } from '$lib/ha/entities-store';
	import { subscribeWeatherForecastDirect } from '$lib/ha/weather-forecast-service';
	import { translate, translations, type LanguageCode, type TranslationKey } from '$lib/i18n';

	type Props = {
		t: (key: TranslationKey) => string;
		entityId?: string;
		locale?: string;
		onClose: () => void;
	};

	let { t, entityId, locale = 'nl', onClose }: Props = $props();

	let hourlyForecast = $state<Array<Record<string, unknown>>>([]);
	let unsubHourly: (() => void) | null = null;
	let hourlyIconFailed = $state<Record<number, boolean>>({});

	$effect(() => {
		unsubHourly?.();
		unsubHourly = null;
		hourlyForecast = [];
		const id = entityId;
		if (!id) return;
		(async () => {
			unsubHourly = await subscribeWeatherForecastDirect({
				entityId: id,
				forecastType: 'hourly',
				onForecast: (forecast) => {
					hourlyForecast = forecast;
				}
			});
		})();
		return () => { unsubHourly?.(); unsubHourly = null; };
	});

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
	const belowHorizon = $derived(
		storeSun?.state === 'below_horizon'
	);
	const tempUnit = $derived(typeof attrs.temperature_unit === 'string' ? attrs.temperature_unit : '°C');
	const sunAttrs = $derived(
		storeSun?.attributes ?? {}
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
	function uvLabel(uv: number): { text: string; color: string } {
		if (uv <= 2) return { text: 'Laag', color: '#4caf50' };
		if (uv <= 5) return { text: 'Matig', color: '#f9a825' };
		if (uv <= 7) return { text: 'Hoog', color: '#f57c00' };
		if (uv <= 10) return { text: 'Zeer hoog', color: '#d32f2f' };
		return { text: 'Extreem', color: '#9c27b0' };
	}
	function meteoconName(value: string, night: boolean): string {
		const base = (value || 'sunny').trim();
		if (!base) return night ? 'clear-night' : 'sunny-day';
		if (base.endsWith('-night') || base.endsWith('-day')) return base;
		return `${base}-${night ? 'night' : 'day'}`;
	}
	function translateCondition(value: string): string {
		if (!value) return '';
		const key = `weather_${value.replace(/-/g, '_')}`;
		const catalog = translations[locale as LanguageCode] as Record<string, string>;
		return catalog[key] ?? value;
	}
	function formatHour(dt: string): string {
		if (!dt) return '-';
		try { return new Date(dt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }); }
		catch { return '-'; }
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

	// --- derived ---
	const locationName = $derived(typeof attrs.friendly_name === 'string' ? attrs.friendly_name : '');
	const sunriseTime = $derived(getTodaySunTime(sunAttrs.next_rising));
	const sunsetTime = $derived(getTodaySunTime(sunAttrs.next_setting));
	const next24Hours = $derived(hourlyForecast.slice(0, 24));
	const uvInfo = $derived(typeof attrs.uv_index === 'number' ? uvLabel(attrs.uv_index) : null);
	const uvIndex = $derived(typeof attrs.uv_index === 'number' ? attrs.uv_index : null);

	const currentTemp = $derived(typeof attrs.temperature === 'number' ? Math.round(attrs.temperature) : null);
	const feelsLikeNow = $derived(typeof attrs.apparent_temperature === 'number' ? Math.round(attrs.apparent_temperature) : null);

	// Build SVG path for the temperature curve over the next 24 hours
	type CurvePoint = { x: number; y: number; temp: number; precipMm: number; precipProb: number; idx: number };
	const tempCurve = $derived.by((): {
		path: string;
		areaPath: string;
		points: CurvePoint[];
		minT: number;
		maxT: number;
		precipMax: number;
	} => {
		const items = next24Hours;
		if (items.length < 2) return { path: '', areaPath: '', points: [], minT: 0, maxT: 0, precipMax: 0 };
		const temps = items.map((i) => (typeof i.temperature === 'number' ? i.temperature : null)).filter((v): v is number => v !== null);
		if (temps.length < 2) return { path: '', areaPath: '', points: [], minT: 0, maxT: 0, precipMax: 0 };
		const minT = Math.min(...temps);
		const maxT = Math.max(...temps);
		const range = Math.max(1, maxT - minT);
		const padTop = 14, padBottom = 26, padX = 4;
		const W = 1000, H = 100;
		const innerH = H - padTop - padBottom;
		const stepX = (W - padX * 2) / (items.length - 1);
		const points: CurvePoint[] = [];
		items.forEach((it, idx) => {
			const tNum = typeof it.temperature === 'number' ? it.temperature : null;
			const pNum = typeof it.precipitation === 'number' ? it.precipitation : 0;
			const pProb = typeof it.precipitation_probability === 'number' ? it.precipitation_probability : 0;
			if (tNum === null) return;
			const x = padX + idx * stepX;
			const y = padTop + (1 - (tNum - minT) / range) * innerH;
			points.push({ x, y, temp: tNum, precipMm: pNum, precipProb: pProb, idx });
		});
		// Smooth curve with Catmull-Rom -> Bezier
		const path = points.length === 0 ? '' : points.reduce((acc, p, i) => {
			if (i === 0) return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
			const prev = points[i - 1];
			const cx = (prev.x + p.x) / 2;
			return `${acc} Q ${cx.toFixed(1)} ${prev.y.toFixed(1)} ${cx.toFixed(1)} ${((prev.y + p.y) / 2).toFixed(1)} T ${p.x.toFixed(1)} ${p.y.toFixed(1)}`;
		}, '');
		const areaPath = path ? `${path} L ${points[points.length-1].x.toFixed(1)} ${(H - padBottom).toFixed(1)} L ${points[0].x.toFixed(1)} ${(H - padBottom).toFixed(1)} Z` : '';
		const precipMax = Math.max(0.5, ...items.map((i) => typeof i.precipitation === 'number' ? i.precipitation : 0));
		return { path, areaPath, points, minT, maxT, precipMax };
	});
</script>

<button type="button" class="modal-overlay" onclick={onClose} aria-label={t('closeOverlay')}></button>
<section class="settings-modal app-popup weather-detail-modal np-detail" role="dialog" aria-modal="true" aria-label={t('cardTypeWeather')}>
	<div class="np-detail-head" style="--np-tint: rgba(34,211,238,0.18); --np-color: #22d3ee;">
		<div class="np-detail-head-glow" aria-hidden="true"></div>
		<div class="np-detail-head-icon"><TablerIcon name="cloud" size={22} /></div>
		<div class="np-detail-head-text">
			<div class="np-detail-head-title">{locationName || t('cardTypeWeather')}</div>
			<div class="np-detail-head-sub">{t('cardTypeWeather')}</div>
		</div>
		</div>

	<div class="weather-body">
		<!-- Hero — huidige conditie groot -->
		<div class="weather-hero">
			<div class="hero-cond">
				{#if condition}
					{@const heroSrc = `${ingressBase}/weather/meteocons/${meteoconName(condition, belowHorizon)}.svg`}
					<img class="hero-icon" src={heroSrc} alt={translateCondition(condition)} width="78" height="78"
						onerror={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />
				{/if}
			</div>
			<div class="hero-text">
				{#if currentTemp !== null}
					<div class="hero-temp">{currentTemp}<span class="hero-temp-unit">{tempUnit}</span></div>
				{/if}
				<div class="hero-condition">{condition ? translateCondition(condition) : ''}</div>
				{#if feelsLikeNow !== null && feelsLikeNow !== currentTemp}
					<div class="hero-feels">Voelt als {feelsLikeNow}{tempUnit}</div>
				{/if}
			</div>
			<div class="hero-sun">
				{#if sunriseTime}
					<div class="hero-sun-item">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<circle cx="12" cy="12" r="4" fill="#ffd35a"/>
							<path d="M12 4v1.5M5.6 5.6l1.1 1.1M4 12h1.5M5.6 18.4l1.1-1.1M12 18.5V20M18.4 18.4l-1.1-1.1M20 12h-1.5M18.4 5.6l-1.1 1.1" stroke="#ffd35a" stroke-width="1.5" stroke-linecap="round"/>
							<path d="M3 19h18" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" stroke-linecap="round"/>
							<path d="M9 19l3-4 3 4" stroke="#ffd35a" stroke-width="1.5" stroke-linecap="round" fill="none"/>
						</svg>
						<span>{sunriseTime}</span>
					</div>
				{/if}
				{#if sunsetTime}
					<div class="hero-sun-item set">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
							<circle cx="12" cy="12" r="4" fill="#e57373"/>
							<path d="M12 4v1.5M5.6 5.6l1.1 1.1M4 12h1.5M5.6 18.4l1.1-1.1M12 18.5V20M18.4 18.4l-1.1-1.1M20 12h-1.5M18.4 5.6l-1.1 1.1" stroke="#e57373" stroke-width="1.5" stroke-linecap="round"/>
							<path d="M3 19h18" stroke="rgba(255,255,255,0.4)" stroke-width="1.2" stroke-linecap="round"/>
							<path d="M15 19l-3-4-3 4" stroke="#e57373" stroke-width="1.5" stroke-linecap="round" fill="none"/>
						</svg>
						<span>{sunsetTime}</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Current conditions compact chips -->
		{#if Object.keys(attrs).length > 0}
			<div class="metrics-bar">
				{#if typeof attrs.humidity === 'number'}
					<span class="chip">💧 {attrs.humidity}%</span>
				{/if}
				{#if typeof attrs.dew_point === 'number'}
					<span class="chip">🌫️ {Math.round(attrs.dew_point)}{tempUnit}</span>
				{/if}
				{#if uvInfo && uvIndex !== null}
					<span class="chip" style="color:{uvInfo.color}">☀️ UV {uvIndex.toFixed(1)} — {uvInfo.text}</span>
				{/if}
				{#if typeof attrs.pressure === 'number'}
					<span class="chip">🔵 {Math.round(attrs.pressure)} {typeof attrs.pressure_unit === 'string' ? attrs.pressure_unit : 'hPa'}</span>
				{/if}
				{#if typeof attrs.cloud_coverage === 'number'}
					<span class="chip">☁️ {attrs.cloud_coverage}%</span>
				{/if}
				{#if typeof attrs.wind_speed === 'number'}
					<span class="chip">
						💨
						{#if typeof attrs.wind_bearing === 'number'}
							{bearingToCompass(attrs.wind_bearing as number)}{toBeaufort(attrs.wind_speed as number)}
						{:else}
							{Math.round(attrs.wind_speed as number)} {typeof attrs.wind_speed_unit === 'string' ? attrs.wind_speed_unit : 'km/h'}
						{/if}
					</span>
				{/if}
			</div>
		{/if}

		<!-- Temperature curve chart -->
		{#if next24Hours.length > 1 && tempCurve.points.length > 1}
			<div class="chart-tile">
				<div class="chart-head">
					<span class="chart-title">Temperatuur — komende 24u</span>
					<span class="chart-range">{Math.round(tempCurve.minT)}{tempUnit} — {Math.round(tempCurve.maxT)}{tempUnit}</span>
				</div>
				<svg class="temp-chart" viewBox="0 0 1000 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
					<defs>
						<linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stop-color="#22d3ee" stop-opacity="0.30"/>
							<stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
						</linearGradient>
					</defs>
					<!-- precipitation bars at the bottom -->
					{#each tempCurve.points as p (p.idx)}
						{#if p.precipMm > 0}
							{@const barH = Math.min(20, (p.precipMm / tempCurve.precipMax) * 20)}
							<rect x={p.x - 4} y={100 - 26 + (20 - barH)} width="8" height={barH} rx="1.5" fill="#60a5fa" opacity="0.45"/>
						{/if}
					{/each}
					<!-- area under curve -->
					<path d={tempCurve.areaPath} fill="url(#tempGrad)"/>
					<!-- the curve -->
					<path d={tempCurve.path} fill="none" stroke="#22d3ee" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
					<!-- temp labels every 6 hours -->
					{#each tempCurve.points as p, i (p.idx)}
						{#if i % 6 === 0 || i === tempCurve.points.length - 1}
							<text x={p.x} y={p.y - 6} text-anchor="middle" fill="rgba(255,255,255,0.85)" font-size="13" font-weight="500">{Math.round(p.temp)}°</text>
						{/if}
					{/each}
				</svg>
			</div>
		{/if}

		<!-- Hourly forecast strip — horizontal scroll -->
		{#if next24Hours.length > 0}
			<div class="np-detail-section-title">{t('forecastTypeHourly')}</div>
			<div class="hour-strip">
				{#each next24Hours as item, idx (idx)}
					{@const dt = typeof item.datetime === 'string' ? item.datetime : ''}
					{@const temp = typeof item.temperature === 'number' ? Math.round(item.temperature) : null}
					{@const precip = typeof item.precipitation === 'number' ? item.precipitation : null}
					{@const precipProb = typeof item.precipitation_probability === 'number' ? item.precipitation_probability : null}
					{@const speed = typeof item.wind_speed === 'number' ? item.wind_speed : null}
					{@const bearing = typeof item.wind_bearing === 'number' ? item.wind_bearing : null}
					{@const cond = typeof item.condition === 'string' ? item.condition : ''}
					{@const skipMc = cond.trim().toLowerCase() === 'clear-night'}
					{@const src = `${ingressBase}/weather/meteocons/${meteoconName(cond, belowHorizon)}.svg`}
					<div class="hour-card">
						<div class="hour-time">{idx === 0 ? translate('Nu', locale as LanguageCode) : formatHour(dt)}</div>
						<div class="hour-icon">
							{#if !hourlyIconFailed[idx] && !skipMc && cond}
								<img src={src} alt={translateCondition(cond)} width="36" height="36"
									onerror={() => (hourlyIconFailed = { ...hourlyIconFailed, [idx]: true })} />
							{:else if cond}
								<WeatherIcon condition={cond} night={belowHorizon} size={36} />
							{/if}
						</div>
						<div class="hour-temp">{temp === null ? '–' : `${temp}°`}</div>
						{#if precipProb !== null && precipProb > 0}
							<div class="hour-precip">
								<span class="hour-precip-drop">💧</span>
								<span>{precipProb}%</span>
							</div>
						{:else if precip !== null && precip > 0}
							<div class="hour-precip">
								<span class="hour-precip-drop">💧</span>
								<span>{precip.toFixed(1)}mm</span>
							</div>
						{:else}
							<div class="hour-precip dim">—</div>
						{/if}
						{#if speed !== null}
							<div class="hour-wind">
								{#if bearing !== null}
									<span class="hour-wind-arrow" style="transform:rotate({bearing + 180}deg)">↑</span>
									<span>{bearingToCompass(bearing)}{toBeaufort(speed)}</span>
								{:else}
									<span>{Math.round(speed)}</span>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{:else}
			<div class="empty-state">{translate('Uurvoorspelling laden…', locale as LanguageCode)}</div>
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

	.weather-body {
		display: flex; flex-direction: column; gap: 12px;
		overflow-y: auto;
		overflow-x: hidden;
		min-height: 0;
		padding: 14px 22px 22px;
		scrollbar-width: none;
		-ms-overflow-style: none;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		touch-action: pan-y;
	}
	.weather-body::-webkit-scrollbar { width: 0; height: 0; display: none; }

	/* Hero — current condition large */
	.weather-hero {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 14px;
		padding: 16px 18px;
		background: linear-gradient(135deg, rgba(34,211,238,0.06), transparent 60%), rgba(255,255,255,0.025);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 13px;
	}
	.hero-cond {
		display: grid;
		place-items: center;
		width: 78px; height: 78px;
		flex-shrink: 0;
	}
	.hero-icon { display: block; }
	.hero-text {
		display: flex; flex-direction: column;
		gap: 2px; min-width: 0;
	}
	.hero-temp {
		font-size: 42px;
		font-weight: 300;
		line-height: 1;
		letter-spacing: -0.03em;
		color: #fff;
		font-variant-numeric: tabular-nums;
	}
	.hero-temp-unit {
		font-size: 22px;
		color: rgba(255,255,255,0.55);
		margin-left: 2px;
	}
	.hero-condition {
		font-size: 14px;
		font-weight: 500;
		color: rgba(255,255,255,0.85);
		text-transform: capitalize;
		margin-top: 2px;
	}
	.hero-feels {
		font-size: 11.5px;
		color: rgba(255,255,255,0.5);
		font-weight: 500;
	}
	.hero-sun {
		display: flex; flex-direction: column; gap: 6px;
		align-items: flex-end;
		flex-shrink: 0;
	}
	.hero-sun-item {
		display: flex; align-items: center; gap: 6px;
		font-size: 12.5px; font-weight: 500; white-space: nowrap;
		color: rgba(255,255,255,0.85);
		font-variant-numeric: tabular-nums;
	}
	.hero-sun-item.set { color: rgba(255,255,255,0.7); }

	/* Metrics chips bar — modern pill design */
	.metrics-bar {
		display: flex; flex-wrap: wrap; gap: 6px;
	}
	.chip {
		font-size: 11.5px;
		padding: 5px 10px;
		background: rgba(255,255,255,0.04);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 999px;
		white-space: nowrap;
		color: rgba(255,255,255,0.85);
		font-weight: 500;
		transition: background 0.15s, border-color 0.15s;
	}
	.chip:hover {
		background: rgba(255,255,255,0.06);
		border-color: rgba(255,255,255,0.13);
	}

	/* Temperature curve chart */
	.chart-tile {
		padding: 12px 14px 8px;
		background: rgba(255,255,255,0.025);
		border: 0.5px solid rgba(255,255,255,0.07);
		border-radius: 13px;
	}
	.chart-head {
		display: flex; justify-content: space-between; align-items: baseline;
		gap: 8px;
		margin-bottom: 4px;
	}
	.chart-title {
		font-size: 10.5px; font-weight: 600;
		color: rgba(255,255,255,0.5);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.chart-range {
		font-size: 11.5px;
		color: rgba(255,255,255,0.55);
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}
	.temp-chart {
		width: 100%; height: 100px;
		display: block;
	}

	/* Section title */
	.np-detail-section-title {
		font-size: 10.5px; font-weight: 600;
		color: rgba(255,255,255,0.5);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		padding: 4px 0 0;
	}

	/* Hourly strip — horizontal scroll */
	.hour-strip {
		display: flex;
		gap: 8px;
		overflow-x: auto;
		overflow-y: hidden;
		padding: 4px 4px 8px;
		margin: 0 -4px;
		scrollbar-width: none;
		-ms-overflow-style: none;
		scroll-snap-type: x proximity;
	}
	.hour-strip::-webkit-scrollbar { width: 0; height: 0; display: none; }

	.hour-card {
		display: flex; flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 10px 8px;
		min-width: 64px;
		flex-shrink: 0;
		background: rgba(255,255,255,0.025);
		border: 0.5px solid rgba(255,255,255,0.07);
		border-radius: 11px;
		scroll-snap-align: start;
		transition: background 0.15s, border-color 0.15s, transform 0.15s;
	}
	.hour-card:hover {
		background: rgba(255,255,255,0.045);
		border-color: rgba(255,255,255,0.13);
		transform: translateY(-1px);
	}
	.hour-card:first-child {
		background: linear-gradient(135deg, rgba(34,211,238,0.08), transparent 60%), rgba(255,255,255,0.04);
		border-color: rgba(34,211,238,0.20);
	}
	.hour-time {
		font-size: 11px;
		font-weight: 600;
		color: rgba(255,255,255,0.55);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-variant-numeric: tabular-nums;
	}
	.hour-icon {
		display: grid; place-items: center;
		width: 36px; height: 36px;
	}
	.hour-icon img { display: block; }
	.hour-temp {
		font-size: 15px;
		font-weight: 600;
		color: #fff;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.01em;
	}
	.hour-precip {
		display: flex; align-items: center; gap: 2px;
		font-size: 10.5px;
		color: #93c5fd;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}
	.hour-precip.dim {
		color: rgba(255,255,255,0.25);
	}
	.hour-precip-drop {
		font-size: 9px;
		opacity: 0.85;
	}
	.hour-wind {
		display: flex; align-items: center; gap: 3px;
		font-size: 10px;
		color: rgba(255,255,255,0.55);
		font-weight: 500;
	}
	.hour-wind-arrow {
		display: inline-block;
		font-size: 11px;
		line-height: 1;
		opacity: 0.75;
	}

	.empty-state {
		display: flex; align-items: center; justify-content: center;
		flex: 1; color: rgba(255,255,255,0.45); font-size: 13px; padding: 32px 0;
	}
</style>
