import {
	getNovaApiCandidates,
	getHassWithRetry,
	normalizeStates,
	type HomeAssistantEntity
} from './entities-service-helpers';

export type EntityStatus = 'connecting' | 'ready' | 'error';
export type { HomeAssistantEntity } from './entities-service-helpers';

type EntityServiceOptions = {
	onSnapshot: (entities: HomeAssistantEntity[]) => void;
	onStatus: (status: EntityStatus) => void;
	onError: (message: string) => void;
};

const HA_ENTITY_LOG_PREFIX = '[NovaPanel Entities]';
const HA_ENTITY_DEBUG = false;
const ENTITY_POLL_INTERVAL_MS = 5000;
const ENTITY_POLL_HIDDEN_INTERVAL_MS = 15000;
const ENTITY_POLL_MAX_ERROR_INTERVAL_MS = 30000;

function log(message: string, details?: unknown) {
	if (!HA_ENTITY_DEBUG) return;
	if (details === undefined) {
		console.log(`${HA_ENTITY_LOG_PREFIX} ${message}`);
		return;
	}
	console.log(`${HA_ENTITY_LOG_PREFIX} ${message}`, details);
}


export function createHomeAssistantEntitiesService(options: EntityServiceOptions) {
	let isRunning = false;
	let pollTimer: ReturnType<typeof setTimeout> | null = null;
	let pollInFlight = false;
	let pollErrorCount = 0;

	const clearPoll = () => {
		if (!pollTimer) return;
		clearTimeout(pollTimer);
		pollTimer = null;
	};

	const publishSnapshot = (states: Record<string, Record<string, unknown>>) => {
		log('publish entities snapshot', { count: Object.keys(states).length });
		options.onSnapshot(normalizeStates(states));
		options.onStatus('ready');
		options.onError('');
	};

	const statesArrayToMap = (items: Array<Record<string, unknown>>) => {
		const nextStates: Record<string, Record<string, unknown>> = {};
		for (const item of items) {
			const entityId = typeof item.entity_id === 'string' ? item.entity_id : '';
			if (!entityId) continue;
			nextStates[entityId] = item;
		}
		return nextStates;
	};

	const fetchStatesViaRestProxy = async () => {
		let lastError: unknown = null;
		for (const endpoint of getNovaApiCandidates('/api/ha/states')) {
			try {
				const response = await fetch(endpoint, {
					credentials: 'same-origin',
					cache: 'no-store',
					headers: { accept: 'application/json' }
				});
				if (!response.ok) throw new Error(`ha_states_proxy_http_${response.status}`);
				const data = (await response.json()) as unknown;
				if (!Array.isArray(data)) throw new Error('ha_states_proxy_invalid_response');
				return statesArrayToMap(data as Array<Record<string, unknown>>);
			} catch (error) {
				lastError = error;
			}
		}
		throw lastError ?? new Error('ha_states_proxy_unavailable');
	};

	const fetchStatesViaWsProxy = async () => {
		let lastError: unknown = null;
		for (const endpoint of getNovaApiCandidates('/api/ha/ws')) {
			try {
				const response = await fetch(endpoint, {
					method: 'POST',
					credentials: 'same-origin',
					cache: 'no-store',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ payload: { type: 'get_states' }, timeoutMs: 15000 })
				});
				if (!response.ok) throw new Error(`ha_ws_proxy_http_${response.status}`);
				const data = (await response.json()) as { ok?: boolean; result?: unknown; error?: string };
				if (data.ok !== true) throw new Error(data.error || 'ha_ws_proxy_failed');
				if (!Array.isArray(data.result)) throw new Error('ha_ws_proxy_invalid_response');
				return statesArrayToMap(data.result as Array<Record<string, unknown>>);
			} catch (error) {
				lastError = error;
			}
		}
		throw lastError ?? new Error('ha_ws_proxy_unavailable');
	};

	const fetchPolledStates = async () => {
		try {
			return await fetchStatesViaRestProxy();
		} catch (restError) {
			log('REST state poll failed, trying websocket proxy', restError);
			try {
				return await fetchStatesViaWsProxy();
			} catch (wsError) {
				log('websocket state poll failed, trying embedded hass snapshot', wsError);
				const hass = await getHassWithRetry(1, 0);
				if (hass?.states && Object.keys(hass.states).length > 0) return hass.states;
				throw wsError;
			}
		}
	};

	const pollDelay = () => {
		const base =
			typeof document !== 'undefined' && document.visibilityState === 'hidden'
				? ENTITY_POLL_HIDDEN_INTERVAL_MS
				: ENTITY_POLL_INTERVAL_MS;
		if (pollErrorCount <= 0) return base;
		return Math.min(base * 2 ** Math.min(pollErrorCount, 3), ENTITY_POLL_MAX_ERROR_INTERVAL_MS);
	};

	const schedulePoll = (delayMs = pollDelay()) => {
		if (!isRunning) return;
		clearPoll();
		pollTimer = setTimeout(() => {
			void pollSnapshot();
		}, delayMs);
	};

	const pollSnapshot = async () => {
		if (!isRunning || pollInFlight) {
			schedulePoll();
			return;
		}
		pollInFlight = true;
		try {
			const nextStates = await fetchPolledStates();
			pollErrorCount = 0;
			publishSnapshot(nextStates);
		} catch (error) {
			pollErrorCount += 1;
			log('state poll failed', error);
		} finally {
			pollInFlight = false;
			schedulePoll();
		}
	};

	const publishEmbeddedSnapshot = async () => {
		if (!isRunning) return;
		log('embedded snapshot check start');
		options.onStatus('connecting');
		options.onError('');
		const hass = await getHassWithRetry(3, 150);
		if (hass?.states && Object.keys(hass.states).length > 0) {
			publishSnapshot(hass.states);
		}
	};

	return {
		start() {
			if (isRunning) return;
			isRunning = true;
			log('entity service start');
			pollErrorCount = 0;
			schedulePoll(250);
			void publishEmbeddedSnapshot();
		},
		stop() {
			isRunning = false;
			log('entity service stop');
			clearPoll();
			pollInFlight = false;
		}
	};
}
