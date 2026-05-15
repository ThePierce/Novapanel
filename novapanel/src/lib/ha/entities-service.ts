import {
	getNovaApiCandidates,
	getHassWithRetry,
	normalizeStates,
	type HomeAssistantEntity
} from './entities-service-helpers';
import { createDirectWebsocketConnector, createEmbeddedHassConnector } from './entities-service-runtime';

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
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let unsubscribe: (() => void) | null = null;
	let ws: WebSocket | null = null;
	let wsStates: Record<string, Record<string, unknown>> = {};
	let retryDelay = 1000;
	let pollTimer: ReturnType<typeof setTimeout> | null = null;
	let pollInFlight = false;
	let pollErrorCount = 0;

	const clearReconnect = () => {
		if (!reconnectTimer) return;
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	};

	const clearPoll = () => {
		if (!pollTimer) return;
		clearTimeout(pollTimer);
		pollTimer = null;
	};

	const teardownSubscription = () => {
		if (!unsubscribe) return;
		unsubscribe();
		unsubscribe = null;
	};

	const closeDirectSocket = () => {
		if (!ws) return;
		try {
			ws.close();
		} catch {}
		ws = null;
	};

	const scheduleReconnect = () => {
		if (!isRunning) return;
		clearReconnect();
		log('schedule reconnect', { retryDelay });
		reconnectTimer = setTimeout(connect, retryDelay);
		retryDelay = Math.min(retryDelay * 2, 15000);
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
			wsStates = nextStates;
			publishSnapshot(nextStates);
		} catch (error) {
			pollErrorCount += 1;
			log('state poll failed', error);
		} finally {
			pollInFlight = false;
			schedulePoll();
		}
	};

	const onStatusError = (code: string) => {
		options.onStatus('error');
		options.onError(code);
	};

	const connectWithEmbeddedHass = createEmbeddedHassConnector({
		isRunning: () => isRunning,
		onStatusError,
		publishSnapshot,
		log,
		teardownSubscription,
		setUnsubscribe: (next) => {
			unsubscribe = next;
		},
		setEmbeddedStates: (next) => {
			// Keep the service-level snapshot in sync regardless of data source.
			wsStates = next;
		}
	});

	const connectWithDirectWebsocket = createDirectWebsocketConnector({
		isRunning: () => isRunning,
		onStatusError,
		publishSnapshot,
		scheduleReconnect,
		log,
		resetRetryDelay: () => {
			retryDelay = 1000;
		},
		setWsRef: (next) => {
			ws = next;
		},
		getWsRef: () => ws,
		resetWsStates: () => {
			wsStates = {};
		},
		getWsStates: () => wsStates,
		setWsStates: (next) => {
			wsStates = next;
		},
		closeDirectSocket
	});

	const connect = async () => {
		if (!isRunning) return;
		log('connect cycle start');
		options.onStatus('connecting');
		options.onError('');
		closeDirectSocket();
		const hass = await getHassWithRetry(3, 150);
		if (hass) {
			try {
				const connected = await connectWithEmbeddedHass(hass);
				if (connected) {
					log('connected via embedded hass path');
					return;
				}
			} catch (error) {
				log('embedded hass path failed', error);
			}
		}
		try {
			const connected = await connectWithDirectWebsocket();
			if (connected) {
				log('connected via direct websocket path');
				return;
			}
		} catch (error) {
			log('direct websocket path failed', error);
		}
		log('all realtime paths failed');
		options.onStatus('error');
		options.onError('realtime_connection_unavailable');
		scheduleReconnect();
	};

	return {
		start() {
			if (isRunning) return;
			isRunning = true;
			log('entity service start');
			pollErrorCount = 0;
			schedulePoll(250);
			void connect();
		},
		stop() {
			isRunning = false;
			log('entity service stop');
			clearReconnect();
			clearPoll();
			pollInFlight = false;
			teardownSubscription();
			closeDirectSocket();
		}
	};
}
