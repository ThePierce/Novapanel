<script lang="ts">
	import { calculateLiveEnergyCost } from '$lib/energy-costs';
	import { entityStore } from '$lib/ha/entities-store';
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
	import { localeFor, selectedLanguageStore, translate } from '$lib/i18n';
	import { DEFAULT_CURRENCY_CODE, formatCurrency } from '$lib/currency';

	type Props = {
		netEntityId?: string;
		solarEntityId?: string;
		batteryEntityId?: string;
		gridEntityId?: string;
		batteryChargeEntityId?: string;
		costCurrentEntityId?: string;
		compensationCurrentEntityId?: string;
		costTodayEntityId?: string;
		compensationTodayEntityId?: string;
		costMonthEntityId?: string;
		compensationMonthEntityId?: string;
		energyPriceEntityId?: string;
		importTariffEntityId?: string;
		exportTariffEntityId?: string;
	};

	let {
		netEntityId = '',
		solarEntityId = '',
		batteryEntityId = '',
		gridEntityId = '',
		batteryChargeEntityId = '',
		costCurrentEntityId = '',
		compensationCurrentEntityId = '',
		costTodayEntityId = '',
		compensationTodayEntityId = '',
		costMonthEntityId = '',
		compensationMonthEntityId = '',
		energyPriceEntityId = '',
		importTariffEntityId = '',
		exportTariffEntityId = ''
	}: Props = $props();

	const entities = $derived($entityStore.entities);

	function getNumeric(id: string): number | null {
		const normalizedId = (id || '').trim();
		if (!normalizedId) return null;
		const e = entities.find((e) => e.entityId === normalizedId);
		if (!e) return null;
		const v = parseFloat(String(e.state ?? ''));
		return isNaN(v) ? null : v;
	}

	function getUnit(id: string): string {
		const normalizedId = (id || '').trim();
		if (!normalizedId) return '';
		const e = entities.find((e) => e.entityId === normalizedId);
		return (e?.attributes as any)?.unit_of_measurement ?? '';
	}
	function powerW(id: string): number | null {
		const value = getNumeric(id);
		if (value === null) return null;
		const unit = getUnit(id).toLowerCase();
		return unit.includes('kw') ? value * 1000 : value;
	}

	const net = $derived(getNumeric(netEntityId));
	const netW = $derived(powerW(netEntityId));
	const solar = $derived(getNumeric(solarEntityId));
	const battery = $derived(getNumeric(batteryEntityId));
	const grid = $derived(getNumeric(gridEntityId));
	const batteryCharge = $derived(getNumeric(batteryChargeEntityId));
	const costCurrent = $derived(getNumeric(costCurrentEntityId));
	const compensationCurrent = $derived(getNumeric(compensationCurrentEntityId));
	const costToday = $derived(getNumeric(costTodayEntityId));
	const compensationToday = $derived(getNumeric(compensationTodayEntityId));
	const costMonth = $derived(getNumeric(costMonthEntityId));
	const compensationMonth = $derived(getNumeric(compensationMonthEntityId));
	const importTariffLive = $derived(getNumeric(energyPriceEntityId) ?? getNumeric(importTariffEntityId));
	const exportTariffLive = $derived(getNumeric(exportTariffEntityId) ?? importTariffLive);
	const liveCost = $derived(
		calculateLiveEnergyCost({
			netPowerW: netW,
			importTariff: importTariffLive,
			exportTariff: exportTariffLive,
			costCurrent,
			compensationCurrent
		})
	);

	function netCost(cost: number | null, compensation: number | null): number | null {
		if (cost === null && compensation === null) return null;
		return (cost ?? 0) - (compensation ?? 0);
	}

	function fmtEuro(value: number | null): string {
		if (value === null) return '–';
		return formatCurrency(value, localeFor($selectedLanguageStore), DEFAULT_CURRENCY_CODE);
	}

	function fmtW(w: number | null, unit?: string): string {
		if (w === null) return '–';
		const abs = Math.abs(w);
		const u = unit || 'W';
		if (u.toLowerCase().includes('kw') || abs >= 1000) {
			const kw = u.toLowerCase().includes('kw') ? abs : abs / 1000;
			return `${kw.toLocaleString(localeFor($selectedLanguageStore), {
				minimumFractionDigits: 1,
				maximumFractionDigits: 1
			})} kW`;
		}
		return `${Math.round(abs)} W`;
	}

	// Summary line for the sidebar card
	const netLabel = $derived(
		(() => {
			if (!netEntityId) return translate('Geen entiteit ingesteld', $selectedLanguageStore);
			if (net === null) {
				const found = entities.some((e) => e.entityId === (netEntityId || '').trim());
				return found
					? translate('Sensor geeft geen getal', $selectedLanguageStore)
					: `${translate('Niet gevonden', $selectedLanguageStore)}: ${(netEntityId || '').trim()}`;
			}
			const unit = getUnit(netEntityId);
			const formatted = fmtW(net, unit);
			if (net < 0) return `↑ ${formatted} ${translate('terug', $selectedLanguageStore)}`;
			if (net === 0) return translate('Geen verbruik', $selectedLanguageStore);
			return `↓ ${formatted} ${translate('afname', $selectedLanguageStore)}`;
		})()
	);

	const netColor = $derived(
		net === null
			? 'rgba(255,255,255,0.35)'
			: net < 0
				? '#4ade80' // returning to grid
				: net === 0
					? '#f5f5f5'
					: '#f5a623' // consuming from grid
	);

	const detailLabel = $derived(
		(() => {
			const parts: string[] = [];
			if (solar !== null)
				parts.push(
					`${translate('Zonnepanelen', $selectedLanguageStore)} ${fmtW(solar, getUnit(solarEntityId))}`
				);
			if (battery !== null) {
				parts.push(`${translate('Accu', $selectedLanguageStore)} ${fmtW(battery, getUnit(batteryEntityId))}`);
			} else if (batteryCharge !== null) {
				parts.push(`${translate('Accu', $selectedLanguageStore)} ${Math.round(batteryCharge)}%`);
			}
			if (grid !== null)
				parts.push(
					`${translate('Huisverbruik', $selectedLanguageStore)} ${fmtW(grid, getUnit(gridEntityId))}`
				);
			return parts.join(' · ');
		})()
	);

	const costDetailLabel = $derived(
		(() => {
			const parts: string[] = [];
			if (liveCost.netCostPerHour !== null)
				parts.push(`${translate('Nu', $selectedLanguageStore)} ${fmtEuro(liveCost.netCostPerHour)}/u`);
			const today = netCost(costToday, compensationToday);
			if (today !== null)
				parts.push(`${translate('Vandaag', $selectedLanguageStore)} ${fmtEuro(today)}`);
			const month = netCost(costMonth, compensationMonth);
			if (month !== null) parts.push(`${translate('Maand', $selectedLanguageStore)} ${fmtEuro(month)}`);
			return parts.join(' · ');
		})()
	);
