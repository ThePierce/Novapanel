<script lang="ts">
	import { get } from 'svelte/store';
	import { clockNow } from '$lib/cards/clock-time';

	type Orientation = 'vertical' | 'horizontal';
	type Align = 'left' | 'center' | 'right';

	type Props = {
		shortDay?: boolean;
		shortMonth?: boolean;
		layout?: Orientation;
		align?: Align;
		weekdayWithDate?: boolean;
		locale?: string;
	};

	let {
		shortDay = false,
		shortMonth = false,
		layout = 'vertical',
		align = 'left',
		weekdayWithDate = false,
		locale
	}: Props = $props();

	let now = $state(get(clockNow));
	$effect(() => {
		const unsub = clockNow.subscribe((value) => {
			now = value;
		});
		return () => unsub();
	});

	function getLocale() {
		if (locale && locale.length > 0) return locale;
		if (typeof document !== 'undefined') return document.documentElement.lang || undefined;
		return undefined;
	}

	const weekDay = $derived(
		now.toLocaleDateString(getLocale(), {
			weekday: shortDay ? 'short' : 'long'
		})
	);

	const dayNum = $derived(now.getDate());
	const monthName = $derived(
		now.toLocaleDateString(getLocale(), {
			month: shortMonth ? 'short' : 'long'
		})
	);
	const year = $derived(now.getFullYear());

	const shortDate = $derived(
		now.toLocaleDateString(getLocale(), {
			day: 'numeric',
			month: shortMonth ? 'short' : 'long'
		})
	);
</script>

<div class={`date-card date-${layout} date-align-${align}`}>
	{#if layout === 'vertical'}
		<div class="calendar-block">
			<span class="cal-weekday">{weekDay}</span>
			<span class="cal-day">{dayNum}</span>
			<span class="cal-month">{monthName} {year}</span>
		</div>
	{:else}
		<div class="row-block">
			<span class="row-weekday">{weekDay}</span>
			{#if weekdayWithDate}<span class="row-sep">·</span>{/if}
			<span class="row-date">{shortDate}</span>
		</div>
	{/if}
</div>

<style>
	.date-card {
		padding: 14px 16px;
		white-space: nowrap;
		overflow: hidden;
		position: relative;
		display: flex;
	}
	.date-card.date-vertical {
		justify-content: center;
	}
	.date-card.date-horizontal {
		align-items: baseline;
	}
	.date-card.date-align-left { justify-content: flex-start; }
	.date-card.date-align-center { justify-content: center; }
	.date-card.date-align-right { justify-content: flex-end; }

	.ambient-glow {
		display: none;
	}

	.calendar-block {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 10px 16px;
		background: rgba(255,255,255,0.025);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 16px;
		min-width: 110px;
		isolation: isolate;
		transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
		box-shadow: inset 0 1px 0 rgba(255,255,255,0.06);
	}
	.calendar-block::before {
		content: '';
		position: absolute;
		top: 0; left: 0; right: 0;
		height: 6px;
		background: linear-gradient(90deg, #f87171 0%, #fb923c 50%, #f87171 100%);
		border-radius: 16px 16px 0 0;
		opacity: 0.85;
		pointer-events: none;
	}
	.date-card:hover .calendar-block {
		transform: translateY(-2px);
		border-color: rgba(255,255,255,0.13);
		box-shadow:
			inset 0 1px 0 rgba(255,255,255,0.10),
			0 8px 24px rgba(0,0,0,0.30);
	}

	.cal-weekday {
		font-size: 11px;
		font-weight: 600;
		color: rgba(255,255,255,0.55);
		text-transform: uppercase;
		letter-spacing: 0.18em;
		margin-top: 4px;
	}
	.cal-day {
		font-size: 3.4rem;
		font-weight: 200;
		line-height: 1;
		color: #fff;
		letter-spacing: -0.04em;
		font-variant-numeric: tabular-nums;
		text-shadow:
			0 2px 16px rgba(0,0,0,0.4),
			0 0 32px rgba(96,165,250,0.20);
		margin-top: 4px;
	}
	.cal-month {
		font-size: 11px;
		font-weight: 500;
		color: rgba(255,255,255,0.55);
		letter-spacing: 0.10em;
		margin-top: 2px;
		text-transform: capitalize;
	}

	.row-block {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: baseline;
		gap: 8px;
	}
	.row-weekday {
		font-size: 1.25rem;
		font-weight: 300;
		color: #fff;
		letter-spacing: -0.015em;
		text-transform: capitalize;
		text-shadow: 0 2px 10px rgba(0,0,0,0.25);
	}
	.row-sep {
		color: rgba(255,255,255,0.35);
		font-weight: 300;
	}
	.row-date {
		font-size: 0.95rem;
		font-weight: 500;
		color: rgba(255,255,255,0.65);
		text-transform: capitalize;
		font-variant-numeric: tabular-nums;
	}
</style>
