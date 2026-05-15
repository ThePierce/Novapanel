import {
	getHaConnectionConfig,
	getNovaWebSocketCandidates,
	getSocketCandidates
} from './entities-service-helpers';

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
	const config = await getHaConnectionConfig();
	if (!config) {
		options.onError?.('ha_connection_config_unavailable');
		return () => {};
	}
	const candidates = [
		...getNovaWebSocketCandidates('/api/ha/websocket'),
		...getSocketCandidates(config.hassUrl)
	].filter((url, index, all) => url && all.indexOf(url) === index);
	if (candidates.length === 0) {
		options.onError?.('ha_ws_candidates_unavailable');
		return () => {};
	}

	let closed = false;
	let socket: WebSocket | null = null;
	let candidateIndex = -1;
	let receivedForecast = false;
	const subscribeId = 41;

	const cleanup = () => {
		closed = true;
		const current = socket;
		socket = null;
		try {
			current?.close();
		} catch {}
	};

	const openCandidate = (index: number): boolean => {
		if (closed) return false;
		candidateIndex = index;
		const socketUrl = candidates[index];
		if (!socketUrl) {
			options.onError?.('ha_ws_connection_failed');
			return false;
		}
		try {
			const ws = new WebSocket(socketUrl);
			socket = ws;
			ws.onmessage = (event) => {
				if (closed || socket !== ws) return;
				try {
					const payload = JSON.parse(String(event.data)) as Record<string, unknown>;
					const type = typeof payload.type === 'string' ? payload.type : '';
					if (type === 'auth_required') {
						ws.send(JSON.stringify({ type: 'auth', access_token: config.token }));
						return;
					}
					if (type === 'auth_ok') {
						ws.send(
							JSON.stringify({
								id: subscribeId,
								type: 'weather/subscribe_forecast',
								entity_id: options.entityId,
								forecast_type: options.forecastType
							})
						);
						return;
					}
					if (type === 'auth_invalid') {
						options.onError?.('ha_ws_auth_invalid');
						cleanup();
						return;
					}
					if (type === 'result' && payload.id === subscribeId && payload.success === false) {
						options.onError?.('ha_weather_forecast_subscribe_failed');
						cleanup();
						return;
					}
					const forecast = extractWeatherForecast(payload);
					if (!forecast) return;
					receivedForecast = true;
					options.onForecast(forecast);
				} catch {
					options.onError?.('ha_weather_forecast_parse_failed');
				}
			};
			ws.onerror = () => {
				options.onError?.('ha_ws_connection_error');
			};
			ws.onclose = () => {
				if (closed || socket !== ws) return;
				socket = null;
				if (!receivedForecast && openCandidate(candidateIndex + 1)) return;
				if (!receivedForecast) options.onError?.('ha_weather_forecast_unavailable');
			};
			return true;
		} catch {
			return openCandidate(index + 1);
		}
	};

	openCandidate(0);
	return cleanup;
}
