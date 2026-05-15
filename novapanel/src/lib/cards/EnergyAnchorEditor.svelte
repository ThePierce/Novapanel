<script lang="ts">
	import type { EnergyAnchors, EnergyFlowKey, EnergyFlowWaypoints } from '$lib/persistence/panel-state-types';
	import { selectedLanguageStore, translate } from '$lib/i18n';

	type Props = {
		bgUrl: string;
		variantLabel: string;
		initialAnchors?: EnergyAnchors;
		onSave: (anchors: EnergyAnchors) => void;
		onCancel: () => void;
	};

	let { bgUrl, variantLabel, initialAnchors, onSave, onCancel }: Props = $props();

	const DEFAULTS: EnergyAnchors = {
		solar: { x: 0.576, y: 0.264 },
		battery: { x: 0.423, y: 0.332 },
		door: { x: 0.371, y: 0.669 },
		car: { x: 0.394, y: 0.684 },
		street: { x: -0.013, y: 0.898 },
		railX: 0.404
	};

	let anchors = $state<EnergyAnchors>(
		initialAnchors
			? JSON.parse(JSON.stringify(initialAnchors))
			: JSON.parse(JSON.stringify(DEFAULTS))
	);

	type AnchorKey = 'solar' | 'battery' | 'door' | 'car' | 'street' | 'railX';
	type Mode =
		| { kind: 'anchor'; key: AnchorKey }
		| { kind: 'flow'; key: EnergyFlowKey };
	let mode = $state<Mode>({ kind: 'anchor', key: 'solar' });

	const ANCHOR_LABELS: Record<AnchorKey, string> = {
		solar: 'Zonnepanelen',
		battery: 'Accu',
		door: 'Voordeur',
		car: 'Auto-laadpunt',
		street: 'Straat / net',
		railX: 'Rail (fallback)'
	};
	const ANCHOR_COLORS: Record<AnchorKey, string> = {
		solar: '#facc15',
		battery: '#a855f7',
		door: '#f5f5f5',
		car: '#60a5fa',
		street: '#f87171',
		railX: '#c084fc'
	};

	type FlowDef = {
		key: EnergyFlowKey;
		label: string;
		color: string;
		from: AnchorKey;
		to: AnchorKey;
	};
	const FLOWS: FlowDef[] = [
		{ key: 'solarToBattery', label: 'Zon → Accu', color: '#22c55e', from: 'solar', to: 'battery' },
		{ key: 'solarToCar', label: 'Zon → Auto', color: '#22c55e', from: 'solar', to: 'car' },
		{ key: 'solarToHome', label: 'Zon → Huis', color: '#22c55e', from: 'solar', to: 'door' },
		{ key: 'solarToGrid', label: 'Zon → Net', color: '#06b6d4', from: 'solar', to: 'street' },
		{ key: 'gridToHome', label: 'Net → Huis', color: '#fb923c', from: 'street', to: 'door' },
		{ key: 'gridToCar', label: 'Net → Auto', color: '#fb923c', from: 'street', to: 'car' },
		{ key: 'gridToBattery', label: 'Net → Accu', color: '#fb923c', from: 'street', to: 'battery' },
		{ key: 'batteryToHome', label: 'Accu → Huis', color: '#a855f7', from: 'battery', to: 'door' },
		{ key: 'batteryToCar', label: 'Accu → Auto', color: '#a855f7', from: 'battery', to: 'car' }
	];

	function getAnchorPoint(key: AnchorKey): { x: number; y: number } {
		if (key === 'railX') return { x: anchors.railX, y: 0.5 };
		return anchors[key];
	}

	function clampPoint(x: number, y: number) {
		return {
			x: Math.max(-0.05, Math.min(1.05, x)),
			y: Math.max(-0.05, Math.min(1.05, y))
		};
	}
	function clampUnit(v: number) {
		return Math.max(0, Math.min(1, v));
	}

	let frameEl: HTMLDivElement | null = $state(null);

	function frameXY(e: MouseEvent | { clientX: number; clientY: number }) {
		if (!frameEl) return { x: 0, y: 0 };
		const rect = frameEl.getBoundingClientRect();
		return {
			x: (e.clientX - rect.left) / rect.width,
			y: (e.clientY - rect.top) / rect.height
		};
	}

	let didDrag = false;

	function handleFrameClick(e: MouseEvent) {
		if (didDrag) { didDrag = false; return; }
		const { x, y } = frameXY(e);
		if (mode.kind === 'anchor') {
			if (mode.key === 'railX') {
				anchors = { ...anchors, railX: clampUnit(x) };
			} else {
				anchors = { ...anchors, [mode.key]: clampPoint(x, y) };
			}
		} else {
			addWaypoint(mode.key, clampPoint(x, y));
		}
	}

	function getWaypoints(key: EnergyFlowKey): { x: number; y: number }[] {
		return anchors.flowWaypoints?.[key] ?? [];
	}

	function setWaypoints(key: EnergyFlowKey, points: { x: number; y: number }[]) {
		const next: EnergyFlowWaypoints = { ...(anchors.flowWaypoints ?? {}) };
		if (points.length === 0) {
			delete next[key];
		} else {
			next[key] = points;
		}
		anchors = { ...anchors, flowWaypoints: Object.keys(next).length > 0 ? next : undefined };
	}

	function pointToSegmentDist(p: {x:number;y:number}, a: {x:number;y:number}, b: {x:number;y:number}) {
		const dx = b.x - a.x;
		const dy = b.y - a.y;
		const len2 = dx*dx + dy*dy;
		if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
		let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
		t = Math.max(0, Math.min(1, t));
		const px = a.x + t*dx;
		const py = a.y + t*dy;
		return Math.hypot(p.x - px, p.y - py);
	}

	function addWaypoint(key: EnergyFlowKey, p: { x: number; y: number }) {
		const flow = FLOWS.find((f) => f.key === key);
		if (!flow) return;
		const start = getAnchorPoint(flow.from);
		const end = getAnchorPoint(flow.to);
		const existing = getWaypoints(key);
		const segments = [start, ...existing, end];
		let bestIdx = 0;
		let bestDist = Infinity;
		for (let i = 0; i < segments.length - 1; i++) {
			const a = segments[i];
			const b = segments[i + 1];
			const d = pointToSegmentDist(p, a, b);
			if (d < bestDist) { bestDist = d; bestIdx = i; }
		}
		const next = [...existing];
		next.splice(bestIdx, 0, p);
		setWaypoints(key, next);
	}

	function appendWaypoint(key: EnergyFlowKey) {
		const flow = FLOWS.find((f) => f.key === key);
		if (!flow) return;
		const start = getAnchorPoint(flow.from);
		const end = getAnchorPoint(flow.to);
		const existing = getWaypoints(key);
		const lastBefore = existing[existing.length - 1] ?? start;
		const mid = { x: (lastBefore.x + end.x) / 2, y: (lastBefore.y + end.y) / 2 };
		setWaypoints(key, [...existing, clampPoint(mid.x, mid.y)]);
	}

	function removeWaypoint(key: EnergyFlowKey, index: number) {
		const next = [...getWaypoints(key)];
		next.splice(index, 1);
		setWaypoints(key, next);
	}

	let dragging = $state<null | { kind: 'anchor'; key: AnchorKey } | { kind: 'waypoint'; flowKey: EnergyFlowKey; index: number }>(null);
	function startDragAnchor(key: AnchorKey, e: PointerEvent) {
		e.stopPropagation();
		dragging = { kind: 'anchor', key };
		didDrag = false;
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}
	function startDragWaypoint(flowKey: EnergyFlowKey, index: number, e: PointerEvent) {
		e.stopPropagation();
		dragging = { kind: 'waypoint', flowKey, index };
		didDrag = false;
		(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
	}
	function handlePointerMove(e: PointerEvent) {
		if (!dragging) return;
		didDrag = true;
		const { x, y } = frameXY(e);
		if (dragging.kind === 'anchor') {
			if (dragging.key === 'railX') {
				anchors = { ...anchors, railX: clampUnit(x) };
			} else {
				anchors = { ...anchors, [dragging.key]: clampPoint(x, y) };
			}
		} else {
			const next = [...getWaypoints(dragging.flowKey)];
			next[dragging.index] = clampPoint(x, y);
			setWaypoints(dragging.flowKey, next);
		}
	}
	function handlePointerUp() {
		dragging = null;
	}

	function resetAnchors() {
		if (!confirm('Alles terugzetten naar standaard? (verwijdert ook alle buigpunten)')) return;
		anchors = JSON.parse(JSON.stringify(DEFAULTS));
	}

	function clearWaypointsForCurrentFlow() {
		if (mode.kind !== 'flow') return;
		setWaypoints(mode.key, []);
	}

	function pct(v: number): string { return `${(v * 100).toFixed(2)}%`; }

	function buildFlowPath(flow: FlowDef): string {
		const start = getAnchorPoint(flow.from);
		const end = getAnchorPoint(flow.to);
		const waypoints = getWaypoints(flow.key);
		if (waypoints.length === 0) {
			const railX = anchors.railX;
			const jStart = { x: railX, y: start.y };
			const jEnd = { x: railX, y: end.y };
			return `M ${start.x} ${start.y} L ${jStart.x} ${jStart.y} L ${jEnd.x} ${jEnd.y} L ${end.x} ${end.y}`;
		}
		const pts = [start, ...waypoints, end];
		return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
	}

	const currentFlow = $derived(mode.kind === 'flow' ? FLOWS.find((f) => f.key === mode.key) : undefined);
	const currentWaypoints = $derived(currentFlow ? getWaypoints(currentFlow.key) : []);
</script>

<svelte:window onpointermove={handlePointerMove} onpointerup={handlePointerUp} />

<div class="anchor-editor">
	<header class="head">
		<div class="title">Ankerpunten plaatsen</div>
		<div class="sub">{variantLabel}</div>
	</header>

	<div class="toolbar">
		<div class="section-label">Ankers</div>
		{#each Object.keys(ANCHOR_LABELS) as key}
			{@const k = key as AnchorKey}
			<button
				type="button"
				class="anchor-btn"
				class:active={mode.kind === 'anchor' && mode.key === k}
				style="--c: {ANCHOR_COLORS[k]}"
				onclick={() => (mode = { kind: 'anchor', key: k })}
			>
				<span class="dot" style="background: {ANCHOR_COLORS[k]}"></span>
				{ANCHOR_LABELS[k]}
			</button>
		{/each}
	</div>

	<div class="toolbar">
		<div class="section-label">{translate('Buig flow-lijnen', $selectedLanguageStore)}</div>
		{#each FLOWS as flow}
			<button
				type="button"
				class="flow-btn"
				class:active={mode.kind === 'flow' && mode.key === flow.key}
				style="--c: {flow.color}"
				onclick={() => (mode = { kind: 'flow', key: flow.key })}
			>
				<span class="dot" style="background: {flow.color}"></span>
				{translate(flow.label, $selectedLanguageStore)}
				{#if getWaypoints(flow.key).length > 0}
					<span class="badge">{getWaypoints(flow.key).length}</span>
				{/if}
			</button>
		{/each}
	</div>

	{#if mode.kind === 'flow'}
		<div class="flow-actions">
			<span class="hint">{translate('Klik op de foto om een buigpunt toe te voegen, of sleep een bestaand punt. Klik op een buigpunt om te verwijderen.', $selectedLanguageStore)}</span>
			<button type="button" class="action-btn" onclick={() => mode.kind === 'flow' && appendWaypoint(mode.key)}>+ {translate('Buigpunt toevoegen', $selectedLanguageStore)}</button>
			{#if currentWaypoints.length > 0}
				<button type="button" class="action-btn ghost" onclick={clearWaypointsForCurrentFlow}>{translate('Wis alle buigpunten', $selectedLanguageStore)}</button>
			{/if}
		</div>
	{:else}
		<div class="flow-actions">
			<span class="hint">{translate('Klik op de foto om het geselecteerde anker te plaatsen, of sleep een anker direct.', $selectedLanguageStore)}</span>
			<button type="button" class="action-btn ghost" onclick={resetAnchors}>{translate('Reset alle ankers', $selectedLanguageStore)}</button>
		</div>
	{/if}

	<div class="frame" bind:this={frameEl} onclick={handleFrameClick} role="presentation">
		<img class="bg" src={bgUrl} alt="" />

		<svg class="overlay" viewBox="0 0 1 1" preserveAspectRatio="none">
			{#each FLOWS as flow}
				{@const isActive = mode.kind === 'flow' && mode.key === flow.key}
				<path
					d={buildFlowPath(flow)}
					stroke={flow.color}
					stroke-width={isActive ? 0.006 : 0.002}
					fill="none"
					stroke-linejoin="round"
					stroke-linecap="round"
					opacity={isActive ? 0.95 : 0.18}
				/>
			{/each}
		</svg>

		{#each ['solar','battery','door','car','street'] as akey}
			{@const k = akey as AnchorKey}
			{@const p = getAnchorPoint(k)}
			<div
				class="anchor-marker"
				class:dim={mode.kind === 'flow'}
				style="left: {pct(p.x)}; top: {pct(p.y)}; --c: {ANCHOR_COLORS[k]}"
				data-label={translate(ANCHOR_LABELS[k], $selectedLanguageStore)}
				onpointerdown={(e) => startDragAnchor(k, e)}
				role="presentation"
			></div>
		{/each}

		{#if currentFlow}
			{#each currentWaypoints as wp, i (i)}
				<div
					class="waypoint-marker"
					style="left: {pct(wp.x)}; top: {pct(wp.y)}; --c: {currentFlow.color}"
					onpointerdown={(e) => startDragWaypoint(currentFlow.key, i, e)}
					onclick={(e) => { e.stopPropagation(); if (!didDrag) removeWaypoint(currentFlow.key, i); }}
					role="presentation"
					title={translate('Sleep om te verplaatsen, klik om te verwijderen', $selectedLanguageStore)}
				></div>
			{/each}
		{/if}
	</div>

	<footer class="actions">
		<button type="button" class="btn ghost" onclick={onCancel}>{translate('cancel', $selectedLanguageStore)}</button>
		<button type="button" class="btn primary" onclick={() => onSave(anchors)}>{translate('save', $selectedLanguageStore)}</button>
	</footer>
</div>

<style>
	.anchor-editor {
		position: fixed; inset: 0;
		z-index: 100;
		background: linear-gradient(180deg, #1a2238 0%, #0c1024 100%);
		display: flex; flex-direction: column;
		overflow: hidden;
	}
	.head {
		padding: 0.8rem 1.4rem 0.2rem;
		display: flex; flex-direction: column; gap: 0.1rem;
		flex-shrink: 0;
	}
	.title {
		font-size: 1.3rem; font-weight: 700;
		color: #f5f5f5; letter-spacing: -0.02em;
	}
	.sub {
		font-size: 0.8rem; color: rgba(255,255,255,0.55);
	}

	.toolbar {
		display: flex; flex-wrap: wrap;
		gap: 0.35rem;
		padding: 0.4rem 1.4rem;
		border-bottom: 1px solid rgba(255,255,255,0.06);
		flex-shrink: 0;
		align-items: center;
	}
	.section-label {
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgba(255,255,255,0.4);
		margin-right: 0.4rem;
	}
	.anchor-btn, .flow-btn {
		display: flex; align-items: center; gap: 0.35rem;
		padding: 0.3rem 0.6rem;
		font-size: 0.78rem;
		color: rgba(255,255,255,0.7);
		background: rgba(255,255,255,0.04);
		border: 1px solid rgba(255,255,255,0.08);
		border-radius: 0.45rem;
		cursor: pointer;
		font-family: inherit;
	}
	.anchor-btn.active, .flow-btn.active {
		background: rgba(255,255,255,0.12);
		border-color: var(--c, #fff);
		color: #fff;
	}
	.anchor-btn .dot, .flow-btn .dot {
		width: 0.55rem; height: 0.55rem;
		border-radius: 50%;
		display: inline-block;
	}
	.flow-btn .badge {
		display: inline-flex; align-items: center; justify-content: center;
		min-width: 1rem; height: 1rem;
		padding: 0 0.25rem;
		font-size: 0.65rem; font-weight: 700;
		background: var(--c);
		color: #0c1024;
		border-radius: 0.5rem;
	}
	.flow-actions {
		display: flex; flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.5rem 1.4rem;
		border-bottom: 1px solid rgba(255,255,255,0.06);
		flex-shrink: 0;
		align-items: center;
	}
	.flow-actions .hint {
		font-size: 0.78rem;
		color: rgba(255,255,255,0.5);
		flex: 1;
	}
	.action-btn {
		padding: 0.35rem 0.7rem;
		font-size: 0.78rem;
		color: #f5f5f5;
		background: rgba(255,255,255,0.08);
		border: 1px solid rgba(255,255,255,0.12);
		border-radius: 0.45rem;
		cursor: pointer;
		font-family: inherit;
	}
	.action-btn.ghost {
		background: transparent;
		color: rgba(255,255,255,0.5);
	}

	.frame {
		flex: 1;
		position: relative;
		margin: 0.7rem 1.4rem;
		border-radius: 0.75rem;
		overflow: hidden;
		background: #000;
		cursor: crosshair;
		min-height: 0;
		touch-action: none;
	}
	.bg {
		position: absolute; inset: 0;
		width: 100%; height: 100%;
		object-fit: contain;
		display: block;
		pointer-events: none;
	}
	.overlay {
		position: absolute; inset: 0;
		width: 100%; height: 100%;
		pointer-events: none;
	}
	.anchor-marker {
		position: absolute;
		width: 1.4rem; height: 1.4rem;
		margin-left: -0.7rem; margin-top: -0.7rem;
		border-radius: 50%;
		background: var(--c);
		border: 2px solid rgba(255,255,255,0.9);
		box-shadow: 0 4px 14px rgba(0,0,0,0.55);
		cursor: grab;
		touch-action: none;
		transition: opacity 0.15s, transform 0.15s;
	}
	.anchor-marker:active {
		cursor: grabbing;
		transform: scale(1.15);
	}
	.anchor-marker.dim {
		opacity: 0.5;
	}
	.anchor-marker::after {
		content: attr(data-label);
		position: absolute;
		top: 100%; left: 50%;
		transform: translateX(-50%);
		margin-top: 0.25rem;
		padding: 0.1rem 0.4rem;
		font-size: 0.65rem; font-weight: 600;
		color: #f5f5f5;
		background: rgba(0,0,0,0.7);
		border-radius: 0.25rem;
		white-space: nowrap;
		pointer-events: none;
	}
	.waypoint-marker {
		position: absolute;
		width: 1rem; height: 1rem;
		margin-left: -0.5rem; margin-top: -0.5rem;
		border-radius: 50%;
		background: var(--c);
		border: 2px solid #0c1024;
		box-shadow: 0 0 0 2px var(--c), 0 4px 10px rgba(0,0,0,0.6);
		cursor: grab;
		touch-action: none;
	}
	.waypoint-marker:active {
		cursor: grabbing;
		transform: scale(1.2);
	}

	.actions {
		display: flex; gap: 0.7rem; justify-content: flex-end;
		padding: 0.7rem 1.4rem 1rem;
		border-top: 1px solid rgba(255,255,255,0.06);
		flex-shrink: 0;
	}
	.btn {
		padding: 0.6rem 1.2rem;
		font-size: 0.95rem; font-weight: 500;
		border: 1px solid transparent;
		border-radius: 0.5rem;
		cursor: pointer;
		font-family: inherit;
	}
	.btn.ghost {
		color: rgba(255,255,255,0.7);
		background: transparent;
		border-color: rgba(255,255,255,0.15);
	}
	.btn.primary {
		color: #fff;
		background: #2563eb;
	}
</style>
