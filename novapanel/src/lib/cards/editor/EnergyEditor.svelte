<script lang="ts">
	import EditorSection from '$lib/cards/editor/EditorSection.svelte';
	import AreaPicker from '$lib/cards/editor/AreaPicker.svelte';
	import type { EnergyAnchors } from '$lib/persistence/panel-state-types';

	type Row = { id: string; label: string; displayName: string };

	type Props = {
		netEntityId?: string;
		solarEntityId?: string;
		batteryEntityId?: string;
		gridEntityId?: string;
		batteryChargeEntityId?: string;
		importTodayEntityId?: string;
		exportTodayEntityId?: string;
		solarTodayEntityId?: string;
		homeTodayEntityId?: string;
		costTodayEntityId?: string;
		compensationTodayEntityId?: string;
		selfSufficiencyEntityId?: string;
		carChargingEntityId?: string;
		carCableEntityId?: string;
		carChargingPowerEntityId?: string;
		energyDeviceEntityIds?: string[];
		energyDeviceTodayEntityIds?: string[];
		hasCustomDayNoCar?: boolean;
		hasCustomDayWithCar?: boolean;
		hasCustomNightNoCar?: boolean;
		hasCustomNightWithCar?: boolean;
		anchorsDayNoCar?: EnergyAnchors;
		anchorsDayWithCar?: EnergyAnchors;
		anchorsNightNoCar?: EnergyAnchors;
		anchorsNightWithCar?: EnergyAnchors;
		// Energie devices picker (AreaPicker-rijen + handlers, levert dezelfde UX als bij Lampen/Apparaten)
		energyPowerSelectedRows?: Row[];
		energyPowerIgnoredRows?: Row[];
		energyEnergySelectedRows?: Row[];
		energyEnergyIgnoredRows?: Row[];
		toggleEnergyDevicePowerEntity?: (entityId: string, checked: boolean) => void;
		toggleEnergyDeviceTodayEntity?: (entityId: string, checked: boolean) => void;
		selectAllEnergyDevicePower?: () => void;
		clearEnergyDevicePower?: () => void;
		selectAllEnergyDeviceToday?: () => void;
		clearEnergyDeviceToday?: () => void;
		onNetEntityIdChange: (value: string) => void;
		onSolarEntityIdChange: (value: string) => void;
		onBatteryEntityIdChange: (value: string) => void;
		onGridEntityIdChange: (value: string) => void;
		onBatteryChargeEntityIdChange: (value: string) => void;
		onImportTodayEntityIdChange: (value: string) => void;
		onExportTodayEntityIdChange: (value: string) => void;
		onSolarTodayEntityIdChange: (value: string) => void;
		onHomeTodayEntityIdChange: (value: string) => void;
		onCostTodayEntityIdChange: (value: string) => void;
		onCompensationTodayEntityIdChange: (value: string) => void;
		onSelfSufficiencyEntityIdChange: (value: string) => void;
		onCarChargingEntityIdChange: (value: string) => void;
		onCarCableEntityIdChange: (value: string) => void;
		onCarChargingPowerEntityIdChange: (value: string) => void;
		onEnergyDeviceEntityIdsChange: (value: string[]) => void;
		onEnergyDeviceTodayEntityIdsChange: (value: string[]) => void;
		onEnergyUploadClick: (variant: string) => void;
		onEnergyResetClick: (variant: string) => void;
		onEnergyAnchorsClick: (variant: string) => void;
	};

	let p: Props = $props();

	function nonEmpty(v: string | undefined): boolean {
		return typeof v === 'string' && v.trim().length > 0;
	}
	function fillStatus(filled: number, total: number): { status: 'filled' | 'partial' | 'empty'; label: string } {
		if (filled === 0) return { status: 'empty', label: 'leeg' };
		if (filled === total) return { status: 'filled', label: `${filled} ingevuld` };
		return { status: 'partial', label: `${filled} / ${total}` };
	}

	const liveStatus = $derived((() => {
		const fields = [p.netEntityId, p.solarEntityId, p.gridEntityId, p.batteryEntityId, p.batteryChargeEntityId];
		const filled = fields.filter(nonEmpty).length;
		const total = fields.length;
		if (!nonEmpty(p.netEntityId)) return { status: 'required' as const, label: `vereist · ${filled} / ${total}` };
		return fillStatus(filled, total);
	})());
	const totalsStatus = $derived((() => {
		const fields = [p.importTodayEntityId, p.exportTodayEntityId, p.solarTodayEntityId, p.homeTodayEntityId, p.selfSufficiencyEntityId];
		return fillStatus(fields.filter(nonEmpty).length, fields.length);
	})());
	const costsStatus = $derived((() => {
		const fields = [p.costTodayEntityId, p.compensationTodayEntityId];
		return fillStatus(fields.filter(nonEmpty).length, fields.length);
	})());
	const carStatus = $derived((() => {
		const fields = [p.carChargingEntityId, p.carCableEntityId, p.carChargingPowerEntityId];
		return fillStatus(fields.filter(nonEmpty).length, fields.length);
	})());
	const devicesStatus = $derived((() => {
		const power = (p.energyDeviceEntityIds ?? []).filter((v) => v.trim().length > 0).length;
		const today = (p.energyDeviceTodayEntityIds ?? []).filter((v) => v.trim().length > 0).length;
		if (power === 0 && today === 0) return { status: 'empty' as const, label: 'geen apparaten' };
		if (power > 0 && today === 0) return { status: 'partial' as const, label: `${power} apparaat${power === 1 ? '' : 'en'} · geen kWh` };
		if (power > 0) return { status: 'filled' as const, label: `${power} apparaat${power === 1 ? '' : 'en'}` };
		return { status: 'partial' as const, label: `${today} kWh-teller${today === 1 ? '' : 's'}` };
	})());
	const assetsStatus = $derived((() => {
		const customs = [p.hasCustomDayNoCar, p.hasCustomDayWithCar, p.hasCustomNightNoCar, p.hasCustomNightWithCar].filter(Boolean).length;
		const anchors = [p.anchorsDayNoCar, p.anchorsDayWithCar, p.anchorsNightNoCar, p.anchorsNightWithCar].filter(Boolean).length;
		const total = customs + anchors;
		if (total === 0) return { status: 'empty' as const, label: 'standaard' };
		if (total === 8) return { status: 'filled' as const, label: 'volledig aangepast' };
		return { status: 'partial' as const, label: `${customs}/4 foto's · ${anchors}/4 ankers` };
	})());

	const variants = $derived([
		{ key: 'day-no-car', label: 'Overdag, geen auto', has: p.hasCustomDayNoCar, anchors: p.anchorsDayNoCar },
		{ key: 'day-with-car', label: 'Overdag, met auto', has: p.hasCustomDayWithCar, anchors: p.anchorsDayWithCar },
		{ key: 'night-no-car', label: "'s Avonds, geen auto", has: p.hasCustomNightNoCar, anchors: p.anchorsNightNoCar },
		{ key: 'night-with-car', label: "'s Avonds, met auto", has: p.hasCustomNightWithCar, anchors: p.anchorsNightWithCar }
	]);
