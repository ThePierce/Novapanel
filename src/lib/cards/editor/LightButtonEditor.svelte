<script lang="ts">
	import { filteredEntities } from '$lib/ha/entities-store';
	import { areaById, areaStore } from '$lib/ha/area-store';
	import type { HomeAssistantEntity } from '$lib/ha/entities-service';
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import EntitySelectPicker from '$lib/cards/editor/EntitySelectPicker.svelte';

	type Props = {
		entityId?: string;
		statusIcon?: string;
		iconValidationState: 'idle' | 'checking' | 'ok' | 'error';
		iconValidationMessage: string;
		iconPreviewSrc: string;
		linkedLightEntityIds?: string[];
		onEntityIdChange: (value: string) => void;
		onStatusIconChange: (value: string) => void;
	};

	let {
		entityId = '',
		statusIcon = 'mdi:lightbulb-outline',
		iconValidationState,
		iconValidationMessage,
		iconPreviewSrc,
		linkedLightEntityIds = [],
		onEntityIdChange,
		onStatusIconChange
	}: Props = $props();

	const linkedLightIdSet = $derived(
		new Set(linkedLightEntityIds.map((id) => id.trim().toLowerCase()).filter(Boolean))
	);
	function isLightControlEntity(entity: HomeAssistantEntity): boolean {
		return entity.domain === 'light' || entity.domain === 'switch';
	}
	const allLightEntities = $derived.by(() => {
		if (linkedLightIdSet.size > 0) {
			return $filteredEntities.filter(
				(entity) => linkedLightIdSet.has(entity.entityId.toLowerCase()) && isLightControlEntity(entity)
			);
		}
		return $filteredEntities.filter(isLightControlEntity);
	});

	function sortLikeSidebar(entities: HomeAssistantEntity[]): HomeAssistantEntity[] {
		const areaMap = $areaStore.entityAreaMap;
		const hasAreas = $areaStore.loaded && $areaStore.areas.length > 0;
		return [...entities].sort((a, b) => {
			if (hasAreas) {
				const aAreaId = areaMap[a.entityId] ?? areaMap[a.entityId.toLowerCase()] ?? null;
				const bAreaId = areaMap[b.entityId] ?? areaMap[b.entityId.toLowerCase()] ?? null;
				const aAreaName = aAreaId ? ($areaById[aAreaId]?.name ?? aAreaId) : 'zzz';
				const bAreaName = bAreaId ? ($areaById[bAreaId]?.name ?? bAreaId) : 'zzz';
				const areaCompare = aAreaName.localeCompare(bAreaName, 'nl');
				if (areaCompare !== 0) return areaCompare;
			}
			const aName = a.friendlyName || a.entityId;
			const bName = b.friendlyName || b.entityId;
			return aName.localeCompare(bName, 'nl', { numeric: true, sensitivity: 'base' });
		});
	}

	const lightEntities = $derived.by(() => {
		let entities = linkedLightIdSet.size > 0
			? allLightEntities.filter((entity) => linkedLightIdSet.has(entity.entityId.toLowerCase()))
			: allLightEntities;
		const selectedEntity = entityId
			? (
					$filteredEntities.find((entity) => entity.entityId === entityId && isLightControlEntity(entity)) ??
					allLightEntities.find((entity) => entity.entityId === entityId)
				)
			: undefined;
		if (selectedEntity && !entities.some((entity) => entity.entityId === selectedEntity.entityId)) {
			entities = [selectedEntity, ...entities];
		}
		return sortLikeSidebar(entities);
	});
	const selectedEntity = $derived(
		$filteredEntities.find((entity) => entity.entityId === entityId && isLightControlEntity(entity)) ??
			allLightEntities.find((entity) => entity.entityId === entityId)
	);
</script>

