<script lang="ts">
	type Props = {
		icon?: string;
		size?: number;
	};

	let { icon = 'lightbulb', size = 38 }: Props = $props();
	let mdiLoadFailed = $state(false);
	const iconSrc = $derived(
		(() => {
			const raw = (icon || '').trim();
			if (!raw) return '';
			if (raw.startsWith('mdi:')) {
				const name = raw.slice(4);
				const ingressBase =
					typeof window !== 'undefined'
						? (((window as unknown as { __novapanel_ingress?: string }).__novapanel_ingress || '') as string)
						: '';
				return `${ingressBase}/api/mdi-icon/${encodeURIComponent(name)}`;
			}
			return '';
		})()
	);
	$effect(() => {
		mdiLoadFailed = false;
	});
	const kind = $derived(
		(() => {
			const raw = (icon || '').toLowerCase().trim();
			const normalized = raw.startsWith('mdi:') ? raw.slice(4) : raw;
			if (
				normalized === 'lightbulb' ||
				normalized === 'lightbulb-outline'
			) {
				return 'lightbulb';
			}
			if (normalized === 'door' || normalized === 'door-closed') return 'door';
			if (normalized === 'door-open' || normalized === 'window-open') return 'door_open';
			if (normalized === 'plug' || normalized === 'power-plug') return 'plug';
			if (normalized === 'plug-off' || normalized === 'power-plug-off') return 'plug_off';
			if (normalized === 'wifi-alert' || normalized === 'lan-disconnect') return 'wifi_alert';
			if (normalized === 'wifi' || normalized === 'lan-check') return 'availability';
			if (normalized === 'shield' || normalized === 'shield-lock') return 'shield';
			if (normalized === 'shield-off' || normalized === 'shield-off-outline') return 'shield_off';
			if (normalized === 'shield-alert' || normalized === 'shield-half-full') return 'shield_alert';
			if (normalized === 'thermostat' || normalized === 'home-thermometer-outline') return 'thermostat';
			if (normalized === 'curtains-closed' || normalized === 'blinds-horizontal-closed' || normalized === 'blinds' || normalized === 'window-shutter') return 'curtains_closed';
			if (normalized === 'curtains' || normalized === 'blinds-horizontal' || normalized === 'blinds-open' || normalized === 'window-shutter-open') return 'curtains';
			if (normalized === 'robot-vacuum' || normalized === 'robot-vacuum-variant') return 'robot_vacuum';
			if (normalized === 'speaker' || normalized === 'speaker-wireless' || normalized === 'audio-video') return 'speaker';
			if (normalized === 'sofa' || normalized === 'sofa-outline' || normalized === 'seat-outline') return 'sofa';
			if (normalized.length === 0) return 'unknown';
			return normalized;
		})()
	);
</script>

