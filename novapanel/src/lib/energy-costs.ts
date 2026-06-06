import type { EnergyCostMode } from '$lib/persistence/panel-state-types';

export type EnergyCostModeConfig = {
	energyCostMode?: EnergyCostMode;
	costTodayEntityId?: string;
	compensationTodayEntityId?: string;
	importPeakTodayEntityId?: string;
	importOffPeakTodayEntityId?: string;
	exportPeakTodayEntityId?: string;
	exportOffPeakTodayEntityId?: string;
	importTariffEntityId?: string;
	exportTariffEntityId?: string;
	importPeakTariff?: number;
	importOffPeakTariff?: number;
	exportPeakTariff?: number;
	exportOffPeakTariff?: number;
	exportTariff?: number;
};

export type EnergyCostValues = {
	costMode: EnergyCostMode;
	costToday: number | null;
	compensationToday: number | null;
	importToday: number | null;
	exportToday: number | null;
	importPeakToday: number | null;
	importOffPeakToday: number | null;
	exportPeakToday: number | null;
	exportOffPeakToday: number | null;
	importTariffLive: number | null;
	exportTariffLive: number | null;
	importPeakTariff: number | null;
	importOffPeakTariff: number | null;
	exportPeakTariff: number | null;
	exportOffPeakTariff: number | null;
	exportTariff: number | null;
};

export type EnergyCostResult = {
	mode: EnergyCostMode;
	importCost: number | null;
	exportCompensation: number | null;
	netCost: number | null;
	isEstimate: boolean;
};

function hasText(value: unknown): boolean {
	return typeof value === 'string' && value.trim().length > 0;
}

function hasNumber(value: unknown): boolean {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isEnergyCostMode(value: unknown): value is EnergyCostMode {
	return value === 'sensor' || value === 'peak_offpeak' || value === 'dynamic';
}

export function deriveEnergyCostMode(config: EnergyCostModeConfig): EnergyCostMode {
	if (isEnergyCostMode(config.energyCostMode)) return config.energyCostMode;
	if (hasText(config.costTodayEntityId) || hasText(config.compensationTodayEntityId)) return 'sensor';
	if (
		hasText(config.importPeakTodayEntityId) ||
		hasText(config.importOffPeakTodayEntityId) ||
		hasText(config.exportPeakTodayEntityId) ||
		hasText(config.exportOffPeakTodayEntityId) ||
		hasNumber(config.importPeakTariff) ||
		hasNumber(config.importOffPeakTariff) ||
		hasNumber(config.exportPeakTariff) ||
		hasNumber(config.exportOffPeakTariff) ||
		hasNumber(config.exportTariff)
	) {
		return 'peak_offpeak';
	}
	if (hasText(config.importTariffEntityId) || hasText(config.exportTariffEntityId)) return 'dynamic';
	return 'peak_offpeak';
}

function addKwhCost(
	total: number,
	kwh: number | null,
	tariff: number | null
): { total: number; used: boolean } {
	if (kwh === null || tariff === null) return { total, used: false };
	return { total: total + kwh * tariff, used: true };
}

function splitCost(
	peakKwh: number | null,
	offPeakKwh: number | null,
	peakTariff: number | null,
	offPeakTariff: number | null
): number | null {
	let total = 0;
	let used = false;
	let next = addKwhCost(total, peakKwh, peakTariff);
	total = next.total;
	used ||= next.used;
	next = addKwhCost(total, offPeakKwh, offPeakTariff);
	total = next.total;
	used ||= next.used;
	return used ? total : null;
}

export function calculateEnergyCosts(values: EnergyCostValues): EnergyCostResult {
	let importCost: number | null = null;
	let exportCompensation: number | null = null;
	let isEstimate = false;

	if (values.costMode === 'sensor') {
		importCost = values.costToday;
		exportCompensation = values.compensationToday;
	} else if (values.costMode === 'peak_offpeak') {
		importCost = splitCost(
			values.importPeakToday,
			values.importOffPeakToday,
			values.importPeakTariff,
			values.importOffPeakTariff
		);
		exportCompensation = splitCost(
			values.exportPeakToday,
			values.exportOffPeakToday,
			values.exportPeakTariff,
			values.exportOffPeakTariff
		);
		if (exportCompensation === null && values.exportToday !== null && values.exportTariff !== null) {
			exportCompensation = values.exportToday * values.exportTariff;
		}
	} else {
		if (values.importToday !== null && values.importTariffLive !== null) {
			importCost = values.importToday * values.importTariffLive;
		}
		if (values.exportToday !== null && values.exportTariffLive !== null) {
			exportCompensation = values.exportToday * values.exportTariffLive;
		}
		isEstimate = importCost !== null || exportCompensation !== null;
	}

	return {
		mode: values.costMode,
		importCost,
		exportCompensation,
		netCost:
			importCost === null && exportCompensation === null
				? null
				: (importCost ?? 0) - (exportCompensation ?? 0),
		isEstimate
	};
}
