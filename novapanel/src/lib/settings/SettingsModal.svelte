<script lang="ts">
	import { translate, type TranslationKey } from '$lib/i18n';
	import LanguageConfig from '$lib/LanguageConfig.svelte';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';

	type SettingsTab = 'general' | 'layout' | 'theme';

	type Props = {
		t: (key: TranslationKey) => string;
		activeSettingsTab: SettingsTab;
		selectedColumns: 1 | 2 | 3;
		selectedLanguage: 'nl' | 'en' | 'de' | 'fr' | 'es';
		spotifyClientId: string;
		spotifyClientSecret: string;
		spotifyRedirectUri: string;
		onClose: () => void;
		onSetSettingsTab: (tab: SettingsTab) => void;
		onSetColumns: (value: 1 | 2 | 3) => void;
		onSetLanguage: (value: 'nl' | 'en' | 'de' | 'fr' | 'es') => void;
		onSetSpotifyClientId: (value: string) => void;
		onSetSpotifyClientSecret: (value: string) => void;
		onSetSpotifyRedirectUri: (value: string) => void;
		onExportPanelState: () => void | Promise<void>;
		onImportPanelState: (file: File) => Promise<{ serverOk: boolean }>;
		onSave: () => void;
	};

	let {
		t,
		activeSettingsTab,
		selectedColumns,
		selectedLanguage,
		spotifyClientId,
		spotifyClientSecret,
		spotifyRedirectUri,
		onClose,
		onSetSettingsTab,
		onSetColumns,
		onSetLanguage,
		onSetSpotifyClientId,
		onSetSpotifyClientSecret,
		onSetSpotifyRedirectUri,
		onExportPanelState,
		onImportPanelState,
		onSave
	}: Props = $props();

	let savePulse = $state(false);
	let panelIoNote = $state('');
	let importFileInput: HTMLInputElement | null = $state(null);
	let spotifyExpanded = $state(true);
	let spotifyAuthStatus = $state<'unknown' | 'connected' | 'not_connected' | 'checking'>('unknown');
	let spotifyAuthError = $state('');

	// Bereken redirect URI van huidige locatie als hint
	const detectedRedirectUri = $derived.by(() => {
		if (typeof window === 'undefined') return '';
		const origin = window.location.origin;
		const path = window.location.pathname || '';
		const ingressPath =
			((window as unknown as { __novapanel_ingress?: string }).__novapanel_ingress || '').replace(/\/+$/, '');
		if (ingressPath) {
			return `${origin}${ingressPath}/api/spotify/auth/callback`;
		}
		const pathIngressMatch = path.match(/^(\/api\/hassio_ingress\/[^/]+)/);
		if (pathIngressMatch?.[1]) {
			return `${origin}${pathIngressMatch[1]}/api/spotify/auth/callback`;
		}
		if (path.startsWith('/local_novapanel')) {
			return `${origin}/local_novapanel/api/spotify/auth/callback`;
		}
		return `${origin}/api/spotify/auth/callback`;
	});
	const exampleRedirectUri = 'https://jouw-home-assistant.example/api/hassio_ingress/<token>/api/spotify/auth/callback';
	const shownRedirectUri = $derived.by(() => detectedRedirectUri || exampleRedirectUri);
	let copiedRedirect = $state(false);

	async function copyDetectedRedirect() {
		if (!detectedRedirectUri) return;
		try {
			if (navigator.clipboard?.writeText) {
				await navigator.clipboard.writeText(detectedRedirectUri);
			} else {
				const ta = document.createElement('textarea');
				ta.value = detectedRedirectUri;
				ta.style.position = 'fixed';
				ta.style.opacity = '0';
				document.body.appendChild(ta);
				ta.select();
				document.execCommand('copy');
				document.body.removeChild(ta);
			}
			copiedRedirect = true;
			setTimeout(() => (copiedRedirect = false), 1600);
		} catch {
			// stilletjes negeren
		}
	}

	function buildIngressPath(p: string) {
		const ingress =
			typeof window !== 'undefined'
				? (((window as unknown as { __novapanel_ingress?: string }).__novapanel_ingress || '') as string)
				: '';
		return ingress ? `${ingress}${p}` : p;
	}

	function isIngressSpotifyRedirectUri(value: string) {
		return /\/api\/hassio_ingress\/[^/]+\/api\/spotify\/auth\/callback\/?$/i.test(value.trim());
	}

	function isLocalNovapanelSpotifyRedirectUri(value: string) {
		return /\/local_novapanel\/api\/spotify\/auth\/callback\/?$/i.test(value.trim());
	}

	function shouldUseDetectedSpotifyRedirectUri(value: string) {
		const trimmed = value.trim();
		if (!trimmed) return Boolean(detectedRedirectUri);
		if (!detectedRedirectUri) return false;
		if (trimmed === detectedRedirectUri) return false;
		return isIngressSpotifyRedirectUri(trimmed) || isLocalNovapanelSpotifyRedirectUri(trimmed);
	}

	async function checkSpotifyAuth() {
		spotifyAuthStatus = 'checking';
		spotifyAuthError = '';
		try {
			const resp = await fetch(buildIngressPath('/api/spotify/auth/status'));
			if (!resp.ok) {
				spotifyAuthStatus = 'not_connected';
				return;
			}
			const data = await resp.json();
			spotifyAuthStatus = data?.connected ? 'connected' : 'not_connected';
		} catch (e) {
			spotifyAuthStatus = 'not_connected';
			spotifyAuthError = e instanceof Error ? e.message : String(e);
		}
	}

	let spotifyAuthInProgress = $state(false);
	let spotifyAuthWindow: Window | null = null;
	let spotifyAuthPollTimer: ReturnType<typeof setInterval> | null = null;

	function stopAuthPolling() {
		if (spotifyAuthPollTimer) {
			clearInterval(spotifyAuthPollTimer);
			spotifyAuthPollTimer = null;
		}
	}

	function handleSpotifyAuthMessage(event: MessageEvent) {
		const data = event?.data;
		if (data && typeof data === 'object' && data.type === 'novapanel-spotify-auth' && data.status === 'connected') {
			spotifyAuthInProgress = false;
			stopAuthPolling();
			void checkSpotifyAuth();
		}
	}

	$effect(() => {
		if (typeof window === 'undefined') return;
		window.addEventListener('message', handleSpotifyAuthMessage);
		return () => {
			window.removeEventListener('message', handleSpotifyAuthMessage);
			stopAuthPolling();
		};
	});

	async function startSpotifyAuth() {
		// Eerst credentials opslaan, daarna een nieuw tabblad openen met de auth-URL.
		spotifyAuthError = '';
		try {
			if (shouldUseDetectedSpotifyRedirectUri(spotifyRedirectUri)) {
				onSetSpotifyRedirectUri(detectedRedirectUri);
			}
			await Promise.resolve(onSave());
			const resp = await fetch(buildIngressPath('/api/spotify/auth/start'));
			if (!resp.ok) {
				const text = await resp.text();
				spotifyAuthError = `${translate('Kon Spotify-auth niet starten. Controleer de credentials en redirect URI.', selectedLanguage)} (${resp.status}). ${text || ''}`.trim();
				return;
			}
			const data = await resp.json();
			if (!data?.url) {
				spotifyAuthError = translate('Geen auth-URL ontvangen van de server.', selectedLanguage);
				return;
			}
			// Open in nieuw tabblad zodat het ingress-iframe rustig blijft.
			spotifyAuthWindow = window.open(data.url, '_blank', 'noopener=no');
			if (!spotifyAuthWindow) {
				spotifyAuthError = translate('Pop-up geblokkeerd door de browser. Sta pop-ups toe voor deze site en probeer opnieuw.', selectedLanguage);
				return;
			}
			spotifyAuthInProgress = true;
			// Poll als fallback voor het geval het postMessage-bericht niet door komt
			// (kan gebeuren als de gebruiker handmatig sluit zonder de callback te voltooien).
			stopAuthPolling();
			let elapsedTicks = 0;
			spotifyAuthPollTimer = setInterval(async () => {
				elapsedTicks++;
				// Check of het auth-tab gesloten is
				try {
					if (spotifyAuthWindow && spotifyAuthWindow.closed) {
						await checkSpotifyAuth();
						spotifyAuthInProgress = false;
						stopAuthPolling();
						return;
					}
				} catch {
					// Cross-origin — kunnen we niet inspecteren. Status pollen werkt nog wel.
				}
				// Probeer ondertussen ook de auth-status; wordt 'connected' zodra de callback klaar is.
				const before = spotifyAuthStatus;
				await checkSpotifyAuth();
				if (spotifyAuthStatus === 'connected' && before !== 'connected') {
					spotifyAuthInProgress = false;
					stopAuthPolling();
				}
				// Stop sowieso na 3 minuten polling
				if (elapsedTicks > 90) {
					spotifyAuthInProgress = false;
					stopAuthPolling();
				}
			}, 2000);
		} catch (e) {
			spotifyAuthError = e instanceof Error ? e.message : String(e);
		}
	}

	$effect(() => {
		if (activeSettingsTab !== 'general') return;
		if (!spotifyClientId || !spotifyClientSecret) {
			spotifyAuthStatus = 'not_connected';
			return;
		}
		void checkSpotifyAuth();
	});

	async function handleSave() {
		await Promise.resolve(onSave());
		savePulse = true;
		setTimeout(() => {
			savePulse = false;
		}, 900);
	}

	async function handleImportPanelFile(event: Event) {
		const el = event.currentTarget as HTMLInputElement;
		const file = el.files?.[0];
		el.value = '';
		if (!file) return;
		panelIoNote = '';
		try {
			const r = await onImportPanelState(file);
			panelIoNote = r.serverOk ? t('panelStateImportOk') : t('panelStateImportOkLocal');
		} catch {
			panelIoNote = t('panelStateImportError');
		}
	}
