import {
	getHassWithRetry,
	getNovaApiCandidates,
	type HassLike
} from '$lib/ha/entities-service-helpers';

export type CalendarEvent = {
	uid?: string;
	summary: string;
	start: string | { date?: string; dateTime?: string };
	end: string | { date?: string; dateTime?: string };
	description?: string;
	location?: string;
};

let cachedHass: HassLike | null = null;
let hassLookupDone = false;

async function getEmbeddedHassQuick(): Promise<HassLike | null> {
	if (!hassLookupDone) {
		cachedHass = await getHassWithRetry(1, 0);
		hassLookupDone = true;
	}
	return cachedHass;
}

function unwrapEvents(result: unknown): CalendarEvent[] {
	if (Array.isArray(result)) return result as CalendarEvent[];
	if (result && typeof result === 'object' && Array.isArray((result as { events?: unknown }).events)) {
		return (result as { events: CalendarEvent[] }).events;
	}
	return [];
}

async function callCalendarWs(payload: Record<string, unknown>): Promise<unknown> {
	const hass = await getEmbeddedHassQuick();
	cachedHass = hass;
	if (hass) {
		if (typeof hass.callWS === 'function') return await hass.callWS(payload);
		if (typeof hass.connection?.sendMessagePromise === 'function') {
			return await hass.connection.sendMessagePromise(payload);
		}
	}

	let lastError: unknown = null;
	for (const endpoint of getNovaApiCandidates('/api/ha/ws')) {
		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				credentials: 'same-origin',
				cache: 'no-store',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ payload, timeoutMs: 20000 })
			});
			if (!response.ok) throw new Error(`ha_ws_proxy_http_${response.status}`);
			const data = (await response.json()) as { ok?: boolean; result?: unknown; error?: string };
			if (data.ok !== true) throw new Error(data.error || 'ha_ws_proxy_failed');
			return data.result;
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError ?? new Error('ha_calendar_ws_unavailable');
}

export async function listCalendarEvents(
	entityId: string,
	start: Date,
	end: Date
): Promise<CalendarEvent[]> {
	const result = await callCalendarWs({
		type: 'calendar/event/subscribe',
		entity_id: entityId,
		start: start.toISOString(),
		end: end.toISOString()
	});
	return unwrapEvents(result);
}