<div class="light-button-editor">
	<EntitySelectPicker
		label="Lamp entiteit"
		value={entityId ?? ''}
		options={lightEntities}
		placeholder="Kies een lamp"
		onChange={onEntityIdChange}
	/>

	{#if selectedEntity}
		<div class="light-selected">
			<div class="light-selected-icon">
				<StatusIcon icon={statusIcon} size={22} />
			</div>
			<div>
				<strong>{selectedEntity.friendlyName}</strong>
				<span>{selectedEntity.state === 'on' ? 'Aan' : selectedEntity.state === 'off' ? 'Uit' : selectedEntity.state}</span>
			</div>
		</div>
	{/if}

	<label class="np-field">
		<span class="np-label">MDI icoon</span>
		<div class="icon-input-row">
			<input
				type="text"
				class="np-input"
				list="np-mdi-icon-suggestions"
				value={statusIcon ?? ''}
				placeholder="mdi:lightbulb-outline"
				oninput={(event) => onStatusIconChange((event.currentTarget as HTMLInputElement).value)}
			/>
			<datalist id="np-mdi-icon-suggestions">
				<option value="mdi:lightbulb-outline"></option>
				<option value="mdi:floor-lamp-outline"></option>
				<option value="mdi:ceiling-light-outline"></option>
				<option value="mdi:led-strip-variant"></option>
				<option value="mdi:sofa-outline"></option>
				<option value="mdi:table-chair"></option>
				<option value="mdi:home-outline"></option>
				<option value="mdi:lamp-outline"></option>
			</datalist>
			<span class="icon-preview" aria-hidden="true">
				{#if iconPreviewSrc}
					<span class="mdi-preview" style:--icon-url={`url('${iconPreviewSrc}')`}></span>
				{:else}
					<StatusIcon icon={statusIcon} size={20} />
				{/if}
			</span>
		</div>
		<span class={`icon-validation ${iconValidationState}`}>
			<TablerIcon
				name={iconValidationState === 'ok' ? 'circle-check' : iconValidationState === 'error' ? 'alert-circle' : 'loader-2'}
				size={13}
			/>
			{iconValidationMessage}
		</span>
		<span class="icon-help">
			Gebruik een Material Design Icon naam, bijvoorbeeld <code>mdi:sofa-outline</code>. Sla de kaart daarna op.
		</span>
	</label>
</div>

<style>
	.light-button-editor {
		display: grid;
		gap: 0.7rem;
	}
	.np-field {
		display: grid;
		gap: 0.4rem;
	}
	.np-label {
		font-size: 0.78rem;
		font-weight: 700;
		color: rgba(255,255,255,0.68);
	}
	.np-input {
		width: 100%;
		height: 2.45rem;
		border: 1px solid rgba(255,255,255,0.09);
		border-radius: 0.55rem;
		background: rgba(255,255,255,0.075);
		color: #f5f5f5;
		padding: 0 0.75rem;
		font: inherit;
		box-sizing: border-box;
	}
	.light-selected {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem;
		border-radius: 0.75rem;
		background: rgba(255,211,56,0.08);
		box-shadow: inset 0 0 0 1px rgba(255,211,56,0.14);
	}
	.light-selected-icon {
		width: 2.4rem;
		height: 2.4rem;
		display: grid;
		place-items: center;
		border-radius: 0.75rem;
		color: #ffd338;
		background: rgba(255,211,56,0.16);
	}
	.light-selected strong,
	.light-selected span {
		display: block;
	}
	.light-selected strong {
		font-size: 0.9rem;
		color: rgba(255,255,255,0.9);
	}
	.light-selected span {
		margin-top: 0.12rem;
		font-size: 0.75rem;
		color: rgba(255,255,255,0.52);
	}
	.icon-input-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.5rem;
		align-items: center;
	}
	.icon-preview {
		width: 2.45rem;
		height: 2.45rem;
		display: grid;
		place-items: center;
		border-radius: 0.55rem;
		color: #ffd338;
		background: rgba(255,211,56,0.13);
	}
	.mdi-preview {
		width: 20px;
		height: 20px;
		display: block;
		background: currentColor;
		-webkit-mask: var(--icon-url) center / contain no-repeat;
		mask: var(--icon-url) center / contain no-repeat;
	}
	.icon-validation {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 1.1rem;
		font-size: 0.76rem;
		color: rgba(255,255,255,0.58);
	}
	.icon-validation.ok {
		color: #86efac;
	}
	.icon-validation.error {
		color: #fca5a5;
	}
	.icon-validation.checking {
		color: #fde68a;
	}
	.icon-help {
		font-size: 0.72rem;
		line-height: 1.25;
		color: rgba(255,255,255,0.48);
	}
	.icon-help code {
		color: rgba(255,255,255,0.78);
		background: rgba(255,255,255,0.08);
		border-radius: 0.3rem;
		padding: 0.06rem 0.24rem;
	}
</style>
