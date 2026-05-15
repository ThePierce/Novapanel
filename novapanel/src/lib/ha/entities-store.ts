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

function createEntityStore() {
	const { subscribe, update } = writable<EntityStoreState>(initialState);
	const service = createHomeAssistantEntitiesService({
		onSnapshot: (entities) =>
			update((state) => ({ ...state, entities, lastUpdated: Date.now(), error: '', status: 'ready' })),
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
		}
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
