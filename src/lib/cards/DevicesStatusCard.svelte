<script lang="ts">
	import StatusSummaryCard from '$lib/cards/status/StatusSummaryCard.svelte';

	type Props = {
		domains?: string[];
		ignoredEntityIds?: string[];
		statusEntityIds?: string[];
		icon?: string;
	};

	let {
		domains = ['switch', 'light', 'fan', 'media_player', 'climate'],
		ignoredEntityIds = [],
		statusEntityIds = [],
		icon = 'plug'
	}: Props = $props();
</script>

<StatusSummaryCard kind="devices_status" {domains} {ignoredEntityIds} {statusEntityIds} {icon} />
