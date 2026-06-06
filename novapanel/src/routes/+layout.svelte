<script lang="ts">
	import '@tabler/icons-webfont/dist/tabler-icons.min.css';

	interface Props {
		children?: import('svelte').Snippet;
	}

	let { children }: Props = $props();
</script>

<svelte:head>
	<title>Nova Panel</title>
	<meta name="description" content="Nova Panel" />
	<meta charset="utf-8" />
</svelte:head>

{@render children?.()}

<style>
	:global(html, body) {
		margin: 0;
		padding: 0;
		height: 100%;
		min-height: 100vh;
		min-height: 100dvh;
		overflow: hidden;
		font-family: sans-serif;
		background: #0f1115;
		color: #f5f5f5;
	}

	:global(*, *::before, *::after) {
		box-sizing: border-box;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(*),
		:global(*::before),
		:global(*::after) {
			animation-delay: 0ms !important;
			animation-duration: 1ms !important;
			animation-iteration-count: 1 !important;
			scroll-behavior: auto !important;
			transition-delay: 0ms !important;
			transition-duration: 1ms !important;
		}
	}

	:global(html),
	:global(body),
	:global(*) {
		scrollbar-width: none !important;
		-ms-overflow-style: none !important;
	}

	:global(html::-webkit-scrollbar),
	:global(body::-webkit-scrollbar),
	:global(*::-webkit-scrollbar) {
		width: 0 !important;
		height: 0 !important;
		display: none !important;
		background: transparent !important;
	}

	:global(*::-webkit-scrollbar-track),
	:global(*::-webkit-scrollbar-thumb),
	:global(*::-webkit-scrollbar-corner) {
		display: none !important;
		background: transparent !important;
	}
</style>
