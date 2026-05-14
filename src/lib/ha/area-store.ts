import { writable, derived } from 'svelte/store';
import { getHassWithRetry, getNovaApiCandidates } from './entities-service-helpers';

export type HaArea = {
	area_id: string;
	name: string;
	aliases?: string[];
};

export type HaEntityRegistryEntry = {
	entity_id: string;
	area_id: string | null;
	device_id: string | null;
};

export type HaDeviceRegistryEntry = {
	id: string;
	area_id: string | null;
};

type AreaStoreState = {
	areas: HaArea[];
	entityAreaMap: Record<string, string>; // entity_id → area_id
	loaded: boolean;
};

const initialState: AreaStoreState = { areas: [], entityAreaMap: {}, loaded: false };

function createAreaStore() {
	const { subscribe, set } = writable<AreaStoreState>(initialState);

	async function callHaWs<T>(payload: Record<string, unknown>): Promise<T> {
		const hass = await getHassWithRetry(1, 0);
		if (hass?.callWS) return await hass.callWS(payload) as T;
		let lastError: unknown = null;
		for (const endpoint of getNovaApiCandidates('/api/ha/ws')) {
			try {
				const response = await fetch(endpoint, {
					method: 'POST',
					credentials: 'same-origin',
					cache: 'no-store',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ payload, timeoutMs: 12000 })
				});
				if (!response.ok) throw new Error(`ha_ws_proxy_http_${response.status}`);
				const data = (await response.json()) as { ok?: boolean; result?: T; error?: string };
				if (data.ok !== true) throw new Error(data.error || 'ha_ws_proxy_failed');
				return data.result as T;
			} catch (error) {
				lastError = error;
			}
		}
		throw lastError ?? new Error('ha_ws_proxy_unavailable');
	}

	async function load() {
		try {
			const [areaList, entityList, deviceList] = await Promise.all([
				callHaWs<HaArea[]>({ type: 'config/area_registry/list' }),
				callHaWs<HaEntityRegistryEntry[]>({ type: 'config/entity_registry/list' }),
				callHaWs<HaDeviceRegistryEntry[]>({ type: 'config/device_registry/list' })
			]);

			// Build device → area map as fallback
			const deviceAreaMap: Record<string, string> = {};
			for (const d of deviceList ?? []) {
				if (d.id && d.area_id) deviceAreaMap[d.id] = d.area_id;
			}

			// Build entity → area map (entity area takes precedence over device area)
			const entityAreaMap: Record<string, string> = {};
			for (const e of entityList ?? []) {
				const area = e.area_id ?? (e.device_id ? deviceAreaMap[e.device_id] : null);
				if (e.entity_id && area) entityAreaMap[e.entity_id] = area;
			}

			set({ areas: areaList ?? [], entityAreaMap, loaded: true });
		} catch {
			set({ areas: [], entityAreaMap: {}, loaded: true });
		}
	}

	if (typeof window !== 'undefined') {
		// Small delay to let HA connection establish first
		setTimeout(() => void load(), 1500);
	}

	return { subscribe, reload: load };
}

export const areaStore = createAreaStore();

/** Returns a map of area_id → HaArea for quick lookup */
export const areaById = derived(areaStore, ($s) => {
	const map: Record<string, HaArea> = {};
	for (const a of $s.areas) map[a.area_id] = a;
	return map;
});
