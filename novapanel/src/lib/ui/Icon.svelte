<script lang="ts">
	type Props = {
		name: string;
		width?: string;
		height?: string;
		className?: string;
		inline?: boolean;
	};

	let { name, width = '1em', height = '1em', className = '', inline = true }: Props = $props();
</script>

<iconify-icon icon={name} width={width} height={height} class={className} inline={inline}></iconify-icon>
