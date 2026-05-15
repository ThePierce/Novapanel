<script lang="ts">
	import type { TranslationKey } from '$lib/i18n';
	import type { CardDraft } from '$lib/persistence/panel-state';
	import { entityStore } from '$lib/ha/entities-store';
	import type { HomeAssistantEntity } from '$lib/ha/entities-service-helpers';
	import EntitySelectPicker from '$lib/cards/editor/EntitySelectPicker.svelte';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import { selectedLanguageStore, translate } from '$lib/i18n';

	type Props = {
		t: (key: TranslationKey) => string;
		selectedColumns: 1 | 2 | 3;
		sectionEditorTitle: string;
		sectionEditorIcon: string;
		sectionEditorHeaderTemperatureEntityId: string;
		sectionEditorHeaderHumidityEntityId: string;
		sectionEditorHeaderPressureEntityId: string;
		sectionEditorColumn: number;
		sectionEditorSpan: number;
		sectionEditorCardColumns: 1 | 2;
		sectionCards: CardDraft[];
		getLocalizedCardLabel: (type: string) => string;
		sectionEditorHasChanges: boolean;
		onClose: () => void;
		onDelete: () => void;
		onSave: () => void;
		onMoveOrder: (direction: -1 | 1) => void;
		onSetTitle: (value: string) => void;
		onSetIcon: (value: string) => void;
		onSetHeaderTemperatureEntityId: (value: string) => void;
		onSetHeaderHumidityEntityId: (value: string) => void;
		onSetHeaderPressureEntityId: (value: string) => void;
		onSetColumn: (value: number) => void;
		onSetSpan: (value: number) => void;
		onSetCardColumns: (value: 1 | 2) => void;
		onSetCardVisible: (cardId: string, visible: boolean) => void;
	};

	let {
		t,
		selectedColumns,
		sectionEditorTitle,
		sectionEditorIcon,
		sectionEditorHeaderTemperatureEntityId,
		sectionEditorHeaderHumidityEntityId,
		sectionEditorHeaderPressureEntityId,
		sectionEditorColumn,
		sectionEditorSpan,
		sectionEditorCardColumns,
		sectionCards,
		getLocalizedCardLabel,
		sectionEditorHasChanges,
		onClose,
		onDelete,
		onSave,
		onMoveOrder,
		onSetTitle,
		onSetIcon,
		onSetHeaderTemperatureEntityId,
		onSetHeaderHumidityEntityId,
		onSetHeaderPressureEntityId,
		onSetColumn,
		onSetSpan,
		onSetCardColumns,
		onSetCardVisible
	}: Props = $props();

	function entityName(entity: HomeAssistantEntity) {
		return entity.friendlyName?.trim() || entity.entityId;
	}

	function includesAny(value: string, needles: string[]) {
		const normalized = value.toLowerCase();
		return needles.some((needle) => normalized.includes(needle));
	}

	function isTemperatureCandidate(entity: HomeAssistantEntity) {
		return (
			entity.domain === 'sensor' &&
			(entity.deviceClass === 'temperature' ||
				entity.unit.includes('°') ||
				includesAny(`${entity.entityId} ${entityName(entity)}`, ['temp', 'temperatuur']))
		);
	}

	function isHumidityCandidate(entity: HomeAssistantEntity) {
		return (
			entity.domain === 'sensor' &&
			(entity.deviceClass === 'humidity' ||
				includesAny(`${entity.entityId} ${entityName(entity)}`, ['humidity', 'luchtvocht', 'vocht']))
		);
	}

	function isPressureCandidate(entity: HomeAssistantEntity) {
		return (
			entity.domain === 'sensor' &&
			(entity.deviceClass === 'pressure' ||
				entity.deviceClass === 'atmospheric_pressure' ||
				includesAny(entity.unit, ['hpa', 'mbar', 'bar']) ||
				includesAny(`${entity.entityId} ${entityName(entity)}`, ['pressure', 'luchtdruk', 'druk']))
		);
	}

	function sortEntities(entities: HomeAssistantEntity[]) {
		return [...entities].sort((a, b) =>
			entityName(a).localeCompare(entityName(b), 'nl', { numeric: true, sensitivity: 'base' })
		);
	}

	function withSelected(
		entities: HomeAssistantEntity[],
		selectedEntityId: string
	): HomeAssistantEntity[] {
		const selected = selectedEntityId
			? $entityStore.entities.find((entity) => entity.entityId === selectedEntityId)
			: undefined;
		if (selected && !entities.some((entity) => entity.entityId === selected.entityId)) {
			return [selected, ...entities];
		}
		return entities;
	}

	function sensorOptions(candidate: (entity: HomeAssistantEntity) => boolean) {
		const candidates = sortEntities($entityStore.entities.filter(candidate));
		const candidateIds = new Set(candidates.map((entity) => entity.entityId));
		const otherSensors = sortEntities(
			$entityStore.entities.filter(
				(entity) => entity.domain === 'sensor' && !candidateIds.has(entity.entityId)
			)
		);
		return [...candidates, ...otherSensors];
	}

	const temperatureEntities = $derived(
		withSelected(
			sensorOptions(isTemperatureCandidate),
			sectionEditorHeaderTemperatureEntityId
		)
	);
	const humidityEntities = $derived(
		withSelected(
			sensorOptions(isHumidityCandidate),
			sectionEditorHeaderHumidityEntityId
		)
	);
	const pressureEntities = $derived(
		withSelected(
			sensorOptions(isPressureCandidate),
			sectionEditorHeaderPressureEntityId
		)
	);

	function cardIcon(cardType: string): string {
		if (cardType === 'light_button' || cardType === 'lights_status') return 'bulb';
		if (cardType === 'climate_button') return 'temperature';
		if (cardType === 'cover_button') return 'curtains';
		if (cardType === 'vacuum_button') return 'robot';
		if (cardType === 'media_player_button') return 'device-speaker';
		if (cardType === 'devices_status') return 'plug';
		if (cardType === 'openings_status') return 'door';
		if (cardType === 'availability_status') return 'wifi';
		if (cardType === 'media_players_status') return 'device-speaker';
		if (cardType === 'weather' || cardType === 'weather_forecast') return 'cloud';
		if (cardType === 'alarm_panel') return 'shield-lock';
		if (cardType === 'energy') return 'bolt';
		if (cardType === 'cameras_strip') return 'device-cctv';
		if (cardType === 'date') return 'calendar';
		return 'square';
	}

	function cardTitle(card: CardDraft, index: number): string {
		const title = card.title?.trim();
		return title || `${getLocalizedCardLabel(card.cardType)} ${index + 1}`;
	}
