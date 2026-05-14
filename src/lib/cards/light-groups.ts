// Light groups: stored per card ID in localStorage
// Each group appears as one entity in the status card, but individual lights are counted

export type LightGroup = {
	id: string;
	name: string;
	entityIds: string[]; // individual entity IDs in this group
};

const KEY_PREFIX = 'np_light_groups_';

export function loadLightGroups(cardId: string): LightGroup[] {
	try {
		const raw = localStorage.getItem(KEY_PREFIX + cardId);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(g): g is LightGroup =>
				g &&
				typeof g.id === 'string' &&
				typeof g.name === 'string' &&
				Array.isArray(g.entityIds)
		);
	} catch {
		return [];
	}
}

export function saveLightGroups(cardId: string, groups: LightGroup[]): void {
	try {
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
