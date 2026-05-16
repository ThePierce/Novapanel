import { getNovaApiCandidates } from '$lib/ha/entities-service-helpers';

export type CalendarEvent = {
	uid?: string;
	summary: string;
	start: string | { date?: string; dateTime?: string };
	end: string | { date?: string; dateTime?: string };
	description?: string;
	location?: string;
	[key: string]: unknown;
};

function unwrapEvents(result: unknown): CalendarEvent[] {
	if (Array.isArray(result)) return result as CalendarEvent[];
	if (result && typeof result === 'object' && Array.isArray((result as { events?: unknown }).events)) {
		return (result as { events: CalendarEvent[] }).events;
	}
	return [];
}

async function fetchCalendarEvents(entityId: string, start: Date, end: Date): Promise<unknown> {
	const query = new URLSearchParams({
		entity_id: entityId,
		start: start.toISOString(),
		end: end.toISOString()
	});
	const path = `/api/ha/calendar/events?${query.toString()}`;
	let lastError: unknown = null;
	for (const endpoint of getNovaApiCandidates(path)) {
		try {
			const response = await fetch(endpoint, {
				credentials: 'same-origin',
				cache: 'no-store',
				headers: { accept: 'application/json' }
			});
			if (!response.ok) throw new Error(`ha_calendar_events_http_${response.status}`);
			return await response.json();
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError ?? new Error('ha_calendar_events_unavailable');
}

export async function listCalendarEvents(
	entityId: string,
	start: Date,
	end: Date
): Promise<CalendarEvent[]> {
	return unwrapEvents(await fetchCalendarEvents(entityId, start, end));
}
