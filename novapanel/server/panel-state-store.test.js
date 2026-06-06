import { describe, expect, it } from 'vitest';
import {
	createSerializedTaskQueue,
	mergePanelStatePayload,
	panelStateWriteAck
} from './panel-state-store.js';

describe('mergePanelStatePayload', () => {
	it('uses the server timestamp for dashboard and configuration writes', () => {
		const merged = mergePanelStatePayload(
			{
				dashboard: { layout: { columns: 1 }, updatedAt: 10 },
				configuration: { language: 'nl', updatedAt: 20 }
			},
			{
				dashboard: { updatedAt: 999, sidebarCards: [] },
				configuration: { theme: 'daylight', updatedAt: 999 }
			},
			12345
		);

		expect(merged.dashboard).toMatchObject({ layout: { columns: 1 }, sidebarCards: [], updatedAt: 12345 });
		expect(merged.configuration).toMatchObject({ language: 'nl', theme: 'daylight', updatedAt: 12345 });
	});

	it('keeps existing dashboard data on configuration-only writes', () => {
		const merged = mergePanelStatePayload(
			{ dashboard: { updatedAt: 10, sidebarCards: [{ id: 'a' }] } },
			{ configuration: { language: 'en' } },
			42
		);

		expect(merged.dashboard).toEqual({ updatedAt: 10, sidebarCards: [{ id: 'a' }] });
		expect(merged.configuration).toEqual({ language: 'en', updatedAt: 42 });
	});
});

describe('panelStateWriteAck', () => {
	it('returns only timestamp metadata', () => {
		expect(
			panelStateWriteAck({
				dashboard: { updatedAt: 7, secret: 'not-returned' },
				configuration: { updatedAt: 8, oauth: { spotifyClientSecret: 'not-returned' } }
			})
		).toEqual({ ok: true, dashboardUpdatedAt: 7, configurationUpdatedAt: 8 });
	});
});

describe('createSerializedTaskQueue', () => {
	it('runs overlapping tasks one after another', async () => {
		const serialize = createSerializedTaskQueue();
		const order = [];
		let releaseFirst = () => {};

		const first = serialize(
			() =>
				new Promise((resolve) => {
					order.push('first:start');
					releaseFirst = () => {
						order.push('first:end');
						resolve('first');
					};
				})
		);
		const second = serialize(async () => {
			order.push('second');
			return 'second';
		});

		await Promise.resolve();
		await Promise.resolve();
		expect(order).toEqual(['first:start']);
		releaseFirst();
		await expect(first).resolves.toBe('first');
		await expect(second).resolves.toBe('second');
		expect(order).toEqual(['first:start', 'first:end', 'second']);
	});
});
