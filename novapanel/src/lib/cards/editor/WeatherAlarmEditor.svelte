<script lang="ts">
	import EditorSection from '$lib/cards/editor/EditorSection.svelte';
	import EntitySelectPicker from '$lib/cards/editor/EntitySelectPicker.svelte';

	type Entity = { entityId: string; friendlyName: string };

	type Props = {
		t: (key: string) => string;
		isAlarm: boolean;
		entityId?: string;
		entities: Entity[];
		onEntityIdChange: (v: string) => void;
	};

	let p: Props = $props();
</script>

<EditorSection
	title={p.isAlarm ? 'Alarm-entiteit' : 'Weer-entiteit'}
	icon={p.isAlarm ? 'shield-lock' : 'cloud'}
	tone={p.isAlarm ? 'rose' : 'cyan'}
	status={p.entityId ? 'filled' : 'required'}
	statusLabel={p.entityId ? 'gekoppeld' : 'vereist'}
	open
>
	<div class="np-help">{p.isAlarm ? 'Selecteer het alarm_control_panel uit Home Assistant.' : 'Selecteer een weer-entiteit uit Home Assistant.'}</div>
	<EntitySelectPicker
		label="Kies uit beschikbare entiteiten"
		value={p.entityId ?? ''}
		options={p.entities}
		placeholder="-"
		onChange={p.onEntityIdChange}
	/>
	<div class="np-field">
		<span class="np-label">Of typ handmatig</span>
		<input
			type="text"
			class="np-input mono"
			value={p.entityId ?? ''}
			placeholder={p.isAlarm ? 'alarm_control_panel.home_alarm' : 'weather.home'}
			oninput={(event) => p.onEntityIdChange((event.currentTarget as HTMLInputElement).value)}
		/>
	</div>
</EditorSection>
