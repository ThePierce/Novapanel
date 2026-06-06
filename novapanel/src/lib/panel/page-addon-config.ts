import type { LanguageCode } from '$lib/i18n';
import { isPanelTheme, type PanelTheme } from '$lib/panel/theme';
import { coerceCurrencyCode, DEFAULT_CURRENCY_CODE } from '$lib/currency';

export type AddonConfigurationPayload = {
	language?: string;
	theme?: string;
	currencyCode?: unknown;
	cardLibraryTab?: 'sidebar' | 'view';
	titles?: { cardLibrary?: string; homeviewPreview?: string };
	oauth?: {
		spotifyClientId?: string;
		spotifyClientSecret?: string;
		spotifyRedirectUri?: string;
		tuneInUserId?: string;
	};
	mediaHub?: {
		onkyoBridges?: Array<{ id: string; label: string; zoneEntityId: string; spotifySource?: string }>;
		playerOrder?: string[];
		playerAliases?: Record<string, string>;
	};
};

type Input = {
	addonConfiguration: AddonConfigurationPayload;
	selectedLanguage: LanguageCode;
	selectedTheme: PanelTheme;
	selectedCurrencyCode?: string;
	activeCardLibraryTab: 'sidebar' | 'view';
	customTitles: { cardLibrary?: string; homeviewPreview?: string };
	oauth?: AddonConfigurationPayload['oauth'];
	mediaHub?: AddonConfigurationPayload['mediaHub'];
	isValidLanguage: (value: string) => value is LanguageCode;
};

export type Output = {
	selectedLanguage: LanguageCode;
	selectedTheme: PanelTheme;
	selectedCurrencyCode: string;
	activeCardLibraryTab: 'sidebar' | 'view';
	customTitles: { cardLibrary?: string; homeviewPreview?: string };
	oauth?: AddonConfigurationPayload['oauth'];
	mediaHub?: AddonConfigurationPayload['mediaHub'];
};

export function applyAddonConfigurationState(input: Input): Output {
	let selectedLanguage = input.selectedLanguage;
	let selectedTheme = input.selectedTheme;
	let selectedCurrencyCode = coerceCurrencyCode(input.selectedCurrencyCode, DEFAULT_CURRENCY_CODE);
	let activeCardLibraryTab = input.activeCardLibraryTab;
	let customTitles = input.customTitles;
	let oauth = input.oauth;
	let mediaHub = input.mediaHub;
	if (
		typeof input.addonConfiguration.language === 'string' &&
		input.isValidLanguage(input.addonConfiguration.language)
	) {
		selectedLanguage = input.addonConfiguration.language;
	}
	if (isPanelTheme(input.addonConfiguration.theme)) {
		selectedTheme = input.addonConfiguration.theme;
	}
	selectedCurrencyCode = coerceCurrencyCode(input.addonConfiguration.currencyCode, selectedCurrencyCode);
	if (
		input.addonConfiguration.cardLibraryTab === 'sidebar' ||
		input.addonConfiguration.cardLibraryTab === 'view'
	) {
		activeCardLibraryTab = input.addonConfiguration.cardLibraryTab;
	}
	if (input.addonConfiguration.titles && typeof input.addonConfiguration.titles === 'object') {
		customTitles = input.addonConfiguration.titles;
	}
	if (input.addonConfiguration.oauth && typeof input.addonConfiguration.oauth === 'object') {
		oauth = input.addonConfiguration.oauth;
	}
	if (input.addonConfiguration.mediaHub && typeof input.addonConfiguration.mediaHub === 'object') {
		mediaHub = input.addonConfiguration.mediaHub;
	}
	return {
		selectedLanguage,
		selectedTheme,
		selectedCurrencyCode,
		activeCardLibraryTab,
		customTitles,
		oauth,
		mediaHub
	};
}
