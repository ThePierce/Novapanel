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
			case 'device_button': return { icon: 'plug', accent: '#34d399', accentSoft: 'rgba(52,211,153,0.18)' };
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
										<stop offset="0" stop-color="rgba(245,245,245,0)" />
										<stop offset="0.18" stop-color="rgba(245,245,245,0.55)" />
										<stop offset="0.5" stop-color="rgba(245,245,245,0.78)" />
										<stop offset="0.82" stop-color="rgba(245,245,245,0.55)" />
										<stop offset="1" stop-color="rgba(245,245,245,0)" />
									</linearGradient>
								</defs>
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<rect x="40" y="38" width="44" height="44" rx="10" fill="rgba(255,255,255,0.06)" />
								<rect x="96" y="44" width="120" height="9" rx="3" fill="rgba(255,255,255,0.13)" />
								<rect x="96" y="62" width="80" height="7" rx="2.5" fill="rgba(255,255,255,0.07)" />
								<rect x="36" y="92" width="248" height="2" rx="1" fill={`url(#np-divider-line-${entry.id})`} />
								<rect x="40" y="108" width="44" height="44" rx="10" fill="rgba(255,255,255,0.06)" />
								<rect x="96" y="114" width="100" height="9" rx="3" fill="rgba(255,255,255,0.13)" />
								<rect x="96" y="132" width="64" height="7" rx="2.5" fill="rgba(255,255,255,0.07)" />
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
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<defs>
									<linearGradient id={`np-cal-page-${entry.id}`} x1="0" y1="0" x2="0" y2="1">
										<stop offset="0" stop-color="#1e293b" />
										<stop offset="1" stop-color="#0f172a" />
									</linearGradient>
								</defs>
								<rect x="58" y="64" width="44" height="44" rx="6" fill={`url(#np-cal-page-${entry.id})`} stroke="#4ade80" stroke-width="1.6" />
								<rect x="58" y="64" width="44" height="11" rx="6" fill="#4ade80" opacity="0.85" />
								<rect x="58" y="69" width="44" height="6" fill="#4ade80" opacity="0.85" />
								<rect x="66" y="60" width="2.5" height="9" rx="1.2" fill="rgba(255,255,255,0.55)" />
								<rect x="91.5" y="60" width="2.5" height="9" rx="1.2" fill="rgba(255,255,255,0.55)" />
								<text x="80" y="100" text-anchor="middle" font-size="20" font-weight="700" fill="#f5f5f5" font-family="Inter, system-ui, Arial">12</text>
								<text x="124" y="78" font-size="13" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial" opacity="0.9">{t('Weekkalender')}</text>
								<text x="124" y="96" font-size="11" fill="rgba(245,245,245,0.5)" font-family="Inter, system-ui, Arial">3 {t('events')}</text>
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
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<circle cx="80" cy="85" r="30" fill="rgba(255,211,56,0.08)" />
								<ellipse cx="80" cy="80" rx="12" ry="15" fill="#ffd338" opacity="0.9" />
								<rect x="74" y="94" width="12" height="5" rx="2.5" fill="#ffd338" opacity="0.6" />
								<path d="M58 64 L52 58 M102 64 L108 58 M58 96 L52 102 M102 96 L108 102 M80 50 L80 44 M80 110 L80 116" stroke="#ffd338" stroke-width="1.6" stroke-linecap="round" opacity="0.55" />
								<text x="124" y="78" font-size="13" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial" opacity="0.9">{t('Lamp')}</text>
								<text x="124" y="96" font-size="11" fill="rgba(245,245,245,0.5)" font-family="Inter, system-ui, Arial">{t('Aan')} · 68%</text>
							</svg>
						{:else if entry.preview.kind === 'device_button'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<defs>
									<linearGradient id={`np-device-plug-${entry.id}`} x1="0" y1="0" x2="1" y2="1">
										<stop offset="0" stop-color="#34d399" />
										<stop offset="1" stop-color="#059669" />
									</linearGradient>
								</defs>
								<circle cx="80" cy="85" r="30" fill="rgba(52,211,153,0.09)" stroke="rgba(52,211,153,0.18)" stroke-width="1" />
								<rect x="68" y="70" width="24" height="22" rx="7" fill={`url(#np-device-plug-${entry.id})`} opacity="0.94" />
								<line x1="74" y1="63" x2="74" y2="72" stroke="#34d399" stroke-width="3" stroke-linecap="round" />
								<line x1="86" y1="63" x2="86" y2="72" stroke="#34d399" stroke-width="3" stroke-linecap="round" />
								<path d="M80 92 V108 Q80 116 70 116 H62" fill="none" stroke="#34d399" stroke-width="3" stroke-linecap="round" />
								<circle cx="102" cy="64" r="10" fill="#34d399" />
								<text x="102" y="68" text-anchor="middle" font-size="11" font-weight="700" fill="#06261c" font-family="Inter, system-ui, Arial">1</text>
								<text x="124" y="78" font-size="13" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial" opacity="0.9">{t('Apparaat')}</text>
								<text x="124" y="96" font-size="11" fill="rgba(245,245,245,0.5)" font-family="Inter, system-ui, Arial">{t('Aan')}</text>
							</svg>
						{:else if entry.preview.kind === 'climate_button'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<defs>
									<linearGradient id={`np-climate-dial-${entry.id}`} x1="0" y1="0" x2="1" y2="1">
										<stop offset="0" stop-color="#fb923c" />
										<stop offset="1" stop-color="#f97316" />
									</linearGradient>
								</defs>
								<circle cx="80" cy="85" r="28" fill="rgba(251,146,60,0.08)" stroke="rgba(251,146,60,0.18)" stroke-width="1" />
								<g stroke="rgba(251,146,60,0.35)" stroke-width="1.4" stroke-linecap="round">
									<line x1="80" y1="60" x2="80" y2="64" />
									<line x1="98.4" y1="66.6" x2="96.0" y2="69.0" transform="rotate(45 80 85)" />
									<line x1="105" y1="85" x2="101" y2="85" />
									<line x1="98.4" y1="103.4" x2="96.0" y2="101.0" transform="rotate(-45 80 85)" />
									<line x1="80" y1="110" x2="80" y2="106" />
									<line x1="61.6" y1="103.4" x2="64.0" y2="101.0" transform="rotate(45 80 85)" />
									<line x1="55" y1="85" x2="59" y2="85" />
									<line x1="61.6" y1="66.6" x2="64.0" y2="69.0" transform="rotate(-45 80 85)" />
								</g>
								<path d="M61 104 A 25 25 0 1 1 99 104" fill="none" stroke={`url(#np-climate-dial-${entry.id})`} stroke-width="3.5" stroke-linecap="round" />
								<text x="80" y="83" text-anchor="middle" font-size="18" font-weight="700" fill="#f5f5f5" font-family="Inter, system-ui, Arial">21°</text>
								<text x="80" y="97" text-anchor="middle" font-size="9" font-weight="600" fill="rgba(251,146,60,0.85)" font-family="Inter, system-ui, Arial">→ 22°</text>
								<text x="124" y="78" font-size="13" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial" opacity="0.9">{t('Thermostaat')}</text>
								<text x="124" y="96" font-size="11" fill="rgba(245,245,245,0.5)" font-family="Inter, system-ui, Arial">{t('Verwarmen')}</text>
							</svg>
						{:else if entry.preview.kind === 'cover_button'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<defs>
									<linearGradient id={`np-curtain-left-${entry.id}`} x1="0" y1="0" x2="1" y2="0">
										<stop offset="0" stop-color="#1d4ed8" />
										<stop offset="1" stop-color="#60a5fa" />
									</linearGradient>
									<linearGradient id={`np-curtain-right-${entry.id}`} x1="1" y1="0" x2="0" y2="0">
										<stop offset="0" stop-color="#1d4ed8" />
										<stop offset="1" stop-color="#60a5fa" />
									</linearGradient>
								</defs>
								<rect x="52" y="60" width="56" height="3" rx="1.5" fill="rgba(255,255,255,0.35)" />
								<circle cx="56" cy="61.5" r="2" fill="rgba(255,255,255,0.45)" />
								<circle cx="104" cy="61.5" r="2" fill="rgba(255,255,255,0.45)" />
								<path d="M55 63 Q57 75 55 88 Q57 100 55 110 L70 110 Q72 100 70 88 Q72 75 70 63 Z" fill={`url(#np-curtain-left-${entry.id})`} opacity="0.92" />
								<path d="M61 63 V110" stroke="rgba(0,0,0,0.25)" stroke-width="0.8" />
								<path d="M65 63 V110" stroke="rgba(255,255,255,0.18)" stroke-width="0.6" />
								<path d="M90 63 Q88 75 90 88 Q88 100 90 110 L105 110 Q107 100 105 88 Q107 75 105 63 Z" fill={`url(#np-curtain-right-${entry.id})`} opacity="0.92" />
								<path d="M99 63 V110" stroke="rgba(0,0,0,0.25)" stroke-width="0.8" />
								<path d="M95 63 V110" stroke="rgba(255,255,255,0.18)" stroke-width="0.6" />
								<ellipse cx="80" cy="112" rx="16" ry="2" fill="rgba(96,165,250,0.20)" />
								<text x="124" y="78" font-size="13" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial" opacity="0.9">{t('Gordijnen')}</text>
								<text x="124" y="96" font-size="11" fill="rgba(245,245,245,0.5)" font-family="Inter, system-ui, Arial">66% {t('open')}</text>
							</svg>
						{:else if entry.preview.kind === 'vacuum_button'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<defs>
									<radialGradient id={`np-vac-body-${entry.id}`} cx="0.5" cy="0.35" r="0.7">
										<stop offset="0" stop-color="#4ade80" stop-opacity="0.45" />
										<stop offset="0.6" stop-color="#22c55e" stop-opacity="0.30" />
										<stop offset="1" stop-color="#15803d" stop-opacity="0.18" />
									</radialGradient>
								</defs>
								<path d="M50 110 Q65 60 80 110 Q95 60 110 110" fill="none" stroke="rgba(52,211,153,0.20)" stroke-width="1.5" stroke-dasharray="3 4" stroke-linecap="round" />
								<circle cx="80" cy="85" r="26" fill={`url(#np-vac-body-${entry.id})`} stroke="rgba(52,211,153,0.55)" stroke-width="1.5" />
								<circle cx="80" cy="85" r="10" fill="rgba(15,23,42,0.85)" stroke="rgba(52,211,153,0.45)" stroke-width="1" />
								<circle cx="80" cy="85" r="5" fill="#34d399" />
								<circle cx="80" cy="85" r="1.8" fill="#0f172a" />
								<path d="M65 73 Q80 67 95 73" fill="none" stroke="rgba(52,211,153,0.7)" stroke-width="1.6" stroke-linecap="round" />
								<circle cx="71" cy="71" r="1.2" fill="#34d399" />
								<circle cx="89" cy="71" r="1.2" fill="#34d399" />
								<g stroke="rgba(52,211,153,0.5)" stroke-width="1" stroke-linecap="round">
									<line x1="56" y1="92" x2="51" y2="89" />
									<line x1="56" y1="98" x2="50" y2="98" />
									<line x1="58" y1="103" x2="53" y2="106" />
								</g>
								<text x="124" y="78" font-size="13" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial" opacity="0.9">{t('Stofzuiger')}</text>
								<text x="124" y="96" font-size="11" fill="rgba(245,245,245,0.5)" font-family="Inter, system-ui, Arial">{t('Schoonmaken')} · 82%</text>
							</svg>
						{:else if entry.preview.kind === 'media_player_button'}
							<svg viewBox="0 0 320 170" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" class="preview-svg">
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<defs>
									<linearGradient id={`np-speaker-body-${entry.id}`} x1="0" y1="0" x2="0" y2="1">
										<stop offset="0" stop-color="#a78bfa" />
										<stop offset="1" stop-color="#7c3aed" />
									</linearGradient>
									<radialGradient id={`np-speaker-cone-${entry.id}`} cx="0.5" cy="0.5" r="0.5">
										<stop offset="0" stop-color="#f5f5f5" stop-opacity="0.30" />
										<stop offset="0.7" stop-color="#7c3aed" stop-opacity="0.10" />
										<stop offset="1" stop-color="#1e1b4b" stop-opacity="0.45" />
									</radialGradient>
								</defs>
								<rect x="68" y="58" width="24" height="54" rx="11" fill={`url(#np-speaker-body-${entry.id})`} opacity="0.95" />
								<g stroke="rgba(255,255,255,0.20)" stroke-width="0.6">
									<line x1="70" y1="68" x2="90" y2="68" />
									<line x1="70" y1="73" x2="90" y2="73" />
									<line x1="70" y1="78" x2="90" y2="78" />
									<line x1="70" y1="83" x2="90" y2="83" />
									<line x1="70" y1="88" x2="90" y2="88" />
									<line x1="70" y1="93" x2="90" y2="93" />
									<line x1="70" y1="98" x2="90" y2="98" />
								</g>
								<ellipse cx="80" cy="60" rx="9" ry="2.5" fill={`url(#np-speaker-cone-${entry.id})`} />
								<circle cx="80" cy="59.5" r="1.5" fill="#f5f5f5" opacity="0.85" />
								<g fill="none" stroke="#c084fc" stroke-linecap="round" opacity="0.75">
									<path d="M100 78 Q104 85 100 92" stroke-width="2" />
									<path d="M106 73 Q113 85 106 97" stroke-width="1.8" opacity="0.6" />
									<path d="M112 68 Q122 85 112 102" stroke-width="1.6" opacity="0.4" />
								</g>
								<g fill="none" stroke="#c084fc" stroke-linecap="round" opacity="0.4">
									<path d="M60 78 Q56 85 60 92" stroke-width="1.4" />
								</g>
								<text x="124" y="78" font-size="13" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial" opacity="0.9">{t('Media player')}</text>
								<text x="124" y="96" font-size="11" fill="rgba(245,245,245,0.5)" font-family="Inter, system-ui, Arial">{t('Speelt muziek')}</text>
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
								<rect x="10" y="12" width="300" height="146" rx="16" fill="#121722" stroke="#324058" />
								<defs>
									<linearGradient id={`np-cam-body-${entry.id}`} x1="0" y1="0" x2="0" y2="1">
										<stop offset="0" stop-color="#60a5fa" />
										<stop offset="1" stop-color="#1d4ed8" />
									</linearGradient>
									<radialGradient id={`np-cam-lens-${entry.id}`} cx="0.5" cy="0.5" r="0.5">
										<stop offset="0" stop-color="#f5f5f5" stop-opacity="0.45" />
										<stop offset="0.4" stop-color="#1e3a8a" />
										<stop offset="1" stop-color="#0f172a" />
									</radialGradient>
								</defs>
								<line x1="80" y1="55" x2="80" y2="68" stroke="rgba(255,255,255,0.30)" stroke-width="2" stroke-linecap="round" />
								<circle cx="80" cy="55" r="2.5" fill="rgba(255,255,255,0.45)" />
								<rect x="56" y="68" width="48" height="26" rx="13" fill={`url(#np-cam-body-${entry.id})`} opacity="0.95" />
								<rect x="60" y="71" width="40" height="3" rx="1.5" fill="rgba(255,255,255,0.18)" />
								<circle cx="98" cy="81" r="11" fill={`url(#np-cam-lens-${entry.id})`} stroke="rgba(255,255,255,0.20)" stroke-width="0.8" />
								<circle cx="98" cy="81" r="5" fill="#0f172a" />
								<circle cx="96" cy="79" r="1.8" fill="rgba(96,165,250,0.85)" />
								<circle cx="63" cy="81" r="2" fill="#ef4444" />
								<circle cx="63" cy="81" r="3.5" fill="none" stroke="#ef4444" stroke-width="0.8" opacity="0.5" />
								<rect x="76" y="94" width="8" height="6" rx="1" fill="rgba(255,255,255,0.30)" />
								<rect x="68" y="100" width="24" height="3" rx="1.5" fill="rgba(255,255,255,0.20)" />
								<text x="124" y="78" font-size="13" font-weight="600" fill="#f5f5f5" font-family="Inter, system-ui, Arial" opacity="0.9">{t("Camera's")}</text>
								<text x="124" y="96" font-size="11" fill="rgba(245,245,245,0.5)" font-family="Inter, system-ui, Arial">3 live</text>
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
