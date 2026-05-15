<script lang="ts">
	import { entityStore } from '$lib/ha/entities-store';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import CameraPreviewImage from '$lib/cards/CameraPreviewImage.svelte';
	import type { CameraConfig } from '$lib/persistence/panel-state-types';
	import { selectedLanguageStore, translate } from '$lib/i18n';

	type Props = {
		cameras?: CameraConfig[];
		title?: string;
		onCameraClick?: (camera: CameraConfig) => void;
	};

	let { cameras = [], title, onCameraClick }: Props = $props();

	const entities = $derived($entityStore.entities);
	let cameraAspectRatios = $state<Record<string, number>>({});
	let visibleCameraEntities = $state<Record<string, boolean>>({});

	type CameraInfo = {
		config: CameraConfig;
		name: string;
		thumbnail: string;
		entityPicture: string;
	};

	const PREVIEW_REFRESH_SECONDS = 12;

	function browserSafeHaApiUrl(raw: string): string {
		if (!raw) return '';
		const base = typeof window !== 'undefined' ? window.location.origin : '';
		if (!base) return raw;
		const toLocalApiPath = (pathname: string) => {
			const coreApiMatch = pathname.match(/^\/core(\/api\/.*)$/);
			if (coreApiMatch?.[1]) return coreApiMatch[1];
			return pathname.startsWith('/api/') ? pathname : '';
		};
		if (/^https?:\/\//i.test(raw)) {
			try {
				const parsed = new URL(raw);
				const apiPath = toLocalApiPath(parsed.pathname);
				if (apiPath) return `${base}${apiPath}${parsed.search}${parsed.hash}`;
			} catch {}
			return raw;
		}
		const clean = raw.startsWith('/') ? raw : `/${raw}`;
		const apiPath = toLocalApiPath(clean);
		return `${base}${apiPath || clean}`;
	}

	function snapshotUrlFor(entityPicture: string): string {
		return browserSafeHaApiUrl(entityPicture);
	}

	function cameraProxyUrlFor(entityId: string): string {
		const base = typeof window !== 'undefined' ? window.location.origin : '';
		return `${base}/api/camera_proxy/${encodeURIComponent(entityId)}`;
	}

	function isCameraVisible(entityId: string): boolean {
		if (typeof window === 'undefined') return false;
		if (typeof IntersectionObserver === 'undefined') return true;
		return visibleCameraEntities[entityId] === true;
	}

	function setCameraVisible(entityId: string, visible: boolean) {
		if (visibleCameraEntities[entityId] === visible) return;
		visibleCameraEntities = { ...visibleCameraEntities, [entityId]: visible };
	}

	function trackCameraVisibility(node: HTMLElement, entityId: string) {
		if (typeof window === 'undefined') return;
		if (typeof IntersectionObserver === 'undefined') {
			setCameraVisible(entityId, true);
			return {
				update(nextEntityId: string) {
					if (nextEntityId === entityId) return;
					setCameraVisible(entityId, false);
					entityId = nextEntityId;
					setCameraVisible(entityId, true);
				},
				destroy() {
					setCameraVisible(entityId, false);
				}
			};
		}

		const observer = new IntersectionObserver(
			(entries) => {
				const entry = entries[0];
				setCameraVisible(entityId, !!entry?.isIntersecting && (entry.intersectionRatio ?? 0) > 0.08);
			},
			{ threshold: [0, 0.08, 0.25, 0.5, 1] }
		);
		observer.observe(node);

		return {
			update(nextEntityId: string) {
				if (nextEntityId === entityId) return;
				setCameraVisible(entityId, false);
				entityId = nextEntityId;
				observer.unobserve(node);
				observer.observe(node);
			},
			destroy() {
				observer.disconnect();
				setCameraVisible(entityId, false);
			}
		};
	}

	let cameraRefreshTicks = $state<Record<string, number>>({});
	let cameraRefreshElapsed = $state<Record<string, number>>({});
	$effect(() => {
		if (typeof window === 'undefined') return;
		const interval = window.setInterval(() => {
			const visibleIds = Object.entries(visibleCameraEntities)
				.filter(([, visible]) => visible)
				.map(([entityId]) => entityId);
			if (visibleIds.length === 0) return;

			const nextElapsed = { ...cameraRefreshElapsed };
			const nextTicks = { ...cameraRefreshTicks };
			for (const entityId of visibleIds) {
				const elapsed = (nextElapsed[entityId] ?? 0) + 1;
				if (elapsed >= PREVIEW_REFRESH_SECONDS) {
					nextElapsed[entityId] = 0;
					nextTicks[entityId] = (nextTicks[entityId] ?? 0) + 1;
				} else {
					nextElapsed[entityId] = elapsed;
				}
			}
			cameraRefreshElapsed = nextElapsed;
			cameraRefreshTicks = nextTicks;
		}, 1000);
		return () => window.clearInterval(interval);
	});

	const cameraInfos = $derived((() => {
		const list = cameras ?? [];
		const out: CameraInfo[] = [];
		for (const c of list) {
			const ent = entities.find((e) => e.entityId === c.entityId);
			const friendly = ent?.friendlyName || c.entityId;
			const ep = (ent?.attributes as { entity_picture?: string } | undefined)?.entity_picture ?? '';
			const baseUrl = ep ? snapshotUrlFor(ep) : cameraProxyUrlFor(c.entityId);
			const tick = cameraRefreshTicks[c.entityId] ?? 0;
			const url = baseUrl ? `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}_t=${tick}` : '';
			out.push({
				config: c,
				name: c.alias && c.alias.trim().length > 0 ? c.alias : friendly,
				thumbnail: url,
				entityPicture: ep
			});
		}
		return out;
	})());

	// Apple Home pattern: groep camera's in tuples [large?, small1?, small2?]
	// Een 'group' is altijd 1 large positie (mogelijk leeg) + 0..2 small posities
	type Group = { large: CameraInfo | null; smalls: CameraInfo[] };
	const groups = $derived((() => {
		const result: Group[] = [];
		const queue = [...cameraInfos];
		while (queue.length > 0) {
			// Pak eerste large (of als geen large-marker, pak gewoon eerste)
			let large: CameraInfo | null = null;
			const firstLargeIdx = queue.findIndex((c) => c.config.isLarge);
			if (firstLargeIdx === 0) {
				large = queue.shift() ?? null;
			} else if (firstLargeIdx === -1) {
				// Geen large meer → pak eerste als large
				large = queue.shift() ?? null;
			} else {
				// Eerst nog kleinere camera's vóór de large
				large = queue.shift() ?? null;
			}
			const smalls: CameraInfo[] = [];
			// Verzamel max 2 'kleine' camera's tot we een nieuwe 'large' tegenkomen
			while (smalls.length < 2 && queue.length > 0 && !queue[0].config.isLarge) {
				const next = queue.shift();
				if (next) smalls.push(next);
			}
			result.push({ large, smalls });
		}
		return result;
	})());

	function handleClick(camera: CameraInfo) {
		if (onCameraClick) onCameraClick(camera.config);
	}

	function cameraAspect(entityId: string): number {
		const ratio = cameraAspectRatios[entityId];
		return ratio && Number.isFinite(ratio) ? ratio : 16 / 9;
	}

	function handleAspectRatio(entityId: string, ratio: number) {
		if (!Number.isFinite(ratio) || ratio <= 0) return;
		cameraAspectRatios = { ...cameraAspectRatios, [entityId]: ratio };
	}

	function refreshElapsedFor(entityId: string): number {
		return cameraRefreshElapsed[entityId] ?? 0;
	}
