<script lang="ts">
	import { filteredEntities } from '$lib/ha/entities-store';
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import { isDeviceButtonEntityDomain, type EntityButtonKind } from '$lib/cards/entity-button-types';
	import EntitySelectPicker from '$lib/cards/editor/EntitySelectPicker.svelte';
	import { selectedLanguageStore, translate, translateState } from '$lib/i18n';

	type Props = {
		kind: EntityButtonKind;
		entityId?: string;
		statusIcon?: string;
		iconValidationState: 'idle' | 'checking' | 'ok' | 'error';
		iconValidationMessage: string;
		iconPreviewSrc: string;
		onEntityIdChange: (value: string) => void;
		onStatusIconChange: (value: string) => void;
	};

	let {
		kind,
		entityId = '',
		statusIcon,
		iconValidationState,
		iconValidationMessage,
		iconPreviewSrc,
		onEntityIdChange,
		onStatusIconChange
	}: Props = $props();

	const defaultIcon = $derived(fallbackIcon(kind));
	const effectiveIcon = $derived((statusIcon && statusIcon.trim().length > 0) ? statusIcon.trim() : defaultIcon);
	const candidates = $derived(
		$filteredEntities.filter((entity) =>
			kind === 'device' ? isDeviceButtonEntityDomain(entity.domain) : entity.domain === kind
		)
	);
	const selectedEntity = $derived(candidates.find((entity) => entity.entityId === entityId));

	function fallbackIcon(value: EntityButtonKind) {
		if (value === 'device') return 'mdi:power-plug-outline';
		if (value === 'climate') return 'mdi:thermostat';
		if (value === 'cover') return 'mdi:curtains';
		if (value === 'vacuum') return 'mdi:robot-vacuum';
		return 'mdi:speaker';
	}

	function domainLabel(value: EntityButtonKind) {
		if (value === 'device') return translate('Apparaat entiteit', $selectedLanguageStore);
		if (value === 'climate') return translate('Climate entiteit', $selectedLanguageStore);
		if (value === 'cover') return translate('Cover entiteit', $selectedLanguageStore);
		if (value === 'vacuum') return translate('Vacuum entiteit', $selectedLanguageStore);
		return translate('Media player entiteit', $selectedLanguageStore);
	}
</script>

<div class="entity-button-editor">
	<EntitySelectPicker
		label={domainLabel(kind)}
		value={entityId ?? ''}
		options={candidates}
		placeholder={translate('Kies een entiteit', $selectedLanguageStore)}
		onChange={onEntityIdChange}
	/>

	{#if selectedEntity}
		<div class="entity-selected">
			<div class="entity-selected-icon">
				<StatusIcon icon={effectiveIcon} size={22} />
			</div>
			<div>
				<strong>{selectedEntity.friendlyName}</strong>
				<span>{translateState(selectedEntity.state, $selectedLanguageStore)}</span>
			</div>
		</div>
	{/if}

	<label class="np-field">
		<span class="np-label">{translate('MDI icoon', $selectedLanguageStore)}</span>
		<div class="icon-input-row">
			<input
				type="text"
				class="np-input"
				list="np-mdi-icon-suggestions"
				value={statusIcon ?? ''}
				placeholder={defaultIcon}
				oninput={(event) => onStatusIconChange((event.currentTarget as HTMLInputElement).value)}
			/>
			<datalist id="np-mdi-icon-suggestions">
				<option value="mdi:sofa-outline"></option>
				<option value="mdi:power-plug-outline"></option>
				<option value="mdi:toggle-switch"></option>
				<option value="mdi:thermostat"></option>
				<option value="mdi:curtains"></option>
				<option value="mdi:blinds-horizontal"></option>
				<option value="mdi:window-shutter"></option>
				<option value="mdi:robot-vacuum"></option>
				<option value="mdi:speaker"></option>
				<option value="mdi:television"></option>
				<option value="mdi:fan"></option>
				<option value="mdi:home-outline"></option>
			</datalist>
			<span class="icon-preview" aria-hidden="true">
				{#if iconPreviewSrc}
					<span class="mdi-preview" style:--icon-url={`url('${iconPreviewSrc}')`}></span>
				{:else}
					<StatusIcon icon={effectiveIcon} size={20} />
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
			{translate('Gebruik een Material Design Icon naam, bijvoorbeeld', $selectedLanguageStore)} <code>mdi:sofa-outline</code>. {translate('Sla de kaart daarna op.', $selectedLanguageStore)}
		</span>
	</label>
</div>

<style>
	.entity-button-editor {
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
	.entity-selected {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem;
		border-radius: 0.75rem;
		background: rgba(255,255,255,0.055);
		box-shadow: inset 0 0 0 1px rgba(255,255,255,0.075);
	}
	.entity-selected-icon {
		width: 2.4rem;
		height: 2.4rem;
		display: grid;
		place-items: center;
		border-radius: 0.75rem;
		color: #93c5fd;
		background: rgba(147,197,253,0.14);
	}
	.entity-selected strong,
	.entity-selected span {
		display: block;
	}
	.entity-selected strong {
		font-size: 0.9rem;
		color: rgba(255,255,255,0.9);
	}
	.entity-selected span {
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
		color: #93c5fd;
		background: rgba(147,197,253,0.13);
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
