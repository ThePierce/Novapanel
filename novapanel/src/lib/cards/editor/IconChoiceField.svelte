<script lang="ts">
	import StatusIcon from '$lib/cards/status/StatusIcon.svelte';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';

	export type IconChoice = {
		icon: string;
		label: string;
	};

	type Props = {
		label: string;
		value?: string;
		placeholder?: string;
		choices?: IconChoice[];
		validationState?: 'idle' | 'checking' | 'ok' | 'error' | string;
		validationMessage?: string;
		help?: string;
		onChange: (value: string) => void;
	};

	let {
		label,
		value = '',
		placeholder = 'mdi:lightbulb-outline',
		choices = [],
		validationState = 'idle',
		validationMessage = '',
		help = '',
		onChange
	}: Props = $props();

	function normalizeIconValue(input: string): string {
		const raw = input.trim();
		if (!raw) return '';
		return raw.includes(':') ? raw : `mdi:${raw}`;
	}

	const normalizedValue = $derived(normalizeIconValue(value));

	function isSelected(icon: string): boolean {
		return normalizeIconValue(icon).toLowerCase() === normalizedValue.toLowerCase();
	}

	function chooseIcon(icon: string) {
		onChange(normalizeIconValue(icon));
	}
</script>

<label class="np-field">
	<span class="np-label">{label}</span>
	{#if choices.length > 0}
		<div class="icon-choice-grid">
			{#each choices as choice (choice.icon)}
				<button
					type="button"
					class="icon-choice"
					class:selected={isSelected(choice.icon)}
					title={choice.label}
					aria-label={choice.label}
					aria-pressed={isSelected(choice.icon)}
					onclick={() => chooseIcon(choice.icon)}
				>
					<StatusIcon icon={choice.icon} size={21} />
					<span>{choice.label}</span>
				</button>
			{/each}
		</div>
	{/if}
	<div class="icon-input-row">
		<input
			type="text"
			class="np-input mono"
			value={value ?? ''}
			{placeholder}
			oninput={(event) => onChange((event.currentTarget as HTMLInputElement).value)}
			onblur={(event) => {
				const next = normalizeIconValue((event.currentTarget as HTMLInputElement).value);
				if (next) onChange(next);
			}}
		/>
		<span class="icon-preview" aria-hidden="true">
			<StatusIcon icon={normalizedValue || placeholder} size={20} />
		</span>
	</div>
	{#if validationMessage}
		<span class={`icon-validation ${validationState}`}>
			<TablerIcon
				name={validationState === 'ok'
					? 'circle-check'
					: validationState === 'error'
						? 'alert-circle'
						: 'loader-2'}
				size={13}
			/>
			{validationMessage}
		</span>
	{/if}
	{#if help}
		<span class="icon-help">{help}</span>
	{/if}
</label>

<style>
	.np-field {
		display: grid;
		gap: 0.5rem;
	}
	.np-label {
		font-size: 0.78rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.68);
	}
	.icon-choice-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(5.6rem, 1fr));
		gap: 0.45rem;
	}
	.icon-choice {
		min-width: 0;
		height: 4.2rem;
		display: grid;
		place-items: center;
		align-content: center;
		gap: 0.32rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 0.62rem;
		color: rgba(255, 255, 255, 0.72);
		background: rgba(255, 255, 255, 0.045);
		font: inherit;
		font-size: 0.72rem;
		font-weight: 750;
		cursor: pointer;
		transition:
			background 140ms ease,
			border-color 140ms ease,
			color 140ms ease;
	}
	.icon-choice span {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.icon-choice:hover {
		color: rgba(255, 255, 255, 0.94);
		background: rgba(255, 255, 255, 0.075);
	}
	.icon-choice.selected {
		color: #f8fafc;
		border-color: rgba(96, 165, 250, 0.5);
		background: rgba(96, 165, 250, 0.18);
	}
	.icon-input-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 0.5rem;
		align-items: center;
	}
	.np-input {
		width: 100%;
		height: 2.45rem;
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: 0.55rem;
		background: rgba(255, 255, 255, 0.075);
		color: #f5f5f5;
		padding: 0 0.75rem;
		font: inherit;
		box-sizing: border-box;
	}
	.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
	}
	.icon-preview {
		width: 2.45rem;
		height: 2.45rem;
		display: grid;
		place-items: center;
		border-radius: 0.55rem;
		color: #93c5fd;
		background: rgba(147, 197, 253, 0.13);
	}
	.icon-validation {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		min-height: 1.1rem;
		font-size: 0.76rem;
		color: rgba(255, 255, 255, 0.58);
	}
	.icon-validation.ok {
		color: #86efac;
	}
	.icon-validation.error {
		color: #fca5a5;
	}
	.icon-validation.checking {
		color: #fde68a;
	}
	.icon-help {
		font-size: 0.72rem;
		line-height: 1.25;
		color: rgba(255, 255, 255, 0.48);
	}
</style>
