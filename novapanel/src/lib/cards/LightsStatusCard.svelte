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
	// All entity IDs that are part of a group - these are "hidden" in favor of the group
	const groupedEntityIds = $derived(new Set(lightGroups.flatMap((g) => g.entityIds)));
	// Extra "virtual" entity IDs: groups are represented as their first member for filtering
	// The real grouping happens in the details modal
</script>

<StatusSummaryCard
	kind="lights_status"
	{domains}
	{deviceClasses}
	{ignoredEntityIds}
	{statusEntityIds}
	{statusEntityAliases}
	{icon}
	{cardId}
	{lightGroups}
/>
