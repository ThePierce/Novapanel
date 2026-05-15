<script lang="ts">
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
	import { entityStore } from '$lib/ha/entities-store';
	import { callHaService } from '$lib/ha/service-call';
	import type { HomeAssistantEntity } from '$lib/ha/entities-service';
	import { selectedLanguageStore, translate } from '$lib/i18n';

	type Props = {
		title?: string;
		entityId?: string;
		icon?: string;
		onClose: () => void;
	};

	let { title = '', entityId, icon = 'mdi:lightbulb-outline', onClose }: Props = $props();
	let brightnessDraft = $state(0);
	let temperatureDraft = $state(3500);
	let draggingBrightness = $state(false);
	let busy = $state(false);
	let error = $state('');
	let brightnessTimer: ReturnType<typeof setTimeout> | null = null;
	let temperatureTimer: ReturnType<typeof setTimeout> | null = null;

	const entity = $derived(
		$entityStore.entities.find((entry: HomeAssistantEntity) => entry.entityId === (entityId ?? ''))
	);
	const isOn = $derived((entity?.state ?? '').toLowerCase() === 'on');
	const isUnavailable = $derived(!entity || entity.state === 'unavailable' || entity.state === 'unknown');
	const serviceDomain = $derived(
		(entity?.domain || entityId?.split('.')[0] || 'light').toLowerCase()
	);
	const displayName = $derived(
		(title && title.trim().length > 0)
			? title.trim()
			: entity?.friendlyName ?? entityId ?? translate('Lamp', $selectedLanguageStore)
	);
	const cardIcon = $derived((icon && icon.trim().length > 0) ? icon.trim() : 'mdi:lightbulb-outline');
	const brightnessPct = $derived(
		(() => {
			const raw = entity?.attributes?.brightness;
			if (typeof raw !== 'number' || !Number.isFinite(raw)) return isOn ? 100 : 0;
			return Math.max(0, Math.min(100, Math.round((raw / 255) * 100)));
		})()
	);
	const supportedModes = $derived(
		(() => {
			const raw = entity?.attributes?.supported_color_modes;
			return Array.isArray(raw) ? raw.map(String) : [];
		})()
	);
	const supportsBrightness = $derived(
		serviceDomain === 'light' &&
			(
				supportedModes.some((mode) =>
					['brightness', 'color_temp', 'hs', 'rgb', 'rgbw', 'rgbww', 'xy', 'white'].includes(mode)
				) ||
				typeof entity?.attributes?.brightness === 'number' ||
				(typeof entity?.attributes?.supported_features === 'number' &&
					(entity.attributes.supported_features & 1) === 1)
			)
	);
	const supportsColor = $derived(
		supportedModes.some((mode) => ['hs', 'rgb', 'rgbw', 'rgbww', 'xy'].includes(mode))
	);
	const supportsTemperature = $derived(supportedModes.includes('color_temp'));
	const minKelvin = $derived(
		typeof entity?.attributes?.min_color_temp_kelvin === 'number'
			? Math.round(entity.attributes.min_color_temp_kelvin)
			: 2000
	);
	const maxKelvin = $derived(
		typeof entity?.attributes?.max_color_temp_kelvin === 'number'
			? Math.round(entity.attributes.max_color_temp_kelvin)
			: 6500
	);
	const currentKelvin = $derived(
		typeof entity?.attributes?.color_temp_kelvin === 'number'
			? Math.round(entity.attributes.color_temp_kelvin)
			: Math.round((minKelvin + maxKelvin) / 2)
	);
	const stateLabel = $derived(
		isUnavailable
			? translate('Niet beschikbaar', $selectedLanguageStore)
			: supportsBrightness && isOn
				? `${brightnessPct}%`
				: isOn
					? translate('Aan', $selectedLanguageStore)
					: translate('Uit', $selectedLanguageStore)
	);
	const glowColor = $derived(isOn ? 'rgba(255,211,56,0.22)' : 'rgba(141,152,170,0.16)');
	const sliderFill = $derived((isOn || draggingBrightness) ? brightnessDraft : 0);
	const swatches = [
		{ color: '#fde1c2', label: 'Warm wit' },
		{ color: '#ffc27d', label: 'Zacht warm' },
		{ color: '#ffa64d', label: 'Oranje' },
		{ color: '#7b4dff', label: 'Paars' }
	];

	$effect(() => {
		if (!draggingBrightness) brightnessDraft = brightnessPct;
	});

	$effect(() => {
		temperatureDraft = currentKelvin;
	});

	$effect(() => {
		return () => {
			if (brightnessTimer) clearTimeout(brightnessTimer);
			if (temperatureTimer) clearTimeout(temperatureTimer);
		};
	});

	function serviceData(extra: Record<string, unknown> = {}) {
		if (serviceDomain !== 'light') return { entity_id: entityId };
		return { entity_id: entityId, ...extra };
	}

	async function callLight(service: 'turn_on' | 'turn_off', data: Record<string, unknown> = {}) {
		if (!entityId || busy) return;
		busy = true;
		error = '';
		try {
			await callHaService(serviceDomain, service, serviceData(data));
		} catch (err) {
			error = err instanceof Error && err.message ? err.message : translate('Actie mislukt', $selectedLanguageStore);
		} finally {
			busy = false;
		}
	}

	function scheduleBrightness(value: number, delay = 140) {
		if (brightnessTimer) clearTimeout(brightnessTimer);
		brightnessTimer = setTimeout(() => {
			brightnessTimer = null;
			const pct = Math.max(0, Math.min(100, Math.round(value)));
			void callLight(pct <= 0 ? 'turn_off' : 'turn_on', pct <= 0 ? {} : { brightness_pct: pct });
		}, delay);
	}

	function scheduleTemperature(value: number, delay = 180) {
		if (temperatureTimer) clearTimeout(temperatureTimer);
		temperatureTimer = setTimeout(() => {
			temperatureTimer = null;
			const kelvin = Math.max(minKelvin, Math.min(maxKelvin, Math.round(value)));
			void callLight('turn_on', { color_temp_kelvin: kelvin, brightness_pct: Math.max(1, brightnessDraft) });
		}, delay);
	}

	function hexToRgb(hex: string): [number, number, number] {
		const clean = hex.replace('#', '').trim();
		const full = clean.length === 3 ? clean.split('').map((part) => `${part}${part}`).join('') : clean;
		const value = Number.parseInt(full, 16);
		return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
	}

	function setColor(hex: string) {
		const rgb = hexToRgb(hex);
		void callLight('turn_on', { rgb_color: rgb, brightness_pct: Math.max(1, brightnessDraft || 100) });
	}

	function setTemperature(value: number) {
		temperatureDraft = value;
		scheduleTemperature(value, 0);
	}

	function updateBrightnessFromPointer(event: PointerEvent, immediate = false) {
		const target = event.currentTarget as HTMLElement;
		const rect = target.getBoundingClientRect();
		if (rect.height <= 0) return;
		const pct = Math.max(0, Math.min(100, ((rect.bottom - event.clientY) / rect.height) * 100));
		const rounded = Math.round(pct);
		brightnessDraft = rounded;
		scheduleBrightness(rounded, immediate ? 0 : 120);
	}

	function startBrightnessDrag(event: PointerEvent) {
		if (busy || isUnavailable) return;
		draggingBrightness = true;
		(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
		updateBrightnessFromPointer(event);
	}

	function moveBrightnessDrag(event: PointerEvent) {
		if (!draggingBrightness) return;
		updateBrightnessFromPointer(event);
	}

	function endBrightnessDrag(event: PointerEvent) {
		if (!draggingBrightness) return;
		updateBrightnessFromPointer(event, true);
		draggingBrightness = false;
		(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
	}

	function togglePower() {
		void callLight(isOn ? 'turn_off' : 'turn_on');
	}
</script>

<button type="button" class="modal-overlay light-modal-overlay" onclick={onClose} aria-label={translate('close', $selectedLanguageStore)}></button>
<section
	class="settings-modal app-popup light-detail-modal np-detail"
	role="dialog"
	aria-modal="true"
	aria-label={displayName}
	style={`--light-glow: ${glowColor}; --brightness-pct: ${sliderFill}%;`}
>
	<div class="np-detail-head" style="--np-tint: rgba(255,211,56,0.18); --np-color: #ffd338;">
		<div class="np-detail-head-glow" aria-hidden="true"></div>
		<div class="np-detail-head-icon"><StatusIcon icon={cardIcon} size={24} /></div>
		<div class="np-detail-head-text">
			<div class="np-detail-head-title">{displayName}</div>
			<div class="np-detail-head-sub">{stateLabel}</div>
		</div>
	</div>

	<div class="light-detail-body">
		{#if !entity}
			<div class="light-empty">
				<StatusIcon icon={cardIcon} size={46} />
				<span>{translate('Geen lamp gekoppeld', $selectedLanguageStore)}</span>
			</div>
		{:else}
			{#if supportsBrightness}
				<button
					type="button"
					class="homekit-brightness"
					class:is-off={!isOn || sliderFill <= 0}
					aria-label={`${translate('Helderheid', $selectedLanguageStore)} ${Math.round(brightnessDraft)} ${translate('procent', $selectedLanguageStore)}`}
					disabled={busy || isUnavailable}
					onpointerdown={startBrightnessDrag}
					onpointermove={moveBrightnessDrag}
					onpointerup={endBrightnessDrag}
					onpointercancel={endBrightnessDrag}
				>
					<span class="homekit-brightness-fill" aria-hidden="true"></span>
					<span class="homekit-brightness-icon" aria-hidden="true">
						<StatusIcon icon={cardIcon} size={52} />
					</span>
				</button>
			{:else}
				<button
					type="button"
					class="homekit-brightness homekit-toggle"
					class:is-on={isOn}
					class:is-off={!isOn}
					aria-label={`${displayName} ${isOn ? translate('uitzetten', $selectedLanguageStore) : translate('aanzetten', $selectedLanguageStore)}`}
					disabled={busy || isUnavailable}
					onclick={togglePower}
				>
					<span class="homekit-brightness-fill" aria-hidden="true"></span>
					<span class="homekit-brightness-icon" aria-hidden="true">
						<StatusIcon icon={cardIcon} size={52} />
					</span>
				</button>
			{/if}

			{#if supportsColor}
				<div class="color-dock" aria-label={translate('Kleuren', $selectedLanguageStore)}>
					<div class="color-grid">
						{#each swatches as swatch}
							<button
								type="button"
								class="color-dot"
								style={`--swatch: ${swatch.color};`}
								aria-label={translate(swatch.label, $selectedLanguageStore)}
								onclick={() => setColor(swatch.color)}
								disabled={busy || isUnavailable}
							></button>
						{/each}
						<button
							type="button"
							class="color-dot color-wheel"
							aria-label={translate('Helder wit', $selectedLanguageStore)}
							onclick={() => setColor('#ffffff')}
							disabled={busy || isUnavailable}
						></button>
					</div>
				</div>
			{/if}

			{#if supportsTemperature}
				<div class="temperature-dock" aria-label={translate('Wittemperatuur', $selectedLanguageStore)}>
					<button type="button" onclick={() => setTemperature(minKelvin)} disabled={busy || isUnavailable}>
						{translate('Warm', $selectedLanguageStore)}
					</button>
					<button type="button" onclick={() => setTemperature(Math.round((minKelvin + maxKelvin) / 2))} disabled={busy || isUnavailable}>
						{translate('Neutraal', $selectedLanguageStore)}
					</button>
					<button type="button" onclick={() => setTemperature(maxKelvin)} disabled={busy || isUnavailable}>
						{translate('Koel', $selectedLanguageStore)}
					</button>
				</div>
			{/if}

			{#if error}
				<div class="light-error">{error}</div>
			{/if}
		{/if}
	</div>
</section>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 40;
		margin: 0;
		padding: 0;
		border: 0;
		background: rgba(0,0,0,0.36);
	}
	.light-detail-modal {
		--popup-width: min(850px, calc(100vw - 1.5rem));
		--popup-height: min(1140px, calc(100vh - 1.5rem));
		padding: 0 !important;
		border-radius: 18px;
		border: 0.5px solid rgba(255,255,255,0.08);
		grid-template-rows: auto minmax(0, 1fr);
		box-sizing: border-box;
		background:
			radial-gradient(circle at 50% 8%, var(--light-glow), transparent 42%),
			#121722;
	}
	.light-detail-body {
		display: grid;
		justify-items: center;
		align-content: start;
		gap: 1rem;
		padding: var(--np-popup-body-pad-y, 1rem) var(--np-popup-body-pad-x, 1.25rem) 1.1rem;
		overflow: auto;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}
	.light-detail-body::-webkit-scrollbar {
		width: 0;
		height: 0;
		display: none;
	}
	.light-empty {
		min-height: 18rem;
		display: grid;
		place-items: center;
		align-content: center;
		gap: 0.85rem;
		color: rgba(255,255,255,0.72);
	}
	.homekit-brightness {
		position: relative;
		width: clamp(7.8rem, 24vw, 10.5rem);
		height: clamp(18rem, 42vh, 24rem);
		border: 0;
		border-radius: clamp(2.6rem, 7vw, 3.8rem);
		background: rgba(255,255,255,0.10);
		box-shadow:
			inset 0 0 0 1px rgba(255,255,255,0.06),
			inset 0 -24px 60px rgba(0,0,0,0.16),
			0 18px 48px rgba(0,0,0,0.24);
		overflow: hidden;
		cursor: ns-resize;
		touch-action: none;
		-webkit-tap-highlight-color: transparent;
	}
	.homekit-brightness:disabled {
		cursor: default;
		opacity: 0.72;
	}
	.homekit-brightness-fill {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: var(--brightness-pct);
		background: #ffd400;
		transition: height 120ms ease, background 160ms ease;
	}
	.homekit-brightness-icon {
		position: absolute;
		left: 50%;
		bottom: clamp(2rem, 5vh, 3.2rem);
		z-index: 2;
		display: grid;
		place-items: center;
		color: #ffffff;
		transform: translateX(-50%);
		filter: drop-shadow(0 2px 8px rgba(0,0,0,0.18));
		pointer-events: none;
	}
	.homekit-brightness.is-off .homekit-brightness-icon {
		color: #ffd400;
	}
	.homekit-toggle {
		cursor: pointer;
		touch-action: manipulation;
	}
	.homekit-toggle .homekit-brightness-fill {
		left: 0.55rem;
		right: 0.55rem;
		bottom: 0.55rem;
		height: calc(50% - 0.75rem);
		border-radius: clamp(2rem, 6vw, 3.25rem);
		background: rgba(0,0,0,0.34);
		box-shadow:
			inset 0 0 0 1px rgba(255,255,255,0.04),
			inset 0 -18px 36px rgba(0,0,0,0.18),
			0 8px 22px rgba(0,0,0,0.16);
		transition:
			top 180ms ease,
			bottom 180ms ease,
			background 180ms ease,
			box-shadow 180ms ease;
	}
	.homekit-toggle.is-on .homekit-brightness-fill {
		top: 0.55rem;
		bottom: auto;
		background: #ffd400;
		box-shadow:
			inset 0 0 0 1px rgba(255,255,255,0.20),
			0 10px 28px rgba(255,211,56,0.24);
	}
	.homekit-toggle .homekit-brightness-icon {
		bottom: 25%;
		color: #ffd400;
		transform: translate(-50%, 50%);
		transition:
			top 180ms ease,
			bottom 180ms ease,
			color 180ms ease,
			transform 180ms ease;
	}
	.homekit-toggle.is-on .homekit-brightness-icon {
		top: 25%;
		bottom: auto;
		color: #ffffff;
		transform: translate(-50%, -50%);
	}
	.color-dock,
	.temperature-dock {
		width: 100%;
		display: grid;
		justify-items: center;
	}
	.color-grid {
		width: min(100%, 23rem);
		display: flex;
		justify-content: center;
		gap: clamp(0.55rem, 2vw, 0.9rem);
	}
	.color-dot {
		width: clamp(2.9rem, 9vw, 4rem);
		height: clamp(2.9rem, 9vw, 4rem);
		border: 2px solid rgba(255,255,255,0.44);
		border-radius: 999px;
		background: var(--swatch);
		cursor: pointer;
		box-shadow:
			inset 0 0 0 1px rgba(0,0,0,0.08),
			0 8px 20px rgba(0,0,0,0.20);
	}
	.color-dot:hover {
		transform: translateY(-1px);
	}
	.color-wheel {
		position: relative;
		background: conic-gradient(#ff3b30, #ffd60a, #34c759, #32ade6, #7b4dff, #ff3b30);
		border-color: rgba(255,255,255,0.55);
	}
	.color-wheel::after {
		content: '';
		position: absolute;
		inset: 0.48rem;
		border-radius: inherit;
		background: #ffffff;
		box-shadow: inset 0 0 0 1px rgba(0,0,0,0.08);
	}
	.temperature-dock {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 0.45rem;
		width: min(100%, 21rem);
	}
	.temperature-dock button {
		height: 2.35rem;
		border: 0;
		border-radius: 999px;
		color: rgba(255,255,255,0.9);
		background: rgba(255,255,255,0.13);
		box-shadow: inset 0 0 0 1px rgba(255,255,255,0.13);
		font-weight: 760;
		cursor: pointer;
	}
	.light-error {
		padding: 0.7rem 0.85rem;
		border-radius: 14px;
		color: #fecaca;
		background: rgba(248,113,113,0.13);
		font-size: 0.82rem;
		font-weight: 650;
	}
	@media (max-width: 520px) {
		.light-detail-modal {
			--popup-width: min(850px, calc(100vw - 1.5rem));
			--popup-height: min(1140px, calc(100vh - 1.5rem));
		}
		.light-detail-body {
			padding-left: 0.85rem;
			padding-right: 0.85rem;
		}
		.color-grid {
			gap: 0.55rem;
		}
	}
</style>
