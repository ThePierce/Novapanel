<script lang="ts">
	import { get } from 'svelte/store';
	import { clockNow } from '$lib/cards/clock-time';

	type Props = {
		analogStyle?: 1 | 2 | 3 | 4;
		digitalStyle?: 1 | 2 | 3 | 4;
		compact?: boolean;
		showAnalog?: boolean;
		showDigital?: boolean;
		clockStyle?: string;
		hour12?: boolean;
		seconds?: boolean;
		locale?: string;
	};

	let {
		analogStyle = 1,
		digitalStyle = 1,
		compact = false,
		showAnalog = true,
		showDigital = true,
		clockStyle,
		hour12,
		seconds = false,
		locale
	}: Props = $props();

	let now = $state(get(clockNow));
	$effect(() => {
		const unsub = clockNow.subscribe((value) => {
			now = value;
		});
		return () => unsub();
	});

	const hour = $derived(now.getHours() % 12);
	const minute = $derived(now.getMinutes());
	const second = $derived(now.getSeconds());
	const hourDeg = $derived(hour * 30 + minute * 0.5);
	const minuteDeg = $derived(minute * 6 + second * 0.1);
	const secondDeg = $derived(second * 6);

	function getLocale() {
		if (locale && locale.length > 0) return locale;
		if (typeof document !== 'undefined') return document.documentElement.lang || undefined;
		return undefined;
	}

	const digital = $derived(
		now.toLocaleTimeString(getLocale(), {
			hour: hour12 ? 'numeric' : '2-digit',
			minute: '2-digit',
			second: seconds ? '2-digit' : undefined,
			hour12
		})
	);

	const analogKind = $derived(
		clockStyle === 'classic' ||
			clockStyle === 'luxury_gold' ||
			clockStyle === 'luxury_steel' ||
			clockStyle === 'minimal' ||
			clockStyle === 'dark' ||
			clockStyle === 'dots' ||
			clockStyle === 'aurora'
			? clockStyle
			: analogStyle === 1
				? 'aurora'
				: analogStyle === 2
					? 'luxury_gold'
					: analogStyle === 3
						? 'luxury_steel'
						: 'minimal'
	);
</script>

