<script lang="ts">
	import PlaceholderCard from './items/PlaceholderCard.svelte';
	import type { SidebarItemBase } from './types';

	type Props = {
		items: SidebarItemBase[];
		editable?: boolean;
		onSelectItem?: (item: SidebarItemBase) => void;
		onDragStartItem?: (id: string) => void;
		onDragEndItem?: () => void;
		onDragOverValid?: (event: DragEvent) => void;
	onDragOverItem?: (id: string, placement: 'before' | 'after') => void;
	onDropOnItem?: (id: string, placement: 'before' | 'after') => void;
		onDropAtEnd?: () => void;
	activeDropTargetId?: string;
	activeDropPlacement?: 'before' | 'after';
	};

	let {
		items,
		editable = false,
		onSelectItem,
		onDragStartItem,
		onDragEndItem,
		onDragOverValid,
		onDragOverItem,
		onDropOnItem,
		onDropAtEnd,
		activeDropTargetId = '',
		activeDropPlacement = 'before'
	}: Props = $props();

	let visibleItems = $derived(
		[...items].filter((item) => item.visible).sort((a, b) => a.order - b.order)
	);
</script>

<section
	class="sidebar-list"
	role="list"
	ondragover={(event) => editable && onDragOverValid?.(event)}
	ondrop={(event) => {
		event.stopPropagation();
		if (editable) onDropAtEnd?.();
	}}
>
	{#each visibleItems as item (item.id)}
		<div
			class="sidebar-drop-wrap"
			role="listitem"
			class:drop-before={activeDropTargetId === item.id && activeDropPlacement === 'before'}
			class:drop-after={activeDropTargetId === item.id && activeDropPlacement === 'after'}
			ondragover={(event) => {
				if (!editable) return;
				onDragOverValid?.(event);
				const target = event.currentTarget as HTMLElement | null;
				const rect = target?.getBoundingClientRect();
				const placement = rect && event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
				onDragOverItem?.(item.id, placement);
			}}
			ondrop={(event) => {
				event.stopPropagation();
				const target = event.currentTarget as HTMLElement | null;
				const rect = target?.getBoundingClientRect();
				const placement = rect && event.clientY > rect.top + rect.height / 2 ? 'after' : 'before';
				if (editable) onDropOnItem?.(item.id, placement);
			}}
		>
			<PlaceholderCard
				{item}
				{editable}
				{onSelectItem}
				onDragStart={onDragStartItem}
				onDragEnd={onDragEndItem}
				onDragOverValid={onDragOverValid}
			/>
		</div>
	{/each}
</section>

<style>
	.sidebar-list {
		display: grid;
		gap: 0.04rem;
		align-content: start;
		min-height: 12rem;
		padding: 0.1rem 0.05rem 0.65rem;
	}

	.sidebar-drop-wrap {
		padding: 0.06rem 0;
		border-radius: 12px;
		position: relative;
	}

	.sidebar-drop-wrap.drop-before::before,
	.sidebar-drop-wrap.drop-after::after {
		content: '';
		position: absolute;
		left: 0.45rem;
		right: 0.45rem;
		height: 2px;
		background: currentColor;
		border-radius: 999px;
		opacity: 0.7;
		pointer-events: none;
	}

	.sidebar-drop-wrap.drop-before::before {
		top: 0.15rem;
	}

	.sidebar-drop-wrap.drop-after::after {
		bottom: 0.15rem;
	}
</style>
