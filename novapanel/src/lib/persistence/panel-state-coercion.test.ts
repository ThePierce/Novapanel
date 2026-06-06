import { describe, expect, it } from 'vitest';
import {
	coerceCardDraftFromUnknown,
	coerceCardDraft,
	coerceEnergyAnchorsFromUnknown,
	coerceViewSectionFromUnknown,
	dashboardScore,
	getClockStyleName,
	parseDashboardValue,
	withCardType
} from './panel-state-coercion';
import type { CardDraft, PanelDashboard } from './panel-state-types';

describe('panel state coercion', () => {
	it('preserves aurora clock style and clamps forecast days', () => {
		const result = coerceCardDraftFromUnknown(
			{
				id: 'clock',
				title: 'Clock',
				cardType: 'clock',
				clockStyle: 'aurora',
				weatherForecastDaysToShow: 99
			},
			0
		);

		expect(result).toMatchObject({
			id: 'clock',
			clockStyle: 'aurora',
			weatherForecastDaysToShow: 7
		});
	});

	it('rejects unknown clock style names', () => {
		expect(getClockStyleName('aurora')).toBe('aurora');
		expect(getClockStyleName('not-real')).toBeUndefined();
	});

	it('normalizes cards through the same coercion path for withCardType', () => {
		const raw = {
			id: 'media',
			title: 'Media',
			cardType: 'media_players_status',
			statusIcon: 'mdi:play-network',
			clockStyle: 'aurora',
			energyCostMode: 'dynamic',
			importPeakTariff: '0,42',
			exportPeakTodayEntityId: ' sensor.export_peak ',
			exportOffPeakTariff: '0,08',
			energyDeviceEntityIds: [' sensor.washer ', ''],
			cameras: [{ entityId: ' camera.front ', alias: 'Front' }]
		};

		const coerced = coerceCardDraft(raw, 0);

		expect(coerced).toMatchObject({
			id: 'media',
			statusIcon: 'mdi:audio-video',
			clockStyle: 'aurora',
			energyCostMode: 'dynamic',
			importPeakTariff: 0.42,
			exportPeakTodayEntityId: 'sensor.export_peak',
			exportOffPeakTariff: 0.08,
			energyDeviceEntityIds: ['sensor.washer'],
			cameras: [{ entityId: 'camera.front', alias: 'Front' }]
		});
		expect(withCardType(raw as unknown as CardDraft)).toEqual(coerced);
	});

	it('clamps energy anchor coordinates while preserving valid flow waypoints', () => {
		const result = coerceEnergyAnchorsFromUnknown({
			solar: { x: -10, y: 0.2 },
			battery: { x: 0.3, y: 20 },
			door: { x: 0.5, y: 0.5 },
			car: { x: 0.6, y: 0.6 },
			street: { x: 0.7, y: 0.7 },
			railX: 2,
			flowWaypoints: {
				solarToHome: [{ x: '0.25', y: '0.75' }],
				unknown: [{ x: 1, y: 1 }]
			}
		});

		expect(result).toMatchObject({
			solar: { x: -0.5, y: 0.2 },
			battery: { x: 0.3, y: 1.5 },
			railX: 1,
			flowWaypoints: {
				solarToHome: [{ x: 0.25, y: 0.75 }]
			}
		});
	});

	it('coerces view sections with fallback metadata and valid cards', () => {
		const result = coerceViewSectionFromUnknown(
			{
				title: 12,
				column: '3',
				span: '2',
				order: '4',
				cardColumns: '2',
				cards: [{ id: 'weather', title: 'Weather', cardType: 'weather' }, null]
			},
			0
		);

		expect(result).toMatchObject({
			title: 'Section 1',
			icon: 'layout-grid',
			column: 3,
			span: 2,
			order: 4,
			cardColumns: 2,
			cards: [{ id: 'weather', cardType: 'weather' }]
		});
		expect(result?.id).toMatch(/^section-/);
	});

	it('parses dashboard values with clamped layout and legacy view card fallback', () => {
		const defaults: PanelDashboard = {
			layout: { columns: 2, popupWidth: 850, popupHeight: 1140 },
			viewSections: [],
			sidebarCards: [],
			updatedAt: 10
		};

		const result = parseDashboardValue(
			{
				layout: { columns: 3, popupWidth: 9999, popupHeight: 10 },
				viewCards: [{ id: 'legacy', title: 'Legacy', cardType: 'date' }],
				updatedAt: 123
			},
			defaults
		);

		expect(result.layout).toEqual({ columns: 3, popupWidth: 1640, popupHeight: 440 });
		expect(result.viewSections).toHaveLength(1);
		expect(result.viewSections[0].cards[0]).toMatchObject({ id: 'legacy', cardType: 'date' });
		expect(result.updatedAt).toBe(123);
	});

	it('scores dashboards by updatedAt with card count as legacy fallback', () => {
		const dashboard = (updatedAt: number, cardCount: number): PanelDashboard => ({
			layout: { columns: 2, popupWidth: 850, popupHeight: 1140 },
			viewSections: [
				{
					id: 'section',
					title: 'Section',
					icon: 'layout-grid',
					column: 1,
					span: 1,
					order: 0,
					cardColumns: 1,
					cards: Array.from({ length: cardCount }, (_, index) => ({
						id: `card-${index}`,
						title: '',
						cardType: 'custom'
					}))
				}
			],
			sidebarCards: [],
			updatedAt
		});

		expect(dashboardScore(dashboard(200, 1))).toBeGreaterThan(dashboardScore(dashboard(100, 10)));
		expect(dashboardScore(dashboard(0, 3))).toBe(3);
	});
});
