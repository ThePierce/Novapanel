import { browserSafeHomeAssistantUrl, type HomeAssistantEntity } from '$lib/ha/entities-service-helpers';

export type OnkyoBridge = {
	id: string;
	label: string;
	zoneEntityId: string;
	spotifySource?: string;
};

export type SpUri = { uri: string; name: string; image: string; subtitle: string; kind: string };
export type TuneInItem = {
	text: string;
	url: string;
	image: string;
	subtext: string;
	bitrate?: string;
	formats?: string;
};
export type TuneInFavorite = TuneInItem & { id: string };

export type MaTarget = {
	maEntityId: string;
	baseEntityId: string;
	label: string;
	forceOnZones: string[];
	forceOffZones: string[];
};

export function normalizeDisplayImageUrl(raw: string): string {
	const trimmed = raw.trim();
	return trimmed ? browserSafeHomeAssistantUrl(trimmed) : '';
}

export function readFirstStringAttribute(attrs: Record<string, unknown> | undefined, keys: string[]): string {
	if (!attrs) return '';
	for (const key of keys) {
		const value = attrs[key];
		if (typeof value === 'string' && value.trim()) return value;
	}
	return '';
}

export function readSources(entity: HomeAssistantEntity): string[] {
	const raw = entity.attributes?.source_list;
	if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
	return [];
}

export function readCurrentSource(entity: HomeAssistantEntity): string {
	const source = entity.attributes?.source;
	return typeof source === 'string' ? source : '';
}

