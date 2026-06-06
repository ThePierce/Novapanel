import type { HomeAssistantEntity } from '$lib/ha/entities-service-helpers';
import type { LanguageCode } from '$lib/i18n';

export type StatusCardKind =
	| 'lights_status'
	| 'openings_status'
	| 'devices_status'
	| 'availability_status'
	| 'media_players_status';

type BuildSummaryInput = {
	kind: StatusCardKind;
	activeCount: number;
	activeEntities?: HomeAssistantEntity[];
	language?: LanguageCode;
};

function asSet(values?: string[]) {
	return new Set(
		(values ?? []).map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0)
	);
}

export function parseCsvToList(value: string): string[] {
	return value
		.split(',')
		.map((entry) => entry.trim())
		.filter((entry) => entry.length > 0);
}

export function filterEntitiesForStatusCard(input: {
	entities: HomeAssistantEntity[];
	kind: StatusCardKind;
	domains?: string[];
	deviceClasses?: string[];
	ignoredEntityIds?: string[];
}): { relevant: HomeAssistantEntity[]; active: HomeAssistantEntity[]; ignored: HomeAssistantEntity[] } {
	const ignoredSet = asSet(input.ignoredEntityIds);
	const domainsSet = asSet(input.domains);
	const classesSet = asSet(input.deviceClasses);
	const includeAllDomains = domainsSet.has('all');
	const ignored: HomeAssistantEntity[] = [];
	const relevant: HomeAssistantEntity[] = [];
	const active: HomeAssistantEntity[] = [];

	for (const entity of input.entities) {
		const id = entity.entityId.toLowerCase();
		if (ignoredSet.has(id)) {
			ignored.push(entity);
			continue;
		}
		if (!includeAllDomains && domainsSet.size > 0 && !domainsSet.has(entity.domain.toLowerCase())) {
			continue;
		}
		if (input.kind !== 'media_players_status' && classesSet.size > 0) {
			const deviceClass = (entity.deviceClass ?? '').toLowerCase();
			if (!classesSet.has(deviceClass) && !classesSet.has(entity.domain.toLowerCase())) {
				continue;
			}
		}
		relevant.push(entity);
		if (isEntityActive(entity, input.kind)) {
			active.push(entity);
		}
	}
	return { relevant, active, ignored };
}

export function isEntityActive(entity: HomeAssistantEntity, kind: StatusCardKind): boolean {
	const state = entity.state.toLowerCase();
	if (kind === 'availability_status') {
		return state === 'unavailable' || state === 'unknown';
	}
	if (kind === 'openings_status') {
		return state === 'on' || state === 'open' || state === 'opening';
	}
	if (kind === 'lights_status' || kind === 'devices_status') {
		return (
			state === 'on' ||
			state === 'playing' ||
			state === 'heat' ||
			state === 'cool' ||
			state === 'auto' ||
			state === 'unlocked' ||
			state === 'unlocking'
		);
	}
	if (kind === 'media_players_status') {
		return state === 'playing' || state === 'paused' || state === 'buffering' || state === 'on';
	}
	return false;
}

function classifyOpenings(entities: HomeAssistantEntity[]): { hasDoor: boolean; hasWindow: boolean } {
	let hasDoor = false;
	let hasWindow = false;
	for (const entity of entities) {
		const cls = (entity.deviceClass ?? '').toLowerCase();
		const id = entity.entityId.toLowerCase();
		const name = (entity.friendlyName ?? '').toLowerCase();
		if (cls.includes('door') || id.includes('door') || name.includes('deur')) {
			hasDoor = true;
		} else if (
			cls.includes('window') ||
			id.includes('window') ||
			name.includes('raam') ||
			name.includes('ramen')
		) {
			hasWindow = true;
		}
	}
	return { hasDoor, hasWindow };
}

function localized(
	nl: string,
	en: string,
	language: LanguageCode = 'nl',
	extra: Partial<Record<Exclude<LanguageCode, 'nl' | 'en'>, string>> = {}
) {
	if (language === 'nl') return nl;
	if (language === 'en') return en;
	return extra[language] ?? en;
}

