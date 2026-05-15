<script lang="ts">
	import SidebarList from './SidebarList.svelte';
	import type { SidebarItemBase, SidebarState } from './types';

	type Props = {
		state: SidebarState;
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
		state,
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
</script>

<aside
	class="sidebar-shell"
	style:width={`${state.width}px`}
	class:hidden={!state.enabled}
>
	<SidebarList
		items={state.items}
		{editable}
		{onSelectItem}
		{onDragStartItem}
		{onDragEndItem}
		{onDragOverValid}
		{onDragOverItem}
		{onDropOnItem}
		{onDropAtEnd}
		{activeDropTargetId}
		{activeDropPlacement}
	/>
</aside>

<style>
	.sidebar-shell {
		background: #121722;
		border-right: 1px solid #262e3f;
		padding: 1.25rem 1rem;
		display: grid;
		grid-template-rows: 1fr;
		gap: 1.25rem;
		max-width: 100%;
		overflow-y: auto;
		overflow-x: hidden;
		box-sizing: border-box;
		position: fixed;
		top: var(--drawer-offset, 0px);
		left: 0;
		bottom: 0;
		z-index: 5;
	}

	.sidebar-shell :global(.sidebar-list) {
		min-height: 100%;
	}

	.sidebar-shell.hidden {
		display: none;
	}
</style>
