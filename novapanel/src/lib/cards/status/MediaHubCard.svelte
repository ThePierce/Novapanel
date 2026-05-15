<script lang="ts">
	import type { TranslationKey } from '$lib/i18n';
	import { browserSafeHomeAssistantUrl, type HomeAssistantEntity } from '$lib/ha/entities-service-helpers';
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
	import { readStoredValue, writeStoredValue } from '$lib/persistence/storage';

	type OnkyoBridge = {
		id: string;
		label: string;
		/** HA media_player entity die als zone aangezet moet worden vóór afspelen. */
		zoneEntityId: string;
		/** Spotify Connect source-naam op de Spotify-controller. */
		spotifySource?: string;
	};

	type Props = {
		t: (key: TranslationKey | string) => string;
		entities: HomeAssistantEntity[];
		/** Volledige media_player lijst uit HA, ongefilterd door card-config. Nodig voor Spotify-controller. */
		allEntities?: HomeAssistantEntity[];
		callService: (domain: string, service: string, entityId: string, data?: Record<string, unknown>) => Promise<void>;
		labelFor?: (entityId: string, friendlyName: string) => string;
		actionBusyEntityId?: string;
		spotifyConfigured?: boolean;
		/** Server-state: onkyo bridges. */
		onkyoBridges?: OnkyoBridge[];
		/** Server-state: aangepaste volgorde van entity IDs. */
		playerOrder?: string[];
		/** Server-state: hernoemingen van entities. */
		playerAliases?: Record<string, string>;
		/** Sync naar server-state. */
		onBridgesChange?: (value: OnkyoBridge[]) => void;
		onPlayerOrderChange?: (value: string[]) => void;
	};

	let {
		t: _t,
		entities,
		allEntities = [],
		callService,
		labelFor = (_id, name) => name,
		actionBusyEntityId = '',
		spotifyConfigured = false,
		onkyoBridges = [],
		playerOrder = [],
		playerAliases = {},
		onBridgesChange,
		onPlayerOrderChange
	}: Props = $props();

	// ----- Persistente state ------------------------------------------------
	// Lokale state (deze hoeven NIET server-side):
	// - actief speeltarget (kan per device verschillen, niet relevant voor sync)
	// - tijdelijke UI-state (rename drafts, manager open, etc.)
	const ACTIVE_PLAYER_KEY = 'np_media_hub_active_player';
	const SPOTIFY_SOURCE_TARGET_KEY = 'np_media_hub_spotify_target_source';
	const SPOTIFY_DEVICE_KEY = 'np_media_hub_spotify_device_id';
	const SPOTIFY_PLAYBACK_TARGET_KEY = 'np_media_hub_spotify_playback_target';
	const TUNEIN_PLAYBACK_TARGET_KEY = 'np_media_hub_tunein_playback_target';

	function getPlayerName(id: string, fallback: string): string {
		return playerAliases[id] || labelFor(id, fallback);
	}

	function setOnkyoBridges(value: OnkyoBridge[]) {
		onBridgesChange?.(value);
	}

	function setPlayerOrder(value: string[]) {
		onPlayerOrderChange?.(value);
	}

	/** Naam voor de Now Playing-balk: gebruikt bridge-label als die actief is, anders gewone naam. */
	function getNowPlayingDeviceLabel(entityId: string, friendly: string): string {
		if (spotifyPlaybackTarget.startsWith('bridge:')) {
			const bridge = getBridgeById(spotifyPlaybackTarget.slice('bridge:'.length));
			if (bridge && bridge.zoneEntityId === entityId) return bridge.label;
		}
		return getPlayerName(entityId, friendly);
	}

	// ----- State ------------------------------------------------------------
	let activePlayerId = $state(readStoredValue(ACTIVE_PLAYER_KEY) ?? '');
	let bridgeManagerOpen = $state(false);
	let bridgeRenamingId = $state('');
	let bridgeRenameDraft = $state('');
	let bridgeAddCandidate = $state('');
	let spotifySourceTarget = $state(readStoredValue(SPOTIFY_SOURCE_TARGET_KEY) ?? '');
	let spotifyDeviceId = $state(readStoredValue(SPOTIFY_DEVICE_KEY) ?? '');

	// Verenigd afspeel-doel voor Spotify content. Format: "spotify:<deviceId>" of "ha:<entityId>".
	let spotifyPlaybackTarget = $state(readStoredValue(SPOTIFY_PLAYBACK_TARGET_KEY) ?? '');
	function setSpotifyPlaybackTarget(value: string) {
		spotifyPlaybackTarget = value;
		writeStoredValue(SPOTIFY_PLAYBACK_TARGET_KEY, value);
		// Sync naar oude state zodat bestaande functies blijven werken
		if (value.startsWith('spotify:')) {
			spotifyDeviceId = value.slice('spotify:'.length);
			writeStoredValue(SPOTIFY_DEVICE_KEY, spotifyDeviceId);
		}
		// Sync de actieve speler in Now Playing-balk zodat die dezelfde keuze toont
		if (value.startsWith('bridge:')) {
			const bridge = onkyoBridges.find((b) => b.id === value.slice('bridge:'.length));
			if (bridge) setActivePlayer(bridge.zoneEntityId);
		} else if (value.startsWith('ma:')) {
			const payload = value.slice('ma:'.length);
			const [baseEntityId] = payload.split('|');
			if (baseEntityId) setActivePlayer(baseEntityId);
		}
	}

	// Drag-and-drop herordening van spelers
	let dragSourceEntityId = $state('');
	let dragOverEntityId = $state('');

	// Active section
	let activeSection = $state<'spotify' | 'tunein' | 'players'>('players');

	// Spotify Web API state
	type SpUri = { uri: string; name: string; image: string; subtitle: string; kind: string };
	let spotifyAuthChecked = $state(false);
	let spotifyConnected = $state(false);
	let spotifySearchQuery = $state('');
	let spotifySearchResults = $state<SpUri[]>([]);
	let spotifySearchBusy = $state(false);
	let spotifyPlaylists = $state<SpUri[]>([]);
	let spotifyPlaylistsLoaded = $state(false);
	let spotifyPlayerState = $state<{
		track?: { name: string; artists: string; image: string; uri: string; durationMs: number };
		progressMs?: number;
		isPlaying?: boolean;
		shuffle?: boolean;
		repeat?: 'off' | 'context' | 'track';
		volumePercent?: number;
		device?: { id: string; name: string; type: string; isActive: boolean };
	}>({});
	let spotifyDevices = $state<Array<{ id: string; name: string; type: string; isActive: boolean }>>([]);
	let spotifyQueue = $state<SpUri[]>([]);
	let spotifyQueueOpen = $state(false);
	let spotifyError = $state('');

	// TuneIn state
	type TuneInItem = { text: string; url: string; image: string; subtext: string; bitrate?: string; formats?: string };
	type TuneInFavorite = TuneInItem & { id: string };

	const TUNEIN_FAVS_KEY = 'np_tunein_favorites_v1';

	function loadTuneInFavs(): TuneInFavorite[] {
		try {
			const r = readStoredValue(TUNEIN_FAVS_KEY);
			if (!r) return [];
			const parsed = JSON.parse(r);
			return Array.isArray(parsed) ? parsed.filter((f: any) => f && f.id && f.text && f.url) : [];
		} catch {
			return [];
		}
	}
	function saveTuneInFavs(list: TuneInFavorite[]) {
		try { writeStoredValue(TUNEIN_FAVS_KEY, JSON.stringify(list)); } catch {}
	}

	let tuneInFavorites = $state<TuneInFavorite[]>(loadTuneInFavs());
	let tuneInSearchQuery = $state('');
	let tuneInSearchResults = $state<TuneInItem[]>([]);
	let tuneInSearchBusy = $state(false);
	let tuneInError = $state('');
	let tuneInShowSearch = $state(false);
	let tuneInPlaybackTarget = $state(readStoredValue(TUNEIN_PLAYBACK_TARGET_KEY) ?? '');

	// Per baseEntityId onthouden welk radio-station-logo er voor het laatst gestart is.
	// MA stelt voor radio-streams vaak geen entity_picture in, dus we gebruiken het logo
	// uit de favoriet als fallback in de Now Playing-balk.
	let radioImageByBase = $state<Record<string, { image: string; name: string }>>({});
	let invalidDisplayImages = $state<Record<string, true>>({});

	function setTuneInPlaybackTarget(value: string) {
		tuneInPlaybackTarget = value;
		writeStoredValue(TUNEIN_PLAYBACK_TARGET_KEY, value);
		// Sync de actieve speler (Now Playing-balk) zodat die de gekozen zone toont
		if (value.startsWith('ma:')) {
			// Format: "ma:<baseEntityId>|<maEntityId>" — base is uniek per zone (Onkyo zone-2 etc.),
			// ma is dezelfde voor zone-1 en zone-2 van de Onkyo, dus we lezen base.
			const payload = value.slice('ma:'.length);
			const [baseEntityId] = payload.split('|');
			if (baseEntityId) setActivePlayer(baseEntityId);
		}
	}

	// Custom radio toevoegen (eigen URL)
	let customRadioOpen = $state(false);
	let customRadioName = $state('');
	let customRadioUrl = $state('');

	// Source picker
	let sourcePickerOpen = $state(false);

	// Volume slider feedback
	let volumeDraft = $state<number | null>(null);
	let volumeTimer: ReturnType<typeof setTimeout> | null = null;

	// ----- Helpers ----------------------------------------------------------
	function ingressPath(p: string) {
		const ingress =
			typeof window !== 'undefined'
				? (((window as unknown as { __novapanel_ingress?: string }).__novapanel_ingress || '') as string)
				: '';
		return ingress ? `${ingress}${p}` : p;
	}

	function normalizeDisplayImageUrl(raw: string): string {
		const trimmed = raw.trim();
		return trimmed ? browserSafeHomeAssistantUrl(trimmed) : '';
	}

	function isHomeAssistantGeneratedImage(url: string): boolean {
		return /\/?api\/image\/serve\/[^/?#]+\/\d+x\d+/i.test(url);
	}

	function markDisplayImageFailed(raw: string) {
		const url = normalizeDisplayImageUrl(raw);
		if (!url || invalidDisplayImages[url]) return;
		invalidDisplayImages = { ...invalidDisplayImages, [url]: true };
	}

	function displayImageUrl(raw: string): string {
		const url = normalizeDisplayImageUrl(raw);
		if (!url || invalidDisplayImages[url]) return '';
		if (isHomeAssistantGeneratedImage(url)) return '';
		return url;
	}

	function readSources(entity: HomeAssistantEntity): string[] {
		const raw = (entity as unknown as { attributes?: Record<string, unknown> }).attributes?.source_list;
		if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
		return [];
	}
	function readCurrentSource(entity: HomeAssistantEntity): string {
		const a = (entity as unknown as { attributes?: Record<string, unknown> }).attributes;
		return typeof a?.source === 'string' ? (a.source as string) : '';
	}
	function readVolume(entity: HomeAssistantEntity): number {
		const a = (entity as unknown as { attributes?: Record<string, unknown> }).attributes;
		const v = a?.volume_level;
		return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
	}
	function readMuted(entity: HomeAssistantEntity): boolean {
		const a = (entity as unknown as { attributes?: Record<string, unknown> }).attributes;
		return Boolean(a?.is_volume_muted);
	}
	function readMediaTitle(entity: HomeAssistantEntity): string {
		const a = (entity as unknown as { attributes?: Record<string, unknown> }).attributes;
		return typeof a?.media_title === 'string' ? (a.media_title as string) : '';
	}
	function readMediaArtist(entity: HomeAssistantEntity): string {
		const a = (entity as unknown as { attributes?: Record<string, unknown> }).attributes;
		return typeof a?.media_artist === 'string' ? (a.media_artist as string) : '';
	}
	function readMediaImage(entity: HomeAssistantEntity): string {
		const a = (entity as unknown as { attributes?: Record<string, unknown> }).attributes;
		const direct = (a?.entity_picture_local as string | undefined) ?? (a?.entity_picture as string | undefined);
		return typeof direct === 'string' ? browserSafeHomeAssistantUrl(direct) : '';
	}

	/**
	 * Vindt voor een speler de "rijkste" entity om media-info uit te lezen. Als er een
	 * MA-counterpart is (bv. gh_hub_kantoor_2 naast gh_hub_kantoor) en die heeft een titel/
	 * cover, gebruiken we die — MA's Cast-stream zet metadata vaak op de MA-entity, niet op
	 * de baseline HA-entity. Voor Onkyo werken we niet via Cast, dus daar val terug op de
	 * baseline.
	 */
	function richestEntityFor(entity: HomeAssistantEntity): HomeAssistantEntity {
		const all = allEntities.length > 0 ? allEntities : entities;
		const maId = findMaEntityForBase(entity.entityId);
		if (!maId) return entity;
		const maEntity = all.find((e) => e.entityId === maId);
		if (!maEntity) return entity;
		// Onkyo MA-entity slaan we over: artwork van Spotify Connect zit op de Onkyo HA-entity zelf
		if (/^media_player\.(onkyo|tx[_-]?nr|integra)/i.test(maId)) return entity;
		// Kies de entity met daadwerkelijke media-info (titel of cover)
		const baseHasInfo = readMediaTitle(entity) || readMediaImage(entity);
		const maHasInfo = readMediaTitle(maEntity) || readMediaImage(maEntity);
		if (maHasInfo && !baseHasInfo) return maEntity;
		// Als beide info hebben, MA wint (verser bij Cast-streams)
		if (maHasInfo && isPlaying(maEntity)) return maEntity;
		return entity;
	}

	/**
	 * Geeft een logo-URL terug voor een app op basis van Apple TV / Cast attributes.
	 * Gebruikt simpleicons.org (vrij beschikbaar, geen auth). Bekende slug-mapping voor
	 * apps zonder direct herkenbare app_name. Geeft '' terug als er geen match is.
	 */
	function readAppLogo(entity: HomeAssistantEntity): string {
		const a = (entity as unknown as { attributes?: Record<string, unknown> }).attributes ?? {};
		const appName = typeof a.app_name === 'string' ? (a.app_name as string).trim() : '';
		const appId = typeof a.app_id === 'string' ? (a.app_id as string).toLowerCase() : '';
		if (!appName && !appId) return '';

		// Mapping voor bekende apps. Sleutels zijn op kleine letters; waarden zijn
		// simpleicons.org slugs. Niet uitputtend; bij geen match valt readNowPlayingSummary
		// terug op tekst.
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
			'netflix': 'netflix',
			'youtube': 'youtube',
			'youtube music': 'youtubemusic',
			'spotify': 'spotify',
			'tv': 'appletv',
			'apple tv': 'appletv',
			'tv app': 'appletv',
			'music': 'applemusic',
			'apple music': 'applemusic',
			'photos': 'apple',
			'airplay': 'airplay',
			'disney+': 'disneyplus',
			'disney plus': 'disneyplus',
			'prime video': 'primevideo',
			'hulu': 'hulu',
			'twitch': 'twitch',
			'plex': 'plex',
			'vlc': 'vlcmediaplayer'
		};
		const slug = idMap[appId] || nameMap[appName.toLowerCase()] || '';
		if (!slug) return '';
		return `https://cdn.simpleicons.org/${slug}`;
	}
	/**
	 * Bouwt een korte "wat speelt er nu" string voor een speler. Werkt zowel voor
	 * muziek (titel + artiest) als films/series (titel + afleveringinfo of seizoen).
	 */
	function readNowPlayingSummary(entity: HomeAssistantEntity): { primary: string; secondary: string } {
		const a = (entity as unknown as { attributes?: Record<string, unknown> }).attributes ?? {};
		const contentType = typeof a.media_content_type === 'string' ? (a.media_content_type as string).toLowerCase() : '';
		const mediaTitle = typeof a.media_title === 'string' ? (a.media_title as string) : '';
		const seriesTitle = typeof a.media_series_title === 'string' ? (a.media_series_title as string) : '';
		const album = typeof a.media_album_name === 'string' ? (a.media_album_name as string) : '';
		const artist = typeof a.media_artist === 'string' ? (a.media_artist as string) : '';
		const channel = typeof a.media_channel === 'string' ? (a.media_channel as string) : '';
		const app = typeof a.app_name === 'string' ? (a.app_name as string) : '';
		const season = a.media_season;
		const episode = a.media_episode;

		// TV/series — primair: serie + aflevering, secundair: aflevering-titel
		if (contentType === 'tvshow' || seriesTitle) {
			const epPart = season && episode
				? `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
				: episode
					? `Aflevering ${episode}`
					: '';
			const primary = seriesTitle || mediaTitle || 'Serie';
			const secondary = mediaTitle && mediaTitle !== seriesTitle
				? (epPart ? `${epPart} · ${mediaTitle}` : mediaTitle)
				: epPart;
			return { primary, secondary };
		}
		// Films
		if (contentType === 'movie') {
			return { primary: mediaTitle || 'Film', secondary: app || '' };
		}
		// Muziek (gebruikelijk Spotify/radio)
		if (mediaTitle && (artist || album)) {
			return { primary: mediaTitle, secondary: artist || album };
		}
		// Live / radio
		if (channel) return { primary: channel, secondary: mediaTitle || '' };
		// Generic fallback
		if (mediaTitle) return { primary: mediaTitle, secondary: app || '' };
		if (app) return { primary: app, secondary: '' };
		return { primary: '', secondary: '' };
	}
	function isOn(entity: HomeAssistantEntity): boolean {
		const s = (entity.state ?? '').toLowerCase();
		return s !== 'off' && s !== 'unavailable' && s !== 'unknown' && s !== '';
	}
	function isPlaying(entity: HomeAssistantEntity): boolean {
		return (entity.state ?? '').toLowerCase() === 'playing';
	}

	// ----- Sorted entities --------------------------------------------------
	const sortedEntities = $derived.by(() => {
		const list = [...entities];
		if (playerOrder.length > 0) {
			// Custom volgorde: gebruik index van playerOrder, onbekende entities aan einde
			const orderIndex = new Map(playerOrder.map((id, i) => [id, i]));
			list.sort((a, b) => {
				const ai = orderIndex.has(a.entityId) ? orderIndex.get(a.entityId)! : Number.MAX_SAFE_INTEGER;
				const bi = orderIndex.has(b.entityId) ? orderIndex.get(b.entityId)! : Number.MAX_SAFE_INTEGER;
				if (ai !== bi) return ai - bi;
				// Tie-breaker voor entities zonder volgorde: alfabetisch
				const an = getPlayerName(a.entityId, a.friendlyName ?? a.entityId).toLowerCase();
				const bn = getPlayerName(b.entityId, b.friendlyName ?? b.entityId).toLowerCase();
				return an < bn ? -1 : an > bn ? 1 : 0;
			});
		} else {
			list.sort((a, b) => {
				const an = getPlayerName(a.entityId, a.friendlyName ?? a.entityId).toLowerCase();
				const bn = getPlayerName(b.entityId, b.friendlyName ?? b.entityId).toLowerCase();
				return an < bn ? -1 : an > bn ? 1 : 0;
			});
		}
		return list;
	});

	const activeEntity = $derived.by(() => {
		if (!activePlayerId) return null;
		return sortedEntities.find((e) => e.entityId === activePlayerId) ?? null;
	});

	const spotifyEntities = $derived.by(() => {
		// Combineer entities + allEntities, met allEntities als fallback voor de Spotify-controller
		// die mogelijk niet in de zichtbare lijst staat (kaart-config kan hem hebben gefilterd)
		const seen = new Set<string>();
		const combined: HomeAssistantEntity[] = [];
		for (const e of [...sortedEntities, ...allEntities]) {
			if (seen.has(e.entityId)) continue;
			seen.add(e.entityId);
			if (e.entityId.toLowerCase().startsWith('media_player.spotify')) combined.push(e);
		}
		return combined;
	});
	const spotifyTargetSourceList = $derived.by(() => {
		const main = spotifyEntities[0];
		return main ? readSources(main) : [];
	});

	/**
	 * Bij eerste keer (of als de bridge-lijst leeg is): autodetect Onkyo-zones
	 * en maak voor elke gevonden HA-zone een eigen bridge aan. Dit gebeurt alleen
	 * éénmalig — daarna kan de gebruiker zelf bridges hernoemen, toevoegen of
	 * verwijderen.
	 */
	$effect(() => {
		if (onkyoBridges.length > 0) return;
		if (sortedEntities.length === 0) return;
		// Vind alle Onkyo-zone entities
		const onkyoZones = sortedEntities.filter((e) => {
			const lower = e.entityId.toLowerCase();
			const friendly = (e.friendlyName ?? '').toLowerCase();
			return lower.includes('onkyo') || lower.includes('tx_nr') || lower.includes('tx-nr') || friendly.includes('onkyo');
		});
		if (onkyoZones.length === 0) return;
		// Vind de Spotify-controller-source voor Onkyo
		const spotifySource = spotifyTargetSourceList.find((s) => /onkyo|tx[-_ ]?nr/i.test(s));
		// Maak één bridge per zone, met fallback op friendlyName voor het label
		const initial: OnkyoBridge[] = onkyoZones.map((entity) => {
			let label = entity.friendlyName ?? entity.entityId;
			// Maak duidelijke labels voor zone 1 / zone 2 als de naam dat niet duidelijk maakt
			if (!/woonkamer|keuken|zone/i.test(label)) {
				label = entity.entityId.includes('zone_2') || entity.entityId.includes('zone2')
					? `Onkyo Zone 2`
					: `Onkyo Hoofdzone`;
			}
			return {
				id: `onkyo-bridge:${entity.entityId}`,
				label,
				zoneEntityId: entity.entityId,
				spotifySource
			};
		});
		setOnkyoBridges(initial);
	});

	/** Onkyo-zones die nog geen eigen bridge hebben — beschikbaar om handmatig toe te voegen. */
	const onkyoBridgeAddCandidates = $derived.by(() => {
		const usedEntityIds = new Set(onkyoBridges.map((b) => b.zoneEntityId));
		return sortedEntities.filter((e) => {
			if (usedEntityIds.has(e.entityId)) return false;
			const lower = e.entityId.toLowerCase();
			const friendly = (e.friendlyName ?? '').toLowerCase();
			return lower.includes('onkyo') || lower.includes('tx_nr') || lower.includes('tx-nr') || friendly.includes('onkyo');
		});
	});

	/**
	 * Genereert een normalized 'fingerprint' per device — gebruikt om dubbele
	 * entries tussen Spotify Connect-devices en HA-mediaspelers te detecteren.
	 */
	function deviceFingerprint(name: string): string {
		return name.toLowerCase().replace(/[\s\-_]+/g, '').replace(/[^a-z0-9]/g, '');
	}

	/**
	 * Splits een entity_id in betekenisvolle tokens voor fuzzy matching.
	 * "media_player.tx_nr676e" → ["tx", "nr676e"]
	 * "media_player.onkyo_tx_nr676e_eda3e2_2" → ["onkyo", "tx", "nr676e", "eda3e2"]
	 * (laatste "_2" is altijd een MA-marker en wordt gestript)
	 */
	function entityIdTokens(entityId: string): string[] {
		const idPart = entityId.replace(/^[^.]+\./, ''); // strip "media_player." prefix
		// VOLGORDE BELANGRIJK: eerst zone-suffix (_zone_2 / _zone_3), dan MA-suffix (_2).
		// Anders: "tx_nr676e_zone_2" → "tx_nr676e_zone" (door _2-strip eerst), waarna _zone niet
		// meer wordt herkend door de regex.
		const cleaned = idPart
			.replace(/_zone_?\d+$/i, '')
			.replace(/_2$/, '');
		return cleaned
			.split(/[_\-]+/)
			.map((t) => t.toLowerCase())
			.filter((t) => t.length >= 2);
	}

	/**
	 * Music Assistant detecteren — kijkt of een MA-versie van een entity bestaat.
	 * MA-entities eindigen typisch op _2 (HA's automatische suffix bij dubbele entities).
	 *
	 * Voor radio willen we per HA-entity de bijbehorende MA-versie weten:
	 * - media_player.gh_woonkamer       (HA's eigen Cast)        → media_player.gh_woonkamer_2 (MA)
	 * - media_player.tx_nr676e          (HA's Onkyo hoofdzone)   → media_player.onkyo_tx_nr676e_eda3e2_2 (MA)
	 *
	 * Drie strategieën, in volgorde:
	 *  1. Directe `_2` suffix
	 *  2. Fingerprint-match (voor afwijkingen in scheidingstekens)
	 *  3. Token-overlap: alle tokens van baseline moeten in MA-entity zitten
	 *     (vangt af "tx_nr676e" → "onkyo_tx_nr676e_eda3e2_2" door tokens "tx" + "nr676e")
	 */
	function findMaEntityForBase(baseEntityId: string): string | null {
		const all = allEntities.length > 0 ? allEntities : entities;
		// Strategie 1: directe _2 suffix
		const direct = all.find((e) => e.entityId === `${baseEntityId}_2`);
		if (direct) return direct.entityId;
		// Strategie 2: fingerprint-match op trailing _2 / _ma
		const baseFp = deviceFingerprint(baseEntityId);
		for (const e of all) {
			if (e.entityId === baseEntityId) continue;
			const fp = deviceFingerprint(e.entityId);
			if (fp === baseFp + '2' || fp === baseFp + 'ma') return e.entityId;
		}
		// Strategie 3: token-overlap met _2 suffix.
		// Skip kandidaten waarvan de _2 een Onkyo-zone-suffix is (_zone_2). Die is niet MA.
		const baseTokens = entityIdTokens(baseEntityId);
		if (baseTokens.length === 0) return null;
		for (const e of all) {
			if (!e.entityId.endsWith('_2')) continue;
			if (e.entityId === baseEntityId) continue;
			// Onkyo zone-2 is geen MA-entity, sla over
			if (/_zone_?\d+$/i.test(e.entityId)) continue;
			const candidateTokens = entityIdTokens(e.entityId);
			// Alle baseline-tokens moeten ook in de candidaat zitten,
			// EN de candidaat moet minimaal één extra token hebben (anders is het de zone-variant)
			const allMatch = baseTokens.every((t) => candidateTokens.includes(t));
			const hasExtra = candidateTokens.some((t) => !baseTokens.includes(t));
			if (allMatch && hasExtra) return e.entityId;
		}
		return null;
	}

	/**
	 * MA-spelers die als radio-target kunnen fungeren (Hubs én virtuele Onkyo-zone-targets).
	 *
	 * Belangrijk over Onkyo: het apparaat heeft fysiek één NET-input gedeeld tussen alle zones.
	 * MA ziet het als één target en zal bij play_media de hoofdzone forceren. Om zone-keuze
	 * tóch werkend te krijgen maken we VIRTUELE targets per zone (Woonkamer, Keuken, …) die
	 * allemaal naar dezelfde MA-entity routen, maar bij afspelen weet welke zone aan moet en
	 * welke uit. Zo kan de gebruiker uit de dropdown direct de gewenste kamer kiezen.
	 */
	type MaTarget = {
		/** MA-entity waar play_media naartoe gaat */
		maEntityId: string;
		/** Bijbehorende baseline HA-entity (voor Now Playing-balk en Cast wakker maken) */
		baseEntityId: string;
		/** Label in de dropdown */
		label: string;
		/** Bij Onkyo-zones: welke zones aan moeten zijn na play_media */
		forceOnZones: string[];
		/** Bij Onkyo-zones: welke zones uit moeten na play_media */
		forceOffZones: string[];
	};

	const maRadioHubs = $derived.by(() => {
		const all = allEntities.length > 0 ? allEntities : entities;
		const result: MaTarget[] = [];
		const seenMaIds = new Set<string>();

		// Onkyo: één MA-entity (de NET-input is fysiek gedeeld). We proberen alle bridges
		// totdat we een match vinden — sommige bridge-configs hebben zone 2 als eerste of
		// gebruiken naamgeving die niet matcht (zoals tx_nr676e_zone_2). We zoeken door tot
		// een MA-entity vindbaar is.
		if (onkyoBridges.length > 0) {
			let onkyoMaId: string | null = null;
			for (const bridge of onkyoBridges) {
				onkyoMaId = findMaEntityForBase(bridge.zoneEntityId);
				if (onkyoMaId) break;
			}
			if (onkyoMaId) {
				const allZoneIds = onkyoBridges.map((b) => b.zoneEntityId);
				for (const bridge of onkyoBridges) {
					result.push({
						maEntityId: onkyoMaId,
						baseEntityId: bridge.zoneEntityId,
						label: bridge.label,
						forceOnZones: [bridge.zoneEntityId],
						forceOffZones: allZoneIds.filter((id) => id !== bridge.zoneEntityId)
					});
				}
				seenMaIds.add(onkyoMaId);
			}
		}

		// Hubs: één target per MA-entity, geen zone-acties.
		// Sluit ook duplicate Onkyo-entities uit (komt voor als MA een tweede Onkyo-integratie
		// heeft toegevoegd) — die zijn herkenbaar aan onkyo/tx_nr in entity_id.
		const onkyoBaseIds = new Set(onkyoBridges.map((b) => b.zoneEntityId));
		const isOnkyoEntity = (id: string) => /^media_player\.(onkyo|tx[_-]?nr|integra)/i.test(id);
		for (const e of all) {
			if (onkyoBaseIds.has(e.entityId)) continue;
			if (e.entityId.toLowerCase().startsWith('media_player.spotify')) continue;
			if (e.entityId.endsWith('_2')) continue;
			if (isOnkyoEntity(e.entityId)) continue; // Onkyo wordt via bridges afgehandeld
			const ma = findMaEntityForBase(e.entityId);
			if (ma && !seenMaIds.has(ma)) {
				result.push({
					maEntityId: ma,
					baseEntityId: e.entityId,
					label: getPlayerName(e.entityId, e.friendlyName ?? e.entityId),
					forceOnZones: [],
					forceOffZones: []
				});
				seenMaIds.add(ma);
			}
		}
		return result.sort((a, b) => a.label.localeCompare(b.label));
	});

	/** Boolean: toon de MA-features in de UI als er minstens één MA-entity is. */
	const maAvailable = $derived(maRadioHubs.length > 0);

	/**
	 * MA-targets voor de Spotify-tab: alleen Hubs (geen virtuele Onkyo-zones, want voor Onkyo
	 * werkt Spotify Connect via de bridge: targets en is dat eenvoudiger/sneller).
	 */
	const maHubsForSpotify = $derived(maRadioHubs.filter((h) => h.forceOnZones.length === 0));

	/** Spotify URI → MA media_type (track / playlist / album / artist). */
	function spotifyUriToMaMediaType(uri: string): string {
		// uri-formaat: spotify:track:..., spotify:playlist:..., spotify:album:..., spotify:artist:...
		const m = uri.match(/^spotify:(track|playlist|album|artist):/);
		return m?.[1] ?? 'track';
	}

	// ----- Player actions ---------------------------------------------------
	function setActivePlayer(entityId: string) {
		activePlayerId = entityId;
		writeStoredValue(ACTIVE_PLAYER_KEY, entityId);
		volumeDraft = null;
	}

	async function togglePower(entity: HomeAssistantEntity) {
		await callService('media_player', isOn(entity) ? 'turn_off' : 'turn_on', entity.entityId);
	}

	/**
	 * Voor Onkyo-zones routeert play/pause/next/previous via Spotify Web API,
	 * omdat de Onkyo-integratie deze acties niet rechtstreeks ondersteunt op zone-entiteiten.
	 * Geeft true terug als de actie via de bridge is afgehandeld.
	 */
	async function tryOnkyoTransport(entity: HomeAssistantEntity, action: 'play' | 'pause' | 'next' | 'previous'): Promise<boolean> {
		const onkyoSource = findOnkyoSpotifySource(entity.entityId);
		if (!onkyoSource) return false;
		try {
			// Als Onkyo nog niet zichtbaar is in Spotify Connect: source-switch en wachten
			let onkyoDevice = spotifyDevices.find((d) => /onkyo|tx[-_ ]?nr/i.test(d.name));
			if (!onkyoDevice) {
				const main = spotifyEntities[0];
				if (main) {
					if (!isOn(entity)) {
						await callService('media_player', 'turn_on', entity.entityId);
						await new Promise((r) => setTimeout(r, 800));
					}
					await callService('media_player', 'select_source', main.entityId, { source: onkyoSource });
					await new Promise((r) => setTimeout(r, 1500));
					await loadSpotifyDevices();
					onkyoDevice = spotifyDevices.find((d) => /onkyo|tx[-_ ]?nr/i.test(d.name));
				}
			}
			await spJson('/api/spotify/control', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action, deviceId: onkyoDevice?.id || undefined })
			});
			return true;
		} catch (e) {
			spotifyError = humanizeSpotifyError(e);
			return true; // bridge poging geweest; toon de Spotify-fout in plaats van de generieke
		}
	}

	async function togglePlayPause(entity: HomeAssistantEntity) {
		if (!isOn(entity)) {
			await callService('media_player', 'turn_on', entity.entityId);
			return;
		}
		const action = isPlaying(entity) ? 'pause' : 'play';
		// Probeer eerst Onkyo-bridge — als dat een Onkyo-zone is, gaat dat via Spotify
		if (await tryOnkyoTransport(entity, action)) return;
		await callService('media_player', action === 'pause' ? 'media_pause' : 'media_play', entity.entityId);
	}
	async function nextTrack(entity: HomeAssistantEntity) {
		if (await tryOnkyoTransport(entity, 'next')) return;
		await callService('media_player', 'media_next_track', entity.entityId);
	}
	async function prevTrack(entity: HomeAssistantEntity) {
		if (await tryOnkyoTransport(entity, 'previous')) return;
		await callService('media_player', 'media_previous_track', entity.entityId);
	}
	function onVolumeInput(value: number, entity: HomeAssistantEntity) {
		const v = Math.max(0, Math.min(1, value));
		volumeDraft = v;
		if (volumeTimer) clearTimeout(volumeTimer);
		volumeTimer = setTimeout(() => {
			void callService('media_player', 'volume_set', entity.entityId, { volume_level: v });
		}, 120);
	}
	async function toggleMute(entity: HomeAssistantEntity) {
		await callService('media_player', 'volume_mute', entity.entityId, { is_volume_muted: !readMuted(entity) });
	}
	async function selectSource(entity: HomeAssistantEntity, source: string) {
		await callService('media_player', 'select_source', entity.entityId, { source });
		sourcePickerOpen = false;
	}

	// ----- Drag and drop herordening -----------------------------------------
	function handleDragStart(e: DragEvent, entityId: string) {
		dragSourceEntityId = entityId;
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move';
			// Required for Firefox to start drag
			e.dataTransfer.setData('text/plain', entityId);
		}
	}
	function handleDragOver(e: DragEvent, entityId: string) {
		if (!dragSourceEntityId || dragSourceEntityId === entityId) return;
		e.preventDefault();
		if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
		dragOverEntityId = entityId;
	}
	function handleDragLeave(entityId: string) {
		if (dragOverEntityId === entityId) dragOverEntityId = '';
	}
	function handleDrop(e: DragEvent, targetEntityId: string) {
		e.preventDefault();
		const sourceId = dragSourceEntityId;
		dragSourceEntityId = '';
		dragOverEntityId = '';
		if (!sourceId || sourceId === targetEntityId) return;
		// Bouw de huidige volgorde op basis van getoonde lijst
		const currentOrder = sortedEntities.map((e) => e.entityId);
		const fromIdx = currentOrder.indexOf(sourceId);
		const toIdx = currentOrder.indexOf(targetEntityId);
		if (fromIdx < 0 || toIdx < 0) return;
		const next = [...currentOrder];
		next.splice(fromIdx, 1);
		next.splice(toIdx, 0, sourceId);
		setPlayerOrder(next);
	}
	function handleDragEnd() {
		dragSourceEntityId = '';
		dragOverEntityId = '';
	}

	// ----- Spotify Connect bridge (HA-entity source switch) -----------------
	function setSpotifyTargetSource(source: string) {
		spotifySourceTarget = source;
		writeStoredValue(SPOTIFY_SOURCE_TARGET_KEY, source);
	}
	async function spotifyPlayOnTarget() {
		const main = spotifyEntities[0];
		if (!main || !spotifySourceTarget) return;
		await callService('media_player', 'select_source', main.entityId, { source: spotifySourceTarget });
		setActivePlayer(main.entityId);
		setTimeout(() => {
			void callService('media_player', 'media_play', main.entityId);
		}, 600);
	}

	// ----- Spotify Web API --------------------------------------------------
	/**
	 * Bij rate-limit (429) blokkeren we alle Spotify-aanroepen totdat deze tijd voorbij is.
	 * Voorkomt een runaway loop waarbij de polling-interval steeds opnieuw 429 triggert.
	 */
	let spotifyRateLimitedUntil = $state(0);

	async function spJson(path: string, init?: RequestInit) {
		const now = Date.now();
		if (spotifyRateLimitedUntil > now) {
			throw new Error(`{"error":{"status":429,"reason":"RATE_LIMITED"}}`);
		}
		const resp = await fetch(ingressPath(path), init);
		if (resp.status === 401) {
			spotifyConnected = false;
			throw new Error('not_connected');
		}
		if (resp.status === 429) {
			// Probeer Retry-After header te lezen, default 60s om Spotify te laten kalmeren
			const retryAfterRaw = resp.headers.get('retry-after');
			const retryAfter = retryAfterRaw && Number.isFinite(Number(retryAfterRaw))
				? Math.max(30, Number(retryAfterRaw))
				: 60;
			spotifyRateLimitedUntil = Date.now() + retryAfter * 1000;
			throw new Error(`{"error":{"status":429,"reason":"RATE_LIMITED","retryAfter":${retryAfter}}}`);
		}
		const text = await resp.text();
		if (!resp.ok) throw new Error(text || `http_${resp.status}`);
		return text ? JSON.parse(text) : {};
	}

	/**
	 * Vertaalt rauwe Spotify API foutmeldingen naar leesbare Nederlandse tekst.
	 * Spotify retourneert vaak geneste JSON met technische codes — onbruikbaar voor eindgebruikers.
	 */
	function humanizeSpotifyError(e: unknown): string {
		const raw = e instanceof Error ? e.message : String(e);
		// Probeer JSON uit te pakken — server.js packt error responses als '{"error":"...","details":"..."}'
		let reason = '';
		let status = 0;
		let message = '';
		try {
			const outer = JSON.parse(raw);
			if (outer?.details) {
				try {
					const inner = JSON.parse(outer.details);
					reason = inner?.error?.reason ?? '';
					status = Number(inner?.error?.status ?? 0);
					message = inner?.error?.message ?? '';
				} catch {
					message = String(outer.details);
				}
			} else if (outer?.error) {
				reason = outer.error.reason ?? '';
				status = Number(outer.error.status ?? 0);
				message = outer.error.message ?? '';
			}
		} catch {
			// raw is geen JSON
		}

		// Bekende Spotify reason codes vertalen
		switch (reason) {
			case 'RATE_LIMITED':
				return _t('Spotify gaf "te veel verzoeken" terug. Novapanel pauzeert nu een minuut en probeert daarna automatisch opnieuw.');
			case 'NO_ACTIVE_DEVICE':
				return _t('Geen actief Spotify-apparaat. Kies eerst een apparaat in de "Spotify-apparaat"-lijst hierboven, of zet je Onkyo aan en schakel naar de Spotify-bron — dan verschijnt hij in de lijst.');
			case 'PREMIUM_REQUIRED':
				return _t('Voor afspelen via Spotify Connect heb je een Spotify Premium-abonnement nodig.');
			case 'DEVICE_NOT_CONTROLLABLE':
				return _t('Dit apparaat kan niet via Spotify Connect bediend worden.');
			case 'CONTEXT_DISALLOW':
				return _t('Deze actie is niet beschikbaar in de huidige afspeel-context.');
			case 'ALREADY_PAUSED':
				return _t('Spotify staat al op pauze.');
			case 'NOT_PAUSED':
				return _t('Spotify is al aan het afspelen.');
			case 'UNKNOWN':
				return _t('Spotify gaf een onbekende fout terug. Probeer opnieuw of selecteer een ander apparaat.');
		}

		// Status-codes
		if (status === 401 || raw.includes('not_connected')) {
			return _t('Spotify-verbinding is verlopen. Open Settings en verbind opnieuw.');
		}
		if (status === 403) {
			return _t('Spotify heeft deze actie geweigerd. Mogelijk geen Premium of geen rechten op dit apparaat.');
		}
		if (status === 429) {
			return _t('Te veel verzoeken naar Spotify. Wacht een paar tellen en probeer opnieuw.');
		}
		if (status === 404 && /No active device/i.test(message)) {
			return _t('Geen actief Spotify-apparaat. Kies eerst een apparaat in de lijst hierboven.');
		}

		// Fallback: gebruik de message als die ergens leesbaar uit is gekomen
		if (message) return `Spotify: ${message}`;
		return _t('Er ging iets mis bij Spotify. Probeer het opnieuw.');
	}

	async function spotifyCheckAuth() {
		try {
			const data = await spJson('/api/spotify/auth/status');
			spotifyConnected = Boolean(data?.connected);
		} catch {
			spotifyConnected = false;
		}
		spotifyAuthChecked = true;
	}

	let spotifyAuthInProgress = $state(false);
	let spotifyAuthWindow: Window | null = null;
	let spotifyAuthPollTimer: ReturnType<typeof setInterval> | null = null;

	function stopSpotifyAuthPolling() {
		if (spotifyAuthPollTimer) {
			clearInterval(spotifyAuthPollTimer);
			spotifyAuthPollTimer = null;
		}
	}

	function handleSpotifyAuthMessage(event: MessageEvent) {
		const data = event?.data;
		if (data && typeof data === 'object' && data.type === 'novapanel-spotify-auth' && data.status === 'connected') {
			spotifyAuthInProgress = false;
			stopSpotifyAuthPolling();
			void spotifyCheckAuth();
		}
	}

	$effect(() => {
		if (typeof window === 'undefined') return;
		window.addEventListener('message', handleSpotifyAuthMessage);
		return () => {
			window.removeEventListener('message', handleSpotifyAuthMessage);
			stopSpotifyAuthPolling();
		};
	});

	async function spotifyConnectStart() {
		spotifyError = '';
		try {
			const resp = await fetch(ingressPath('/api/spotify/auth/start'));
			if (!resp.ok) {
				spotifyError = `${_t('Spotify-auth start mislukte')} (${resp.status}).`;
				return;
			}
			const data = await resp.json();
			if (!data?.url) {
				spotifyError = _t('Geen auth-URL ontvangen.');
				return;
			}
			spotifyAuthWindow = window.open(data.url, '_blank', 'noopener=no');
			if (!spotifyAuthWindow) {
				spotifyError = 'Pop-up geblokkeerd door de browser. Sta pop-ups toe en probeer opnieuw.';
				return;
			}
			spotifyAuthInProgress = true;
			stopSpotifyAuthPolling();
			let elapsedTicks = 0;
			spotifyAuthPollTimer = setInterval(async () => {
				elapsedTicks++;
				try {
					if (spotifyAuthWindow && spotifyAuthWindow.closed) {
						await spotifyCheckAuth();
						spotifyAuthInProgress = false;
						stopSpotifyAuthPolling();
						return;
					}
				} catch {
					// cross-origin, ignore
				}
				const wasConnected = spotifyConnected;
				await spotifyCheckAuth();
				if (spotifyConnected && !wasConnected) {
					spotifyAuthInProgress = false;
					stopSpotifyAuthPolling();
				}
				if (elapsedTicks > 90) {
					spotifyAuthInProgress = false;
					stopSpotifyAuthPolling();
				}
			}, 2000);
		} catch (e) {
			spotifyError = humanizeSpotifyError(e);
		}
	}

	function mapSpotifyTrack(t: any): SpUri {
		const image = t?.album?.images?.[0]?.url ?? '';
		const artists = Array.isArray(t?.artists) ? t.artists.map((a: any) => a?.name).filter(Boolean).join(', ') : '';
		return { uri: t?.uri ?? '', name: t?.name ?? '', image, subtitle: artists, kind: 'track' };
	}
	function mapSpotifyAlbum(a: any): SpUri {
		const image = a?.images?.[0]?.url ?? '';
		const artists = Array.isArray(a?.artists) ? a.artists.map((x: any) => x?.name).filter(Boolean).join(', ') : '';
		return { uri: a?.uri ?? '', name: a?.name ?? '', image, subtitle: artists, kind: 'album' };
	}
	function mapSpotifyPlaylist(p: any): SpUri {
		const image = Array.isArray(p?.images) && p.images[0]?.url ? p.images[0].url : '';
		const owner = p?.owner?.display_name ?? '';
		return { uri: p?.uri ?? '', name: p?.name ?? '', image, subtitle: owner, kind: 'playlist' };
	}
	function mapSpotifyArtist(a: any): SpUri {
		const image = Array.isArray(a?.images) && a.images[0]?.url ? a.images[0].url : '';
		return { uri: a?.uri ?? '', name: a?.name ?? '', image, subtitle: 'Artiest', kind: 'artist' };
	}

	async function spotifySearch() {
		const q = spotifySearchQuery.trim();
		if (!q) {
			spotifySearchResults = [];
			return;
		}
		spotifySearchBusy = true;
		spotifyError = '';
		try {
			const data = await spJson('/api/spotify/search', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ query: q, types: ['track', 'album', 'playlist', 'artist'], limit: 8 })
			});
			const results: SpUri[] = [];
			for (const t of data?.tracks?.items ?? []) results.push(mapSpotifyTrack(t));
			for (const p of data?.playlists?.items ?? []) if (p) results.push(mapSpotifyPlaylist(p));
			for (const a of data?.albums?.items ?? []) results.push(mapSpotifyAlbum(a));
			for (const ar of data?.artists?.items ?? []) results.push(mapSpotifyArtist(ar));
			spotifySearchResults = results;
		} catch (e) {
			spotifyError = humanizeSpotifyError(e);
		} finally {
			spotifySearchBusy = false;
		}
	}

	async function loadSpotifyPlaylists() {
		try {
			const data = await spJson('/api/spotify/playlists?limit=50');
			spotifyPlaylists = (data?.items ?? []).map(mapSpotifyPlaylist).filter((x: SpUri) => x.uri);
			spotifyPlaylistsLoaded = true;
		} catch (e) {
			spotifyError = humanizeSpotifyError(e);
		}
	}

	async function loadSpotifyDevices() {
		try {
			const data = await spJson('/api/spotify/devices');
			spotifyDevices = (data?.devices ?? []).map((d: any) => ({
				id: d?.id ?? '', name: d?.name ?? '', type: d?.type ?? '', isActive: Boolean(d?.is_active)
			}));
			const active = spotifyDevices.find((d) => d.isActive);
			if (active) {
				spotifyDeviceId = active.id;
				writeStoredValue(SPOTIFY_DEVICE_KEY, active.id);
				// Als er nog geen playback target gekozen is, neem het actieve device
				if (!spotifyPlaybackTarget) {
					setSpotifyPlaybackTarget(`spotify:${active.id}`);
				}
			}
		} catch (e) {
			spotifyError = humanizeSpotifyError(e);
		}
	}

	async function loadSpotifyPlayerState() {
		try {
			const data = await spJson('/api/spotify/player');
			if (!data?.active) {
				spotifyPlayerState = {};
				return;
			}
			const item = data.item;
			spotifyPlayerState = {
				track: item ? {
					name: item.name ?? '',
					artists: Array.isArray(item.artists) ? item.artists.map((a: any) => a?.name).filter(Boolean).join(', ') : '',
					image: item.album?.images?.[0]?.url ?? '',
					uri: item.uri ?? '',
					durationMs: item.duration_ms ?? 0
				} : undefined,
				progressMs: data.progress_ms ?? 0,
				isPlaying: Boolean(data.is_playing),
				shuffle: Boolean(data.shuffle_state),
				repeat: data.repeat_state ?? 'off',
				volumePercent: data.device?.volume_percent ?? undefined,
				device: data.device ? {
					id: data.device.id ?? '',
					name: data.device.name ?? '',
					type: data.device.type ?? '',
					isActive: Boolean(data.device.is_active)
				} : undefined
			};
		} catch {
			// silent
		}
	}

	async function loadSpotifyQueue() {
		try {
			const data = await spJson('/api/spotify/queue');
			spotifyQueue = (data?.queue ?? []).slice(0, 12).map(mapSpotifyTrack);
		} catch (e) {
			spotifyError = humanizeSpotifyError(e);
		}
	}

	async function spotifyControl(action: string, extra: Record<string, unknown> = {}) {
		// Bridge target: routeer naar Onkyo-device via Spotify Web API
		if (spotifyPlaybackTarget.startsWith('bridge:')) {
			const bridgeId = spotifyPlaybackTarget.slice('bridge:'.length);
			const bridge = getBridgeById(bridgeId);
			try {
				let onkyoDevice = spotifyDevices.find((d) => /onkyo|tx[-_ ]?nr/i.test(d.name));
				if (!onkyoDevice && bridge) {
					const activated = await activateBridge(bridge);
					if (activated) onkyoDevice = { id: activated.id, name: 'Onkyo', type: '', isActive: true };
				}
				await spJson('/api/spotify/control', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ action, deviceId: onkyoDevice?.id || undefined, ...extra })
				});
				void loadSpotifyPlayerState();
			} catch (e) {
				spotifyError = humanizeSpotifyError(e);
			}
			return;
		}
		// MA-Hub target: play/pause/seek/volume gaan naar de baseline HA-entity (Cast accepteert
		// die wel), maar next/previous/shuffle/repeat moeten naar de MA-entity (de Cast-baseline
		// ondersteunt geen track-navigatie of shuffle, MA wel).
		if (spotifyPlaybackTarget.startsWith('ma:')) {
			const payload = spotifyPlaybackTarget.slice('ma:'.length);
			const [baseEntityId, maEntityId] = payload.split('|');
			if (!baseEntityId || !maEntityId) return;
			try {
				const data: Record<string, unknown> = {};
				let haAction: string | null = null;
				let target = baseEntityId;
				if (action === 'pause') {
					haAction = 'media_pause';
				} else if (action === 'play' || action === 'resume') {
					haAction = 'media_play';
				} else if (action === 'seek' && typeof extra.positionMs === 'number') {
					haAction = 'media_seek';
					data.seek_position = Math.floor((extra.positionMs as number) / 1000);
				} else if (action === 'next') {
					haAction = 'media_next_track';
					target = maEntityId;
				} else if (action === 'previous' || action === 'prev') {
					haAction = 'media_previous_track';
					target = maEntityId;
				} else if (action === 'shuffle' && typeof extra.enabled === 'boolean') {
					haAction = 'shuffle_set';
					target = maEntityId;
					data.shuffle = extra.enabled;
				} else if (action === 'repeat' && typeof extra.mode === 'string') {
					haAction = 'repeat_set';
					target = maEntityId;
					data.repeat = extra.mode; // 'off' | 'one' | 'all'
				}
				if (!haAction) return;
				await callService('media_player', haAction, target, Object.keys(data).length > 0 ? data : undefined);
			} catch (e) {
				spotifyError = humanizeSpotifyError(e);
			}
			return;
		}
		// Voor HA-targets bestond hier ooit cast-routering; we gebruiken alleen nog Onkyo bridges
		// die via spotify: en bridge: targets verlopen.
		try {
			const deviceId = spotifyPlaybackTarget.startsWith('spotify:')
				? spotifyPlaybackTarget.slice('spotify:'.length)
				: spotifyDeviceId;
			await spJson('/api/spotify/control', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action, deviceId: deviceId || undefined, ...extra })
			});
			void loadSpotifyPlayerState();
		} catch (e) {
			spotifyError = humanizeSpotifyError(e);
		}
	}

	function getBridgeById(id: string): OnkyoBridge | null {
		return onkyoBridges.find((b) => b.id === id) ?? null;
	}

	function startBridgeRename(id: string) {
		const b = getBridgeById(id);
		if (!b) return;
		bridgeRenamingId = id;
		bridgeRenameDraft = b.label;
	}
	function commitBridgeRename() {
		const id = bridgeRenamingId;
		const label = bridgeRenameDraft.trim();
		if (!id || !label) {
			bridgeRenamingId = '';
			return;
		}
		setOnkyoBridges(onkyoBridges.map((b) => b.id === id ? { ...b, label } : b));
		bridgeRenamingId = '';
		bridgeRenameDraft = '';
	}
	function cancelBridgeRename() {
		bridgeRenamingId = '';
		bridgeRenameDraft = '';
	}
	function removeBridge(id: string) {
		setOnkyoBridges(onkyoBridges.filter((b) => b.id !== id));
		// Als het huidige speeltarget deze bridge was, reset
		if (spotifyPlaybackTarget === `bridge:${id}`) setSpotifyPlaybackTarget('');
	}
	function addBridge(label: string, zoneEntityId: string) {
		const trimmed = label.trim();
		if (!trimmed || !zoneEntityId) return;
		const id = `onkyo-bridge:${zoneEntityId}:${Date.now()}`;
		const spotifySource = spotifyTargetSourceList.find((s) => /onkyo|tx[-_ ]?nr/i.test(s));
		const next: OnkyoBridge = { id, label: trimmed, zoneEntityId, spotifySource };
		setOnkyoBridges([...onkyoBridges, next]);
	}

	/**
	 * Configureer een nieuwe bridge: zone aan, source-switch, wacht op Spotify Connect.
	 * Geeft het Onkyo-device terug uit Spotify Connect, of null bij fout.
	 *
	 * Zone-isolatie: een Onkyo-receiver heeft één Spotify Connect-aansluiting voor alle zones
	 * samen. Welke zones de muziek dan horen wordt bepaald door welke zones aan staan op het
	 * apparaat. Voor "alleen keuken" zetten we zone 1 (woonkamer) uit; voor "alleen woonkamer"
	 * zone 2 (keuken). Dat moet vóór de source-switch gebeuren.
	 */
	async function activateBridge(bridge: OnkyoBridge): Promise<{ id: string } | null> {
		const main = spotifyEntities[0];
		if (!main) {
			spotifyError = _t('Geen Spotify-controller in Home Assistant gevonden om naar de Onkyo door te schakelen.');
			return null;
		}

		// Zoek alle zones (uit allEntities zodat het werkt ongeacht of de zone in card-config staat)
		const allKnown = allEntities.length > 0 ? allEntities : entities;
		const otherOnkyoZones = onkyoBridges.filter((b) => b.id !== bridge.id);

		// 1. Andere Onkyo-zones uitzetten zodat alleen deze de muziek hoort
		for (const other of otherOnkyoZones) {
			const otherEntity = allKnown.find((e) => e.entityId === other.zoneEntityId);
			if (otherEntity && isOn(otherEntity)) {
				await callService('media_player', 'turn_off', other.zoneEntityId);
			}
		}
		if (otherOnkyoZones.length > 0) await new Promise((r) => setTimeout(r, 500));

		// 2. Doelzone aanzetten
		const zoneEntity = allKnown.find((e) => e.entityId === bridge.zoneEntityId);
		if (zoneEntity && !isOn(zoneEntity)) {
			await callService('media_player', 'turn_on', bridge.zoneEntityId);
			await new Promise((r) => setTimeout(r, 1000));
		}

		// 3. Spotify-source schakelen op de Spotify-controller
		const source = bridge.spotifySource ?? spotifyTargetSourceList.find((s) => /onkyo|tx[-_ ]?nr/i.test(s));
		if (source) {
			await callService('media_player', 'select_source', main.entityId, { source });
			await new Promise((r) => setTimeout(r, 1500));
		}

		// 4. Devices verversen en Onkyo-device terugvinden in Spotify Connect
		await loadSpotifyDevices();
		const onkyoDevice = spotifyDevices.find((d) => /onkyo|tx[-_ ]?nr/i.test(d.name));
		return onkyoDevice ? { id: onkyoDevice.id } : null;
	}

	/**
	 * Detecteert of een HA-entity een Onkyo-receiver-zone is en zoekt de bijbehorende
	 * Spotify Connect source-naam in de Spotify-controller-entity. Onkyo's HA-integratie
	 * ondersteunt geen play_media voor Spotify URIs, dus we sturen de speeltaak via
	 * Spotify's source-switch op `media_player.spotify_*`. De receiver pakt het op en
	 * speelt af op de zone die op dat moment actief is.
	 *
	 * @returns De source-naam als bridge mogelijk is, anders null.
	 */
	function findOnkyoSpotifySource(entityId: string): string | null {
		const entity = sortedEntities.find((e) => e.entityId === entityId);
		if (!entity) return null;
		const friendly = (entity.friendlyName ?? '').toLowerCase();
		const isOnkyo = entityId.toLowerCase().includes('onkyo')
			|| entityId.toLowerCase().includes('tx_nr')
			|| entityId.toLowerCase().includes('tx-nr')
			|| friendly.includes('onkyo');
		if (!isOnkyo) return null;
		// Zoek in de Spotify-entity's source-list naar een Onkyo-bron
		const main = spotifyEntities[0];
		if (!main) return null;
		const sources = readSources(main);
		const onkyoSource = sources.find((s) => /onkyo|tx[-_ ]?nr/i.test(s));
		return onkyoSource ?? null;
	}

	/**
	 * Speel een Spotify URI af op het gekozen target.
	 * - target leeg: vraagt gebruiker om eerst een afspeelapparaat te kiezen.
	 * - target "spotify:<deviceId>": Spotify Web API → de Connect-device.
	 * - target "ha:<entityId>" + Onkyo herkend: bridge via Spotify-controller's source-switch.
	 * - target "ha:<entityId>" anders: HA's media_player.play_media met de Spotify URI.
	 */
	async function spotifyPlayUri(uri: string) {
		if (!spotifyPlaybackTarget) {
			spotifyError = _t('Kies eerst een speelapparaat in de dropdown hierboven.');
			return;
		}
		try {
			// Onkyo bridge: virtuele entry die zone aanzet en doorroutet naar Spotify Connect
			if (spotifyPlaybackTarget.startsWith('bridge:')) {
				const bridgeId = spotifyPlaybackTarget.slice('bridge:'.length);
				const bridge = getBridgeById(bridgeId);
				if (!bridge) {
					spotifyError = 'Bridge niet gevonden.';
					return;
				}
				const onkyo = await activateBridge(bridge);
				await spJson('/api/spotify/play', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ uri, deviceId: onkyo?.id || undefined })
				});
				setActivePlayer(bridge.zoneEntityId);
				setTimeout(() => void loadSpotifyPlayerState(), 1000);
				return;
			}

			// MA-Hub target: gebruik music_assistant.play_media met juiste media_type
			if (spotifyPlaybackTarget.startsWith('ma:')) {
				const payload = spotifyPlaybackTarget.slice('ma:'.length);
				const [baseEntityId, maEntityId] = payload.split('|');
				if (!baseEntityId || !maEntityId) {
					spotifyError = 'MA-target ongeldig.';
					return;
				}
				const allKnown = allEntities.length > 0 ? allEntities : entities;
				const baseEntity = allKnown.find((e) => e.entityId === baseEntityId);
				// Cast wakker schoppen als het apparaat uit staat
				if (baseEntity && !isOn(baseEntity)) {
					await callService('media_player', 'turn_on', baseEntity.entityId);
					await new Promise((r) => setTimeout(r, 800));
				}
				await callService('music_assistant', 'play_media', maEntityId, {
					media_type: spotifyUriToMaMediaType(uri),
					media_id: uri
				});
				setActivePlayer(baseEntityId);
				return;
			}

			// HA-targets bestonden ooit voor Cast en losse Onkyo-zones; we gebruiken alleen nog
			// bridge: en spotify: targets. Voor Onkyo gaat alles via de bridge: branch hierboven.
			// Default: Spotify Connect device
			const deviceId = spotifyPlaybackTarget.startsWith('spotify:')
				? spotifyPlaybackTarget.slice('spotify:'.length)
				: spotifyDeviceId;
			await spJson('/api/spotify/play', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ uri, deviceId: deviceId || undefined })
			});
			setTimeout(() => void loadSpotifyPlayerState(), 800);
		} catch (e) {
			spotifyError = humanizeSpotifyError(e);
		}
	}

	async function spotifyAddToQueue(uri: string) {
		// Bridge target
		if (spotifyPlaybackTarget.startsWith('bridge:')) {
			const bridgeId = spotifyPlaybackTarget.slice('bridge:'.length);
			const bridge = getBridgeById(bridgeId);
			try {
				let onkyoDevice = spotifyDevices.find((d) => /onkyo|tx[-_ ]?nr/i.test(d.name));
				if (!onkyoDevice && bridge) {
					const activated = await activateBridge(bridge);
					if (activated) onkyoDevice = { id: activated.id, name: 'Onkyo', type: '', isActive: true };
				}
				if (!onkyoDevice) {
					spotifyError = _t('Onkyo niet zichtbaar in Spotify Connect — speel eerst iets af om de bridge te activeren.');
					return;
				}
				await spJson('/api/spotify/queue', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ uri, deviceId: onkyoDevice.id })
				});
			} catch (e) {
				spotifyError = humanizeSpotifyError(e);
			}
			return;
		}
		// MA-Hub target: queue is bij MA niet rechtstreeks beschikbaar via play_media. Voor nu
		// vervangen we de huidige stream — dat is consistent met hoe radio-favorieten werken.
		if (spotifyPlaybackTarget.startsWith('ma:')) {
			spotifyError = 'Aan wachtrij toevoegen werkt nog niet voor MA-speakers. Speel het nummer direct af.';
			return;
		}
		try {
			const deviceId = spotifyPlaybackTarget.startsWith('spotify:')
				? spotifyPlaybackTarget.slice('spotify:'.length)
				: spotifyDeviceId;
			await spJson('/api/spotify/queue', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ uri, deviceId: deviceId || undefined })
			});
		} catch (e) {
			spotifyError = humanizeSpotifyError(e);
		}
	}

	async function spotifyTransfer(deviceId: string, alsoPlay = true) {
		spotifyDeviceId = deviceId;
		writeStoredValue(SPOTIFY_DEVICE_KEY, deviceId);
		try {
			await spJson('/api/spotify/control', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ action: 'transfer', deviceId, play: alsoPlay })
			});
			setTimeout(() => void loadSpotifyPlayerState(), 600);
		} catch (e) {
			spotifyError = humanizeSpotifyError(e);
		}
	}

	// Polling van Spotify-state als de tab actief is
	$effect(() => {
		if (!spotifyConnected) return;
		// Poll Spotify state als:
		// 1) we op de Spotify tab zijn, OF
		// 2) een Onkyo-bridge is de actieve speler (Now Playing-balk leest van Spotify)
		const isBridgeActive = activeEntity !== null && onkyoBridges.some((b) => b.zoneEntityId === activeEntity.entityId);
		if (activeSection !== 'spotify' && !isBridgeActive) return;
		// Polling: respecteer rate-limit en pauzeer als de tab niet zichtbaar is
		// (zo voorkomen we dat veel tabs samen Spotify overspoelen).
		const tick = () => {
			if (typeof document !== 'undefined' && document.hidden) return;
			if (Date.now() < spotifyRateLimitedUntil) return;
			void loadSpotifyPlayerState();
		};
		const interval = setInterval(tick, 10000);
		tick();
		return () => clearInterval(interval);
	});

	// Initialisatie wanneer Spotify-tab wordt geactiveerd
	$effect(() => {
		if (!spotifyConfigured) return;
		if (activeSection !== 'spotify') return;
		if (!spotifyAuthChecked) void spotifyCheckAuth();
	});
	$effect(() => {
		if (activeSection !== 'spotify' || !spotifyConnected) return;
		if (!spotifyPlaylistsLoaded) void loadSpotifyPlaylists();
		void loadSpotifyDevices();
		void loadSpotifyPlayerState();
	});

	// ----- TuneIn -----------------------------------------------------------
	async function searchTuneIn() {
		const q = tuneInSearchQuery.trim();
		if (!q) {
			tuneInSearchResults = [];
			return;
		}
		tuneInSearchBusy = true;
		tuneInError = '';
		try {
			const resp = await fetch(ingressPath(`/api/tunein/search?q=${encodeURIComponent(q)}`));
			if (!resp.ok) {
				tuneInError = `Zoeken mislukte (${resp.status}). Probeer later opnieuw.`;
				tuneInSearchResults = [];
				return;
			}
			const data = await resp.json();
			tuneInSearchResults = (data?.items ?? []).filter((it: TuneInItem) => it?.url && it?.text);
		} catch (e) {
			tuneInError = e instanceof Error ? e.message : String(e);
		} finally {
			tuneInSearchBusy = false;
		}
	}

	function isTuneInFavorite(url: string): boolean {
		return tuneInFavorites.some((f) => f.url === url);
	}

	function addTuneInFavorite(item: TuneInItem) {
		if (isTuneInFavorite(item.url)) return;
		const fav: TuneInFavorite = {
			...item,
			id: `tin_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
		};
		tuneInFavorites = [...tuneInFavorites, fav];
		saveTuneInFavs(tuneInFavorites);
	}

	function removeTuneInFavorite(id: string) {
		tuneInFavorites = tuneInFavorites.filter((f) => f.id !== id);
		saveTuneInFavs(tuneInFavorites);
	}

	function openCustomRadioDialog() {
		customRadioName = '';
		customRadioUrl = '';
		customRadioOpen = true;
	}

	function saveCustomRadio() {
		const name = customRadioName.trim();
		const url = customRadioUrl.trim();
		if (!name || !url) return;
		const fav: TuneInFavorite = {
			id: `cust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
			text: name,
			url,
			image: '',
			subtext: 'Eigen stream'
		};
		tuneInFavorites = [...tuneInFavorites, fav];
		saveTuneInFavs(tuneInFavorites);
		customRadioOpen = false;
	}

	async function playTuneInItem(item: TuneInItem) {
		try {
			tuneInError = '';
			let streamUrl = item.url;
			// TuneIn's Tune.ashx en .pls/.m3u eerst resolven naar een directe stream
			if (/Tune\.ashx|\.pls(\?|$)|\.m3u(\?|$)/i.test(item.url)) {
				const resp = await fetch(ingressPath(`/api/tunein/resolve?url=${encodeURIComponent(item.url)}`));
				if (resp.ok) {
					const data = await resp.json();
					if (data?.streamUrl) streamUrl = data.streamUrl;
				}
			}

			const allKnown = allEntities.length > 0 ? allEntities : entities;

			// === MA-target: zowel Hubs als virtuele Onkyo-zone-targets ===
			if (tuneInPlaybackTarget.startsWith('ma:')) {
				const payload = tuneInPlaybackTarget.slice('ma:'.length);
				const [baseEntityId, maEntityId] = payload.split('|');
				if (!baseEntityId || !maEntityId) {
					tuneInError = _t('Geen geldige MA-speler geselecteerd.');
					return;
				}

				// Vind de matching target uit onze derived (bevat zone-instructies voor Onkyo)
				const target = maRadioHubs.find((h) => h.baseEntityId === baseEntityId && h.maEntityId === maEntityId);
				if (!target) {
					tuneInError = _t('Geselecteerde speler niet meer beschikbaar.');
					return;
				}

				const isOnkyoTarget = target.forceOnZones.length > 0;
				const baseEntity = allKnown.find((e) => e.entityId === baseEntityId);

				if (isOnkyoTarget) {
					// Voor Onkyo: pauzeer Spotify-sessie eerst zodat NET-input vrij is
					try {
						const onkyoDevice = spotifyDevices.find((d) => /onkyo|tx[-_ ]?nr/i.test(d.name));
						if (onkyoDevice && (spotifyPlayerState.isPlaying || spotifyPlayerState.device?.id === onkyoDevice.id)) {
							await spJson('/api/spotify/control', {
								method: 'POST',
								headers: { 'content-type': 'application/json' },
								body: JSON.stringify({ action: 'pause', deviceId: onkyoDevice.id })
							});
							await new Promise((r) => setTimeout(r, 400));
						}
					} catch { /* niet fataal */ }
				}

				// Voor Hubs: baseline-entity aan zetten (Cast wakker schoppen)
				if (!isOnkyoTarget && baseEntity && !isOn(baseEntity)) {
					await callService('media_player', 'turn_on', baseEntity.entityId);
					await new Promise((r) => setTimeout(r, 800));
				}

				// MA play_media — start de stream
				await callService('music_assistant', 'play_media', maEntityId, {
					media_type: 'radio',
					media_id: streamUrl
				});

				// Onkyo zone-correctie: MA heeft de hoofdzone geforceerd. We zetten eerst
				// de gewenste zone aan (zodat het apparaat ergens audio uitstuurt), en pas
				// daarna de andere zones uit. Volgorde lijkt ertoe te doen op de Onkyo —
				// uitzetten als de doelzone al aan staat houdt het apparaat niet in standby.
				if (isOnkyoTarget) {
					await new Promise((r) => setTimeout(r, 1500));
					// Eerst de doelzone aan
					for (const onZone of target.forceOnZones) {
						await callService('media_player', 'turn_on', onZone);
					}
					await new Promise((r) => setTimeout(r, 600));
					// Dan de andere zones uit
					for (const offZone of target.forceOffZones) {
						await callService('media_player', 'turn_off', offZone);
					}
				}

				setActivePlayer(baseEntityId);
				// Onthoud het radio-station-logo voor de Now Playing-balk (MA zet vaak geen
				// entity_picture voor radio-streams, dus we gebruiken het favoriet-logo als fallback)
				if (item.image || item.name) {
					radioImageByBase = {
						...radioImageByBase,
						[baseEntityId]: { image: item.image ?? '', name: item.name ?? '' }
					};
				}
				return;
			}

			// === Geen target gekozen ===
			tuneInError = _t('Kies eerst een speler hierboven.');
		} catch (e) {
			tuneInError = e instanceof Error ? e.message : String(e);
		}
	}

	// Format helper
	function formatMs(ms: number): string {
		if (!Number.isFinite(ms) || ms <= 0) return '0:00';
		const total = Math.floor(ms / 1000);
		const m = Math.floor(total / 60);
		const s = total % 60;
		return `${m}:${s.toString().padStart(2, '0')}`;
	}
</script>

<div class="media-hub">
	<!-- =============== NOW PLAYING ============== -->
	<section class="hub-now">
		{#if activeEntity}
			{@const activeBridge = onkyoBridges.find((b) => b.zoneEntityId === activeEntity.entityId) ?? null}
			{@const useBridge = activeBridge !== null && Boolean(spotifyPlayerState.track)}
			{@const radioMaTargetMatchesActive = tuneInPlaybackTarget.startsWith('ma:')
				&& tuneInPlaybackTarget.slice('ma:'.length).split('|')[0] === activeEntity.entityId}
			{@const spotifyMaTargetMatchesActive = spotifyPlaybackTarget.startsWith('ma:')
				&& spotifyPlaybackTarget.slice('ma:'.length).split('|')[0] === activeEntity.entityId}
			{@const useMaHub = !useBridge && (radioMaTargetMatchesActive || spotifyMaTargetMatchesActive)}
			{@const mediaEntity = useBridge ? activeEntity : richestEntityFor(activeEntity)}
			{@const maAttrs = (mediaEntity.attributes as Record<string, unknown> | undefined) ?? {}}
			{@const maContentType = useMaHub ? String(maAttrs.media_content_type ?? '').toLowerCase() : ''}
			{@const maHasArtist = Boolean(maAttrs.media_artist)}
			{@const maHasAlbum = Boolean(maAttrs.media_album_name)}
			{@const maContentId = String(maAttrs.media_content_id ?? '')}
			{@const maIsRadio = useMaHub && (
				maContentType === 'radio'
				|| /^builtin:\/\/radio\//i.test(maContentId)
				|| /^https?:\/\//i.test(maContentId)
			)}
			{@const maShuffle = useMaHub ? Boolean(maAttrs.shuffle) : false}
			{@const maRepeatMode = useMaHub ? String(maAttrs.repeat ?? 'off') : 'off'}
			{@const rawCover = useBridge ? (spotifyPlayerState.track?.image ?? '') : (readMediaImage(mediaEntity) || (maIsRadio ? (radioImageByBase[activeEntity.entityId]?.image ?? '') : ''))}
			{@const cover = displayImageUrl(rawCover)}
			{@const title = useBridge ? (spotifyPlayerState.track?.name ?? '') : (readMediaTitle(mediaEntity) || (maIsRadio ? (radioImageByBase[activeEntity.entityId]?.name ?? '') : ''))}
			{@const artist = useBridge ? (spotifyPlayerState.track?.artists ?? '') : readMediaArtist(mediaEntity)}
			{@const sources = readSources(activeEntity)}
			{@const currentSource = readCurrentSource(activeEntity)}
			{@const playing = useBridge ? Boolean(spotifyPlayerState.isPlaying) : isPlaying(activeEntity)}
			{@const on = isOn(activeEntity)}
			{@const muted = readMuted(activeEntity)}
			{@const vol = volumeDraft !== null ? volumeDraft : readVolume(activeEntity)}
			{@const mediaPos = typeof maAttrs.media_position === 'number' ? (maAttrs.media_position as number) : null}
			{@const mediaDur = typeof maAttrs.media_duration === 'number' ? (maAttrs.media_duration as number) : null}
			{@const progressPct = (mediaPos !== null && mediaDur && mediaDur > 0) ? Math.min(100, (mediaPos / mediaDur) * 100) : null}
			{@const fmtTime = (s: number) => {
				const m = Math.floor(s / 60);
				const sec = Math.floor(s % 60);
				return `${m}:${sec.toString().padStart(2, '0')}`;
			}}

			<!-- Blurred cover background fills the hero -->
			{#if cover}
				<div class="now-bg" style="background-image: url({cover});" aria-hidden="true"></div>
				<div class="now-bg-overlay" aria-hidden="true"></div>
			{:else}
				<div class="now-bg-fallback" aria-hidden="true"></div>
			{/if}

			<div class="now-hero-content">
				<!-- Cover with subtle rotate when playing -->
				<div class={`now-cover ${playing ? 'spinning' : ''}`}>
					{#if cover}
						<img src={cover} alt="" onerror={() => markDisplayImageFailed(cover)} />
					{:else}
						<div class="now-cover-empty"><StatusIcon icon="mdi:music-note" size={56} /></div>
					{/if}
					{#if playing}
						<div class="now-playing-pulse" aria-hidden="true"></div>
					{/if}
				</div>

				<div class="now-meta">
					<div class="now-device">
						<StatusIcon icon="mdi:speaker" size={11} />
						<span>{getNowPlayingDeviceLabel(activeEntity.entityId, activeEntity.friendlyName ?? activeEntity.entityId)}</span>
					</div>
					<div class="now-title">{title || (on ? 'Niet aan het spelen' : 'Uit')}</div>
					<div class="now-artist">{artist || (currentSource ? `Bron: ${currentSource}` : '')}</div>

					<!-- Progress bar -->
					{#if progressPct !== null}
						<div class="now-progress">
							<div class="now-progress-track">
								<div class="now-progress-fill" style="width: {progressPct}%;"></div>
							</div>
							<div class="now-progress-times">
								<span>{fmtTime(mediaPos ?? 0)}</span>
								<span>{fmtTime(mediaDur ?? 0)}</span>
							</div>
						</div>
					{/if}

					<div class="now-controls">
						{#if useBridge}
							<button type="button" class="now-btn-small" class:on={spotifyPlayerState.shuffle} onclick={() => void spotifyControl('shuffle', { enabled: !spotifyPlayerState.shuffle })} aria-label="Shuffle">
								<StatusIcon icon="mdi:shuffle" size={16} />
							</button>
						{:else if useMaHub && !maIsRadio}
							<button type="button" class="now-btn-small" class:on={maShuffle} onclick={() => void spotifyControl('shuffle', { enabled: !maShuffle })} aria-label="Shuffle">
								<StatusIcon icon="mdi:shuffle" size={16} />
							</button>
						{/if}
						{#if !(useMaHub && maIsRadio)}
							<button type="button" class="now-btn" disabled={!on || actionBusyEntityId === activeEntity.entityId} onclick={() => (useBridge || useMaHub) ? void spotifyControl('previous') : void prevTrack(activeEntity)} aria-label="Vorige">
								<StatusIcon icon="mdi:skip-previous" size={26} />
							</button>
						{/if}
						<button type="button" class="now-btn now-btn-play" disabled={actionBusyEntityId === activeEntity.entityId} onclick={() => {
							if (useBridge || (useMaHub && spotifyMaTargetMatchesActive)) {
								void spotifyControl(playing ? 'pause' : 'play');
							} else {
								void togglePlayPause(activeEntity);
							}
						}} aria-label={playing ? 'Pauzeren' : 'Afspelen'}>
							<StatusIcon icon={!on ? 'mdi:power' : playing ? 'mdi:pause' : 'mdi:play'} size={32} />
						</button>
						{#if !(useMaHub && maIsRadio)}
							<button type="button" class="now-btn" disabled={!on || actionBusyEntityId === activeEntity.entityId} onclick={() => (useBridge || useMaHub) ? void spotifyControl('next') : void nextTrack(activeEntity)} aria-label="Volgende">
								<StatusIcon icon="mdi:skip-next" size={26} />
							</button>
						{/if}
						{#if useBridge}
							<button type="button" class="now-btn-small" class:on={spotifyPlayerState.repeat !== 'off'} onclick={() => {
								const nextMode = spotifyPlayerState.repeat === 'off' ? 'context' : spotifyPlayerState.repeat === 'context' ? 'track' : 'off';
								void spotifyControl('repeat', { mode: nextMode });
							}} aria-label="Repeat">
								<StatusIcon icon={spotifyPlayerState.repeat === 'track' ? 'mdi:repeat-once' : 'mdi:repeat'} size={16} />
							</button>
							<button type="button" class="now-btn-small" onclick={() => { spotifyQueueOpen = !spotifyQueueOpen; if (spotifyQueueOpen) void loadSpotifyQueue(); }} aria-label="Wachtrij">
								<StatusIcon icon="mdi:playlist-music" size={16} />
							</button>
						{:else if useMaHub && !maIsRadio}
							<button type="button" class="now-btn-small" class:on={maRepeatMode !== 'off'} onclick={() => {
								const nextMode = maRepeatMode === 'off' ? 'all' : maRepeatMode === 'all' ? 'one' : 'off';
								void spotifyControl('repeat', { mode: nextMode });
							}} aria-label="Repeat">
								<StatusIcon icon={maRepeatMode === 'one' ? 'mdi:repeat-once' : 'mdi:repeat'} size={16} />
							</button>
						{/if}
						<button type="button" class={`now-btn ${on ? 'now-btn-on' : ''}`} disabled={actionBusyEntityId === activeEntity.entityId} onclick={() => void togglePower(activeEntity)} aria-label="Aan/uit">
							<StatusIcon icon="mdi:power" size={22} />
						</button>
					</div>
					{#if useBridge && spotifyQueueOpen}
						<div class="sp-queue">
							<div class="sp-queue-title">In de wachtrij ({spotifyQueue.length})</div>
							{#if spotifyQueue.length === 0}
								<div class="sp-queue-empty">Wachtrij is leeg</div>
							{:else}
								{#each spotifyQueue as q, i (q.uri + i)}
									<div class="sp-queue-item">
										{#if q.image}<img src={q.image} alt="" />{/if}
										<div class="sp-queue-meta">
											<div class="sp-queue-name">{q.name}</div>
											<div class="sp-queue-artist">{q.subtitle}</div>
										</div>
									</div>
								{/each}
							{/if}
						</div>
					{/if}

					<div class="now-volume">
						<button type="button" class="vol-mute" disabled={!on} onclick={() => void toggleMute(activeEntity)} aria-label="Mute">
							<StatusIcon icon={muted || vol <= 0.005 ? 'mdi:volume-off' : vol < 0.34 ? 'mdi:volume-low' : vol < 0.67 ? 'mdi:volume-medium' : 'mdi:volume-high'} size={20} />
						</button>
						<input
							class="vol-slider"
							type="range" min="0" max="1" step="0.01" value={vol} disabled={!on}
							style={`--vol-pct: ${Math.round(vol * 100)}%;`}
							oninput={(e) => onVolumeInput(Number((e.currentTarget as HTMLInputElement).value), activeEntity)}
						/>
						<span class="vol-pct">{Math.round(vol * 100)}%</span>
					</div>

					{#if sources.length > 0}
						<div class="now-source">
							<button type="button" class="source-trigger" onclick={() => (sourcePickerOpen = !sourcePickerOpen)}>
								<StatusIcon icon="mdi:audio-input-rca" size={16} />
								<span>{currentSource || 'Bron kiezen'}</span>
								<StatusIcon icon={sourcePickerOpen ? 'mdi:chevron-up' : 'mdi:chevron-down'} size={16} />
							</button>
							{#if sourcePickerOpen}
								<div class="source-popover">
									{#each sources as source (source)}
										<button type="button" class="source-option" class:active={source === currentSource} onclick={() => void selectSource(activeEntity, source)}>{source}</button>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{:else}
			<div class="now-empty">
				<div class="now-empty-icon"><StatusIcon icon="mdi:speaker-off" size={48} /></div>
				<div class="now-empty-text">{_t('Kies een speler in het tabblad Spelers')}</div>
			</div>
		{/if}
	</section>

	<!-- =============== SECTION TABS =============== -->
	<div class="section-tabs" role="tablist">
		<button type="button" role="tab" class:active={activeSection === 'players'} onclick={() => (activeSection = 'players')}>
			<StatusIcon icon="mdi:speaker-multiple" size={16} /> {_t('Spelers')}
		</button>
		{#if spotifyConfigured}
			<button type="button" role="tab" class:active={activeSection === 'spotify'} onclick={() => (activeSection = 'spotify')}>
				<StatusIcon icon="mdi:spotify" size={16} /> Spotify
			</button>
		{/if}
		<button type="button" role="tab" class:active={activeSection === 'tunein'} onclick={() => (activeSection = 'tunein')}>
			<StatusIcon icon="mdi:radio" size={16} /> Radio
		</button>
	</div>

	<!-- =============== SPOTIFY SECTION =============== -->
	{#if activeSection === 'spotify' && spotifyConfigured}
		<section class="hub-block spotify-block">
			{#if !spotifyConnected}
				<div class="block-empty">
					<p>{_t('Verbind Novapanel met je Spotify-account om afspeellijsten en zoekresultaten te zien.')}</p>
					<button type="button" class="spotify-connect-btn" onclick={spotifyConnectStart} disabled={spotifyAuthInProgress}>
						{spotifyAuthInProgress ? _t('Bezig met verbinden…') : _t('Verbinden met Spotify')}
					</button>
					{#if spotifyAuthInProgress}
						<p class="block-hint">{_t('Voltooi de Spotify-koppeling in het nieuwe tabblad. Deze pagina pikt het automatisch op.')}</p>
					{/if}
				</div>
			{:else}
				<!-- Verenigd speelapparaat: alleen Onkyo zones (Cast verwijderd want niet betrouwbaar
				     te realiseren zonder externe HA-integratie) -->
				<div class="spotify-row">
					<select class="spotify-target" value={spotifyPlaybackTarget} onchange={(e) => setSpotifyPlaybackTarget((e.currentTarget as HTMLSelectElement).value)}>
						<option value="">{_t('Kies speelapparaat…')}</option>
						{#if onkyoBridges.length > 0}
							<optgroup label="Onkyo zones">
								{#each onkyoBridges as b (b.id)}
									<option value={`bridge:${b.id}`}>{b.label}</option>
								{/each}
							</optgroup>
						{/if}
						{#if maHubsForSpotify.length > 0}
							<optgroup label="Speakers (Music Assistant)">
								{#each maHubsForSpotify as hub (hub.baseEntityId)}
									<option value={`ma:${hub.baseEntityId}|${hub.maEntityId}`}>{hub.label}</option>
								{/each}
							</optgroup>
						{/if}
					</select>
					<button type="button" class="sp-btn" onclick={() => (bridgeManagerOpen = !bridgeManagerOpen)} aria-label="Onkyo zones beheren" title="Onkyo zones beheren">
						<StatusIcon icon="mdi:tune-variant" size={16} />
					</button>
					<button type="button" class="sp-btn" onclick={() => { void loadSpotifyDevices(); }} aria-label="Lijst vernieuwen" title="Lijst vernieuwen">
						<StatusIcon icon="mdi:refresh" size={16} />
					</button>
				</div>

				{#if bridgeManagerOpen}
					<div class="bridge-manager">
						<div class="bridge-manager-title">Onkyo zones</div>
						{#if onkyoBridges.length === 0}
							<div class="bridge-empty">{_t('Nog geen zones. Voeg er hieronder een toe.')}</div>
						{:else}
							{#each onkyoBridges as b (b.id)}
								<div class="bridge-row">
									{#if bridgeRenamingId === b.id}
										<input
											class="bridge-rename"
											type="text"
											value={bridgeRenameDraft}
											oninput={(e) => (bridgeRenameDraft = (e.currentTarget as HTMLInputElement).value)}
											onkeydown={(e) => {
												if (e.key === 'Enter') { e.preventDefault(); commitBridgeRename(); }
												if (e.key === 'Escape') { e.preventDefault(); cancelBridgeRename(); }
											}}
										/>
										<button type="button" class="bridge-btn ok" onclick={commitBridgeRename} aria-label={_t('save')}><StatusIcon icon="mdi:check" size={14} /></button>
										<button type="button" class="bridge-btn" onclick={cancelBridgeRename} aria-label={_t('cancel')}><StatusIcon icon="mdi:close" size={14} /></button>
									{:else}
										<div class="bridge-info">
											<div class="bridge-label">{b.label}</div>
											<div class="bridge-sub">→ {b.zoneEntityId}</div>
										</div>
										<button type="button" class="bridge-btn ghost" onclick={() => startBridgeRename(b.id)} aria-label={_t('Hernoemen')} title={_t('Hernoemen')}><StatusIcon icon="mdi:pencil-outline" size={14} /></button>
										<button type="button" class="bridge-btn ghost" onclick={() => removeBridge(b.id)} aria-label={_t('Verwijderen')} title={_t('Verwijderen')}><StatusIcon icon="mdi:trash-can-outline" size={14} /></button>
									{/if}
								</div>
							{/each}
						{/if}
						{#if onkyoBridgeAddCandidates.length > 0}
							<div class="bridge-add-row">
								<select class="bridge-add-select" bind:value={bridgeAddCandidate}>
									<option value="">{_t('+ Zone toevoegen…')}</option>
									{#each onkyoBridgeAddCandidates as e (e.entityId)}
										<option value={e.entityId}>{e.friendlyName ?? e.entityId}</option>
									{/each}
								</select>
								<button type="button" class="bridge-btn ok" disabled={!bridgeAddCandidate} onclick={() => {
									const ent = sortedEntities.find((s) => s.entityId === bridgeAddCandidate);
									if (ent) {
										const label = ent.friendlyName ?? ent.entityId;
										addBridge(label, ent.entityId);
									}
									bridgeAddCandidate = '';
								}}>{_t('Toevoegen')}</button>
							</div>
						{/if}
					</div>
				{/if}

				<!-- Search -->
				<div class="sp-search-row">
					<div class="sp-search-input-wrap">
						<input
							class="sp-search-input"
							type="search"
							placeholder="Zoek nummer, artiest, album, afspeellijst…"
							value={spotifySearchQuery}
							oninput={(e) => {
								spotifySearchQuery = (e.currentTarget as HTMLInputElement).value;
								if (spotifySearchQuery.trim() === '') spotifySearchResults = [];
							}}
							onkeydown={(e) => { if (e.key === 'Enter') void spotifySearch(); }}
						/>
						{#if spotifySearchQuery || spotifySearchResults.length > 0}
							<button type="button" class="sp-search-clear" onclick={() => { spotifySearchQuery = ''; spotifySearchResults = []; }} aria-label="Zoekopdracht wissen" title="Wissen">
								<StatusIcon icon="mdi:close" size={14} />
							</button>
						{/if}
					</div>
					<button type="button" class="sp-btn sp-btn-search" onclick={() => void spotifySearch()} disabled={spotifySearchBusy}>
						<StatusIcon icon="mdi:magnify" size={18} />
					</button>
				</div>
				{#if spotifySearchResults.length > 0}
					<div class="sp-section-header sp-section-header-row">
						<span>Zoekresultaten</span>
						<button type="button" class="sp-section-close" onclick={() => { spotifySearchResults = []; spotifySearchQuery = ''; }} aria-label="Resultaten sluiten" title="Resultaten sluiten">
							<StatusIcon icon="mdi:close" size={14} />
						</button>
					</div>
					<div class="sp-grid">
						{#each spotifySearchResults as r (r.uri)}
							<div class="sp-art-tile">
								<button type="button" class="sp-art-cover" onclick={() => void spotifyPlayUri(r.uri)} aria-label={`Afspelen: ${r.name}`}>
									{#if r.image}
										<img src={r.image} alt="" />
									{:else}
										<div class="sp-art-empty"><StatusIcon icon={r.kind === 'track' ? 'mdi:music' : r.kind === 'album' ? 'mdi:album' : 'mdi:music-circle'} size={36} /></div>
									{/if}
									<div class="sp-art-overlay">
										<div class="sp-art-play"><StatusIcon icon="mdi:play" size={22} /></div>
									</div>
									{#if r.kind}
										<div class="sp-art-badge">{r.kind === 'track' ? 'Nummer' : r.kind === 'album' ? 'Album' : r.kind === 'artist' ? 'Artiest' : r.kind === 'playlist' ? 'Lijst' : r.kind}</div>
									{/if}
								</button>
								<div class="sp-art-meta">
									<div class="sp-art-name" title={r.name}>{r.name}</div>
									<div class="sp-art-sub" title={r.subtitle}>{r.subtitle}</div>
								</div>
								{#if r.kind === 'track'}
									<button type="button" class="sp-art-queue" title="Aan wachtrij toevoegen" onclick={() => void spotifyAddToQueue(r.uri)}>
										<StatusIcon icon="mdi:playlist-plus" size={14} />
									</button>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				<!-- Playlists -->
				{#if spotifyPlaylists.length > 0}
					<div class="sp-section-header">Mijn afspeellijsten</div>
					<div class="sp-grid">
						{#each spotifyPlaylists as p (p.uri)}
							<div class="sp-art-tile">
								<button type="button" class="sp-art-cover" onclick={() => void spotifyPlayUri(p.uri)} aria-label={`Afspelen: ${p.name}`}>
									{#if p.image}
										<img src={p.image} alt="" />
									{:else}
										<div class="sp-art-empty"><StatusIcon icon="mdi:playlist-music" size={36} /></div>
									{/if}
									<div class="sp-art-overlay">
										<div class="sp-art-play"><StatusIcon icon="mdi:play" size={22} /></div>
									</div>
								</button>
								<div class="sp-art-meta">
									<div class="sp-art-name" title={p.name}>{p.name}</div>
									<div class="sp-art-sub" title={p.subtitle}>{p.subtitle}</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if spotifyError}
					<div class="sp-error">
						<StatusIcon icon="mdi:information-outline" size={16} />
						<span>{spotifyError}</span>
						<button type="button" class="sp-error-close" onclick={() => (spotifyError = '')} aria-label={_t('close')}>
							<StatusIcon icon="mdi:close" size={14} />
						</button>
					</div>
				{/if}
			{/if}
		</section>
	{/if}

	<!-- =============== TUNEIN SECTION =============== -->
	{#if activeSection === 'tunein'}
		<section class="hub-block">
			<header class="block-head">
				<StatusIcon icon="mdi:radio" size={18} />
				<span>{_t('Radio favorieten')}</span>
				<button type="button" class="block-add" onclick={() => (tuneInShowSearch = !tuneInShowSearch)} aria-label={_t('Zoeken')} title={_t('Stations zoeken')}>
					<StatusIcon icon={tuneInShowSearch ? 'mdi:close' : 'mdi:magnify'} size={14} />
				</button>
				<button type="button" class="block-add" onclick={openCustomRadioDialog} aria-label={_t('Eigen URL')} title={_t('Eigen stream-URL toevoegen')}>
					<StatusIcon icon="mdi:link-plus" size={14} />
				</button>
			</header>

			{#if maAvailable}
				<div class="spotify-row">
					<select class="spotify-target" value={tuneInPlaybackTarget} onchange={(e) => setTuneInPlaybackTarget((e.currentTarget as HTMLSelectElement).value)}>
						<option value="">{_t('Kies speelapparaat…')}</option>
						<optgroup label="Speakers (Music Assistant)">
							{#each maRadioHubs as hub (hub.baseEntityId)}
								<option value={`ma:${hub.baseEntityId}|${hub.maEntityId}`}>{hub.label}</option>
							{/each}
						</optgroup>
					</select>
				</div>
			{/if}

			{#if tuneInShowSearch}
				<div class="tin-search-row">
					<input
						class="tin-search-input"
						type="search"
						placeholder="Zoek een radiostation, bijv. NPO Radio 1, BBC, Sky Radio…"
						value={tuneInSearchQuery}
						oninput={(e) => (tuneInSearchQuery = (e.currentTarget as HTMLInputElement).value)}
						onkeydown={(e) => { if (e.key === 'Enter') void searchTuneIn(); }}
					/>
					<button type="button" class="tin-search-btn" onclick={() => void searchTuneIn()} disabled={tuneInSearchBusy}>
						<StatusIcon icon="mdi:magnify" size={18} />
					</button>
				</div>
				{#if tuneInError}
					<div class="block-empty error">{tuneInError}</div>
				{/if}
				{#if tuneInSearchBusy}
					<div class="block-empty">Zoeken…</div>
				{:else if tuneInSearchResults.length > 0}
					<div class="tin-results">
						{#each tuneInSearchResults as r (r.url)}
							<div class="tin-result">
								{#if r.image}
									<img class="tin-result-img" src={r.image} alt="" />
								{:else}
									<div class="tin-result-img empty"><StatusIcon icon="mdi:radio" size={20} /></div>
								{/if}
								<div class="tin-result-info">
									<div class="tin-result-name">{r.text}</div>
									{#if r.subtext}<div class="tin-result-sub">{r.subtext}</div>{/if}
								</div>
								<div class="tin-result-actions">
									<button type="button" class="tin-mini-btn" title="Nu afspelen" onclick={() => void playTuneInItem(r)}>
										<StatusIcon icon="mdi:play" size={14} />
									</button>
									{#if isTuneInFavorite(r.url)}
										<span class="tin-saved" title="Al in favorieten"><StatusIcon icon="mdi:star" size={14} /></span>
									{:else}
										<button type="button" class="tin-mini-btn" title={_t('Aan favorieten toevoegen')} onclick={() => addTuneInFavorite(r)}>
											<StatusIcon icon="mdi:star-plus" size={14} />
										</button>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}

			{#if tuneInFavorites.length === 0}
				<div class="block-empty">
					{_t('Nog geen favorieten. Klik op het zoek-icon hierboven om stations te zoeken via TuneIn, of op het link-icon om je eigen stream-URL toe te voegen.')}
				</div>
			{:else}
				<div class="sp-grid">
					{#each tuneInFavorites as fav (fav.id)}
						<div class="sp-art-tile">
							<button type="button" class="sp-art-cover" onclick={() => void playTuneInItem(fav)} aria-label={`Afspelen: ${fav.text}`}>
								{#if fav.image}
									<img src={fav.image} alt="" />
								{:else}
									<div class="sp-art-empty radio"><StatusIcon icon="mdi:radio-tower" size={36} /></div>
								{/if}
								<div class="sp-art-overlay">
									<div class="sp-art-play"><StatusIcon icon="mdi:play" size={22} /></div>
								</div>
								<div class="sp-art-badge radio-badge">RADIO</div>
							</button>
							<div class="sp-art-meta">
								<div class="sp-art-name" title={fav.text}>{fav.text}</div>
							</div>
							<button type="button" class="sp-art-remove" onclick={() => removeTuneInFavorite(fav.id)} aria-label={_t('Verwijderen')} title={_t('Verwijderen uit favorieten')}>
								<StatusIcon icon="mdi:close" size={12} />
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}

	<!-- =============== PLAYERS SECTION =============== -->
	{#if activeSection === 'players'}
		<section class="hub-block">
			<header class="block-head">
				<StatusIcon icon="mdi:speaker-multiple" size={18} />
				<span>{_t('Spelers')}</span>
			</header>
			<div class="players-grid">
				{#each sortedEntities as entity (entity.entityId)}
					{@const on = isOn(entity)}
					{@const isActive = entity.entityId === activePlayerId}
					{@const isDragging = dragSourceEntityId === entity.entityId}
					{@const isDragTarget = dragOverEntityId === entity.entityId}
					{@const isOnkyoZone = onkyoBridges.some((b) => b.zoneEntityId === entity.entityId)}
					{@const usesSpotifyState = isOnkyoZone && spotifyPlayerState.track && Boolean(spotifyPlayerState.device)
						&& /onkyo|tx[-_ ]?nr/i.test(spotifyPlayerState.device?.name ?? '')}
					{@const mediaEntity = usesSpotifyState ? entity : richestEntityFor(entity)}
					{@const playing = usesSpotifyState ? Boolean(spotifyPlayerState.isPlaying) : isPlaying(entity)}
					{@const rawBaseCover = usesSpotifyState ? (spotifyPlayerState.track?.image ?? '') : readMediaImage(mediaEntity)}
					{@const baseCover = displayImageUrl(rawBaseCover)}
					{@const appLogo = baseCover ? '' : (on ? readAppLogo(entity) : '')}
					{@const cover = baseCover || appLogo}
					{@const isLogoCover = !baseCover && Boolean(appLogo)}
					{@const baseSummary = !on
						? { primary: '', secondary: '' }
						: usesSpotifyState
							? { primary: spotifyPlayerState.track?.name ?? '', secondary: spotifyPlayerState.track?.artists ?? '' }
							: readNowPlayingSummary(mediaEntity)}
					{@const appName = (entity.attributes?.app_name as string | undefined) ?? ''}
					{@const nowPlaying = (!baseSummary.primary && !baseSummary.secondary && on && appName)
						? { primary: appName, secondary: _t('Actief') }
						: baseSummary}
					<div
						class={`player-tile ${isActive ? 'active' : ''} ${!on ? 'off' : ''} ${isDragging ? 'dragging' : ''} ${isDragTarget ? 'drag-target' : ''} ${playing ? 'playing' : ''}`}
						role="group"
						ondragover={(e) => handleDragOver(e, entity.entityId)}
						ondragleave={() => handleDragLeave(entity.entityId)}
						ondrop={(e) => handleDrop(e, entity.entityId)}
					>
						<!-- Blurred cover background for ambient color -->
						{#if cover && !isLogoCover}
							<div class="player-tile-bg" style="background-image: url({cover});" aria-hidden="true"></div>
							<div class="player-tile-bg-overlay" aria-hidden="true"></div>
						{:else}
							<div class="player-tile-bg-fallback" aria-hidden="true"></div>
						{/if}

						<!-- Cover art on the left, prominent -->
						<button type="button" class="player-tile-pick" onclick={() => setActivePlayer(entity.entityId)}>
							<div class="player-tile-cover">
								{#if cover}
									<img src={cover} alt="" class={isLogoCover ? 'is-logo' : ''} onerror={() => markDisplayImageFailed(cover)} />
								{:else}
									<div class="player-tile-cover-empty">
										<StatusIcon icon="mdi:music-note" size={32} />
									</div>
								{/if}
								{#if playing}
									<div class="player-tile-eq" aria-hidden="true">
										<span></span><span></span><span></span><span></span>
									</div>
								{/if}
							</div>
							<div class="player-tile-info">
								<div class="player-tile-name">
									{#if isActive}<span class="player-tile-active-dot" aria-hidden="true"></span>{/if}
									{getPlayerName(entity.entityId, entity.friendlyName ?? entity.entityId)}
								</div>
								{#if on && nowPlaying.primary}
									<div class="player-tile-now">
										<div class="player-tile-now-primary">{nowPlaying.primary}</div>
										{#if nowPlaying.secondary}<div class="player-tile-now-secondary">{nowPlaying.secondary}</div>{/if}
									</div>
								{:else if on}
									<div class="player-tile-status on">{readCurrentSource(entity) || _t('Aan')}</div>
								{:else}
									<div class="player-tile-status off">{_t('Uit')}</div>
								{/if}
							</div>
						</button>

						<!-- Quick controls — visible on hover or active -->
						<div class="player-tile-controls">
							<button type="button" class="ptile-btn" disabled={!on || actionBusyEntityId === entity.entityId} onclick={(__e) => { __e.stopPropagation(); (() => void prevTrack(entity))(__e); }} aria-label={_t('Vorige')}><StatusIcon icon="mdi:skip-previous" size={18} /></button>
							<button type="button" class="ptile-btn ptile-btn-play" disabled={actionBusyEntityId === entity.entityId} onclick={(__e) => { __e.stopPropagation(); (() => void togglePlayPause(entity))(__e); }} aria-label={playing ? _t('Pauzeren') : _t('Afspelen')}><StatusIcon icon={!on ? 'mdi:power' : playing ? 'mdi:pause' : 'mdi:play'} size={20} /></button>
							<button type="button" class="ptile-btn" disabled={!on || actionBusyEntityId === entity.entityId} onclick={(__e) => { __e.stopPropagation(); (() => void nextTrack(entity))(__e); }} aria-label={_t('Volgende')}><StatusIcon icon="mdi:skip-next" size={18} /></button>
							<button type="button" class={`ptile-btn small ${on ? 'on' : ''}`} disabled={actionBusyEntityId === entity.entityId} onclick={(__e) => { __e.stopPropagation(); (() => void togglePower(entity))(__e); }} aria-label={_t('Aan/uit')}><StatusIcon icon="mdi:power" size={14} /></button>
							<button
								type="button"
								class="ptile-drag"
								aria-label={_t('Verslepen om te herordenen')}
								title={_t('Sleep om volgorde te wijzigen')}
								draggable="true"
								ondragstart={(e) => handleDragStart(e, entity.entityId)}
								ondragend={handleDragEnd}
								onclick={(__e) => __e.stopPropagation()}
							>
								<StatusIcon icon="mdi:drag-horizontal-variant" size={14} />
							</button>
						</div>
					</div>
				{/each}
			</div>
		</section>
	{/if}
</div>

<!-- =============== CUSTOM RADIO DIALOG =============== -->
{#if customRadioOpen}
	<button type="button" class="np-modal-overlay" onclick={() => (customRadioOpen = false)} aria-label={_t('close')}></button>
	<div class="np-modal" role="dialog" aria-modal="true">
		<h3>{_t('Eigen stream-URL toevoegen')}</h3>
		<label class="np-field">
			<span>{_t('Naam')}</span>
			<input type="text" value={customRadioName} oninput={(e) => (customRadioName = (e.currentTarget as HTMLInputElement).value)} placeholder="Bijv. NPO Radio 1" />
		</label>
		<label class="np-field">
			<span>{_t('Stream-URL')}</span>
			<input type="url" value={customRadioUrl} oninput={(e) => (customRadioUrl = (e.currentTarget as HTMLInputElement).value)} placeholder="https://icecast.omroep.nl/radio1-bb-mp3" />
		</label>
		<div class="np-modal-actions">
			<button type="button" class="np-btn-secondary" onclick={() => (customRadioOpen = false)}>{_t('cancel')}</button>
			<button type="button" class="np-btn-primary" onclick={saveCustomRadio} disabled={!customRadioName.trim() || !customRadioUrl.trim()}>{_t('save')}</button>
		</div>
	</div>
{/if}

<svelte:window onclick={(e) => {
	if (!sourcePickerOpen) return;
	const target = e.target as HTMLElement | null;
	if (target && (target.closest('.source-popover') || target.closest('.source-trigger'))) return;
	sourcePickerOpen = false;
}} />

<style>
	.media-hub { display: flex; flex-direction: column; gap: 12px; padding: 0.4rem 0.1rem; min-width: 0; }

	/* ============================================
	 * NOW PLAYING — premium hero with blurred album-art background
	 * ============================================ */
	.hub-now {
		position: relative;
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 18px;
		min-height: 240px;
		overflow: hidden;
		background: #0f1424;
	}

	/* Blurred album cover fills the entire hero */
	.now-bg {
		position: absolute; inset: 0;
		background-size: cover;
		background-position: center;
		filter: blur(40px) saturate(1.2);
		transform: scale(1.3);
		opacity: 0.55;
		pointer-events: none;
		transition: opacity 0.5s ease, filter 0.5s ease;
	}
	.now-bg-overlay {
		position: absolute; inset: 0;
		background: linear-gradient(180deg, rgba(15,20,36,0.45) 0%, rgba(15,20,36,0.75) 70%, rgba(15,20,36,0.92) 100%);
		pointer-events: none;
	}
	.now-bg-fallback {
		position: absolute; inset: 0;
		background: linear-gradient(135deg, rgba(96,165,250,0.10), rgba(40,50,70,0.50));
		pointer-events: none;
	}

	.now-hero-content {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: 180px 1fr;
		gap: 22px;
		padding: 22px;
	}

	/* Cover */
	.now-cover {
		width: 180px; height: 180px;
		border-radius: 14px;
		overflow: hidden;
		background: rgba(0,0,0,0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		box-shadow:
			0 16px 36px rgba(0,0,0,0.55),
			0 0 0 0.5px rgba(255,255,255,0.10),
			inset 0 1px 0 rgba(255,255,255,0.10);
		transition: transform 0.3s ease;
	}
	.now-cover:hover {
		transform: translateY(-3px) scale(1.015);
	}
	.now-cover img {
		width: 100%; height: 100%; object-fit: cover;
		transition: transform 0.5s ease;
	}
	.now-cover.spinning img {
		animation: cover-pulse 4s ease-in-out infinite;
	}
	@keyframes cover-pulse {
		0%,100% { transform: scale(1); filter: brightness(1); }
		50% { transform: scale(1.025); filter: brightness(1.05); }
	}
	.now-cover-empty { color: rgba(255,255,255,0.45); }

	/* Subtle pulse ring around the cover when playing */
	.now-playing-pulse {
		position: absolute;
		inset: -6px;
		border-radius: 18px;
		border: 1px solid rgba(96,165,250,0.30);
		pointer-events: none;
		animation: cover-pulse-ring 2s ease-out infinite;
	}
	@keyframes cover-pulse-ring {
		0% { opacity: 0.7; transform: scale(1); }
		100% { opacity: 0; transform: scale(1.08); }
	}

	/* Meta */
	.now-meta {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-width: 0;
		justify-content: center;
	}
	.now-device {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 10.5px;
		color: rgba(255,255,255,0.7);
		text-transform: uppercase;
		letter-spacing: 0.10em;
		font-weight: 600;
		background: rgba(255,255,255,0.06);
		border: 0.5px solid rgba(255,255,255,0.10);
		border-radius: 999px;
		padding: 4px 10px;
		width: fit-content;
		max-width: 100%;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		backdrop-filter: blur(10px);
	}
	.now-title {
		font-size: 24px;
		font-weight: 600;
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		letter-spacing: -0.02em;
		line-height: 1.15;
		margin-top: 4px;
		text-shadow: 0 2px 12px rgba(0,0,0,0.5);
	}
	.now-artist {
		font-size: 14px;
		color: rgba(255,255,255,0.78);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-weight: 500;
		text-shadow: 0 1px 8px rgba(0,0,0,0.4);
	}

	/* Progress bar */
	.now-progress {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 10px;
	}
	.now-progress-track {
		height: 4px;
		background: rgba(255,255,255,0.10);
		border-radius: 999px;
		overflow: hidden;
	}
	.now-progress-fill {
		height: 100%;
		background: linear-gradient(90deg, #93c5fd, #fff);
		border-radius: 999px;
		box-shadow: 0 0 8px rgba(147,197,253,0.5);
		transition: width 0.4s linear;
	}
	.now-progress-times {
		display: flex;
		justify-content: space-between;
		font-size: 10.5px;
		color: rgba(255,255,255,0.55);
		font-variant-numeric: tabular-nums;
		font-weight: 500;
	}

	/* Controls */
	.now-controls {
		display: flex;
		gap: 8px;
		margin-top: 12px;
		flex-wrap: wrap;
		align-items: center;
	}
	.now-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 46px; height: 46px;
		background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.10), rgba(255,255,255,0.04) 70%);
		border: 0.5px solid rgba(255,255,255,0.13);
		border-radius: 50%;
		color: #f5f5f5;
		cursor: pointer;
		transition: all 0.18s ease;
		flex-shrink: 0;
		backdrop-filter: blur(10px);
	}
	.now-btn:hover:not(:disabled) {
		background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.16), rgba(255,255,255,0.06) 70%);
		border-color: rgba(255,255,255,0.22);
		transform: translateY(-2px);
		box-shadow: 0 6px 16px rgba(0,0,0,0.35);
	}
	.now-btn:active:not(:disabled) { transform: scale(0.94); }
	.now-btn:disabled { opacity: 0.4; cursor: default; }

	/* Big play/pause button — gradient + bright glow */
	.now-btn-play {
		width: 64px; height: 64px;
		background: linear-gradient(135deg, #ffffff 0%, #d6e4ff 100%);
		border-color: rgba(255,255,255,0.30);
		color: #0f1424;
		box-shadow:
			0 12px 28px rgba(147,197,253,0.40),
			inset 0 1px 0 rgba(255,255,255,0.6),
			0 0 0 0.5px rgba(255,255,255,0.5);
	}
	.now-btn-play:hover:not(:disabled) {
		background: linear-gradient(135deg, #ffffff 0%, #c4d8ff 100%);
		box-shadow:
			0 14px 36px rgba(147,197,253,0.55),
			inset 0 1px 0 rgba(255,255,255,0.7);
		transform: translateY(-3px) scale(1.04);
	}
	.now-btn-play :global(.mdi-mask) { --mask-color: #0f1424; }
	.now-btn-on {
		background: linear-gradient(135deg, #6ec464 0%, #4ade80 100%);
		border-color: rgba(74,222,128,0.40);
		color: #0a1f12;
	}

	.now-btn-small {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px; height: 34px;
		background: rgba(255,255,255,0.06);
		border: 0.5px solid rgba(255,255,255,0.10);
		border-radius: 10px;
		color: rgba(255,255,255,0.75);
		cursor: pointer;
		transition: all 0.15s;
		flex-shrink: 0;
		backdrop-filter: blur(10px);
	}
	.now-btn-small:hover {
		background: rgba(255,255,255,0.10);
		color: #fff;
		border-color: rgba(255,255,255,0.18);
		transform: translateY(-1px);
	}
	.now-btn-small.on {
		background: rgba(74,222,128,0.18);
		color: #4ade80;
		border-color: rgba(74,222,128,0.32);
		box-shadow: 0 0 12px rgba(74,222,128,0.20);
	}

	/* Volume slider */
	.now-volume {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 12px;
		padding: 8px 14px;
		background: rgba(0,0,0,0.30);
		border: 0.5px solid rgba(255,255,255,0.10);
		border-radius: 999px;
		backdrop-filter: blur(12px);
	}
	.vol-mute {
		background: transparent;
		border: 0;
		color: rgba(255,255,255,0.78);
		cursor: pointer;
		padding: 0;
		display: inline-flex;
		width: 22px; height: 22px;
		align-items: center;
		justify-content: center;
		transition: color 0.15s;
	}
	.vol-mute:hover { color: #fff; }
	.vol-slider {
		flex: 1;
		appearance: none;
		-webkit-appearance: none;
		height: 4px;
		background: rgba(255,255,255,0.15);
		border-radius: 999px;
		outline: none;
		cursor: pointer;
	}
	.vol-slider::-webkit-slider-runnable-track {
		height: 4px;
		background: linear-gradient(90deg, #93c5fd 0%, #93c5fd var(--vol-pct, 50%), rgba(255,255,255,0.15) var(--vol-pct, 50%));
		border-radius: 999px;
	}
	.vol-slider::-moz-range-track {
		height: 4px;
		background: rgba(255,255,255,0.15);
		border-radius: 999px;
	}
	.vol-slider::-moz-range-progress {
		height: 4px;
		background: #93c5fd;
		border-radius: 999px;
	}
	.vol-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 14px; height: 14px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 0 10px rgba(147,197,253,0.6), 0 2px 4px rgba(0,0,0,0.3);
		margin-top: -5px;
		cursor: pointer;
		transition: transform 0.15s;
	}
	.vol-slider::-webkit-slider-thumb:hover { transform: scale(1.2); }
	.vol-slider::-moz-range-thumb {
		width: 14px; height: 14px;
		border-radius: 50%;
		background: #fff;
		border: 0;
		box-shadow: 0 0 10px rgba(147,197,253,0.6), 0 2px 4px rgba(0,0,0,0.3);
		cursor: pointer;
	}
	.vol-pct {
		font-size: 11.5px;
		color: rgba(255,255,255,0.78);
		width: 36px;
		text-align: right;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	/* Source picker */
	.now-source { position: relative; margin-top: 8px; }
	.source-trigger {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		background: rgba(0,0,0,0.30);
		border: 0.5px solid rgba(255,255,255,0.10);
		border-radius: 10px;
		padding: 7px 12px;
		color: #f5f5f5;
		cursor: pointer;
		font-size: 12px;
		font-weight: 500;
		transition: all 0.15s;
		backdrop-filter: blur(12px);
	}
	.source-trigger:hover {
		background: rgba(0,0,0,0.42);
		border-color: rgba(255,255,255,0.18);
	}
	.source-popover {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		z-index: 10;
		min-width: 14rem;
		max-height: 16rem;
		overflow-y: auto;
		background: linear-gradient(180deg, rgba(26,34,56,0.95) 0%, rgba(15,20,36,0.95) 100%);
		border: 0.5px solid rgba(255,255,255,0.10);
		border-radius: 12px;
		padding: 6px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		box-shadow: 0 16px 40px rgba(0,0,0,0.55);
		backdrop-filter: blur(20px);
	}
	.source-option {
		text-align: left;
		background: transparent;
		border: 0;
		color: #f5f5f5;
		padding: 8px 10px;
		border-radius: 8px;
		cursor: pointer;
		font-size: 12.5px;
		transition: background 0.12s;
	}
	.source-option:hover { background: rgba(255,255,255,0.08); }
	.source-option.active {
		background: rgba(96,165,250,0.20);
		color: #93c5fd;
		font-weight: 500;
	}

	/* Empty state */
	.now-empty {
		display: flex; flex-direction: column;
		align-items: center; justify-content: center;
		gap: 12px;
		min-height: 240px;
		color: rgba(255,255,255,0.55);
		padding: 32px 20px;
		position: relative;
		z-index: 1;
	}
	.now-empty-icon {
		width: 80px; height: 80px;
		border-radius: 50%;
		background: rgba(255,255,255,0.04);
		border: 0.5px solid rgba(255,255,255,0.08);
		display: grid;
		place-items: center;
		color: rgba(255,255,255,0.35);
	}
	.now-empty-text { font-size: 13px; font-weight: 500; }

	/* ============================================
	 * SECTION TABS — premium pill-frame
	 * ============================================ */
	.section-tabs {
		display: flex;
		gap: 4px;
		padding: 4px;
		background: rgba(255,255,255,0.03);
		border: 0.5px solid rgba(255,255,255,0.06);
		border-radius: 12px;
	}
	.section-tabs button {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		background: transparent;
		border: 0;
		color: rgba(255,255,255,0.6);
		padding: 9px 12px;
		font-size: 12.5px;
		font-weight: 500;
		border-radius: 9px;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}
	.section-tabs button:hover { color: #fff; background: rgba(255,255,255,0.04); }
	.section-tabs button.active {
		background: linear-gradient(135deg, rgba(96,165,250,0.15), rgba(96,165,250,0.05));
		color: #93c5fd;
		box-shadow: 0 0 12px rgba(96,165,250,0.15);
	}

	/* Generic block */
	.hub-block { background: rgba(255,255,255,0.03); border: 0.5px solid rgba(255,255,255,0.07); border-radius: 13px; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
	.block-head { display: flex; align-items: center; gap: 0.5rem; font-size: 0.82rem; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.05em; }
	.block-head > span { flex: 1; }
	.block-add { background: rgba(255,255,255,0.08); border: 0; color: #f5f5f5; width: 1.6rem; height: 1.6rem; border-radius: 0.35rem; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; }
	.block-empty { font-size: 0.85rem; color: rgba(255,255,255,0.5); padding: 0.4rem 0.2rem; display: flex; flex-direction: column; align-items: flex-start; gap: 0.5rem; }
	.block-empty.error { color: #f3ca62; }

	/* Spotify */
	.spotify-block { gap: 0.55rem; }
	.spotify-connect-btn { background: #1db954; border: 0; color: #fff; padding: 0.5rem 0.9rem; border-radius: 0.4rem; font-size: 0.88rem; cursor: pointer; }
	.spotify-connect-btn:hover:not(:disabled) { background: #1ed760; }
	.spotify-connect-btn:disabled { background: rgba(29, 185, 84, 0.4); cursor: default; }
	.block-hint { font-size: 0.78rem; color: rgba(143, 198, 255, 0.85); margin: 0; padding: 0.4rem 0.5rem; background: rgba(143, 198, 255, 0.1); border-radius: 0.35rem; }
	.spotify-row { display: flex; gap: 0.4rem; flex-wrap: wrap; }
	.sp-info-block { font-size: 0.78rem; color: rgba(255,255,255,0.75); background: rgba(143,198,255,0.1); border: 1px solid rgba(143,198,255,0.25); border-radius: 0.4rem; padding: 0.5rem 0.6rem; line-height: 1.35; }
	.sp-info-block.sp-info-ok { color: rgba(180,235,180,0.85); background: rgba(110,196,100,0.08); border-color: rgba(110,196,100,0.25); }
	.sp-wake {
		background: rgba(143,198,255,0.07);
		border: 1px solid rgba(143,198,255,0.18);
		border-radius: 0.45rem;
		padding: 0.5rem 0.6rem;
		display: flex; flex-direction: column; gap: 0.35rem;
	}
	.sp-wake-title { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: rgba(143,198,255,0.9); text-transform: uppercase; letter-spacing: 0.04em; }
	.sp-wake-row { display: flex; gap: 0.4rem; flex-wrap: wrap; }
	.sp-wake-hint { font-size: 0.74rem; color: rgba(255,255,255,0.55); line-height: 1.3; }
	.sp-target-note {
		font-size: 0.78rem; color: rgba(255,255,255,0.65);
		padding: 0.45rem 0.55rem;
		background: rgba(255,255,255,0.04);
		border-left: 3px solid rgba(79,113,168,0.7);
		border-radius: 0.3rem;
		line-height: 1.35;
	}
	.sp-target-note.ok {
		color: #7ccc8c;
		background: rgba(84,173,111,0.1);
		border-left-color: #4eae5b;
		display: flex;
		align-items: flex-start;
		gap: 0.4rem;
	}
	.bridge-manager {
		background: rgba(0,0,0,0.25);
		border: 1px solid rgba(255,255,255,0.08);
		border-radius: 0.5rem;
		padding: 0.6rem;
		display: flex; flex-direction: column; gap: 0.4rem;
	}
	.bridge-manager-title { font-size: 0.78rem; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.05em; }
	.bridge-empty { font-size: 0.82rem; color: rgba(255,255,255,0.4); padding: 0.3rem 0.2rem; }
	.bridge-row {
		display: grid; grid-template-columns: 1fr auto auto; gap: 0.35rem;
		align-items: center;
		padding: 0.4rem 0.5rem;
		background: rgba(255,255,255,0.04);
		border-radius: 0.35rem;
	}
	.bridge-info { min-width: 0; display: flex; flex-direction: column; }
	.bridge-label { font-size: 0.88rem; color: #f5f5f5; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.bridge-sub { font-size: 0.72rem; color: rgba(255,255,255,0.45); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.bridge-rename {
		grid-column: 1; min-width: 0;
		background: rgba(0,0,0,0.4); border: 1px solid rgba(79,113,168,0.7);
		color: #f5f5f5; border-radius: 0.3rem;
		padding: 0.3rem 0.5rem; font-size: 0.86rem;
	}
	.bridge-rename:focus { outline: none; border-color: #4f71a8; }
	.bridge-btn {
		display: inline-flex; align-items: center; justify-content: center;
		width: 1.8rem; height: 1.8rem;
		background: rgba(255,255,255,0.08); border: 0; color: #f5f5f5;
		border-radius: 0.3rem; cursor: pointer;
	}
	.bridge-btn:hover:not(:disabled) { background: rgba(255,255,255,0.16); }
	.bridge-btn:disabled { opacity: 0.4; cursor: default; }
	.bridge-btn.ok { background: #4eae5b; }
	.bridge-btn.ok:hover { background: #5dc06b; }
	.bridge-btn.ghost { background: transparent; opacity: 0.6; width: auto; padding: 0 0.35rem; }
	.bridge-btn.ghost:hover { opacity: 1; background: rgba(255,255,255,0.08); }
	.bridge-add-row { display: flex; gap: 0.3rem; padding-top: 0.2rem; border-top: 1px solid rgba(255,255,255,0.06); }
	.bridge-add-select {
		flex: 1; min-width: 8rem;
		background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1);
		color: #f5f5f5; border-radius: 0.35rem;
		padding: 0.35rem 0.5rem; font-size: 0.85rem;
	}
	.bridge-add-row .bridge-btn { width: auto; padding: 0 0.7rem; font-size: 0.82rem; }
	.spotify-target { flex: 1; min-width: 8rem; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1); color: #f5f5f5; border-radius: 0.4rem; padding: 0.4rem 0.55rem; font-size: 0.85rem; }
	.spotify-go { display: inline-flex; align-items: center; gap: 0.3rem; background: #1db954; border: 0; color: #fff; padding: 0.4rem 0.7rem; border-radius: 0.4rem; cursor: pointer; font-size: 0.85rem; font-weight: 500; }
	.spotify-go:hover:not(:disabled) { background: #1ed760; }
	.spotify-go:disabled { background: rgba(29,185,84,0.4); cursor: default; }

	.sp-now { display: grid; grid-template-columns: 110px 1fr; gap: 0.6rem; padding: 0.5rem; background: rgba(0,0,0,0.25); border-radius: 0.5rem; }
	.sp-now img { width: 110px; height: 110px; object-fit: cover; border-radius: 0.4rem; }
	.sp-now-meta { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
	.sp-now-title { font-weight: 600; color: #f5f5f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.sp-now-artist { font-size: 0.85rem; color: rgba(255,255,255,0.7); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.sp-now-progress { font-size: 0.75rem; color: rgba(255,255,255,0.5); }
	.sp-now-controls { display: flex; gap: 0.3rem; margin-top: 0.3rem; flex-wrap: wrap; }
	.sp-btn { display: inline-flex; align-items: center; justify-content: center; width: 2rem; height: 2rem; background: rgba(255,255,255,0.08); border: 0; border-radius: 0.4rem; color: #f5f5f5; cursor: pointer; }
	.sp-btn:hover:not(:disabled) { background: rgba(255,255,255,0.16); }
	.sp-btn.on { background: #1db954; color: #fff; }
	.sp-btn-play { background: #1db954; color: #fff; width: 2.4rem; height: 2.4rem; }
	.sp-btn-play:hover { background: #1ed760; }

	.sp-queue { background: rgba(0,0,0,0.3); border-radius: 0.4rem; padding: 0.4rem; margin-top: 0.4rem; }
	.sp-queue-title { font-size: 0.78rem; color: rgba(255,255,255,0.7); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.3rem; }
	.sp-queue-empty { font-size: 0.82rem; color: rgba(255,255,255,0.4); padding: 0.3rem 0; }
	.sp-queue-item { display: flex; gap: 0.5rem; align-items: center; padding: 0.3rem 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
	.sp-queue-item img { width: 2rem; height: 2rem; border-radius: 0.25rem; object-fit: cover; }
	.sp-queue-meta { min-width: 0; }
	.sp-queue-name { font-size: 0.85rem; color: #f5f5f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.sp-queue-artist { font-size: 0.74rem; color: rgba(255,255,255,0.55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

	.sp-search-row { display: flex; gap: 0.3rem; }
	.sp-search-input-wrap { position: relative; flex: 1; display: flex; }
	.sp-search-input { flex: 1; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1); color: #f5f5f5; border-radius: 0.4rem; padding: 0.5rem 0.7rem; padding-right: 2rem; font-size: 0.88rem; min-width: 0; }
	.sp-search-input:focus { outline: none; border-color: rgba(29,185,84,0.6); }
	/* Verberg de native search-clear (rond X-icoontje) — we hebben onze eigen knop */
	.sp-search-input::-webkit-search-decoration,
	.sp-search-input::-webkit-search-cancel-button,
	.sp-search-input::-webkit-search-results-button,
	.sp-search-input::-webkit-search-results-decoration { -webkit-appearance: none; appearance: none; display: none; }
	.sp-search-clear { position: absolute; right: 0.4rem; top: 50%; transform: translateY(-50%); background: rgba(255,255,255,0.08); border: 0; color: rgba(255,255,255,0.7); width: 1.4rem; height: 1.4rem; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; cursor: pointer; transition: background 0.12s, color 0.12s; }
	.sp-search-clear:hover { background: rgba(255,255,255,0.18); color: #f5f5f5; }
	.sp-section-header {
		font-size: 10.5px;
		color: rgba(255,255,255,0.5);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-top: 4px;
		font-weight: 600;
	}
	.sp-section-header-row { display: flex; align-items: center; justify-content: space-between; }
	.sp-section-close {
		background: rgba(255,255,255,0.04);
		border: 0.5px solid rgba(255,255,255,0.08);
		color: rgba(255,255,255,0.7);
		width: 28px; height: 28px;
		border-radius: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.15s;
	}
	.sp-section-close:hover {
		background: rgba(255,255,255,0.08);
		color: #fff;
		border-color: rgba(255,255,255,0.13);
	}
	.sp-btn-search { width: 38px; height: 38px; }

	.sp-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: 12px;
	}

	/* ============================================
	 * SP-ART-TILE — square album art tiles with overlay
	 * Used for Spotify search/playlists AND radio favorites
	 * ============================================ */
	.sp-art-tile {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}

	.sp-art-cover {
		position: relative;
		display: block;
		aspect-ratio: 1;
		border-radius: 12px;
		overflow: hidden;
		background: rgba(0,0,0,0.45);
		border: 0;
		padding: 0;
		cursor: pointer;
		font-family: inherit;
		isolation: isolate;
		box-shadow:
			0 6px 16px rgba(0,0,0,0.40),
			inset 0 1px 0 rgba(255,255,255,0.06),
			0 0 0 0.5px rgba(255,255,255,0.04);
		transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s;
	}
	.sp-art-cover:hover {
		transform: translateY(-3px) scale(1.025);
		box-shadow:
			0 14px 32px rgba(0,0,0,0.55),
			inset 0 1px 0 rgba(255,255,255,0.10),
			0 0 0 0.5px rgba(255,255,255,0.10);
	}
	.sp-art-cover img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
		transition: transform 0.4s ease;
	}
	.sp-art-cover:hover img { transform: scale(1.06); }
	.sp-art-empty {
		width: 100%; height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, rgba(96,165,250,0.10), rgba(40,50,70,0.40));
		color: rgba(255,255,255,0.45);
	}
	.sp-art-empty.radio {
		background: linear-gradient(135deg, rgba(167,139,250,0.10), rgba(40,50,70,0.40));
	}

	/* Overlay with play button — appears on hover */
	.sp-art-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 100%);
		opacity: 0;
		transition: opacity 0.2s ease;
		pointer-events: none;
	}
	.sp-art-cover:hover .sp-art-overlay {
		opacity: 1;
	}
	.sp-art-play {
		display: grid;
		place-items: center;
		width: 48px; height: 48px;
		border-radius: 50%;
		background: linear-gradient(135deg, #ffffff 0%, #e5edff 100%);
		color: #0f1424;
		box-shadow:
			0 8px 20px rgba(0,0,0,0.35),
			inset 0 1px 0 rgba(255,255,255,0.4),
			0 0 18px rgba(147,197,253,0.30);
		transform: translateY(8px) scale(0.85);
		transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.sp-art-cover:hover .sp-art-play {
		transform: translateY(0) scale(1);
	}
	.sp-art-play :global(.mdi-mask) { --mask-color: #0f1424; }

	/* Badge top-left */
	.sp-art-badge {
		position: absolute;
		top: 8px; left: 8px;
		font-size: 9.5px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.10em;
		padding: 3px 7px;
		border-radius: 5px;
		background: rgba(0,0,0,0.55);
		color: rgba(255,255,255,0.85);
		backdrop-filter: blur(12px);
		border: 0.5px solid rgba(255,255,255,0.08);
		text-transform: capitalize;
		letter-spacing: 0.04em;
	}
	.sp-art-badge.radio-badge {
		background: linear-gradient(135deg, rgba(167,139,250,0.45), rgba(96,165,250,0.45));
		color: #fff;
		text-transform: uppercase;
		letter-spacing: 0.10em;
		border-color: rgba(255,255,255,0.18);
	}

	/* Meta below tile */
	.sp-art-meta {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 0 2px;
		min-width: 0;
	}
	.sp-art-name {
		font-size: 13px;
		font-weight: 600;
		color: #fff;
		letter-spacing: -0.005em;
		line-height: 1.25;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.sp-art-sub {
		font-size: 11.5px;
		color: rgba(255,255,255,0.50);
		font-weight: 400;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Queue button (only for tracks) — top-right */
	.sp-art-queue {
		position: absolute;
		top: 8px; right: 8px;
		width: 28px; height: 28px;
		display: grid;
		place-items: center;
		background: rgba(0,0,0,0.55);
		border: 0.5px solid rgba(255,255,255,0.10);
		border-radius: 8px;
		color: rgba(255,255,255,0.85);
		cursor: pointer;
		transition: all 0.15s;
		opacity: 0;
		backdrop-filter: blur(12px);
	}
	.sp-art-tile:hover .sp-art-queue { opacity: 1; }
	.sp-art-queue:hover {
		background: rgba(29,185,84,0.55);
		border-color: rgba(29,185,84,0.7);
		color: #fff;
		transform: scale(1.08);
	}

	/* Remove button (radio favorites) — top-right */
	.sp-art-remove {
		position: absolute;
		top: 8px; right: 8px;
		width: 26px; height: 26px;
		background: rgba(0,0,0,0.65);
		border: 0.5px solid rgba(255,255,255,0.10);
		color: rgba(255,255,255,0.85);
		border-radius: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		opacity: 0;
		transition: all 0.15s;
		z-index: 2;
		backdrop-filter: blur(12px);
	}
	.sp-art-tile:hover .sp-art-remove { opacity: 1; }
	.sp-art-remove:hover {
		background: rgba(248,113,113,0.85);
		border-color: rgba(248,113,113,1);
		color: #fff;
		transform: scale(1.08);
	}
	.sp-error {
		display: flex; align-items: flex-start; gap: 8px;
		font-size: 12.5px; color: #f3ca62;
		padding: 10px 12px;
		background: linear-gradient(135deg, rgba(243,202,98,0.10), transparent 60%), rgba(243,202,98,0.04);
		border: 0.5px solid rgba(243,202,98,0.25);
		border-radius: 10px;
		line-height: 1.4;
	}
	.sp-error > span { flex: 1; }
	.sp-error-close {
		background: transparent; border: 0; color: rgba(243,202,98,0.7);
		cursor: pointer; padding: 0;
		width: 22px; height: 22px;
		display: inline-flex; align-items: center; justify-content: center;
		border-radius: 6px; flex-shrink: 0;
		transition: all 0.15s;
	}
	.sp-error-close:hover { background: rgba(243,202,98,0.18); color: #f3ca62; }

	/* Radio (TuneIn) */
	.tin-search-row { display: flex; gap: 0.3rem; margin-bottom: 0.3rem; }
	.tin-search-input { flex: 1; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.1); color: #f5f5f5; border-radius: 0.4rem; padding: 0.5rem 0.7rem; font-size: 0.88rem; }
	.tin-search-input:focus { outline: none; border-color: rgba(79,113,168,0.7); }
	.tin-search-btn { width: 2.4rem; height: 2.4rem; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.08); border: 0; border-radius: 0.4rem; color: #f5f5f5; cursor: pointer; }
	.tin-search-btn:hover:not(:disabled) { background: rgba(255,255,255,0.16); }
	.tin-results { display: flex; flex-direction: column; gap: 0.3rem; max-height: 22rem; overflow-y: auto; padding: 0.2rem; background: rgba(0,0,0,0.15); border-radius: 0.4rem; }
	.tin-result { display: grid; grid-template-columns: 2.6rem 1fr auto; gap: 0.5rem; align-items: center; padding: 0.4rem; background: rgba(255,255,255,0.04); border-radius: 0.35rem; }
	.tin-result-img { width: 2.6rem; height: 2.6rem; object-fit: cover; border-radius: 0.3rem; }
	.tin-result-img.empty { display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.3); color: rgba(255,255,255,0.45); }
	.tin-result-info { min-width: 0; }
	.tin-result-name { font-size: 0.85rem; color: #f5f5f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
	.tin-result-sub { font-size: 0.74rem; color: rgba(255,255,255,0.55); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.tin-result-actions { display: flex; gap: 0.2rem; }
	.tin-mini-btn { width: 1.7rem; height: 1.7rem; display: inline-flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.08); border: 0; border-radius: 0.3rem; color: #f5f5f5; cursor: pointer; }
	.tin-mini-btn:hover:not(:disabled) { background: rgba(79, 113, 168, 0.4); }
	.tin-mini-btn:disabled { opacity: 0.4; cursor: default; }
	.tin-saved { width: 1.7rem; height: 1.7rem; display: inline-flex; align-items: center; justify-content: center; color: #f3ca62; }


	/* ============================================
	 * PLAYER TILES — visual cards with cover art
	 * ============================================ */
	.players-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 10px;
	}

	.player-tile {
		position: relative;
		display: grid;
		grid-template-rows: 1fr auto;
		min-height: 88px;
		background: rgba(255,255,255,0.025);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 14px;
		overflow: hidden;
		transition: all 0.2s ease;
		isolation: isolate;
	}
	.player-tile:hover {
		border-color: rgba(255,255,255,0.16);
		transform: translateY(-2px);
		box-shadow: 0 8px 24px rgba(0,0,0,0.35);
	}
	.player-tile.active {
		border-color: rgba(96,165,250,0.45);
		box-shadow:
			0 0 0 0.5px rgba(96,165,250,0.30),
			0 0 24px rgba(96,165,250,0.18),
			0 8px 24px rgba(0,0,0,0.4);
	}
	.player-tile.off { opacity: 0.55; }
	.player-tile.off:hover { opacity: 0.85; }
	.player-tile.dragging { opacity: 0.4; }
	.player-tile.drag-target {
		border-color: rgba(96,165,250,0.6);
		box-shadow: 0 0 0 1px rgba(96,165,250,0.35) inset;
	}

	/* Blurred cover background */
	.player-tile-bg {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
		filter: blur(28px) saturate(1.3);
		transform: scale(1.4);
		opacity: 0.45;
		pointer-events: none;
		z-index: 0;
		transition: opacity 0.3s;
	}
	.player-tile:hover .player-tile-bg { opacity: 0.55; }
	.player-tile-bg-overlay {
		position: absolute;
		inset: 0;
		background: linear-gradient(180deg, rgba(15,20,36,0.55) 0%, rgba(15,20,36,0.85) 100%);
		pointer-events: none;
		z-index: 0;
	}
	.player-tile-bg-fallback {
		position: absolute;
		inset: 0;
		background: linear-gradient(135deg, rgba(96,165,250,0.05), transparent 60%), rgba(255,255,255,0.015);
		pointer-events: none;
		z-index: 0;
	}

	.player-tile-pick {
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: 64px 1fr;
		gap: 12px;
		align-items: center;
		background: transparent;
		border: 0;
		color: #fff;
		cursor: pointer;
		padding: 12px 14px 10px;
		text-align: left;
		font-family: inherit;
		min-width: 0;
	}

	.player-tile-cover {
		position: relative;
		width: 64px; height: 64px;
		border-radius: 12px;
		background: rgba(0,0,0,0.45);
		flex-shrink: 0;
		display: flex; align-items: center; justify-content: center;
		overflow: hidden;
		box-shadow:
			0 6px 14px rgba(0,0,0,0.45),
			inset 0 1px 0 rgba(255,255,255,0.10),
			0 0 0 0.5px rgba(255,255,255,0.06);
	}
	.player-tile-cover img { width: 100%; height: 100%; object-fit: cover; }
	.player-tile-cover img.is-logo {
		object-fit: contain;
		padding: 8px;
		background: rgba(255,255,255,0.04);
	}
	.player-tile-cover-empty { color: rgba(255,255,255,0.40); }

	/* Equalizer animation when playing */
	.player-tile-eq {
		position: absolute;
		bottom: 5px; left: 5px;
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 14px;
		padding: 0 4px;
		background: rgba(0,0,0,0.55);
		border-radius: 6px;
		backdrop-filter: blur(6px);
	}
	.player-tile-eq span {
		display: block;
		width: 2px;
		background: #4ade80;
		border-radius: 999px;
		animation: eq-bounce 1.2s ease-in-out infinite;
	}
	.player-tile-eq span:nth-child(1) { animation-delay: -0.5s; }
	.player-tile-eq span:nth-child(2) { animation-delay: -1.0s; }
	.player-tile-eq span:nth-child(3) { animation-delay: -0.2s; }
	.player-tile-eq span:nth-child(4) { animation-delay: -0.8s; }
	@keyframes eq-bounce {
		0%, 100% { height: 3px; }
		50% { height: 9px; }
	}

	.player-tile-info {
		display: flex;
		flex-direction: column;
		gap: 3px;
		min-width: 0;
	}
	.player-tile-name {
		font-size: 14px;
		font-weight: 600;
		color: #fff;
		letter-spacing: -0.005em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		text-shadow: 0 1px 8px rgba(0,0,0,0.4);
	}
	.player-tile-active-dot {
		display: inline-block;
		width: 6px; height: 6px;
		border-radius: 50%;
		background: #93c5fd;
		margin-right: 5px;
		vertical-align: middle;
		box-shadow: 0 0 8px rgba(147,197,253,0.7);
	}
	.player-tile-now {
		display: flex;
		flex-direction: column;
		gap: 1px;
		min-width: 0;
	}
	.player-tile-now-primary {
		font-size: 11.5px;
		color: rgba(255,255,255,0.85);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-weight: 500;
	}
	.player-tile-now-secondary {
		font-size: 10.5px;
		color: rgba(255,255,255,0.55);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.player-tile-status {
		font-size: 11.5px;
		font-weight: 500;
	}
	.player-tile-status.on { color: rgba(255,255,255,0.65); }
	.player-tile-status.off {
		color: rgba(255,255,255,0.40);
		text-transform: uppercase;
		letter-spacing: 0.08em;
		font-size: 10.5px;
	}

	/* Controls bar at bottom of tile */
	.player-tile-controls {
		position: relative;
		z-index: 1;
		display: flex;
		gap: 4px;
		padding: 8px 12px 12px;
		justify-content: flex-end;
		align-items: center;
		border-top: 0.5px solid rgba(255,255,255,0.05);
	}

	.ptile-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px; height: 34px;
		background: rgba(255,255,255,0.04);
		border: 0.5px solid rgba(255,255,255,0.10);
		border-radius: 50%;
		color: #f5f5f5;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
		flex-shrink: 0;
		backdrop-filter: blur(8px);
	}
	.ptile-btn:hover:not(:disabled) {
		background: rgba(255,255,255,0.10);
		border-color: rgba(255,255,255,0.20);
		transform: scale(1.05);
	}
	.ptile-btn:active:not(:disabled) { transform: scale(0.94); }
	.ptile-btn:disabled { opacity: 0.35; cursor: default; }

	.ptile-btn-play {
		width: 40px; height: 40px;
		background: linear-gradient(135deg, #ffffff 0%, #e5edff 100%);
		color: #0f1424;
		border-color: rgba(255,255,255,0.30);
		box-shadow: 0 4px 14px rgba(147,197,253,0.30);
	}
	.ptile-btn-play:hover:not(:disabled) {
		background: linear-gradient(135deg, #ffffff 0%, #d6e4ff 100%);
		box-shadow: 0 6px 18px rgba(147,197,253,0.45);
	}
	.ptile-btn-play :global(.mdi-mask) { --mask-color: #0f1424; }

	.ptile-btn.small { width: 28px; height: 28px; }
	.ptile-btn.on {
		background: rgba(74,222,128,0.18);
		color: #4ade80;
		border-color: rgba(74,222,128,0.32);
	}
	.ptile-drag {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px; height: 28px;
		background: transparent;
		color: rgba(255,255,255,0.4);
		cursor: grab;
		border-radius: 6px;
		opacity: 0;
		transition: opacity 0.12s, background 0.12s, color 0.12s;
		user-select: none;
		touch-action: none;
	}
	.ptile-drag:active { cursor: grabbing; }
	.player-tile:hover .ptile-drag { opacity: 1; }
	.ptile-drag:hover { color: #fff; background: rgba(255,255,255,0.08); }

	/* Custom radio modal */
	.np-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.55); border: 0; z-index: 70; cursor: default; }
	.np-modal {
		position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
		background: #121722; border: 1px solid #2e384d; border-radius: 0.6rem;
		padding: 1rem 1.2rem; z-index: 80;
		width: min(28rem, calc(100vw - 2rem));
		max-height: calc(100vh - 2rem);
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		touch-action: pan-y;
		scrollbar-width: none;
		-ms-overflow-style: none;
		display: flex; flex-direction: column; gap: 0.7rem;
		box-shadow: 0 12px 32px rgba(0,0,0,0.6);
	}
	.np-modal::-webkit-scrollbar { width: 0; height: 0; display: none; }
	.np-modal h3 { margin: 0; font-size: 1rem; color: #f5f5f5; }
	.np-field { display: flex; flex-direction: column; gap: 0.25rem; }
	.np-field span { font-size: 0.8rem; color: rgba(255,255,255,0.65); }
	.np-field input { background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.12); color: #f5f5f5; border-radius: 0.4rem; padding: 0.5rem 0.6rem; font-size: 0.9rem; }
	.np-field input:focus { outline: none; border-color: rgba(79,113,168,0.7); }
	.np-modal-actions { display: flex; gap: 0.4rem; justify-content: flex-end; margin-top: 0.3rem; }
	.np-btn-primary, .np-btn-secondary { border: 0; border-radius: 0.4rem; padding: 0.5rem 0.8rem; font-size: 0.88rem; cursor: pointer; font-weight: 500; }
	.np-btn-primary { background: #4f71a8; color: #fff; }
	.np-btn-primary:hover:not(:disabled) { background: #5d83be; }
	.np-btn-primary:disabled { background: rgba(79,113,168,0.4); cursor: default; }
	.np-btn-secondary { background: rgba(255,255,255,0.08); color: #f5f5f5; }
	.np-btn-secondary:hover { background: rgba(255,255,255,0.16); }

	@media (max-width: 600px) {
		.hub-now { grid-template-columns: 1fr; }
		.now-cover { width: 100%; height: 180px; }
		.sp-now { grid-template-columns: 80px 1fr; }
		.sp-now img { width: 80px; height: 80px; }
	}
</style>
