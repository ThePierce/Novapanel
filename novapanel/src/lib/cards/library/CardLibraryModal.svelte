<script lang="ts">
	import type { TranslationKey } from '$lib/i18n';
	import type { CardDefinition } from '$lib/cards/store';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';

	type CardLibraryTab = 'sidebar' | 'view';

	type Props = {
		t: (key: TranslationKey | string) => string;
		title: string;
		editMode: boolean;
		activeTab: CardLibraryTab;
		activeViewSectionId: string;
		sections: Array<{ id: string; title: string }>;
		cards: CardDefinition[];
		getLocalizedCardLabel: (type: string) => string;
		onClose: () => void;
		onTitleBlur: (value: string) => void;
		onSetTab: (tab: CardLibraryTab) => void;
		onAddSection: () => void;
		onSetActiveSection: (id: string) => void;
		onRenameSection: (id: string, title: string) => void;
		onAddCard: (cardCatalogId: string) => void;
	};

	let {
		t,
		title,
		editMode,
		activeTab,
		activeViewSectionId,
		sections,
		cards,
		getLocalizedCardLabel,
		onClose,
		onTitleBlur,
		onSetTab,
		onAddSection,
		onSetActiveSection,
		onRenameSection,
		onAddCard
	}: Props = $props();

	let renameSectionOpen = $state(false);
	let renameSectionDraft = $state('');

	const activeSection = $derived(sections.find((section) => section.id === activeViewSectionId));

	$effect(() => {
		if (!renameSectionOpen) renameSectionDraft = activeSection?.title ?? '';
	});

	function sectionOptionLabel(section: { title: string }, index: number): string {
		const title = section.title.trim();
		return title.length > 0 ? title : `${t('section')} ${index + 1}`;
	}

	function setActiveSection(id: string) {
		renameSectionOpen = false;
		onSetActiveSection(id);
	}

	function startSectionRename() {
		if (!activeSection) return;
		renameSectionDraft = activeSection.title ?? '';
		renameSectionOpen = true;
	}

	function saveSectionRename() {
		if (!activeSection) return;
		onRenameSection(activeSection.id, renameSectionDraft.trim());
		renameSectionOpen = false;
	}

	// Map card type to icon + accent for the tile decoration
	function cardTypeStyling(type: string): { icon: string; accent: string; accentSoft: string } {
		switch (type) {
			case 'clock': return { icon: 'clock-hour-3', accent: '#93c5fd', accentSoft: 'rgba(147,197,253,0.18)' };
			case 'date': return { icon: 'calendar', accent: '#f87171', accentSoft: 'rgba(248,113,113,0.18)' };
			case 'weather': return { icon: 'cloud', accent: '#22d3ee', accentSoft: 'rgba(34,211,238,0.18)' };
			case 'weather_forecast': return { icon: 'cloud-storm', accent: '#22d3ee', accentSoft: 'rgba(34,211,238,0.18)' };
			case 'alarm_panel': return { icon: 'shield-lock', accent: '#f87171', accentSoft: 'rgba(248,113,113,0.18)' };
			case 'lights_status': return { icon: 'bulb', accent: '#ffd338', accentSoft: 'rgba(255,211,56,0.18)' };
			case 'light_button': return { icon: 'bulb', accent: '#ffd338', accentSoft: 'rgba(255,211,56,0.18)' };
			case 'climate_button': return { icon: 'temperature', accent: '#fb923c', accentSoft: 'rgba(251,146,60,0.18)' };
			case 'cover_button': return { icon: 'curtains', accent: '#60a5fa', accentSoft: 'rgba(96,165,250,0.18)' };
			case 'vacuum_button': return { icon: 'robot', accent: '#34d399', accentSoft: 'rgba(52,211,153,0.18)' };
			case 'media_player_button': return { icon: 'device-speaker', accent: '#c084fc', accentSoft: 'rgba(192,132,252,0.18)' };
			case 'openings_status': return { icon: 'door', accent: '#60a5fa', accentSoft: 'rgba(96,165,250,0.18)' };
			case 'devices_status': return { icon: 'plug', accent: '#a78bfa', accentSoft: 'rgba(167,139,250,0.18)' };
			case 'availability_status': return { icon: 'wifi', accent: '#4ade80', accentSoft: 'rgba(74,222,128,0.18)' };
			case 'media_players_status': return { icon: 'device-speaker', accent: '#c084fc', accentSoft: 'rgba(192,132,252,0.18)' };
			case 'energy': return { icon: 'bolt', accent: '#facc15', accentSoft: 'rgba(250,204,21,0.18)' };
			case 'cameras_strip': return { icon: 'device-cctv', accent: '#60a5fa', accentSoft: 'rgba(96,165,250,0.18)' };
			case 'week_calendar': return { icon: 'calendar-week', accent: '#38bdf8', accentSoft: 'rgba(56,189,248,0.18)' };
			default: return { icon: 'square', accent: '#93c5fd', accentSoft: 'rgba(147,197,253,0.18)' };
		}
	}
