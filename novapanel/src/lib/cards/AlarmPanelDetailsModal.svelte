<script lang="ts">
	import { selectedLanguageStore, translate, type TranslationKey } from '$lib/i18n';
	import { entityStore } from '$lib/ha/entities-store';
	import { callHaService } from '$lib/ha/service-call';
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';

	type Props = {
		t: (key: TranslationKey) => string;
		entityId?: string;
		onClose: () => void;
	};

	let { t, entityId, onClose }: Props = $props();

	const alarmEntity = $derived(
		$entityStore.entities.find((entity) => entity.entityId === (entityId ?? ''))
	);
	const state = $derived((alarmEntity?.state ?? '').toLowerCase());
	const tone = $derived(
		state.includes('disarmed') ? 'safe'
		: state.includes('arming') || state.includes('pending') ? 'pending'
		: state.includes('triggered') ? 'triggered'
		: 'armed'
	);
	const stateLabel = $derived(
		state.includes('disarmed') ? translate('Uitgeschakeld', $selectedLanguageStore)
		: state.includes('arming') ? translate('Wordt ingeschakeld…', $selectedLanguageStore)
		: state.includes('pending') ? translate('In afwachting', $selectedLanguageStore)
		: state.includes('triggered') ? 'ALARM!'
		: translate('Ingeschakeld', $selectedLanguageStore)
	);
	const iconName = $derived(
		state.includes('disarmed') ? 'mdi:shield-off-outline'
		: state.includes('arming') || state.includes('pending') ? 'mdi:shield-half-full'
		: state.includes('triggered') ? 'mdi:shield-alert-outline'
		: state === 'armed_home' ? 'mdi:shield-home-outline'
		: state === 'armed_night' ? 'mdi:shield-moon-outline'
		: 'mdi:shield-lock-outline'
	);

	let pin = $state('');
	let busy = $state(false);
	let error = $state('');

	function tapDigit(d: string) { if (pin.length >= 8) return; pin += d; error = ''; }
	function tapBack() { pin = pin.slice(0, -1); }

	async function callAlarm(service: string) {
		busy = true; error = '';
		try {
			const data: Record<string, unknown> = { entity_id: entityId };
			if (service === 'alarm_disarm' && pin) data.code = pin;
			await callHaService('alarm_control_panel', service, data);
			pin = '';
		} catch {
			error = t('actionFailedPrefix');
		} finally { busy = false; }
	}

	const isDisarmed = $derived(state.includes('disarmed'));
	const modes = [
		{ label: translate('Thuis', $selectedLanguageStore), service: 'alarm_arm_home', icon: 'mdi:shield-home-outline' },
		{ label: translate('Weg', $selectedLanguageStore), service: 'alarm_arm_away', icon: 'mdi:shield-lock-outline' },
		{ label: translate('Nacht', $selectedLanguageStore), service: 'alarm_arm_night', icon: 'mdi:shield-moon-outline' },
	];
</script>