</script>

<button type="button" class="modal-overlay" onclick={onClose} aria-label={t('closeOverlay')}></button>
<section class="settings-modal app-popup card-editor-modal" role="dialog" aria-modal="true" aria-label={t('addSection')}>
	<div class="settings-modal-head">
		<h3>{t('addSection')}</h3>
	</div>
	<div class="tab-content card-editor-content">
		<label for="section-editor-title">{t('sectionTitle')}</label>
		<input id="section-editor-title" type="text" value={sectionEditorTitle} oninput={(event) => onSetTitle((event.currentTarget as HTMLInputElement).value)} />
		<label for="section-editor-icon">{translate('Popup icoon', $selectedLanguageStore)}</label>
		<div class="section-icon-input">
			<span class="section-icon-preview"><TablerIcon name={sectionEditorIcon || 'layout-grid'} size={18} /></span>
			<input id="section-editor-icon" type="text" value={sectionEditorIcon} placeholder="layout-grid" oninput={(event) => onSetIcon((event.currentTarget as HTMLInputElement).value)} />
		</div>
		<div class="section-header-sensors">
			<div class="section-header-sensors-head">
				<TablerIcon name="activity" size={15} />
				<span>{translate('Header waarden', $selectedLanguageStore)}</span>
			</div>
			<EntitySelectPicker
				label={translate('Temperatuur', $selectedLanguageStore)}
				value={sectionEditorHeaderTemperatureEntityId}
				options={temperatureEntities}
				placeholder={translate('Geen temperatuur', $selectedLanguageStore)}
				onChange={onSetHeaderTemperatureEntityId}
			/>
			<EntitySelectPicker
				label={translate('Luchtvochtigheid', $selectedLanguageStore)}
				value={sectionEditorHeaderHumidityEntityId}
				options={humidityEntities}
				placeholder={translate('Geen luchtvochtigheid', $selectedLanguageStore)}
				onChange={onSetHeaderHumidityEntityId}
			/>
			<EntitySelectPicker
				label={translate('Luchtdruk', $selectedLanguageStore)}
				value={sectionEditorHeaderPressureEntityId}
				options={pressureEntities}
				placeholder={translate('Geen luchtdruk', $selectedLanguageStore)}
				onChange={onSetHeaderPressureEntityId}
			/>
		</div>
		<label for="section-editor-column">{t('columns')}</label>
		<select id="section-editor-column" value={sectionEditorColumn} onchange={(event) => onSetColumn(Number((event.currentTarget as HTMLSelectElement).value))}>
			{#each Array.from({ length: selectedColumns }, (_, index) => index + 1) as column (column)}
				<option value={column}>{t('columns')} {column}</option>
			{/each}
		</select>
		<label for="section-editor-span">{t('sectionSpan')}</label>
		<select id="section-editor-span" value={sectionEditorSpan} onchange={(event) => onSetSpan(Number((event.currentTarget as HTMLSelectElement).value))}>
			{#each Array.from({ length: selectedColumns }, (_, index) => index + 1) as span (span)}
				<option value={span}>{span}</option>
			{/each}
		</select>
		<label for="section-editor-card-columns">{t('sectionCardLayout')}</label>
		<select id="section-editor-card-columns" value={sectionEditorCardColumns} onchange={(event) => onSetCardColumns(Number((event.currentTarget as HTMLSelectElement).value) as 1 | 2)}>
			<option value={1}>{t('fullWidthCards')}</option>
			<option value={2}>{t('halfWidthCards')}</option>
		</select>
		<div class="section-order-actions">
			<button type="button" class="history-btn" onclick={() => onMoveOrder(-1)}>
				{t('moveUp')}
			</button>
			<button type="button" class="history-btn" onclick={() => onMoveOrder(1)}>
				{t('moveDown')}
			</button>
		</div>
		{#if sectionCards.length > 0}
			<div class="section-visibility">
				<div class="section-visibility-head">
					<span>{translate('Kaarten zichtbaar in sectie', $selectedLanguageStore)}</span>
				</div>
				<div class="section-visibility-list">
					{#each sectionCards as card, index (card.id)}
						<label class="section-visibility-row">
							<input
								type="checkbox"
								checked={card.hiddenInSection !== true}
								onchange={(event) => onSetCardVisible(card.id, (event.currentTarget as HTMLInputElement).checked)}
							/>
							<span class="section-card-icon"><TablerIcon name={cardIcon(card.cardType)} size={18} /></span>
							<span class="section-card-copy">
								<strong>{cardTitle(card, index)}</strong>
								<small>{getLocalizedCardLabel(card.cardType)}</small>
							</span>
						</label>
					{/each}
				</div>
			</div>
		{/if}
	</div>
	<div class="card-editor-actions">
		<button type="button" class="delete-btn" onclick={onDelete}>
			{t('delete')}
		</button>
		<button type="button" class={sectionEditorHasChanges ? 'save-btn' : 'history-btn'} onclick={onSave}>
			{t('save')}
		</button>
	</div>
</section>

<style>
	.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.36); border: 0; padding: 0; margin: 0; z-index: 40; cursor: default; }
	.settings-modal { position: fixed; top: 50%; left: 50%; background: #121722; border: 1px solid #2e384d; border-radius: 0.6rem; padding: 1rem; z-index: 60; transform: translate(-50%, -50%); }
	.app-popup { width: min(var(--popup-width, 850px), calc(100vw - 1.5rem)); height: min(var(--popup-height, 1140px), calc(100vh - 1.5rem)); max-height: calc(100vh - 1.5rem); display: grid; grid-template-rows: auto auto 1fr; overflow: hidden; }
	.card-editor-modal { grid-template-rows: auto 1fr auto; }
	.settings-modal-head { display: flex; align-items: center; justify-content: space-between; }
	.settings-modal-head h3 { margin: 0; font-size: 1rem; }
	.tab-content { margin-top: 0.75rem; min-height: 0; overflow-y: auto; overflow-x: hidden; padding-right: 0.2rem; scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; touch-action: pan-y; }
	.tab-content::-webkit-scrollbar { width: 0; height: 0; display: none; }
	.card-editor-content { display: grid; gap: 0.6rem; align-content: start; }
	.card-editor-content input, .card-editor-content select { height: 2.2rem; border-radius: 0.4rem; border: 0; background: rgba(255,255,255,0.08); color: #f5f5f5; padding: 0 0.7rem; }
	.section-icon-input { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 0.55rem; }
	.section-icon-input input { min-width: 0; }
	.section-icon-preview {
		width: 2.2rem;
		height: 2.2rem;
		display: grid;
		place-items: center;
		border-radius: 0.55rem;
		color: #60a5fa;
		background: rgba(96,165,250,0.16);
		box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
	}
	.section-header-sensors {
		display: grid;
		gap: 0.65rem;
		margin: 0.15rem 0 0.25rem;
		padding: 0.75rem;
		border: 1px solid rgba(255,255,255,0.08);
		border-radius: 0.7rem;
		background: rgba(255,255,255,0.035);
	}
	.section-header-sensors-head {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		color: rgba(255,255,255,0.76);
		font-size: 0.82rem;
		font-weight: 760;
	}
	.section-header-sensors-head :global(i) {
		color: #60a5fa;
	}
	.section-order-actions { display: flex; gap: 0.5rem; }
	.section-visibility {
		display: grid;
		gap: 0.55rem;
		margin-top: 0.25rem;
		padding-top: 0.75rem;
		border-top: 1px solid rgba(255,255,255,0.08);
	}
	.section-visibility-head {
		color: rgba(255,255,255,0.82);
		font-size: 0.85rem;
		font-weight: 760;
	}
	.section-visibility-list {
		display: grid;
		gap: 0.5rem;
	}
	.section-visibility-row {
		position: relative;
		min-height: 4.1rem;
		display: grid;
		grid-template-columns: auto auto minmax(0, 1fr);
		align-items: center;
		gap: 0.72rem;
		padding: 0.55rem 0.62rem;
		border-radius: 14px;
		background:
			linear-gradient(145deg, rgba(255,255,255,0.08), rgba(255,255,255,0.025)),
			#20293a;
		box-shadow: inset 0 0 0 1px rgba(255,255,255,0.055);
		cursor: pointer;
	}
	.section-visibility-row input {
		width: 1.05rem;
		height: 1.05rem;
		margin: 0;
		accent-color: #60a5fa;
	}
	.section-card-icon {
		width: 2.85rem;
		height: 2.85rem;
		display: grid;
		place-items: center;
		border-radius: 13px;
		color: #60a5fa;
		background: rgba(96,165,250,0.16);
		box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
	}
	.section-card-copy {
		min-width: 0;
		display: grid;
		gap: 0.16rem;
	}
	.section-card-copy strong,
	.section-card-copy small {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.section-card-copy strong {
		color: #fff;
		font-size: 0.98rem;
		line-height: 1.12;
		font-weight: 750;
	}
	.section-card-copy small {
		color: rgba(255,255,255,0.54);
		font-size: 0.78rem;
		font-weight: 650;
	}
	.card-editor-actions { display: flex; justify-content: space-between; margin-top: 0.8rem; }
	.delete-btn, .save-btn, .history-btn { height: 2.2rem; padding: 0 0.9rem; border-radius: 0.4rem; border: 0; color: #ffffff; cursor: pointer; }
	.delete-btn { background: #b73232; }
	.save-btn { background: #c89d1b; }
	.history-btn { background: rgba(255,255,255,0.08); color: #f5f5f5; }
</style>