</script>

<button type="button" class="modal-overlay card-library-overlay" onclick={onClose} aria-label={t('closeOverlay')}></button>
<section class="settings-modal app-popup card-library-modal np-detail" role="dialog" aria-modal="true" aria-label={t('cardLibrary')}>
	<div class="np-detail-head" style="--np-tint: rgba(96,165,250,0.18); --np-color: #93c5fd;">
		<div class="np-detail-head-glow" aria-hidden="true"></div>
		<div class="np-detail-head-icon"><TablerIcon name="layout-grid-add" size={22} /></div>
		<div class="np-detail-head-text">
			<div class="np-detail-head-title editable-title-row">
				<div
					class:editable-title={editMode}
					contenteditable={editMode}
					role={editMode ? 'textbox' : undefined}
					onblur={(event) => onTitleBlur((event.currentTarget as HTMLElement).innerText)}
				>
					{title}
				</div>
			</div>
			<div class="np-detail-head-sub">{t('Kies een kaart om toe te voegen')}</div>
		</div>
	</div>

	<div class="library-body">
		<div class="library-toolbar">
			<div class="np-detail-tabs" role="tablist" aria-label={t('cardLibrary')}>
				<button
					type="button"
					role="tab"
					class:active={activeTab === 'sidebar'}
					aria-selected={activeTab === 'sidebar'}
					onclick={() => onSetTab('sidebar')}
				>
					<TablerIcon name="layout-sidebar" size={14} />
					{t('targetSidebar')}
				</button>
				<button
					type="button"
					role="tab"
					class:active={activeTab === 'view'}
					aria-selected={activeTab === 'view'}
					onclick={() => onSetTab('view')}
				>
					<TablerIcon name="layout-dashboard" size={14} />
					{t('targetView')}
				</button>
			</div>

			{#if activeTab === 'view'}
				<div class="card-library-controls">
					<select
						class="library-select"
						value={activeViewSectionId}
						onchange={(event) => setActiveSection((event.currentTarget as HTMLSelectElement).value)}
					>
						{#each sections as section, index (section.id)}
							<option value={section.id}>{sectionOptionLabel(section, index)}</option>
						{/each}
					</select>
					<button
						type="button"
						class="library-icon-section"
						onclick={startSectionRename}
						disabled={!activeSection}
						title={t('Sectie hernoemen')}
						aria-label={t('Sectie hernoemen')}
					>
						<TablerIcon name="pencil" size={14} />
					</button>
					<button type="button" class="library-add-section" onclick={onAddSection}>
						<TablerIcon name="plus" size={14} />
						{t('addSection')}
					</button>
					{#if renameSectionOpen && activeSection}
						<div class="library-section-rename">
							<input
								type="text"
								class="library-section-rename-input"
								value={renameSectionDraft}
								placeholder={t('Sectie zonder titel')}
								aria-label={t('Sectienaam')}
								oninput={(event) => (renameSectionDraft = (event.currentTarget as HTMLInputElement).value)}
								onkeydown={(event) => {
									if (event.key === 'Enter') saveSectionRename();
									if (event.key === 'Escape') renameSectionOpen = false;
								}}
							/>
							<button type="button" class="library-section-rename-save" onclick={saveSectionRename} aria-label={t('save')}>
								<TablerIcon name="check" size={14} />
							</button>
							<button type="button" class="library-section-rename-cancel" onclick={() => (renameSectionOpen = false)} aria-label={t('cancel')}>
								<TablerIcon name="x" size={14} />
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<div class="library-grid">
			{#each cards.filter((entry) => entry.target === activeTab) as entry (entry.id)}
				{@const tone = cardTypeStyling(entry.type)}
				<button
					type="button"
					class="library-tile"
					style="--tile-accent: {tone.accent}; --tile-accent-soft: {tone.accentSoft};"
					onclick={() => onAddCard(entry.id)}
					onkeydown={(event) => {
						if (event.key !== 'Enter' && event.key !== ' ') return;
						event.preventDefault();
						onAddCard(entry.id);
					}}
				>
					<div class="library-tile-glow" aria-hidden="true"></div>

					<div class="library-tile-preview">
						{#if entry.preview.kind === 'clock'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<defs>
									<linearGradient id={`np-clock-bg-${entry.id}`} x1="0" y1="0" x2="1" y2="1">
										<stop offset="0" stop-color="#0f141d" />
										<stop offset="1" stop-color="#20293a" />
									</linearGradient>
								</defs>
								<rect x="10" y="12" width="300" height="146" rx="16" fill={`url(#np-clock-bg-${entry.id})`} stroke="#324058" />
								<circle cx="92" cy="85" r="46" fill="#1e2834" stroke="#94a2b1" stroke-width="3" />
								<circle cx="92" cy="85" r="38" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="2" />
								<line x1="92" y1="85" x2="92" y2="60" stroke="#d2deea" stroke-width="4.5" stroke-linecap="round" />
								<line x1="92" y1="85" x2="112" y2="92" stroke="#d2deea" stroke-width="3.2" stroke-linecap="round" />
								<circle cx="92" cy="85" r="4" fill="#c43f2c" />
								<rect x="156" y="62" width="132" height="46" rx="10" fill="#111622" stroke="rgba(255,255,255,0.10)" />
								<text x="222" y="93" text-anchor="middle" font-size="26" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial">
									12:34
								</text>
							</svg>
						{:else if entry.preview.kind === 'date'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<text x="160" y="76" text-anchor="middle" font-size="18" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial">
									Sunday
								</text>
								<text x="160" y="106" text-anchor="middle" font-size="14" fill="rgba(245,245,245,0.65)" font-family="Inter, system-ui, Arial">
									12 May
								</text>
							</svg>
						{:else if entry.preview.kind === 'divider'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<defs>
									<linearGradient id={`np-divider-line-${entry.id}`} x1="0" y1="0" x2="1" y2="0">
										<stop offset="0" stop-color="rgba(96,165,250,0)" />
										<stop offset="0.5" stop-color="rgba(96,165,250,0.9)" />
										<stop offset="1" stop-color="rgba(96,165,250,0)" />
									</linearGradient>
								</defs>
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<rect x="44" y="50" width="88" height="10" rx="5" fill="rgba(255,255,255,0.12)" />
								<rect x="44" y="72" width="156" height="8" rx="4" fill="rgba(255,255,255,0.08)" />
								<rect x="44" y="105" width="232" height="3" rx="1.5" fill={`url(#np-divider-line-${entry.id})`} />
								<rect x="44" y="126" width="126" height="8" rx="4" fill="rgba(255,255,255,0.08)" />
								<rect x="44" y="142" width="180" height="8" rx="4" fill="rgba(255,255,255,0.06)" />
							</svg>
						{:else if entry.preview.kind === 'weather'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<text x="44" y="74" font-size="34" font-weight="700" fill="#f5f5f5" font-family="Inter, system-ui, Arial">21°</text>
								<text x="44" y="106" font-size="16" font-weight="600" fill="rgba(245,245,245,0.9)" font-family="Inter, system-ui, Arial">{t('weather_partlycloudy')}</text>
								<circle cx="250" cy="72" r="22" fill="#ffd35a" opacity="0.9" />
								<circle cx="235" cy="88" r="22" fill="#2e384d" opacity="0.7" />
								<circle cx="260" cy="92" r="26" fill="#2e384d" opacity="0.8" />
							</svg>
						{:else if entry.preview.kind === 'weather_forecast'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								{#each [0, 1, 2, 3, 4] as i}
									<text x={44 + i * 52} y="64" text-anchor="middle" font-size="14" font-weight="600" fill="rgba(245,245,245,0.9)" font-family="Inter, system-ui, Arial">{t('weekdayShortMon')}</text>
									<text x={44 + i * 52} y="106" text-anchor="middle" font-size="16" font-weight="700" fill="#f5f5f5" font-family="Inter, system-ui, Arial">18°</text>
								{/each}
							</svg>
						{:else if entry.preview.kind === 'week_calendar'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#1b2230" stroke="#324058" />

								<circle cx="68" cy="70" r="27" fill="rgba(56,189,248,0.18)" />
								<rect x="54" y="55" width="28" height="28" rx="5" fill="none" stroke="#38bdf8" stroke-width="4" />
								<line x1="54" y1="64" x2="82" y2="64" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
								<circle cx="61" cy="72" r="2.6" fill="#38bdf8" />
								<circle cx="69" cy="72" r="2.6" fill="#38bdf8" />
								<circle cx="77" cy="72" r="2.6" fill="#38bdf8" />

								<rect x="122" y="46" width="134" height="14" rx="7" fill="rgba(56,189,248,0.18)" />
								<rect x="122" y="70" width="88" height="10" rx="5" fill="#a7f3d0" opacity="0.82" />
								<rect x="122" y="88" width="116" height="10" rx="5" fill="#fde68a" opacity="0.82" />
								<rect x="122" y="106" width="74" height="10" rx="5" fill="#93c5fd" opacity="0.82" />

								<text x="46" y="123" font-size="17" font-weight="700" fill="#f5f5f5" font-family="Inter, system-ui, Arial">{t('Weekkalender')}</text>
								<text x="46" y="142" font-size="11" fill="rgba(245,245,245,0.56)" font-family="Inter, system-ui, Arial">3 {t('events')}</text>
							</svg>
						{:else if entry.preview.kind === 'alarm_panel'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<circle cx="80" cy="85" r="28" fill="rgba(225,82,65,0.12)" stroke="rgba(225,82,65,0.35)" stroke-width="1.5" />
								<path d="M80 68 C80 68 95 73 95 82 C95 93 87 100 80 103 C73 100 65 93 65 82 C65 73 80 68 80 68Z" fill="none" stroke="#e15241" stroke-width="2.2" stroke-linejoin="round" />
								<line x1="80" y1="77" x2="80" y2="89" stroke="#e15241" stroke-width="2.2" stroke-linecap="round" />
								<circle cx="80" cy="93" r="1.8" fill="#e15241" />
								<text x="124" y="75" font-size="13" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial" opacity="0.9">{t('Alarmpaneel')}</text>
								<text x="124" y="96" font-size="11" font-weight="600" fill="#e15241" font-family="Inter, system-ui, Arial">{t('Ingeschakeld')}</text>
							</svg>
						{:else if entry.preview.kind === 'lights_status'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<circle cx="80" cy="85" r="30" fill="rgba(255,211,56,0.08)" />
								<ellipse cx="80" cy="80" rx="12" ry="15" fill="#ffd338" opacity="0.9" />
								<rect x="74" y="94" width="12" height="5" rx="2.5" fill="#ffd338" opacity="0.6" />
								<circle cx="104" cy="62" r="10" fill="#ffd338" />
								<text x="104" y="66" text-anchor="middle" font-size="11" font-weight="700" fill="#1b2433" font-family="Inter, system-ui, Arial">3</text>
								<text x="124" y="78" font-size="13" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial" opacity="0.9">{t('Lampen')}</text>
								<text x="124" y="96" font-size="11" fill="rgba(245,245,245,0.5)" font-family="Inter, system-ui, Arial">3 {t('aan')}</text>
							</svg>
						{:else if entry.preview.kind === 'light_button'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#1b2230" stroke="#324058" />
								<circle cx="68" cy="70" r="27" fill="rgba(255,211,56,0.18)" />
								<path d="M68 48C59 48 53 55 53 63C53 69 56.5 73.5 61 76.2V83H75V76.2C79.5 73.5 83 69 83 63C83 55 77 48 68 48Z" fill="#ffd338" opacity="0.95" />
								<path d="M62 90H74M64 96H72" stroke="#ffd338" stroke-width="4" stroke-linecap="round" />
								<rect x="122" y="54" width="136" height="10" rx="5" fill="rgba(255,255,255,0.13)" />
								<rect x="122" y="54" width="92" height="10" rx="5" fill="#ffd338" opacity="0.92" />
								<text x="46" y="123" font-size="17" font-weight="700" fill="#f5f5f5" font-family="Inter, system-ui, Arial">{t('Leeslamp')}</text>
								<text x="46" y="142" font-size="11" fill="rgba(245,245,245,0.56)" font-family="Inter, system-ui, Arial">68%</text>
							</svg>
						{:else if entry.preview.kind === 'climate_button'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#1b2230" stroke="#324058" />
								<circle cx="68" cy="70" r="27" fill="rgba(251,146,60,0.18)" />
								<path d="M68 48v43M58 82a10 10 0 1 0 20 0M68 48a7 7 0 0 0-7 7v24h14V55a7 7 0 0 0-7-7Z" fill="none" stroke="#fb923c" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" />
								<rect x="122" y="54" width="86" height="10" rx="5" fill="#fb923c" opacity="0.9" />
								<text x="46" y="123" font-size="17" font-weight="700" fill="#f5f5f5" font-family="Inter, system-ui, Arial">{t('Thermostaat')}</text>
								<text x="46" y="142" font-size="11" fill="rgba(245,245,245,0.56)" font-family="Inter, system-ui, Arial">21° · {t('doel')} 22°</text>
							</svg>
						{:else if entry.preview.kind === 'cover_button'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#1b2230" stroke="#324058" />
								<circle cx="68" cy="70" r="27" fill="rgba(96,165,250,0.18)" />
								<path d="M52 49h32M55 55v36M81 55v36M55 55c7 4 13 4 26 0M55 70c7 4 13 4 26 0" fill="none" stroke="#60a5fa" stroke-width="4" stroke-linecap="round" />
								<rect x="122" y="54" width="118" height="10" rx="5" fill="rgba(255,255,255,0.13)" />
								<rect x="122" y="54" width="78" height="10" rx="5" fill="#60a5fa" opacity="0.9" />
								<text x="46" y="123" font-size="17" font-weight="700" fill="#f5f5f5" font-family="Inter, system-ui, Arial">{t('Gordijnen')}</text>
								<text x="46" y="142" font-size="11" fill="rgba(245,245,245,0.56)" font-family="Inter, system-ui, Arial">66% {t('open')}</text>
							</svg>
						{:else if entry.preview.kind === 'vacuum_button'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#1b2230" stroke="#324058" />
								<circle cx="68" cy="70" r="27" fill="rgba(52,211,153,0.18)" />
								<circle cx="68" cy="70" r="18" fill="none" stroke="#34d399" stroke-width="5" />
								<circle cx="68" cy="70" r="5" fill="#34d399" />
								<path d="M84 55l8-8M83 85l8 8" stroke="#34d399" stroke-width="4" stroke-linecap="round" />
								<text x="46" y="123" font-size="17" font-weight="700" fill="#f5f5f5" font-family="Inter, system-ui, Arial">{t('Stofzuiger')}</text>
								<text x="46" y="142" font-size="11" fill="rgba(245,245,245,0.56)" font-family="Inter, system-ui, Arial">{t('Schoonmaken')} · 82%</text>
							</svg>
						{:else if entry.preview.kind === 'media_player_button'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#1b2230" stroke="#324058" />
								<circle cx="68" cy="70" r="27" fill="rgba(192,132,252,0.18)" />
								<path d="M57 60h10l15-10v40L67 80H57Z" fill="#c084fc" opacity="0.95" />
								<path d="M90 60c6 7 6 13 0 20" fill="none" stroke="#c084fc" stroke-width="4" stroke-linecap="round" />
								<rect x="122" y="54" width="128" height="10" rx="5" fill="rgba(255,255,255,0.13)" />
								<rect x="122" y="54" width="64" height="10" rx="5" fill="#c084fc" opacity="0.9" />
								<text x="46" y="123" font-size="17" font-weight="700" fill="#f5f5f5" font-family="Inter, system-ui, Arial">{t('Woonkamer')}</text>
								<text x="46" y="142" font-size="11" fill="rgba(245,245,245,0.56)" font-family="Inter, system-ui, Arial">{t('Speelt muziek')}</text>
							</svg>
						{:else if entry.preview.kind === 'openings_status'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<circle cx="80" cy="85" r="28" fill="rgba(96,165,250,0.1)" stroke="rgba(96,165,250,0.3)" stroke-width="1.5" />
								<rect x="66" y="67" width="28" height="36" rx="3" fill="none" stroke="#60a5fa" stroke-width="2" />
								<path d="M66 77 L94 67" stroke="#60a5fa" stroke-width="2" />
								<circle cx="90" cy="85" r="2.5" fill="#60a5fa" />
								<text x="140" y="75" font-size="13" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial" opacity="0.9">{t('Ramen/Deuren')}</text>
								<text x="140" y="96" font-size="20" font-weight="700" fill="#60a5fa" font-family="Inter, system-ui, Arial">2</text>
								<text x="158" y="96" font-size="11" fill="rgba(245,245,245,0.45)" font-family="Inter, system-ui, Arial"> {t('open')}</text>
							</svg>
						{:else if entry.preview.kind === 'devices_status'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<circle cx="80" cy="85" r="28" fill="rgba(167,139,250,0.1)" stroke="rgba(167,139,250,0.3)" stroke-width="1.5" />
								<rect x="68" y="72" width="24" height="16" rx="3" fill="none" stroke="#a78bfa" stroke-width="2" />
								<rect x="76" y="88" width="8" height="10" rx="1.5" fill="#a78bfa" opacity="0.7" />
								<line x1="72" y1="98" x2="88" y2="98" stroke="#a78bfa" stroke-width="2" stroke-linecap="round" />
								<text x="140" y="75" font-size="13" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial" opacity="0.9">{t('Apparatenstatus')}</text>
								<text x="140" y="96" font-size="20" font-weight="700" fill="#a78bfa" font-family="Inter, system-ui, Arial">5</text>
								<text x="158" y="96" font-size="11" fill="rgba(245,245,245,0.45)" font-family="Inter, system-ui, Arial"> {t('actief')}</text>
							</svg>
						{:else if entry.preview.kind === 'availability_status'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<circle cx="80" cy="85" r="28" fill="rgba(74,222,128,0.1)" stroke="rgba(74,222,128,0.3)" stroke-width="1.5" />
								<path d="M67 85 L76 94 L95 74" stroke="#4ade80" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round" />
								<text x="140" y="75" font-size="13" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial" opacity="0.9">{t('Bereikbaarheid')}</text>
								<text x="140" y="96" font-size="11" font-weight="600" fill="#4ade80" font-family="Inter, system-ui, Arial">{t('Alles bereikbaar')}</text>
							</svg>
						{:else if entry.preview.kind === 'media_players_status'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<circle cx="80" cy="85" r="28" fill="rgba(79,113,168,0.15)" stroke="rgba(79,113,168,0.4)" stroke-width="1.5" />
								<polygon points="72,74 72,96 95,85" fill="#7ea4e6" />
								<text x="140" y="75" font-size="13" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial" opacity="0.9">{t('Media Spelers')}</text>
								<text x="140" y="96" font-size="11" fill="rgba(245,245,245,0.55)" font-family="Inter, system-ui, Arial">Music Assistant</text>
							</svg>
						{:else if entry.preview.kind === 'energy'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<circle cx="56" cy="58" r="16" fill="rgba(250,204,21,0.1)" stroke="rgba(250,204,21,0.3)" stroke-width="1.2" />
								<text x="56" y="63" text-anchor="middle" font-size="14" fill="#facc15">☀</text>
								<text x="80" y="54" font-size="11" font-weight="600" fill="rgba(245,245,245,0.7)" font-family="Inter, system-ui, Arial">{t('Zonnepanelen')}</text>
								<text x="80" y="67" font-size="12" font-weight="700" fill="#facc15" font-family="Inter, system-ui, Arial">2.4 kW</text>
								<circle cx="56" cy="103" r="16" fill="rgba(74,222,128,0.1)" stroke="rgba(74,222,128,0.3)" stroke-width="1.2" />
								<text x="56" y="108" text-anchor="middle" font-size="13" fill="#4ade80">⚡</text>
								<text x="80" y="99" font-size="11" font-weight="600" fill="rgba(245,245,245,0.7)" font-family="Inter, system-ui, Arial">{t('Thuisaccu')}</text>
								<text x="80" y="112" font-size="12" font-weight="700" fill="#4ade80" font-family="Inter, system-ui, Arial">82%</text>
							</svg>
						{:else if entry.preview.kind === 'cameras_strip'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#1b2230" stroke="#324058" />

								<circle cx="68" cy="70" r="27" fill="rgba(96,165,250,0.18)" />
								<rect x="52" y="58" width="32" height="24" rx="7" fill="none" stroke="#60a5fa" stroke-width="4" />
								<circle cx="68" cy="70" r="7" fill="none" stroke="#60a5fa" stroke-width="4" />
								<path d="M84 63l9-5v24l-9-5Z" fill="#60a5fa" opacity="0.86" />

								<rect x="122" y="46" width="72" height="46" rx="8" fill="rgba(96,165,250,0.22)" />
								<circle cx="140" cy="64" r="6" fill="none" stroke="#bfdbfe" stroke-width="2" opacity="0.8" />
								<rect x="204" y="46" width="48" height="21" rx="6" fill="rgba(147,197,253,0.2)" />
								<rect x="204" y="72" width="48" height="21" rx="6" fill="rgba(125,211,252,0.2)" />
								<rect x="122" y="102" width="130" height="9" rx="4.5" fill="rgba(255,255,255,0.12)" />

								<text x="46" y="123" font-size="17" font-weight="700" fill="#f5f5f5" font-family="Inter, system-ui, Arial">{t("Camera's")}</text>
								<text x="46" y="142" font-size="11" fill="rgba(245,245,245,0.56)" font-family="Inter, system-ui, Arial">3 live</text>
							</svg>
						{/if}
					</div>

					<div class="library-tile-meta">
						<div class="library-tile-icon">
							<TablerIcon name={tone.icon} size={16} />
						</div>
						<span class="library-tile-title">{getLocalizedCardLabel(entry.type)}</span>
						<div class="library-tile-add">
							<TablerIcon name="plus" size={14} />
						</div>
					</div>
				</button>
			{/each}
		</div>
	</div>
</section>

<style>
	/* Modal shell — match other detail-modals */
	.modal-overlay {
		position: fixed; inset: 0;
		background: rgba(0,0,0,0.55);
		backdrop-filter: blur(2px);
		border: 0; padding: 0; margin: 0;
		z-index: 40; cursor: default;
	}
	.card-library-overlay { z-index: 30; }
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
		grid-template-rows: auto 1fr;
		overflow: hidden;
	}
	.card-library-modal { z-index: 50; }

	/* Premium detail-modal header */
	.np-detail-head {
		padding: 18px 22px 14px;
		border-bottom: 0.5px solid rgba(255,255,255,0.06);
		display: flex; align-items: center; gap: 12px;
		position: relative; overflow: hidden; flex-shrink: 0;
	}
	.np-detail-head-glow {
		position: absolute; top: -100px; left: -40px;
		width: 220px; height: 220px;
		background: radial-gradient(circle, var(--np-tint, rgba(96,165,250,0.18)), transparent 70%);
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
	.np-detail-head-title {
		margin: 0;
		font-size: 15px; font-weight: 500;
		letter-spacing: -0.01em;
		line-height: 1.2;
		color: #f5f5f5;
		white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
	}
	.editable-title-row { display: flex; align-items: center; gap: 0.6rem; width: 100%; }
	.editable-title { outline: none; }
	.np-detail-head-sub {
		font-size: 11.5px;
		color: rgba(255,255,255,0.5);
		margin-top: 3px;
	}

	/* Body */
	.library-body {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 14px 22px 22px;
		overflow: hidden;
		min-height: 0;
		touch-action: pan-y;
	}

	.library-toolbar {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		flex-shrink: 0;
	}

	/* Premium tab pill */
	.np-detail-tabs {
		display: flex;
		gap: 4px;
		padding: 4px;
		background: rgba(255,255,255,0.03);
		border: 0.5px solid rgba(255,255,255,0.06);
		border-radius: 12px;
	}
	.np-detail-tabs button {
		display: inline-flex;
		align-items: center;
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
	.np-detail-tabs button:hover { color: rgba(255,255,255,0.85); background: rgba(255,255,255,0.04); }
	.np-detail-tabs button.active {
		background: linear-gradient(135deg, rgba(96,165,250,0.15), rgba(96,165,250,0.05));
		color: #93c5fd;
		box-shadow: 0 0 12px rgba(96,165,250,0.15);
	}

	/* View-section selector + add */
	.card-library-controls {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-left: auto;
		flex-wrap: wrap;
		justify-content: flex-end;
	}
	.library-select {
		height: 32px;
		padding: 0 10px;
		background: rgba(255,255,255,0.04);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 9px;
		color: #f5f5f5;
		cursor: pointer;
		font-size: 12.5px;
		font-family: inherit;
		font-weight: 500;
		transition: all 0.15s;
	}
	.library-select:hover {
		background: rgba(255,255,255,0.07);
		border-color: rgba(255,255,255,0.13);
	}
	.library-select:focus {
		outline: none;
		border-color: rgba(96,165,250,0.40);
		box-shadow: 0 0 0 3px rgba(96,165,250,0.15);
	}
	.library-icon-section {
		width: 32px;
		height: 32px;
		display: inline-grid;
		place-items: center;
		background: rgba(255,255,255,0.04);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 9px;
		color: rgba(255,255,255,0.72);
		cursor: pointer;
		transition: all 0.15s;
	}
	.library-icon-section:hover:not(:disabled) {
		background: rgba(255,255,255,0.08);
		border-color: rgba(255,255,255,0.16);
		color: #f5f5f5;
		transform: translateY(-1px);
	}
	.library-icon-section:disabled {
		opacity: 0.38;
		cursor: not-allowed;
	}
	.library-add-section {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 32px;
		padding: 0 12px;
		background: linear-gradient(135deg, rgba(96,165,250,0.20), rgba(96,165,250,0.10));
		border: 0.5px solid rgba(96,165,250,0.30);
		border-radius: 9px;
		color: #93c5fd;
		cursor: pointer;
		font-size: 12.5px;
		font-weight: 500;
		transition: all 0.15s;
		font-family: inherit;
	}
	.library-add-section:hover {
		background: linear-gradient(135deg, rgba(96,165,250,0.30), rgba(96,165,250,0.15));
		border-color: rgba(96,165,250,0.50);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(96,165,250,0.18);
	}
	.library-section-rename {
		flex: 1 1 100%;
		display: grid;
		grid-template-columns: minmax(12rem, 1fr) 32px 32px;
		gap: 6px;
		justify-content: end;
	}
	.library-section-rename-input {
		height: 32px;
		min-width: 0;
		padding: 0 10px;
		background: rgba(255,255,255,0.06);
		border: 0.5px solid rgba(255,255,255,0.10);
		border-radius: 9px;
		color: #f5f5f5;
		font-size: 12.5px;
		font-family: inherit;
		font-weight: 500;
	}
	.library-section-rename-input:focus {
		outline: none;
		border-color: rgba(96,165,250,0.40);
		box-shadow: 0 0 0 3px rgba(96,165,250,0.15);
	}
	.library-section-rename-save,
	.library-section-rename-cancel {
		width: 32px;
		height: 32px;
		display: inline-grid;
		place-items: center;
		border-radius: 9px;
		cursor: pointer;
		transition: all 0.15s;
	}
	.library-section-rename-save {
		background: linear-gradient(135deg, rgba(74,222,128,0.22), rgba(74,222,128,0.10));
		border: 0.5px solid rgba(74,222,128,0.32);
		color: #86efac;
	}
	.library-section-rename-cancel {
		background: rgba(255,255,255,0.04);
		border: 0.5px solid rgba(255,255,255,0.08);
		color: rgba(255,255,255,0.64);
	}
	.library-section-rename-save:hover,
	.library-section-rename-cancel:hover {
		transform: translateY(-1px);
	}

	/* Cards grid */
	.library-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(220px, 100%), 1fr));
		gap: 12px;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 4px 4px 8px;
		scrollbar-width: none;
		-ms-overflow-style: none;
		flex: 1;
		min-height: 0;
		align-content: start;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		touch-action: pan-y;
	}
	.library-grid::-webkit-scrollbar { width: 0; height: 0; display: none; }

	/* Library tile — premium card with preview */
	.library-tile {
		position: relative;
		display: flex;
		flex-direction: column;
		width: 100%;
		font: inherit;
		text-align: left;
		color: inherit;
		background: rgba(255,255,255,0.025);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 14px;
		overflow: hidden;
		cursor: pointer;
		transition: all 0.2s ease;
		isolation: isolate;
		min-width: 0;
		touch-action: manipulation;
	}
	.library-tile:hover {
		border-color: var(--tile-accent, rgba(255,255,255,0.20));
		transform: translateY(-3px) scale(1.01);
		box-shadow:
			0 12px 28px rgba(0,0,0,0.40),
			0 0 24px var(--tile-accent-soft, rgba(255,255,255,0.10));
	}
	.library-tile:focus-visible {
		outline: none;
		border-color: var(--tile-accent);
		box-shadow:
			0 0 0 3px var(--tile-accent-soft),
			0 8px 20px rgba(0,0,0,0.35);
	}

	/* Animated glow accent in corner */
	.library-tile-glow {
		position: absolute;
		top: -30%; right: -30%;
		width: 80%; height: 80%;
		background: radial-gradient(circle, var(--tile-accent-soft, rgba(255,255,255,0.10)), transparent 70%);
		filter: blur(30px);
		pointer-events: none;
		z-index: 0;
		opacity: 0.6;
		transition: opacity 0.3s ease;
	}
	.library-tile:hover .library-tile-glow { opacity: 1; }

	/* Preview area */
	.library-tile-preview {
		position: relative;
		z-index: 1;
		width: 100%;
		aspect-ratio: 320 / 120;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: rgba(0,0,0,0.20);
		border-bottom: 0.5px solid rgba(255,255,255,0.06);
	}
	.preview-svg {
		width: 100%; height: 100%;
		display: block;
		transition: transform 0.4s ease;
	}
	.library-tile:hover .preview-svg { transform: scale(1.04); }

	/* Meta row at bottom */
	.library-tile-meta {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 8px 11px;
	}
	.library-tile-icon {
		width: 24px; height: 24px;
		border-radius: 7px;
		display: grid;
		place-items: center;
		background: var(--tile-accent-soft, rgba(255,255,255,0.05));
		border: 0.5px solid rgba(255,255,255,0.08);
		color: var(--tile-accent, #93c5fd);
		flex-shrink: 0;
		transition: transform 0.2s;
	}
	.library-tile:hover .library-tile-icon { transform: scale(1.08); }
	.library-tile-title {
		flex: 1;
		margin: 0;
		font-size: 13.5px;
		font-weight: 600;
		color: #fff;
		letter-spacing: -0.005em;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.library-tile-add {
		width: 24px; height: 24px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: rgba(255,255,255,0.04);
		border: 0.5px solid rgba(255,255,255,0.08);
		color: rgba(255,255,255,0.55);
		flex-shrink: 0;
		opacity: 0;
		transition: all 0.2s;
	}
	.library-tile:hover .library-tile-add {
		opacity: 1;
		background: var(--tile-accent-soft);
		border-color: var(--tile-accent);
		color: var(--tile-accent);
	}

	@media (max-width: 720px), (max-height: 620px) {
		.app-popup {
			width: min(var(--popup-width, 850px), calc(100vw - 0.75rem));
			height: min(var(--popup-height, 1140px), calc(100dvh - 0.75rem));
			max-height: calc(100dvh - 0.75rem);
		}
		.library-body {
			padding: 10px 12px 14px;
			gap: 10px;
		}
		.library-toolbar,
		.card-library-controls {
			display: grid;
			grid-template-columns: 1fr;
			align-items: stretch;
			width: 100%;
			margin-left: 0;
		}
		.library-select,
		.library-icon-section,
		.library-add-section {
			width: 100%;
			min-width: 0;
		}
		.library-section-rename {
			grid-template-columns: minmax(0, 1fr) 32px 32px;
		}
		.library-grid {
			grid-template-columns: repeat(auto-fill, minmax(min(164px, 100%), 1fr));
			gap: 8px;
			padding: 2px 2px max(12px, env(safe-area-inset-bottom, 0px));
		}
		.library-tile-preview {
			aspect-ratio: 16 / 7.5;
		}
		.library-tile-meta {
			padding: 7px 9px;
			gap: 7px;
		}
		.library-tile-title {
			font-size: 12.5px;
		}
	}

	@media (max-width: 430px) {
		.library-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
