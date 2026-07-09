import { describe, expect, it } from 'vitest';
import { calculateEnergyCosts, calculateLiveEnergyCost, deriveEnergyCostMode } from './energy-costs';

describe('energy cost calculation', () => {
	it('calculates fixed peak/off-peak import and export separately', () => {
		const result = calculateEnergyCosts({
			costMode: 'peak_offpeak',
			costToday: null,
			compensationToday: null,
			importToday: 12,
			exportToday: 5,
			importPeakToday: 3,
			importOffPeakToday: 9,
			exportPeakToday: 2,
			exportOffPeakToday: 3,
			importTariffLive: null,
			exportTariffLive: null,
			importPeakTariff: 0.42,
			importOffPeakTariff: 0.34,
			exportPeakTariff: 0.12,
			exportOffPeakTariff: 0.08,
			exportTariff: null
		});

		expect(result.mode).toBe('peak_offpeak');
		expect(result.importCost).toBeCloseTo(4.32);
		expect(result.exportCompensation).toBeCloseTo(0.48);
		expect(result.netCost).toBeCloseTo(3.84);
		expect(result.isEstimate).toBe(false);
	});

	it('marks current-price dynamic totals as estimates', () => {
		const result = calculateEnergyCosts({
			costMode: 'dynamic',
			costToday: null,
			compensationToday: null,
			importToday: 10,
			exportToday: 4,
			importPeakToday: null,
			importOffPeakToday: null,
			exportPeakToday: null,
			exportOffPeakToday: null,
			importTariffLive: 0.31,
			exportTariffLive: 0.06,
			importPeakTariff: null,
			importOffPeakTariff: null,
			exportPeakTariff: null,
			exportOffPeakTariff: null,
			exportTariff: null
		});

		expect(result.netCost).toBeCloseTo(2.86);
		expect(result.isEstimate).toBe(true);
	});

	it('derives a backward-compatible mode from existing card fields', () => {
		expect(deriveEnergyCostMode({ costTodayEntityId: 'sensor.cost' })).toBe('sensor');
		expect(deriveEnergyCostMode({ costMonthEntityId: 'sensor.month_cost' })).toBe('sensor');
		expect(deriveEnergyCostMode({ importPeakTariff: 0.42 })).toBe('peak_offpeak');
		expect(deriveEnergyCostMode({ importTariffEntityId: 'sensor.live_tariff' })).toBe('dynamic');
		expect(deriveEnergyCostMode({})).toBe('peak_offpeak');
	});

	it('calculates live import cost per hour from net power and tariff', () => {
		const result = calculateLiveEnergyCost({
			netPowerW: 6116,
			importTariff: 0.03754,
			exportTariff: 0.02
		});

		expect(result.netCostPerHour).toBeCloseTo(0.2296);
		expect(result.importCostPerHour).toBeCloseTo(0.2296);
		expect(result.exportCompensationPerHour).toBeNull();
		expect(result.isEstimate).toBe(true);
	});

	it('keeps negative dynamic prices in live cost estimates', () => {
		const result = calculateLiveEnergyCost({
			netPowerW: 5000,
			importTariff: -0.08,
			exportTariff: -0.08
		});

		expect(result.netCostPerHour).toBeCloseTo(-0.4);
		expect(result.isEstimate).toBe(true);
	});
});
