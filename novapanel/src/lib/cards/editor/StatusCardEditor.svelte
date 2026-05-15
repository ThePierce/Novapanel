<script lang="ts">
	import EditorSection from '$lib/cards/editor/EditorSection.svelte';
	import AreaPicker from '$lib/cards/editor/AreaPicker.svelte';

	type Row = { id: string; label: string; displayName: string };
	type CardType = 'lights_status' | 'openings_status' | 'devices_status' | 'availability_status' | 'media_players_status';
	type Tone = 'gold' | 'blue' | 'green' | 'cyan' | 'purple';
	type Status = 'required' | 'filled' | 'partial' | 'empty';

	type Props = {
		t: (key: string) => string;
		cardType: CardType;
		statusDomains?: string[];
		statusEntityIds?: string[];
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
</script>

<EditorSection
	title="Welke entiteiten"
	icon="target"
	tone={statusTone}
	status={statusFilterStatus.status}
	statusLabel={statusFilterStatus.label}
	open
>
	<div class="np-help">Kies de domeinen die meetellen, en/of selecteer specifieke entiteiten handmatig.</div>
	<div class="np-field">
		<span class="np-label">Domeinen <span class="np-hint">(komma-gescheiden)</span></span>
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
			<span class="np-label">Icoon <span class="np-hint">(MDI naam, bv. lightbulb)</span></span>
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

{#if p.cardType === 'openings_status'}
	<EditorSection
		title="Device classes"
		icon="filter"
		tone="blue"
		status={openingsClassesStatus.status}
		statusLabel={openingsClassesStatus.label}
	>
		<div class="np-help">Optioneel. Beperk tot specifieke device classes (door, window, garage…).</div>
		<div class="np-field">
			<span class="np-label">Classes <span class="np-hint">(komma-gescheiden)</span></span>
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
