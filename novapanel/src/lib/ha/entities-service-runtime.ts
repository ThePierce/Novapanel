import { getHaConnectionConfig, getSocketCandidates, type HassLike } from './entities-service-helpers';

type ServiceCallbacks = {
	isRunning: () => boolean;
	onStatusError: (code: string) => void;
	publishSnapshot: (states: Record<string, Record<string, unknown>>) => void;
	scheduleReconnect: () => void;
	log: (message: string, details?: unknown) => void;
};

type EmbeddedConnectorParams = ServiceCallbacks & {
	teardownSubscription: () => void;
	setUnsubscribe: (unsubscribe: (() => void) | null) => void;
	setEmbeddedStates: (next: Record<string, Record<string, unknown>>) => void;
};

type DirectConnectorParams = ServiceCallbacks & {
	resetRetryDelay: () => void;
	setWsRef: (ws: WebSocket | null) => void;
	getWsRef: () => WebSocket | null;
	resetWsStates: () => void;
	getWsStates: () => Record<string, Record<string, unknown>>;
	setWsStates: (next: Record<string, Record<string, unknown>>) => void;
	closeDirectSocket: () => void;
};

function maskToken(token: string): string {
	if (!token) return 'empty';
	if (token.length <= 8) return `${token.slice(0, 2)}***`;
	return `${token.slice(0, 4)}***${token.slice(-4)}`;
}

export function createEmbeddedHassConnector(params: EmbeddedConnectorParams) {
	const {
		isRunning,
		onStatusError,
		publishSnapshot,
		log,
		teardownSubscription,
		setUnsubscribe,
		setEmbeddedStates
	} = params;

	return async (hass: HassLike): Promise<boolean> => {
		log('trying embedded hass realtime path');
		if (!hass.states || Object.keys(hass.states).length === 0) {
			log('embedded hass has no states');
			onStatusError('hass_states_unavailable');
			return false;
		}
		publishSnapshot(hass.states);
		const connection = hass.connection;
		if (!connection?.subscribeMessage) {
			log('embedded hass subscribeMessage missing');
			return false;
		}
		teardownSubscription();
		log('subscribing embedded hass state_changed');
		const unsubscribe = await connection.subscribeMessage(
			(message) => {
				if (!isRunning() || !hass.states) return;
				const event = message as {
					event?: { data?: { entity_id?: string; new_state?: Record<string, unknown> | null } };
				};
				const data = event.event?.data;
				const entityId = data?.entity_id;
				if (!entityId) return;
				if (!data.new_state) {
					const { [entityId]: _removed, ...remaining } = hass.states;
					void _removed;
					hass.states = remaining;
					setEmbeddedStates(remaining);
					publishSnapshot(remaining);
					return;
				}
				const nextStates = { ...hass.states, [entityId]: data.new_state };
				hass.states = nextStates;
				setEmbeddedStates(nextStates);
				publishSnapshot(nextStates);
			},
			{ type: 'subscribe_events', event_type: 'state_changed' }
		);
		setUnsubscribe(unsubscribe);
		log('embedded hass realtime subscription active');
		return true;
	};
}

