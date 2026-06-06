import type { CardDraft } from '$lib/persistence/panel-state';

export type CardTypeStyling = {
	icon: string;
	accent: string;
	accentSoft: string;
};

const CARD_TYPE_STYLING: Record<string, CardTypeStyling> = {
	clock: { icon: 'clock-hour-3', accent: '#93c5fd', accentSoft: 'rgba(147,197,253,0.18)' },
	date: { icon: 'calendar', accent: '#f87171', accentSoft: 'rgba(248,113,113,0.18)' },
	weather: { icon: 'cloud', accent: '#22d3ee', accentSoft: 'rgba(34,211,238,0.18)' },
	weather_forecast: { icon: 'cloud-storm', accent: '#22d3ee', accentSoft: 'rgba(34,211,238,0.18)' },
	alarm_panel: { icon: 'shield-lock', accent: '#f87171', accentSoft: 'rgba(248,113,113,0.18)' },
	lights_status: { icon: 'bulb', accent: '#ffd338', accentSoft: 'rgba(255,211,56,0.18)' },
	light_button: { icon: 'bulb', accent: '#ffd338', accentSoft: 'rgba(255,211,56,0.18)' },
	device_button: { icon: 'plug', accent: '#34d399', accentSoft: 'rgba(52,211,153,0.18)' },
	climate_button: { icon: 'temperature', accent: '#fb923c', accentSoft: 'rgba(251,146,60,0.18)' },
	cover_button: { icon: 'blinds', accent: '#60a5fa', accentSoft: 'rgba(96,165,250,0.18)' },
	vacuum_button: { icon: 'robot', accent: '#34d399', accentSoft: 'rgba(52,211,153,0.18)' },
	media_player_button: { icon: 'device-speaker', accent: '#c084fc', accentSoft: 'rgba(192,132,252,0.18)' },
	openings_status: { icon: 'door', accent: '#60a5fa', accentSoft: 'rgba(96,165,250,0.18)' },
	devices_status: { icon: 'plug', accent: '#a78bfa', accentSoft: 'rgba(167,139,250,0.18)' },
	availability_status: { icon: 'wifi', accent: '#4ade80', accentSoft: 'rgba(74,222,128,0.18)' },
	media_players_status: { icon: 'device-speaker', accent: '#c084fc', accentSoft: 'rgba(192,132,252,0.18)' },
	energy: { icon: 'bolt', accent: '#facc15', accentSoft: 'rgba(250,204,21,0.18)' },
	cameras_strip: { icon: 'device-cctv', accent: '#60a5fa', accentSoft: 'rgba(96,165,250,0.18)' },
	week_calendar: { icon: 'calendar-week', accent: '#38bdf8', accentSoft: 'rgba(56,189,248,0.18)' },
	divider: { icon: 'separator-horizontal', accent: '#93c5fd', accentSoft: 'rgba(147,197,253,0.18)' },
	home: { icon: 'home', accent: '#93c5fd', accentSoft: 'rgba(147,197,253,0.18)' },
	scene: { icon: 'sparkles', accent: '#93c5fd', accentSoft: 'rgba(147,197,253,0.18)' }
};

const DEFAULT_CARD_TYPE_STYLING: CardTypeStyling = {
	icon: 'square',
	accent: '#93c5fd',
	accentSoft: 'rgba(147,197,253,0.18)'
};

export function getCardTypeStyling(type: string): CardTypeStyling {
	return CARD_TYPE_STYLING[type] ?? DEFAULT_CARD_TYPE_STYLING;
}

export function getCardTypeIcon(type: string): string {
	return getCardTypeStyling(type).icon;
}

export function getCardDraftTitle(
	card: CardDraft,
	index: number,
	getLocalizedCardLabel: (type: string) => string
): string {
	const title = card.title?.trim();
	return title || `${getLocalizedCardLabel(card.cardType)} ${index + 1}`;
}
