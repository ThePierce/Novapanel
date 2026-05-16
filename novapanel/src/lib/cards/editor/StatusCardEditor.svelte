<script lang="ts">
	import EditorSection from '$lib/cards/editor/EditorSection.svelte';
	import AreaPicker from '$lib/cards/editor/AreaPicker.svelte';
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
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
		statusEntityIconOverrides?: Record<string, string>;
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
		onStatusEntityIconOverridesChange: (v: Record<string, string>) => void;
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

	const selectedEntityIds = $derived.by(() => {
		const rawIds = p.usesScopedEntityPicker
			? p.scopedPickerSelectedRows.map((row) => row.id)
			: (p.statusEntityIds ?? []);
		const seen = new Set<string>();
		return rawIds
			.map((id) => id.trim())
			.filter((id) => {
				const key = id.toLowerCase();
				if (!key || seen.has(key)) return false;
				seen.add(key);
				return true;
			});
	});
	const statusEntitiesCount = $derived(selectedEntityIds.length);
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
	const supportsEntityIconOverrides = $derived(p.cardType !== 'media_players_status');

	function normalizeIconValue(value: string | undefined): string {
		const raw = typeof value === 'string' ? value.trim() : '';
		if (!raw) return '';
		return raw.includes(':') ? raw : `mdi:${raw}`;
	}

	function defaultEntityIcon(
		entity: { entityId: string; icon?: string; deviceClass?: string } | undefined,
		fallbackName: string
	): string {
		const entityIcon = normalizeIconValue(entity?.icon);
		if (entityIcon) return entityIcon;
		if (p.cardType === 'lights_status') return 'mdi:lightbulb-outline';
		if (p.cardType === 'availability_status') return 'mdi:lan-disconnect';
		if (p.cardType === 'openings_status') {
			const deviceClass = (entity?.deviceClass ?? '').toLowerCase();
			const haystack = `${entity?.entityId ?? ''} ${fallbackName}`.toLowerCase();
			if (deviceClass.includes('garage') || haystack.includes('garage')) return 'mdi:garage';
			if (deviceClass.includes('window') || haystack.includes('window') || haystack.includes('raam')) {
				return 'mdi:window-closed-variant';
			}
			return 'mdi:door-closed';
		}
		return 'mdi:power-plug';
	}

	const aliasRows = $derived.by(() => {
		const selectedRowsById = new Map(
			p.scopedPickerSelectedRows.map((row) => [row.id.trim().toLowerCase(), row] as const)
		);
		const seen = new Set<string>();
		return selectedEntityIds
			.filter((id) => {
				const key = id.toLowerCase();
				if (seen.has(key)) return false;
				seen.add(key);
				return true;
			})
			.map((id) => {
				const entity = $filteredEntities.find((entry) => entry.entityId.toLowerCase() === id.toLowerCase());
				const pickerRow = selectedRowsById.get(id.toLowerCase());
				const originalName = entity?.friendlyName?.trim() || pickerRow?.displayName?.trim() || id;
				const aliases = p.cardType === 'media_players_status' ? (p.mediaHubPlayerAliases ?? {}) : (p.statusEntityAliases ?? {});
				const alias = aliases[id] ?? aliases[entity?.entityId ?? id] ?? '';
				const canonicalId = entity?.entityId ?? id;
				const iconOverride = p.statusEntityIconOverrides?.[canonicalId] ?? p.statusEntityIconOverrides?.[id] ?? '';
				return {
					id: canonicalId,
					originalName,
					alias: typeof alias === 'string' ? alias : '',
					iconOverride: typeof iconOverride === 'string' ? iconOverride : '',
					defaultIcon: defaultEntityIcon(entity, originalName)
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

	function updateEntityIcon(entityId: string, value: string) {
		const next = { ...(p.statusEntityIconOverrides ?? {}) };
		const trimmed = value.trim();
		if (trimmed) next[entityId] = value;
		else delete next[entityId];
		p.onStatusEntityIconOverridesChange(next);
	}

	function commitEntityIcon(entityId: string, value: string) {
		const trimmed = value.trim();
		updateEntityIcon(entityId, normalizeIconValue(trimmed));
	}

	function effectiveEntityIcon(row: { iconOverride: string; defaultIcon: string }): string {
		return normalizeIconValue(row.iconOverride) || row.defaultIcon;
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
		title={p.t(supportsEntityIconOverrides ? 'Namen en iconen' : 'Namen')}
		icon="pencil"
		tone={statusTone}
		status={aliasRows.some((row) => row.alias.trim().length > 0 || row.iconOverride.trim().length > 0) ? 'partial' : 'empty'}
		statusLabel={`${aliasRows.length} ${p.t(aliasRows.length === 1 ? 'entiteit' : 'entiteiten')}`}
	>
		<div class="np-help">{p.t(supportsEntityIconOverrides ? 'Pas hier de namen en iconen aan die Nova Panel toont. De oorspronkelijke Home Assistant naam blijft tussen haakjes zichtbaar.' : 'Pas hier de namen aan die Nova Panel toont. De oorspronkelijke Home Assistant naam blijft tussen haakjes zichtbaar.')}</div>
		{#if supportsEntityIconOverrides}
			<div class="np-help np-help-tip">
				Tip: iconen werken met <code>mdi:naam</code>, zoals <code>mdi:lightbulb</code>,
				<code>mdi:robot-vacuum-variant</code> of <code>mdi:thermometer</code>.
				Je kunt ze opzoeken via
				<a href="https://pictogrammers.com/library/mdi/" target="_blank" rel="noreferrer">pictogrammers.com/library/mdi</a>.
			</div>
		{/if}
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
					<div class="alias-editor-controls" class:single={!supportsEntityIconOverrides}>
						<input
							type="text"
							class="np-input"
							aria-label={p.t('Naam')}
							value={row.alias}
							placeholder={row.originalName}
							oninput={(event) => updateEntityAlias(row.id, (event.currentTarget as HTMLInputElement).value)}
						/>
						{#if supportsEntityIconOverrides}
							<div class="alias-icon-field">
								<span class="alias-icon-preview">
									<StatusIcon icon={effectiveEntityIcon(row)} size={18} />
								</span>
								<input
									type="text"
									class="np-input mono alias-icon-input"
									aria-label={p.t('Icoon')}
									value={row.iconOverride}
									placeholder={row.defaultIcon}
									oninput={(event) => updateEntityIcon(row.id, (event.currentTarget as HTMLInputElement).value)}
									onblur={(event) => commitEntityIcon(row.id, (event.currentTarget as HTMLInputElement).value)}
								/>
							</div>
						{/if}
					</div>
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
	.np-help-tip {
		background: rgba(96,165,250,0.07);
		border: 0.5px solid rgba(96,165,250,0.15);
		border-radius: 8px;
		padding: 8px 10px;
		font-size: 11.5px;
		color: rgba(255,255,255,0.7);
		margin-bottom: 8px;
	}
	.np-help-tip code {
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 11px;
		background: rgba(0,0,0,0.25);
		padding: 1px 5px;
		border-radius: 4px;
		color: #93c5fd;
	}
	.np-help-tip a {
		color: #60a5fa;
		text-decoration: none;
	}
	.np-help-tip a:hover {
		text-decoration: underline;
	}
	.alias-editor-list {
		display: grid;
		gap: 0.5rem;
	}
	.alias-editor-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(260px, 1.15fr);
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
	.alias-editor-controls {
		display: grid;
		grid-template-columns: minmax(140px, 1fr) minmax(126px, 0.72fr);
		gap: 0.45rem;
		min-width: 0;
	}
	.alias-editor-controls.single {
		grid-template-columns: 1fr;
	}
	.alias-icon-field {
		position: relative;
		min-width: 0;
	}
	.alias-icon-preview {
		position: absolute;
		left: 0.55rem;
		top: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.25rem;
		height: 1.25rem;
		color: rgba(255,255,255,0.72);
		transform: translateY(-50%);
		pointer-events: none;
	}
	.alias-icon-input {
		width: 100%;
		padding-left: 2.1rem;
	}
	@media (max-width: 640px) {
		.alias-editor-row {
			grid-template-columns: 1fr;
		}
		.alias-editor-controls {
			grid-template-columns: 1fr;
		}
	}
</style>
