<script lang="ts">
	import type { TranslationKey } from '$lib/i18n';

	type Props = {
		t: (key: TranslationKey) => string;
		controlsOpen: boolean;
		editMode: boolean;
		draftHasChanges: boolean;
		canUndo: boolean;
		canRedo: boolean;
		onStartEdit: () => void | Promise<void>;
		onSaveEdit: () => void | Promise<void>;
		onCancelEdit: () => void;
		onUndo: () => void;
		onRedo: () => void;
		onOpenCardLibrary: () => void;
		onOpenSettings: () => void;
		onOpenHASidebar: () => void;
		onToggleControls: () => void;
		showDrawerHint?: boolean;
	};

	let {
		t,
		controlsOpen,
		editMode,
		draftHasChanges,
		canUndo,
		canRedo,
		onStartEdit,
		onSaveEdit,
		onCancelEdit,
		onUndo,
		onRedo,
		onOpenCardLibrary,
		onOpenSettings,
		onOpenHASidebar,
		onToggleControls,
		showDrawerHint = false
	}: Props = $props();
</script>

<div class="drawer-shell" class:open={controlsOpen} class:showHint={showDrawerHint && !controlsOpen}>
	<section class="top-drawer" class:open={controlsOpen}>
		<div class="drawer-row">
			{#if editMode}
				<button
					type="button"
					class="settings-inline drawer-history"
					disabled={!canUndo}
					onclick={onUndo}
					aria-label={t('undo')}
				>
					{t('undo')}
				</button>
				<button
					type="button"
					class="settings-inline drawer-history"
					disabled={!canRedo}
					onclick={onRedo}
					aria-label={t('redo')}
				>
					{t('redo')}
				</button>
				<button type="button" class="settings-inline drawer-cancel" onclick={onCancelEdit}>
					{t('cancel')}
				</button>
				<button
					type="button"
					class="edit-mode-inline"
					class:drawer-save={draftHasChanges}
					onclick={onSaveEdit}
				>
					{t('save')}
				</button>
				<button type="button" class="settings-inline" onclick={onOpenCardLibrary}>
					{t('openCardLibrary')}
				</button>
			{:else}
				<button type="button" class="edit-mode-inline" onclick={onStartEdit}>
					{t('editMode')}
				</button>
			{/if}
			<div class="drawer-actions-right">
				<button type="button" class="settings-inline" onclick={onOpenSettings}>
					{t('settings')}
				</button>
				<button type="button" class="ha-hamburger" onclick={onOpenHASidebar} aria-label={t('openHaSidebar')}>
					<svg viewBox="0 0 24 24" aria-hidden="true">
						<path d="M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z" />
					</svg>
				</button>
			</div>
		</div>
	</section>
	<button type="button" class="drawer-toggle" onclick={onToggleControls} aria-expanded={controlsOpen} aria-label={controlsOpen ? t('closeDrawer') : t('openDrawer')}>
		<svg viewBox="0 0 24 24" aria-hidden="true" class:open={controlsOpen}>
			<path d="M6 9L12 15L18 9" />
		</svg>
	</button>
</div>

<style>
	.drawer-shell { position: absolute; top: 0; left: 0; right: 0; z-index: 35; }
	.drawer-shell::before,
	.drawer-shell::after {
		content: '';
		position: absolute;
		right: 3.25rem;
		pointer-events: none;
		opacity: 0;
		transition: opacity 180ms ease, transform 180ms ease;
	}
	.drawer-shell::before {
		top: 5.15rem;
		width: 0.2rem;
		height: 2.35rem;
		border-radius: 999px;
		background: linear-gradient(180deg, rgba(219,234,254,0.88), rgba(219,234,254,0));
		box-shadow: 0 0 18px rgba(96,165,250,0.35);
	}
	.drawer-shell::after {
		top: 4.6rem;
		width: 1.25rem;
		height: 1.25rem;
		border-left: 0.22rem solid rgba(219,234,254,0.9);
		border-top: 0.22rem solid rgba(219,234,254,0.9);
		transform: translateX(0.52rem) rotate(45deg);
		filter: drop-shadow(0 0 10px rgba(96,165,250,0.42));
	}
	.drawer-shell.showHint::before { opacity: 0.72; }
	.drawer-shell.showHint::after { opacity: 0.72; transform: translateX(0.52rem) rotate(45deg); }
	.top-drawer { height: 4.75rem; width: 100%; display: flex; align-items: center; justify-content: flex-end; padding: 1rem 5rem 1rem 2rem; border-bottom: 1px solid #262e3f; background: #121722; transform: translateY(-105%); opacity: 0; transition: transform 220ms ease, opacity 180ms ease; pointer-events: none; box-sizing: border-box; }
	.top-drawer.open { transform: translateY(0); opacity: 1; pointer-events: auto; }
	.drawer-row { display: flex; align-items: center; justify-content: flex-start; gap: 0.7rem; width: 100%; flex-wrap: wrap; }
	.drawer-actions-right { display: flex; align-items: center; gap: 0.7rem; margin-left: auto; }
	.edit-mode-inline, .settings-inline, .drawer-toggle, .ha-hamburger { height: 2.7rem; border-radius: 0.4rem; border: 0; background: transparent; color: #f5f5f5; cursor: pointer; font-size: 0.95rem; opacity: 0; transition: opacity 0.25s ease; }
	.edit-mode-inline { padding: 0.65rem 1rem 0.4rem 0.82rem; border-radius: 0.4rem; background: rgba(255, 255, 255, 0.08); font-size: 0.9rem; font-weight: 500; opacity: 1; }
	.edit-mode-inline.drawer-save { background: #c89d1b; color: #ffffff; }
	.settings-inline { width: auto; padding: 0.65rem 1rem 0.4rem 0.82rem; border-radius: 0.4rem; background: rgba(255, 255, 255, 0.08); font-size: 0.9rem; font-weight: 500; }
	.settings-inline:disabled { opacity: 0.35; cursor: not-allowed; }
	.drawer-cancel { background: rgba(255, 255, 255, 0.06); }
	.ha-hamburger svg { width: 1.5rem; height: 1.5rem; fill: currentColor; }
	.ha-hamburger { width: 2.7rem; padding: 0.45rem; opacity: 1; }
	.drawer-toggle svg { width: 1.5rem; height: 1.5rem; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; transition: transform 210ms ease; }
	.drawer-toggle svg.open { transform: rotate(180deg); }
	.settings-inline, .ha-hamburger, .drawer-toggle:hover, .drawer-toggle:focus-visible { opacity: 1; }
	.drawer-toggle { position: absolute; top: 1rem; right: 2rem; width: 2.7rem; opacity: 0; }
	.drawer-toggle:hover, .drawer-toggle:focus-visible { opacity: 1; }
	.drawer-toggle[aria-expanded='true'], .drawer-shell:has(.drawer-toggle:hover) .drawer-toggle { opacity: 1; }
</style>
