<script lang="ts">
	import { filteredEntities } from '$lib/ha/entities-store';
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
	import IconChoiceField from '$lib/cards/editor/IconChoiceField.svelte';
	import { isDeviceButtonEntityDomain, type EntityButtonKind } from '$lib/cards/entity-button-types';
	import EntitySelectPicker from '$lib/cards/editor/EntitySelectPicker.svelte';
	import { selectedLanguageStore, translate, translateState } from '$lib/i18n';

	type Props = {
		kind: EntityButtonKind;
		entityId?: string;
		statusIcon?: string;
		iconValidationState: 'idle' | 'checking' | 'ok' | 'error';
		iconValidationMessage: string;
		onEntityIdChange: (value: string) => void;
		onStatusIconChange: (value: string) => void;
	};

	let {
		kind,
		entityId = '',
		statusIcon,
		iconValidationState,
		iconValidationMessage,
		onEntityIdChange,
		onStatusIconChange
	}: Props = $props();

	const defaultIcon = $derived(fallbackIcon(kind));
	const effectiveIcon = $derived(
		statusIcon && statusIcon.trim().length > 0 ? statusIcon.trim() : defaultIcon
	);
	const candidates = $derived(
		$filteredEntities.filter((entity) =>
			kind === 'device' ? isDeviceButtonEntityDomain(entity.domain) : entity.domain === kind
		)
	);
	const selectedEntity = $derived(candidates.find((entity) => entity.entityId === entityId));
	const iconChoices = $derived.by(() => {
		if (kind === 'device') {
			return [
				{ icon: 'mdi:power-plug-outline', label: 'Plug' },
				{ icon: 'mdi:toggle-switch', label: 'Schakelaar' },
				{ icon: 'mdi:fan', label: 'Ventilator' },
				{ icon: 'mdi:television', label: 'TV' },
				{ icon: 'mdi:lock-outline', label: 'Slot' },
				{ icon: 'mdi:server-network', label: 'Netwerk' },
				{ icon: 'mdi:home-outline', label: 'Home' },
				{ icon: 'mdi:robot', label: 'Robot' }
			];
		}
		if (kind === 'climate') {
			return [
				{ icon: 'mdi:thermostat', label: 'Thermostaat' },
				{ icon: 'mdi:home-thermometer-outline', label: 'Woning' },
				{ icon: 'mdi:radiator', label: 'Radiator' },
				{ icon: 'mdi:fan', label: 'Ventilator' },
				{ icon: 'mdi:snowflake', label: 'Koelen' },
				{ icon: 'mdi:fire', label: 'Warmte' }
			];
		}
		if (kind === 'cover') {
			return [
				{ icon: 'mdi:blinds-horizontal', label: 'Jaloezie' },
				{ icon: 'mdi:blinds-horizontal-closed', label: 'Dicht' },
				{ icon: 'mdi:window-shutter', label: 'Rolluik' },
				{ icon: 'mdi:window-shutter-open', label: 'Open' },
				{ icon: 'mdi:curtains', label: 'Gordijn' },
				{ icon: 'mdi:garage', label: 'Garage' }
			];
		}
		if (kind === 'vacuum') {
			return [
				{ icon: 'mdi:robot-vacuum', label: 'Vacuum' },
				{ icon: 'mdi:robot-vacuum-variant', label: 'Variant' },
				{ icon: 'mdi:robot', label: 'Robot' },
				{ icon: 'mdi:home-map-marker', label: 'Map' }
			];
		}
		return [
			{ icon: 'mdi:speaker', label: 'Speaker' },
			{ icon: 'mdi:speaker-wireless', label: 'Wireless' },
			{ icon: 'mdi:television', label: 'TV' },
			{ icon: 'mdi:cast', label: 'Cast' },
			{ icon: 'mdi:audio-video', label: 'AV' },
			{ icon: 'mdi:music', label: 'Muziek' }
		];
	});

	function fallbackIcon(value: EntityButtonKind) {
		if (value === 'device') return 'mdi:power-plug-outline';
		if (value === 'climate') return 'mdi:thermostat';
		if (value === 'cover') return 'mdi:blinds-horizontal';
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

	<IconChoiceField
		label={translate('Icoon', $selectedLanguageStore)}
		value={statusIcon ?? ''}
		placeholder={defaultIcon}
		choices={iconChoices}
		validationState={iconValidationState}
		validationMessage={iconValidationMessage}
		help={`${translate('Gebruik een Material Design Icon naam, bijvoorbeeld', $selectedLanguageStore)} mdi:sofa-outline. ${translate('Sla de kaart daarna op.', $selectedLanguageStore)}`}
		onChange={onStatusIconChange}
	/>
</div>

<style>
	.entity-button-editor {
		display: grid;
		gap: 0.7rem;
	}
	.entity-selected {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		padding: 0.7rem;
		border-radius: 0.75rem;
		background: rgba(255, 255, 255, 0.055);
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.075);
	}
	.entity-selected-icon {
		width: 2.4rem;
		height: 2.4rem;
		display: grid;
		place-items: center;
		border-radius: 0.75rem;
		color: #93c5fd;
		background: rgba(147, 197, 253, 0.14);
	}
	.entity-selected strong,
	.entity-selected span {
		display: block;
	}
	.entity-selected strong {
		font-size: 0.9rem;
		color: rgba(255, 255, 255, 0.9);
	}
	.entity-selected span {
		margin-top: 0.12rem;
		font-size: 0.75rem;
		color: rgba(255, 255, 255, 0.52);
	}
</style>
