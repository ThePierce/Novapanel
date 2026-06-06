<script lang="ts">
	import type { Component } from 'svelte';
	import { selectedLanguageStore, translate } from '$lib/i18n';

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
	<div class="lazy-component-error" role="alert">
		{translate('Component kon niet worden geladen.', $selectedLanguageStore)}
	</div>
{/if}

<style>
	.lazy-component-error {
		width: 100%;
		box-sizing: border-box;
		padding: 0.65rem 0.75rem;
		border: 1px solid rgba(248, 113, 113, 0.28);
		border-radius: 10px;
		background: rgba(127, 29, 29, 0.18);
		color: #fecaca;
		font-size: 0.85rem;
	}
</style>