</script>

<EditorSection title="Live vermogen" icon="bolt" tone="amber" status={liveStatus.status} statusLabel={liveStatus.label}>
	<div class="np-help">Real-time vermogen in W. Positief = afname uit het net, negatief = teruglevering.</div>
	<div class="np-field">
		<span class="np-label">Netto verbruik</span>
		<input type="text" class="np-input mono" value={p.netEntityId}
			placeholder="sensor.p1_meter_vermogen"
			oninput={(e) => p.onNetEntityIdChange((e.currentTarget as HTMLInputElement).value)} />
	</div>
	<div class="np-grid-2">
		<div class="np-field">
			<span class="np-label">Zonnepanelen</span>
			<input type="text" class="np-input mono" value={p.solarEntityId}
				placeholder="sensor.solar_power"
				oninput={(e) => p.onSolarEntityIdChange((e.currentTarget as HTMLInputElement).value)} />
		</div>
		<div class="np-field">
			<span class="np-label">Huisverbruik</span>
			<input type="text" class="np-input mono" value={p.gridEntityId}
				placeholder="sensor.power_consumption"
				oninput={(e) => p.onGridEntityIdChange((e.currentTarget as HTMLInputElement).value)} />
		</div>
		<div class="np-field">
			<span class="np-label">Accu vermogen</span>
			<input type="text" class="np-input mono" value={p.batteryEntityId}
				placeholder="sensor.battery_power"
				oninput={(e) => p.onBatteryEntityIdChange((e.currentTarget as HTMLInputElement).value)} />
		</div>
		<div class="np-field">
			<span class="np-label">Accu lading %</span>
			<input type="text" class="np-input mono" value={p.batteryChargeEntityId}
				placeholder="sensor.battery_state_of_charge"
				oninput={(e) => p.onBatteryChargeEntityIdChange((e.currentTarget as HTMLInputElement).value)} />
		</div>
	</div>
