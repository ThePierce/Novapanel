import { derived, writable } from 'svelte/store';
import {
	createHomeAssistantEntitiesService,
	type EntityStatus,
	type HomeAssistantEntity
} from './entities-service';
import { setEntityNameOverride } from './entity-name-overrides';

type EntityStoreState = {
	status: EntityStatus;
	error: string;
	lastUpdated: number;
	entities: HomeAssistantEntity[];
	domainFilter: string;
	query: string;
};

type OptimisticEntityPatch = {
	state?: string;
	attributes?: Record<string, unknown>;
};

type OptimisticEntityOverride = {
	patch: OptimisticEntityPatch;
	expiresAt: number;
};

const OPTIMISTIC_STATE_TTL_MS = 4000;

const initialState: EntityStoreState = {
	status: 'connecting',
	error: '',
	lastUpdated: 0,
	entities: [],
	domainFilter: 'all',
	query: ''
};

function filterEntities(
	entities: HomeAssistantEntity[],
	domainFilter: string,
	query: string
): HomeAssistantEntity[] {
	const normalizedQuery = query.trim().toLowerCase();
	return entities.filter((entity) => {
		const domainMatches = domainFilter === 'all' || entity.domain === domainFilter;
		const queryMatches =
			normalizedQuery.length === 0 ||
			entity.friendlyName.toLowerCase().includes(normalizedQuery) ||
			entity.entityId.toLowerCase().includes(normalizedQuery);
		return domainMatches && queryMatches;
	});
}

function serviceEntityIds(serviceData: Record<string, unknown>): string[] {
	const raw = serviceData.entity_id;
	if (typeof raw === 'string') return raw.trim() ? [raw.trim()] : [];
	if (Array.isArray(raw)) {
		return raw
			.map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
			.filter((entry) => entry.length > 0);
	}
	return [];
}

