<script lang="ts">
	import type HlsType from 'hls.js';
	import {
		browserSafeHomeAssistantUrl,
		getNovaApiCandidates,
		getNovaWebSocketCandidates
	} from '$lib/ha/entities-service-helpers';

	type Props = {
		entityId: string;
		active?: boolean;
		fallbackSrc?: string;
		fallbackStreamSrc?: string;
		alt?: string;
		controls?: boolean;
		fit?: 'cover' | 'contain';
		onAspectRatio?: (ratio: number) => void;
		onWebRtcState?: (state: 'starting' | 'playing' | 'failed') => void;
	};

	let {
		entityId,
		active = true,
		fallbackSrc = '',
		fallbackStreamSrc = '',
		alt = '',
		controls = false,
		fit = 'cover',
		onAspectRatio,
		onWebRtcState
	}: Props = $props();

	let videoEl = $state<HTMLVideoElement | null>(null);
	let mode = $state<'loading' | 'webrtc' | 'hls' | 'mjpeg' | 'snapshot'>('loading');
	let mediaReady = $state(false);
	let fallbackStreamFailed = $state(false);
	let hlsInstance: HlsType | null = null;
	let peerConnection: RTCPeerConnection | null = null;
	let remoteStream: MediaStream | null = null;
	let webRtcUnsubscribe: (() => void) | null = null;
	let streamTimeout: number | null = null;
	let bufferingTimer: number | null = null;
	let cleanedToken = 0;

	const imageSrc = $derived(
		mode === 'mjpeg' && fallbackStreamSrc && !fallbackStreamFailed ? fallbackStreamSrc : fallbackSrc
	);

	function asRecord(value: unknown): Record<string, unknown> {
		return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
	}

	function resolveHaUrl(rawUrl: string): string {
		return browserSafeHomeAssistantUrl(rawUrl);
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
		params: Record<string, unknown>,
		callback: (event: Record<string, unknown>) => void
	): Promise<() => void> {
		let lastError: unknown = null;
		for (const endpoint of getNovaWebSocketCandidates('/api/ha/websocket')) {
			try {
				const unsubscribe = await subscribeHaWsEndpoint(endpoint, params, callback);
				return unsubscribe;
			} catch (error) {
				lastError = error;
			}
		}
		throw lastError ?? new Error('ha_ws_subscribe_unavailable');
	}

	function subscribeHaWsEndpoint(
		endpoint: string,
		params: Record<string, unknown>,
		callback: (event: Record<string, unknown>) => void
	): Promise<() => void> {
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(endpoint);
			const commandId = 1;
			let nextId = commandId + 1;
			let settled = false;
			let closed = false;
			let subscribed = false;
			const failTimer = window.setTimeout(() => {
				if (!settled) {
					closed = true;
					try { ws.close(); } catch {}
					reject(new Error('ha_ws_subscribe_timeout'));
				}
			}, 12000);
			const finishResolve = () => {
				if (settled) return;
				settled = true;
				window.clearTimeout(failTimer);
				resolve(() => {
					if (closed) return;
					closed = true;
					try {
						if (ws.readyState === WebSocket.OPEN && subscribed) {
							ws.send(JSON.stringify({
								id: nextId++,
								type: 'unsubscribe_events',
								subscription: commandId
							}));
						}
					} catch {}
					window.setTimeout(() => {
						try { ws.close(); } catch {}
					}, 60);
				});
			};
			const finishReject = (error: unknown) => {
				if (settled) return;
				settled = true;
				closed = true;
				window.clearTimeout(failTimer);
				try { ws.close(); } catch {}
				reject(error);
			};
			ws.addEventListener('message', (event) => {
				try {
					const message = JSON.parse(String(event.data));
					if (message?.type === 'auth_required') {
						ws.send(JSON.stringify({ type: 'auth', access_token: 'novapanel-proxy' }));
						return;
					}
					if (message?.type === 'auth_invalid') {
						finishReject(new Error('ha_ws_auth_invalid'));
						return;
					}
					if (message?.type === 'auth_ok') {
						ws.send(JSON.stringify({ id: commandId, ...params }));
						return;
					}
					if (message?.id !== commandId) return;
					if (message.type === 'result') {
						if (message.success === false) {
							finishReject(new Error(message.error?.message || message.error?.code || 'ha_ws_result_failed'));
							return;
						}
						subscribed = true;
						finishResolve();
						return;
					}
					if (message.type === 'event') {
						const eventPayload = asRecord(message.event);
						callback(eventPayload);
					}
				} catch (error) {
					finishReject(error);
				}
			});
			ws.addEventListener('error', () => finishReject(new Error('ha_ws_subscribe_error')));
			ws.addEventListener('close', () => {
				closed = true;
				if (!settled) finishReject(new Error('ha_ws_subscribe_closed'));
			});
		});
	}

	function clearStreamTimeout() {
		if (streamTimeout !== null) {
			window.clearTimeout(streamTimeout);
			streamTimeout = null;
		}
	}

	function clearBufferingTimer() {
		if (bufferingTimer !== null) {
			window.clearTimeout(bufferingTimer);
			bufferingTimer = null;
		}
	}

	function cleanupPlayback() {
		cleanedToken += 1;
		clearStreamTimeout();
		clearBufferingTimer();
		webRtcUnsubscribe?.();
		webRtcUnsubscribe = null;
		peerConnection?.close();
		peerConnection = null;
		if (remoteStream) {
			for (const track of remoteStream.getTracks()) track.stop();
			remoteStream = null;
		}
		hlsInstance?.destroy();
		hlsInstance = null;
		const stream = videoEl?.srcObject;
		if (stream instanceof MediaStream) {
			for (const track of stream.getTracks()) track.stop();
		}
		if (videoEl) {
			videoEl.removeAttribute('src');
			videoEl.srcObject = null;
			videoEl.load();
		}
		mediaReady = false;
	}

	function markMediaReady() {
		clearStreamTimeout();
		clearBufferingTimer();
		mediaReady = true;
		if (videoEl?.videoWidth && videoEl.videoHeight) {
			const ratio = videoEl.videoWidth / videoEl.videoHeight;
			if (Number.isFinite(ratio) && ratio > 0) onAspectRatio?.(ratio);
		}
	}

	function fallbackToImage() {
		cleanupPlayback();
		mode = fallbackStreamSrc && !fallbackStreamFailed ? 'mjpeg' : 'snapshot';
		onWebRtcState?.('failed');
	}

	async function fallbackToHlsOrImage(entity: string, token: number) {
		if (token !== cleanedToken) return;
		cleanupPlayback();
		const hlsToken = cleanedToken;
		const started = await startHls(entity, hlsToken);
		if (hlsToken !== cleanedToken || started) return;
		mode = fallbackStreamSrc && !fallbackStreamFailed ? 'mjpeg' : 'snapshot';
		onWebRtcState?.('failed');
	}

	function setLoadWatch(token: number, onTimeout: () => void, timeoutMs = 12000) {
		clearStreamTimeout();
		streamTimeout = window.setTimeout(() => {
			if (token === cleanedToken && !mediaReady) onTimeout();
		}, timeoutMs);
	}

	function showPosterIfBuffering() {
		if (mode !== 'hls' || !mediaReady || bufferingTimer !== null) return;
		bufferingTimer = window.setTimeout(() => {
			bufferingTimer = null;
			if (mode === 'hls') mediaReady = false;
		}, 650);
	}

	function handleImageLoad(event: Event) {
		const img = event.currentTarget as HTMLImageElement;
		if (img.naturalWidth <= 0 || img.naturalHeight <= 0) return;
		const ratio = img.naturalWidth / img.naturalHeight;
		if (Number.isFinite(ratio) && ratio > 0) onAspectRatio?.(ratio);
	}

	async function getPlayableHlsUrl(masterUrl: string): Promise<string> {
		const response = await fetch(masterUrl, {
			cache: 'no-store',
			credentials: 'same-origin'
		});
		if (!response.ok) throw new Error(`hls_manifest_${response.status}`);
		const masterPlaylist = await response.text();
		const playlistRegexp = /#EXT-X-STREAM-INF:.*?(?:CODECS=".*?([^.]*)?\..*?,([^.]*)?\..*?".*?)?(?:\n|\r\n)(.+)/g;
		const match = playlistRegexp.exec(masterPlaylist);
		const secondMatch = playlistRegexp.exec(masterPlaylist);
		if (match !== null && secondMatch === null && match[3]) {
			return new URL(match[3], masterUrl).href;
		}
		return masterUrl;
	}

	async function fetchStreamTypes(entity: string): Promise<string[] | null> {
		try {
			const result = asRecord(await callHaWs({ type: 'camera/capabilities', entity_id: entity }));
			const types = result.frontend_stream_types;
			return Array.isArray(types) ? types.filter((item): item is string => typeof item === 'string') : null;
		} catch (error) {
			console.warn('[NovaPanel] Camera capabilities fallback:', entity, error);
			return null;
		}
	}

	function createIceCandidate(candidate: Record<string, unknown>): RTCIceCandidate {
		if (candidate.sdpMid || candidate.sdpMLineIndex !== undefined) {
			return new RTCIceCandidate(candidate as RTCIceCandidateInit);
		}
		return new RTCIceCandidate({
			candidate: typeof candidate.candidate === 'string' ? candidate.candidate : '',
			sdpMid: '0'
		});
	}

	async function startWebRtc(entity: string, token: number): Promise<boolean> {
		if (!videoEl || typeof RTCPeerConnection === 'undefined') return false;
		mode = 'webrtc';
		mediaReady = false;
		onWebRtcState?.('starting');
		try {
			const clientConfig = asRecord(await callHaWs({
				type: 'camera/webrtc/get_client_config',
				entity_id: entity
			}));
			if (token !== cleanedToken || !videoEl) return false;
			const configuration = asRecord(clientConfig.configuration) as RTCConfiguration;
			const dataChannel = typeof clientConfig.dataChannel === 'string' ? clientConfig.dataChannel : '';
			const pc = new RTCPeerConnection(configuration);
			const stream = new MediaStream();
			let sessionId = '';
			let answered = false;
			const pendingCandidates: RTCIceCandidate[] = [];
			peerConnection = pc;
			remoteStream = stream;
			videoEl.srcObject = stream;
			videoEl.muted = true;

			const sendCandidate = (candidate: RTCIceCandidate) => {
				if (!sessionId) {
					pendingCandidates.push(candidate);
					return;
				}
				void callHaWs({
					type: 'camera/webrtc/candidate',
					entity_id: entity,
					session_id: sessionId,
					candidate: candidate.toJSON()
				}).catch((error) => console.warn('[NovaPanel] WebRTC candidate fallback:', entity, error));
			};

			pc.onicecandidate = (event) => {
				if (event.candidate?.candidate) sendCandidate(event.candidate);
			};
			pc.oniceconnectionstatechange = () => {
				if (token !== cleanedToken) return;
				if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
					onWebRtcState?.('playing');
				}
				if (pc.iceConnectionState === 'failed') {
					void fallbackToHlsOrImage(entity, token);
				}
			};
			pc.ontrack = (event) => {
				if (token !== cleanedToken) return;
				stream.addTrack(event.track);
				if (event.track.kind === 'video') {
					markMediaReady();
					videoEl?.play().catch(() => {});
				}
			};
			if (dataChannel) pc.createDataChannel(dataChannel);
			pc.addTransceiver('audio', { direction: 'recvonly' });
			pc.addTransceiver('video', { direction: 'recvonly' });

			const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
			if (token !== cleanedToken || !peerConnection) return false;
			await pc.setLocalDescription(offer);
			let earlyCandidates = '';
			while (pendingCandidates.length) {
				const candidate = pendingCandidates.shift();
				if (candidate?.candidate) earlyCandidates += `a=${candidate.candidate}\r\n`;
			}
			const offerSdp = `${offer.sdp ?? ''}${earlyCandidates}`;

			webRtcUnsubscribe = await subscribeHaWs(
				{ type: 'camera/webrtc/offer', entity_id: entity, offer: offerSdp },
				(event) => {
					if (token !== cleanedToken || !peerConnection) return;
					const eventType = typeof event.type === 'string' ? event.type : '';
					if (eventType === 'session') {
						sessionId = typeof event.session_id === 'string' ? event.session_id : '';
						for (const candidate of pendingCandidates.splice(0)) sendCandidate(candidate);
						return;
					}
					if (eventType === 'answer') {
						const answer = typeof event.answer === 'string' ? event.answer : '';
						if (!answer || answered) return;
						answered = true;
						void peerConnection.setRemoteDescription(new RTCSessionDescription({
							type: 'answer',
							sdp: answer
						})).then(() => {
							if (token === cleanedToken) videoEl?.play().catch(() => {});
						}).catch((error) => {
							console.warn('[NovaPanel] WebRTC answer fallback:', entity, error);
							void fallbackToHlsOrImage(entity, token);
						});
						return;
					}
					if (eventType === 'candidate') {
						const candidate = asRecord(event.candidate);
						if (candidate.candidate) {
							peerConnection.addIceCandidate(createIceCandidate(candidate)).catch((error) => {
								console.warn('[NovaPanel] WebRTC remote candidate fallback:', entity, error);
							});
						}
						return;
					}
					if (eventType === 'error') {
						console.warn('[NovaPanel] WebRTC camera fallback:', entity, event);
						void fallbackToHlsOrImage(entity, token);
					}
				}
			);
			if (token !== cleanedToken) return false;
			setLoadWatch(token, () => void fallbackToHlsOrImage(entity, token), 18000);
			videoEl.play().catch(() => {});
			return true;
		} catch (error) {
			console.warn('[NovaPanel] WebRTC camera fallback:', entity, error);
			return false;
		}
	}

	async function startHls(entity: string, token: number): Promise<boolean> {
		if (!videoEl) return false;
		mode = 'hls';
		mediaReady = false;
		try {
			const result = asRecord(await callHaWs({ type: 'camera/stream', entity_id: entity, format: 'hls' }));
			const rawUrl = typeof result.url === 'string' ? result.url : '';
			const streamUrl = resolveHaUrl(rawUrl);
			if (!streamUrl || token !== cleanedToken || !videoEl) return false;
			const playableUrl = await getPlayableHlsUrl(streamUrl);
			if (token !== cleanedToken || !videoEl) return false;
			setLoadWatch(token, fallbackToImage, 15000);
			const Hls = (await import('hls.js/dist/hls.light.mjs')).default as typeof HlsType;
			if (token !== cleanedToken || !videoEl) return false;
			if (Hls.isSupported()) {
				const hls = new Hls({
					backBufferLength: 60,
					fragLoadingTimeOut: 30000,
					manifestLoadingTimeOut: 30000,
					levelLoadingTimeOut: 30000,
					maxLiveSyncPlaybackRate: 2,
					liveSyncDurationCount: 3,
					liveMaxLatencyDurationCount: 10,
					lowLatencyMode: true
				});
				let hlsErrorCount = 0;
				hlsInstance = hls;
				hls.attachMedia(videoEl);
				hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(playableUrl));
				hls.on(Hls.Events.FRAG_LOADED, () => {
					videoEl?.play().catch(() => {});
				});
				hls.on(Hls.Events.ERROR, (_event, data) => {
					if (!data.fatal) return;
					hlsErrorCount += 1;
					if (data.type === Hls.ErrorTypes.NETWORK_ERROR && hlsErrorCount <= 3) {
						hls.startLoad();
						return;
					}
					if (data.type === Hls.ErrorTypes.MEDIA_ERROR && hlsErrorCount <= 3) {
						hls.recoverMediaError();
						return;
					}
					fallbackToImage();
				});
			} else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
				videoEl.src = playableUrl;
			} else {
				return false;
			}
			videoEl.play().catch(() => {});
			return true;
		} catch (error) {
			console.warn('[NovaPanel] HLS camera fallback:', entity, error);
			return false;
		}
	}

	async function startBestStream(entity: string, token: number) {
		fallbackStreamFailed = false;
		mode = 'loading';
		mediaReady = false;
		const streamTypes = await fetchStreamTypes(entity);
		if (token !== cleanedToken) return;
		const prefersWebRtc = streamTypes?.includes('web_rtc') ?? true;
		const supportsHls = streamTypes === null || streamTypes.includes('hls');
		if (prefersWebRtc) {
			const webRtcStarted = await startWebRtc(entity, token);
			if (token !== cleanedToken || webRtcStarted) return;
		}
		if (supportsHls) {
			const hlsStarted = await startHls(entity, token);
			if (token !== cleanedToken || hlsStarted) return;
		}
		if (token !== cleanedToken) return;
		mode = fallbackStreamSrc ? 'mjpeg' : 'snapshot';
	}

	$effect(() => {
		const currentActive = active;
		const currentEntity = entityId;
		const currentVideo = videoEl;
		if (!currentActive || !currentEntity || !currentVideo) {
			cleanupPlayback();
			mode = fallbackStreamSrc ? 'mjpeg' : 'snapshot';
			return;
		}
		cleanupPlayback();
		const token = cleanedToken;
		void startBestStream(currentEntity, token);
		return () => cleanupPlayback();
	});
