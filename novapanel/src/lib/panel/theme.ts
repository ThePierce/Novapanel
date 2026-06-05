export const PANEL_THEMES = ['midnight', 'graphite', 'daylight', 'forest'] as const;

export type PanelTheme = (typeof PANEL_THEMES)[number];

export const DEFAULT_PANEL_THEME: PanelTheme = 'midnight';

export function isPanelTheme(value: unknown): value is PanelTheme {
	return typeof value === 'string' && (PANEL_THEMES as readonly string[]).includes(value);
}