<div class={`clock-card ${compact ? 'compact' : ''}`}>
	{#if showAnalog}
		<div class="analog-wrap">
			<div class="glass-disc" aria-hidden="true"></div>
			<div class="ambient-glow" aria-hidden="true"></div>
			{#if seconds}
				<svg class="seconds-ring" viewBox="0 0 200 200" aria-hidden="true">
					<circle cx="100" cy="100" r="94" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="0.6"/>
					<circle cx="100" cy="100" r="94" fill="none" stroke="url(#secondsGrad)" stroke-width="1.2" stroke-linecap="round"
						stroke-dasharray={`${(secondDeg / 360) * 590.6} 590.6`}
						transform="rotate(-90 100 100)"/>
					<defs>
						<linearGradient id="secondsGrad" x1="0" y1="0" x2="1" y2="1">
							<stop offset="0%" stop-color="rgba(96,165,250,0)"/>
							<stop offset="100%" stop-color="rgba(96,165,250,0.85)"/>
						</linearGradient>
					</defs>
				</svg>
			{/if}
			<svg
				viewBox="0 0 200 200"
				xmlns="http://www.w3.org/2000/svg"
				class={`clock clock-${analogKind}`}
			>
				{#if analogKind === 'classic'}
					<defs>
						<radialGradient id="classic-face" cx="50%" cy="42%" r="64%">
							<stop offset="0%" stop-color="#fffef9" />
							<stop offset="72%" stop-color="#f3efe6" />
							<stop offset="100%" stop-color="#e6decf" />
						</radialGradient>
						<linearGradient id="classic-bezel" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stop-color="#f4f1e9" />
							<stop offset="48%" stop-color="#c4b69c" />
							<stop offset="100%" stop-color="#8f7b57" />
						</linearGradient>
						<radialGradient id="classic-glass" cx="34%" cy="26%" r="58%">
							<stop offset="0%" stop-color="rgba(255,255,255,0.52)" />
							<stop offset="46%" stop-color="rgba(255,255,255,0.12)" />
							<stop offset="100%" stop-color="rgba(255,255,255,0)" />
						</radialGradient>
					</defs>

					<circle cx="100" cy="100" r="99" fill="#2e2718" />
					<circle cx="100" cy="100" r="96" fill="url(#classic-bezel)" />
					<circle cx="100" cy="100" r="88" fill="url(#classic-face)" stroke="#8d7a57" stroke-width="1.2" />
					<circle cx="100" cy="100" r="84.5" fill="none" stroke="rgba(70,56,35,0.26)" stroke-width="0.8" />

					{#each Array(60) as _, i}
						{@const angle = i * 6 - 90}
						{@const isHour = i % 5 === 0}
						{@const r1 = isHour ? 77 : 81}
						{@const r2 = 86}
						{@const x1 = 100 + r1 * Math.cos((angle * Math.PI) / 180)}
						{@const y1 = 100 + r1 * Math.sin((angle * Math.PI) / 180)}
						{@const x2 = 100 + r2 * Math.cos((angle * Math.PI) / 180)}
						{@const y2 = 100 + r2 * Math.sin((angle * Math.PI) / 180)}
						<line
							{x1}
							{y1}
							{x2}
							{y2}
							stroke={isHour ? '#473725' : 'rgba(71,55,37,0.58)'}
							stroke-width={isHour ? 2.2 : 0.8}
						/>
					{/each}

					{#each [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as n, i}
						{@const angle = (i * 30 - 90) * (Math.PI / 180)}
						{@const x = 100 + 66.5 * Math.cos(angle)}
						{@const y = 100 + 66.5 * Math.sin(angle)}
						<text
							{x}
							{y}
							text-anchor="middle"
							dominant-baseline="central"
							font-size="12.5"
							font-weight="600"
							fill="#2e2418"
							font-family="Inter, Arial, sans-serif"
						>
							{n}
						</text>
					{/each}

					<line
						x1={100 - 8 * Math.sin((hourDeg * Math.PI) / 180)}
						y1={100 + 8 * Math.cos((hourDeg * Math.PI) / 180)}
						x2={100 + 46 * Math.sin((hourDeg * Math.PI) / 180)}
						y2={100 - 46 * Math.cos((hourDeg * Math.PI) / 180)}
						stroke="#201a12"
						stroke-width="6"
						stroke-linecap="round"
					/>
					<line
						x1={100 - 10 * Math.sin((minuteDeg * Math.PI) / 180)}
						y1={100 + 10 * Math.cos((minuteDeg * Math.PI) / 180)}
						x2={100 + 64 * Math.sin((minuteDeg * Math.PI) / 180)}
						y2={100 - 64 * Math.cos((minuteDeg * Math.PI) / 180)}
						stroke="#252015"
						stroke-width="3.8"
						stroke-linecap="round"
					/>
					{#if seconds}
						<line
							x1={100 - 18 * Math.sin((secondDeg * Math.PI) / 180)}
							y1={100 + 18 * Math.cos((secondDeg * Math.PI) / 180)}
							x2={100 + 72 * Math.sin((secondDeg * Math.PI) / 180)}
							y2={100 - 72 * Math.cos((secondDeg * Math.PI) / 180)}
							stroke="#b51d17"
							stroke-width="1.6"
							stroke-linecap="round"
						/>
						<circle
							cx={100 + 74 * Math.sin((secondDeg * Math.PI) / 180)}
							cy={100 - 74 * Math.cos((secondDeg * Math.PI) / 180)}
							r="2.1"
							fill="#b51d17"
						/>
					{/if}
					<circle cx="100" cy="100" r="6.1" fill="#d8c39d" stroke="#6a5535" stroke-width="1" />
					<circle cx="100" cy="100" r="2.9" fill="#241d14" />
					<circle cx="100" cy="100" r="84.5" fill="url(#classic-glass)" />
				{:else if analogKind === 'luxury_gold'}
					<defs>
						<radialGradient id="luxury-gold-face" cx="50%" cy="36%" r="68%">
							<stop offset="0%" stop-color="#fff9ef" />
							<stop offset="65%" stop-color="#efe2c7" />
							<stop offset="100%" stop-color="#ccb789" />
						</radialGradient>
						<linearGradient id="luxury-gold-bezel" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stop-color="#f7ecd1" />
							<stop offset="45%" stop-color="#c9a86e" />
							<stop offset="100%" stop-color="#7f6436" />
						</linearGradient>
						<radialGradient id="luxury-gold-glass" cx="36%" cy="24%" r="62%">
							<stop offset="0%" stop-color="rgba(255,255,255,0.62)" />
							<stop offset="34%" stop-color="rgba(255,255,255,0.22)" />
							<stop offset="100%" stop-color="rgba(255,255,255,0)" />
						</radialGradient>
						<filter id="luxury-gold-text-shadow" x="-20%" y="-20%" width="140%" height="140%">
							<feDropShadow
								dx="0.18"
								dy="0.55"
								stdDeviation="0.45"
								flood-color="#2d1f0c"
								flood-opacity="0.24"
							/>
						</filter>
						<filter id="luxury-gold-hand-shadow" x="-20%" y="-20%" width="140%" height="140%">
							<feDropShadow
								dx="0.25"
								dy="0.8"
								stdDeviation="0.7"
								flood-color="#1f1408"
								flood-opacity="0.36"
							/>
						</filter>
					</defs>

					<circle cx="100" cy="100" r="99" fill="#2c1e0d" />
					<circle cx="100" cy="100" r="96" fill="url(#luxury-gold-bezel)" />
					<circle cx="100" cy="100" r="87.5" fill="url(#luxury-gold-face)" stroke="#8e6e35" stroke-width="1.5" />
					<circle cx="100" cy="100" r="82.5" fill="none" stroke="rgba(73,50,16,0.35)" stroke-width="0.7" />

					{#each Array(60) as _, i}
						{@const angle = i * 6 - 90}
						{@const isHour = i % 5 === 0}
						{@const r1 = isHour ? 75.5 : 80}
						{@const r2 = 85}
						{@const x1 = 100 + r1 * Math.cos((angle * Math.PI) / 180)}
						{@const y1 = 100 + r1 * Math.sin((angle * Math.PI) / 180)}
						{@const x2 = 100 + r2 * Math.cos((angle * Math.PI) / 180)}
						{@const y2 = 100 + r2 * Math.sin((angle * Math.PI) / 180)}
						<line
							{x1}
							{y1}
							{x2}
							{y2}
							stroke={isHour ? '#593f18' : 'rgba(89,63,24,0.56)'}
							stroke-width={isHour ? 2.1 : 0.8}
						/>
					{/each}

					{#each [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as n, i}
						{@const angle = (i * 30 - 90) * (Math.PI / 180)}
						{@const x = 100 + 66 * Math.cos(angle)}
						{@const y = 100 + 66 * Math.sin(angle)}
						<text
							{x}
							{y}
							text-anchor="middle"
							dominant-baseline="central"
							font-size="14.2"
							font-weight="700"
							fill="#3f2b0f"
							font-family="Inter, Arial, sans-serif"
							filter="url(#luxury-gold-text-shadow)"
						>
							{n}
						</text>
					{/each}

					<line
						x1={100 - 8 * Math.sin((hourDeg * Math.PI) / 180)}
						y1={100 + 8 * Math.cos((hourDeg * Math.PI) / 180)}
						x2={100 + 44 * Math.sin((hourDeg * Math.PI) / 180)}
						y2={100 - 44 * Math.cos((hourDeg * Math.PI) / 180)}
						stroke="#2a1d0d"
						stroke-width="6.2"
						stroke-linecap="round"
						filter="url(#luxury-gold-hand-shadow)"
					/>
					<line
						x1={100 - 10 * Math.sin((minuteDeg * Math.PI) / 180)}
						y1={100 + 10 * Math.cos((minuteDeg * Math.PI) / 180)}
						x2={100 + 63 * Math.sin((minuteDeg * Math.PI) / 180)}
						y2={100 - 63 * Math.cos((minuteDeg * Math.PI) / 180)}
						stroke="#3b2a14"
						stroke-width="3.8"
						stroke-linecap="round"
						filter="url(#luxury-gold-hand-shadow)"
					/>
					{#if seconds}
						<line
							x1={100 - 18 * Math.sin((secondDeg * Math.PI) / 180)}
							y1={100 + 18 * Math.cos((secondDeg * Math.PI) / 180)}
							x2={100 + 72 * Math.sin((secondDeg * Math.PI) / 180)}
							y2={100 - 72 * Math.cos((secondDeg * Math.PI) / 180)}
							stroke="#b92d1a"
							stroke-width="1.2"
							stroke-linecap="round"
						/>
					{/if}
					<circle cx="100" cy="100" r="6.4" fill="#f0d08f" stroke="#7a5826" stroke-width="1.2" />
					<circle cx="100" cy="100" r="2.6" fill="#2a1b0e" />
					<circle cx="100" cy="100" r="85.5" fill="url(#luxury-gold-glass)" />
				{:else if analogKind === 'luxury_steel'}
					<defs>
						<radialGradient id="luxury-steel-face" cx="50%" cy="34%" r="68%">
							<stop offset="0%" stop-color="#f7f9fc" />
							<stop offset="60%" stop-color="#e5eaf1" />
							<stop offset="100%" stop-color="#b5c0ce" />
						</radialGradient>
						<linearGradient id="luxury-steel-bezel" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stop-color="#edf1f6" />
							<stop offset="45%" stop-color="#94a2b1" />
							<stop offset="100%" stop-color="#596879" />
						</linearGradient>
						<radialGradient id="luxury-steel-glass" cx="35%" cy="24%" r="62%">
							<stop offset="0%" stop-color="rgba(255,255,255,0.56)" />
							<stop offset="34%" stop-color="rgba(255,255,255,0.2)" />
							<stop offset="100%" stop-color="rgba(255,255,255,0)" />
						</radialGradient>
						<filter id="luxury-steel-text-shadow" x="-20%" y="-20%" width="140%" height="140%">
							<feDropShadow
								dx="0.15"
								dy="0.5"
								stdDeviation="0.45"
								flood-color="#1b2a38"
								flood-opacity="0.24"
							/>
						</filter>
						<filter id="luxury-steel-hand-shadow" x="-20%" y="-20%" width="140%" height="140%">
							<feDropShadow
								dx="0.25"
								dy="0.8"
								stdDeviation="0.7"
								flood-color="#15202c"
								flood-opacity="0.35"
							/>
						</filter>
					</defs>

					<circle cx="100" cy="100" r="99" fill="#1e2834" />
					<circle cx="100" cy="100" r="96" fill="url(#luxury-steel-bezel)" />
					<circle cx="100" cy="100" r="87.5" fill="url(#luxury-steel-face)" stroke="#607285" stroke-width="1.5" />
					<circle cx="100" cy="100" r="82.5" fill="none" stroke="rgba(40,58,74,0.33)" stroke-width="0.7" />

					{#each Array(60) as _, i}
						{@const angle = i * 6 - 90}
						{@const isHour = i % 5 === 0}
						{@const r1 = isHour ? 75.5 : 80}
						{@const r2 = 85}
						{@const x1 = 100 + r1 * Math.cos((angle * Math.PI) / 180)}
						{@const y1 = 100 + r1 * Math.sin((angle * Math.PI) / 180)}
						{@const x2 = 100 + r2 * Math.cos((angle * Math.PI) / 180)}
						{@const y2 = 100 + r2 * Math.sin((angle * Math.PI) / 180)}
						<line
							{x1}
							{y1}
							{x2}
							{y2}
							stroke={isHour ? '#35485d' : 'rgba(53,72,93,0.58)'}
							stroke-width={isHour ? 2.1 : 0.8}
						/>
					{/each}

					{#each [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as n, i}
						{@const angle = (i * 30 - 90) * (Math.PI / 180)}
						{@const x = 100 + 66 * Math.cos(angle)}
						{@const y = 100 + 66 * Math.sin(angle)}
						<text
							{x}
							{y}
							text-anchor="middle"
							dominant-baseline="central"
							font-size="14.2"
							font-weight="700"
							fill="#24374c"
							font-family="Inter, Arial, sans-serif"
							filter="url(#luxury-steel-text-shadow)"
						>
							{n}
						</text>
					{/each}

					<line
						x1={100 - 8 * Math.sin((hourDeg * Math.PI) / 180)}
						y1={100 + 8 * Math.cos((hourDeg * Math.PI) / 180)}
						x2={100 + 44 * Math.sin((hourDeg * Math.PI) / 180)}
						y2={100 - 44 * Math.cos((hourDeg * Math.PI) / 180)}
						stroke="#1f2f41"
						stroke-width="6.2"
						stroke-linecap="round"
						filter="url(#luxury-steel-hand-shadow)"
					/>
					<line
						x1={100 - 10 * Math.sin((minuteDeg * Math.PI) / 180)}
						y1={100 + 10 * Math.cos((minuteDeg * Math.PI) / 180)}
						x2={100 + 63 * Math.sin((minuteDeg * Math.PI) / 180)}
						y2={100 - 63 * Math.cos((minuteDeg * Math.PI) / 180)}
						stroke="#2a3f55"
						stroke-width="3.8"
						stroke-linecap="round"
						filter="url(#luxury-steel-hand-shadow)"
					/>
					{#if seconds}
						<line
							x1={100 - 18 * Math.sin((secondDeg * Math.PI) / 180)}
							y1={100 + 18 * Math.cos((secondDeg * Math.PI) / 180)}
							x2={100 + 72 * Math.sin((secondDeg * Math.PI) / 180)}
							y2={100 - 72 * Math.cos((secondDeg * Math.PI) / 180)}
							stroke="#c43f2c"
							stroke-width="1.2"
							stroke-linecap="round"
						/>
					{/if}
					<circle cx="100" cy="100" r="6.4" fill="#d2deea" stroke="#62758b" stroke-width="1.2" />
					<circle cx="100" cy="100" r="2.6" fill="#1f2e3f" />
					<circle cx="100" cy="100" r="85.5" fill="url(#luxury-steel-glass)" />
				{:else if analogKind === 'dark'}
					<circle cx="100" cy="100" r="98" fill="#1a1a2e" />
					<circle cx="100" cy="100" r="97" fill="none" stroke="#4fc3f7" stroke-width="0.8" opacity="0.4" />

					{#each Array(60) as _, i}
						{@const angle = i * 6 - 90}
						{@const isHour = i % 5 === 0}
						{@const r1 = isHour ? 81 : 88}
						{@const x1 = 100 + r1 * Math.cos((angle * Math.PI) / 180)}
						{@const y1 = 100 + r1 * Math.sin((angle * Math.PI) / 180)}
						{@const x2 = 100 + 93 * Math.cos((angle * Math.PI) / 180)}
						{@const y2 = 100 + 93 * Math.sin((angle * Math.PI) / 180)}
						<line
							{x1}
							{y1}
							{x2}
							{y2}
							stroke={isHour ? '#4fc3f7' : 'rgba(255,255,255,0.2)'}
							stroke-width={isHour ? 2 : 0.8}
						/>
					{/each}

					{#each [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as n, i}
						{@const angle = (i * 30 - 90) * (Math.PI / 180)}
						{@const x = 100 + 70 * Math.cos(angle)}
						{@const y = 100 + 70 * Math.sin(angle)}
						<text
							{x}
							{y}
							text-anchor="middle"
							dominant-baseline="central"
							font-size="11"
							font-weight="500"
							fill="#4fc3f7"
							font-family="Arial, sans-serif"
							opacity="0.9"
						>
							{n}
						</text>
					{/each}

					<line
						x1={100 - 8 * Math.sin((hourDeg * Math.PI) / 180)}
						y1={100 + 8 * Math.cos((hourDeg * Math.PI) / 180)}
						x2={100 + 53 * Math.sin((hourDeg * Math.PI) / 180)}
						y2={100 - 53 * Math.cos((hourDeg * Math.PI) / 180)}
						stroke="white"
						stroke-width="4"
						stroke-linecap="round"
					/>
					<line
						x1={100 - 10 * Math.sin((minuteDeg * Math.PI) / 180)}
						y1={100 + 10 * Math.cos((minuteDeg * Math.PI) / 180)}
						x2={100 + 70 * Math.sin((minuteDeg * Math.PI) / 180)}
						y2={100 - 70 * Math.cos((minuteDeg * Math.PI) / 180)}
						stroke="#4fc3f7"
						stroke-width="2.5"
						stroke-linecap="round"
					/>
					{#if seconds}
						<line
							x1={100 - 15 * Math.sin((secondDeg * Math.PI) / 180)}
							y1={100 + 15 * Math.cos((secondDeg * Math.PI) / 180)}
							x2={100 + 78 * Math.sin((secondDeg * Math.PI) / 180)}
							y2={100 - 78 * Math.cos((secondDeg * Math.PI) / 180)}
							stroke="#f5a623"
							stroke-width="1.5"
							stroke-linecap="round"
						/>
					{/if}
					<circle cx="100" cy="100" r="4" fill="#4fc3f7" />
					{#if seconds}<circle cx="100" cy="100" r="2.5" fill="#f5a623" />{/if}
				{:else if analogKind === 'dots'}
					<circle
						cx="100"
						cy="100"
						r="96"
						fill="rgba(255,255,255,0.06)"
						stroke="rgba(255,255,255,0.15)"
						stroke-width="1"
					/>

					{#each Array(12) as _, i}
						{@const angle = (i * 30 - 90) * (Math.PI / 180)}
						{@const x = 100 + 85 * Math.cos(angle)}
						{@const y = 100 + 85 * Math.sin(angle)}
						<circle
							cx={x}
							cy={y}
							r={i % 3 === 0 ? 3.5 : 2}
							fill={i % 3 === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)'}
						/>
					{/each}

					<line
						x1={100 - 6 * Math.sin((hourDeg * Math.PI) / 180)}
						y1={100 + 6 * Math.cos((hourDeg * Math.PI) / 180)}
						x2={100 + 52 * Math.sin((hourDeg * Math.PI) / 180)}
						y2={100 - 52 * Math.cos((hourDeg * Math.PI) / 180)}
						stroke="rgba(255,255,255,0.95)"
						stroke-width="6"
						stroke-linecap="round"
					/>
					<line
						x1={100 - 10 * Math.sin((minuteDeg * Math.PI) / 180)}
						y1={100 + 10 * Math.cos((minuteDeg * Math.PI) / 180)}
						x2={100 + 72 * Math.sin((minuteDeg * Math.PI) / 180)}
						y2={100 - 72 * Math.cos((minuteDeg * Math.PI) / 180)}
						stroke="rgba(255,255,255,0.7)"
						stroke-width="3"
						stroke-linecap="round"
					/>
					{#if seconds}
						<line
							x1={100 - 14 * Math.sin((secondDeg * Math.PI) / 180)}
							y1={100 + 14 * Math.cos((secondDeg * Math.PI) / 180)}
							x2={100 + 76 * Math.sin((secondDeg * Math.PI) / 180)}
							y2={100 - 76 * Math.cos((secondDeg * Math.PI) / 180)}
							stroke="#f5a623"
							stroke-width="1.5"
							stroke-linecap="round"
						/>
					{/if}
					<circle cx="100" cy="100" r="5" fill="rgba(255,255,255,0.9)" />
					{#if seconds}<circle cx="100" cy="100" r="2.5" fill="#f5a623" />{/if}
				{:else}
					<circle cx="100" cy="100" r="96" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1" />

					{#each [0, 90, 180, 270] as angle}
						{@const x1 = 100 + 88 * Math.cos(((angle - 90) * Math.PI) / 180)}
						{@const y1 = 100 + 88 * Math.sin(((angle - 90) * Math.PI) / 180)}
						{@const x2 = 100 + 96 * Math.cos(((angle - 90) * Math.PI) / 180)}
						{@const y2 = 100 + 96 * Math.sin(((angle - 90) * Math.PI) / 180)}
						<line {x1} {y1} {x2} {y2} stroke="rgba(255,255,255,0.5)" stroke-width="2.5" />
					{/each}

					<line
						x1={100 - 8 * Math.sin((hourDeg * Math.PI) / 180)}
						y1={100 + 8 * Math.cos((hourDeg * Math.PI) / 180)}
						x2={100 + 55 * Math.sin((hourDeg * Math.PI) / 180)}
						y2={100 - 55 * Math.cos((hourDeg * Math.PI) / 180)}
						stroke="white"
						stroke-width="3.5"
						stroke-linecap="round"
					/>
					<line
						x1={100 - 12 * Math.sin((minuteDeg * Math.PI) / 180)}
						y1={100 + 12 * Math.cos((minuteDeg * Math.PI) / 180)}
						x2={100 + 75 * Math.sin((minuteDeg * Math.PI) / 180)}
						y2={100 - 75 * Math.cos((minuteDeg * Math.PI) / 180)}
						stroke="white"
						stroke-width="2"
						stroke-linecap="round"
					/>
					{#if seconds}
						<line
							x1={100 - 15 * Math.sin((secondDeg * Math.PI) / 180)}
							y1={100 + 15 * Math.cos((secondDeg * Math.PI) / 180)}
							x2={100 + 78 * Math.sin((secondDeg * Math.PI) / 180)}
							y2={100 - 78 * Math.cos((secondDeg * Math.PI) / 180)}
							stroke="#f5a623"
							stroke-width="1.5"
							stroke-linecap="round"
						/>
					{/if}
					<circle cx="100" cy="100" r="3.5" fill="white" />
					{#if seconds}<circle cx="100" cy="100" r="2" fill="#f5a623" />{/if}
				{:else if analogKind === 'aurora'}
					<defs>
						<!-- Outer glass bezel with conic gradient -->
						<radialGradient id="aurora-bezel" cx="50%" cy="40%" r="65%">
							<stop offset="0%" stop-color="rgba(40,52,80,0.85)" />
							<stop offset="60%" stop-color="rgba(20,28,48,0.95)" />
							<stop offset="100%" stop-color="rgba(10,14,28,1)" />
						</radialGradient>
						<!-- Face inner gradient -->
						<radialGradient id="aurora-face" cx="50%" cy="42%" r="60%">
							<stop offset="0%" stop-color="rgba(30,42,72,0.55)" />
							<stop offset="55%" stop-color="rgba(15,22,42,0.85)" />
							<stop offset="100%" stop-color="rgba(8,12,24,0.95)" />
						</radialGradient>
						<!-- Highlight reflection on top of glass -->
						<radialGradient id="aurora-glass" cx="35%" cy="22%" r="50%">
							<stop offset="0%" stop-color="rgba(255,255,255,0.18)" />
							<stop offset="60%" stop-color="rgba(255,255,255,0.04)" />
							<stop offset="100%" stop-color="rgba(255,255,255,0)" />
						</radialGradient>
						<!-- Hour hand gradient — solid white -->
						<linearGradient id="aurora-hour" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stop-color="#ffffff" />
							<stop offset="100%" stop-color="#a8c5ff" />
						</linearGradient>
						<!-- Minute hand gradient — cyan glow -->
						<linearGradient id="aurora-minute" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stop-color="#ffffff" />
							<stop offset="50%" stop-color="#7dd3fc" />
							<stop offset="100%" stop-color="#22d3ee" />
						</linearGradient>
						<!-- Second hand — orange-amber accent -->
						<linearGradient id="aurora-second" x1="0%" y1="0%" x2="0%" y2="100%">
							<stop offset="0%" stop-color="#fde68a" />
							<stop offset="100%" stop-color="#f59e0b" />
						</linearGradient>
						<!-- Glow filter for hands -->
						<filter id="aurora-glow" x="-50%" y="-50%" width="200%" height="200%">
							<feGaussianBlur stdDeviation="2" result="blur"/>
							<feMerge>
								<feMergeNode in="blur"/>
								<feMergeNode in="SourceGraphic"/>
							</feMerge>
						</filter>
					</defs>

					<!-- Outer ring -->
					<circle cx="100" cy="100" r="99" fill="url(#aurora-bezel)" />
					<!-- Thin gradient ring (color rim) -->
					<circle cx="100" cy="100" r="96" fill="none" stroke="url(#aurora-minute)" stroke-width="0.6" opacity="0.45"/>
					<circle cx="100" cy="100" r="93" fill="url(#aurora-face)" />

					<!-- Faint inner ring track -->
					<circle cx="100" cy="100" r="80" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="0.5"/>

					<!-- 60 minute ticks: glowing where hour, faded otherwise -->
					{#each Array(60) as _, i}
						{@const angle = i * 6 - 90}
						{@const isHour = i % 5 === 0}
						{@const r1 = isHour ? 78 : 84}
						{@const r2 = isHour ? 88 : 87}
						{@const x1 = 100 + r1 * Math.cos((angle * Math.PI) / 180)}
						{@const y1 = 100 + r1 * Math.sin((angle * Math.PI) / 180)}
						{@const x2 = 100 + r2 * Math.cos((angle * Math.PI) / 180)}
						{@const y2 = 100 + r2 * Math.sin((angle * Math.PI) / 180)}
						<line
							{x1}
							{y1}
							{x2}
							{y2}
							stroke={isHour ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.18)'}
							stroke-width={isHour ? 2 : 0.8}
							stroke-linecap="round"
						/>
					{/each}

					<!-- 12, 3, 6, 9 emphasis dots — pulsing -->
					{#each [0, 3, 6, 9] as i}
						{@const angle = (i * 30 - 90) * (Math.PI / 180)}
						{@const x = 100 + 92 * Math.cos(angle)}
						{@const y = 100 + 92 * Math.sin(angle)}
						<circle cx={x} cy={y} r="1.6" fill="#7dd3fc">
							<animate attributeName="opacity" values="1;0.4;1" dur="3s" repeatCount="indefinite" begin={`${i * 0.3}s`}/>
						</circle>
					{/each}

					<!-- Concentric subtle rings at center -->
					<circle cx="100" cy="100" r="22" fill="none" stroke="rgba(125,211,252,0.10)" stroke-width="0.5"/>
					<circle cx="100" cy="100" r="14" fill="none" stroke="rgba(125,211,252,0.18)" stroke-width="0.5"/>

					<!-- HOUR hand — wide white blade -->
					<g filter="url(#aurora-glow)">
						<line
							x1={100 - 6 * Math.sin((hourDeg * Math.PI) / 180)}
							y1={100 + 6 * Math.cos((hourDeg * Math.PI) / 180)}
							x2={100 + 48 * Math.sin((hourDeg * Math.PI) / 180)}
							y2={100 - 48 * Math.cos((hourDeg * Math.PI) / 180)}
							stroke="url(#aurora-hour)"
							stroke-width="5"
							stroke-linecap="round"
							opacity="0.95"
						/>
					</g>

					<!-- MINUTE hand — cyan with tip glow -->
					<g filter="url(#aurora-glow)">
						<line
							x1={100 - 8 * Math.sin((minuteDeg * Math.PI) / 180)}
							y1={100 + 8 * Math.cos((minuteDeg * Math.PI) / 180)}
							x2={100 + 70 * Math.sin((minuteDeg * Math.PI) / 180)}
							y2={100 - 70 * Math.cos((minuteDeg * Math.PI) / 180)}
							stroke="url(#aurora-minute)"
							stroke-width="3"
							stroke-linecap="round"
						/>
						<!-- Tip dot for extra glow -->
						<circle
							cx={100 + 70 * Math.sin((minuteDeg * Math.PI) / 180)}
							cy={100 - 70 * Math.cos((minuteDeg * Math.PI) / 180)}
							r="2"
							fill="#7dd3fc"
							opacity="0.85"
						/>
					</g>

					<!-- SECOND hand — thin amber -->
					{#if seconds}
						<g filter="url(#aurora-glow)">
							<line
								x1={100 - 18 * Math.sin((secondDeg * Math.PI) / 180)}
								y1={100 + 18 * Math.cos((secondDeg * Math.PI) / 180)}
								x2={100 + 80 * Math.sin((secondDeg * Math.PI) / 180)}
								y2={100 - 80 * Math.cos((secondDeg * Math.PI) / 180)}
								stroke="url(#aurora-second)"
								stroke-width="1.4"
								stroke-linecap="round"
							/>
							<!-- Counterweight back-tip -->
							<circle
								cx={100 - 18 * Math.sin((secondDeg * Math.PI) / 180)}
								cy={100 + 18 * Math.cos((secondDeg * Math.PI) / 180)}
								r="2.2"
								fill="#f59e0b"
							/>
						</g>
					{/if}

					<!-- Center hub: layered for depth -->
					<circle cx="100" cy="100" r="6" fill="#0a0e1c"/>
					<circle cx="100" cy="100" r="5" fill="url(#aurora-minute)"/>
					<circle cx="100" cy="100" r="3.2" fill="#0a0e1c"/>
					<circle cx="100" cy="100" r="1.8" fill="#7dd3fc"/>

					<!-- Glass reflection overlay on top -->
					<circle cx="100" cy="100" r="93" fill="url(#aurora-glass)" pointer-events="none"/>
				{/if}
			</svg>
		</div>
	{/if}
	{#if showDigital}
		<div class={`digital digital-${digitalStyle}`}>
			{digital}
		</div>
	{/if}
</div>

<style>
	.clock-card {
		display: grid;
		gap: 14px;
		justify-items: center;
		padding: 8px 4px;
		/* Clip horizontally so blurred ambient glow can't widen the layout
		   while still allowing the clock to render in full vertically. */
		overflow-x: clip;
	}

	.clock-card.compact {
		gap: 10px;
	}

	.analog-wrap {
		display: flex;
		justify-content: center;
		align-items: center;
		padding: 18px 14px 22px;
		width: 100%;
		position: relative;
		isolation: isolate;
		overflow: visible;
	}

	/* Glass disc — frosted backdrop behind the clock */
	.glass-disc {
		position: absolute;
		top: 50%; left: 50%;
		transform: translate(-50%, -50%);
		width: min(96%, 200px);
		aspect-ratio: 1;
		border-radius: 50%;
		background: radial-gradient(circle at 30% 25%, rgba(255,255,255,0.05), rgba(255,255,255,0.01) 60%);
		border: 0.5px solid rgba(255,255,255,0.06);
		box-shadow:
			inset 0 1px 0 rgba(255,255,255,0.07),
			inset 0 -1px 0 rgba(0,0,0,0.3),
			0 12px 40px rgba(0,0,0,0.45);
		backdrop-filter: blur(12px) saturate(1.1);
		-webkit-backdrop-filter: blur(12px) saturate(1.1);
		pointer-events: none;
		z-index: 0;
		transition: transform 0.5s ease, box-shadow 0.5s ease;
	}
	.clock-card:hover .glass-disc {
		transform: translate(-50%, -50%) scale(1.03);
		box-shadow:
			inset 0 1px 0 rgba(255,255,255,0.12),
			inset 0 -1px 0 rgba(0,0,0,0.3),
			0 16px 50px rgba(0,0,0,0.55),
			0 0 40px rgba(96,165,250,0.18);
	}

	/* In compact (sidebar) mode, drop the glass-disc and ambient-glow so the
	   aurora clock sits directly on the sidebar background without an extra tile. */
	.clock-card.compact .glass-disc,
	.clock-card.compact .ambient-glow {
		display: none;
	}

	/* Multi-color ambient glow — slow rotating radial */
	.ambient-glow {
		position: absolute;
		top: 50%; left: 50%;
		transform: translate(-50%, -50%);
		width: 100%;
		aspect-ratio: 1;
		max-width: 100%;
		border-radius: 50%;
		background:
			radial-gradient(circle at 30% 30%, rgba(96,165,250,0.30), transparent 50%),
			radial-gradient(circle at 70% 70%, rgba(167,139,250,0.22), transparent 50%),
			radial-gradient(circle at 50% 90%, rgba(34,211,238,0.18), transparent 55%);
		filter: blur(30px);
		pointer-events: none;
		z-index: -1;
		opacity: 0.85;
		animation: glow-rotate 20s linear infinite;
	}
	@keyframes glow-rotate {
		from { transform: translate(-50%, -50%) rotate(0deg); }
		to { transform: translate(-50%, -50%) rotate(360deg); }
	}

	/* Seconds ring — thin progress ring around the clock */
	.seconds-ring {
		position: absolute;
		top: 50%; left: 50%;
		transform: translate(-50%, -50%);
		width: 100%;
		max-width: 188px;
		height: auto;
		aspect-ratio: 1;
		pointer-events: none;
		z-index: 1;
		filter: drop-shadow(0 0 4px rgba(96,165,250,0.4));
	}
	.clock-card.compact .seconds-ring {
		max-width: 158px;
	}

	.clock {
		width: 100%;
		max-width: 168px;
		height: auto;
		display: block;
		filter:
			drop-shadow(0 10px 28px rgba(0, 0, 0, 0.55))
			drop-shadow(0 0 18px rgba(96,165,250,0.18))
			drop-shadow(0 0 1px rgba(255,255,255,0.10));
		position: relative;
		z-index: 2;
		transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
	}
	.clock-card:hover .clock {
		transform: translateY(-2px) scale(1.025);
	}

	.clock-card.compact .clock {
		max-width: 138px;
	}

	.digital {
		padding: 6px 12px;
		font-weight: 200;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.025em;
		color: #fff;
		text-shadow:
			0 2px 16px rgba(0,0,0,0.4),
			0 0 32px rgba(96,165,250,0.30),
			0 0 1px rgba(255,255,255,0.20);
		position: relative;
		z-index: 1;
	}

	.clock-card.compact .digital {
		padding: 4px 9px;
	}

	.digital-1 {
		font-size: 2.8rem;
		line-height: 1;
	}

	.digital-2 {
		font-size: 2.5rem;
		line-height: 1;
	}

	.digital-3 {
		font-size: 2.2rem;
		line-height: 1;
	}

	.digital-4 {
		font-size: 1.95rem;
		line-height: 1;
	}
</style>
