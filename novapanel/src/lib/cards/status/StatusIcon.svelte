<script lang="ts">
	type Props = {
		icon?: string;
		size?: number;
	};

	let { icon = 'lightbulb', size = 38 }: Props = $props();
	const INLINE_ICON_KINDS = new Set([
		'lightbulb',
		'shield',
		'shield_off',
		'shield_alert',
		'door',
		'door_open',
		'window',
		'window_open',
		'garage',
		'plug',
		'plug_off',
		'availability',
		'wifi_alert',
		'router',
		'thermostat',
		'curtains',
		'curtains_closed',
		'lock',
		'lock_open',
		'fan',
		'tv',
		'floor_lamp',
		'ceiling_light',
		'led_strip',
		'robot',
		'robot_vacuum',
		'speaker',
		'sofa'
	]);
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
	let mdiLoadFailed = $derived.by(() => {
		void iconSrc;
		return false;
	});
	const kind = $derived(
		(() => {
			const raw = (icon || '').toLowerCase().trim();
			const normalized = raw.startsWith('mdi:') ? raw.slice(4) : raw;
			if (
				normalized === 'lightbulb' ||
				normalized === 'lightbulb-outline' ||
				normalized === 'lightbulb-on' ||
				normalized === 'lightbulb-on-outline' ||
				normalized === 'lightbulb-group' ||
				normalized === 'lightbulb-group-outline'
			) {
				return 'lightbulb';
			}
			if (normalized === 'door' || normalized === 'door-closed') return 'door';
			if (normalized === 'door-open') return 'door_open';
			if (normalized === 'window' || normalized === 'window-closed' || normalized === 'window-closed-variant')
				return 'window';
			if (normalized === 'window-open' || normalized === 'window-open-variant') return 'window_open';
			if (normalized === 'garage' || normalized === 'garage-variant') return 'garage';
			if (normalized === 'plug' || normalized === 'power-plug') return 'plug';
			if (normalized === 'plug-off' || normalized === 'power-plug-off') return 'plug_off';
			if (normalized === 'wifi-alert' || normalized === 'lan-disconnect') return 'wifi_alert';
			if (normalized === 'wifi' || normalized === 'lan-check') return 'availability';
			if (
				normalized === 'router-wireless' ||
				normalized === 'server-network' ||
				normalized === 'access-point'
			)
				return 'router';
			if (normalized === 'shield' || normalized === 'shield-lock') return 'shield';
			if (normalized === 'shield-off' || normalized === 'shield-off-outline') return 'shield_off';
			if (normalized === 'shield-alert' || normalized === 'shield-half-full') return 'shield_alert';
			if (normalized === 'lock-open' || normalized === 'lock-open-outline') return 'lock_open';
			if (normalized === 'lock' || normalized === 'lock-outline') return 'lock';
			if (normalized === 'thermostat' || normalized === 'home-thermometer-outline') return 'thermostat';
			if (normalized === 'fan') return 'fan';
			if (normalized === 'television' || normalized === 'monitor' || normalized === 'cast') return 'tv';
			if (
				normalized === 'floor-lamp-outline' ||
				normalized === 'floor-lamp' ||
				normalized === 'lamp-outline' ||
				normalized === 'lamp'
			)
				return 'floor_lamp';
			if (normalized === 'ceiling-light-outline' || normalized === 'ceiling-light') return 'ceiling_light';
			if (normalized === 'led-strip-variant' || normalized === 'led-strip') return 'led_strip';
			if (normalized === 'robot' || normalized === 'home-map-marker') return 'robot';
			if (
				normalized === 'curtains-closed' ||
				normalized === 'blinds-horizontal-closed' ||
				normalized === 'blinds' ||
				normalized === 'window-shutter'
			)
				return 'curtains_closed';
			if (
				normalized === 'curtains' ||
				normalized === 'blinds-horizontal' ||
				normalized === 'blinds-open' ||
				normalized === 'window-shutter-open'
			)
				return 'curtains';
			if (normalized === 'robot-vacuum' || normalized === 'robot-vacuum-variant') return 'robot_vacuum';
			if (normalized === 'speaker' || normalized === 'speaker-wireless' || normalized === 'audio-video')
				return 'speaker';
			if (normalized === 'sofa' || normalized === 'sofa-outline' || normalized === 'seat-outline')
				return 'sofa';
			if (normalized.length === 0) return 'unknown';
			return normalized;
		})()
	);
	const shouldRenderInline = $derived(INLINE_ICON_KINDS.has(kind));
</script>