</script>

<div class="ha-camera-live" style:--camera-fit={fit}>
	{#if active && mode !== 'mjpeg' && mode !== 'snapshot'}
		<video
			bind:this={videoEl}
			class="ha-camera-video"
			class:ready={mediaReady}
			autoplay
			muted
			playsinline
			preload="auto"
			poster={fallbackSrc}
			{controls}
			onloadedmetadata={markMediaReady}
			onloadeddata={markMediaReady}
			onplaying={markMediaReady}
			ontimeupdate={markMediaReady}
			onwaiting={showPosterIfBuffering}
			onstalled={showPosterIfBuffering}
			onemptied={showPosterIfBuffering}
		></video>
	{/if}

	{#if imageSrc && (!mediaReady || mode === 'mjpeg' || mode === 'snapshot')}
		<img
			class="ha-camera-fallback"
			src={imageSrc}
			alt={alt}
			loading="lazy"
			onload={handleImageLoad}
			onerror={() => {
				if (imageSrc === fallbackStreamSrc) {
					fallbackStreamFailed = true;
					mode = fallbackSrc ? 'snapshot' : 'loading';
				}
			}}
		/>
	{/if}
</div>

<style>
	.ha-camera-live {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		background: #050812;
	}
	.ha-camera-video,
	.ha-camera-fallback {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: var(--camera-fit, cover);
		display: block;
		background: #050812;
	}
	.ha-camera-video {
		z-index: 2;
		opacity: 0;
		transition: opacity 0.18s ease;
	}
	.ha-camera-video.ready {
		opacity: 1;
	}
	.ha-camera-fallback {
		z-index: 1;
	}
</style>
