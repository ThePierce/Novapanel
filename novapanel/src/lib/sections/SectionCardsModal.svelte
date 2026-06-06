<script lang="ts">
	import type { CardDraft } from '$lib/persistence/panel-state';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import EntityButtonCard from '$lib/cards/EntityButtonCard.svelte';
	import LightButtonCard from '$lib/cards/LightButtonCard.svelte';
	import type { EntityButtonKind } from '$lib/cards/entity-button-types';
	import { selectedLanguageStore, translate } from '$lib/i18n';
	import LazyComponent from '$lib/lazy/LazyComponent.svelte';
	import { modalBehavior } from '$lib/modal/modal-behavior';
	import { getCardDraftTitle, getCardTypeIcon } from '$lib/cards/card-meta';

	let camerasStripCardPromise: Promise<typeof import('$lib/cards/CamerasStripCard.svelte')> | null = null;
	const loadCamerasStripCard = () =>
		(camerasStripCardPromise ??= import('$lib/cards/CamerasStripCard.svelte'));

	type GroupKey = 'lights' | 'devices' | 'media' | 'other';
	type Group = {
		key: GroupKey;
		title: string;
		icon: string;
		cards: CardDraft[];
	};

	type Props = {
		title: string;
		icon?: string;
		cardColumns?: 1 | 2;
		cards: CardDraft[];
		getLocalizedCardLabel: (type: string) => string;
		onClose: () => void;
	};

	let {
		title,
		icon = 'layout-grid',
		cardColumns = 1,
		cards,
		getLocalizedCardLabel,
		onClose
	}: Props = $props();

	function groupKey(cardType: string): GroupKey {
		if (cardType === 'light_button' || cardType === 'lights_status') return 'lights';
		if (
			cardType === 'device_button' ||
			cardType === 'climate_button' ||
			cardType === 'cover_button' ||
			cardType === 'vacuum_button' ||
			cardType === 'devices_status' ||
			cardType === 'openings_status' ||
			cardType === 'availability_status'
		)
			return 'devices';
		if (cardType === 'media_players_status' || cardType === 'media_player_button') return 'media';
		return 'other';
	}

	function entityButtonKindForCard(cardType: string): EntityButtonKind | null {
		if (cardType === 'device_button') return 'device';
		if (cardType === 'climate_button') return 'climate';
		if (cardType === 'cover_button') return 'cover';
		if (cardType === 'vacuum_button') return 'vacuum';
		if (cardType === 'media_player_button') return 'media_player';
		return null;
	}

	function noopCameraClick() {}

	const groups = $derived.by<Group[]>(() => {
		const base: Group[] = [
			{ key: 'lights', title: translate('Lampen', $selectedLanguageStore), icon: 'bulb', cards: [] },
			{ key: 'devices', title: translate('Apparaten', $selectedLanguageStore), icon: 'plug', cards: [] },
			{
				key: 'media',
				title: translate('Media Spelers', $selectedLanguageStore),
				icon: 'device-speaker',
				cards: []
			},
			{ key: 'other', title: translate('Overig', $selectedLanguageStore), icon: 'layout-grid', cards: [] }
		];
		const map = new Map(base.map((group) => [group.key, group]));
		for (const card of cards ?? []) {
			map.get(groupKey(card.cardType))?.cards.push(card);
		}
		return base.filter((group) => group.cards.length > 0);
	});
</script>

<button
	type="button"
	class="modal-overlay section-cards-overlay"
	onclick={onClose}
	aria-label={translate('close', $selectedLanguageStore)}
></button>
<div
	class="settings-modal app-popup section-cards-modal np-detail"
	role="dialog"
	aria-modal="true"
	aria-label={title}
	use:modalBehavior={{ onClose }}
