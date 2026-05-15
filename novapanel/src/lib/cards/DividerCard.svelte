<script lang="ts">
	type Props = {
		mode?: 'line' | 'empty';
		size?: number;
		editable?: boolean;
	};

	let { mode = 'line', size = 50, editable = false }: Props = $props();
</script>

{#if mode === 'empty'}
	<div class="empty" style:height={`${size}px`} style:opacity={editable ? '1' : '0'}></div>
{:else}
	<div class="hr-padding">
		<hr />
	</div>
{/if}

<style>
	.hr-padding {
		padding: 0.55rem 0.65rem;
	}

	hr {
		padding: 0;
		margin: 0;
		border: 0;
		height: 0;
		border-top: 1px solid rgba(0, 0, 0, 0.1);
		border-bottom: 1px solid rgba(255, 255, 255, 0.12);
	}

	.empty {
		border-radius: 0.6rem;
		background-color: rgba(255, 255, 255, 0.08);
		outline: 2px dashed rgba(255, 255, 255, 0.7);
		outline-offset: -2px;
	}
</style>