</script>

<div class="cameras-strip-card">
	{#if cameraInfos.length === 0}
		<div class="cameras-strip-empty">
			<TablerIcon name="device-cctv-off" size={28} />
			<div>{translate("Geen camera's geconfigureerd", $selectedLanguageStore)}</div>
		</div>
	{:else}
		<div class="cameras-strip-scroll">
			{#each groups as group, gi (gi)}
				<div class="cameras-group">
					{#if group.large}
						{@const cam = group.large}
						<button
							type="button"
							class="camera-tile camera-tile-large"
							use:trackCameraVisibility={cam.config.entityId}
							onclick={() => handleClick(cam)}
							aria-label={`${translate('Open', $selectedLanguageStore)} ${cam.name}`}
							style:--camera-aspect={String(cameraAspect(cam.config.entityId))}
						>
							{#if isCameraVisible(cam.config.entityId)}
								<CameraPreviewImage
									src={cam.thumbnail}
									alt={cam.name}
									onAspectRatio={(ratio) => handleAspectRatio(cam.config.entityId, ratio)}
								/>
							{:else}
								<div class="camera-placeholder">
									<TablerIcon name="device-cctv" size={32} />
								</div>
							{/if}
							<div class="camera-refresh-meter">
								<span>{refreshElapsedFor(cam.config.entityId)}s</span>
							</div>
						</button>
					{/if}
					{#if group.smalls.length > 0}
						<div class="cameras-small-stack">
							{#each group.smalls as cam (cam.config.entityId)}
								<button
									type="button"
									class="camera-tile camera-tile-small"
									use:trackCameraVisibility={cam.config.entityId}
									onclick={() => handleClick(cam)}
									aria-label={`${translate('Open', $selectedLanguageStore)} ${cam.name}`}
									style:--camera-aspect={String(cameraAspect(cam.config.entityId))}
								>
									{#if isCameraVisible(cam.config.entityId)}
										<CameraPreviewImage
											src={cam.thumbnail}
											alt={cam.name}
											onAspectRatio={(ratio) => handleAspectRatio(cam.config.entityId, ratio)}
										/>
									{:else}
										<div class="camera-placeholder">
											<TablerIcon name="device-cctv" size={20} />
										</div>
									{/if}
									<div class="camera-refresh-meter small">
										<span>{refreshElapsedFor(cam.config.entityId)}s</span>
									</div>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.cameras-strip-card {
		display: flex;
		flex-direction: column;
		gap: 10px;
		width: 100%;
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
		box-sizing: border-box;
		container-type: inline-size;
	}
	.cameras-strip-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 36px 12px;
		color: rgba(255,255,255,0.4);
		font-size: 13px;
		border: 0.5px dashed rgba(255,255,255,0.10);
		border-radius: 12px;
	}
	.cameras-strip-scroll {
		display: flex;
		gap: 12px;
		overflow-x: auto;
		overflow-y: hidden;
		scroll-snap-type: x mandatory;
		padding: 2px;
		scrollbar-width: none;
		max-width: 100%;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior-x: contain;
		touch-action: pan-x;
	}
	.cameras-strip-scroll::-webkit-scrollbar { display: none; width: 0; height: 0; }
	.cameras-group {
		display: flex;
		gap: 12px;
		flex: 0 0 auto;
		align-items: stretch;
		scroll-snap-align: start;
		min-width: max-content;
		max-width: none;
	}
	.cameras-small-stack {
		display: flex;
		flex-direction: column;
		gap: 12px;
		flex: 0 0 auto;
	}

	.camera-tile {
		position: relative;
		display: block;
		overflow: hidden;
		min-width: 0;
		max-width: none;
		flex: 0 0 auto;
		border-radius: 14px;
		border: 0.5px solid rgba(255,255,255,0.08);
		background: rgba(0,0,0,0.30);
		cursor: pointer;
		padding: 0;
		transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
	}
	.camera-tile:hover {
		border-color: rgba(96,165,250,0.4);
		transform: translateY(-2px);
		box-shadow: 0 12px 28px rgba(0,0,0,0.35), 0 0 18px rgba(96,165,250,0.15);
	}
	.camera-tile-large {
		width: clamp(13.5rem, 44cqw, 17.5rem);
		aspect-ratio: var(--camera-aspect, 16 / 9);
	}
	.camera-tile-small {
		width: clamp(8.75rem, 30cqw, 11.25rem);
		aspect-ratio: var(--camera-aspect, 16 / 9);
	}

	.camera-placeholder {
		width: 100%; height: 100%;
		display: grid; place-items: center;
		color: rgba(255,255,255,0.3);
		background: linear-gradient(135deg, rgba(96,165,250,0.10), rgba(167,139,250,0.10));
	}

	.camera-refresh-meter {
		position: absolute;
		left: 8px;
		bottom: 8px;
		z-index: 3;
		pointer-events: none;
		display: block;
		padding: 0;
		background: none;
		border: 0;
		box-shadow: none;
	}
	.camera-refresh-meter span {
		position: relative;
		z-index: 1;
		font-size: 10px;
		font-weight: 700;
		line-height: 1;
		color: rgba(255,255,255,0.88);
		font-variant-numeric: tabular-nums;
		text-shadow: 0 1px 4px rgba(0,0,0,0.85);
	}
	.camera-refresh-meter.small {
		left: 7px;
		bottom: 7px;
	}
	.camera-refresh-meter.small span {
		font-size: 9px;
	}

	@container (max-width: 360px) {
		.cameras-strip-scroll {
			gap: 10px;
			scroll-snap-type: x mandatory;
		}
		.cameras-group {
			gap: 8px;
		}
		.cameras-small-stack {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}
		.camera-tile-large { width: clamp(13rem, 76cqw, 15rem); }
		.camera-tile-small { width: clamp(8rem, 46cqw, 9.5rem); }
		.camera-refresh-meter {
			left: 7px;
			bottom: 7px;
		}
	}

	@supports not (width: 1cqw) {
		.camera-tile-large { width: clamp(13.5rem, 42vw, 17.5rem); }
		.camera-tile-small { width: clamp(8.75rem, 28vw, 11.25rem); }
	}
</style>
