<script lang="ts">
	import StatusSummaryCard from '$lib/cards/status/StatusSummaryCard.svelte';

	type Props = {
		domains?: string[];
		deviceClasses?: string[];
		ignoredEntityIds?: string[];
		statusEntityIds?: string[];
		statusEntityAliases?: Record<string, string>;
		icon?: string;
	};

	let {
		domains = ['all'],
		deviceClasses = [],
		ignoredEntityIds = [],
		statusEntityIds = [],
		statusEntityAliases = {},
		icon = 'availability'
	}: Props = $props();
</script>

<StatusSummaryCard
	kind="availability_status"
	{domains}
	{deviceClasses}
	{ignoredEntityIds}
	{statusEntityIds}
	{statusEntityAliases}
	{icon}
/>
