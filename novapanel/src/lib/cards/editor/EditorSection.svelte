<script lang="ts">
	import TablerIcon from '$lib/icons/TablerIcon.svelte';

	type Tone = 'amber' | 'blue' | 'green' | 'purple' | 'cyan' | 'rose' | 'gold';
	type Status = 'required' | 'filled' | 'partial' | 'empty';

	type Props = {
		title: string;
		icon: string; // tabler icon name without "ti-" prefix, e.g. "bolt"
		tone?: Tone;
		status?: Status;
		statusLabel?: string;
		open?: boolean;
		children?: import('svelte').Snippet;
	};

	let { title, icon, tone = 'blue', status = 'empty', statusLabel, open = false, children }: Props = $props();
	let isOpen = $state(open);

	const TONE_BG: Record<Tone, string> = {
		amber: 'rgba(250,204,21,0.16)',
		blue: 'rgba(96,165,250,0.16)',
		green: 'rgba(52,211,153,0.16)',
		purple: 'rgba(192,132,252,0.16)',
		cyan: 'rgba(6,182,212,0.16)',
		rose: 'rgba(248,113,113,0.16)',
		gold: 'rgba(255,211,56,0.16)'
	};
	const TONE_FG: Record<Tone, string> = {
		amber: '#facc15',
		blue: '#60a5fa',
		green: '#34d399',
		purple: '#c084fc',
		cyan: '#22d3ee',
		rose: '#f87171',
		gold: '#ffd338'
	};
</script>

<div class="np-section" class:open={isOpen} class:required={status === 'required'}>
	<button type="button" class="np-section-head" onclick={() => (isOpen = !isOpen)}>
		<span class="np-section-icon" style="background: {TONE_BG[tone]}; color: {TONE_FG[tone]};">
			<TablerIcon name={icon} size={16} />
		</span>
		<span class="np-section-title">{title}</span>
		{#if statusLabel}
			<span class={`np-section-meta ${status}`}>{statusLabel}</span>
		{/if}
		<span class="np-section-chevron">
			<TablerIcon name="chevron-down" size={14} />
		</span>
	</button>
	{#if isOpen}
		<div class="np-section-body">
			{@render children?.()}
		</div>
	{/if}
</div>

<style>
	.np-section {
		background: rgba(255,255,255,0.025);
		border: 0.5px solid rgba(255,255,255,0.07);
		border-radius: 13px;
		overflow: visible;
		transition: border-color 0.2s, background 0.2s, transform 0.2s;
		position: relative;
		min-width: 0;
		max-width: 100%;
		box-sizing: border-box;
		container-type: inline-size;
	}
	.np-section:hover {
		border-color: rgba(255,255,255,0.13);
		background: rgba(255,255,255,0.04);
		transform: translateY(-1px);
	}
	.np-section.required {
		border-color: rgba(250,204,21,0.18);
		background: linear-gradient(135deg, rgba(250,204,21,0.04), transparent 60%), rgba(255,255,255,0.025);
	}
	.np-section.required::before {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 13px;
		padding: 0.5px;
		background: linear-gradient(135deg, rgba(250,204,21,0.30), rgba(96,165,250,0.30) 50%, transparent);
		-webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
		-webkit-mask-composite: xor;
		mask-composite: exclude;
		pointer-events: none;
		opacity: 0;
		transition: opacity 0.25s;
	}
	.np-section.required:hover::before { opacity: 1; }
	.np-section-head {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 13px 15px;
		cursor: pointer;
		user-select: none;
		width: 100%;
		background: transparent;
		border: 0;
		text-align: left;
		font-family: inherit;
		color: inherit;
		min-width: 0;
		box-sizing: border-box;
	}
	.np-section-icon {
		width: 30px; height: 30px;
		border-radius: 8px;
		display: grid; place-items: center;
		flex-shrink: 0;
		transition: transform 0.2s;
	}
	.np-section:hover .np-section-icon { transform: scale(1.06); }
	.np-section-title {
		font-size: 13px;
		font-weight: 500;
		color: #f5f5f5;
		letter-spacing: -0.005em;
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.np-section-meta {
		font-size: 10.5px;
		padding: 3px 9px;
		border-radius: 5px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}
	.np-section-meta.filled { background: rgba(74,222,128,0.13); color: #4ade80; }
	.np-section-meta.partial { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.6); }
	.np-section-meta.empty { background: transparent; color: rgba(255,255,255,0.3); }
	.np-section-meta.required { background: rgba(250,204,21,0.16); color: #facc15; }
	.np-section-chevron {
		color: rgba(255,255,255,0.4);
		display: inline-grid;
		place-items: center;
		transition: transform 0.2s;
	}
	.np-section.open .np-section-chevron { transform: rotate(180deg); }
	.np-section-body {
		padding: 4px 15px 15px;
		display: flex;
		flex-direction: column;
		gap: 11px;
		min-height: 0;
		min-width: 0;
		max-width: 100%;
		box-sizing: border-box;
		overflow: visible;
	}
</style>
