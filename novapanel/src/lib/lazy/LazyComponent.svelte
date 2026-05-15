<script lang="ts">
	import type { Component } from 'svelte';

	type ComponentLoader = () => Promise<{ default: Component<any> }>;

	let {
		loader,
		props = {}
	}: {
		loader: ComponentLoader;
		props?: Record<string, unknown>;
	} = $props();

	let component = $state<Component<any> | null>(null);
	let loadError = $state<unknown>(null);
	let loadId = 0;

	$effect(() => {
		const currentLoad = ++loadId;
		component = null;
		loadError = null;
		loader()
			.then((module) => {
				if (currentLoad !== loadId) return;
				component = module.default;
			})
			.catch((error) => {
				if (currentLoad !== loadId) return;
				loadError = error;
			});
	});
</script>

{#if component}
	{@const Component = component}
	<Component {...props} />
{:else if loadError}
	<div class="lazy-component-error" role="alert">Component kon niet worden geladen.</div>
{/if}

<style>
	.lazy-component-error {
		position: fixed;
		inset: 50% auto auto 50%;
		z-index: 9999;
		transform: translate(-50%, -50%);
		padding: 0.9rem 1rem;
		border: 1px solid rgba(248, 113, 113, 0.28);
		border-radius: 16px;
		background: rgba(15, 23, 42, 0.94);
		color: #fecaca;
		box-shadow: 0 22px 60px rgba(0, 0, 0, 0.35);
	}
</style>
