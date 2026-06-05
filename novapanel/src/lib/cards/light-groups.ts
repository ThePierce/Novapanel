// Light groups: stored per card ID in localStorage.
// Groups can also be referenced from view cards through a synthetic entity id.

export type LightGroup = {
	id: string;
	name: string;
	entityIds: string[]; // individual entity IDs in this group
};

const KEY_PREFIX = 'np_light_groups_';
export const LIGHT_GROUP_ENTITY_PREFIX = 'np_light_group:';

function canUseStorage(): boolean {
	return typeof localStorage !== 'undefined';
}

function normalizeGroupInput(value: unknown): LightGroup[] {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(g): g is LightGroup =>
			g &&
			typeof g.id === 'string' &&
			typeof g.name === 'string' &&
			Array.isArray(g.entityIds)
	);
}

export function loadLightGroups(cardId: string): LightGroup[] {
	try {
		if (!canUseStorage()) return [];
		const raw = localStorage.getItem(KEY_PREFIX + cardId);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return normalizeGroupInput(parsed);
	} catch {
		return [];
	}
}

export function saveLightGroups(cardId: string, groups: LightGroup[]): void {
	try {
		if (!canUseStorage()) return;
		localStorage.setItem(KEY_PREFIX + cardId, JSON.stringify(groups));
	} catch {}
}

export function createLightGroup(name: string, entityIds: string[]): LightGroup {
	return {
		id: `lg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
		name,
		entityIds
	};
}

export function encodeLightGroupEntityId(cardId: string, groupId: string): string {
	return `${LIGHT_GROUP_ENTITY_PREFIX}${encodeURIComponent(cardId)}:${encodeURIComponent(groupId)}`;
}

export function decodeLightGroupEntityId(entityId: string | undefined): { cardId: string; groupId: string } | null {
	const value = entityId?.trim() ?? '';
	if (!value.startsWith(LIGHT_GROUP_ENTITY_PREFIX)) return null;
	const payload = value.slice(LIGHT_GROUP_ENTITY_PREFIX.length);
	const separator = payload.indexOf(':');
	if (separator <= 0) return null;
	try {
		return {
			cardId: decodeURIComponent(payload.slice(0, separator)),
			groupId: decodeURIComponent(payload.slice(separator + 1))
		};
	} catch {
		return null;
	}
}

export function isLightGroupEntityId(entityId: string | undefined): boolean {
	return decodeLightGroupEntityId(entityId) !== null;
}

export function resolveLightGroupEntityId(entityId: string | undefined): (LightGroup & { cardId: string }) | null {
	const ref = decodeLightGroupEntityId(entityId);
	if (!ref) return null;
	const group = loadLightGroups(ref.cardId).find((item) => item.id === ref.groupId);
	return group ? { ...group, cardId: ref.cardId } : null;
}

export function loadAllLightGroups(): Array<LightGroup & { cardId: string; syntheticEntityId: string }> {
	try {
		if (!canUseStorage()) return [];
		const groups: Array<LightGroup & { cardId: string; syntheticEntityId: string }> = [];
		for (let index = 0; index < localStorage.length; index += 1) {
			const key = localStorage.key(index) ?? '';
			if (!key.startsWith(KEY_PREFIX)) continue;
			const cardId = key.slice(KEY_PREFIX.length);
			for (const group of loadLightGroups(cardId)) {
				groups.push({
					...group,
					cardId,
					syntheticEntityId: encodeLightGroupEntityId(cardId, group.id)
				});
			}
		}
		return groups;
	} catch {
		return [];
	}
}
