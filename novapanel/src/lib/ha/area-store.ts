import { writable, derived } from 'svelte/store';
import { getHassWithRetry, getNovaApiCandidates } from './entities-service-helpers';
import { fetchWithTimeout } from '$lib/fetch-with-timeout';

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
const AREA_LOAD_RETRY_DELAYS_MS = [1500, 3000, 6000, 12000, 30000];

function createAreaStore() {
	const { subscribe, set } = writable<AreaStoreState>(initialState);
	let retryTimer: ReturnType<typeof setTimeout> | null = null;
	let loadAttempt = 0;

	function clearRetryTimer() {
		if (!retryTimer) return;
		clearTimeout(retryTimer);
		retryTimer = null;
	}

	function scheduleLoad(delayMs: number) {
		clearRetryTimer();
		retryTimer = setTimeout(() => {
			retryTimer = null;
			void load();
		}, delayMs);
	}

	async function callHaWs<T>(payload: Record<string, unknown>): Promise<T> {
		const hass = await getHassWithRetry(1, 0);
		if (hass?.callWS) return (await hass.callWS(payload)) as T;
		let lastError: unknown = null;
		for (const endpoint of getNovaApiCandidates('/api/ha/ws')) {
			try {
				const response = await fetchWithTimeout(
					endpoint,
					{
						method: 'POST',
						credentials: 'same-origin',
						cache: 'no-store',
						headers: { 'content-type': 'application/json' },
						body: JSON.stringify({ payload, timeoutMs: 12000 })
					},
					14000
				);
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
			loadAttempt = 0;
		} catch {
			const delay = AREA_LOAD_RETRY_DELAYS_MS[loadAttempt];
			loadAttempt += 1;
			set({ areas: [], entityAreaMap: {}, loaded: delay === undefined });
			if (delay !== undefined) scheduleLoad(delay);
		}
	}

	if (typeof window !== 'undefined') {
		// Small delay to let HA connection establish first
		scheduleLoad(1500);
	}

	return {
		subscribe,
		reload: () => {
			loadAttempt = 0;
			clearRetryTimer();
			return load();
		}
	};
}

export const areaStore = createAreaStore();

/** Returns a map of area_id → HaArea for quick lookup */
export const areaById = derived(areaStore, ($s) => {
	const map: Record<string, HaArea> = {};
	for (const a of $s.areas) map[a.area_id] = a;
	return map;
});
