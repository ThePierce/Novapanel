import { getNovaApiCandidates } from '$lib/ha/entities-service-helpers';

export type CalendarEvent = {
	uid?: string;
	summary: string;
	start: string | { date?: string; dateTime?: string };
	end: string | { date?: string; dateTime?: string };
	description?: string;
	location?: string;
};

function unwrapEvents(result: unknown): CalendarEvent[] {
	if (Array.isArray(result)) return result as CalendarEvent[];
	if (result && typeof result === 'object' && Array.isArray((result as { events?: unknown }).events)) {
		return (result as { events: CalendarEvent[] }).events;
	}
	return [];
}

async function fetchCalendarRest(entityId: string, start: Date, end: Date): Promise<unknown> {
	const query = new URLSearchParams({
		start: start.toISOString(),
		end: end.toISOString()
	});
	const path = `/api/calendars/${encodeURIComponent(entityId)}?${query.toString()}`;
	let lastError: unknown = null;
	for (const endpoint of getNovaApiCandidates(path)) {
		try {
			const response = await fetch(endpoint, {
				credentials: 'same-origin',
				cache: 'no-store',
				headers: { accept: 'application/json' }
			});
			if (!response.ok) throw new Error(`ha_calendar_rest_http_${response.status}`);
			return await response.json();
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError ?? new Error('ha_calendar_rest_unavailable');
}

async function callCalendarWsProxy(payload: Record<string, unknown>): Promise<unknown> {
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
	try {
		return unwrapEvents(await fetchCalendarRest(entityId, start, end));
	} catch {
		const result = await callCalendarWsProxy({
			type: 'calendar/event/subscribe',
			entity_id: entityId,
			start: start.toISOString(),
			end: end.toISOString()
		});
		return unwrapEvents(result);
	}
}
