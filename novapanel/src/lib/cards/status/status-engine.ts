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
	return new Set((values ?? []).map((value) => value.trim().toLowerCase()).filter((value) => value.length > 0));
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
		if (input.kind === 'openings_status' && classesSet.size > 0) {
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
		return state === 'on' || state === 'playing' || state === 'heat' || state === 'cool' || state === 'auto';
	}
	if (kind === 'media_players_status') {
		return (
			state === 'playing' ||
			state === 'paused' ||
			state === 'buffering' ||
			state === 'on'
		);
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
		} else if (cls.includes('window') || id.includes('window') || name.includes('raam') || name.includes('ramen')) {
			hasWindow = true;
		} else {
			hasDoor = true;
		}
	}
	return { hasDoor, hasWindow };
}

function localized(nl: string, en: string, language: LanguageCode = 'nl') {
	return language === 'nl' ? nl : en;
}

export function buildStatusSummary({ kind, activeCount, activeEntities, language = 'nl' }: BuildSummaryInput): string {
	if (kind === 'lights_status') {
		if (activeCount <= 0) return localized('Alle lampen zijn uitgeschakeld.', 'All lights are off.', language);
		if (activeCount === 1) return localized('Er is 1 lamp ingeschakeld.', '1 light is on.', language);
		return localized(`Er zijn ${activeCount} lampen ingeschakeld.`, `${activeCount} lights are on.`, language);
	}
	if (kind === 'openings_status') {
		if (activeCount <= 0) return localized('Alle ramen en deuren zijn gesloten.', 'All windows and doors are closed.', language);
		const { hasDoor, hasWindow } = classifyOpenings(activeEntities ?? []);
		const onlyWindows = hasWindow && !hasDoor;
		const onlyDoors = hasDoor && !hasWindow;
		if (onlyWindows) {
			if (activeCount === 1) return localized('Er staat 1 raam open.', '1 window is open.', language);
			return localized(`Er staan ${activeCount} ramen open.`, `${activeCount} windows are open.`, language);
		}
		if (onlyDoors) {
			if (activeCount === 1) return localized('Er staat 1 deur open.', '1 door is open.', language);
			return localized(`Er staan ${activeCount} deuren open.`, `${activeCount} doors are open.`, language);
		}
		if (activeCount === 1) return localized('Er staat 1 raam of deur open.', '1 window or door is open.', language);
		return localized(`Er staan ${activeCount} ramen & deuren open.`, `${activeCount} windows and doors are open.`, language);
	}
	if (kind === 'devices_status') {
		if (activeCount <= 0) return localized('Alle apparaten zijn uitgeschakeld.', 'All devices are off.', language);
		if (activeCount === 1) return localized('Er staat 1 apparaat aan.', '1 device is on.', language);
		return localized(`Er staan ${activeCount} apparaten aan.`, `${activeCount} devices are on.`, language);
	}
	if (kind === 'media_players_status') {
		if (activeCount <= 0) return localized('Er word niks afgespeeld.', 'Nothing is playing.', language);
		if (activeCount === 1) return localized('1 Media speler is actief.', '1 media player is active.', language);
		return localized(`${activeCount} Media spelers zijn actief.`, `${activeCount} media players are active.`, language);
	}
	if (activeCount <= 0) return localized('Alles werkt naar behoren', 'Everything is working as expected', language);
	if (activeCount === 1) return localized('Er is 1 entiteit onbereikbaar.', '1 entity is unreachable.', language);
	return localized(`Er zijn ${activeCount} entiteiten onbereikbaar.`, `${activeCount} entities are unreachable.`, language);
}
