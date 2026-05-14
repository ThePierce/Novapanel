import {
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

	const clearReconnect = () => {
		if (!reconnectTimer) return;
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
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
		try {
			const connected = await connectWithDirectWebsocket();
			if (connected) {
				log('connected via direct websocket path');
				return;
			}
		} catch (error) {
			log('direct websocket path failed', error);
		}
		const hass = await getHassWithRetry();
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
			void connect();
		},
		stop() {
			isRunning = false;
			log('entity service stop');
			clearReconnect();
			teardownSubscription();
			closeDirectSocket();
		}
	};
}
