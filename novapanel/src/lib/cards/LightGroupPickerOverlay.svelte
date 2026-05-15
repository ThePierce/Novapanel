<script lang="ts">
	import { selectedLanguageStore, translate } from '$lib/i18n';
	/**
	 * Modal overlay voor het bewerken van een lampengroep — kiezen welke entiteiten
	 * tot een groep behoren, naam wijzigen of de groep verwijderen.
	 *
	 * Renders bovenop de hele app via fixed positioning + z-index 9999, en wordt
	 * getoond zolang `open` true is. Klikken op de achtergrond roept onSave aan
	 * (auto-save bij sluiten); klikken in de modal zelf doet niets dankzij
	 * stopPropagation.
	 */

	interface LightGroup {
		id: string;
		name: string;
		entityIds: string[];
	}

	type Props = {
		open: boolean;
		editingId: string | null;
		draftName: string;
		draftEntityIds: string[];
		statusEntityIds: string[];
		groups: LightGroup[];
		getFriendlyName: (entityId: string) => string;
		onDraftNameChange: (name: string) => void;
		onToggleEntity: (entityId: string) => void;
		onSave: () => void;
		onDelete: () => void;
	};

	let {
		open,
		editingId,
		draftName,
		draftEntityIds,
		statusEntityIds,
		groups,
		getFriendlyName,
		onDraftNameChange,
		onToggleEntity,
		onSave,
		onDelete
	}: Props = $props();
</script>

{#if open && editingId}
	<div class="lg-portal-overlay"
		onclick={() => onSave()}
		role="presentation"
		style="position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;">
		<div
			onclick={(e) => e.stopPropagation()}
			role="presentation"
			style="background:#121722;border:1px solid #2e384d;border-radius:0.85rem;width:min(var(--popup-width, 850px), calc(100vw - 1.5rem));height:min(var(--popup-height, 1140px), calc(100vh - 1.5rem));max-height:calc(100vh - 1.5rem);display:grid;grid-template-rows:auto 1fr auto;overflow:hidden;">
			<div style="padding:0.85rem 1rem 0;display:flex;flex-direction:column;gap:0.3rem;">
				<input type="text" value={draftName}
					oninput={(e) => onDraftNameChange((e.currentTarget as HTMLInputElement).value)}
					placeholder={translate('Groepsnaam', $selectedLanguageStore)}
					style="height:2rem;border-radius:0.35rem;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#f5f5f5;padding:0 0.5rem;font-size:0.9rem;width:100%;box-sizing:border-box;" />
				<span style="font-size:0.75rem;opacity:0.5;">{translate('Selecteer lampen voor deze groep', $selectedLanguageStore)}</span>
			</div>
			<div class="lg-picker-scroll" style="overflow-y:auto;scrollbar-width:none;padding:0.5rem 1rem;display:flex;flex-direction:column;gap:0.15rem;">
				{#each (statusEntityIds ?? []) as entityId}
					{@const inOther = groups.some(g => g.id !== editingId && g.entityIds.includes(entityId))}
					<label style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0.5rem;border-radius:0.4rem;cursor:pointer;{inOther ? 'opacity:0.4;cursor:not-allowed;' : ''}">
						<input type="checkbox" checked={draftEntityIds.includes(entityId)} disabled={inOther}
							onchange={() => onToggleEntity(entityId)} />
						<span style="flex:1;font-size:0.85rem;">{getFriendlyName(entityId)}</span>
						{#if inOther}<span style="font-size:0.68rem;opacity:0.5;">{translate('in andere groep', $selectedLanguageStore)}</span>{/if}
					</label>
				{/each}
				{#if (statusEntityIds ?? []).length === 0}
					<div style="font-size:0.82rem;opacity:0.45;padding:1rem 0;text-align:center;">{translate('Voeg eerst lampen toe via de entiteitenlijst hierboven.', $selectedLanguageStore)}</div>
				{/if}
			</div>
			<div style="display:flex;gap:0.5rem;padding:0.75rem 1rem;border-top:1px solid rgba(255,255,255,0.07);">
				<button type="button" onclick={onDelete}
					style="height:2.2rem;padding:0 0.85rem;border-radius:0.4rem;border:0;background:rgba(225,82,65,0.15);color:#e15241;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;gap:0.3rem;">
					{translate('Verwijder groep', $selectedLanguageStore)}
				</button>
				<button type="button" onclick={onSave}
					style="flex:1;height:2.2rem;border-radius:0.4rem;border:0;background:rgba(79,113,168,0.45);color:#f5f5f5;cursor:pointer;font-size:0.85rem;font-weight:500;">
					{translate('Opslaan', $selectedLanguageStore)}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.lg-picker-scroll {
		min-height: 0;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		touch-action: pan-y;
		-ms-overflow-style: none;
	}

	.lg-picker-scroll::-webkit-scrollbar {
		width: 0;
		height: 0;
		display: none;
	}
</style>
