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
	<script type="module" src="https://code.iconify.design/iconify-icon/2.1.0/iconify-icon.min.js"></script>
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
