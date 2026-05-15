<script lang="ts">
	import StatusSummaryCard from '$lib/cards/status/StatusSummaryCard.svelte';

	type Props = {
		domains?: string[];
		ignoredEntityIds?: string[];
		statusEntityIds?: string[];
		icon?: string;
	};

	let {
		domains = ['media_player'],
		ignoredEntityIds = [],
		statusEntityIds = [],
		icon = 'mdi:audio-video'
	}: Props = $props();
</script>

<StatusSummaryCard kind="media_players_status" {domains} {ignoredEntityIds} {statusEntityIds} {icon} />