>
	<div class="np-detail-head" style="--np-tint: rgba(96,165,250,0.18); --np-color: #60a5fa;">
		<div class="np-detail-head-glow" aria-hidden="true"></div>
		<div class="np-detail-head-icon"><TablerIcon name={icon || 'layout-grid'} size={22} /></div>
		<div class="np-detail-head-text">
			<div class="np-detail-head-title">{title}</div>
		</div>
	</div>

	<div class="section-cards-body">
		{#if cards.length === 0}
			<div class="section-cards-empty">
				<TablerIcon name="layout-grid-off" size={24} />
				<span>{translate('Geen kaarten in deze sectie', $selectedLanguageStore)}</span>
			</div>
		{:else}
			{#each groups as group (group.key)}
				<div class="section-card-group">
					<div class="section-card-group-head">
						<span class="section-card-group-icon"><TablerIcon name={group.icon} size={15} /></span>
						<span>{group.title}</span>
					</div>
					<div class="section-card-list" class:two={cardColumns === 2}>
						{#each group.cards as card, index (card.id)}
							{@const entityButtonKind = entityButtonKindForCard(card.cardType)}
							<article
								class="section-card-preview"
								class:camera-strip-card-item={card.cardType === 'cameras_strip'}
								class:button-card-item={card.cardType === 'light_button' || !!entityButtonKind}
							>
								{#if card.cardType === 'cameras_strip'}
									<LazyComponent
										loader={loadCamerasStripCard}
										props={{
											cameras: card.cameras,
											title: card.title,
											onCameraClick: noopCameraClick
										}}
									/>
								{:else if card.cardType === 'light_button'}
									<LightButtonCard
										title={card.title}
										entityId={card.entityId}
										icon={card.statusIcon}
										editMode={true}
										onOpen={() => {}}
									/>
								{:else if entityButtonKind}
									<EntityButtonCard
										kind={entityButtonKind}
										title={card.title}
										entityId={card.entityId}
										icon={card.statusIcon}
										editMode={true}
										onOpen={() => {}}
									/>
								{:else}
									<div class="section-card-row">
										<div class="section-card-icon">
											<TablerIcon name={getCardTypeIcon(card.cardType)} size={17} />
										</div>
										<div class="section-card-main">
											<strong>{getCardDraftTitle(card, index, getLocalizedCardLabel)}</strong>
											<span>{getLocalizedCardLabel(card.cardType)}</span>
										</div>
									</div>
								{/if}
							</article>
						{/each}
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 40;
		margin: 0;
		padding: 0;
		border: 0;
		background: rgba(0, 0, 0, 0.36);
	}
	.section-cards-modal {
		--popup-width: var(--np-detail-popup-width, min(850px, calc(100vw - 1.5rem)));
		--popup-height: var(--np-detail-popup-height, min(1140px, calc(100vh - 1.5rem)));
		padding: 0 !important;
		border: 0.5px solid rgba(255, 255, 255, 0.08);
		border-radius: 18px;
		grid-template-rows: auto minmax(0, 1fr);
		background:
			radial-gradient(circle at 20% 0%, rgba(96, 165, 250, 0.16), transparent 36%),
			linear-gradient(180deg, #1a2238 0%, #0f1424 100%);
		overflow: hidden;
		box-sizing: border-box;
	}
	.section-cards-modal::before {
		content: '';
		position: absolute;
		top: 0;
		left: 50%;
		width: 60%;
		height: 1px;
		background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.12), transparent);
		transform: translateX(-50%);
		pointer-events: none;
		z-index: 5;
	}
	.section-cards-body {
		display: grid;
		gap: 0.7rem;
		padding: 0.8rem 1rem 0.95rem;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		scrollbar-width: none;
		-ms-overflow-style: none;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		touch-action: pan-y;
	}
	.section-cards-body::-webkit-scrollbar {
		width: 0;
		height: 0;
		display: none;
	}
	.section-cards-empty {
		min-height: 14rem;
		display: grid;
		place-items: center;
		align-content: center;
		gap: 0.65rem;
		color: rgba(255, 255, 255, 0.58);
		font-size: 0.9rem;
	}
	.section-card-group {
		display: grid;
		gap: 0.42rem;
	}
	.section-card-group-head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: rgba(255, 255, 255, 0.9);
		font-weight: 780;
		font-size: 0.9rem;
	}
	.section-card-group-icon {
		width: 1.85rem;
		height: 1.85rem;
		display: grid;
		place-items: center;
		border-radius: 9px;
		background: rgba(255, 255, 255, 0.06);
		color: #93c5fd;
	}
	.section-card-list {
		display: grid;
		gap: 0.38rem;
	}
	.section-card-list.two {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
	.section-card-preview {
		width: 100%;
		min-width: 0;
		max-width: 100%;
		min-height: 3.1rem;
		display: grid;
		align-content: stretch;
		justify-items: stretch;
		background: transparent;
		padding: 0;
		border: 0;
		border-radius: 14px;
		box-sizing: border-box;
		overflow: visible;
		container-type: inline-size;
	}
	.section-card-preview > * {
		min-width: 0;
		max-width: 100%;
	}
	.section-card-preview.camera-strip-card-item {
		min-height: 0;
	}
	.section-card-preview.button-card-item {
		min-height: 0;
	}
	.section-card-preview.button-card-item :global(.light-button-card),
	.section-card-preview.button-card-item :global(.entity-button-card) {
		min-height: 3rem !important;
		padding: 0.35rem 0.48rem !important;
		gap: 0.48rem !important;
		border-radius: 10px !important;
	}
	.section-card-preview.button-card-item :global(.light-icon-button),
	.section-card-preview.button-card-item :global(.entity-icon-button) {
		width: 2rem !important;
		height: 2rem !important;
		border-radius: 9px !important;
	}
	.section-card-preview.button-card-item :global(.light-icon-button .mdi-mask),
	.section-card-preview.button-card-item :global(.light-icon-button svg),
	.section-card-preview.button-card-item :global(.entity-icon-button .mdi-mask),
	.section-card-preview.button-card-item :global(.entity-icon-button svg) {
		width: 1.05rem !important;
		height: 1.05rem !important;
	}
	.section-card-preview.button-card-item :global(.light-name),
	.section-card-preview.button-card-item :global(.entity-name) {
		font-size: 0.76rem !important;
		line-height: 1.12 !important;
	}
	.section-card-preview.button-card-item :global(.light-state),
	.section-card-preview.button-card-item :global(.entity-state) {
		font-size: 0.64rem !important;
	}
	.section-card-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 0.56rem;
		min-height: 3.15rem;
		padding: 0.42rem 0.52rem;
		border-radius: 11px;
		background: linear-gradient(145deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.025)), #20293a;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.055);
		min-width: 0;
	}
	.section-card-icon {
		width: 2.2rem;
		height: 2.2rem;
		display: grid;
		place-items: center;
		border-radius: 10px;
		color: #60a5fa;
		background: rgba(96, 165, 250, 0.16);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.08);
	}
	.section-card-main {
		min-width: 0;
		display: grid;
		gap: 0.14rem;
	}
	.section-card-main strong,
	.section-card-main span {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.section-card-main strong {
		color: #fff;
		font-size: 0.82rem;
		line-height: 1.12;
		font-weight: 750;
	}
	.section-card-main span {
		color: rgba(255, 255, 255, 0.52);
		font-size: 0.68rem;
		font-weight: 650;
	}
	@media (max-width: 560px) {
		.section-card-list.two {
			grid-template-columns: 1fr;
		}
	}
</style>