function numberAttribute(serviceData: Record<string, unknown>, key: string): number | null {
	const raw = serviceData[key];
	return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function asBool(value: unknown): boolean | null {
	return typeof value === 'boolean' ? value : null;
}

function isOnState(value: string): boolean {
	return ['on', 'open', 'opening', 'playing', 'buffering', 'cleaning', 'returning', 'heat', 'cool'].includes(
		value.trim().toLowerCase()
	);
}

function brightnessFromPercent(value: number): number {
	return Math.max(1, Math.min(255, Math.round((Math.max(1, Math.min(100, value)) / 100) * 255)));
}

function patchMatchesEntity(entity: HomeAssistantEntity, patch: OptimisticEntityPatch): boolean {
	if (patch.state !== undefined && entity.state !== patch.state) return false;
	const attrs = patch.attributes ?? {};
	for (const [key, value] of Object.entries(attrs)) {
		if (!Object.is(entity.attributes[key], value)) return false;
	}
	return true;
}

function applyOptimisticPatch(
	entity: HomeAssistantEntity,
	patch: OptimisticEntityPatch
): HomeAssistantEntity {
	return {
		...entity,
		state: patch.state ?? entity.state,
		attributes: patch.attributes ? { ...entity.attributes, ...patch.attributes } : entity.attributes
	};
}

function optimisticPatchForService(
	entity: HomeAssistantEntity,
	domain: string,
	service: string,
	serviceData: Record<string, unknown>
): OptimisticEntityPatch | null {
	const normalizedDomain = (domain || entity.domain || entity.entityId.split('.')[0] || '').toLowerCase();
	const normalizedService = service.toLowerCase();
	const state = (entity.state || '').toLowerCase();
	const patch: OptimisticEntityPatch = {};
	let changed = false;

	const setState = (value: string) => {
		if (entity.state !== value) {
			patch.state = value;
			changed = true;
		}
	};
	const setAttr = (key: string, value: unknown) => {
		if (!Object.is(entity.attributes[key], value)) {
			patch.attributes = { ...(patch.attributes ?? {}), [key]: value };
			changed = true;
		}
	};
	const applyOnOff = () => {
		if (normalizedService === 'turn_on') setState('on');
		if (normalizedService === 'turn_off') setState('off');
		if (normalizedService === 'toggle') setState(isOnState(state) ? 'off' : 'on');
	};

	if (normalizedDomain === 'light') {
		applyOnOff();
		if (normalizedService === 'turn_on' || normalizedService === 'toggle') {
			const brightness = numberAttribute(serviceData, 'brightness');
			const brightnessPct = numberAttribute(serviceData, 'brightness_pct');
			if (brightness !== null) setAttr('brightness', Math.max(1, Math.min(255, Math.round(brightness))));
			if (brightnessPct !== null) setAttr('brightness', brightnessFromPercent(brightnessPct));
			const kelvin = numberAttribute(serviceData, 'color_temp_kelvin');
			if (kelvin !== null) setAttr('color_temp_kelvin', Math.round(kelvin));
			if (Array.isArray(serviceData.rgb_color)) setAttr('rgb_color', serviceData.rgb_color);
		}
	} else if (['switch', 'fan', 'input_boolean'].includes(normalizedDomain)) {
		applyOnOff();
	} else if (normalizedDomain === 'climate') {
		if (normalizedService === 'turn_off') setState('off');
		if (normalizedService === 'turn_on' && state === 'off') setState('heat');
		const temperature = numberAttribute(serviceData, 'temperature');
		if (temperature !== null) setAttr('temperature', temperature);
		if (typeof serviceData.hvac_mode === 'string') setState(serviceData.hvac_mode);
		if (typeof serviceData.preset_mode === 'string') setAttr('preset_mode', serviceData.preset_mode);
	} else if (normalizedDomain === 'cover') {
		if (normalizedService === 'open_cover') setState('opening');
		if (normalizedService === 'close_cover') setState('closing');
		if (normalizedService === 'stop_cover') setState(state === 'closing' ? 'closed' : state === 'opening' ? 'open' : entity.state);
		const position = numberAttribute(serviceData, 'position');
		if (position !== null) {
			const clamped = Math.max(0, Math.min(100, Math.round(position)));
			setAttr('current_position', clamped);
			setState(clamped <= 0 ? 'closed' : clamped >= 100 ? 'open' : 'open');
		}
	} else if (normalizedDomain === 'media_player') {
		if (normalizedService === 'turn_on') setState('on');
		if (normalizedService === 'turn_off') setState('off');
		if (normalizedService === 'media_play' || normalizedService === 'play_media') setState('playing');
		if (normalizedService === 'media_pause') setState('paused');
		if (normalizedService === 'media_stop') setState('idle');
		const volume = numberAttribute(serviceData, 'volume_level');
		if (volume !== null) setAttr('volume_level', Math.max(0, Math.min(1, volume)));
		const muted = asBool(serviceData.is_volume_muted);
		if (muted !== null) setAttr('is_volume_muted', muted);
		if (typeof serviceData.source === 'string') setAttr('source', serviceData.source);
	} else if (normalizedDomain === 'vacuum') {
		if (normalizedService === 'start') setState('cleaning');
		if (normalizedService === 'pause') setState('paused');
		if (normalizedService === 'return_to_base') setState('returning');
		if (typeof serviceData.fan_speed === 'string') setAttr('fan_speed', serviceData.fan_speed);
	} else if (normalizedDomain === 'lock') {
		if (normalizedService === 'lock') setState('locked');
		if (normalizedService === 'unlock') setState('unlocked');
	}

	return changed ? patch : null;
}

function createEntityStore() {
	const { subscribe, update } = writable<EntityStoreState>(initialState);
	const optimisticOverrides = new Map<string, OptimisticEntityOverride>();

	const cleanupOptimisticOverrides = (now = Date.now()) => {
		for (const [entityId, override] of optimisticOverrides.entries()) {
			if (override.expiresAt <= now) optimisticOverrides.delete(entityId);
		}
	};

	const mergeOptimisticOverrides = (entities: HomeAssistantEntity[], now = Date.now()) => {
		cleanupOptimisticOverrides(now);
		if (optimisticOverrides.size === 0) return entities;
		return entities.map((entity) => {
			const override = optimisticOverrides.get(entity.entityId);
			if (!override) return entity;
			if (patchMatchesEntity(entity, override.patch)) {
				optimisticOverrides.delete(entity.entityId);
				return entity;
			}
			return applyOptimisticPatch(entity, override.patch);
		});
	};

	const service = createHomeAssistantEntitiesService({
		onSnapshot: (entities) =>
			update((state) => ({
				...state,
				entities: mergeOptimisticOverrides(entities),
				lastUpdated: Date.now(),
				error: '',
				status: 'ready'
			})),
		onStatus: (status) => update((state) => ({ ...state, status })),
		onError: (error) => update((state) => ({ ...state, error }))
	});
	let started = false;

	const start = () => {
		if (started) return;
		started = true;
		service.start();
	};

	const stop = () => {
		if (!started) return;
		started = false;
		service.stop();
	};

	if (typeof window !== 'undefined') start();

	return {
		subscribe,
		start,
		stop,
		setDomainFilter: (domain: string) => update((state) => ({ ...state, domainFilter: domain })),
		setQuery: (query: string) => update((state) => ({ ...state, query })),
		setFriendlyName: (entityId: string, friendlyName: string) => {
			setEntityNameOverride(entityId, friendlyName);
			update((state) => ({
				...state,
				entities: state.entities.map((entity) =>
					entity.entityId === entityId ? { ...entity, friendlyName: friendlyName.trim() } : entity
				)
			}));
		},
		applyServiceOptimism: (domain: string, serviceName: string, serviceData: Record<string, unknown>) => {
			const ids = new Set(serviceEntityIds(serviceData));
			if (ids.size === 0) return;
			const now = Date.now();
			update((state) => ({
				...state,
				lastUpdated: now,
				entities: state.entities.map((entity) => {
					if (!ids.has(entity.entityId)) return entity;
					const patch = optimisticPatchForService(entity, domain, serviceName, serviceData);
					if (!patch) return entity;
					optimisticOverrides.set(entity.entityId, {
						patch,
						expiresAt: now + OPTIMISTIC_STATE_TTL_MS
					});
					return applyOptimisticPatch(entity, patch);
				})
			}));
		},
		clearServiceOptimism: (serviceData: Record<string, unknown>) => {
			const ids = serviceEntityIds(serviceData);
			if (ids.length === 0) return;
			for (const id of ids) optimisticOverrides.delete(id);
			service.refresh(0);
		},
		refreshSoon: (delayMs = 120) => service.refresh(delayMs)
	};
}

export const entityStore = createEntityStore();

export const filteredEntities = derived(entityStore, ($state) =>
	filterEntities($state.entities, $state.domainFilter, $state.query)
);

export const entityDomains = derived(entityStore, ($state) => {
	const uniqueDomains = new Set($state.entities.map((entity) => entity.domain));
	return ['all', ...[...uniqueDomains].sort()];
});