<button type="button" class="modal-overlay" onclick={onClose} aria-label={t('closeOverlay')}></button>
<section class="alarm-modal np-detail" role="dialog" aria-modal="true" aria-label={t('cardTypeAlarmPanel')}>
	<div class="np-detail-head" style="--np-tint: rgba(248,113,113,0.18); --np-color: #f87171;">
		<div class="np-detail-head-glow" aria-hidden="true"></div>
		<div class="np-detail-head-icon"><TablerIcon name="shield-lock" size={22} /></div>
		<div class="np-detail-head-text">
			<div class="np-detail-head-title">{alarmEntity?.friendlyName ?? t('cardTypeAlarmPanel')}</div>
			<div class="np-detail-head-sub">{alarmEntity ? stateLabel : t('alarmNoEntitySelected')}</div>
		</div>
		</div>
	{#if !alarmEntity}
		<div class="no-entity">{t('alarmNoEntitySelected')}</div>
	{:else}
		<div class={`alarm-body tone-${tone}`}>
			<div class="alarm-bg-glow" aria-hidden="true"></div>

			<!-- Hero status circle with concentric rings -->
			<div class="hero-circle-wrap">
				<svg class="hero-rings" viewBox="0 0 240 240" aria-hidden="true">
					<circle class="ring ring-outer" cx="120" cy="120" r="110" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.15"/>
					<circle class="ring ring-mid" cx="120" cy="120" r="92" fill="none" stroke="currentColor" stroke-width="0.5" opacity="0.20"/>
					<circle class="ring ring-progress" cx="120" cy="120" r="102" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="641" stroke-dashoffset="160" transform="rotate(-90 120 120)"/>
					{#if tone === 'pending' || tone === 'triggered'}
						<circle class="ring ring-pulse" cx="120" cy="120" r="116" fill="none" stroke="currentColor" stroke-width="1"/>
					{/if}
				</svg>
				<div class="hero-icon-bg">
					<StatusIcon icon={iconName} size={70} />
				</div>
			</div>

			<!-- Status label below circle -->
			<div class="hero-status-text">
				<div class="hero-state-label">{stateLabel}</div>
				<div class="hero-device-name">{alarmEntity.friendlyName}</div>
			</div>

			{#if !isDisarmed}
				<!-- Pin entry — big tile dots -->
				<div class="pin-section">
					<div class="pin-tiles">
						{#each Array(6) as _, i}
							<div class={`pin-tile ${i < pin.length ? 'filled' : ''}`}>
								{#if i < pin.length}<span class="pin-tile-mark">●</span>{/if}
							</div>
						{/each}
					</div>
					{#if error}<div class="pin-error">{error}</div>{/if}
				</div>

				<!-- Numpad — big circular buttons -->
				<div class="numpad">
					{#each ['1','2','3','4','5','6','7','8','9','','0','⌫'] as key}
						{#if key === ''}<div></div>
						{:else if key === '⌫'}
							<button type="button" class="numpad-btn numpad-back" onclick={tapBack} disabled={busy} aria-label="Wis">
								<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M22 3H7l-5 9 5 9h15a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/>
									<line x1="18" y1="9" x2="12" y2="15"/>
									<line x1="12" y1="9" x2="18" y2="15"/>
								</svg>
							</button>
						{:else}
							<button type="button" class="numpad-btn" onclick={() => tapDigit(key)} disabled={busy}>{key}</button>
						{/if}
					{/each}
				</div>
			{:else if error}
				<div class="pin-error alarm-action-error">{error}</div>
			{/if}

			<!-- Action buttons -->
			<div class="alarm-actions">
				{#if isDisarmed}
					{#each modes as mode}
						<button type="button" class="mode-tile" onclick={() => callAlarm(mode.service)} disabled={busy}>
							<div class="mode-icon-wrap"><StatusIcon icon={mode.icon} size={22} /></div>
							<span class="mode-label">{mode.label}</span>
						</button>
					{/each}
				{:else}
					<button type="button" class="action-btn action-disarm" onclick={() => callAlarm('alarm_disarm')} disabled={busy}>
						<StatusIcon icon="mdi:shield-off-outline" size={18} /><span>Uitschakelen</span>
					</button>
				{/if}
			</div>
		</div>
	{/if}
</section>

<style>
	.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); border: 0; padding: 0; margin: 0; z-index: 40; cursor: default; }
	.alarm-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 60; background: linear-gradient(180deg, #1a2238 0%, #0f1424 100%); border: 0.5px solid rgba(255,255,255,0.08); border-radius: 18px; width: min(var(--popup-width, 850px), calc(100vw - 1.5rem)); height: min(var(--popup-height, 1140px), calc(100vh - 1.5rem)); max-height: calc(100vh - 1.5rem); display: flex; flex-direction: column; overflow: hidden; }
	.alarm-modal::before { content: ''; position: absolute; top: 0; left: 50%; width: 60%; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent); transform: translateX(-50%); pointer-events: none; }

	/* Premium detail-modal header */
	.np-detail-head { padding: 18px 22px 14px; border-bottom: 0.5px solid rgba(255,255,255,0.06); display: flex; align-items: center; gap: 12px; position: relative; overflow: hidden; flex-shrink: 0; }
	.np-detail-head-glow { position: absolute; top: -100px; left: -40px; width: 220px; height: 220px; background: radial-gradient(circle, var(--np-tint, rgba(96,165,250,0.18)), transparent 70%); pointer-events: none; filter: blur(20px); }
	.np-detail-head-icon { width: 38px; height: 38px; border-radius: 10px; display: grid; place-items: center; background: var(--np-tint); border: 0.5px solid rgba(255,255,255,0.10); color: var(--np-color); flex-shrink: 0; position: relative; z-index: 1; }
	.np-detail-head-text { flex: 1; min-width: 0; position: relative; z-index: 1; }
	.np-detail-head-title { font-size: 15px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.2; color: #f5f5f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.np-detail-head-sub { font-size: 11.5px; color: rgba(255,255,255,0.5); margin-top: 3px; }
	.np-detail-head-close { background: rgba(255,255,255,0.05); border: 0.5px solid rgba(255,255,255,0.08); width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; color: rgba(255,255,255,0.6); cursor: pointer; position: relative; z-index: 1; transition: background 0.15s, transform 0.15s; flex-shrink: 0; }
	.np-detail-head-close:hover { background: rgba(255,255,255,0.10); transform: scale(1.05); }

	.modal-head { display: none; }
	.no-entity { padding: 32px 20px; text-align: center; color: rgba(255,255,255,0.45); font-size: 13px; }

	/* Body — vertical layout with hero centered */
	.alarm-body {
		display: flex; flex-direction: column;
		gap: 16px;
		padding: 20px 22px 22px;
		flex: 1 1 auto;
		min-height: 0;
		align-items: center;
		justify-content: flex-start;
		position: relative;
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		touch-action: pan-y;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}
	.alarm-body::-webkit-scrollbar { width: 0; height: 0; display: none; }
	.alarm-body > .hero-circle-wrap,
	.alarm-body > .hero-status-text,
	.alarm-body > .pin-section,
	.alarm-body > .numpad,
	.alarm-body > .alarm-actions { width: min(320px, 100%); }

	/* Tone colors */
	.tone-safe { --np-tone: #4ade80; --np-tone-glow: rgba(74,222,128,0.32); }
	.tone-armed { --np-tone: #f87171; --np-tone-glow: rgba(248,113,113,0.32); }
	.tone-pending { --np-tone: #fbbf24; --np-tone-glow: rgba(251,191,36,0.32); }
	.tone-triggered { --np-tone: #ff4444; --np-tone-glow: rgba(255,68,68,0.42); }

	/* Big background glow that fills mood */
	.alarm-bg-glow {
		position: absolute;
		top: -10%; left: 50%;
		transform: translateX(-50%);
		width: 380px; height: 380px;
		border-radius: 50%;
		background: radial-gradient(circle, var(--np-tone-glow), transparent 65%);
		filter: blur(40px);
		pointer-events: none;
		opacity: 0.7;
		transition: background 0.5s, opacity 0.5s;
		z-index: 0;
	}
	.tone-triggered .alarm-bg-glow { animation: bg-pulse 0.9s ease-in-out infinite; }
	@keyframes bg-pulse { 0%,100%{opacity:0.55} 50%{opacity:0.95} }

	/* Hero circle — concentric rings + icon */
	.hero-circle-wrap {
		position: relative;
		width: 200px; height: 200px;
		margin-top: 6px;
		display: grid;
		place-items: center;
		color: var(--np-tone);
		flex-shrink: 0;
		z-index: 1;
	}
	.hero-rings {
		position: absolute;
		inset: 0;
		width: 100%; height: 100%;
	}
	.ring-progress {
		stroke: var(--np-tone);
		filter: drop-shadow(0 0 8px var(--np-tone-glow));
		transition: stroke-dashoffset 0.6s ease, stroke 0.5s;
	}
	.tone-pending .ring-progress { animation: ring-spin 2.5s linear infinite; transform-origin: 120px 120px; }
	@keyframes ring-spin { from { transform: rotate(-90deg);} to {transform: rotate(270deg);} }
	.ring-pulse { stroke: var(--np-tone); animation: ring-pulse-anim 1.4s ease-out infinite; }
	@keyframes ring-pulse-anim {
		0% { r: 102; opacity: 0.85; stroke-width: 2; }
		100% { r: 130; opacity: 0; stroke-width: 0.5; }
	}
	.hero-icon-bg {
		width: 130px; height: 130px;
		border-radius: 50%;
		display: grid; place-items: center;
		background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.05), transparent 70%), rgba(0,0,0,0.30);
		border: 0.5px solid rgba(255,255,255,0.08);
		color: var(--np-tone);
		box-shadow: inset 0 0 24px rgba(0,0,0,0.4), 0 0 36px var(--np-tone-glow);
		transition: box-shadow 0.5s, color 0.5s;
		position: relative;
		z-index: 1;
	}

	/* Status text below circle */
	.hero-status-text {
		text-align: center;
		display: flex; flex-direction: column; gap: 4px;
		z-index: 1;
	}
	.hero-state-label {
		font-size: 22px;
		font-weight: 600;
		letter-spacing: -0.01em;
		color: var(--np-tone);
		text-shadow: 0 0 24px var(--np-tone-glow);
		transition: color 0.5s;
	}
	.hero-device-name {
		font-size: 12px;
		font-weight: 500;
		color: rgba(255,255,255,0.5);
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	/* Pin section — 6 big tiles */
	.pin-section { display: flex; flex-direction: column; align-items: center; gap: 8px; z-index: 1; }
	.pin-tiles {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 8px;
		width: 100%;
	}
	.pin-tile {
		aspect-ratio: 1;
		border-radius: 10px;
		border: 0.5px solid rgba(255,255,255,0.08);
		background: rgba(255,255,255,0.025);
		display: grid;
		place-items: center;
		transition: all 0.2s;
	}
	.pin-tile.filled {
		background: linear-gradient(135deg, var(--np-tone-glow), transparent 70%), rgba(255,255,255,0.04);
		border-color: var(--np-tone);
		box-shadow: 0 0 12px var(--np-tone-glow);
	}
	.pin-tile-mark {
		font-size: 14px;
		color: var(--np-tone);
		line-height: 1;
	}
	.pin-error { font-size: 11.5px; color: #f87171; font-weight: 500; }
	.alarm-action-error { width: min(320px, 100%); text-align: center; z-index: 1; }

	/* Numpad — large round buttons */
	.numpad {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		z-index: 1;
	}
	.numpad-btn {
		aspect-ratio: 1;
		max-height: 64px;
		border-radius: 50%;
		border: 0.5px solid rgba(255,255,255,0.08);
		background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.045), rgba(255,255,255,0.02) 70%);
		color: #f5f5f5;
		font-size: 22px;
		font-weight: 400;
		letter-spacing: -0.01em;
		cursor: pointer;
		transition: background 0.15s, border-color 0.15s, transform 0.15s, box-shadow 0.15s;
		display: grid;
		place-items: center;
		font-family: inherit;
	}
	.numpad-btn:hover:not(:disabled) {
		background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08), rgba(255,255,255,0.035) 70%);
		border-color: rgba(255,255,255,0.15);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0,0,0,0.25);
	}
	.numpad-btn:active:not(:disabled) {
		background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.12), rgba(255,255,255,0.05) 70%);
		transform: scale(0.96);
	}
	.numpad-btn:disabled { opacity: 0.35; cursor: not-allowed; }
	.numpad-back { color: rgba(255,255,255,0.55); }
	.numpad-back:hover:not(:disabled) { color: #f87171; border-color: rgba(248,113,113,0.30); }

	/* Action buttons */
	.alarm-actions { display: flex; gap: 8px; z-index: 1; }
	.mode-tile {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 14px 8px;
		border-radius: 14px;
		border: 0.5px solid rgba(255,255,255,0.08);
		background: rgba(255,255,255,0.025);
		color: #f5f5f5;
		cursor: pointer;
		transition: all 0.15s;
		font-family: inherit;
	}
	.mode-tile:hover:not(:disabled) {
		background: rgba(255,255,255,0.045);
		border-color: rgba(248,113,113,0.30);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0,0,0,0.25);
	}
	.mode-tile:disabled { opacity: 0.4; cursor: not-allowed; }
	.mode-icon-wrap {
		width: 36px; height: 36px;
		border-radius: 10px;
		background: rgba(248,113,113,0.10);
		color: #f87171;
		display: grid; place-items: center;
	}
	.mode-label { font-size: 12px; font-weight: 500; letter-spacing: -0.005em; }

	.action-btn {
		flex: 1;
		height: 56px;
		border-radius: 14px;
		border: 0.5px solid rgba(255,255,255,0.07);
		background: rgba(255,255,255,0.025);
		color: #f5f5f5;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.15s;
		font-family: inherit;
	}
	.action-btn:hover:not(:disabled) {
		background: rgba(255,255,255,0.045);
		border-color: rgba(255,255,255,0.13);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0,0,0,0.25);
	}
	.action-btn:disabled { opacity: 0.35; cursor: not-allowed; }
	.action-disarm {
		background: linear-gradient(135deg, rgba(248,113,113,0.14), transparent 60%), rgba(248,113,113,0.08);
		color: #fca5a5;
		border-color: rgba(248,113,113,0.25);
	}
	.action-disarm:hover:not(:disabled) {
		background: linear-gradient(135deg, rgba(248,113,113,0.22), transparent 60%), rgba(248,113,113,0.12);
		border-color: rgba(248,113,113,0.40);
		box-shadow: 0 4px 16px rgba(248,113,113,0.25);
	}
</style>
