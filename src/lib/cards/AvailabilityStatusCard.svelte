<script lang="ts">
	import StatusSummaryCard from '$lib/cards/status/StatusSummaryCard.svelte';

	type Props = {
		domains?: string[];
		ignoredEntityIds?: string[];
	statusEntityIds?: string[];
		icon?: string;
	};

let { domains = ['all'], ignoredEntityIds = [], statusEntityIds = [], icon = 'availability' }: Props = $props();
</script>

<StatusSummaryCard kind="availability_status" {domains} {ignoredEntityIds} {statusEntityIds} {icon} />
