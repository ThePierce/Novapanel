import type { LanguageCode } from '$lib/i18n';

export type AddonConfigurationPayload = {
	language?: string;
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
	activeCardLibraryTab: 'sidebar' | 'view';
	customTitles: { cardLibrary?: string; homeviewPreview?: string };
	oauth?: AddonConfigurationPayload['oauth'];
	mediaHub?: AddonConfigurationPayload['mediaHub'];
	isValidLanguage: (value: string) => value is LanguageCode;
};

export type Output = {
	selectedLanguage: LanguageCode;
	activeCardLibraryTab: 'sidebar' | 'view';
	customTitles: { cardLibrary?: string; homeviewPreview?: string };
	oauth?: AddonConfigurationPayload['oauth'];
	mediaHub?: AddonConfigurationPayload['mediaHub'];
};

export function applyAddonConfigurationState(input: Input): Output {
	let selectedLanguage = input.selectedLanguage;
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
	return { selectedLanguage, activeCardLibraryTab, customTitles, oauth, mediaHub };
}