export function readVolume(entity: HomeAssistantEntity): number {
	const value = entity.attributes?.volume_level;
	return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

export function readMuted(entity: HomeAssistantEntity): boolean {
	return Boolean(entity.attributes?.is_volume_muted);
}

export function readMediaTitle(entity: HomeAssistantEntity): string {
	const title = entity.attributes?.media_title;
	return typeof title === 'string' ? title : '';
}

export function readMediaArtist(entity: HomeAssistantEntity): string {
	const artist = entity.attributes?.media_artist;
	return typeof artist === 'string' ? artist : '';
}

export function readMediaImage(entity: HomeAssistantEntity): string {
	const direct = readFirstStringAttribute(entity.attributes, [
		'entity_picture_local',
		'entity_picture',
		'media_image_url',
		'media_image_local',
		'media_image',
		'media_album_image',
		'album_art_url',
		'thumbnail',
		'media_thumbnail',
		'image'
	]);
	return direct ? browserSafeHomeAssistantUrl(direct) : '';
}

export function isPlaying(entity: HomeAssistantEntity): boolean {
	return (entity.state ?? '').toLowerCase() === 'playing';
}

export function richestEntityFor(
	entity: HomeAssistantEntity,
	entities: HomeAssistantEntity[],
	allEntities: HomeAssistantEntity[]
): HomeAssistantEntity {
	const all = allEntities.length > 0 ? allEntities : entities;
	const maId = findMaEntityForBase(entity.entityId, all);
	if (!maId) return entity;
	const maEntity = all.find((entry) => entry.entityId === maId);
	if (!maEntity) return entity;
	if (/^media_player\.(onkyo|tx[_-]?nr|integra)/i.test(maId)) return entity;
	const baseHasInfo = readMediaTitle(entity) || readMediaImage(entity);
	const maHasInfo = readMediaTitle(maEntity) || readMediaImage(maEntity);
	if (maHasInfo && !baseHasInfo) return maEntity;
	if (maHasInfo && isPlaying(maEntity)) return maEntity;
	return entity;
}

export function readAppLogo(entity: HomeAssistantEntity): string {
	const attrs = entity.attributes ?? {};
	const appName = typeof attrs.app_name === 'string' ? attrs.app_name.trim() : '';
	const appId = typeof attrs.app_id === 'string' ? attrs.app_id.toLowerCase() : '';
	if (!appName && !appId) return '';

	const idMap: Record<string, string> = {
		'com.netflix.netflix': 'netflix',
		'com.google.ios.youtube': 'youtube',
		'com.google.ios.youtubemusic': 'youtubemusic',
		'com.spotify.client': 'spotify',
		'com.apple.tv': 'appletv',
		'com.apple.tvairplay': 'airplay',
		'com.apple.tvmusic': 'applemusic',
		'com.apple.tvphotos': 'apple',
		'com.disney.disneyplus': 'disneyplus',
		'nl.npo.npo': 'nporadio1',
		'com.amazon.aiv.atvprime': 'primevideo',
		'com.hulu.plus': 'hulu',
		'tv.twitch': 'twitch',
		'com.plexapp.plex': 'plex',
		'com.videolan.vlc-ios': 'vlcmediaplayer'
	};
	const nameMap: Record<string, string> = {
		netflix: 'netflix',
		youtube: 'youtube',
		'youtube music': 'youtubemusic',
		spotify: 'spotify',
		tv: 'appletv',
		'apple tv': 'appletv',
		'tv app': 'appletv',
		music: 'applemusic',
		'apple music': 'applemusic',
		photos: 'apple',
		airplay: 'airplay',
		'disney+': 'disneyplus',
		'disney plus': 'disneyplus',
		'prime video': 'primevideo',
		hulu: 'hulu',
		twitch: 'twitch',
		plex: 'plex',
		vlc: 'vlcmediaplayer'
	};
	const slug = idMap[appId] || nameMap[appName.toLowerCase()] || '';
	return slug ? `https://cdn.simpleicons.org/${slug}` : '';
}

export function readNowPlayingSummary(entity: HomeAssistantEntity): { primary: string; secondary: string } {
	const attrs = entity.attributes ?? {};
	const contentType =
		typeof attrs.media_content_type === 'string' ? attrs.media_content_type.toLowerCase() : '';
	const mediaTitle = typeof attrs.media_title === 'string' ? attrs.media_title : '';
	const seriesTitle = typeof attrs.media_series_title === 'string' ? attrs.media_series_title : '';
	const album = typeof attrs.media_album_name === 'string' ? attrs.media_album_name : '';
	const artist = typeof attrs.media_artist === 'string' ? attrs.media_artist : '';
	const channel = typeof attrs.media_channel === 'string' ? attrs.media_channel : '';
	const app = typeof attrs.app_name === 'string' ? attrs.app_name : '';
	const season = attrs.media_season;
	const episode = attrs.media_episode;

	if (contentType === 'tvshow' || seriesTitle) {
		const epPart =
			season && episode
				? `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
				: episode
					? `Aflevering ${episode}`
					: '';
		const primary = seriesTitle || mediaTitle || 'Serie';
		const secondary =
			mediaTitle && mediaTitle !== seriesTitle ? (epPart ? `${epPart} · ${mediaTitle}` : mediaTitle) : epPart;
		return { primary, secondary };
	}
	if (contentType === 'movie') return { primary: mediaTitle || 'Film', secondary: app || '' };
	if (mediaTitle && (artist || album)) return { primary: mediaTitle, secondary: artist || album };
	if (channel) return { primary: channel, secondary: mediaTitle || '' };
	if (mediaTitle) return { primary: mediaTitle, secondary: app || '' };
	if (app) return { primary: app, secondary: '' };
	return { primary: '', secondary: '' };
}

export function isOn(entity: HomeAssistantEntity): boolean {
	const state = (entity.state ?? '').toLowerCase();
	return state !== 'off' && state !== 'unavailable' && state !== 'unknown' && state !== '';
}

export function isGoogleCastPlayer(entity: HomeAssistantEntity): boolean {
	const id = entity.entityId.toLowerCase();
	const name = (entity.friendlyName ?? '').toLowerCase();
	const appName = String(entity.attributes?.app_name ?? '').toLowerCase();
	const manufacturer = String(entity.attributes?.manufacturer ?? '').toLowerCase();
	const haystack = `${id} ${name} ${appName} ${manufacturer}`;
	return /google|nest|home hub|chromecast|\bcast\b|youtube/.test(haystack);
}

export function deviceFingerprint(name: string): string {
	return name
		.toLowerCase()
		.replace(/[\s\-_]+/g, '')
		.replace(/[^a-z0-9]/g, '');
}

export function entityIdTokens(entityId: string): string[] {
	const idPart = entityId.replace(/^[^.]+\./, '');
	const cleaned = idPart.replace(/_zone_?\d+$/i, '').replace(/_2$/, '');
	return cleaned
		.split(/[_\-]+/)
		.map((token) => token.toLowerCase())
		.filter((token) => token.length >= 2);
}

export function findMaEntityForBase(baseEntityId: string, all: HomeAssistantEntity[]): string | null {
	const direct = all.find((entity) => entity.entityId === `${baseEntityId}_2`);
	if (direct) return direct.entityId;
	const baseFp = deviceFingerprint(baseEntityId);
	for (const entity of all) {
		if (entity.entityId === baseEntityId) continue;
		const fp = deviceFingerprint(entity.entityId);
		if (fp === baseFp + '2' || fp === baseFp + 'ma') return entity.entityId;
	}
	const baseTokens = entityIdTokens(baseEntityId);
	if (baseTokens.length === 0) return null;
	for (const entity of all) {
		if (!entity.entityId.endsWith('_2')) continue;
		if (entity.entityId === baseEntityId) continue;
		if (/_zone_?\d+$/i.test(entity.entityId)) continue;
		const candidateTokens = entityIdTokens(entity.entityId);
		const allMatch = baseTokens.every((token) => candidateTokens.includes(token));
		const hasExtra = candidateTokens.some((token) => !baseTokens.includes(token));
		if (allMatch && hasExtra) return entity.entityId;
	}
	return null;
}

export function spotifyUriToMaMediaType(uri: string): string {
	const match = uri.match(/^spotify:(track|playlist|album|artist):/);
	return match?.[1] ?? 'track';
}

function spotifyArtists(value: unknown): string {
	return Array.isArray(value)
		? value
				.map((artist) => stringProp(asRecord(artist), 'name'))
				.filter(Boolean)
				.join(', ')
		: '';
}

function asRecord(value: unknown): Record<string, unknown> {
	return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function stringProp(record: Record<string, unknown>, key: string): string {
	const value = record[key];
	return typeof value === 'string' ? value : '';
}

function firstImageUrl(value: unknown): string {
	if (!Array.isArray(value)) return '';
	const first = asRecord(value[0]);
	return stringProp(first, 'url');
}

export function mapSpotifyTrack(value: unknown): SpUri {
	const item = asRecord(value);
	const album = asRecord(item.album);
	const image = firstImageUrl(album.images);
	return {
		uri: stringProp(item, 'uri'),
		name: stringProp(item, 'name'),
		image,
		subtitle: spotifyArtists(item.artists),
		kind: 'track'
	};
}

export function mapSpotifyAlbum(value: unknown): SpUri {
	const item = asRecord(value);
	const image = firstImageUrl(item.images);
	return {
		uri: stringProp(item, 'uri'),
		name: stringProp(item, 'name'),
		image,
		subtitle: spotifyArtists(item.artists),
		kind: 'album'
	};
}

export function mapSpotifyPlaylist(value: unknown): SpUri {
	const item = asRecord(value);
	const owner = asRecord(item.owner);
	const image = firstImageUrl(item.images);
	return {
		uri: stringProp(item, 'uri'),
		name: stringProp(item, 'name'),
		image,
		subtitle: stringProp(owner, 'display_name'),
		kind: 'playlist'
	};
}

export function mapSpotifyArtist(value: unknown): SpUri {
	const item = asRecord(value);
	const image = firstImageUrl(item.images);
	return {
		uri: stringProp(item, 'uri'),
		name: stringProp(item, 'name'),
		image,
		subtitle: 'Artiest',
		kind: 'artist'
	};
}

export function formatMs(ms: number): string {
	if (!Number.isFinite(ms) || ms <= 0) return '0:00';
	const total = Math.floor(ms / 1000);
	const minutes = Math.floor(total / 60);
	const seconds = total % 60;
	return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
