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
		domains = ['switch', 'light', 'fan', 'media_player', 'climate', 'lock'],
		deviceClasses = [],
		ignoredEntityIds = [],
		statusEntityIds = [],
		statusEntityAliases = {},
		icon = 'plug'
	}: Props = $props();
</script>

<StatusSummaryCard
	kind="devices_status"
	{domains}
	{deviceClasses}
	{ignoredEntityIds}
	{statusEntityIds}
	{statusEntityAliases}
	{icon}
/>