</script>

<div class="status-card tile">
	<div class="status-icon-wrap">
		<div class="status-icon" style="color:{netColor}">
			<StatusIcon icon="mdi:home-lightning-bolt-outline" size={32} />
		</div>
	</div>
	<div class="info">
		<div class="name">{translate('Energie', $selectedLanguageStore)}</div>
		<div class="summary" style="color:{netColor}">{netLabel}</div>
		{#if detailLabel}
			<div class="details">{detailLabel}</div>
		{/if}
		{#if costDetailLabel}
			<div class="details money">{costDetailLabel}</div>
		{/if}
	</div>
</div>

<style>
	.status-card {
		display: grid;
		grid-template-columns: 2.8rem minmax(0, 1fr);
		gap: 0.75rem;
		align-items: center;
		padding: 0.2rem 0.1rem;
		text-shadow: 0 0 5px rgba(0, 0, 0, 0.15);
		width: 100%;
		min-width: 0;
		max-width: 100%;
		box-sizing: border-box;
		container-type: inline-size;
	}
	.tile {
		border-radius: 10px;
		background: transparent;
	}
	.status-icon-wrap {
		position: relative;
		width: 2.4rem;
		height: 2.4rem;
		display: grid;
		place-items: center;
	}
	.status-icon {
		width: 2.4rem;
		height: 2.4rem;
		border-radius: 999px;
		background: transparent;
		display: grid;
		place-items: center;
	}
	.info {
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.name {
		font-weight: 500;
		font-size: 0.95rem;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		color: #f5f5f5;
	}
	.details {
		margin-top: 0.05rem;
		font-size: 0.72rem;
		line-height: 0.9rem;
		color: rgba(255, 255, 255, 0.55);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.details.money {
		color: rgba(255, 255, 255, 0.72);
	}
	.summary {
		font-size: 0.82rem;
		line-height: 1.08rem;
		white-space: normal;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-top: 0.1rem;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow-wrap: anywhere;
	}

	@container (max-width: 220px) {
		.status-card {
			grid-template-columns: 2.2rem minmax(0, 1fr);
			gap: 0.5rem;
		}
		.status-icon-wrap,
		.status-icon {
			width: 2rem;
			height: 2rem;
		}
		.name {
			font-size: 0.88rem;
		}
		.summary {
			font-size: 0.76rem;
			line-height: 0.98rem;
		}
	}
</style>
