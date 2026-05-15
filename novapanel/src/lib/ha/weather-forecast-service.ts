import { getNovaApiCandidates } from './entities-service-helpers';

export type WeatherForecastType = 'daily' | 'hourly' | 'twice_daily';

type SubscribeWeatherForecastOptions = {
	entityId: string;
	forecastType: WeatherForecastType;
	onForecast: (forecast: Array<Record<string, unknown>>) => void;
	onError?: (message: string) => void;
};

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
	const cleanup = () => {
		closed = true;
	};

	void (async () => {
		let lastError: unknown = null;
		for (const endpoint of getNovaApiCandidates('/api/ha/ws')) {
			if (closed) return;
			try {
				const response = await fetch(endpoint, {
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
				});
				if (!response.ok) throw new Error(`ha_weather_forecast_http_${response.status}`);
				const data = (await response.json()) as { ok?: boolean; result?: unknown; error?: string };
				if (data.ok !== true) throw new Error(data.error || 'ha_weather_forecast_failed');
				const forecast = extractWeatherForecast(data.result);
				if (!forecast) throw new Error('ha_weather_forecast_invalid_response');
				if (!closed) options.onForecast(forecast);
				return;
			} catch (error) {
				lastError = error;
			}
		}
		if (!closed) {
			options.onError?.(lastError instanceof Error ? lastError.message : 'ha_weather_forecast_unavailable');
		}
	})();

	return cleanup;
}
