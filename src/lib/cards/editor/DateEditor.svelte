<script lang="ts">
	import EditorSection from '$lib/cards/editor/EditorSection.svelte';
	import DateCard from '$lib/cards/DateCard.svelte';

	type Props = {
		t: (key: string) => string;
		dateLayout?: 'vertical' | 'horizontal';
		dateAlign?: 'left' | 'center' | 'right';
		dateShortDay?: boolean;
		dateShortMonth?: boolean;
		dateWeekdayWithDate?: boolean;
		onDateLayoutChange: (v: 'vertical' | 'horizontal') => void;
		onDateAlignChange: (v: 'left' | 'center' | 'right') => void;
		onDateShortDayChange: (v: boolean) => void;
		onDateShortMonthChange: (v: boolean) => void;
		onDateWeekdayWithDateChange: (v: boolean) => void;
	};

	let p: Props = $props();
</script>

<EditorSection title="Layout en uitlijning" icon="layout" tone="blue" status="filled" statusLabel={p.dateLayout ?? 'vertical'} open>
	<div class="np-help">Hoe wordt de datum weergegeven.</div>
	<div class="np-grid-2">
		<div class="np-field">
			<span class="np-label">Layout</span>
			<select
				class="np-input"
				value={p.dateLayout ?? 'vertical'}
				onchange={(event) => p.onDateLayoutChange((event.currentTarget as HTMLSelectElement).value as 'vertical' | 'horizontal')}
			>
				<option value="vertical">{p.t('dateLayoutVertical')}</option>
				<option value="horizontal">{p.t('dateLayoutHorizontal')}</option>
			</select>
		</div>
		<div class="np-field">
			<span class="np-label">Uitlijning</span>
			<select
				class="np-input"
				value={p.dateAlign ?? 'center'}
				onchange={(event) => p.onDateAlignChange((event.currentTarget as HTMLSelectElement).value as 'left' | 'center' | 'right')}
			>
				<option value="left">{p.t('alignLeft')}</option>
				<option value="center">{p.t('alignCenter')}</option>
				<option value="right">{p.t('alignRight')}</option>
			</select>
		</div>
	</div>
	<div class="np-toggles">
		<label class="np-toggle">
			<input
				type="checkbox"
				checked={p.dateShortDay ?? false}
				onchange={(event) => p.onDateShortDayChange((event.currentTarget as HTMLInputElement).checked)}
			/>
			<span>{p.t('dateShortDay')}</span>
		</label>
		<label class="np-toggle">
			<input
				type="checkbox"
				checked={p.dateShortMonth ?? false}
				onchange={(event) => p.onDateShortMonthChange((event.currentTarget as HTMLInputElement).checked)}
			/>
			<span>{p.t('dateShortMonth')}</span>
		</label>
		<label class="np-toggle">
			<input
				type="checkbox"
				checked={p.dateWeekdayWithDate ?? false}
				onchange={(event) => p.onDateWeekdayWithDateChange((event.currentTarget as HTMLInputElement).checked)}
			/>
			<span>{p.t('dateWeekdayWithDate')}</span>
		</label>
	</div>
</EditorSection>
<EditorSection title="Live voorbeeld" icon="eye" tone="purple" status="filled" statusLabel="real-time" open>
	<div class="np-preview-frame">
		<DateCard
			layout={p.dateLayout ?? 'vertical'}
			shortDay={p.dateShortDay ?? false}
			shortMonth={p.dateShortMonth ?? false}
			align={p.dateAlign ?? 'center'}
			weekdayWithDate={p.dateWeekdayWithDate ?? false}
		/>
	</div>
</EditorSection>
