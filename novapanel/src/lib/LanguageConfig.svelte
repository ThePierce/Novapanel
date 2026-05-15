<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { isLanguageCode, languageOptions, loadStoredLanguage, setLanguage, type LanguageCode } from '$lib/i18n';

	type Props = {
		selectedLanguage?: LanguageCode;
		label?: string;
		onLanguageChange?: (language: LanguageCode) => void;
	};

	let { selectedLanguage = 'nl', label = 'Language', onLanguageChange }: Props = $props();

	const dispatch = createEventDispatcher<{ change: { language: LanguageCode } }>();

	function emitChange() {
		onLanguageChange?.(selectedLanguage);
		dispatch('change', { language: selectedLanguage });
	}

	function handleLanguageChange(event: Event) {
		const target = event.currentTarget as HTMLSelectElement;
		selectedLanguage = target.value as LanguageCode;
		setLanguage(selectedLanguage);
		emitChange();
	}

	onMount(() => {
		const savedLanguage = loadStoredLanguage(selectedLanguage);
		if (isLanguageCode(savedLanguage)) {
			selectedLanguage = savedLanguage;
			emitChange();
		}
	});
</script>

<div class="language-field">
	<label for="language-select">{label}</label>
	<select id="language-select" value={selectedLanguage} onchange={handleLanguageChange}>
		{#each languageOptions as option (option.code)}
			<option value={option.code}>{option.label}</option>
		{/each}
	</select>
</div>

<style>
	.language-field {
		display: grid;
		gap: 0.45rem;
		max-width: 260px;
	}

	.language-field label {
		font-size: 0.86rem;
		opacity: 0.9;
	}

	.language-field select {
		height: 2.4rem;
		border-radius: 10px;
		border: 1px solid #34435d;
		background: #212a3b;
		color: #f5f5f5;
		padding: 0 0.7rem;
		outline: none;
	}
</style>