export function createDirectWebsocketConnector(params: DirectConnectorParams) {
	const {
		isRunning,
		onStatusError,
		publishSnapshot,
		scheduleReconnect,
		log,
		resetRetryDelay,
		setWsRef,
		getWsRef,
		resetWsStates,
		getWsStates,
		setWsStates,
		closeDirectSocket
	} = params;

	return async (): Promise<boolean> => {
		log('trying direct websocket realtime path');
		const config = await getHaConnectionConfig();
		if (!config) {
			log('direct websocket config unavailable');
			return false;
		}
		const socketCandidates = getSocketCandidates(config.hassUrl);
		if (socketCandidates.length === 0) {
			log('no websocket candidates generated');
			return false;
		}
		const getStatesId = 1;
		const subscribeId = 2;
		let receivedInitialSnapshot = false;
		let candidateIndex = -1;
		resetWsStates();
		const openCandidate = (index: number): boolean => {
			candidateIndex = index;
			const socketUrl = socketCandidates[index];
			if (!socketUrl) return false;
			if (window.location.protocol === 'https:' && socketUrl.startsWith('ws://')) {
				log('mixed content risk detected', { pageProtocol: window.location.protocol, socketUrl });
			}
			log('opening direct websocket', { socketUrl, tokenMasked: maskToken(config.token) });
			log('trying websocket candidate', { socketUrl });
			try {
				const socket = new WebSocket(socketUrl);
				setWsRef(socket);
				socket.onopen = () => {
					log('direct websocket open', { socketUrl });
				};
				socket.onmessage = (event) => {
					const currentWs = getWsRef();
					if (!isRunning() || !currentWs || currentWs !== socket) return;
					try {
						const payload = JSON.parse(String(event.data)) as Record<string, unknown>;
						const type = typeof payload.type === 'string' ? payload.type : '';
						if (type) log('direct websocket message type', { type, id: payload.id });
						if (type === 'auth_required') {
							log('sending auth message');
							currentWs.send(JSON.stringify({ type: 'auth', access_token: config.token }));
							return;
						}
						if (type === 'auth_invalid') {
							log('auth invalid', payload);
							onStatusError('ha_ws_auth_invalid');
							closeDirectSocket();
							scheduleReconnect();
							return;
						}
						if (type === 'auth_ok') {
							log('auth ok, requesting states and subscribing events');
							resetRetryDelay();
							currentWs.send(JSON.stringify({ id: getStatesId, type: 'get_states' }));
							currentWs.send(
								JSON.stringify({
									id: subscribeId,
									type: 'subscribe_events',
									event_type: 'state_changed'
								})
							);
							return;
						}
						if (type === 'result' && payload.id === getStatesId && Array.isArray(payload.result)) {
							const nextStates: Record<string, Record<string, unknown>> = {};
							for (const item of payload.result as Array<Record<string, unknown>>) {
								const entityId = typeof item.entity_id === 'string' ? item.entity_id : '';
								if (!entityId) continue;
								nextStates[entityId] = item;
							}
							setWsStates(nextStates);
							receivedInitialSnapshot = true;
							log('received get_states result', { count: Object.keys(nextStates).length });
							publishSnapshot(nextStates);
							return;
						}
						if (type === 'result' && payload.id === subscribeId && payload.success === false) {
							log('subscribe_events result failed', payload);
							onStatusError('ha_ws_subscribe_failed');
							closeDirectSocket();
							scheduleReconnect();
							return;
						}
						if (type === 'event' && payload.id === subscribeId) {
							const eventData = (payload.event as { data?: Record<string, unknown> } | undefined)?.data;
							const entityId = typeof eventData?.entity_id === 'string' ? eventData.entity_id : '';
							const newState = eventData?.new_state as Record<string, unknown> | null | undefined;
							if (!entityId) return;
							if (!newState) {
								const { [entityId]: _removed, ...remaining } = getWsStates();
								void _removed;
								setWsStates(remaining);
								publishSnapshot(remaining);
								return;
							}
							const nextStates = { ...getWsStates(), [entityId]: newState };
							setWsStates(nextStates);
							publishSnapshot(nextStates);
						}
					} catch (error) {
						log('websocket message parse failed', { raw: String(event.data).slice(0, 400), error });
						params.onStatusError('ha_ws_message_parse_failed');
					}
				};
				socket.onerror = (error) => {
					log('direct websocket error', { socketUrl, error });
					onStatusError('ha_ws_connection_error');
				};
				socket.onclose = (event) => {
					const currentWs = getWsRef();
					if (currentWs && currentWs !== socket) return;
					log('direct websocket closed', { socketUrl, code: event.code, reason: event.reason, wasClean: event.wasClean });
					setWsRef(null);
					if (!isRunning()) return;
					if (!receivedInitialSnapshot && openCandidate(candidateIndex + 1)) return;
					onStatusError(`ha_ws_disconnected_${event.code}`);
					scheduleReconnect();
				};
				return true;
			} catch (error) {
				log('websocket constructor failed', { socketUrl, error });
				return openCandidate(index + 1);
			}
		};
		if (!openCandidate(0)) {
			onStatusError('ha_ws_constructor_failed');
			return false;
		}
		return true;
	};
}
