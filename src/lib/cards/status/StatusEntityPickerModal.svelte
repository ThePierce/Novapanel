<script lang="ts">
	import type { TranslationKey } from '$lib/i18n';
	import type { HomeAssistantEntity } from '$lib/ha/entities-service-helpers';
	import { entityStore } from '$lib/ha/entities-store';

	type Props = {
		t: (key: TranslationKey) => string;
		title: string;
		entities: HomeAssistantEntity[];
		onClose: () => void;
	};

	let { t, title, entities = [], onClose }: Props = $props();
	let editingEntityId = $state('');
	let editingName = $state('');

	function openRename(entity: HomeAssistantEntity) {
		editingEntityId = entity.entityId;
		editingName = entity.friendlyName;
	}

	function cancelRename() {
		editingEntityId = '';
		editingName = '';
	}

	function saveRename(entity: HomeAssistantEntity) {
		const next = editingName.trim();
		if (!next) return;
		entityStore.setFriendlyName(entity.entityId, next);
		cancelRename();
	}
</script>

<button type="button" class="modal-overlay picker-overlay" onclick={onClose} aria-label={t('closeOverlay')}></button>
<section class="settings-modal app-popup picker-modal" role="dialog" aria-modal="true" aria-label={title}>
	<div class="settings-modal-head">
		<h3>{title}</h3>
	</div>
	<div class="picker-body">
		{#if entities.length === 0}
			<div class="picker-empty">{t('statusNoEntitiesFound')}</div>
		{:else}
			{#each entities as entity (entity.entityId)}
				<div class="picker-row">
					{#if editingEntityId === entity.entityId}
						<input
							class="rename-input"
							type="text"
							value={editingName}
							oninput={(event) => (editingName = (event.currentTarget as HTMLInputElement).value)}
							onkeydown={(event) => {
								if (event.key === 'Enter') saveRename(entity);
								if (event.key === 'Escape') cancelRename();
							}}
						/>
						<button type="button" class="save-btn" onclick={() => saveRename(entity)}>{t('save')}</button>
						<button type="button" class="history-btn" onclick={cancelRename}>{t('cancel')}</button>
					{:else}
						<span>{entity.friendlyName?.trim() || entity.entityId}</span>
						<button type="button" class="edit-btn" aria-label="Naam aanpassen" onclick={() => openRename(entity)}><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" /></svg></button>
					{/if}
				</div>
			{/each}
		{/if}
	</div>
	<div class="picker-actions">
		<button type="button" class="history-btn" onclick={onClose}>
			{t('close')}
		</button>
	</div>
</section>

<style>
	.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.36); border: 0; padding: 0; margin: 0; z-index: 70; cursor: default; }
	.settings-modal { position: fixed; top: 50%; left: 50%; background: #121722; border: 1px solid #2e384d; border-radius: 0.6rem; padding: 1rem; z-index: 80; transform: translate(-50%, -50%); }
	.app-popup { width: min(var(--popup-width, 850px), calc(100vw - 1.5rem)); height: min(var(--popup-height, 1140px), calc(100vh - 1.5rem)); max-height: calc(100vh - 1.5rem); display: grid; grid-template-rows: auto 1fr auto; overflow: hidden; }
	.settings-modal-head h3 { margin: 0; font-size: 1rem; }
	.picker-body { margin-top: 0.75rem; min-height: 0; overflow-y: auto; overflow-x: hidden; display: grid; gap: 0.42rem; align-content: start; scrollbar-width: none; -ms-overflow-style: none; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; touch-action: pan-y; }
	.picker-body::-webkit-scrollbar { width: 0; height: 0; display: none; }
	.picker-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 0.55rem; border-radius: 0.4rem; background: rgba(255,255,255,0.05); font-size: 0.86rem; }
	.picker-row span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.rename-input { flex: 1; min-width: 0; height: 2rem; border-radius: 0.35rem; border: 0; background: rgba(255,255,255,0.08); color: #f5f5f5; padding: 0 0.55rem; }
	.picker-empty { opacity: 0.75; font-size: 0.86rem; }
	.picker-actions { display: flex; justify-content: flex-end; margin-top: 0.75rem; }
	.history-btn { height: 2.2rem; padding: 0 0.9rem; border-radius: 0.4rem; border: 0; color: #f5f5f5; cursor: pointer; }
	.edit-btn { width: 2rem; height: 2rem; border-radius: 0.35rem; border: 0; background: rgba(255,255,255,0.08); color: #f5f5f5; cursor: pointer; }
	.save-btn { height: 2rem; padding: 0 0.7rem; border-radius: 0.35rem; border: 0; background: #c89d1b; color: #ffffff; cursor: pointer; }
	.history-btn { background: rgba(255,255,255,0.08); color: #f5f5f5; }
</style>
