export type EntityButtonKind = 'device' | 'climate' | 'cover' | 'vacuum' | 'media_player';

export const DEVICE_BUTTON_DOMAINS = [
	'switch',
	'fan',
	'input_boolean',
	'humidifier',
	'remote',
	'siren',
	'water_heater'
] as const;

export function isDeviceButtonEntityDomain(domain: string): boolean {
	return DEVICE_BUTTON_DOMAINS.includes(domain.trim().toLowerCase() as (typeof DEVICE_BUTTON_DOMAINS)[number]);
}
