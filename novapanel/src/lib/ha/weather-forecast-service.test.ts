import { describe, expect, it } from 'vitest';
import { extractWeatherForecast } from './weather-forecast-service';

describe('extractWeatherForecast', () => {
	it('extracts a direct forecast array', () => {
		const forecast = [{ datetime: '2026-06-05T12:00:00Z', condition: 'sunny' }];

		expect(extractWeatherForecast({ forecast })).toBe(forecast);
	});

	it('extracts forecast events from Home Assistant subscription payloads', () => {
		const forecast = [{ datetime: '2026-06-05T13:00:00Z', condition: 'cloudy' }];

		expect(extractWeatherForecast({ event: { data: { forecast } } })).toBe(forecast);
	});

	it('extracts forecast response maps from websocket command results', () => {
		const forecast = [{ datetime: '2026-06-05T14:00:00Z', condition: 'rainy' }];

		expect(
			extractWeatherForecast({
				result: {
					response: {
						'weather.home': { forecast }
					}
				}
			})
		).toBe(forecast);
	});

	it('returns null for unrecognized payloads', () => {
		expect(extractWeatherForecast({ ok: true })).toBeNull();
		expect(extractWeatherForecast(null)).toBeNull();
	});
});