{#if iconSrc && !mdiLoadFailed && !shouldRenderInline}
	<span
		class="mdi-mask"
		style:width={`${size}px`}
		style:height={`${size}px`}
		style:--icon-url={`url('${iconSrc}')`}
		aria-hidden="true"
	></span>
	<img
		class="mdi-probe"
		src={iconSrc}
		alt=""
		width="1"
		height="1"
		aria-hidden="true"
		onerror={() => (mdiLoadFailed = true)}
	/>
{:else}
	<svg
		width={size}
		height={size}
		viewBox="0 0 48 48"
		aria-hidden="true"
		fill="none"
		stroke="currentColor"
		stroke-width="1.8"
		stroke-linecap="round"
		stroke-linejoin="round"
	>
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
		{:else if kind === 'window' || kind === 'window_open'}
			<rect x="9" y="10" width="30" height="28" rx="2" />
			<path d="M24 10V38M9 24H39" />
			{#if kind === 'window_open'}
				<path d="M24 11L36 15V33L24 37" />
			{/if}
		{:else if kind === 'garage'}
			<path d="M8 20L24 9L40 20V39H8Z" />
			<path d="M14 25H34V39H14Z" />
			<path d="M14 30H34M14 35H34" />
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
		{:else if kind === 'router'}
			<rect x="10" y="24" width="28" height="11" rx="3" />
			<path d="M17 24V17M31 24V17" />
			<path d="M16 14C21 10 27 10 32 14" />
			<circle cx="17" cy="30" r="1.2" fill="currentColor" stroke="none" />
			<circle cx="24" cy="30" r="1.2" fill="currentColor" stroke="none" />
			<circle cx="31" cy="30" r="1.2" fill="currentColor" stroke="none" />
		{:else if kind === 'thermostat'}
			<path d="M24 8a5 5 0 0 0-5 5v16.5a9 9 0 1 0 10 0V13a5 5 0 0 0-5-5Z" />
			<path d="M24 18v15" />
			<circle cx="24" cy="34" r="3.2" fill="currentColor" stroke="none" />
		{:else if kind === 'fan'}
			<circle cx="24" cy="24" r="3" />
			<path d="M24 21C22 14 25 9 31 8C35 12 32 18 26 23" />
			<path d="M27 25C34 23 39 26 40 32C36 36 30 33 25 27" />
			<path d="M22 26C17 31 11 31 8 26C10 20 17 20 23 23" />
		{:else if kind === 'tv'}
			<rect x="8" y="12" width="32" height="22" rx="3" />
			<path d="M18 39H30M24 34V39" />
		{:else if kind === 'floor_lamp'}
			<path d="M18 10H30L34 23H14Z" />
			<path d="M24 23V39M18 39H30" />
			<path d="M17 27H31" opacity="0.65" />
		{:else if kind === 'ceiling_light'}
			<path d="M16 9H32" />
			<path d="M24 9V14" />
			<path d="M15 14H33L30 28H18Z" />
			<path d="M19 34H29" opacity="0.7" />
		{:else if kind === 'led_strip'}
			<path d="M9 17H39V31H9Z" />
			<path d="M15 17V31M21 17V31M27 17V31M33 17V31" />
			<circle cx="15" cy="24" r="1.4" fill="currentColor" stroke="none" />
			<circle cx="27" cy="24" r="1.4" fill="currentColor" stroke="none" />
		{:else if kind === 'curtains' || kind === 'curtains_closed'}
			<rect x="9" y="9" width="30" height="5" rx="2.5" />
			{#if kind === 'curtains_closed'}
				<path d="M11 18h26M11 24h26M11 30h26M11 36h26" />
				<path d="M36 14v25" opacity="0.7" />
				<circle cx="36" cy="40" r="1.4" fill="currentColor" stroke="none" />
			{:else}
				<path d="M12 19l24-3M12 25l24-3M12 31l24-3M12 37l24-3" />
				<path d="M36 14v23" opacity="0.7" />
				<circle cx="36" cy="38" r="1.4" fill="currentColor" stroke="none" />
			{/if}
		{:else if kind === 'lock' || kind === 'lock_open'}
			<rect x="12" y="21" width="24" height="18" rx="3" />
			{#if kind === 'lock_open'}
				<path d="M17 21v-4a7 7 0 0 1 11.5-5.3" />
			{:else}
				<path d="M17 21v-4a7 7 0 0 1 14 0v4" />
			{/if}
			<path d="M24 28v5" />
		{:else if kind === 'robot_vacuum'}
			<circle cx="24" cy="24" r="14" />
			<circle cx="24" cy="22" r="6" />
			<circle cx="24" cy="22" r="2" fill="currentColor" stroke="none" />
			<path d="M34 14l5-5M35 35l4 4M14 34l-5 5" />
		{:else if kind === 'robot'}
			<rect x="13" y="16" width="22" height="18" rx="5" />
			<path d="M24 16V10" />
			<circle cx="24" cy="9" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="20" cy="25" r="1.8" fill="currentColor" stroke="none" />
			<circle cx="28" cy="25" r="1.8" fill="currentColor" stroke="none" />
			<path d="M20 31H28" />
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
			<path
				d="M20.7 20.2C20.9 18.2 22.4 17 24.3 17C26.4 17 27.7 18.4 27.7 20.1C27.7 21.5 26.9 22.4 25.6 23.2C24.4 24 23.9 24.6 23.9 26.2"
			/>
		{:else}
			<path
				d="M24 8C17.5 8 13 13 13 18C13 21.8 15.2 24.6 18 26.2V31H30V26.2C32.8 24.6 35 21.8 35 18C35 13 30.5 8 24 8Z"
			/>
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
