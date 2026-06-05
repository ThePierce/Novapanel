import {
	getNovaApiCandidates,
	getHassWithRetry,
	normalizeStates,
	type HomeAssistantEntity
} from './entities-service-helpers';
import { createDemoHomeAssistantEntities } from './demo-entities';

export type EntityStatus = 'connecting' | 'ready' | 'error';
export type { HomeAssistantEntity } from './entities-service-helpers';

type EntityServiceOptions = {
	onSnapshot: (entities: HomeAssistantEntity[]) => void;
	onStatus: (status: EntityStatus) => void;
	onError: (message: string) => void;
};

const HA_ENTITY_LOG_PREFIX = '[NovaPanel Entities]';
const HA_ENTITY_DEBUG = false;
const ENTITY_POLL_INTERVAL_MS = 1500;
const ENTITY_POLL_HIDDEN_INTERVAL_MS = 10000;
const ENTITY_POLL_MAX_ERROR_INTERVAL_MS = 30000;
const DEMO_RETRY_INTERVAL_MS = 15000;

function log(message: string, details?: unknown) {
	if (!HA_ENTITY_DEBUG) return;
	if (details === undefined) {
		console.log(`${HA_ENTITY_LOG_PREFIX} ${message}`);
		return;
	}
	console.log(`${HA_ENTITY_LOG_PREFIX} ${message}`, details);
}

function canUseDemoEntities(): boolean {
	if (typeof window === 'undefined') return false;
	try {
		const params = new URLSearchParams(window.location.search || '');
		if (params.get('demoEntities') === '1') return true;
		if (params.get('demoEntities') === '0') return false;
		const host = window.location.hostname;
		return host === 'localhost' || host === '127.0.0.1' || host === '::1';
	} catch {
		return false;
	}
}

export function createHomeAssistantEntitiesService(options: EntityServiceOptions) {
	let isRunning = false;
	let pollTimer: ReturnType<typeof setTimeout> | null = null;
	let pollInFlight = false;
	let pollErrorCount = 0;
	let demoRetryAt = 0;

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

	const publishDemoSnapshot = () => {
		if (!canUseDemoEntities()) return false;
		const entities = createDemoHomeAssistantEntities();
		log('publish demo entities snapshot', { count: entities.length });
		options.onSnapshot(entities);
		options.onStatus('ready');
		options.onError('');
		return true;
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
		if (demoRetryAt > Date.now() && publishDemoSnapshot()) {
			schedulePoll();
			return;
		}
		pollInFlight = true;
		try {
			const nextStates = await fetchPolledStates();
			pollErrorCount = 0;
			demoRetryAt = 0;
			publishSnapshot(nextStates);
		} catch (error) {
			if (publishDemoSnapshot()) {
				pollErrorCount = 0;
				demoRetryAt = Date.now() + DEMO_RETRY_INTERVAL_MS;
				return;
			}
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
		refresh(delayMs = 0) {
			if (!isRunning) return;
			clearPoll();
			if (delayMs > 0) {
				schedulePoll(delayMs);
				return;
			}
			void pollSnapshot();
		},
		stop() {
			isRunning = false;
			log('entity service stop');
			clearPoll();
			pollInFlight = false;
		}
	};
}