export function buildStatusSummary({
	kind,
	activeCount,
	activeEntities,
	language = 'nl'
}: BuildSummaryInput): string {
	if (kind === 'lights_status') {
		if (activeCount <= 0)
			return localized('Alle lampen zijn uitgeschakeld.', 'All lights are off.', language, {
				de: 'Alle Lichter sind ausgeschaltet.',
				fr: 'Toutes les lumières sont éteintes.',
				es: 'Todas las luces están apagadas.'
			});
		if (activeCount === 1)
			return localized('Er is 1 lamp ingeschakeld.', '1 light is on.', language, {
				de: '1 Licht ist eingeschaltet.',
				fr: '1 lumière est allumée.',
				es: '1 luz está encendida.'
			});
		return localized(
			`Er zijn ${activeCount} lampen ingeschakeld.`,
			`${activeCount} lights are on.`,
			language,
			{
				de: `${activeCount} Lichter sind eingeschaltet.`,
				fr: `${activeCount} lumières sont allumées.`,
				es: `${activeCount} luces están encendidas.`
			}
		);
	}
	if (kind === 'openings_status') {
		if (activeCount <= 0)
			return localized('Alle ramen en deuren zijn gesloten.', 'All windows and doors are closed.', language, {
				de: 'Alle Fenster und Türen sind geschlossen.',
				fr: 'Toutes les fenêtres et portes sont fermées.',
				es: 'Todas las ventanas y puertas están cerradas.'
			});
		const { hasDoor, hasWindow } = classifyOpenings(activeEntities ?? []);
		const onlyWindows = hasWindow && !hasDoor;
		const onlyDoors = hasDoor && !hasWindow;
		if (onlyWindows) {
			if (activeCount === 1)
				return localized('Er staat 1 raam open.', '1 window is open.', language, {
					de: '1 Fenster ist offen.',
					fr: '1 fenêtre est ouverte.',
					es: '1 ventana está abierta.'
				});
			return localized(`Er staan ${activeCount} ramen open.`, `${activeCount} windows are open.`, language, {
				de: `${activeCount} Fenster sind offen.`,
				fr: `${activeCount} fenêtres sont ouvertes.`,
				es: `${activeCount} ventanas están abiertas.`
			});
		}
		if (onlyDoors) {
			if (activeCount === 1)
				return localized('Er staat 1 deur open.', '1 door is open.', language, {
					de: '1 Tür ist offen.',
					fr: '1 porte est ouverte.',
					es: '1 puerta está abierta.'
				});
			return localized(`Er staan ${activeCount} deuren open.`, `${activeCount} doors are open.`, language, {
				de: `${activeCount} Türen sind offen.`,
				fr: `${activeCount} portes sont ouvertes.`,
				es: `${activeCount} puertas están abiertas.`
			});
		}
		if (activeCount === 1)
			return localized('Er staat 1 raam of deur open.', '1 window or door is open.', language, {
				de: '1 Fenster oder Tür ist offen.',
				fr: '1 fenêtre ou porte est ouverte.',
				es: '1 ventana o puerta está abierta.'
			});
		return localized(
			`Er staan ${activeCount} ramen & deuren open.`,
			`${activeCount} windows and doors are open.`,
			language,
			{
				de: `${activeCount} Fenster und Türen sind offen.`,
				fr: `${activeCount} fenêtres et portes sont ouvertes.`,
				es: `${activeCount} ventanas y puertas están abiertas.`
			}
		);
	}
	if (kind === 'devices_status') {
		if (activeCount <= 0)
			return localized('Alle apparaten zijn uitgeschakeld.', 'All devices are off.', language, {
				de: 'Alle Geräte sind ausgeschaltet.',
				fr: 'Tous les appareils sont éteints.',
				es: 'Todos los dispositivos están apagados.'
			});
		if (activeCount === 1)
			return localized('Er staat 1 apparaat aan.', '1 device is on.', language, {
				de: '1 Gerät ist eingeschaltet.',
				fr: '1 appareil est allumé.',
				es: '1 dispositivo está encendido.'
			});
		return localized(`Er staan ${activeCount} apparaten aan.`, `${activeCount} devices are on.`, language, {
			de: `${activeCount} Geräte sind eingeschaltet.`,
			fr: `${activeCount} appareils sont allumés.`,
			es: `${activeCount} dispositivos están encendidos.`
		});
	}
	if (kind === 'media_players_status') {
		if (activeCount <= 0)
			return localized('Er word niks afgespeeld.', 'Nothing is playing.', language, {
				de: 'Es wird nichts abgespielt.',
				fr: 'Rien n’est en cours de lecture.',
				es: 'No se está reproduciendo nada.'
			});
		if (activeCount === 1)
			return localized('1 Media speler is actief.', '1 media player is active.', language, {
				de: '1 Mediaplayer ist aktiv.',
				fr: '1 lecteur multimédia est actif.',
				es: '1 reproductor multimedia está activo.'
			});
		return localized(
			`${activeCount} Media spelers zijn actief.`,
			`${activeCount} media players are active.`,
			language,
			{
				de: `${activeCount} Mediaplayer sind aktiv.`,
				fr: `${activeCount} lecteurs multimédia sont actifs.`,
				es: `${activeCount} reproductores multimedia están activos.`
			}
		);
	}
	if (activeCount <= 0)
		return localized('Alles werkt naar behoren', 'Everything is working as expected', language, {
			de: 'Alles funktioniert wie erwartet',
			fr: 'Tout fonctionne comme prévu',
			es: 'Todo funciona correctamente'
		});
	if (activeCount === 1)
		return localized('Er is 1 entiteit onbereikbaar.', '1 entity is unreachable.', language, {
			de: '1 Entität ist nicht erreichbar.',
			fr: '1 entité est inaccessible.',
			es: '1 entidad no está disponible.'
		});
	return localized(
		`Er zijn ${activeCount} entiteiten onbereikbaar.`,
		`${activeCount} entities are unreachable.`,
		language,
		{
			de: `${activeCount} Entitäten sind nicht erreichbar.`,
			fr: `${activeCount} entités sont inaccessibles.`,
			es: `${activeCount} entidades no están disponibles.`
		}
	);
}