</EditorSection>

<EditorSection title="Vandaag-totalen" icon="chart-bar" tone="blue" status={totalsStatus.status} statusLabel={totalsStatus.label}>
	<div class="np-help">kWh-tellers via Utility Meter helpers in Home Assistant.</div>
	<div class="np-grid-2">
		<div class="np-field">
			<span class="np-label">Afname vandaag</span>
			<input type="text" class="np-input mono" value={p.importTodayEntityId ?? ''}
				placeholder="sensor.energie_import_vandaag"
				oninput={(e) => p.onImportTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)} />
		</div>
		<div class="np-field">
			<span class="np-label">Teruglevering vandaag</span>
			<input type="text" class="np-input mono" value={p.exportTodayEntityId ?? ''}
				placeholder="sensor.energie_export_vandaag"
				oninput={(e) => p.onExportTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)} />
		</div>
		<div class="np-field">
			<span class="np-label">Opwek vandaag</span>
			<input type="text" class="np-input mono" value={p.solarTodayEntityId ?? ''}
				placeholder="sensor.zon_vandaag"
				oninput={(e) => p.onSolarTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)} />
		</div>
		<div class="np-field">
			<span class="np-label">Huisverbruik vandaag</span>
			<input type="text" class="np-input mono" value={p.homeTodayEntityId ?? ''}
				placeholder="sensor.huis_verbruik_vandaag"
				oninput={(e) => p.onHomeTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)} />
		</div>
	</div>
	<div class="np-field">
		<span class="np-label">Zelfvoorzienend % <span class="np-hint">(optioneel; anders berekend)</span></span>
		<input type="text" class="np-input mono" value={p.selfSufficiencyEntityId ?? ''}
			placeholder="sensor.zelfvoorzienend_vandaag"
			oninput={(e) => p.onSelfSufficiencyEntityIdChange((e.currentTarget as HTMLInputElement).value)} />
	</div>
</EditorSection>

<EditorSection title="Kosten vandaag" icon="currency-euro" tone="green" status={costsStatus.status} statusLabel={costsStatus.label}>
	<div class="np-help">Optioneel. Bedragen in euro per kWh-stand vandaag.</div>
	<div class="np-grid-2">
		<div class="np-field">
			<span class="np-label">Kosten import</span>
			<input type="text" class="np-input mono" value={p.costTodayEntityId ?? ''}
				placeholder="sensor.kosten_import_vandaag"
				oninput={(e) => p.onCostTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)} />
		</div>
		<div class="np-field">
			<span class="np-label">Compensatie teruglevering</span>
			<input type="text" class="np-input mono" value={p.compensationTodayEntityId ?? ''}
				placeholder="sensor.compensatie_export_vandaag"
				oninput={(e) => p.onCompensationTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)} />
		</div>
	</div>
</EditorSection>

