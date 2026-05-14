<script lang="ts">
	import EditorSection from '$lib/cards/editor/EditorSection.svelte';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';

	type LightGroup = { id: string; name: string; entityIds: string[] };
	type Status = 'filled' | 'empty';

	type Props = {
		lightGroups: LightGroup[];
		lgEditingId: string;
		lgNewGroupName: string;
		getFriendlyName: (entityId: string) => string;
		lgStartEdit: (group: LightGroup) => void;
		lgDelete: (id: string) => void;
		lgCreate: () => void;
		onLgNewGroupNameChange: (v: string) => void;
	};

	let p: Props = $props();

	const lightGroupsStatus = $derived((() => {
		const n = p.lightGroups.length;
		if (n === 0) return { status: 'empty' as Status, label: 'geen' };
		return { status: 'filled' as Status, label: `${n} groep${n === 1 ? '' : 'en'}` };
	})());
</script>

<EditorSection
	title="Lampengroepen"
	icon="folders"
	tone="purple"
	status={lightGroupsStatus.status}
	statusLabel={lightGroupsStatus.label}
>
	<div class="np-help">Groepen tellen als 1 item in het overzicht. Handig om "Woonkamer" als één entiteit te zien.</div>
	{#each p.lightGroups as group (group.id)}
		<div class="lg-row" class:lg-row-selected={p.lgEditingId === group.id} role="button" tabindex="0" onclick={() => p.lgStartEdit(group)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.lgStartEdit(group); } }}>
			<div class="lg-row-top">
				<span class="lg-name">{group.name}</span>
				<span class="lg-count-pill">{group.entityIds.length} {group.entityIds.length === 1 ? 'lamp' : 'lampen'}</span>
				<button type="button" class="lg-btn" onclick={(e) => { e.stopPropagation(); p.lgStartEdit(group); }} title="Bewerken">
					<TablerIcon name="pencil" size={12} />
				</button>
				<button type="button" class="lg-btn lg-btn-delete" onclick={(e) => { e.stopPropagation(); p.lgDelete(group.id); }} title="Verwijderen">
					<TablerIcon name="trash" size={12} />
				</button>
			</div>
			{#if group.entityIds.length === 0}
				<div class="lg-empty">Nog geen lampen toegevoegd</div>
			{:else}
				<div class="lg-tags-row">
					{#each group.entityIds.slice(0, 4) as eid (eid)}
						<span class="lg-tag">{p.getFriendlyName(eid)}</span>
					{/each}
					{#if group.entityIds.length > 4}
						<span class="lg-tag more">+ {group.entityIds.length - 4} meer</span>
					{/if}
				</div>
			{/if}
		</div>
	{/each}
	<div class="lg-new-group">
		<input class="np-input" type="text" placeholder="Nieuwe groepsnaam"
			value={p.lgNewGroupName}
			oninput={(e) => p.onLgNewGroupNameChange((e.currentTarget as HTMLInputElement).value)}
			onkeydown={(e) => { if (e.key === 'Enter') p.lgCreate(); }} />
		<button type="button" class="np-mini-btn primary" onclick={p.lgCreate} disabled={!p.lgNewGroupName.trim()}>
			<TablerIcon name="plus" size={12} /> Toevoegen
		</button>
	</div>
</EditorSection>

<style>
	.lg-row {
		display: flex; flex-direction: column; gap: 5px;
		padding: 9px 12px;
		background: rgba(255,255,255,0.03);
		border: 0.5px solid rgba(255,255,255,0.07);
		border-radius: 9px;
		cursor: pointer;
		transition: background 0.12s, border-color 0.12s;
	}
	.lg-row:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.13); }
	.lg-row-selected { background: rgba(96,165,250,0.10); border-color: rgba(96,165,250,0.30); }
	.lg-row-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
	.lg-name {
		font-size: 12.5px; font-weight: 500; color: #f5f5f5;
		flex: 1; min-width: 0;
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}
	.lg-count-pill {
		font-size: 10px; padding: 2px 7px;
		background: rgba(255,255,255,0.07); border-radius: 4px;
		color: rgba(255,255,255,0.6);
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
	}
	.lg-btn {
		width: 22px; height: 22px;
		display: grid; place-items: center;
		background: rgba(255,255,255,0.05);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 5px;
		color: rgba(255,255,255,0.65);
		cursor: pointer; flex-shrink: 0;
		transition: background 0.12s, color 0.12s;
	}
	.lg-btn:hover { background: rgba(255,255,255,0.10); color: #fff; }
	.lg-btn-delete:hover { background: rgba(248,113,113,0.15); color: #f87171; border-color: rgba(248,113,113,0.25); }
	.lg-tags-row { display: flex; flex-wrap: wrap; gap: 4px; }
	.lg-tag {
		font-size: 10.5px; padding: 2px 7px;
		background: rgba(255,255,255,0.05);
		border: 0.5px solid rgba(255,255,255,0.06);
		border-radius: 4px;
		color: rgba(255,255,255,0.7);
	}
	.lg-tag.more {
		color: rgba(255,255,255,0.45);
		background: transparent; border-style: dashed;
	}
	.lg-empty {
		font-size: 10.5px; color: rgba(255,255,255,0.4);
		font-style: italic; padding: 2px 0;
	}
	.lg-new-group { display: flex; gap: 6px; padding-top: 6px; border-top: 0.5px solid rgba(255,255,255,0.06); }
	.lg-new-group :global(.np-input) { flex: 1; }
</style>
