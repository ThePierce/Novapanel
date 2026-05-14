<script lang="ts">
	import EditorSection from '$lib/cards/editor/EditorSection.svelte';
	import ClockCard from '$lib/cards/ClockCard.svelte';
	import type { ClockStyle } from '$lib/persistence/panel-state-types';

	type Props = {
		t: (key: string) => string;
		analogStyle?: string;
		digitalStyle?: string;
		clockStyle?: ClockStyle;
		clockShowAnalog?: boolean;
		clockShowDigital?: boolean;
		clockHour12?: boolean;
		clockSeconds?: boolean;
		clockMode: string;
		onClockShowAnalogChange: (v: boolean) => void;
		onClockShowDigitalChange: (v: boolean) => void;
		onClockStyleChange: (v: ClockStyle) => void;
		onClockHour12Change: (v: boolean) => void;
		onClockSecondsChange: (v: boolean) => void;
	};

	let p: Props = $props();
</script>

<EditorSection title="Stijl en weergave" icon="palette" tone="cyan" status="filled" statusLabel={p.clockStyle ?? 'digital'} open>
	<div class="np-help">Kies wat de klok toont: digitaal, analoog of beide.</div>
	<div class="np-grid-2">
		<div class="np-field">
			<span class="np-label">Modus</span>
			<select
				class="np-input"
				value={p.clockMode}
				onchange={(event) => {
					const value = (event.currentTarget as HTMLSelectElement).value;
					p.onClockShowAnalogChange(value === 'analog' || value === 'both');
					p.onClockShowDigitalChange(value === 'digital' || value === 'both');
					if (value === 'digital') p.onClockStyleChange('digital');
					if (value !== 'digital' && (p.clockStyle ?? 'digital') === 'digital') p.onClockStyleChange('classic');
				}}
			>
				<option value="digital">{p.t('clockModeDigital')}</option>
				<option value="analog">{p.t('clockModeAnalog')}</option>
				<option value="both">{p.t('clockModeBoth')}</option>
			</select>
		</div>
		<div class="np-field">
			<span class="np-label">Stijl</span>
			<select
				class="np-input"
				value={p.clockStyle ?? 'digital'}
				onchange={(event) => p.onClockStyleChange((event.currentTarget as HTMLSelectElement).value as ClockStyle)}
			>
				<option value="digital">{p.t('clockStyleDigital')}</option>
				<option value="aurora">Aurora ✨</option>
				<option value="classic">{p.t('clockStyleClassic')}</option>
				<option value="luxury_gold">{p.t('clockStyleLuxuryGold')}</option>
				<option value="luxury_steel">{p.t('clockStyleLuxurySteel')}</option>
				<option value="minimal">{p.t('clockStyleMinimal')}</option>
				<option value="dark">{p.t('clockStyleDark')}</option>
				<option value="dots">{p.t('clockStyleDots')}</option>
			</select>
		</div>
	</div>
	<div class="np-toggles">
		<label class="np-toggle">
			<input
				type="checkbox"
				checked={p.clockHour12 ?? false}
				onchange={(event) => p.onClockHour12Change((event.currentTarget as HTMLInputElement).checked)}
			/>
			<span>{p.t('clockHour12')}</span>
		</label>
		<label class="np-toggle">
			<input
				type="checkbox"
				checked={p.clockSeconds ?? false}
				onchange={(event) => p.onClockSecondsChange((event.currentTarget as HTMLInputElement).checked)}
			/>
			<span>{p.t('clockSeconds')}</span>
		</label>
	</div>
</EditorSection>
<EditorSection title="Live voorbeeld" icon="eye" tone="purple" status="filled" statusLabel="real-time" open>
	<div class="np-preview-frame">
		<ClockCard
			analogStyle={p.analogStyle}
			digitalStyle={p.digitalStyle}
			clockStyle={p.clockStyle}
			showAnalog={p.clockShowAnalog ?? false}
			showDigital={p.clockShowDigital ?? true}
			hour12={p.clockHour12}
			seconds={p.clockSeconds ?? false}
		/>
	</div>
</EditorSection>
