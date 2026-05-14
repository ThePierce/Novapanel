<script lang="ts">
	type Props = {
		condition: string;
		night?: boolean;
		size?: number;
	};

	let { condition, night = false, size = 44 }: Props = $props();

	function toKind(value: string, isNight: boolean) {
		const c = (value || '').toLowerCase();
		if (c.includes('snow')) return 'snow';
		if (c.includes('hail')) return 'hail';
		if (c.includes('lightning')) return 'lightning';
		if (c.includes('rain') || c.includes('pour')) return 'rain';
		if (c.includes('fog')) return 'fog';
		if (c.includes('wind')) return 'wind';
		if (c.includes('cloud')) return 'cloudy';
		if (c.includes('partly')) return 'partly';
		if (c.includes('clear') || c.includes('sunny')) return isNight ? 'clear_night' : 'sunny';
		return isNight ? 'clear_night' : 'sunny';
	}

	const kind = $derived(toKind(condition, night));
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 64 64"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
>
	{#if kind === 'sunny'}
		<circle cx="32" cy="32" r="12" fill="#ffd35a" />
		{#each Array.from({ length: 8 }, (_, i) => i) as i (i)}
			{@const a = (i * Math.PI) / 4}
			<line
				x1={32 + Math.cos(a) * 18}
				y1={32 + Math.sin(a) * 18}
				x2={32 + Math.cos(a) * 26}
				y2={32 + Math.sin(a) * 26}
				stroke="#ffd35a"
				stroke-width="3"
				stroke-linecap="round"
			/>
		{/each}
	{:else if kind === 'clear_night'}
		<path
			d="M40 10c-10 2-17 12-15 22 2 11 13 18 24 16-4 4-10 6-16 5C20 50 12 38 14 26c2-8 8-14 16-16 4-1 7-1 10 0z"
			fill="#c9d5ff"
			opacity="0.95"
		/>
	{:else if kind === 'partly'}
		<circle cx="24" cy="26" r="9" fill="#ffd35a" />
		<path
			d="M22 44h24a10 10 0 0 0 0-20 13 13 0 0 0-25 4A8 8 0 0 0 22 44z"
			fill="#2e384d"
			opacity="0.85"
		/>
	{:else if kind === 'cloudy'}
		<path
			d="M18 46h30a11 11 0 0 0 0-22 14 14 0 0 0-27 4A9 9 0 0 0 18 46z"
			fill="#2e384d"
			opacity="0.9"
		/>
	{:else if kind === 'rain'}
		<path
			d="M18 40h30a11 11 0 0 0 0-22 14 14 0 0 0-27 4A9 9 0 0 0 18 40z"
			fill="#2e384d"
			opacity="0.9"
		/>
		{#each [0, 1, 2] as i (i)}
			<path
				d={`M${24 + i * 10} 44c0 4-3 6-3 9 0 2 2 4 4 4 3 0 5-2 5-5 0-3-2-5-6-8z`}
				fill="#6fb7ff"
				opacity="0.95"
			/>
		{/each}
	{:else if kind === 'snow'}
		<path
			d="M18 40h30a11 11 0 0 0 0-22 14 14 0 0 0-27 4A9 9 0 0 0 18 40z"
			fill="#2e384d"
			opacity="0.9"
		/>
		{#each [0, 1, 2] as i (i)}
			<circle cx={26 + i * 10} cy="48" r="2.6" fill="#eaf2ff" />
			<circle cx={23 + i * 10} cy="54" r="2.2" fill="#eaf2ff" opacity="0.9" />
		{/each}
	{:else if kind === 'lightning'}
		<path
			d="M18 40h30a11 11 0 0 0 0-22 14 14 0 0 0-27 4A9 9 0 0 0 18 40z"
			fill="#2e384d"
			opacity="0.9"
		/>
		<path d="M34 42l-6 10h5l-3 10 12-16h-6l4-4z" fill="#ffd35a" />
	{:else if kind === 'fog'}
		<path
			d="M18 38h30a11 11 0 0 0 0-22 14 14 0 0 0-27 4A9 9 0 0 0 18 38z"
			fill="#2e384d"
			opacity="0.85"
		/>
		{#each [44, 50, 56] as y (y)}
			<line x1="16" y1={y} x2="48" y2={y} stroke="rgba(245,245,245,0.55)" stroke-width="3" stroke-linecap="round" />
		{/each}
	{:else if kind === 'wind'}
		{#each [28, 38, 48] as y (y)}
			<path
				d={`M14 ${y}h26c6 0 8-6 4-9`}
				fill="none"
				stroke="rgba(245,245,245,0.7)"
				stroke-width="3"
				stroke-linecap="round"
			/>
		{/each}
	{/if}
</svg>
