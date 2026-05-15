<script lang="ts">
	import EditorSection from '$lib/cards/editor/EditorSection.svelte';
	import AreaPicker from '$lib/cards/editor/AreaPicker.svelte';
	import { filteredEntities } from '$lib/ha/entities-store';

	type Row = { id: string; label: string; displayName: string };
	type CardType = 'lights_status' | 'openings_status' | 'devices_status' | 'availability_status' | 'media_players_status';
	type Tone = 'gold' | 'blue' | 'green' | 'cyan' | 'purple';
	type Status = 'required' | 'filled' | 'partial' | 'empty';

	type Props = {
		t: (key: string) => string;
		cardType: CardType;
		statusDomains?: string[];
		statusEntityIds?: string[];
		statusEntityAliases?: Record<string, string>;
		mediaHubPlayerAliases?: Record<string, string>;
		statusDeviceClasses?: string[];
		statusIcon?: string;
		usesScopedEntityPicker: boolean;
		scopedPickerSelectedRows: Row[];
		scopedPickerIgnoredRows: Row[];
		statusCandidates: { entityId: string }[];
		iconValidationState: string;
		iconValidationMessage: string;
		iconPreviewSrc?: string;
		onStatusDomainsChange: (v: string[]) => void;
		onStatusDeviceClassesChange: (v: string[]) => void;
		onStatusIconChange: (v: string) => void;
		onStatusEntityAliasesChange: (v: Record<string, string>) => void;
		onMediaHubPlayerAliasesChange?: (v: Record<string, string>) => void;
		toggleStatusEntityId: (entityId: string, checked: boolean) => void;
		selectAllScopedPickerEntities: () => void;
		clearScopedPickerSelectionOnce: () => void;
		openPicker: () => void;
	};

	let p: Props = $props();

	function nonEmpty(v: string | undefined): boolean {
		return typeof v === 'string' && v.trim().length > 0;
	}

	const statusEntitiesCount = $derived((p.statusEntityIds ?? []).filter(v => v.trim().length > 0).length);
	const statusDomainsCount = $derived((p.statusDomains ?? []).filter(v => v.trim().length > 0).length);

	const statusFilterStatus = $derived((() => {
		const sel = statusEntitiesCount;
		const dom = statusDomainsCount;
		if (sel === 0 && dom === 0) return { status: 'required' as Status, label: 'kies entiteiten of domein' };
		if (sel > 0) return { status: 'filled' as Status, label: `${sel} geselecteerd` };
		return { status: 'filled' as Status, label: `${dom} domein${dom === 1 ? '' : 'en'}` };
	})());
	const openingsClassesStatus = $derived((() => {
		const n = (p.statusDeviceClasses ?? []).filter(v => v.trim().length > 0).length;
		if (n === 0) return { status: 'empty' as Status, label: 'auto' };
		return { status: 'filled' as Status, label: `${n} ingesteld` };
	})());

	const statusTone = $derived((() => {
		const m: Record<CardType, Tone> = {
			lights_status: 'gold',
			openings_status: 'blue',
			devices_status: 'green',
			availability_status: 'cyan',
			media_players_status: 'purple'
		};
		return m[p.cardType];
	})());

	const showsIconField = $derived(
		p.cardType === 'lights_status' || p.cardType === 'devices_status' || p.cardType === 'media_players_status'
	);

	const aliasRows = $derived.by(() => {
		const selectedIds = (p.statusEntityIds ?? []).map((id) => id.trim()).filter((id) => id.length > 0);
		const candidateIds = p.statusCandidates.map((entity) => entity.entityId.trim()).filter((id) => id.length > 0);
		const sourceIds = selectedIds.length > 0 ? selectedIds : candidateIds;
		const seen = new Set<string>();
		return sourceIds
			.filter((id) => {
				const key = id.toLowerCase();
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.map((id) => {
				const entity = $filteredEntities.find((entry) => entry.entityId.toLowerCase() === id.toLowerCase());
				const originalName = entity?.friendlyName?.trim() || id;
				const aliases = p.cardType === 'media_players_status' ? (p.mediaHubPlayerAliases ?? {}) : (p.statusEntityAliases ?? {});
				const alias = aliases[id] ?? aliases[entity?.entityId ?? id] ?? '';
				return {
					id: entity?.entityId ?? id,
					originalName,
					alias: typeof alias === 'string' ? alias : ''
				};
			});
	});

	function updateEntityAlias(entityId: string, value: string) {
		const aliases = p.cardType === 'media_players_status' ? (p.mediaHubPlayerAliases ?? {}) : (p.statusEntityAliases ?? {});
		const next = { ...aliases };
		const trimmed = value.trim();
		if (trimmed) next[entityId] = value;
		else delete next[entityId];
		if (p.cardType === 'media_players_status') p.onMediaHubPlayerAliasesChange?.(next);
		else p.onStatusEntityAliasesChange(next);
	}
</script>

<EditorSection
	title={p.t('Welke entiteiten')}
	icon="target"
	tone={statusTone}
	status={statusFilterStatus.status}
	statusLabel={statusFilterStatus.label}
	open
>
	<div class="np-help">{p.t('Kies de domeinen die meetellen, en/of selecteer specifieke entiteiten handmatig.')}</div>
	<div class="np-field">
		<span class="np-label">{p.t('Domeinen')} <span class="np-hint">({p.t('komma-gescheiden')})</span></span>
		<input
			type="text"
			class="np-input mono"
			value={(p.statusDomains ?? []).join(', ')}
			placeholder={p.t('statusDomainsPlaceholder')}
			oninput={(event) =>
				p.onStatusDomainsChange(
					(event.currentTarget as HTMLInputElement).value
						.split(',')
						.map((entry) => entry.trim())
						.filter((entry) => entry.length > 0)
				)}
		/>
	</div>
	{#if showsIconField}
		<div class="np-field">
			<span class="np-label">{p.t('Icoon')} <span class="np-hint">({p.t('MDI naam, bv. lightbulb')})</span></span>
			<input
				type="text"
				class="np-input mono"
				value={p.statusIcon ?? ''}
				placeholder={p.t('mdiIconPlaceholderLight')}
				oninput={(event) => p.onStatusIconChange((event.currentTarget as HTMLInputElement).value)}
			/>
			<div class={`icon-validation ${p.iconValidationState}`}>
				{#if p.iconPreviewSrc && p.iconValidationState !== 'error'}
					<img class="icon-preview" src={p.iconPreviewSrc} alt="" width="18" height="18" />
				{/if}
				<span>{p.iconValidationMessage}</span>
			</div>
		</div>
	{/if}
	{#if p.usesScopedEntityPicker}
		<AreaPicker
			selectedRows={p.scopedPickerSelectedRows}
			ignoredRows={p.scopedPickerIgnoredRows}
			onToggle={p.toggleStatusEntityId}
			onSelectAll={p.selectAllScopedPickerEntities}
			onClearAll={p.clearScopedPickerSelectionOnce}
		/>
	{/if}
	{#if p.cardType !== 'media_players_status' && !p.usesScopedEntityPicker}
		<button type="button" class="np-mini-btn primary" onclick={p.openPicker}>
			{p.t('statusFoundEntities')} ({p.statusCandidates.length})
		</button>
	{/if}
</EditorSection>

{#if aliasRows.length > 0}
	<EditorSection
		title={p.t('Namen')}
		icon="pencil"
		tone={statusTone}
		status={aliasRows.some((row) => row.alias.trim().length > 0) ? 'partial' : 'empty'}
		statusLabel={`${aliasRows.length} ${p.t(aliasRows.length === 1 ? 'entiteit' : 'entiteiten')}`}
	>
		<div class="np-help">{p.t('Pas hier de namen aan die Nova Panel toont. De oorspronkelijke Home Assistant naam blijft tussen haakjes zichtbaar.')}</div>
		<div class="alias-editor-list">
			{#each aliasRows as row (row.id)}
				<div class="alias-editor-row">
					<div class="alias-editor-meta">
						<span class="alias-editor-name">
							{row.alias.trim().length > 0 ? row.alias.trim() : row.originalName}
							<span class="np-hint">({row.originalName})</span>
						</span>
						<span class="alias-editor-id">{row.id}</span>
					</div>
					<input
						type="text"
						class="np-input"
						value={row.alias}
						placeholder={row.originalName}
						oninput={(event) => updateEntityAlias(row.id, (event.currentTarget as HTMLInputElement).value)}
					/>
				</div>
			{/each}
		</div>
	</EditorSection>
{/if}

{#if p.cardType === 'openings_status'}
	<EditorSection
		title="Device classes"
		icon="filter"
		tone="blue"
		status={openingsClassesStatus.status}
		statusLabel={openingsClassesStatus.label}
	>
		<div class="np-help">{p.t('Optioneel. Beperk tot specifieke device classes (door, window, garage…).')}</div>
		<div class="np-field">
			<span class="np-label">{p.t('Classes')} <span class="np-hint">({p.t('komma-gescheiden')})</span></span>
			<input
				type="text"
				class="np-input mono"
				value={(p.statusDeviceClasses ?? []).join(', ')}
				placeholder={p.t('statusDeviceClassesPlaceholder')}
				oninput={(event) =>
					p.onStatusDeviceClassesChange(
						(event.currentTarget as HTMLInputElement).value
							.split(',')
							.map((entry) => entry.trim())
							.filter((entry) => entry.length > 0)
					)}
			/>
		</div>
	</EditorSection>
{/if}

<style>
	.alias-editor-list {
		display: grid;
		gap: 0.5rem;
	}
	.alias-editor-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(180px, 0.9fr);
		gap: 0.5rem;
		align-items: center;
		padding: 0.55rem;
		border: 1px solid rgba(255,255,255,0.08);
		border-radius: 0.45rem;
		background: rgba(255,255,255,0.035);
		min-width: 0;
	}
	.alias-editor-meta {
		display: grid;
		gap: 0.15rem;
		min-width: 0;
	}
	.alias-editor-name,
	.alias-editor-id {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	.alias-editor-name {
		font-size: 0.86rem;
		color: rgba(255,255,255,0.92);
	}
	.alias-editor-id {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
		font-size: 0.68rem;
		color: rgba(255,255,255,0.42);
	}
	@media (max-width: 640px) {
		.alias-editor-row {
			grid-template-columns: 1fr;
		}
	}
</style>
