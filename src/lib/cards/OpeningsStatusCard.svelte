<script lang="ts">
	import StatusSummaryCard from '$lib/cards/status/StatusSummaryCard.svelte';

	type Props = {
		domains?: string[];
		deviceClasses?: string[];
		ignoredEntityIds?: string[];
		statusEntityIds?: string[];
		icon?: string;
	};

	let {
		domains = ['binary_sensor'],
		deviceClasses = ['door', 'window', 'opening'],
		ignoredEntityIds = [],
		statusEntityIds = [],
		icon = 'door_open'
	}: Props = $props();
</script>

<StatusSummaryCard
	kind="openings_status"
	{domains}
	{deviceClasses}
	{ignoredEntityIds}
	{statusEntityIds}
	{icon}
/>
