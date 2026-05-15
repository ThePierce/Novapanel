<script lang="ts">
	import { entityStore } from '$lib/ha/entities-store';
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';

	type Props = {
		netEntityId?: string;
		solarEntityId?: string;
		batteryEntityId?: string;
		gridEntityId?: string;
		batteryChargeEntityId?: string;
	};

	let {
		netEntityId = '',
		solarEntityId = '',
		batteryEntityId = '',
		gridEntityId = '',
		batteryChargeEntityId = ''
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

	const net = $derived(getNumeric(netEntityId));
	const solar = $derived(getNumeric(solarEntityId));
	const battery = $derived(getNumeric(batteryEntityId));
	const grid = $derived(getNumeric(gridEntityId));
	const batteryCharge = $derived(getNumeric(batteryChargeEntityId));

	function fmtW(w: number | null, unit?: string): string {
		if (w === null) return '–';
		const abs = Math.abs(w);
		const u = unit || 'W';
		if (u.toLowerCase().includes('kw') || abs >= 1000) {
			const kw = u.toLowerCase().includes('kw') ? abs : abs / 1000;
			return `${kw.toFixed(1)} kW`;
		}
		return `${Math.round(abs)} W`;
	}

	// Summary line for the sidebar card
	const netLabel = $derived((() => {
		if (!netEntityId) return 'Geen entiteit ingesteld';
		if (net === null) {
			const found = entities.some(e => e.entityId === (netEntityId || '').trim());
			return found ? 'Sensor geeft geen getal' : `Niet gevonden: ${(netEntityId || '').trim()}`;
		}
		const abs = Math.abs(net);
		const unit = getUnit(netEntityId);
		const formatted = fmtW(net, unit);
		if (net < 0) return `↑ ${formatted} terug`;
		if (net === 0) return 'Geen verbruik';
		return `↓ ${formatted} afname`;
	})());

	const netColor = $derived(
		net === null ? 'rgba(255,255,255,0.35)'
		: net < 0 ? '#4ade80'   // returning to grid
		: net === 0 ? '#f5f5f5'
		: '#f5a623'              // consuming from grid
	);
</script>

<div class="status-card tile">
	<div class="status-icon-wrap">
		<div class="status-icon" style="color:{netColor}">
			<StatusIcon icon="mdi:home-lightning-bolt-outline" size={32} />
		</div>
	</div>
	<div class="info">
		<div class="name">Energie</div>
		<div class="summary" style="color:{netColor}">{netLabel}</div>
	</div>
</div>

<style>
	.status-card {
		display: grid;
		grid-template-columns: 2.8rem minmax(0, 1fr);
		gap: 0.75rem;
		align-items: center;
		padding: 0.2rem 0.1rem;
		text-shadow: 0 0 5px rgba(0,0,0,0.15);
		width: 100%;
		min-width: 0;
		max-width: 100%;
		box-sizing: border-box;
		container-type: inline-size;
	}
	.tile { border-radius: 10px; background: transparent; }
	.status-icon-wrap { position: relative; width: 2.4rem; height: 2.4rem; display: grid; place-items: center; }
	.status-icon { width: 2.4rem; height: 2.4rem; border-radius: 999px; background: transparent; display: grid; place-items: center; }
	.info { min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
	.name { font-weight: 500; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f5f5f5; }
	.summary {
		font-size: 0.82rem;
		line-height: 1.08rem;
		white-space: normal;
		overflow: hidden;
		text-overflow: ellipsis;
		margin-top: 0.1rem;
		display: -webkit-box;
		-webkit-line-clamp: 2;
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