</script>

<button type="button" class="modal-overlay" onclick={onClose} aria-label={t('closeOverlay')}></button>
<section class="settings-modal app-popup settings-config-modal np-detail" role="dialog" aria-modal="true" aria-label={t('settings')}>
	<div class="np-detail-head" style="--np-tint: rgba(167,139,250,0.18); --np-color: #a78bfa;">
		<div class="np-detail-head-glow" aria-hidden="true"></div>
		<div class="np-detail-head-icon"><TablerIcon name="adjustments" size={22} /></div>
		<div class="np-detail-head-text">
			<h3>{t('settings')}</h3>
			<div class="np-detail-head-sub">{translate('Personaliseer Novapanel', selectedLanguage)}</div>
		</div>
	</div>

	<div class="np-detail-tabs" role="tablist" aria-label={t('settingsTabs')}>
		<button
			type="button"
			role="tab"
			class:active={activeSettingsTab === 'general'}
			aria-selected={activeSettingsTab === 'general'}
			onclick={() => onSetSettingsTab('general')}
		>
			<TablerIcon name="world" size={14} />
			{t('general')}
		</button>
		<button
			type="button"
			role="tab"
			class:active={activeSettingsTab === 'layout'}
			aria-selected={activeSettingsTab === 'layout'}
			onclick={() => onSetSettingsTab('layout')}
		>
			<TablerIcon name="layout" size={14} />
			{t('layout')}
		</button>
		<button
			type="button"
			role="tab"
			class:active={activeSettingsTab === 'theme'}
			aria-selected={activeSettingsTab === 'theme'}
			onclick={() => onSetSettingsTab('theme')}
		>
			<TablerIcon name="palette" size={14} />
			{t('theme')}
		</button>
	</div>

	{#if activeSettingsTab === 'general'}
		<div class="np-detail-body settings-body">
			<div class="settings-section">
				<div class="settings-section-head">
					<TablerIcon name="language" size={16} />
					<h4>{t('language')}</h4>
				</div>
				<LanguageConfig
					selectedLanguage={selectedLanguage}
					label={t('language')}
					onLanguageChange={onSetLanguage}
					onchange={(event) => onSetLanguage((event as CustomEvent<{ language: 'nl' | 'en' | 'de' | 'fr' | 'es' }>).detail.language)}
				/>
			</div>

			<!-- =============== DERDE-PARTIJ INTEGRATIES =============== -->
			<div class="settings-section integrations">
				<div class="settings-section-head">
					<TablerIcon name="apps" size={16} />
					<h4>{t('thirdPartyIntegrations')}</h4>
				</div>

				<!-- Spotify -->
				<button
					type="button"
					class={`integration-toggle ${spotifyAuthStatus === 'connected' ? 'connected' : ''}`}
					aria-expanded={spotifyExpanded}
					onclick={() => (spotifyExpanded = !spotifyExpanded)}
				>
					<span class="integration-toggle-label">
						<span class="integration-icon spotify"><TablerIcon name="brand-spotify" size={16} /></span>
						<span class="integration-toggle-name">Spotify</span>
						{#if spotifyAuthStatus === 'connected'}
							<span class="integration-badge ok">
								<TablerIcon name="circle-check" size={11} />
								{t('spotifyStatusConnected')}
							</span>
						{:else if spotifyAuthStatus === 'not_connected' && spotifyClientId && spotifyClientSecret}
							<span class="integration-badge warn">
								<TablerIcon name="alert-circle" size={11} />
								{t('spotifyStatusNotConnected')}
							</span>
						{/if}
					</span>
					<span class={`integration-chevron ${spotifyExpanded ? 'open' : ''}`}>
						<TablerIcon name="chevron-down" size={16} />
					</span>
				</button>
				{#if spotifyExpanded}
					<form class="integration-fields" onsubmit={(event) => event.preventDefault()}>
						<label for="np-spotify-client-id">Client ID</label>
						<input
							id="np-spotify-client-id"
							type="text"
							value={spotifyClientId}
							oninput={(e) => onSetSpotifyClientId((e.currentTarget as HTMLInputElement).value)}
							autocomplete="off"
							spellcheck="false"
						/>
						{#if spotifyRedirectUri && isLocalNovapanelSpotifyRedirectUri(spotifyRedirectUri) && detectedRedirectUri && spotifyRedirectUri.trim() !== detectedRedirectUri}
							<div class="integration-help-text warning">
								{translate('Deze redirect gebruikt nog de oude /local_novapanel-route. Novapanel vervangt dit bij verbinden automatisch door de callback-URL hieronder, maar plak die nieuwe URL ook in het Spotify Dashboard.', selectedLanguage)}
							</div>
						{/if}
						<div class="integration-help-text">
							{translate('Maak een gratis app aan op', selectedLanguage)}
							<a class="integration-help-link" href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">developer.spotify.com/dashboard</a>.
							{translate('Klik op Create app, vul een naam en omschrijving in, voeg de callback-URL hieronder toe bij Redirect URI, vink Web API aan en accepteer de voorwaarden. Kopieer daarna de Client ID uit het app-overzicht hierheen.', selectedLanguage)}
						</div>

						<label for="np-spotify-client-secret">Client Secret</label>
						<input
							id="np-spotify-client-secret"
							type="password"
							value={spotifyClientSecret}
							oninput={(e) => onSetSpotifyClientSecret((e.currentTarget as HTMLInputElement).value)}
							autocomplete="off"
							spellcheck="false"
						/>
						<div class="integration-help-text">
							{translate('Open je app in het dashboard, klik op Settings en daarna op View client secret. Kopieer de Client Secret hierheen.', selectedLanguage)}
						</div>

						<label for="np-spotify-redirect">Redirect URI</label>
						<input
							id="np-spotify-redirect"
							type="text"
							value={spotifyRedirectUri}
							placeholder={exampleRedirectUri}
							oninput={(e) => onSetSpotifyRedirectUri((e.currentTarget as HTMLInputElement).value)}
							autocomplete="off"
							spellcheck="false"
						/>
						<div class="integration-help-text">
							{translate('Open je app op', selectedLanguage)} <a class="integration-help-link" href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener">developer.spotify.com/dashboard</a>,
							{translate('open Settings en plak exact deze callback-URL bij Redirect URIs:', selectedLanguage)}
							<code>{shownRedirectUri}</code>
							{translate('Spotify vereist een exacte match en meestal HTTPS. Gebruik precies de URL hierboven; bij Home Assistant ingress hoort daar meestal', selectedLanguage)}
							<code>/api/hassio_ingress/&lt;token&gt;</code>
							{translate('in te staan. Als Home Assistant later een andere ingress-token toont, kopieer dan de nieuwe callback-URL opnieuw naar Spotify.', selectedLanguage)}
							{translate('Klik daarna op Add en Save. Laat dit veld leeg om de automatisch herkende callback-URL te gebruiken.', selectedLanguage)}
						</div>
						<div class="integration-actions">
							<button type="button" class="np-btn" onclick={() => void copyDetectedRedirect()} disabled={!detectedRedirectUri}>
								<TablerIcon name={copiedRedirect ? 'check' : 'copy'} size={14} />
								{copiedRedirect ? translate('Gekopieerd', selectedLanguage) : translate('Kopieer mijn callback-URL', selectedLanguage)}
							</button>
						</div>

						<div class="integration-actions">
							{#if spotifyAuthStatus === 'connected'}
								<span class="integration-status ok">
									<TablerIcon name="circle-check" size={13} />
									<span>{t('spotifyStatusConnected')}</span>
								</span>
							{:else if spotifyAuthInProgress}
								<button
									type="button"
									class="np-btn primary spotify"
									disabled
								>
									<TablerIcon name="loader-2" size={14} />
									{translate('Bezig met verbinden…', selectedLanguage)}
								</button>
							{:else}
								<button
									type="button"
									class="np-btn primary spotify"
									disabled={!spotifyClientId || !spotifyClientSecret}
									onclick={startSpotifyAuth}
								>
									<TablerIcon name="brand-spotify" size={14} />
									{t('spotifyConnect')}
								</button>
							{/if}
							<button type="button" class="np-btn" onclick={() => void checkSpotifyAuth()}>
								<TablerIcon name="refresh" size={14} />
								{translate('Status controleren', selectedLanguage)}
							</button>
						</div>
						{#if spotifyAuthInProgress}
							<div class="integration-status info">
								<TablerIcon name="info-circle" size={13} />
								<span>{translate('Voltooi de Spotify-koppeling in het nieuw geopende tabblad. Dit venster pikt het automatisch op.', selectedLanguage)}</span>
							</div>
						{/if}
						{#if spotifyAuthError}
							<div class="integration-status off">
								<TablerIcon name="alert-circle" size={13} />
								<span>{spotifyAuthError}</span>
							</div>
						{/if}
					</form>
				{/if}
			</div>

			<!-- =============== BACKUP =============== -->
			<div class="settings-section panel-state-io">
				<div class="settings-section-head">
					<TablerIcon name="database-export" size={16} />
					<h4>{t('panelStateBackupSection')}</h4>
				</div>
				<div class="integration-help-text">{t('panelStateBackupIntro')}</div>
				<div class="integration-actions">
					<button type="button" class="np-btn" onclick={() => void onExportPanelState()}>
						<TablerIcon name="download" size={14} />
						{t('panelStateExport')}
					</button>
					<button type="button" class="np-btn" onclick={() => importFileInput?.click()}>
						<TablerIcon name="upload" size={14} />
						{t('panelStateImport')}
					</button>
					<input
						bind:this={importFileInput}
						type="file"
						accept=".json,application/json"
						class="np-import-file-input"
						aria-hidden="true"
						tabindex="-1"
						onchange={handleImportPanelFile}
					/>
				</div>
				{#if panelIoNote}
					<div class="integration-status ok">
						<TablerIcon name="circle-check" size={13} />
						<span>{panelIoNote}</span>
					</div>
				{/if}
			</div>
		</div>
	{:else if activeSettingsTab === 'layout'}
		<div class="np-detail-body settings-body">
			<div class="settings-section">
				<div class="settings-section-head">
					<TablerIcon name="columns-3" size={16} />
					<h4>{t('columns')}</h4>
				</div>
				<div class="column-controls" role="group" aria-label={t('chooseColumns')}>
					<button type="button" class:active={selectedColumns === 1} onclick={() => onSetColumns(1)}>
						<span class="col-pick-vis col-pick-1"><i></i></span>
						<span>{t('oneColumn')}</span>
					</button>
					<button type="button" class:active={selectedColumns === 2} onclick={() => onSetColumns(2)}>
						<span class="col-pick-vis col-pick-2"><i></i><i></i></span>
						<span>{t('twoColumns')}</span>
					</button>
					<button type="button" class:active={selectedColumns === 3} onclick={() => onSetColumns(3)}>
						<span class="col-pick-vis col-pick-3"><i></i><i></i><i></i></span>
						<span>{t('threeColumns')}</span>
					</button>
				</div>
			</div>

		</div>
	{:else}
		<div class="np-detail-body settings-body">
			<div class="settings-section">
				<div class="settings-section-head">
					<TablerIcon name="palette" size={16} />
					<h4>{t('theme')}</h4>
				</div>
				<div class="settings-empty">
					<TablerIcon name="paint" size={32} />
					<div class="settings-empty-text">{translate('Thema-opties komen binnenkort', selectedLanguage)}</div>
				</div>
			</div>
		</div>
	{/if}
	<div class="settings-actions">
		<button type="button" class={`save-btn ${savePulse ? 'saved' : ''}`} onclick={handleSave}>
			<TablerIcon name={savePulse ? 'check' : 'device-floppy'} size={15} />
			{t('save')}
		</button>
	</div>
</section>

<style>
	/* ============================================
	 * SETTINGS MODAL — premium styling
	 * ============================================ */

	/* Modal shell */
	.modal-overlay {
		position: fixed; inset: 0;
		background: rgba(0,0,0,0.55);
		backdrop-filter: blur(2px);
		border: 0; padding: 0; margin: 0;
		z-index: 40; cursor: default;
	}
	.settings-modal {
		position: fixed; top: 50%; left: 50%;
		background: linear-gradient(180deg, #1a2238 0%, #0f1424 100%);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 18px;
		padding: 0;
		z-index: 60;
		transform: translate(-50%, -50%);
		overflow: hidden;
	}
	.settings-modal::before {
		content: ''; position: absolute; top: 0; left: 50%;
		width: 60%; height: 1px;
		background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
		transform: translateX(-50%);
		pointer-events: none;
	}
	.app-popup {
		width: min(var(--popup-width, 850px), calc(100vw - 1.5rem));
		height: min(var(--popup-height, 1140px), calc(100vh - 1.5rem));
		max-height: calc(100vh - 1.5rem);
		display: grid;
		grid-template-rows: auto auto 1fr auto;
		overflow: hidden;
	}

	/* Premium head */
	.np-detail-head {
		padding: 18px 22px 14px;
		border-bottom: 0.5px solid rgba(255,255,255,0.06);
		display: flex; align-items: center; gap: 12px;
		position: relative; overflow: hidden;
	}
	.np-detail-head-glow {
		position: absolute; top: -100px; left: -40px;
		width: 220px; height: 220px;
		background: radial-gradient(circle, var(--np-tint, rgba(167,139,250,0.18)), transparent 70%);
		pointer-events: none; filter: blur(20px);
	}
	.np-detail-head-icon {
		width: 38px; height: 38px;
		border-radius: 10px;
		display: grid; place-items: center;
		background: var(--np-tint);
		border: 0.5px solid rgba(255,255,255,0.10);
		color: var(--np-color);
		flex-shrink: 0;
		position: relative; z-index: 1;
	}
	.np-detail-head-text { flex: 1; min-width: 0; position: relative; z-index: 1; }
	.np-detail-head-text h3 {
		margin: 0;
		font-size: 15px; font-weight: 500;
		letter-spacing: -0.01em;
		line-height: 1.2;
		color: #f5f5f5;
	}
	.np-detail-head-sub {
		font-size: 11.5px;
		color: rgba(255,255,255,0.5);
		margin-top: 3px;
	}

	/* Premium pill tabs */
	.np-detail-tabs {
		display: flex;
		gap: 4px;
		margin: 14px 22px 0;
		padding: 4px;
		background: rgba(255,255,255,0.03);
		border: 0.5px solid rgba(255,255,255,0.06);
		border-radius: 12px;
	}
	.np-detail-tabs button {
		flex: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: 32px;
		padding: 0 14px;
		border-radius: 9px;
		border: 0;
		background: transparent;
		color: rgba(255,255,255,0.6);
		cursor: pointer;
		font-size: 12.5px;
		font-weight: 500;
		transition: all 0.15s;
		font-family: inherit;
	}
	.np-detail-tabs button:hover {
		color: rgba(255,255,255,0.85);
		background: rgba(255,255,255,0.04);
	}
	.np-detail-tabs button.active {
		background: linear-gradient(135deg, rgba(167,139,250,0.18), rgba(167,139,250,0.05));
		color: #c4b5fd;
		box-shadow: 0 0 12px rgba(167,139,250,0.18);
	}

	/* Body */
	.np-detail-body {
		padding: 16px 22px;
		overflow-y: auto;
		overflow-x: hidden;
		min-height: 0;
		scrollbar-width: none;
		-ms-overflow-style: none;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		touch-action: pan-y;
	}
	.np-detail-body::-webkit-scrollbar { width: 0; height: 0; display: none; }
	.settings-body { display: flex; flex-direction: column; gap: 14px; }

	/* Section card (each settings group is a tile) */
	.settings-section {
		background: rgba(255,255,255,0.025);
		border: 0.5px solid rgba(255,255,255,0.07);
		border-radius: 14px;
		padding: 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 10px;
		transition: border-color 0.2s;
	}
	.settings-section:hover {
		border-color: rgba(255,255,255,0.12);
	}
	.settings-section-head {
		display: flex;
		align-items: center;
		gap: 8px;
		color: rgba(255,255,255,0.55);
	}
	.settings-section-head h4 {
		margin: 0;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.10em;
		color: rgba(255,255,255,0.65);
	}

	/* Empty state */
	.settings-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		padding: 28px 16px;
		color: rgba(255,255,255,0.40);
	}
	.settings-empty-text {
		font-size: 12.5px;
		font-weight: 500;
	}

	/* Integration toggle (Spotify) */
	.integration-toggle {
		height: 44px;
		border-radius: 11px;
		border: 0.5px solid rgba(255,255,255,0.08);
		background: rgba(255,255,255,0.03);
		color: #f5f5f5;
		padding: 0 14px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		cursor: pointer;
		font-size: 13px;
		font-weight: 500;
		transition: all 0.15s;
		font-family: inherit;
	}
	.integration-toggle:hover {
		background: rgba(255,255,255,0.05);
		border-color: rgba(255,255,255,0.13);
	}
	.integration-toggle.connected {
		background: linear-gradient(135deg, rgba(29,185,84,0.06), transparent 60%), rgba(255,255,255,0.025);
		border-color: rgba(29,185,84,0.22);
		box-shadow: 0 0 12px rgba(29,185,84,0.10);
	}
	.integration-toggle-label {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		flex: 1;
	}
	.integration-toggle-name {
		font-weight: 600;
		letter-spacing: -0.005em;
	}
	.integration-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px; height: 28px;
		border-radius: 8px;
		flex-shrink: 0;
	}
	.integration-icon.spotify {
		background: linear-gradient(135deg, #1ed760, #1db954);
		color: #fff;
		box-shadow: 0 2px 8px rgba(29,185,84,0.30);
	}
	.integration-badge {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 10.5px;
		padding: 3px 8px;
		border-radius: 999px;
		font-weight: 600;
		letter-spacing: 0.02em;
		border: 0.5px solid currentColor;
		text-transform: lowercase;
	}
	.integration-badge.ok {
		background: rgba(29,185,84,0.12);
		color: #4ade80;
		border-color: rgba(29,185,84,0.28);
	}
	.integration-badge.warn {
		background: rgba(243,202,98,0.12);
		color: #fbbf24;
		border-color: rgba(243,202,98,0.30);
	}
	.integration-chevron {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: rgba(255,255,255,0.55);
		transition: transform 200ms ease;
	}
	.integration-chevron.open { transform: rotate(180deg); }

	/* Integration form fields */
	.integration-fields {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px 14px 12px;
		border-radius: 11px;
		background: rgba(0,0,0,0.18);
		border: 0.5px solid rgba(255,255,255,0.05);
		margin-top: -4px;
	}
	.integration-fields label {
		font-size: 11px;
		font-weight: 600;
		color: rgba(255,255,255,0.65);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		margin-top: 4px;
	}
	.integration-fields label:first-of-type { margin-top: 0; }
	.integration-fields input {
		height: 36px;
		border-radius: 9px;
		border: 0.5px solid rgba(255,255,255,0.08);
		background: rgba(255,255,255,0.04);
		color: #f5f5f5;
		padding: 0 12px;
		font-size: 13px;
		font-family: inherit;
		transition: all 0.15s;
	}
	.integration-fields input:hover { background: rgba(255,255,255,0.06); }
	.integration-fields input:focus {
		outline: none;
		background: rgba(255,255,255,0.05);
		border-color: rgba(167,139,250,0.45);
		box-shadow: 0 0 0 3px rgba(167,139,250,0.15);
	}

	/* Help text */
	.integration-help-text {
		font-size: 11.5px;
		color: rgba(255,255,255,0.50);
		line-height: 1.45;
	}
	.integration-help-text.warning {
		color: #fbbf24;
		background: rgba(251,191,36,0.09);
		border: 0.5px solid rgba(251,191,36,0.18);
		border-radius: 6px;
		padding: 6px 8px;
	}
	.integration-help-text a.integration-help-link {
		color: #93c5fd;
		text-decoration: none;
		border-bottom: 0.5px solid rgba(147,197,253,0.40);
		transition: border-color 0.15s, color 0.15s;
	}
	.integration-help-text a.integration-help-link:hover {
		color: #bfdbfe;
		border-bottom-color: #bfdbfe;
	}
	.integration-help-text code {
		display: inline-block;
		max-width: 100%;
		overflow-wrap: anywhere;
		word-break: break-word;
		white-space: normal;
		background: rgba(0,0,0,0.45);
		border: 0.5px solid rgba(255,255,255,0.06);
		padding: 3px 6px;
		border-radius: 5px;
		font-size: 11px;
		color: rgba(255,255,255,0.75);
		margin-top: 4px;
		font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
	}

	/* Action row */
	.integration-actions {
		display: flex;
		gap: 6px;
		margin-top: 6px;
		flex-wrap: wrap;
		align-items: center;
	}

	/* Premium button base */
	.np-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 34px;
		padding: 0 12px;
		border-radius: 9px;
		border: 0.5px solid rgba(255,255,255,0.08);
		background: rgba(255,255,255,0.04);
		color: #f5f5f5;
		cursor: pointer;
		font-size: 12.5px;
		font-weight: 500;
		font-family: inherit;
		transition: all 0.15s;
	}
	.np-btn:hover:not(:disabled) {
		background: rgba(255,255,255,0.08);
		border-color: rgba(255,255,255,0.14);
		transform: translateY(-1px);
	}
	.np-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.np-btn.primary.spotify {
		background: linear-gradient(135deg, #1ed760, #1db954);
		border-color: rgba(255,255,255,0.18);
		color: #fff;
		box-shadow: 0 4px 14px rgba(29,185,84,0.30);
	}
	.np-btn.primary.spotify:hover:not(:disabled) {
		background: linear-gradient(135deg, #25e26d, #1ec85a);
		box-shadow: 0 6px 18px rgba(29,185,84,0.45);
	}

	/* Status pills */
	.integration-status {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 11.5px;
		border-radius: 9px;
		padding: 7px 11px;
		border: 0.5px solid currentColor;
		font-weight: 500;
		max-width: 100%;
	}
	.integration-status.ok {
		color: #4ade80;
		background: rgba(74,222,128,0.10);
		border-color: rgba(74,222,128,0.25);
	}
	.integration-status.off {
		color: #fbbf24;
		background: rgba(243,202,98,0.10);
		border-color: rgba(243,202,98,0.30);
	}
	.integration-status.info {
		color: #93c5fd;
		background: rgba(147,197,253,0.10);
		border-color: rgba(147,197,253,0.25);
	}
	.integration-status > span { color: inherit; }

	.np-import-file-input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		overflow: hidden;
	}

	/* ============================================
	 * LAYOUT TAB controls
	 * ============================================ */
	.column-controls {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}
	.column-controls button {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		min-height: 80px;
		padding: 12px 6px;
		background: rgba(255,255,255,0.025);
		border: 0.5px solid rgba(255,255,255,0.07);
		border-radius: 12px;
		color: rgba(255,255,255,0.7);
		cursor: pointer;
		font-size: 11.5px;
		font-weight: 500;
		font-family: inherit;
		transition: all 0.15s;
	}
	.column-controls button:hover {
		background: rgba(255,255,255,0.04);
		border-color: rgba(255,255,255,0.14);
		transform: translateY(-1px);
	}
	.column-controls button.active {
		background: linear-gradient(135deg, rgba(167,139,250,0.16), rgba(167,139,250,0.04));
		border-color: rgba(167,139,250,0.40);
		color: #c4b5fd;
		box-shadow: 0 0 14px rgba(167,139,250,0.18);
	}
	.col-pick-vis {
		display: flex;
		gap: 3px;
		align-items: stretch;
		width: 36px;
		height: 22px;
		justify-content: center;
	}
	.col-pick-vis i {
		display: block;
		flex: 1;
		background: currentColor;
		opacity: 0.45;
		border-radius: 2px;
		transition: opacity 0.15s;
	}
	.column-controls button.active .col-pick-vis i { opacity: 0.85; }

	/* Sticky footer with save button */
	.settings-actions {
		padding: 12px 22px 16px;
		border-top: 0.5px solid rgba(255,255,255,0.06);
		display: flex;
		justify-content: flex-end;
		background: linear-gradient(180deg, rgba(15,20,36,0) 0%, rgba(15,20,36,0.6) 100%);
		backdrop-filter: blur(8px);
	}
	.save-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 38px;
		padding: 0 18px;
		border-radius: 11px;
		border: 0.5px solid rgba(147,197,253,0.30);
		background: linear-gradient(135deg, #93c5fd 0%, #6691d1 100%);
		color: #0f1424;
		cursor: pointer;
		font-size: 13px;
		font-weight: 600;
		letter-spacing: -0.005em;
		font-family: inherit;
		box-shadow:
			0 6px 18px rgba(96,165,250,0.30),
			inset 0 1px 0 rgba(255,255,255,0.40);
		transition: all 0.15s;
	}
	.save-btn:hover {
		background: linear-gradient(135deg, #bfdbfe 0%, #7aa1de 100%);
		transform: translateY(-1px);
		box-shadow:
			0 8px 22px rgba(96,165,250,0.45),
			inset 0 1px 0 rgba(255,255,255,0.50);
	}
	.save-btn.saved {
		background: linear-gradient(135deg, #4ade80 0%, #22c55e 100%);
		border-color: rgba(74,222,128,0.40);
		box-shadow:
			0 6px 18px rgba(74,222,128,0.40),
			inset 0 1px 0 rgba(255,255,255,0.40);
		transition: background 200ms ease, box-shadow 200ms ease;
	}
	.save-btn :global(.mdi-mask) { --mask-color: #0f1424; }
</style>
