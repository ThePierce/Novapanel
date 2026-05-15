<script lang="ts">
	type Props = {
		name: string;
		size?: number | string;
		title?: string;
		'class'?: string;
	};

	let { name, size = 16, title = '', class: className = '' }: Props = $props();

	const sizeValue = $derived(typeof size === 'number' ? `${size}px` : size);
</script>

<i
	class={`ti ti-${name} tabler-icon ${className}`.trim()}
	style={`font-size: ${sizeValue}; width: ${sizeValue}; height: ${sizeValue}; line-height: ${sizeValue};`}
	aria-hidden={title ? undefined : 'true'}
	aria-label={title || undefined}
	title={title || undefined}
></i>

<style>
	.tabler-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		color: currentColor;
		vertical-align: -0.125em;
	}
</style>
