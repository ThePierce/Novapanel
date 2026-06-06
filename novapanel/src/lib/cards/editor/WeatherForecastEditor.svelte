<script lang="ts">
	import EditorSection from '$lib/cards/editor/EditorSection.svelte';
	import { selectedLanguageStore, translate } from '$lib/i18n';

	type Props = {
		t: (key: string) => string;
		weatherForecastType?: 'daily' | 'hourly' | 'twice_daily';
		weatherForecastDaysToShow?: number;
		onWeatherForecastTypeChange: (v: 'daily' | 'hourly' | 'twice_daily') => void;
		onWeatherForecastDaysToShowChange: (v: number) => void;
	};

	let p: Props = $props();

	function clampDays(value: number, fallback = 5) {
		if (!Number.isFinite(value)) return Math.max(1, Math.min(7, fallback));
		return Math.max(1, Math.min(7, Math.round(value)));
	}

	function handleDaysToShowInput(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		if (input.value.trim() === '') return;
		const fallback = clampDays(p.weatherForecastDaysToShow ?? 5);
		p.onWeatherForecastDaysToShowChange(clampDays(Number(input.value), fallback));
	}
</script>

<EditorSection
	title={translate('Voorspelling', $selectedLanguageStore)}
	icon="chart-line"
	tone="cyan"
	status="filled"
	statusLabel={`${p.weatherForecastDaysToShow ?? 5} ${translate('Dagen', $selectedLanguageStore).toLowerCase()}`}
	open
>
	<div class="np-help">
		{translate('Welk type voorspelling en hoeveel dagen er getoond worden.', $selectedLanguageStore)}
	</div>
	<div class="np-grid-2">
		<div class="np-field">
			<span class="np-label">{p.t('forecastType')}</span>
			<select
				class="np-input"
				value={p.weatherForecastType ?? 'daily'}
				onchange={(event) =>
					p.onWeatherForecastTypeChange(
						(event.currentTarget as HTMLSelectElement).value as 'daily' | 'hourly' | 'twice_daily'
					)}
			>
				<option value="daily">{p.t('forecastTypeDaily')}</option>
				<option value="hourly">{p.t('forecastTypeHourly')}</option>
				<option value="twice_daily">{p.t('forecastTypeTwiceDaily')}</option>
			</select>
		</div>
		<div class="np-field">
			<span class="np-label">{p.t('daysToShow')}</span>
			<input
				class="np-input"
				type="number"
				min="1"
				max="7"
				value={String(p.weatherForecastDaysToShow ?? 5)}
				oninput={handleDaysToShowInput}
			/>
		</div>
	</div>
</EditorSection>
