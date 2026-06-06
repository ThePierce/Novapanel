import { describe, expect, it } from 'vitest';
import { buildStatusSummary, isEntityActive, type StatusCardKind } from './status-engine';
import type { HomeAssistantEntity } from '$lib/ha/entities-service-helpers';

function entity(state: string, domain = 'sensor', deviceClass = ''): HomeAssistantEntity {
	return {
		entityId: `${domain}.test`,
		state,
		domain,
		deviceClass,
		friendlyName: 'Test',
		unit: '',
		icon: '',
		attributes: {}
	};
}

describe('status-engine summaries', () => {
	it('uses localized plural summaries for lights', () => {
		expect(buildStatusSummary({ kind: 'lights_status', activeCount: 0, language: 'de' })).toBe(
			'Alle Lichter sind ausgeschaltet.'
		);
		expect(buildStatusSummary({ kind: 'lights_status', activeCount: 2, language: 'fr' })).toBe(
			'2 lumières sont allumées.'
		);
	});

	it('distinguishes door/window summaries', () => {
		expect(
			buildStatusSummary({
				kind: 'openings_status',
				activeCount: 1,
				activeEntities: [entity('on', 'binary_sensor', 'window')],
				language: 'es'
			})
		).toBe('1 ventana está abierta.');
	});
});

describe('status-engine active states', () => {
	it.each<[StatusCardKind, string, boolean]>([
		['availability_status', 'unavailable', true],
		['availability_status', 'unknown', true],
		['openings_status', 'open', true],
		['lights_status', 'on', true],
		['devices_status', 'unlocked', true],
		['media_players_status', 'paused', true],
		['media_players_status', 'off', false]
	])('classifies %s state %s as active=%s', (kind, state, expected) => {
		expect(isEntityActive(entity(state), kind)).toBe(expected);
	});
});
