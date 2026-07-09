<script lang="ts">
	import EditorSection from '$lib/cards/editor/EditorSection.svelte';
	import AreaPicker from '$lib/cards/editor/AreaPicker.svelte';
	import type { EnergyAnchors, EnergyCostMode } from '$lib/persistence/panel-state-types';
	import { selectedLanguageStore, translate } from '$lib/i18n';
	import { filteredEntities } from '$lib/ha/entities-store';
	import { coerceCurrencyCode, DEFAULT_CURRENCY_CODE } from '$lib/currency';

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
		costCurrentEntityId?: string;
		compensationCurrentEntityId?: string;
		costTodayEntityId?: string;
		compensationTodayEntityId?: string;
		costMonthEntityId?: string;
		compensationMonthEntityId?: string;
		costYearEntityId?: string;
		compensationYearEntityId?: string;
		currencyCode?: string;
		energyCostMode?: EnergyCostMode;
		importPeakTodayEntityId?: string;
		importOffPeakTodayEntityId?: string;
		exportPeakTodayEntityId?: string;
		exportOffPeakTodayEntityId?: string;
		importTariffEntityId?: string;
		exportTariffEntityId?: string;
		importPeakTariff?: string | number;
		importOffPeakTariff?: string | number;
		exportPeakTariff?: string | number;
		exportOffPeakTariff?: string | number;
		exportTariff?: string | number;
		energyPriceEntityId?: string;
		emsBatteryTargetEntityId?: string;
		emsEvTargetEntityId?: string;
		emsOptimStatusEntityId?: string;
		emsPlanAvailableEntityId?: string;
		emsModeEntityId?: string;
		selfSufficiencyEntityId?: string;
		carChargingEntityId?: string;
		carCableEntityId?: string;
		carChargingPowerEntityId?: string;
		energyDeviceEntityIds?: string[];
		energyDeviceTodayEntityIds?: string[];
		energyDeviceAliases?: Record<string, string>;
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
		onCostCurrentEntityIdChange: (value: string) => void;
		onCompensationCurrentEntityIdChange: (value: string) => void;
		onCostTodayEntityIdChange: (value: string) => void;
		onCompensationTodayEntityIdChange: (value: string) => void;
		onCostMonthEntityIdChange: (value: string) => void;
		onCompensationMonthEntityIdChange: (value: string) => void;
		onCostYearEntityIdChange: (value: string) => void;
		onCompensationYearEntityIdChange: (value: string) => void;
		onEnergyCostModeChange: (value: EnergyCostMode) => void;
		onImportPeakTodayEntityIdChange: (value: string) => void;
		onImportOffPeakTodayEntityIdChange: (value: string) => void;
		onExportPeakTodayEntityIdChange: (value: string) => void;
		onExportOffPeakTodayEntityIdChange: (value: string) => void;
		onImportTariffEntityIdChange: (value: string) => void;
		onExportTariffEntityIdChange: (value: string) => void;
		onImportPeakTariffChange: (value: string) => void;
		onImportOffPeakTariffChange: (value: string) => void;
		onExportPeakTariffChange: (value: string) => void;
		onExportOffPeakTariffChange: (value: string) => void;
		onExportTariffChange: (value: string) => void;
		onEnergyPriceEntityIdChange: (value: string) => void;
		onEmsBatteryTargetEntityIdChange: (value: string) => void;
		onEmsEvTargetEntityIdChange: (value: string) => void;
		onEmsOptimStatusEntityIdChange: (value: string) => void;
		onEmsPlanAvailableEntityIdChange: (value: string) => void;
		onEmsModeEntityIdChange: (value: string) => void;
		onSelfSufficiencyEntityIdChange: (value: string) => void;
		onCarChargingEntityIdChange: (value: string) => void;
		onCarCableEntityIdChange: (value: string) => void;
		onCarChargingPowerEntityIdChange: (value: string) => void;
		onEnergyDeviceEntityIdsChange: (value: string[]) => void;
		onEnergyDeviceTodayEntityIdsChange: (value: string[]) => void;
		onEnergyDeviceAliasesChange: (value: Record<string, string>) => void;
		onEnergyUploadClick: (variant: string) => void;
		onEnergyResetClick: (variant: string) => void;
		onEnergyAnchorsClick: (variant: string) => void;
	};

	let p: Props = $props();
	const tariffCurrencyCode = $derived(coerceCurrencyCode(p.currencyCode, DEFAULT_CURRENCY_CODE));
	const activeCostMode = $derived(p.energyCostMode ?? 'peak_offpeak');
	const costModeOptions: Array<{ value: EnergyCostMode; label: string }> = [
		{ value: 'peak_offpeak', label: 'Vast piek/dal' },
		{ value: 'dynamic', label: 'Variabel' },
		{ value: 'sensor', label: 'Exacte sensoren' }
	];

	function nonEmpty(v: string | undefined): boolean {
		return typeof v === 'string' && v.trim().length > 0;
	}
	function tariffFilled(v: string | number | undefined): boolean {
		if (typeof v === 'number') return Number.isFinite(v) && v >= 0;
		if (typeof v !== 'string') return false;
		const n = Number(v.trim().replace(',', '.'));
		return Number.isFinite(n) && n >= 0;
	}
	function fillStatus(
		filled: number,
		total: number
	): { status: 'filled' | 'partial' | 'empty'; label: string } {
		if (filled === 0) return { status: 'empty', label: translate('leeg', $selectedLanguageStore) };
		if (filled === total)
			return { status: 'filled', label: `${filled} ${translate('ingevuld', $selectedLanguageStore)}` };
		return { status: 'partial', label: `${filled} / ${total}` };
	}

	const liveStatus = $derived(
		(() => {
			const fields = [
				p.netEntityId,
				p.solarEntityId,
				p.gridEntityId,
				p.batteryEntityId,
				p.batteryChargeEntityId
			];
			const filled = fields.filter(nonEmpty).length;
			const total = fields.length;
			if (!nonEmpty(p.netEntityId))
				return {
					status: 'required' as const,
					label: `${translate('vereist', $selectedLanguageStore)} · ${filled} / ${total}`
				};
			return fillStatus(filled, total);
		})()
	);
	const totalsStatus = $derived(
		(() => {
			const fields = [
				p.importTodayEntityId,
				p.exportTodayEntityId,
				p.solarTodayEntityId,
				p.homeTodayEntityId,
				p.selfSufficiencyEntityId
			];
			return fillStatus(fields.filter(nonEmpty).length, fields.length);
		})()
	);
	const costsStatus = $derived(
		(() => {
			if (activeCostMode === 'sensor') {
				const filled = [
					p.costCurrentEntityId,
					p.compensationCurrentEntityId,
					p.costTodayEntityId,
					p.compensationTodayEntityId,
					p.costMonthEntityId,
					p.compensationMonthEntityId,
					p.costYearEntityId,
					p.compensationYearEntityId
				].filter(nonEmpty).length;
				return filled > 0
					? { status: 'filled' as const, label: translate('kostensensor', $selectedLanguageStore) }
					: { status: 'empty' as const, label: translate('leeg', $selectedLanguageStore) };
			}
			if (activeCostMode === 'dynamic') {
				const hasTariffSensor =
					nonEmpty(p.energyPriceEntityId) ||
					nonEmpty(p.importTariffEntityId) ||
					nonEmpty(p.exportTariffEntityId);
				if (hasTariffSensor)
					return { status: 'partial' as const, label: translate('schatting', $selectedLanguageStore) };
				return { status: 'empty' as const, label: translate('leeg', $selectedLanguageStore) };
			}
			const completedLanes = [
				nonEmpty(p.importPeakTodayEntityId) && tariffFilled(p.importPeakTariff),
				nonEmpty(p.importOffPeakTodayEntityId) && tariffFilled(p.importOffPeakTariff),
				nonEmpty(p.exportPeakTodayEntityId) && tariffFilled(p.exportPeakTariff),
				nonEmpty(p.exportOffPeakTodayEntityId) && tariffFilled(p.exportOffPeakTariff)
			].filter(Boolean).length;
			if (completedLanes > 0)
				return { status: 'filled' as const, label: translate('piek/dal ingesteld', $selectedLanguageStore) };
			return { status: 'empty' as const, label: translate('leeg', $selectedLanguageStore) };
		})()
	);
	const emsStatus = $derived(
		(() => {
			const fields = [
				p.energyPriceEntityId,
				p.emsBatteryTargetEntityId,
				p.emsEvTargetEntityId,
				p.emsOptimStatusEntityId,
				p.emsPlanAvailableEntityId,
				p.emsModeEntityId
			];
			return fillStatus(fields.filter(nonEmpty).length, fields.length);
		})()
	);
	const carStatus = $derived(
		(() => {
			const fields = [p.carChargingEntityId, p.carCableEntityId, p.carChargingPowerEntityId];
			return fillStatus(fields.filter(nonEmpty).length, fields.length);
		})()
	);
	const devicesStatus = $derived(
		(() => {
			const power = (p.energyDeviceEntityIds ?? []).filter((v) => v.trim().length > 0).length;
			const today = (p.energyDeviceTodayEntityIds ?? []).filter((v) => v.trim().length > 0).length;
			if (power === 0 && today === 0)
				return { status: 'empty' as const, label: translate('geen apparaten', $selectedLanguageStore) };
			if (power > 0 && today === 0)
				return {
					status: 'partial' as const,
					label: `${power} ${translate(power === 1 ? 'apparaat' : 'apparaten', $selectedLanguageStore)} · ${translate('geen kWh', $selectedLanguageStore)}`
				};
			if (power > 0)
				return {
					status: 'filled' as const,
					label: `${power} ${translate(power === 1 ? 'apparaat' : 'apparaten', $selectedLanguageStore)}`
				};
			return {
				status: 'partial' as const,
				label: `${today} ${translate(today === 1 ? 'kWh-teller' : 'kWh-tellers', $selectedLanguageStore)}`
			};
		})()
	);
	const assetsStatus = $derived(
		(() => {
			const customs = [
				p.hasCustomDayNoCar,
				p.hasCustomDayWithCar,
				p.hasCustomNightNoCar,
				p.hasCustomNightWithCar
			].filter(Boolean).length;
			const anchors = [
				p.anchorsDayNoCar,
				p.anchorsDayWithCar,
				p.anchorsNightNoCar,
				p.anchorsNightWithCar
			].filter(Boolean).length;
			const total = customs + anchors;
			if (total === 0)
				return { status: 'empty' as const, label: translate('standaard', $selectedLanguageStore) };
			if (total === 8)
				return { status: 'filled' as const, label: translate('volledig aangepast', $selectedLanguageStore) };
			return {
				status: 'partial' as const,
				label: `${customs}/4 ${translate("foto's", $selectedLanguageStore)} · ${anchors}/4 ${translate('ankers', $selectedLanguageStore)}`
			};
		})()
	);

	const variants = $derived([
		{ key: 'day-no-car', label: 'Overdag, geen auto', has: p.hasCustomDayNoCar, anchors: p.anchorsDayNoCar },
		{
			key: 'day-with-car',
			label: 'Overdag, met auto',
			has: p.hasCustomDayWithCar,
			anchors: p.anchorsDayWithCar
		},
		{
			key: 'night-no-car',
			label: "'s Avonds, geen auto",
			has: p.hasCustomNightNoCar,
			anchors: p.anchorsNightNoCar
		},
		{
			key: 'night-with-car',
			label: "'s Avonds, met auto",
			has: p.hasCustomNightWithCar,
			anchors: p.anchorsNightWithCar
		}
	]);

	const deviceAliasRows = $derived.by(() => {
		const ids = (p.energyDeviceEntityIds ?? []).map((id) => id.trim()).filter((id) => id.length > 0);
		const seen = new Set<string>();
		return ids
			.filter((id) => {
				const key = id.toLowerCase();
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.map((id) => {
				const entity = $filteredEntities.find((entry) => entry.entityId.toLowerCase() === id.toLowerCase());
				const originalName = entity?.friendlyName?.trim() || id;
				const canonicalId = entity?.entityId ?? id;
				const alias =
					p.energyDeviceAliases?.[canonicalId] ??
					p.energyDeviceAliases?.[canonicalId.toLowerCase()] ??
					p.energyDeviceAliases?.[id] ??
					p.energyDeviceAliases?.[id.toLowerCase()] ??
					'';
				return {
					id: canonicalId,
					originalName,
					alias: typeof alias === 'string' ? alias : ''
				};
			});
	});

	function updateDeviceAlias(entityId: string, value: string) {
		const next = { ...(p.energyDeviceAliases ?? {}) };
		const trimmed = value.trim();
		if (trimmed.length > 0) next[entityId] = trimmed;
		else {
			delete next[entityId];
			delete next[entityId.toLowerCase()];
		}
		p.onEnergyDeviceAliasesChange(next);
	}
</script>

<EditorSection
	title={translate('Live vermogen', $selectedLanguageStore)}
	icon="bolt"
	tone="amber"
	status={liveStatus.status}
	statusLabel={liveStatus.label}
>
	<div class="np-help">
		{translate(
			'Real-time vermogen in W. Positief = afname uit het net, negatief = teruglevering.',
			$selectedLanguageStore
		)}
	</div>
	<div class="np-field">
		<span class="np-label">{translate('Netto verbruik', $selectedLanguageStore)}</span>
		<input
			type="text"
			class="np-input mono"
			value={p.netEntityId}
			placeholder="sensor.p1_meter_vermogen"
			oninput={(e) => p.onNetEntityIdChange((e.currentTarget as HTMLInputElement).value)}
		/>
	</div>
	<div class="np-grid-2">
		<div class="np-field">
			<span class="np-label">{translate('Zonnepanelen', $selectedLanguageStore)}</span>
			<input
				type="text"
				class="np-input mono"
				value={p.solarEntityId}
				placeholder="sensor.solar_power"
				oninput={(e) => p.onSolarEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
		<div class="np-field">
			<span class="np-label">{translate('Huisverbruik', $selectedLanguageStore)}</span>
			<input
				type="text"
				class="np-input mono"
				value={p.gridEntityId}
				placeholder="sensor.power_consumption"
				oninput={(e) => p.onGridEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
		<div class="np-field">
			<span class="np-label">{translate('Accu vermogen', $selectedLanguageStore)}</span>
			<input
				type="text"
				class="np-input mono"
				value={p.batteryEntityId}
				placeholder="sensor.battery_power"
				oninput={(e) => p.onBatteryEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
		<div class="np-field">
			<span class="np-label">{translate('Accu lading', $selectedLanguageStore)} %</span>
			<input
				type="text"
				class="np-input mono"
				value={p.batteryChargeEntityId}
				placeholder="sensor.battery_state_of_charge"
				oninput={(e) => p.onBatteryChargeEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
	</div>
</EditorSection>

<EditorSection
	title={translate('Vandaag-totalen', $selectedLanguageStore)}
	icon="chart-bar"
	tone="blue"
	status={totalsStatus.status}
	statusLabel={totalsStatus.label}
>
	<div class="np-help">
		{translate('kWh-tellers via Utility Meter helpers in Home Assistant.', $selectedLanguageStore)}
	</div>
	<div class="np-grid-2">
		<div class="np-field">
			<span class="np-label"
				>{translate('Afname', $selectedLanguageStore)} {translate('vandaag', $selectedLanguageStore)}</span
			>
			<input
				type="text"
				class="np-input mono"
				value={p.importTodayEntityId ?? ''}
				placeholder="sensor.energie_import_vandaag"
				oninput={(e) => p.onImportTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
		<div class="np-field">
			<span class="np-label"
				>{translate('Teruglevering', $selectedLanguageStore)}
				{translate('vandaag', $selectedLanguageStore)}</span
			>
			<input
				type="text"
				class="np-input mono"
				value={p.exportTodayEntityId ?? ''}
				placeholder="sensor.energie_export_vandaag"
				oninput={(e) => p.onExportTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
		<div class="np-field">
			<span class="np-label"
				>{translate('Opwek', $selectedLanguageStore)} {translate('vandaag', $selectedLanguageStore)}</span
			>
			<input
				type="text"
				class="np-input mono"
				value={p.solarTodayEntityId ?? ''}
				placeholder="sensor.zon_vandaag"
				oninput={(e) => p.onSolarTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
		<div class="np-field">
			<span class="np-label"
				>{translate('Huisverbruik', $selectedLanguageStore)}
				{translate('vandaag', $selectedLanguageStore)}</span
			>
			<input
				type="text"
				class="np-input mono"
				value={p.homeTodayEntityId ?? ''}
				placeholder="sensor.huis_verbruik_vandaag"
				oninput={(e) => p.onHomeTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
	</div>
	<div class="np-field">
		<span class="np-label"
			>{translate('Zelfvoorzienend', $selectedLanguageStore)} %
			<span class="np-hint">({translate('optioneel; anders berekend', $selectedLanguageStore)})</span></span
		>
		<input
			type="text"
			class="np-input mono"
			value={p.selfSufficiencyEntityId ?? ''}
			placeholder="sensor.zelfvoorzienend_vandaag"
			oninput={(e) => p.onSelfSufficiencyEntityIdChange((e.currentTarget as HTMLInputElement).value)}
		/>
	</div>
</EditorSection>

<EditorSection
	title={`${translate('Kosten', $selectedLanguageStore)} ${translate('vandaag', $selectedLanguageStore)}`}
	icon="currency-euro"
	tone="green"
	status={costsStatus.status}
	statusLabel={costsStatus.label}
>
	<div class="cost-mode-row" role="radiogroup" aria-label={translate('Kostenmodus', $selectedLanguageStore)}>
		{#each costModeOptions as option (option.value)}
			<button
				type="button"
				class="cost-mode-btn"
				class:active={activeCostMode === option.value}
				aria-pressed={activeCostMode === option.value}
				onclick={() => p.onEnergyCostModeChange(option.value)}
			>
				{translate(option.label, $selectedLanguageStore)}
			</button>
		{/each}
	</div>

	{#if activeCostMode === 'sensor'}
		<div class="np-help">
			{translate(
				'Gebruik cumulatieve euro-sensoren voor de werkelijke kosten en vergoeding van vandaag.',
				$selectedLanguageStore
			)}
		</div>
		<div class="np-grid-2">
			<div class="np-field">
				<span class="np-label">{translate('Kosten', $selectedLanguageStore)} nu</span>
				<input
					type="text"
					class="np-input mono"
					value={p.costCurrentEntityId ?? ''}
					placeholder="sensor.kosten_import_nu"
					oninput={(e) => p.onCostCurrentEntityIdChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label">{translate('Compensatie', $selectedLanguageStore)} nu</span>
				<input
					type="text"
					class="np-input mono"
					value={p.compensationCurrentEntityId ?? ''}
					placeholder="sensor.compensatie_export_nu"
					oninput={(e) =>
						p.onCompensationCurrentEntityIdChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label">{translate('Kosten', $selectedLanguageStore)} import</span>
				<input
					type="text"
					class="np-input mono"
					value={p.costTodayEntityId ?? ''}
					placeholder="sensor.kosten_import_vandaag"
					oninput={(e) => p.onCostTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label">{translate('Compensatie teruglevering', $selectedLanguageStore)}</span>
				<input
					type="text"
					class="np-input mono"
					value={p.compensationTodayEntityId ?? ''}
					placeholder="sensor.compensatie_export_vandaag"
					oninput={(e) => p.onCompensationTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label">{translate('Kosten', $selectedLanguageStore)} maand</span>
				<input
					type="text"
					class="np-input mono"
					value={p.costMonthEntityId ?? ''}
					placeholder="sensor.kosten_import_maand"
					oninput={(e) => p.onCostMonthEntityIdChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label">{translate('Compensatie', $selectedLanguageStore)} maand</span>
				<input
					type="text"
					class="np-input mono"
					value={p.compensationMonthEntityId ?? ''}
					placeholder="sensor.compensatie_export_maand"
					oninput={(e) => p.onCompensationMonthEntityIdChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label">{translate('Kosten', $selectedLanguageStore)} jaar</span>
				<input
					type="text"
					class="np-input mono"
					value={p.costYearEntityId ?? ''}
					placeholder="sensor.kosten_import_jaar"
					oninput={(e) => p.onCostYearEntityIdChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label">{translate('Compensatie', $selectedLanguageStore)} jaar</span>
				<input
					type="text"
					class="np-input mono"
					value={p.compensationYearEntityId ?? ''}
					placeholder="sensor.compensatie_export_jaar"
					oninput={(e) => p.onCompensationYearEntityIdChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
		</div>
	{:else if activeCostMode === 'peak_offpeak'}
		<div class="np-help">
			{translate(
				'Voor een vast contract: koppel de piek- en dal-kWh-tellers en vul de vaste tarieven per kWh in.',
				$selectedLanguageStore
			)}
		</div>
		<div class="np-grid-2">
			<div class="np-field">
				<span class="np-label"
					>{translate('Afname piek', $selectedLanguageStore)}
					{translate('vandaag', $selectedLanguageStore)}</span
				>
				<input
					type="text"
					class="np-input mono"
					value={p.importPeakTodayEntityId ?? ''}
					placeholder="sensor.energie_import_piek_vandaag"
					oninput={(e) => p.onImportPeakTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label"
					>{translate('Afname dal', $selectedLanguageStore)}
					{translate('vandaag', $selectedLanguageStore)}</span
				>
				<input
					type="text"
					class="np-input mono"
					value={p.importOffPeakTodayEntityId ?? ''}
					placeholder="sensor.energie_import_dal_vandaag"
					oninput={(e) => p.onImportOffPeakTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label"
					>{translate('Teruglevering piek', $selectedLanguageStore)}
					{translate('vandaag', $selectedLanguageStore)}</span
				>
				<input
					type="text"
					class="np-input mono"
					value={p.exportPeakTodayEntityId ?? ''}
					placeholder="sensor.energie_export_piek_vandaag"
					oninput={(e) => p.onExportPeakTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label"
					>{translate('Teruglevering dal', $selectedLanguageStore)}
					{translate('vandaag', $selectedLanguageStore)}</span
				>
				<input
					type="text"
					class="np-input mono"
					value={p.exportOffPeakTodayEntityId ?? ''}
					placeholder="sensor.energie_export_dal_vandaag"
					oninput={(e) => p.onExportOffPeakTodayEntityIdChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label"
					>{translate('Afname piek tarief', $selectedLanguageStore)} {tariffCurrencyCode}/kWh</span
				>
				<input
					type="text"
					inputmode="decimal"
					class="np-input mono"
					value={p.importPeakTariff ?? ''}
					placeholder="0.39"
					oninput={(e) => p.onImportPeakTariffChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label"
					>{translate('Afname dal tarief', $selectedLanguageStore)} {tariffCurrencyCode}/kWh</span
				>
				<input
					type="text"
					inputmode="decimal"
					class="np-input mono"
					value={p.importOffPeakTariff ?? ''}
					placeholder="0.32"
					oninput={(e) => p.onImportOffPeakTariffChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label"
					>{translate('Teruglever piek tarief', $selectedLanguageStore)} {tariffCurrencyCode}/kWh</span
				>
				<input
					type="text"
					inputmode="decimal"
					class="np-input mono"
					value={p.exportPeakTariff ?? ''}
					placeholder="0.13"
					oninput={(e) => p.onExportPeakTariffChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label"
					>{translate('Teruglever dal tarief', $selectedLanguageStore)} {tariffCurrencyCode}/kWh</span
				>
				<input
					type="text"
					inputmode="decimal"
					class="np-input mono"
					value={p.exportOffPeakTariff ?? ''}
					placeholder="0.08"
					oninput={(e) => p.onExportOffPeakTariffChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label"
					>{translate('Teruglever tarief enkel', $selectedLanguageStore)}
					{tariffCurrencyCode}/kWh
					<span class="np-hint">({translate('optioneel', $selectedLanguageStore)})</span></span
				>
				<input
					type="text"
					inputmode="decimal"
					class="np-input mono"
					value={p.exportTariff ?? ''}
					placeholder="0.10"
					oninput={(e) => p.onExportTariffChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
		</div>
	{:else}
		<div class="np-help">
			{translate(
				'Met alleen actuele tariefsensors is het dagbedrag een schatting. Gebruik exacte euro-sensoren voor werkelijke dynamische kosten.',
				$selectedLanguageStore
			)}
		</div>
		<div class="np-grid-2">
			<div class="np-field">
				<span class="np-label">{translate('Actuele stroomprijs', $selectedLanguageStore)}</span>
				<input
					type="text"
					class="np-input mono"
					value={p.energyPriceEntityId ?? ''}
					placeholder="sensor.nord_pool_nl_huidige_prijs"
					oninput={(e) => p.onEnergyPriceEntityIdChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label">{translate('Import tarief sensor', $selectedLanguageStore)}</span>
				<input
					type="text"
					class="np-input mono"
					value={p.importTariffEntityId ?? ''}
					placeholder="sensor.energie_import_tarief"
					oninput={(e) => p.onImportTariffEntityIdChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
			<div class="np-field">
				<span class="np-label">{translate('Teruglever tarief sensor', $selectedLanguageStore)}</span>
				<input
					type="text"
					class="np-input mono"
					value={p.exportTariffEntityId ?? ''}
					placeholder="sensor.energie_export_tarief"
					oninput={(e) => p.onExportTariffEntityIdChange((e.currentTarget as HTMLInputElement).value)}
				/>
			</div>
		</div>
	{/if}
</EditorSection>

<EditorSection
	title="EMS"
	icon="activity"
	tone="green"
	status={emsStatus.status}
	statusLabel={emsStatus.label}
>
	<div class="np-help">
		{translate(
			'Koppel hier EMHASS/omvormer entiteiten zodat de energiekaart laat zien waarom de accu of laadpaal wordt aangestuurd.',
			$selectedLanguageStore
		)}
	</div>
	<div class="np-grid-2">
		<div class="np-field">
			<span class="np-label">{translate('Actuele stroomprijs', $selectedLanguageStore)}</span>
			<input
				type="text"
				class="np-input mono"
				value={p.energyPriceEntityId ?? ''}
				placeholder="sensor.nord_pool_nl_huidige_prijs"
				oninput={(e) => p.onEnergyPriceEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
		<div class="np-field">
			<span class="np-label">{translate('Accu target', $selectedLanguageStore)}</span>
			<input
				type="text"
				class="np-input mono"
				value={p.emsBatteryTargetEntityId ?? ''}
				placeholder="sensor.ems_emhass_battery_target"
				oninput={(e) => p.onEmsBatteryTargetEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
		<div class="np-field">
			<span class="np-label">{translate('Laadpaal target', $selectedLanguageStore)}</span>
			<input
				type="text"
				class="np-input mono"
				value={p.emsEvTargetEntityId ?? ''}
				placeholder="sensor.ems_emhass_ev_target"
				oninput={(e) => p.onEmsEvTargetEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
		<div class="np-field">
			<span class="np-label">{translate('Optimalisatie status', $selectedLanguageStore)}</span>
			<input
				type="text"
				class="np-input mono"
				value={p.emsOptimStatusEntityId ?? ''}
				placeholder="sensor.optim_status"
				oninput={(e) => p.onEmsOptimStatusEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
		<div class="np-field">
			<span class="np-label">{translate('Plan beschikbaar', $selectedLanguageStore)}</span>
			<input
				type="text"
				class="np-input mono"
				value={p.emsPlanAvailableEntityId ?? ''}
				placeholder="binary_sensor.ems_emhass_plan_available"
				oninput={(e) => p.onEmsPlanAvailableEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
		<div class="np-field">
			<span class="np-label">{translate('Omvormer modus', $selectedLanguageStore)}</span>
			<input
				type="text"
				class="np-input mono"
				value={p.emsModeEntityId ?? ''}
				placeholder="select.zolder_goodwe_inverter_ems_mode"
				oninput={(e) => p.onEmsModeEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
	</div>
</EditorSection>

<EditorSection
	title={translate('Auto en laadpaal', $selectedLanguageStore)}
	icon="car"
	tone="blue"
	status={carStatus.status}
	statusLabel={carStatus.label}
>
	<div class="np-help">
		{translate(
			'Wanneer ingevuld worden de auto-flows automatisch geactiveerd in de detailweergave.',
			$selectedLanguageStore
		)}
	</div>
	<div class="np-grid-2">
		<div class="np-field">
			<span class="np-label">{translate('Laadpaal status', $selectedLanguageStore)}</span>
			<input
				type="text"
				class="np-input mono"
				value={p.carChargingEntityId ?? ''}
				placeholder="sensor.laadpaal_main_state_socket_1"
				oninput={(e) => p.onCarChargingEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
		<div class="np-field">
			<span class="np-label">{translate('Kabel ingeplugd', $selectedLanguageStore)}</span>
			<input
				type="text"
				class="np-input mono"
				value={p.carCableEntityId ?? ''}
				placeholder="binary_sensor.skoda_octavia_combi_laadkabel"
				oninput={(e) => p.onCarCableEntityIdChange((e.currentTarget as HTMLInputElement).value)}
			/>
		</div>
	</div>
	<div class="np-field">
		<span class="np-label">{translate('Laadvermogen', $selectedLanguageStore)}</span>
		<input
			type="text"
			class="np-input mono"
			value={p.carChargingPowerEntityId ?? ''}
			placeholder="sensor.laadpaal_power"
			oninput={(e) => p.onCarChargingPowerEntityIdChange((e.currentTarget as HTMLInputElement).value)}
		/>
	</div>
</EditorSection>

<EditorSection
	title={translate('Live vermogen per apparaat', $selectedLanguageStore)}
	icon="device-desktop-analytics"
	tone="amber"
	status={devicesStatus.status}
	statusLabel={devicesStatus.label}
>
	<div class="np-help">
		{translate(
			'Selecteer de apparaten waarvan je het live vermogen wilt zien in de afname-sub-pop-up. Toont alleen entiteiten met W/kW als eenheid of',
			$selectedLanguageStore
		)} <code>device_class: power</code>.
	</div>
	<AreaPicker
		selectedRows={p.energyPowerSelectedRows ?? []}
		ignoredRows={p.energyPowerIgnoredRows ?? []}
		onToggle={(entityId, checked) => p.toggleEnergyDevicePowerEntity?.(entityId, checked)}
		onSelectAll={() => p.selectAllEnergyDevicePower?.()}
		onClearAll={() => p.clearEnergyDevicePower?.()}
	/>
</EditorSection>

<EditorSection
	title={translate('kWh vandaag per apparaat', $selectedLanguageStore)}
	icon="chart-bar"
	tone="amber"
	status={devicesStatus.status}
	statusLabel={devicesStatus.label}
>
	<div class="np-help">
		{translate(
			'Optioneel. Selecteer de bijbehorende kWh-tellers per apparaat (zelfde apparaat als hierboven). Toont alleen entiteiten met kWh/Wh als eenheid of',
			$selectedLanguageStore
		)} <code>device_class: energy</code>.
	</div>
	<AreaPicker
		selectedRows={p.energyEnergySelectedRows ?? []}
		ignoredRows={p.energyEnergyIgnoredRows ?? []}
		onToggle={(entityId, checked) => p.toggleEnergyDeviceTodayEntity?.(entityId, checked)}
		onSelectAll={() => p.selectAllEnergyDeviceToday?.()}
		onClearAll={() => p.clearEnergyDeviceToday?.()}
	/>
</EditorSection>

{#if deviceAliasRows.length > 0}
	<EditorSection
		title={translate('Namen per apparaat', $selectedLanguageStore)}
		icon="pencil"
		tone="amber"
		status={deviceAliasRows.some((row) => row.alias.trim().length > 0) ? 'partial' : 'empty'}
		statusLabel={`${deviceAliasRows.length} ${translate(deviceAliasRows.length === 1 ? 'apparaat' : 'apparaten', $selectedLanguageStore)}`}
	>
		<div class="np-help">
			{translate(
				'Pas hier de namen aan die Nova Panel toont. De oorspronkelijke Home Assistant naam blijft tussen haakjes zichtbaar.',
				$selectedLanguageStore
			)}
		</div>
		<div class="alias-editor-list">
			{#each deviceAliasRows as row (row.id)}
				<div class="alias-editor-row">
					<div class="alias-editor-meta">
						<span class="alias-editor-name">
							{row.alias.trim().length > 0 ? row.alias.trim() : row.originalName}
							<span class="np-hint">({row.originalName})</span>
						</span>
						<span class="alias-editor-id">{row.id}</span>
					</div>
					<input
						type="text"
						class="np-input"
						value={row.alias}
						placeholder={row.originalName}
						oninput={(event) => updateDeviceAlias(row.id, (event.currentTarget as HTMLInputElement).value)}
					/>
				</div>
			{/each}
		</div>
	</EditorSection>
{/if}

<EditorSection
	title={translate("Eigen foto's en ankerpunten", $selectedLanguageStore)}
	icon="photo"
	tone="purple"
	status={assetsStatus.status}
	statusLabel={assetsStatus.label}
>
	<div class="np-help">
		{translate('Per scenario een eigen foto en ankerpunten voor de flow-lijnen.', $selectedLanguageStore)}
	</div>
	<div class="np-variant-grid">
		{#each variants as variant (variant.key)}
			<div class="np-variant" class:has={variant.has}>
				<div class="np-variant-thumb">
					{#if variant.has}<span class="np-variant-mark"></span>{/if}
					{translate(variant.has ? 'Eigen foto' : 'Standaard', $selectedLanguageStore)}
				</div>
				<div class="np-variant-meta">
					<div class="np-variant-name">{translate(variant.label, $selectedLanguageStore)}</div>
					<div class="np-variant-actions">
						<button type="button" class="np-mini-btn" onclick={() => p.onEnergyUploadClick(variant.key)}>
							{translate(variant.has ? 'Foto wijzig' : 'Foto…', $selectedLanguageStore)}
						</button>
						{#if variant.has}
							<button
								type="button"
								class="np-mini-btn ghost"
								onclick={() => p.onEnergyResetClick(variant.key)}
								>{translate('Reset', $selectedLanguageStore)}</button
							>
						{/if}
						<button
							type="button"
							class="np-mini-btn primary"
							onclick={() => p.onEnergyAnchorsClick(variant.key)}
						>
							{translate(variant.anchors ? 'Ankers ✓' : 'Ankers…', $selectedLanguageStore)}
						</button>
					</div>
				</div>
			</div>
		{/each}
	</div>
</EditorSection>

<style>
	.cost-mode-row {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.35rem;
	}
	.cost-mode-btn {
		min-height: 2.35rem;
		border: 1px solid rgba(255, 255, 255, 0.1);
		border-radius: 0.45rem;
		background: rgba(255, 255, 255, 0.045);
		color: rgba(255, 255, 255, 0.72);
		font: inherit;
		font-size: 0.78rem;
		font-weight: 650;
		cursor: pointer;
	}
	.cost-mode-btn.active {
		border-color: rgba(74, 222, 128, 0.45);
		background: rgba(74, 222, 128, 0.14);
		color: rgba(255, 255, 255, 0.95);
	}
	.alias-editor-list {
		display: grid;
		gap: 0.5rem;
	}
	.alias-editor-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(180px, 0.9fr);
		gap: 0.5rem;
		align-items: center;
		padding: 0.55rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 0.45rem;
		background: rgba(255, 255, 255, 0.035);
		min-width: 0;
	}
	.alias-editor-meta {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}
	.alias-editor-name,
	.alias-editor-id {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.alias-editor-name {
		font-size: 0.86rem;
		color: rgba(255, 255, 255, 0.92);
	}
	.alias-editor-id {
		font-family:
			ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
		font-size: 0.68rem;
		color: rgba(255, 255, 255, 0.42);
	}
	@media (max-width: 640px) {
		.cost-mode-row {
			grid-template-columns: 1fr;
		}
		.alias-editor-row {
			grid-template-columns: 1fr;
		}
	}
</style>
