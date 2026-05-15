<script lang="ts">
	import TablerIcon from '$lib/icons/TablerIcon.svelte';

	type EntityOption = {
		entityId: string;
		friendlyName: string;
	};

	type Props = {
		label: string;
		value?: string;
		options: EntityOption[];
		placeholder?: string;
		searchPlaceholder?: string;
		onChange: (value: string) => void;
	};

	let {
		label,
		value = '',
		options,
		placeholder = 'Kies een entiteit',
		searchPlaceholder = 'Zoek in entiteiten...',
		onChange
	}: Props = $props();

	let searchQuery = $state('');

	function optionLabel(option: EntityOption) {
		const name = option.friendlyName?.trim();
		return name && name.length > 0 ? name : option.entityId;
	}

	const filteredOptions = $derived.by(() => {
		const query = searchQuery.trim().toLowerCase();
		const filtered =
			query.length === 0
				? options
				: options.filter((option) =>
						optionLabel(option).toLowerCase().includes(query) ||
						option.entityId.toLowerCase().includes(query)
					);
		const selected = value ? options.find((option) => option.entityId === value) : undefined;
		if (selected && !filtered.some((option) => option.entityId === selected.entityId)) {
			return [selected, ...filtered];
		}
		return filtered;
	});
</script>

<label class="np-field entity-select-picker">
	<span class="np-label">{label}</span>
	<div class="entity-search-bar">
		<TablerIcon name="search" size={14} />
		<input
			type="text"
			placeholder={searchPlaceholder}
			bind:value={searchQuery}
		/>
		{#if searchQuery}
			<button
				type="button"
				aria-label="Zoekterm wissen"
				onclick={() => (searchQuery = '')}
			>
				<TablerIcon name="x" size={12} />
			</button>
		{/if}
	</div>
	<select
		value={value ?? ''}
		onchange={(event) => onChange((event.currentTarget as HTMLSelectElement).value)}
	>
		<option value="">{placeholder}</option>
		{#each filteredOptions as option (option.entityId)}
			<option value={option.entityId}>{optionLabel(option)}</option>
		{/each}
	</select>
</label>

<style>
	.np-field {
		display: grid;
		gap: 0.4rem;
	}
	.np-label {
		font-size: 0.78rem;
		font-weight: 700;
		color: rgba(255,255,255,0.68);
	}
	select {
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
	.entity-search-bar {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr) auto;
		align-items: center;
		gap: 0.45rem;
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
</style>
