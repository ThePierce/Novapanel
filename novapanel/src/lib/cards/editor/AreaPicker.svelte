<script lang="ts">
	import { areaStore, areaById } from '$lib/ha/area-store';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import { selectedLanguageStore, translate } from '$lib/i18n';

	type Row = { id: string; label: string; displayName: string };

	type Props = {
		selectedRows: Row[];
		ignoredRows: Row[];
		onToggle: (entityId: string, checked: boolean) => void;
		onSelectAll: () => void;
		onClearAll: () => void;
	};

	let { selectedRows, ignoredRows, onToggle, onSelectAll, onClearAll }: Props = $props();

	let searchQuery = $state('');
	let expandedAreaId = $state<string | null>(null);
	let showIgnoredArea = $state(false);

	const allRows = $derived([
		...selectedRows.map(r => ({ ...r, checked: true })),
		...ignoredRows.map(r => ({ ...r, checked: false }))
	]);

	const totalCount = $derived(allRows.length);
	const selectedCount = $derived(selectedRows.length);

	// Group rows by area
	type AreaGroup = {
		areaId: string;
		areaName: string;
		areaIcon: string;
		rows: typeof allRows;
		selectedCount: number;
		totalCount: number;
	};

	const NO_AREA_ID = '__no_area__';

	const areaIcons: Record<string, string> = {
		woonkamer: 'sofa', livingroom: 'sofa', 'living room': 'sofa',
		keuken: 'tools-kitchen-2', kitchen: 'tools-kitchen-2',
		slaapkamer: 'bed', bedroom: 'bed', master: 'bed',
		badkamer: 'bath', bathroom: 'bath', toilet: 'bath',
		tuin: 'tree', garden: 'tree', terras: 'tree', terrace: 'tree',
		hal: 'stairs', hall: 'stairs', gang: 'stairs', overloop: 'stairs',
		garage: 'car-garage',
		kantoor: 'briefcase', office: 'briefcase', werkkamer: 'briefcase', studie: 'briefcase',
		zolder: 'home', attic: 'home', kelder: 'home', basement: 'home',
		buiten: 'sun', outside: 'sun', voortuin: 'sun', achtertuin: 'tree',
		eetkamer: 'tools-kitchen-2', diningroom: 'tools-kitchen-2'
	};

	function pickIconForArea(name: string): string {
		const n = name.toLowerCase().trim();
		for (const key of Object.keys(areaIcons)) {
			if (n.includes(key)) return areaIcons[key];
		}
		return 'door';
	}

	const areaGroups = $derived(computeGroups());

	let storeState = $state({ areas: [] as { area_id: string; name: string }[], entityAreaMap: {} as Record<string, string>, loaded: false });
	$effect(() => {
		const unsub = areaStore.subscribe((s) => {
			storeState = { areas: s.areas, entityAreaMap: s.entityAreaMap, loaded: s.loaded };
		});
		return unsub;
	});

	function computeGroups(): AreaGroup[] {
		const map = new Map<string, AreaGroup>();
		// Initialize known areas
		for (const a of storeState.areas) {
			map.set(a.area_id, {
				areaId: a.area_id,
				areaName: a.name,
				areaIcon: pickIconForArea(a.name),
				rows: [],
				selectedCount: 0,
				totalCount: 0
			});
		}
		// Add "no area" bucket
		map.set(NO_AREA_ID, {
			areaId: NO_AREA_ID,
			areaName: translate('Geen kamer toegewezen', $selectedLanguageStore),
			areaIcon: 'question-mark',
			rows: [],
			selectedCount: 0,
			totalCount: 0
		});
		for (const row of allRows) {
			const aid = storeState.entityAreaMap[row.id] ?? NO_AREA_ID;
			let group = map.get(aid);
			if (!group) {
				group = { areaId: aid, areaName: aid, areaIcon: 'door', rows: [], selectedCount: 0, totalCount: 0 };
				map.set(aid, group);
			}
			group.rows.push(row);
			group.totalCount++;
			if (row.checked) group.selectedCount++;
		}
		// Sort: selected first, then by name; drop empty
		return [...map.values()]
			.filter((g) => g.totalCount > 0)
			.sort((a, b) => {
				if (a.areaId === NO_AREA_ID) return 1;
				if (b.areaId === NO_AREA_ID) return -1;
				if (a.selectedCount !== b.selectedCount) return b.selectedCount - a.selectedCount;
				return a.areaName.localeCompare(b.areaName);
			});
	}

	const filteredGroups = $derived((() => {
		if (!searchQuery.trim()) return areaGroups;
		const q = searchQuery.toLowerCase();
		return areaGroups
			.map((g) => ({
				...g,
				rows: g.rows.filter((r) => r.label.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
			}))
			.filter((g) => g.rows.length > 0);
	})());

	const isFiltering = $derived(searchQuery.trim().length > 0);

	function toggleArea(areaId: string) {
		expandedAreaId = expandedAreaId === areaId ? null : areaId;
	}

	function selectAllInArea(group: AreaGroup) {
		const unchecked = group.rows.filter((r) => !r.checked);
		if (unchecked.length > 50) {
			if (!confirm(`${translate('alle', $selectedLanguageStore)} ${unchecked.length} ${translate('entityPicker', $selectedLanguageStore).toLowerCase()} "${group.areaName}"?`)) return;
		}
		for (const r of unchecked) onToggle(r.id, true);
	}

	function clearAllInArea(group: AreaGroup) {
		const checked = group.rows.filter((r) => r.checked);
		for (const r of checked) onToggle(r.id, false);
	}

	function handleSelectAllGlobal() {
		if (totalCount > 50) {
			if (!confirm(`${translate('alle', $selectedLanguageStore)} ${totalCount} ${translate('entityPicker', $selectedLanguageStore).toLowerCase()}?`)) return;
		}
		onSelectAll();
	}
</script>

<div class="ap-root">
	<div class="ap-search-bar">
		<TablerIcon name="search" size={14} />
		<input
			type="text"
			placeholder={translate('Zoek in entiteiten...', $selectedLanguageStore)}
			bind:value={searchQuery}
		/>
		{#if searchQuery}
			<button type="button" class="ap-search-clear" onclick={() => (searchQuery = '')} aria-label={translate('Wis zoekopdracht', $selectedLanguageStore)}>
				<TablerIcon name="x" size={12} />
			</button>
		{/if}
	</div>

	<div class="ap-master-row">
		<div class="ap-master-left">
			<TablerIcon name="list" size={13} />
			<span class="ap-master-count">{selectedCount} {translate('actief', $selectedLanguageStore)}</span>
			<span class="ap-master-total">{translate('van', $selectedLanguageStore)} {totalCount} {translate('gevonden', $selectedLanguageStore)}</span>
		</div>
		<div class="ap-master-actions">
			<button type="button" class="ap-mini-btn" onclick={onClearAll}>{translate('geen', $selectedLanguageStore)}</button>
			<button type="button" class="ap-mini-btn primary" onclick={handleSelectAllGlobal}>{translate('alles aan', $selectedLanguageStore)}</button>
		</div>
	</div>

	{#if !storeState.loaded}
		<div class="ap-empty-state">
			<TablerIcon name="loader-2" size={16} />
			{translate('Kamerinformatie laden…', $selectedLanguageStore)}
		</div>
	{:else if filteredGroups.length === 0}
		<div class="ap-empty-state">
			<TablerIcon name="search-off" size={16} />
			{isFiltering ? translate('Geen entiteiten gevonden voor je zoekopdracht.', $selectedLanguageStore) : translate('Geen entiteiten beschikbaar.', $selectedLanguageStore)}
		</div>
	{:else}
		<div class="ap-areas-grid">
			{#each filteredGroups as group (group.areaId)}
				{@const isExpanded = expandedAreaId === group.areaId || isFiltering}
				{@const pct = group.totalCount > 0 ? Math.round((group.selectedCount / group.totalCount) * 100) : 0}
				<button
					type="button"
					class="ap-area"
					class:expanded={isExpanded && !isFiltering}
					class:zero={group.selectedCount === 0}
					class:full={group.selectedCount === group.totalCount}
					onclick={() => !isFiltering && toggleArea(group.areaId)}
				>
					<div class="ap-area-head">
						<span class="ap-area-icon"><TablerIcon name={group.areaIcon} size={13} /></span>
						<span class="ap-area-name">{group.areaName}</span>
						<span class="ap-area-count">{group.selectedCount}/{group.totalCount}</span>
					</div>
					<div class="ap-area-bar" class:zero={group.selectedCount === 0}>
						<span style="width: {pct}%"></span>
					</div>
				</button>
			{/each}
		</div>

		{#each filteredGroups as group (group.areaId + ':list')}
			{#if expandedAreaId === group.areaId || isFiltering}
				<div class="ap-area-list">
					<div class="ap-area-list-head">
						<div class="ap-area-list-title">
							<TablerIcon name={group.areaIcon} size={13} />
							{group.areaName}
							<span class="ap-area-list-summary">{group.selectedCount} {translate('van', $selectedLanguageStore)} {group.rows.length} {translate('geselecteerd', $selectedLanguageStore)}</span>
						</div>
						<div class="ap-area-list-actions">
							{#if group.selectedCount < group.rows.length}
								<button type="button" class="ap-mini-btn primary" onclick={(e) => { e.stopPropagation(); selectAllInArea(group); }}>
									{translate('alle', $selectedLanguageStore)} {group.rows.length}
								</button>
							{/if}
							{#if group.selectedCount > 0}
								<button type="button" class="ap-mini-btn ghost" onclick={(e) => { e.stopPropagation(); clearAllInArea(group); }}>
									{translate('wissen', $selectedLanguageStore)}
								</button>
							{/if}
						</div>
					</div>
					<div class="ap-area-rows">
						{#each group.rows as row (row.id)}
							<label class="ap-area-row" class:checked={row.checked}>
								<input
									type="checkbox"
									checked={row.checked}
									onchange={(e) => onToggle(row.id, (e.currentTarget as HTMLInputElement).checked)}
								/>
								<span class="ap-area-row-name">{row.label}</span>
							</label>
						{/each}
					</div>
				</div>
			{/if}
		{/each}
	{/if}
</div>

<style>
	.ap-root { display: flex; flex-direction: column; gap: 8px; min-height: 0; overflow: visible; }
	.ap-search-bar {
		display: flex; gap: 7px; align-items: center;
		padding: 7px 10px;
		background: rgba(255,255,255,0.04);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 9px;
	}
	.ap-search-bar :global(i) { color: rgba(255,255,255,0.4); }
	.ap-search-bar input {
		background: transparent; border: 0; color: #f5f5f5; font-size: 12px; flex: 1; outline: none;
		font-family: inherit; height: auto; padding: 0;
	}
	.ap-search-bar input::placeholder { color: rgba(255,255,255,0.35); }
	.ap-search-clear {
		background: rgba(255,255,255,0.06); border: 0; border-radius: 4px;
		width: 18px; height: 18px; display: grid; place-items: center;
		cursor: pointer; color: rgba(255,255,255,0.6);
	}
	.ap-search-clear:hover { background: rgba(255,255,255,0.12); color: #fff; }

	.ap-master-row {
		display: flex; align-items: center; justify-content: space-between;
		padding: 7px 11px;
		background: rgba(96,165,250,0.08);
		border: 0.5px solid rgba(96,165,250,0.20);
		border-radius: 9px;
		font-size: 11.5px;
	}
	.ap-master-left { display: flex; align-items: center; gap: 7px; color: rgba(255,255,255,0.85); }
	.ap-master-left :global(i) { color: #93c5fd; }
	.ap-master-count { color: #93c5fd; font-weight: 500; font-variant-numeric: tabular-nums; }
	.ap-master-total { color: rgba(255,255,255,0.5); }
	.ap-master-actions { display: flex; gap: 5px; }

	.ap-mini-btn {
		font-size: 10.5px;
		padding: 4px 9px;
		background: rgba(255,255,255,0.06);
		border: 0.5px solid rgba(255,255,255,0.10);
		border-radius: 5px;
		color: rgba(255,255,255,0.85);
		cursor: pointer;
		font-family: inherit;
		transition: background 0.12s;
	}
	.ap-mini-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
	.ap-mini-btn.primary { background: rgba(96,165,250,0.18); color: #93c5fd; border-color: rgba(96,165,250,0.30); }
	.ap-mini-btn.primary:hover { background: rgba(96,165,250,0.28); }
	.ap-mini-btn.ghost { background: transparent; }

	.ap-empty-state {
		display: flex; align-items: center; justify-content: center; gap: 8px;
		padding: 20px 10px;
		color: rgba(255,255,255,0.45);
		font-size: 12px;
		background: rgba(255,255,255,0.02);
		border: 0.5px dashed rgba(255,255,255,0.08);
		border-radius: 9px;
	}

	.ap-areas-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 6px;
	}
	.ap-area {
		background: rgba(255,255,255,0.04);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 8px;
		padding: 8px 10px;
		cursor: pointer;
		display: flex; flex-direction: column; gap: 5px;
		text-align: left;
		font-family: inherit;
		color: inherit;
		transition: background 0.12s, border-color 0.12s, transform 0.12s;
	}
	.ap-area:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.14); transform: translateY(-1px); }
	.ap-area.expanded { background: rgba(96,165,250,0.10); border-color: rgba(96,165,250,0.30); }
	.ap-area.full { border-color: rgba(74,222,128,0.25); }
	.ap-area-head { display: flex; align-items: center; gap: 6px; }
	.ap-area-icon { color: rgba(255,255,255,0.7); display: inline-grid; place-items: center; }
	.ap-area-name {
		font-size: 11.5px; font-weight: 500; flex: 1; color: #f5f5f5;
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}
	.ap-area-count { font-size: 10px; color: rgba(255,255,255,0.5); font-variant-numeric: tabular-nums; flex-shrink: 0; }
	.ap-area-bar { height: 3px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; }
	.ap-area-bar > span { display: block; height: 100%; background: linear-gradient(90deg, #4ade80, #22c55e); border-radius: 2px; transition: width 0.2s; }
	.ap-area-bar.zero > span { background: rgba(255,255,255,0.12); }

	.ap-area-list {
		background: rgba(0,0,0,0.18);
		border: 0.5px solid rgba(96,165,250,0.18);
		border-radius: 9px;
		padding: 8px 10px;
		display: flex; flex-direction: column; gap: 3px;
		margin-top: 2px;
		min-height: 0;
		overflow: visible;
	}
	.ap-area-list-head {
		display: flex; align-items: center; justify-content: space-between;
		padding-bottom: 6px;
		border-bottom: 0.5px solid rgba(255,255,255,0.06);
		margin-bottom: 4px;
		gap: 8px;
	}
	.ap-area-list-title {
		font-size: 12px; font-weight: 500; color: #f5f5f5;
		display: flex; align-items: center; gap: 6px;
		min-width: 0;
	}
	.ap-area-list-title :global(i) { color: rgba(255,255,255,0.7); }
	.ap-area-list-summary { font-weight: 400; color: rgba(255,255,255,0.5); font-size: 10.5px; margin-left: 4px; }
	.ap-area-list-actions { display: flex; gap: 4px; flex-shrink: 0; }
	.ap-area-rows { display: flex; flex-direction: column; gap: 1px; max-height: none; overflow: visible; padding: 0 4px 4px 0; scrollbar-width: none; -ms-overflow-style: none; scroll-padding-bottom: 0; }
	.ap-area-rows::-webkit-scrollbar { width: 0; height: 0; display: none; }
	.ap-area-row {
		display: flex; align-items: center; gap: 8px;
		padding: 5px 7px; border-radius: 5px;
		font-size: 11.5px;
		cursor: pointer;
		min-width: 0;
	}
	.ap-area-row:hover { background: rgba(255,255,255,0.04); }
	.ap-area-row.checked { background: rgba(96,165,250,0.06); }
	.ap-area-row input[type="checkbox"] {
		width: 13px; height: 13px;
		accent-color: #60a5fa;
		margin: 0; flex-shrink: 0;
	}
	.ap-area-row-name {
		flex: 1; color: #f5f5f5;
		overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
	}
</style>
