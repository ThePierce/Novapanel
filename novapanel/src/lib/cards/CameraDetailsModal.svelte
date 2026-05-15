<script lang="ts">
	import { parse as parseYaml } from 'yaml';
	import { entityStore } from '$lib/ha/entities-store';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import {
		browserSafeHomeAssistantUrl,
		getHaConnectionConfig,
		getHassWithRetry,
		getNovaApiCandidates,
		getNovaApiUrl,
		getNovaWebSocketCandidates,
		type HassLike
	} from '$lib/ha/entities-service-helpers';
	import HaCameraLiveView from '$lib/cards/HaCameraLiveView.svelte';
	import type { CameraConfig } from '$lib/persistence/panel-state-types';
	import { selectedLanguageStore, translate } from '$lib/i18n';

	type AdvancedCameraCardElement = HTMLElement & {
		setConfig?: (config: Record<string, unknown>) => void;
		hass?: HassLike;
	};

	type LovelaceHelpers = {
		createCardElement?: (config: Record<string, unknown>) => HTMLElement;
		createEntityRowElement?: (config: Record<string, unknown>) => HTMLElement;
		createHeaderFooterElement?: (config: Record<string, unknown>) => HTMLElement;
		createRowElement?: (config: Record<string, unknown>) => HTMLElement;
		createHuiElement?: (tagName: string) => HTMLElement;
		importMoreInfoControl?: (domain: string) => Promise<void> | void;
	};

	type NovaWindow = Window & {
		customCards?: Array<Record<string, unknown>>;
		loadCardHelpers?: () => Promise<LovelaceHelpers>;
	};

	type Props = {
		camera: CameraConfig;
		onClose: () => void;
	};

	const ADVANCED_CAMERA_ELEMENT = 'advanced-camera-card';
	const ADVANCED_CAMERA_RESOURCE_PATHS = [
		'/hacsfiles/advanced-camera-card/advanced-camera-card.js',
		'/local/community/advanced-camera-card/advanced-camera-card.js',
		'/local/advanced-camera-card/advanced-camera-card.js'
	];
	const CAMERA_DEBUG = false;

	let advancedCameraCardLoad: Promise<void> | null = null;

	function asRecord(value: unknown): Record<string, unknown> {
		return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
	}

	function parseAdvancedConfig(raw: string | undefined): Record<string, unknown> {
		const text = raw?.trim() ?? '';
		if (!text) return {};
		try {
			return asRecord(JSON.parse(text));
		} catch {}
		return asRecord(parseYaml(text));
	}

	function cameraEntryMatches(entry: unknown, entityId: string): boolean {
		const cameraEntry = asRecord(entry);
		return cameraEntry.camera_entity === entityId;
	}

	function findAdvancedCameraCardConfig(value: unknown, entityId: string): Record<string, unknown> | null {
		if (Array.isArray(value)) {
			for (const item of value) {
				const found = findAdvancedCameraCardConfig(item, entityId);
				if (found) return found;
			}
			return null;
		}
		const record = asRecord(value);
		if (Object.keys(record).length === 0) return null;
		if (record.type === 'custom:advanced-camera-card') {
			const cameras = Array.isArray(record.cameras) ? record.cameras : [];
			if (cameras.length === 0 || cameras.some((entry) => cameraEntryMatches(entry, entityId))) {
				return record;
			}
		}
		for (const nested of Object.values(record)) {
			const found = findAdvancedCameraCardConfig(nested, entityId);
			if (found) return found;
		}
		return null;
	}

	function removeCloseMenuButtons(config: Record<string, unknown>) {
		if (!config.menu) return;
		const menu = asRecord(config.menu);
		const buttons = asRecord(menu.buttons);
		for (const key of ['close', 'dismiss']) {
			if (key in buttons) delete buttons[key];
		}
		buttons.expand = { ...asRecord(buttons.expand), enabled: false };
		menu.buttons = buttons;
		config.menu = menu;
	}

	function buildAdvancedConfig(cameraConfig: CameraConfig): Record<string, unknown> {
		const parsed = parseAdvancedConfig(cameraConfig.advancedConfig);
		const config = findAdvancedCameraCardConfig(parsed, cameraConfig.entityId) ?? parsed;
		config.type = typeof config.type === 'string' && config.type.trim().length > 0
			? config.type
			: 'custom:advanced-camera-card';

		if (!Array.isArray(config.cameras) || config.cameras.length === 0) {
			config.cameras = [{ camera_entity: cameraConfig.entityId }];
		} else {
			config.cameras = config.cameras.map((entry, index) => {
				const cameraEntry = asRecord(entry);
				if (index === 0 && !cameraEntry.camera_entity && !cameraEntry.frigate && !cameraEntry.go2rtc) {
					cameraEntry.camera_entity = cameraConfig.entityId;
				}
				return cameraEntry;
			});
		}

		const live = asRecord(config.live);
		if (!Array.isArray(live.auto_play)) live.auto_play = ['visible', 'selected'];
		if (!Array.isArray(live.auto_unmute)) live.auto_unmute = ['visible', 'selected'];
		if (live.show_image_during_load === undefined) live.show_image_during_load = true;
		config.live = live;

		removeCloseMenuButtons(config);
		return config;
	}

	function resourceCandidates(hassBase: string): string[] {
		const candidates = new Set<string>();
		for (const path of ADVANCED_CAMERA_RESOURCE_PATHS) candidates.add(path);
		const base = hassBase.replace(/\/+$/, '');
		if (base) {
			for (const path of ADVANCED_CAMERA_RESOURCE_PATHS) candidates.add(`${base}${path}`);
		}
		return [...candidates];
	}

	function safeCustomElementName(name: string): string {
		const candidate = name.trim();
		return /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(candidate) ? candidate : 'div';
	}

	function createFallbackCardElement(config: Record<string, unknown>): HTMLElement {
		const rawType = typeof config.type === 'string' ? config.type.trim() : '';
		const tagName = rawType.startsWith('custom:')
			? rawType.slice(7)
			: rawType
				? `hui-${rawType}-card`
				: '';
		const element = document.createElement(safeCustomElementName(tagName)) as AdvancedCameraCardElement;
		if (typeof element.setConfig === 'function') element.setConfig(config);
		return element;
	}

	function createFallbackRowElement(config: Record<string, unknown>): HTMLElement {
		const rawType = typeof config.type === 'string' ? config.type.trim() : 'entity';
		const tagName = rawType.startsWith('custom:') ? rawType.slice(7) : `hui-${rawType}-entity-row`;
		const element = document.createElement(safeCustomElementName(tagName)) as AdvancedCameraCardElement;
		if (typeof element.setConfig === 'function') element.setConfig(config);
		return element;
	}

	function createFallbackHuiElement(tagName: string): HTMLElement {
		return document.createElement(safeCustomElementName(tagName));
	}

	function getParentCardHelpers(): (() => Promise<LovelaceHelpers>) | null {
		if (typeof window === 'undefined') return null;
		const candidates: Window[] = [];
		try {
			if (window.parent && window.parent !== window) candidates.push(window.parent);
		} catch {}
		try {
			if (window.top && window.top !== window && !candidates.includes(window.top)) candidates.push(window.top);
		} catch {}

		for (const candidate of candidates) {
			try {
				const helper = (candidate as NovaWindow).loadCardHelpers;
				if (typeof helper === 'function') {
					return () => helper.call(candidate);
				}
			} catch {}
		}
		return null;
	}

	function ensureLovelaceCardHelpers() {
		if (typeof window === 'undefined') return;
		const novaWindow = window as NovaWindow;
		if (typeof novaWindow.loadCardHelpers === 'function') return;

		const parentHelpers = getParentCardHelpers();
		if (parentHelpers) {
			novaWindow.loadCardHelpers = parentHelpers;
			return;
		}

		if (!Array.isArray(novaWindow.customCards)) novaWindow.customCards = [];
		novaWindow.loadCardHelpers = async () => ({
			createCardElement: createFallbackCardElement,
			createEntityRowElement: createFallbackRowElement,
			createHeaderFooterElement: createFallbackCardElement,
			createRowElement: createFallbackRowElement,
			createHuiElement: createFallbackHuiElement,
			importMoreInfoControl: async () => {}
		});
	}

	async function loadAdvancedCameraCard(hassBase: string): Promise<void> {
		ensureLovelaceCardHelpers();
		if (typeof customElements !== 'undefined' && customElements.get(ADVANCED_CAMERA_ELEMENT)) return;
		if (!advancedCameraCardLoad) {
			advancedCameraCardLoad = (async () => {
				let lastError: unknown = null;
				for (const src of resourceCandidates(hassBase)) {
					try {
						await import(/* @vite-ignore */ src);
						await customElements.whenDefined(ADVANCED_CAMERA_ELEMENT);
						return;
					} catch (error) {
						lastError = error;
					}
				}
				throw lastError ?? new Error('advanced_camera_card_resource_not_found');
			})();
		}
		await advancedCameraCardLoad;
	}

	async function callHaWs(params: Record<string, unknown>): Promise<unknown> {
		let lastError: unknown = null;
		for (const endpoint of getNovaApiCandidates('/api/ha/ws')) {
			try {
				const response = await fetch(endpoint, {
					method: 'POST',
					credentials: 'same-origin',
					cache: 'no-store',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ payload: params, timeoutMs: 15000 })
				});
				if (!response.ok) throw new Error(`ha_ws_proxy_http_${response.status}`);
				const payload = asRecord(await response.json());
				if (payload.ok !== true) throw new Error(typeof payload.error === 'string' ? payload.error : 'ha_ws_proxy_failed');
				return payload.result;
			} catch (error) {
				lastError = error;
			}
		}
		throw lastError ?? new Error('ha_ws_proxy_unavailable');
	}

	async function subscribeHaWs(
		callback: (message: unknown) => void,
		params: Record<string, unknown>
	): Promise<() => void> {
		const candidates = getNovaWebSocketCandidates('/api/ha/websocket');
		if (candidates.length === 0) throw new Error('ha_ws_proxy_candidates_unavailable');
		let lastError: unknown = null;
		for (const socketUrl of candidates) {
			try {
				return await new Promise<() => void>((resolve, reject) => {
					const id = Math.floor(Date.now() + Math.random() * 100000);
					const ws = new WebSocket(socketUrl);
					let closed = false;
					let resolved = false;
					const cleanup = () => {
						closed = true;
						try { ws.close(); } catch {}
					};
					const timeout = window.setTimeout(() => {
						cleanup();
						if (!resolved) reject(new Error('ha_ws_timeout'));
					}, 12000);
					ws.onmessage = (event) => {
						if (closed) return;
						try {
							const payload = JSON.parse(String(event.data)) as Record<string, unknown>;
							const type = typeof payload.type === 'string' ? payload.type : '';
							if (type === 'auth_required') {
								getHaConnectionConfig()
									.then((config) => {
										if (!closed && config?.token) ws.send(JSON.stringify({ type: 'auth', access_token: config.token }));
									})
									.catch(() => {});
								return;
							}
							if (type === 'auth_invalid') {
								clearTimeout(timeout);
								cleanup();
								if (!resolved) reject(new Error('ha_ws_auth_invalid'));
								return;
							}
							if (type === 'auth_ok') {
								ws.send(JSON.stringify({ id, ...params }));
								return;
							}
							if (type === 'result' && payload.id === id) {
								clearTimeout(timeout);
								if (payload.success === false) {
									cleanup();
									if (!resolved) reject(new Error('ha_ws_result_failed'));
									return;
								}
								resolved = true;
								resolve(cleanup);
								return;
							}
							if (payload.id === id) callback(payload.event ?? payload);
						} catch (error) {
							clearTimeout(timeout);
							cleanup();
							if (!resolved) reject(error);
						}
					};
					ws.onerror = () => {
						clearTimeout(timeout);
						cleanup();
						if (!resolved) reject(new Error('ha_ws_connection_error'));
					};
				});
			} catch (error) {
				lastError = error;
			}
		}
		throw lastError ?? new Error('ha_ws_proxy_failed');
	}

	let { camera, onClose }: Props = $props();

	const entities = $derived($entityStore.entities);
	const entity = $derived(entities.find((e) => e.entityId === camera.entityId));
	const friendly = $derived(entity?.friendlyName || camera.entityId);
	const name = $derived(camera.alias && camera.alias.trim().length > 0 ? camera.alias : friendly);

	let hassUrl = $state<string>('');
	let configLoadAttempted = $state(false);
	$effect(() => {
		if (configLoadAttempted) return;
		configLoadAttempted = true;
		getHaConnectionConfig()
			.then((cfg) => {
				if (cfg?.hassUrl) hassUrl = cfg.hassUrl.replace(/\/+$/, '');
			})
			.catch(() => {});
	});

	function baseUrl(): string {
		return hassUrl || (typeof window !== 'undefined' ? window.location.origin : '');
	}

	const entityPicture = $derived(
		(entity?.attributes as { entity_picture?: string } | undefined)?.entity_picture ?? ''
	);

	let tick = $state(0);
	$effect(() => {
		if (typeof window === 'undefined') return;
		const interval = window.setInterval(() => {
			tick++;
		}, 5000);
		return () => window.clearInterval(interval);
	});

	const snapshotUrl = $derived((() => {
		const fallback = typeof window !== 'undefined'
			? getNovaApiUrl(`/api/camera_proxy/${encodeURIComponent(camera.entityId)}`)
			: '';
		const path = entityPicture ? browserSafeHomeAssistantUrl(entityPicture) : fallback;
		if (!path) return '';
		const joiner = path.includes('?') ? '&' : '?';
		return `${path}${joiner}_t=${tick}`;
	})());

	const cameraProxyStreamUrl = $derived(
		typeof window !== 'undefined'
			? getNovaApiUrl(`/api/camera_proxy_stream/${encodeURIComponent(camera.entityId)}`)
			: ''
	);

	let useAdvancedHA = $derived(camera.useAdvanced === true);
	let imageAspectRatio = $state<number | null>(null);
	const cameraAspectRatio = $derived(imageAspectRatio && Number.isFinite(imageAspectRatio) ? imageAspectRatio : 16 / 9);
	let advancedError = $state('');
	let advancedFallbackVisible = $state(false);

	function handleAspectRatio(ratio: number) {
		if (Number.isFinite(ratio) && ratio > 0) imageAspectRatio = ratio;
	}

	function normalizePath(path: string): string {
		return path.startsWith('/') ? path : `/${path}`;
	}

	async function createDirectHass(): Promise<HassLike & Record<string, unknown>> {
		const connectionConfig = await getHaConnectionConfig().catch(() => null);
		const token = connectionConfig?.token ?? '';
		const localBase = typeof window !== 'undefined' ? window.location.origin : '';
		const haBase = (localBase || connectionConfig?.hassUrl || baseUrl()).replace(/\/+$/, '');
		const localWsUrl = getNovaWebSocketCandidates('/api/ha/websocket')[0] ?? '';
		const states = Object.fromEntries(
			entities.map((item) => [
				item.entityId,
				{
					entity_id: item.entityId,
					state: item.state,
					attributes: item.attributes,
					last_changed: new Date().toISOString(),
					last_updated: new Date().toISOString(),
					context: {}
				}
			])
		);
		const callWS = (params: Record<string, unknown>) => callHaWs(params);
		const makeHassUrl = (path = '') => {
			if (!path) return haBase;
			if (/^https?:\/\//.test(path)) {
				try {
					const parsed = new URL(path);
					const coreApiMatch = parsed.pathname.match(/^\/core(\/api\/.*)$/);
					const apiPath = coreApiMatch?.[1] ?? (parsed.pathname.startsWith('/api/') ? parsed.pathname : '');
					if (apiPath) return getNovaApiUrl(`${apiPath}${parsed.search}${parsed.hash}`);
				} catch {}
				return path;
			}
			const normalizedPath = normalizePath(path);
			const coreApiMatch = normalizedPath.match(/^\/core(\/api\/.*)$/);
			const apiPath = coreApiMatch?.[1] ?? (normalizedPath.startsWith('/api/') ? normalizedPath : '');
			if (apiPath) return getNovaApiUrl(apiPath);
			return `${haBase}${normalizedPath}`;
		};
		const callApi = async (method: string, path: string, parameters?: unknown) => {
			const url = new URL(makeHassUrl(path));
			const init: RequestInit = {
				method,
				headers: token ? { Authorization: `Bearer ${token}` } : undefined
			};
			if (method.toUpperCase() === 'GET' && parameters && typeof parameters === 'object') {
				for (const [key, value] of Object.entries(parameters as Record<string, unknown>)) {
					if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
				}
			} else if (parameters !== undefined) {
				init.headers = {
					...(init.headers as Record<string, string> | undefined),
					'Content-Type': 'application/json'
				};
				init.body = JSON.stringify(parameters);
			}
			const response = await fetch(url, init);
			if (!response.ok) throw new Error(`ha_api_${response.status}`);
			const contentType = response.headers.get('content-type') ?? '';
			return contentType.includes('application/json') ? response.json() : response.text();
		};
		const callService = (
			domain: string,
			service: string,
			serviceData?: Record<string, unknown>,
			target?: Record<string, unknown>
		) => callWS({ type: 'call_service', domain, service, service_data: serviceData ?? {}, target });
		return {
			states,
			callWS,
			callService,
			callApi,
			fetchWithAuth: (path: string, init?: RequestInit) => fetch(makeHassUrl(path), {
				...init,
				headers: {
					...(token ? { Authorization: `Bearer ${token}` } : {}),
					...(init?.headers as Record<string, string> | undefined)
				}
			}),
			hassUrl: makeHassUrl,
			connection: {
				sendMessage: (params: Record<string, unknown>) => {
					void callWS(params);
				},
				sendMessagePromise: callWS,
				subscribeMessage: subscribeHaWs,
				subscribeEvents: (callback: (message: unknown) => void, eventType?: string) => subscribeHaWs(
					callback,
					eventType
						? { type: 'subscribe_events', event_type: eventType }
						: { type: 'subscribe_events' }
				),
				connected: true
			},
			connected: true,
			auth: {
				data: { hassUrl: haBase, accessToken: token, access_token: token, wsUrl: localWsUrl },
				accessToken: token,
				wsUrl: localWsUrl,
				getToken: async () => token,
				external: { config: {} }
			},
			language: 'nl',
			selectedLanguage: 'nl',
			locale: { language: 'nl', number_format: 'language', time_format: 'language' },
			config: {
				location_name: 'NovaPanel',
				unit_system: {},
				time_zone: 'Europe/Amsterdam',
				state: 'RUNNING',
				components: ['camera', 'stream']
			},
			panels: {},
			services: {},
			user: { name: 'NovaPanel', is_admin: true },
			themes: { default_theme: 'default', themes: {} },
			localize: (key: string) => key,
			formatEntityState: (state: { state?: unknown } | undefined) => String(state?.state ?? ''),
			formatEntityAttributeValue: (_state: unknown, value: unknown) => String(value ?? '')
		};
	}

	// HA web component handle (advanced)
	let advancedContainer = $state<HTMLDivElement | null>(null);
	$effect(() => {
		if (!useAdvancedHA || !advancedContainer || typeof document === 'undefined') return;
		const container = advancedContainer;
		let cancelled = false;
		let mediaLoaded = false;
		let fallbackTimer: number | null = null;
		let mediaPollTimer: number | null = null;
		let mediaObserver: MutationObserver | null = null;
		let observedMediaRoot: ShadowRoot | AdvancedCameraCardElement | null = null;
		let advancedElement: AdvancedCameraCardElement | null = null;
		let watchedVideo: HTMLVideoElement | null = null;
		let videoProgressTimer: number | null = null;
		let fallbackReasonLogged = false;
		const stopMediaWatch = () => {
			if (mediaPollTimer !== null) {
				window.clearInterval(mediaPollTimer);
				mediaPollTimer = null;
			}
			if (videoProgressTimer !== null) {
				window.clearTimeout(videoProgressTimer);
				videoProgressTimer = null;
			}
			mediaObserver?.disconnect();
			mediaObserver = null;
			observedMediaRoot = null;
			watchedVideo = null;
		};
		const markMediaLoaded = () => {
			if (mediaLoaded) return;
			mediaLoaded = true;
			advancedFallbackVisible = false;
			stopMediaWatch();
		};
		const updateAspectFromVideo = (video: HTMLVideoElement) => {
			if (video.videoWidth > 0 && video.videoHeight > 0) {
				imageAspectRatio = video.videoWidth / video.videoHeight;
			}
		};
		const detectRenderedMedia = () => {
			if (cancelled || !advancedElement) return;
			const root = advancedElement.shadowRoot ?? advancedElement;
			if (root !== observedMediaRoot && typeof MutationObserver !== 'undefined') {
				mediaObserver?.disconnect();
				observedMediaRoot = root;
				mediaObserver = new MutationObserver(detectRenderedMedia);
				mediaObserver.observe(root, {
					childList: true,
					subtree: true,
					attributes: true,
					attributeFilter: ['src', 'poster', 'style', 'class']
				});
			}
			const video = root.querySelector('video');
			if (video instanceof HTMLVideoElement) {
				video.setAttribute('playsinline', '');
				video.autoplay = true;
				video.muted = true;
				video.play().catch(() => {});
				if (video !== watchedVideo) {
					watchedVideo = video;
					if (videoProgressTimer !== null) window.clearTimeout(videoProgressTimer);
					const startTime = video.currentTime;
					videoProgressTimer = window.setTimeout(() => {
						if (cancelled || watchedVideo !== video || advancedFallbackVisible) return;
						const advancedEnough = video.currentTime > startTime + 0.2;
						if (!advancedEnough && (snapshotUrl || cameraProxyStreamUrl)) {
							if (!fallbackReasonLogged) {
								fallbackReasonLogged = true;
								if (CAMERA_DEBUG) console.info('[NovaPanel] ACC video blijft stil; schakel naar NovaPanel live-stream fallback.', {
									entityId: camera.entityId,
									src: video.currentSrc || video.src || '',
									poster: video.poster || '',
									readyState: video.readyState,
									networkState: video.networkState,
									currentTime: video.currentTime
								});
							}
							advancedFallbackVisible = true;
						}
					}, 8500);
				}
				updateAspectFromVideo(video);
				video.addEventListener('loadedmetadata', () => updateAspectFromVideo(video), { once: true });
				video.addEventListener('playing', () => {
					const playingTime = video.currentTime;
					window.setTimeout(() => {
						if (!cancelled && watchedVideo === video && video.currentTime > playingTime + 0.2) {
							markMediaLoaded();
						}
					}, 1200);
				}, { once: true });
				const stream = video.srcObject;
				if (
					stream instanceof MediaStream &&
					stream.getVideoTracks().some((track) => track.readyState === 'live')
				) {
					markMediaLoaded();
				}
				return;
			}
			const canvas = root.querySelector('canvas');
			if (canvas instanceof HTMLCanvasElement && canvas.width > 0 && canvas.height > 0) markMediaLoaded();
		};
		const startMediaWatch = () => {
			detectRenderedMedia();
			mediaPollTimer = window.setInterval(detectRenderedMedia, 350);
		};
		advancedError = '';
		advancedFallbackVisible = false;
		container.replaceChildren();

		(async () => {
			try {
					const config = buildAdvancedConfig(camera);
					await loadAdvancedCameraCard(baseUrl());
					if (cancelled) return;
					const localHass = await createDirectHass().catch(() => null);
					const parentHass = localHass ? null : await getHassWithRetry(6, 250);
					const hass = localHass ?? parentHass;
					if (!hass) throw new Error('hass_unavailable');
					if (cancelled) return;
					const el = document.createElement(ADVANCED_CAMERA_ELEMENT) as AdvancedCameraCardElement;
					advancedElement = el;
					el.style.display = 'block';
					el.style.width = '100%';
					el.style.height = '100%';
					el.style.minHeight = '0';
					el.style.setProperty('--advanced-camera-card-height', '100%');
					el.addEventListener('advanced-camera-card:media:loaded', markMediaLoaded);
					if (!el.setConfig) throw new Error('advanced_camera_card_set_config_missing');
					el.hass = hass;
					el.setConfig(config);
					el.hass = hass;
					container.replaceChildren(el);
					requestAnimationFrame(() => {
						if (!cancelled) el.hass = hass;
					detectRenderedMedia();
				});
				startMediaWatch();
				fallbackTimer = window.setTimeout(() => {
					if (!cancelled && !mediaLoaded) advancedFallbackVisible = true;
				}, 8000);
			} catch (err) {
				if (cancelled) return;
				if (CAMERA_DEBUG) console.warn('[NovaPanel] advanced-camera-card niet beschikbaar:', err);
				advancedError = translate('Advanced Camera Card kon niet worden geladen. Ik toon de normale cameraview.', $selectedLanguageStore);
			}
		})();

		return () => {
			cancelled = true;
			if (fallbackTimer !== null) window.clearTimeout(fallbackTimer);
			stopMediaWatch();
			advancedElement?.removeEventListener('advanced-camera-card:media:loaded', markMediaLoaded);
			container.replaceChildren();
		};
	});
