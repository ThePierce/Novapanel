export type CardTypeId = string;

export type CardPreview =
	| {
			kind: 'clock';
			analogStyle: 1 | 2 | 3 | 4;
			digitalStyle: 1 | 2 | 3 | 4;
	  }
	| { kind: 'date' }
	| { kind: 'divider' }
	| { kind: 'weather' }
	| { kind: 'weather_forecast' }
	| { kind: 'alarm_panel' }
	| { kind: 'lights_status' }
	| { kind: 'openings_status' }
	| { kind: 'devices_status' }
	| { kind: 'availability_status' }
	| { kind: 'media_players_status' }
	| { kind: 'energy' }
	| { kind: 'cameras_strip' }
	| { kind: 'week_calendar' }
	| { kind: 'light_button' }
	| { kind: 'climate_button' }
	| { kind: 'cover_button' }
	| { kind: 'vacuum_button' }
	| { kind: 'media_player_button' };

export type CardDefinition = {
	id: string;
	type: CardTypeId;
	label: string;
	target: 'sidebar' | 'view';
	preview: CardPreview;
};

export const cardCatalog: CardDefinition[] = [
	{
		id: 'clock',
		type: 'clock',
		label: 'Time',
		target: 'sidebar',
		preview: {
			kind: 'clock',
			analogStyle: 1,
			digitalStyle: 1
		}
	},
	{
		id: 'date',
		type: 'date',
		label: 'Date',
		target: 'sidebar',
		preview: { kind: 'date' }
	},
	{
		id: 'divider',
		type: 'divider',
		label: 'Divider line',
		target: 'sidebar',
		preview: { kind: 'divider' }
	},
	{
		id: 'weather',
		type: 'weather',
		label: 'Weather',
		target: 'sidebar',
		preview: { kind: 'weather' }
	},
	{
		id: 'weather_forecast',
		type: 'weather_forecast',
		label: 'Forecast',
		target: 'sidebar',
		preview: { kind: 'weather_forecast' }
	},
	{
		id: 'alarm_panel',
		type: 'alarm_panel',
		label: 'Alarm',
		target: 'sidebar',
		preview: { kind: 'alarm_panel' }
	},
	{
		id: 'lights_status',
		type: 'lights_status',
		label: 'Lampen',
		target: 'sidebar',
		preview: { kind: 'lights_status' }
	},
	{
		id: 'openings_status',
		type: 'openings_status',
		label: 'Ramen/deuren',
		target: 'sidebar',
		preview: { kind: 'openings_status' }
	},
	{
		id: 'devices_status',
		type: 'devices_status',
		label: 'Apparaten',
		target: 'sidebar',
		preview: { kind: 'devices_status' }
	},
	{
		id: 'availability_status',
		type: 'availability_status',
		label: 'Bereikbaarheid',
		target: 'sidebar',
		preview: { kind: 'availability_status' }
	},
	{
		id: 'media_players_status',
		type: 'media_players_status',
		label: 'Media spelers',
		target: 'sidebar',
		preview: { kind: 'media_players_status' }
	},
	{
		id: 'energy',
		type: 'energy',
		label: 'Energieoverzicht',
		target: 'sidebar',
		preview: { kind: 'energy' }
	},
	{
		id: 'cameras_strip',
		type: 'cameras_strip',
		label: "Camera's",
		target: 'view',
		preview: { kind: 'cameras_strip' }
	},
	{
		id: 'week_calendar',
		type: 'week_calendar',
		label: 'Weekkalender',
		target: 'view',
		preview: { kind: 'week_calendar' }
	},
	{
		id: 'light_button',
		type: 'light_button',
		label: 'Lampknop',
		target: 'view',
		preview: { kind: 'light_button' }
	},
	{
		id: 'climate_button',
		type: 'climate_button',
		label: 'Climate',
		target: 'view',
		preview: { kind: 'climate_button' }
	},
	{
		id: 'cover_button',
		type: 'cover_button',
		label: 'Gordijn',
		target: 'view',
		preview: { kind: 'cover_button' }
	},
	{
		id: 'vacuum_button',
		type: 'vacuum_button',
		label: 'Robotstofzuiger',
		target: 'view',
		preview: { kind: 'vacuum_button' }
	},
	{
		id: 'media_player_button',
		type: 'media_player_button',
		label: 'Media player',
		target: 'view',
		preview: { kind: 'media_player_button' }
	}
];

export function getCardLabel(type: string) {
	return cardCatalog.find((entry) => entry.type === type)?.label ?? 'Custom';
}