{#if iconSrc && !mdiLoadFailed}
	<span
		class="mdi-mask"
		style:width={`${size}px`}
		style:height={`${size}px`}
		style:--icon-url={`url('${iconSrc}')`}
		aria-hidden="true"
	></span>
	<img class="mdi-probe" src={iconSrc} alt="" width="1" height="1" aria-hidden="true" onerror={() => (mdiLoadFailed = true)} />
{:else}
	<svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
		{#if kind === 'shield' || kind === 'shield_off' || kind === 'shield_alert'}
		<path d="M24 6L37 11V22C37 30 31 36 24 40C17 36 11 30 11 22V11L24 6Z" />
		{#if kind === 'shield_off'}
			<path d="M16 16L32 32" />
		{:else if kind === 'shield_alert'}
			<circle cx="24" cy="28" r="1.5" fill="currentColor" stroke="none" />
			<path d="M24 17V24" />
		{/if}
	{:else if kind === 'door' || kind === 'door_open'}
		<rect x="13" y="7" width="22" height="34" rx="2" />
		{#if kind === 'door_open'}
			<path d="M15 9L31 12V36L15 39Z" />
		{/if}
		<circle cx="29" cy="24" r="1.3" fill="currentColor" stroke="none" />
	{:else if kind === 'plug' || kind === 'plug_off'}
		<path d="M19 9V17M29 9V17" />
		<rect x="16" y="17" width="16" height="10" rx="2" />
		<path d="M24 27V36" />
		{#if kind === 'plug_off'}
			<path d="M14 14L34 34" />
		{/if}
	{:else if kind === 'availability' || kind === 'wifi_alert'}
		<path d="M7 18C17 10 31 10 41 18" />
		<path d="M12 24C19 18 29 18 36 24" />
		<path d="M18 30C22 27 26 27 30 30" />
		<circle cx="24" cy="35" r="1.8" fill="currentColor" stroke="none" />
		{#if kind === 'wifi_alert'}
			<path d="M38 30V35" />
			<circle cx="38" cy="38.5" r="1" fill="currentColor" stroke="none" />
		{/if}
	{:else if kind === 'thermostat'}
		<path d="M24 8a5 5 0 0 0-5 5v16.5a9 9 0 1 0 10 0V13a5 5 0 0 0-5-5Z" />
		<path d="M24 18v15" />
		<circle cx="24" cy="34" r="3.2" fill="currentColor" stroke="none" />
	{:else if kind === 'curtains' || kind === 'curtains_closed'}
		<path d="M9 10h30" />
		{#if kind === 'curtains_closed'}
			<path d="M13 14v25M35 14v25" />
			<path d="M13 15c5.5 3.5 10.5 3.5 22 0M13 26c5.5 3.5 10.5 3.5 22 0M13 37c5.5 2.8 10.5 2.8 22 0" opacity="0.65" />
		{:else}
			<path d="M12 14c2.5 4 4.8 8 4.8 25M36 14c-2.5 4-4.8 8-4.8 25" />
			<path d="M12 15c2.2 2.5 4.2 2.8 7 1M36 15c-2.2 2.5-4.2 2.8-7 1" opacity="0.65" />
		{/if}
	{:else if kind === 'robot_vacuum'}
		<circle cx="24" cy="24" r="14" />
		<circle cx="24" cy="22" r="6" />
		<circle cx="24" cy="22" r="2" fill="currentColor" stroke="none" />
		<path d="M34 14l5-5M35 35l4 4M14 34l-5 5" />
	{:else if kind === 'speaker'}
		<path d="M10 19h8l14-9v28L18 29h-8Z" />
		<path d="M37 18c3 4 3 8 0 12M41 13c5 7 5 15 0 22" />
	{:else if kind === 'sofa'}
		<path d="M13 24v-6a5 5 0 0 1 5-5h12a5 5 0 0 1 5 5v6" />
		<path d="M10 24h28a4 4 0 0 1 4 4v8H6v-8a4 4 0 0 1 4-4Z" />
		<path d="M10 36v4M38 36v4M18 24v8M30 24v8" />
	{:else if kind === 'unknown'}
		<circle cx="24" cy="24" r="14" />
		<path d="M24 30V30.2" stroke-width="2.5" />
		<path d="M20.7 20.2C20.9 18.2 22.4 17 24.3 17C26.4 17 27.7 18.4 27.7 20.1C27.7 21.5 26.9 22.4 25.6 23.2C24.4 24 23.9 24.6 23.9 26.2" />
	{:else}
		<path d="M24 8C17.5 8 13 13 13 18C13 21.8 15.2 24.6 18 26.2V31H30V26.2C32.8 24.6 35 21.8 35 18C35 13 30.5 8 24 8Z" />
		<path d="M20 35H28M21 39H27" />
		{/if}
	</svg>
{/if}

<style>
	.mdi-mask {
		display: inline-block;
		background-color: currentColor;
		-webkit-mask-image: var(--icon-url);
		mask-image: var(--icon-url);
		-webkit-mask-repeat: no-repeat;
		mask-repeat: no-repeat;
		-webkit-mask-position: center;
		mask-position: center;
		-webkit-mask-size: contain;
		mask-size: contain;
	}
	.mdi-probe {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
		pointer-events: none;
	}
</style>
