<script lang="ts">
	import { tick } from 'svelte';
	import EditorSection from '$lib/cards/editor/EditorSection.svelte';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import { filteredEntities } from '$lib/ha/entities-store';
	import type { CameraConfig } from '$lib/persistence/panel-state-types';

	type Props = {
		cameras?: CameraConfig[];
		onCamerasChange: (value: CameraConfig[]) => void;
	};

	let { cameras = [], onCamerasChange }: Props = $props();

	const cameraEntities = $derived(
		$filteredEntities.filter((e) => e.domain === 'camera')
	);

	function entityLabel(entityId: string): string {
		const ent = cameraEntities.find((e) => e.entityId === entityId);
		return ent?.friendlyName || entityId;
	}

	let pickerOpen = $state(false);
	let cameraSearchQuery = $state('');
	let cameraScrollEl = $state<HTMLDivElement | null>(null);

	async function scrollCameraEditorToBottom() {
		await tick();
		const el = cameraScrollEl;
		if (!el) return;
		requestAnimationFrame(() => {
			el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
		});
	}

	function addCamera(entityId: string) {
		const exists = cameras.some((c) => c.entityId === entityId);
		if (exists) return;
		onCamerasChange([...cameras, { entityId, isLarge: false, useAdvanced: false }]);
		void scrollCameraEditorToBottom();
	}

	function removeCamera(idx: number) {
		const next = cameras.filter((_, i) => i !== idx);
		onCamerasChange(next);
	}

	function moveCamera(idx: number, dir: -1 | 1) {
		const target = idx + dir;
		if (target < 0 || target >= cameras.length) return;
		const next = [...cameras];
		[next[idx], next[target]] = [next[target], next[idx]];
		onCamerasChange(next);
	}

	function updateCamera(idx: number, patch: Partial<CameraConfig>) {
		const next = cameras.map((c, i) => (i === idx ? { ...c, ...patch } : c));
		onCamerasChange(next);
	}

	const status = $derived((() => {
		if (cameras.length === 0) return { status: 'required' as const, label: "geen camera's" };
		const large = cameras.filter((c) => c.isLarge).length;
		return { status: 'filled' as const, label: `${cameras.length} camera${cameras.length === 1 ? '' : "'s"} · ${large} groot` };
	})());

	const availableEntities = $derived(
		cameraEntities.filter((e) => !cameras.some((c) => c.entityId === e.entityId))
	);
	const filteredAvailableEntities = $derived.by(() => {
		const query = cameraSearchQuery.trim().toLowerCase();
		if (query.length === 0) return availableEntities;
		return availableEntities.filter((entity) =>
			entity.friendlyName.toLowerCase().includes(query) ||
			entity.entityId.toLowerCase().includes(query)
		);
	});
</script>