</script>

<button type="button" class="modal-overlay" onclick={onClose} aria-label={translate('close', $selectedLanguageStore)}></button>
<section class="camera-detail-modal np-detail" role="dialog" aria-modal="true" aria-label={name} style:--camera-aspect={String(cameraAspectRatio)}>
	<div class="np-detail-head" style="--np-tint: rgba(96,165,250,0.18); --np-color: #60a5fa;">
		<div class="np-detail-head-glow" aria-hidden="true"></div>
		<div class="np-detail-head-icon"><TablerIcon name="device-cctv" size={22} /></div>
		<div class="np-detail-head-text">
			<div class="np-detail-head-title">{name}</div>
		</div>
	</div>

	<div class="camera-body">
		{#if snapshotUrl || cameraProxyStreamUrl}
			{#if useAdvancedHA}
				<div class="camera-advanced-shell" class:fallback-visible={advancedFallbackVisible}>
					<div class="camera-advanced" bind:this={advancedContainer}></div>
					{#if advancedFallbackVisible}
						<div class="camera-advanced-fallback">
							<HaCameraLiveView
								entityId={camera.entityId}
								active={advancedFallbackVisible}
								fallbackSrc={snapshotUrl}
								fallbackStreamSrc={cameraProxyStreamUrl}
								alt={name}
								fit="contain"
								onAspectRatio={handleAspectRatio}
							/>
						</div>
					{/if}
				</div>
			{:else}
				<div class="camera-live-shell">
				<HaCameraLiveView
					entityId={camera.entityId}
					active={true}
					fallbackSrc={snapshotUrl}
					fallbackStreamSrc={cameraProxyStreamUrl}
					alt={name}
					fit="contain"
					onAspectRatio={handleAspectRatio}
				/>
				</div>
			{/if}
		{:else}
			<div class="camera-fallback">
				<TablerIcon name="device-cctv-off" size={44} />
				<div>{translate('Geen beeld beschikbaar', $selectedLanguageStore)}</div>
			</div>
		{/if}
		{#if advancedError}
			<div class="camera-advanced-error">{advancedError}</div>
		{/if}
	</div>
</section>

<style>
	.modal-overlay {
		position: fixed; inset: 0;
		background: rgba(0,0,0,0.65);
		backdrop-filter: blur(3px);
		border: 0; padding: 0; margin: 0;
		z-index: 80; cursor: default;
	}
	.camera-detail-modal {
		position: fixed;
		top: 50%; left: 50%;
		transform: translate(-50%, -50%);
		z-index: 90;
		width: min(var(--popup-width, 850px), calc(100vw - 1.5rem));
		height: auto;
		max-height: calc(100vh - 1.5rem);
		display: flex; flex-direction: column;
		background: linear-gradient(180deg, #1a2238 0%, #0f1424 100%);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 18px;
		overflow: hidden;
	}
	.camera-detail-modal::before {
		content: '';
		position: absolute;
		top: 0; left: 50%;
		width: 60%; height: 1px;
		background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
		transform: translateX(-50%);
		pointer-events: none;
		z-index: 5;
	}
	:global(.camera-detail-modal .np-detail-head) {
		padding: 16px 20px 12px;
		border-bottom: 0.5px solid rgba(255,255,255,0.06);
		display: flex; align-items: center; gap: 12px;
		position: relative; overflow: hidden;
		flex-shrink: 0;
	}
	:global(.camera-detail-modal .np-detail-head-glow) {
		position: absolute; top: -100px; left: -40px;
		width: 220px; height: 220px;
		background: radial-gradient(circle, var(--np-tint, rgba(96,165,250,0.18)), transparent 70%);
		pointer-events: none; filter: blur(20px);
	}
	:global(.camera-detail-modal .np-detail-head-icon) {
		width: 38px; height: 38px; border-radius: 10px;
		display: grid; place-items: center;
		background: var(--np-tint);
		border: 0.5px solid rgba(255,255,255,0.10);
		color: var(--np-color);
		flex-shrink: 0; position: relative; z-index: 1;
	}
	:global(.camera-detail-modal .np-detail-head-text) { flex: 1; min-width: 0; position: relative; z-index: 1; }
	:global(.camera-detail-modal .np-detail-head-title) { font-size: 15px; font-weight: 500; color: #f5f5f5; line-height: 1.2; }

	.camera-body {
		position: relative;
		flex: 0 1 auto;
		min-height: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 16px;
		overflow: hidden;
		background: #0a0e1a;
		aspect-ratio: var(--camera-aspect, 16 / 9);
	}
	.camera-live-shell,
	.camera-advanced-shell {
		position: relative;
		width: 100%;
		height: 100%;
		min-height: 0;
		border-radius: 10px;
		overflow: hidden;
		background: #050812;
	}
	.camera-advanced {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 100%;
		min-height: 0;
		display: flex;
		align-items: stretch;
		justify-content: stretch;
	}
	.camera-advanced-shell.fallback-visible .camera-advanced {
		opacity: 0;
		pointer-events: none;
	}
	.camera-advanced-fallback {
		position: absolute;
		inset: 0;
		z-index: 2;
		width: 100%;
		height: 100%;
		background: #050812;
	}
	.camera-fallback {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		color: rgba(255,255,255,0.45);
		text-align: center;
	}
	.camera-advanced-error {
		position: absolute;
		left: 1rem;
		right: 1rem;
		bottom: 1rem;
		padding: 0.55rem 0.7rem;
		border: 0.5px solid rgba(248,113,113,0.24);
		border-radius: 0.6rem;
		background: rgba(24, 8, 12, 0.78);
		color: rgba(255,255,255,0.76);
		font-size: 0.76rem;
		text-align: center;
		backdrop-filter: blur(10px);
		pointer-events: none;
	}

	/* Geen scrollbars in deze modal */
	:global(.camera-detail-modal *) {
		scrollbar-width: none;
		-ms-overflow-style: none;
	}
	:global(.camera-detail-modal *::-webkit-scrollbar) {
		display: none;
		width: 0; height: 0;
	}
</style>
