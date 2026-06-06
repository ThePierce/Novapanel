<script lang="ts">
	import StatusSummaryCard from '$lib/cards/status/StatusSummaryCard.svelte';
	import { browser } from '$app/environment';
	import { loadLightGroups } from '$lib/cards/light-groups';

	type Props = {
		cardId?: string;
		domains?: string[];
		deviceClasses?: string[];
		ignoredEntityIds?: string[];
		statusEntityIds?: string[];
		statusEntityAliases?: Record<string, string>;
		icon?: string;
	};

	let {
		cardId = '',
		domains = ['light'],
		deviceClasses = [],
		ignoredEntityIds = [],
		statusEntityIds = [],
		statusEntityAliases = {},
		icon = 'lightbulb'
	}: Props = $props();

	// Load groups for this card - reactive to cardId
	const lightGroups = $derived(browser && cardId ? loadLightGroups(cardId) : []);
</script>

<StatusSummaryCard
	kind="lights_status"
	{domains}
	{deviceClasses}
	{ignoredEntityIds}
	{statusEntityIds}
	{statusEntityAliases}
	{icon}
	{lightGroups}
/>