<EditorSection title="Camera's" icon="device-cctv" tone="blue" status={status.status} statusLabel={status.label} open>
	<div class="camera-editor-scroll" bind:this={cameraScrollEl}>
		<div class="np-help">Voeg camera-entiteiten toe en bepaal welke groot worden weergegeven (Apple Home stijl). Zet Advanced Camera Card aan voor de HA custom-card; extra YAML is optioneel.</div>

		{#if cameras.length === 0}
			<div class="cameras-empty">Nog geen camera's geselecteerd.</div>
		{:else}
			<div class="cameras-list">
				{#each cameras as cam, idx (cam.entityId)}
					<div class="camera-item">
						<div class="camera-item-head">
							<div class="camera-item-icon">
								<TablerIcon name="device-cctv" size={16} />
							</div>
							<div class="camera-item-info">
								<div class="camera-item-name">
									{cam.alias && cam.alias.trim().length > 0 ? cam.alias : entityLabel(cam.entityId)}
								</div>
							</div>
							<div class="camera-item-order">
								<button type="button" class="np-mini-btn ghost" disabled={idx === 0} onclick={() => moveCamera(idx, -1)} aria-label="Omhoog">
									<TablerIcon name="arrow-up" size={13} />
								</button>
								<button type="button" class="np-mini-btn ghost" disabled={idx === cameras.length - 1} onclick={() => moveCamera(idx, 1)} aria-label="Omlaag">
									<TablerIcon name="arrow-down" size={13} />
								</button>
								<button type="button" class="np-mini-btn ghost danger" onclick={() => removeCamera(idx)} aria-label="Verwijderen">
									<TablerIcon name="trash" size={13} />
								</button>
							</div>
						</div>
						<div class="camera-item-fields">
							<label class="np-field">
								<span class="np-label">Naam <span class="np-hint">(optioneel)</span></span>
								<input
									type="text"
									class="np-input"
									value={cam.alias ?? ''}
									placeholder={entityLabel(cam.entityId)}
									oninput={(e) => updateCamera(idx, { alias: (e.currentTarget as HTMLInputElement).value })}
								/>
							</label>
							<div class="camera-item-toggles">
								<label class="camera-toggle">
									<input
										type="checkbox"
										checked={cam.isLarge ?? false}
										onchange={(e) => updateCamera(idx, { isLarge: (e.currentTarget as HTMLInputElement).checked })}
									/>
									<span class="camera-toggle-label">
										<TablerIcon name="layout-grid" size={13} />
										Groot weergeven
									</span>
								</label>
								<label class="camera-toggle">
									<input
										type="checkbox"
										checked={cam.useAdvanced ?? false}
										onchange={(e) => updateCamera(idx, { useAdvanced: (e.currentTarget as HTMLInputElement).checked })}
									/>
									<span class="camera-toggle-label">
										<TablerIcon name="cards" size={13} />
										Advanced Camera Card
									</span>
								</label>
							</div>
							{#if cam.useAdvanced}
								<label class="np-field camera-advanced-field">
									<span class="np-label">Advanced Camera Card config <span class="np-hint">(YAML)</span></span>
									<textarea
										class="np-input mono camera-advanced-config"
										rows="6"
										value={cam.advancedConfig ?? ''}
										placeholder={'type: custom:advanced-camera-card\ncameras:\n  - camera_entity: ' + cam.entityId + '\nlive:\n  auto_play:\n    - visible\n    - selected\n  auto_unmute:\n    - visible\n    - selected\n  show_image_during_load: true'}
										oninput={(e) => updateCamera(idx, { advancedConfig: (e.currentTarget as HTMLTextAreaElement).value })}
									></textarea>
								</label>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<div class="cameras-add">
			<button type="button" class="np-mini-btn primary" onclick={() => (pickerOpen = !pickerOpen)} disabled={availableEntities.length === 0}>
				<TablerIcon name="plus" size={13} />
				Camera toevoegen ({availableEntities.length})
			</button>
			{#if pickerOpen}
				<div class="cameras-picker">
					<div class="entity-search-bar">
						<TablerIcon name="search" size={14} />
						<input
							type="text"
							placeholder="Zoek in entiteiten..."
							bind:value={cameraSearchQuery}
						/>
						{#if cameraSearchQuery}
							<button
								type="button"
								aria-label="Zoekterm wissen"
								onclick={() => (cameraSearchQuery = '')}
							>
								<TablerIcon name="x" size={12} />
							</button>
						{/if}
					</div>
					{#if availableEntities.length === 0}
						<div class="cameras-empty-small">Alle camera-entiteiten zijn al toegevoegd.</div>
					{:else if filteredAvailableEntities.length === 0}
						<div class="cameras-empty-small">Geen camera-entiteiten gevonden.</div>
					{:else}
						{#each filteredAvailableEntities as ent (ent.entityId)}
							<button
								type="button"
								class="camera-picker-row"
								onclick={() => {
									addCamera(ent.entityId);
									pickerOpen = false;
								}}
							>
								<TablerIcon name="device-cctv" size={14} />
								<div class="camera-picker-name">{ent.friendlyName || ent.entityId}</div>
							</button>
						{/each}
					{/if}
				</div>
			{/if}
		</div>
	</div>
</EditorSection>

<style>
	.np-help,
	.camera-editor-scroll,
	.cameras-empty,
	.cameras-empty-small,
	.cameras-list,
	.camera-item,
	.camera-item-fields,
	.cameras-add,
	.cameras-picker {
		min-width: 0;
		max-width: 100%;
		box-sizing: border-box;
	}
	.camera-editor-scroll {
		display: flex;
		flex-direction: column;
		gap: 11px;
		max-height: min(62dvh, 34rem);
		overflow-x: hidden;
		overflow-y: auto;
		padding-right: 2px;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		touch-action: pan-y;
	}
	.np-help {
		font-size: 11px;
		color: rgba(255,255,255,0.45);
		line-height: 1.4;
		overflow-wrap: anywhere;
	}
	.cameras-empty {
		text-align: center;
		padding: 22px 12px;
		color: rgba(255,255,255,0.45);
		font-size: 13px;
		border: 0.5px dashed rgba(255,255,255,0.10);
		border-radius: 10px;
	}
	.cameras-empty-small {
		padding: 14px;
		color: rgba(255,255,255,0.45);
		font-size: 12.5px;
		text-align: center;
	}
	.cameras-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.camera-item {
		background: rgba(255,255,255,0.025);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 12px;
		padding: 12px;
	}
	.camera-item-head {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		gap: 10px;
		align-items: center;
		min-width: 0;
	}
	.camera-item-icon {
		width: 28px; height: 28px;
		border-radius: 8px;
		display: grid; place-items: center;
		background: rgba(96,165,250,0.15);
		color: #60a5fa;
		flex-shrink: 0;
	}
	.camera-item-info { min-width: 0; }
	.camera-item-name {
		font-size: 13.5px;
		font-weight: 500;
		color: #f5f5f5;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.camera-item-order {
		display: flex;
		gap: 4px;
		min-width: 0;
	}
	.camera-item-fields {
		display: flex;
		flex-direction: column;
		gap: 10px;
		margin-top: 12px;
	}
	.np-field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
	}
	.np-label {
		display: block;
		font-size: 10.5px;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: rgba(255,255,255,0.5);
		font-weight: 500;
	}
	.np-hint {
		text-transform: none;
		letter-spacing: normal;
		opacity: 0.7;
	}
	.np-input {
		width: 100%;
		min-width: 0;
		box-sizing: border-box;
		height: auto;
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 9px;
		background: rgba(255,255,255,0.04);
		color: #f5f5f5;
		padding: 9px 11px;
		font-size: 13px;
		font-family: inherit;
	}
	.np-input:focus {
		outline: none;
		border-color: rgba(96,165,250,0.45);
		background: rgba(96,165,250,0.06);
		box-shadow: 0 0 0 3px rgba(96,165,250,0.08);
	}
	.camera-item-toggles {
		display: flex;
		flex-wrap: wrap;
		gap: 14px;
		min-width: 0;
	}
	.camera-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		user-select: none;
		min-width: 0;
	}
	.camera-toggle input {
		accent-color: #60a5fa;
		width: 14px; height: 14px;
		cursor: pointer;
	}
	.camera-toggle-label {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 12.5px;
		color: rgba(255,255,255,0.75);
	}
	.camera-advanced-config {
		display: block;
		width: 100%;
		max-width: none;
		font-family: ui-monospace, 'SF Mono', monospace;
		font-size: 12px;
		line-height: 1.45;
		resize: vertical;
		min-height: 240px;
		white-space: pre;
		overflow: auto;
	}
	:global(.np-mini-btn.danger) {
		color: #f87171;
	}
	.cameras-add {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: 12px;
	}
	.cameras-add :global(.np-mini-btn) {
		width: 100%;
		min-width: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 5px;
		white-space: normal;
	}
	.cameras-picker {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-height: 220px;
		overflow-y: auto;
		overflow-x: hidden;
		background: rgba(0,0,0,0.25);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 10px;
		padding: 6px;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
	}
	.entity-search-bar {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.45rem;
		margin-bottom: 6px;
		padding: 0.45rem 0.55rem;
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 0.65rem;
		background: rgba(255,255,255,0.045);
	}
	.entity-search-bar :global(i) {
		color: rgba(255,255,255,0.4);
	}
	.entity-search-bar input {
		min-width: 0;
		border: 0;
		outline: 0;
		background: transparent;
		color: rgba(255,255,255,0.84);
		font: inherit;
		font-size: 0.78rem;
	}
	.entity-search-bar input::placeholder {
		color: rgba(255,255,255,0.35);
	}
	.entity-search-bar button {
		width: 1.45rem;
		height: 1.45rem;
		border: 0;
		border-radius: 0.45rem;
		display: grid;
		place-items: center;
		background: rgba(255,255,255,0.08);
		color: rgba(255,255,255,0.62);
		cursor: pointer;
	}
	.camera-picker-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		gap: 10px;
		align-items: center;
		padding: 8px 10px;
		background: transparent;
		border: 0;
		color: #f5f5f5;
		cursor: pointer;
		border-radius: 7px;
		text-align: left;
		transition: background 0.15s;
		min-width: 0;
		max-width: 100%;
		box-sizing: border-box;
	}
	.camera-picker-row:hover { background: rgba(255,255,255,0.05); }
	.camera-picker-name {
		font-size: 13px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	@container (max-width: 30rem) {
		.camera-item-head {
			grid-template-columns: auto minmax(0, 1fr);
		}
		.camera-item-order {
			grid-column: 1 / -1;
			justify-content: flex-end;
			flex-wrap: wrap;
		}
		.camera-picker-row {
			grid-template-columns: auto minmax(0, 1fr);
			gap: 4px 9px;
		}
	}
	@media (max-width: 520px) {
		.camera-item-head {
			grid-template-columns: auto minmax(0, 1fr);
		}
		.camera-item-order {
			grid-column: 1 / -1;
			justify-content: flex-end;
			flex-wrap: wrap;
		}
		.camera-picker-row {
			grid-template-columns: auto minmax(0, 1fr);
			gap: 4px 9px;
		}
	}
</style>