<EditorSection title="Auto en laadpaal" icon="car" tone="blue" status={carStatus.status} statusLabel={carStatus.label}>
	<div class="np-help">Wanneer ingevuld worden de auto-flows automatisch geactiveerd in de detailweergave.</div>
	<div class="np-grid-2">
		<div class="np-field">
			<span class="np-label">Laadpaal status</span>
			<input type="text" class="np-input mono" value={p.carChargingEntityId ?? ''}
				placeholder="sensor.laadpaal_main_state_socket_1"
				oninput={(e) => p.onCarChargingEntityIdChange((e.currentTarget as HTMLInputElement).value)} />
		</div>
		<div class="np-field">
			<span class="np-label">Kabel ingeplugd</span>
			<input type="text" class="np-input mono" value={p.carCableEntityId ?? ''}
				placeholder="binary_sensor.skoda_octavia_combi_laadkabel"
				oninput={(e) => p.onCarCableEntityIdChange((e.currentTarget as HTMLInputElement).value)} />
		</div>
	</div>
	<div class="np-field">
		<span class="np-label">Laadvermogen</span>
		<input type="text" class="np-input mono" value={p.carChargingPowerEntityId ?? ''}
			placeholder="sensor.laadpaal_power"
			oninput={(e) => p.onCarChargingPowerEntityIdChange((e.currentTarget as HTMLInputElement).value)} />
	</div>
</EditorSection>

<EditorSection title="Live vermogen per apparaat" icon="device-desktop-analytics" tone="amber" status={devicesStatus.status} statusLabel={devicesStatus.label}>
	<div class="np-help">Selecteer de apparaten waarvan je het live vermogen wilt zien in de afname-sub-pop-up. Toont alleen entiteiten met W/kW als eenheid of <code>device_class: power</code>.</div>
	<AreaPicker
		selectedRows={p.energyPowerSelectedRows ?? []}
		ignoredRows={p.energyPowerIgnoredRows ?? []}
		onToggle={(entityId, checked) => p.toggleEnergyDevicePowerEntity?.(entityId, checked)}
		onSelectAll={() => p.selectAllEnergyDevicePower?.()}
		onClearAll={() => p.clearEnergyDevicePower?.()}
	/>
</EditorSection>

<EditorSection title="kWh vandaag per apparaat" icon="chart-bar" tone="amber" status={devicesStatus.status} statusLabel={devicesStatus.label}>
	<div class="np-help">Optioneel. Selecteer de bijbehorende kWh-tellers per apparaat (zelfde apparaat als hierboven). Toont alleen entiteiten met kWh/Wh als eenheid of <code>device_class: energy</code>.</div>
	<AreaPicker
		selectedRows={p.energyEnergySelectedRows ?? []}
		ignoredRows={p.energyEnergyIgnoredRows ?? []}
		onToggle={(entityId, checked) => p.toggleEnergyDeviceTodayEntity?.(entityId, checked)}
		onSelectAll={() => p.selectAllEnergyDeviceToday?.()}
		onClearAll={() => p.clearEnergyDeviceToday?.()}
	/>
</EditorSection>

<EditorSection title="Eigen foto's en ankerpunten" icon="photo" tone="purple" status={assetsStatus.status} statusLabel={assetsStatus.label}>
	<div class="np-help">Per scenario een eigen foto en ankerpunten voor de flow-lijnen.</div>
	<div class="np-variant-grid">
		{#each variants as variant (variant.key)}
			<div class="np-variant" class:has={variant.has}>
				<div class="np-variant-thumb">
					{#if variant.has}<span class="np-variant-mark"></span>{/if}
					{variant.has ? 'Eigen foto' : 'Standaard'}
				</div>
				<div class="np-variant-meta">
					<div class="np-variant-name">{variant.label}</div>
					<div class="np-variant-actions">
						<button type="button" class="np-mini-btn" onclick={() => p.onEnergyUploadClick(variant.key)}>
							{variant.has ? 'Foto wijzig' : 'Foto…'}
						</button>
						{#if variant.has}
							<button type="button" class="np-mini-btn ghost" onclick={() => p.onEnergyResetClick(variant.key)}>Reset</button>
						{/if}
						<button type="button" class="np-mini-btn primary" onclick={() => p.onEnergyAnchorsClick(variant.key)}>
							{variant.anchors ? 'Ankers ✓' : 'Ankers…'}
						</button>
					</div>
				</div>
			</div>
		{/each}
	</div>
</EditorSection>
