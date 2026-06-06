import { getNovaApiCandidates } from './entities-service-helpers';
import { fetchWithTimeout } from '$lib/fetch-with-timeout';

export type WeatherForecastType = 'daily' | 'hourly' | 'twice_daily';

type SubscribeWeatherForecastOptions = {
	entityId: string;
	forecastType: WeatherForecastType;
	onForecast: (forecast: Array<Record<string, unknown>>) => void;
	onError?: (message: string) => void;
};

const WEATHER_FORECAST_REFRESH_MS = 5 * 60 * 1000;
const WEATHER_FORECAST_RETRY_MS = 30 * 1000;

export function extractWeatherForecast(payload: unknown): Array<Record<string, unknown>> | null {
	if (!payload || typeof payload !== 'object') return null;
	const record = payload as Record<string, unknown>;
	if (Array.isArray(record.forecast)) return record.forecast as Array<Record<string, unknown>>;
	const event = record.event;
	if (event && typeof event === 'object') {
		const eventRecord = event as Record<string, unknown>;
		if (Array.isArray(eventRecord.forecast)) return eventRecord.forecast as Array<Record<string, unknown>>;
		const data = eventRecord.data;
		if (data && typeof data === 'object') {
			const dataRecord = data as Record<string, unknown>;
			if (Array.isArray(dataRecord.forecast)) return dataRecord.forecast as Array<Record<string, unknown>>;
		}
	}
	const result = record.result;
	if (result && typeof result === 'object') {
		const resultRecord = result as Record<string, unknown>;
		if (Array.isArray(resultRecord.forecast)) return resultRecord.forecast as Array<Record<string, unknown>>;
		const response = resultRecord.response;
		if (response && typeof response === 'object') {
			for (const value of Object.values(response as Record<string, unknown>)) {
				if (!value || typeof value !== 'object') continue;
				const entityForecast = (value as Record<string, unknown>).forecast;
				if (Array.isArray(entityForecast)) return entityForecast as Array<Record<string, unknown>>;
			}
		}
	}
	return null;
}

export async function subscribeWeatherForecastDirect(
	options: SubscribeWeatherForecastOptions
): Promise<() => void> {
	let closed = false;
	let refreshTimer: ReturnType<typeof setTimeout> | null = null;
	const cleanup = () => {
		closed = true;
		if (refreshTimer) {
			clearTimeout(refreshTimer);
			refreshTimer = null;
		}
	};

	const scheduleRefresh = (delayMs: number) => {
		if (closed) return;
		if (refreshTimer) clearTimeout(refreshTimer);
		refreshTimer = setTimeout(() => {
			refreshTimer = null;
			void fetchForecast();
		}, delayMs);
	};

	const fetchForecast = async () => {
		let lastError: unknown = null;
		for (const endpoint of getNovaApiCandidates('/api/ha/ws')) {
			if (closed) return;
			try {
				const response = await fetchWithTimeout(
					endpoint,
					{
						method: 'POST',
						credentials: 'same-origin',
						cache: 'no-store',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({
							payload: {
								type: 'weather/subscribe_forecast',
								entity_id: options.entityId,
								forecast_type: options.forecastType
							},
							timeoutMs: 20000
						})
					},
					22000
				);
				if (!response.ok) throw new Error(`ha_weather_forecast_http_${response.status}`);
				const data = (await response.json()) as { ok?: boolean; result?: unknown; error?: string };
				if (data.ok !== true) throw new Error(data.error || 'ha_weather_forecast_failed');
				const forecast = extractWeatherForecast(data.result);
				if (!forecast) throw new Error('ha_weather_forecast_invalid_response');
				if (!closed) options.onForecast(forecast);
				scheduleRefresh(WEATHER_FORECAST_REFRESH_MS);
				return;
			} catch (error) {
				lastError = error;
			}
		}
		if (!closed) {
			options.onError?.(lastError instanceof Error ? lastError.message : 'ha_weather_forecast_unavailable');
			scheduleRefresh(WEATHER_FORECAST_RETRY_MS);
		}
	};

	void fetchForecast();

	return cleanup;
}
