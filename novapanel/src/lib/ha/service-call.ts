import {
	getHaConnectionConfig,
	getHassWithRetry,
	getNovaApiCandidates,
	type HassLike
} from '$lib/ha/entities-service-helpers';
import { entityStore } from '$lib/ha/entities-store';

let cachedHass: HassLike | null = null;
let hassLookupDone = false;

async function getEmbeddedHassQuick(): Promise<HassLike | null> {
	if (!hassLookupDone) {
		cachedHass = await getHassWithRetry(1, 0);
		hassLookupDone = true;
	}
	return cachedHass;
}

function validateServicePathPart(value: string): string {
	const normalized = value.trim();
	if (!/^[A-Za-z0-9_]+$/.test(normalized)) throw new Error('invalid_ha_service_path');
	return normalized;
}

async function callViaSameOriginService(domain: string, service: string, serviceData: Record<string, unknown>) {
	const safeDomain = validateServicePathPart(domain);
	const safeService = validateServicePathPart(service);
	let lastError: unknown = null;
	for (const endpoint of getNovaApiCandidates(`/api/services/${safeDomain}/${safeService}`)) {
		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				credentials: 'same-origin',
				cache: 'no-store',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(serviceData)
			});
			if (!response.ok) {
				const text = await response.text().catch(() => '');
				throw new Error(text || `ha_same_origin_service_http_${response.status}`);
			}
			return;
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError ?? new Error('ha_same_origin_service_unavailable');
}

async function callViaNovaWsProxy(payload: Record<string, unknown>) {
	let lastError: unknown = null;
	for (const endpoint of getNovaApiCandidates('/api/ha/ws')) {
		try {
			const response = await fetch(endpoint, {
				method: 'POST',
				credentials: 'same-origin',
				cache: 'no-store',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ payload, timeoutMs: 15000 })
			});
			if (!response.ok) throw new Error(`ha_ws_proxy_http_${response.status}`);
			const data = (await response.json()) as { ok?: boolean; error?: string };
			if (data.ok !== true) throw new Error(data.error || 'ha_ws_proxy_failed');
			return;
		} catch (error) {
			lastError = error;
		}
	}
	throw lastError ?? new Error('ha_ws_proxy_unavailable');
}

async function callHaServiceTransport(
	domain: string,
	service: string,
	serviceData: Record<string, unknown> = {}
) {
	const wsPayload = {
		type: 'call_service',
		domain,
		service,
		service_data: serviceData
	};
	let proxyError: unknown = null;
	try {
		await callViaSameOriginService(domain, service, serviceData);
		return;
	} catch (error) {
		proxyError = error;
	}

	const hass = await getEmbeddedHassQuick();
	cachedHass = hass;
	if (hass) {
		const callService = (hass as unknown as {
			callService?: (domain: string, service: string, data?: Record<string, unknown>) => Promise<unknown>;
		}).callService;
		if (typeof callService === 'function') {
			await callService(domain, service, serviceData);
			return;
		}
		if (typeof hass.callWS === 'function') {
			await hass.callWS(wsPayload);
			return;
		}
		if (typeof hass.connection?.sendMessagePromise === 'function') {
			await hass.connection.sendMessagePromise(wsPayload);
			return;
		}
	}

	try {
		await callViaNovaWsProxy(wsPayload);
		return;
	} catch (error) {
		proxyError = error;
	}

	const config = await getHaConnectionConfig();
	if (!config?.hassUrl || !config.token) {
		throw new Error('home_assistant_service_unavailable');
	}
	try {
		const targetOrigin = new URL(config.hassUrl, window.location.origin).origin;
		if (targetOrigin !== window.location.origin) {
			throw proxyError ?? new Error('ha_ws_proxy_unavailable');
		}
	} catch (error) {
		if (error === proxyError) throw error;
		throw proxyError ?? error;
	}
	const response = await fetch(
		`${config.hassUrl.replace(/\/+$/, '')}/api/services/${domain}/${service}`,
		{
			method: 'POST',
			headers: {
				authorization: `Bearer ${config.token}`,
				'content-type': 'application/json'
			},
			body: JSON.stringify(serviceData)
		}
	);
	if (!response.ok) {
		const text = await response.text();
		throw new Error(text || `http_${response.status}`);
	}
}

export async function callHaService(
	domain: string,
	service: string,
	serviceData: Record<string, unknown> = {}
) {
	if (typeof window !== 'undefined') {
		entityStore.applyServiceOptimism(domain, service, serviceData);
	}
	try {
		await callHaServiceTransport(domain, service, serviceData);
		if (typeof window !== 'undefined') {
			entityStore.refreshSoon(120);
		}
	} catch (error) {
		if (typeof window !== 'undefined') {
			entityStore.clearServiceOptimism(serviceData);
		}
		throw error;
	}
}
