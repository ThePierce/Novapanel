<script lang="ts">
	import { entityStore } from '$lib/ha/entities-store';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import type { EnergyAnchors } from '$lib/persistence/panel-state-types';
	import { selectedLanguageStore, translate } from '$lib/i18n';

	type Props = {
		// Identifier (voor custom-asset URLs)
		cardId?: string;
		// Live power
		netEntityId?: string;
		solarEntityId?: string;
		batteryEntityId?: string;
		gridEntityId?: string;
		batteryChargeEntityId?: string;
		// Vandaag-totalen (kWh)
		importTodayEntityId?: string;
		exportTodayEntityId?: string;
		solarTodayEntityId?: string;
		homeTodayEntityId?: string;
		// Kosten vandaag (EUR)
		costTodayEntityId?: string;
		compensationTodayEntityId?: string;
		// Optioneel: zelfvoorzienend %
		selfSufficiencyEntityId?: string;
		// Auto aan de lader (optioneel)
		carChargingEntityId?: string;
		// Auto-laadkabel sensor (optioneel, vanuit de auto zelf)
		carCableEntityId?: string;
		// Auto laad-vermogen (optioneel, W)
		carChargingPowerEntityId?: string;
		// Verbruik per apparaat (sub-modal "Afname")
		energyDeviceEntityIds?: string[];
		energyDeviceTodayEntityIds?: string[];
		energyDeviceAliases?: Record<string, string>;
		energyDeviceSnapshot?: { date: string; values: Record<string, number> };
		onEntityAliasChange?: (entityId: string, alias: string) => void;
		onSnapshotChange?: (snapshot: { date: string; values: Record<string, number> }) => void;
		// Per-scenario flags voor eigen geüploade foto's
		hasCustomDayNoCar?: boolean;
		hasCustomDayWithCar?: boolean;
		hasCustomNightNoCar?: boolean;
		hasCustomNightWithCar?: boolean;
		// Per-scenario ankers (genormaliseerd 0..1)
		anchorsDayNoCar?: EnergyAnchors;
		anchorsDayWithCar?: EnergyAnchors;
		anchorsNightNoCar?: EnergyAnchors;
		anchorsNightWithCar?: EnergyAnchors;
		onClose: () => void;
	};

	let {
		cardId = '',
		netEntityId = '',
		solarEntityId = '',
		batteryEntityId = '',
		gridEntityId = '',
		batteryChargeEntityId = '',
		importTodayEntityId = '',
		exportTodayEntityId = '',
		solarTodayEntityId = '',
		homeTodayEntityId = '',
		costTodayEntityId = '',
		compensationTodayEntityId = '',
		selfSufficiencyEntityId = '',
		carChargingEntityId = '',
		carCableEntityId = '',
		carChargingPowerEntityId = '',
		energyDeviceEntityIds = [],
		energyDeviceTodayEntityIds = [],
		energyDeviceAliases = {},
		energyDeviceSnapshot,
		onEntityAliasChange,
		onSnapshotChange,
		hasCustomDayNoCar = false,
		hasCustomDayWithCar = false,
		hasCustomNightNoCar = false,
		hasCustomNightWithCar = false,
		anchorsDayNoCar,
		anchorsDayWithCar,
		anchorsNightNoCar,
		anchorsNightWithCar,
		onClose
	}: Props = $props();

	const entities = $derived($entityStore.entities);

	function getEntity(id: string) {
		const normalizedId = (id || '').trim();
		if (!normalizedId) return null;
		return entities.find((e) => e.entityId === normalizedId) ?? null;
	}
	function getNumeric(id: string): number | null {
		const e = getEntity(id);
		if (!e) return null;
		const v = parseFloat(String(e.state ?? ''));
		return isNaN(v) ? null : v;
	}
	function getUnit(id: string): string {
		const e = getEntity(id);
		return (e?.attributes as { unit_of_measurement?: string } | undefined)?.unit_of_measurement ?? '';
	}
	function getState(id: string): string {
		const e = getEntity(id);
		return String(e?.state ?? '').toLowerCase().trim();
	}

	function powerW(id: string): number | null {
		const v = getNumeric(id);
		if (v === null) return null;
		const unit = getUnit(id).toLowerCase();
		return unit.includes('kw') ? v * 1000 : v;
	}
	function kwhToday(id: string): number | null {
		const v = getNumeric(id);
		if (v === null) return null;
		const unit = getUnit(id).toLowerCase();
		if (unit === 'wh') return v / 1000;
		return v;
	}

	// Live waardes
	const netW = $derived(powerW(netEntityId));
	const solarW = $derived(powerW(solarEntityId));
	const batteryW = $derived(powerW(batteryEntityId));
	const homeW = $derived(powerW(gridEntityId));
	const batteryPct = $derived(getNumeric(batteryChargeEntityId));
	const carW = $derived(powerW(carChargingPowerEntityId));

	// Vandaag-totalen
	const importToday = $derived(kwhToday(importTodayEntityId));
	const exportToday = $derived(kwhToday(exportTodayEntityId));
	const solarToday = $derived(kwhToday(solarTodayEntityId));
	const homeTodayKwh = $derived(kwhToday(homeTodayEntityId));
	const costToday = $derived(getNumeric(costTodayEntityId));
	const compensationToday = $derived(getNumeric(compensationTodayEntityId));
	const selfSufficiency = $derived(getNumeric(selfSufficiencyEntityId));

	const selfSufficiencyComputed = $derived((() => {
		if (selfSufficiency !== null) return selfSufficiency;
		if (solarToday === null || exportToday === null) return null;
		const consumed = solarToday - exportToday;
		const home = homeTodayKwh ?? (importToday !== null ? importToday + consumed : null);
		if (!home || home <= 0) return null;
		return Math.max(0, Math.min(100, (consumed / home) * 100));
	})());

	const netCostToday = $derived((() => {
		if (costToday === null && compensationToday === null) return null;
		const c = costToday ?? 0;
		const comp = compensationToday ?? 0;
		return c - comp;
	})());

	function fmtPowerW(w: number | null): string {
		if (w === null) return '–';
		const abs = Math.abs(w);
		if (abs >= 1000) return `${(abs / 1000).toFixed(1)} kW`;
		return `${Math.round(abs)} W`;
	}
	function fmtKwh(v: number | null): string {
		if (v === null) return '–';
		return `${v.toFixed(1)}`;
	}
	function fmtEuro(v: number | null): string {
		if (v === null) return '–';
		const sign = v < 0 ? '−' : '';
		return `${sign}€${Math.abs(v).toFixed(2)}`;
	}

	// Tijd-detectie (dag/nacht) via sun.sun
	const sunState = $derived(getState('sun.sun'));
	const isNight = $derived((() => {
		if (sunState === 'below_horizon') return true;
		if (sunState === 'above_horizon') return false;
		// Fallback: lokale tijd 06:00 t/m 20:00 = dag
		const h = new Date().getHours();
		return h < 6 || h >= 20;
	})());

	// Auto-aan-lader detectie
	function evalChargerPlugged(entityId: string): boolean | null {
		if (!entityId) return null;
		const s = getState(entityId);
		if (!s) return null;
		const norm = s.replace(/\s+/g, '_');
		// Laadpaal "auto weg / niet aangesloten"
		const notPlugged = ['finish_wait_vehicle', 'unavailable', 'unknown', 'none', ''];
		if (notPlugged.includes(norm)) return false;
		return true;
	}

	function evalCablePlugged(entityId: string): boolean | null {
		if (!entityId) return null;
		const s = getState(entityId);
		if (!s) return null;
		const norm = s.replace(/\s+/g, '_');
		// Auto-zijde "kabel niet aangesloten"
		const notPlugged = [
			'losgekoppeld',
			'disconnected',
			'unplugged',
			'not_connected',
			'off',
			'false',
			'no',
			'0',
			'unavailable',
			'unknown',
			'none',
			''
		];
		if (notPlugged.includes(norm)) return false;
		return true;
	}

	const carPluggedIn = $derived((() => {
		const charger = evalChargerPlugged(carChargingEntityId);
		const cable = evalCablePlugged(carCableEntityId);
		// OR-logica: één bron die "aangesloten" zegt is genoeg
		if (charger === true || cable === true) return true;
		return false;
	})());

	const variantKey = $derived(`${isNight ? 'night' : 'day'}-${carPluggedIn ? 'with-car' : 'no-car'}`);
	const hasCustomCurrent = $derived((() => {
		if (variantKey === 'day-no-car') return Boolean(hasCustomDayNoCar);
		if (variantKey === 'day-with-car') return Boolean(hasCustomDayWithCar);
		if (variantKey === 'night-no-car') return Boolean(hasCustomNightNoCar);
		return Boolean(hasCustomNightWithCar);
	})());

	// Achtergrondafbeelding kiezen
	const bgImage = $derived((() => {
		const ingressBase =
			typeof window !== 'undefined'
				? (((window as unknown as { __novapanel_ingress?: string }).__novapanel_ingress || '') as string)
				: '';
		if (hasCustomCurrent && cardId) {
			return `${ingressBase}/energy-asset/${cardId}/${variantKey}`;
		}
		return `${ingressBase}/energy/${variantKey}.png`;
	})());

	// Flow-detectie (in W) — drempel om ruis te negeren
	const flowMinW = 50;
	const solarActive = $derived(solarW !== null && solarW > flowMinW);
	const importActive = $derived(netW !== null && netW > flowMinW);
	const exportActive = $derived(netW !== null && netW < -flowMinW);
	const batteryDischarge = $derived(batteryW !== null && batteryW > flowMinW);
	const batteryCharge = $derived(batteryW !== null && batteryW < -flowMinW);
	const carCharging = $derived(carPluggedIn && carW !== null && carW > flowMinW);

	const hasBattery = $derived(Boolean(batteryEntityId || batteryChargeEntityId));

	// Kleuren — semantisch onderscheidbaar
	const COLOR_SOLAR = '#22c55e'; // groen — zon naar accu/auto/huis
	const COLOR_GRID_IMPORT = '#fb923c'; // oranje — net-afname (net→huis/auto/accu)
	const COLOR_GRID_EXPORT = '#06b6d4'; // cyaan — teruglevering (zon→net), onderscheidbaar van zon
	const COLOR_BATTERY_DISCHARGE = '#a855f7'; // paars — accu ontladen → huis/auto, onderscheidbaar van zon
	const COLOR_RAIL = '#3a3f4a'; // donkergrijze rail onder elk pad

	const netStatus = $derived((() => {
		if (netW === null) return { label: translate('Geen data', $selectedLanguageStore), color: 'rgba(255,255,255,0.4)', value: '–' };
		if (netW < -flowMinW) return { label: translate('Teruglevering', $selectedLanguageStore), color: COLOR_GRID_EXPORT, value: fmtPowerW(netW) };
		if (netW > flowMinW) return { label: translate('Afname', $selectedLanguageStore), color: COLOR_GRID_IMPORT, value: fmtPowerW(netW) };
		return { label: translate('In balans', $selectedLanguageStore), color: '#f5f5f5', value: '0 W' };
	})());

	// === Ankerpunten ===
	// Default: genormaliseerd 0..1 op basis van de stock-foto (1536x1024).
	const DEFAULT_ANCHORS: EnergyAnchors = {
		solar: { x: 0.576, y: 0.264 },
		battery: { x: 0.423, y: 0.332 },
		door: { x: 0.371, y: 0.669 },
		car: { x: 0.394, y: 0.684 },
		street: { x: -0.013, y: 0.898 },
		railX: 0.404
	};

	const currentAnchors = $derived((() => {
		if (variantKey === 'day-no-car') return anchorsDayNoCar ?? DEFAULT_ANCHORS;
		if (variantKey === 'day-with-car') return anchorsDayWithCar ?? DEFAULT_ANCHORS;
		if (variantKey === 'night-no-car') return anchorsNightNoCar ?? DEFAULT_ANCHORS;
		return anchorsNightWithCar ?? DEFAULT_ANCHORS;
	})());

	// ViewBox is 1x1 (genormaliseerd) zodat coords direct werken
	const VB = 1000;
	const P_SOLAR = $derived({ x: currentAnchors.solar.x * VB, y: currentAnchors.solar.y * VB });
	const P_BATTERY = $derived({ x: currentAnchors.battery.x * VB, y: currentAnchors.battery.y * VB });
	const P_DOOR = $derived({ x: currentAnchors.door.x * VB, y: currentAnchors.door.y * VB });
	const P_CAR = $derived({ x: currentAnchors.car.x * VB, y: currentAnchors.car.y * VB });
	const P_STREET = $derived({ x: currentAnchors.street.x * VB, y: currentAnchors.street.y * VB });
	const RAIL_X = $derived(currentAnchors.railX * VB);

	// Rail-junctions per ankerpunt-y
	const J_SOLAR_TOP = $derived({ x: RAIL_X, y: P_SOLAR.y });
	const J_BATTERY = $derived({ x: RAIL_X, y: P_BATTERY.y });
	const J_DOOR = $derived({ x: RAIL_X, y: P_DOOR.y });
	const J_CAR = $derived({ x: RAIL_X, y: P_CAR.y });
	const J_STREET = $derived({ x: RAIL_X, y: P_STREET.y });

	// Path helpers met waypoint-systeem
	type Pt = { x: number; y: number };
	const wp = $derived(currentAnchors.flowWaypoints);

	function buildPolyline(start: Pt, mids: Pt[], end: Pt): string {
		const pts = [start, ...mids, end];
		return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
	}

	function customMids(key: string): Pt[] | null {
		const arr = wp?.[key as keyof typeof wp];
		if (!Array.isArray(arr) || arr.length === 0) return null;
		return arr.map((p) => ({ x: p.x * VB, y: p.y * VB }));
	}

	function pathFor(key: string, start: Pt, fallbackMids: Pt[], end: Pt): string {
		const mids = customMids(key) ?? fallbackMids;
		return buildPolyline(start, mids, end);
	}

	function pathSolarToBattery() {
		return pathFor('solarToBattery', P_SOLAR, [J_SOLAR_TOP, J_BATTERY], P_BATTERY);
	}
	function pathSolarToCar() {
		return pathFor('solarToCar', P_SOLAR, [J_SOLAR_TOP, J_CAR], P_CAR);
	}
	function pathSolarToHome() {
		return pathFor('solarToHome', P_SOLAR, [J_SOLAR_TOP, J_DOOR], P_DOOR);
	}
	function pathSolarToGrid() {
		return pathFor('solarToGrid', P_SOLAR, [J_SOLAR_TOP, J_STREET], P_STREET);
	}
	function pathGridToHome() {
		return pathFor('gridToHome', P_STREET, [J_STREET, J_DOOR], P_DOOR);
	}
	function pathGridToCar() {
		return pathFor('gridToCar', P_STREET, [J_STREET, J_CAR], P_CAR);
	}
	function pathGridToBattery() {
		return pathFor('gridToBattery', P_STREET, [J_STREET, J_BATTERY], P_BATTERY);
	}
	function pathBatteryToHome() {
		return pathFor('batteryToHome', P_BATTERY, [J_BATTERY, J_DOOR], P_DOOR);
	}
	function pathBatteryToCar() {
		return pathFor('batteryToCar', P_BATTERY, [J_BATTERY, J_CAR], P_CAR);
	}

	// Welke flows zijn actief? Simpele toedeling:
	// - Zon laadt accu zolang accu laad-vermogen > 0 EN zon > 0
	// - Resterende zon → auto (als auto laadt) → huis
	// - Surplus zon → grid (export)
	// - Bij grid-import: net → huis (en eventueel auto/accu als die laden)
	const showSolarToBattery = $derived(solarActive && batteryCharge);
	const showSolarToCar = $derived(solarActive && carCharging && !batteryCharge);
	const showSolarToHome = $derived(solarActive && (homeW === null || homeW > flowMinW));
	const showSolarToGrid = $derived(exportActive);
	const showGridToHome = $derived(importActive);
	const showGridToCar = $derived(false);
	const showGridToBattery = $derived(importActive && batteryCharge);
	const showBatteryToHome = $derived(batteryDischarge && (homeW === null || homeW > flowMinW));
	const showBatteryToCar = $derived(batteryDischarge && carCharging);

	type FlowDef = { key: string; d: string; color: string; dur: string; endpoint: Pt; endKey: string };
	const activeFlows = $derived((() => {
		const list: FlowDef[] = [];
		if (showSolarToBattery) list.push({ key: 'solarToBattery', d: pathSolarToBattery(), color: COLOR_SOLAR, dur: '2.4s', endpoint: P_BATTERY, endKey: 'battery' });
		if (showSolarToCar) list.push({ key: 'solarToCar', d: pathSolarToCar(), color: COLOR_SOLAR, dur: '3s', endpoint: P_CAR, endKey: 'car' });
		if (showSolarToHome) list.push({ key: 'solarToHome', d: pathSolarToHome(), color: COLOR_SOLAR, dur: '2.6s', endpoint: P_DOOR, endKey: 'door' });
		if (showSolarToGrid) list.push({ key: 'solarToGrid', d: pathSolarToGrid(), color: COLOR_GRID_EXPORT, dur: '3s', endpoint: P_STREET, endKey: 'street' });
		if (showGridToHome) list.push({ key: 'gridToHome', d: pathGridToHome(), color: COLOR_GRID_IMPORT, dur: '3s', endpoint: P_DOOR, endKey: 'door' });
		if (showGridToCar) list.push({ key: 'gridToCar', d: pathGridToCar(), color: COLOR_GRID_IMPORT, dur: '3s', endpoint: P_CAR, endKey: 'car' });
		if (showGridToBattery) list.push({ key: 'gridToBattery', d: pathGridToBattery(), color: COLOR_GRID_IMPORT, dur: '2.8s', endpoint: P_BATTERY, endKey: 'battery' });
		if (showBatteryToHome) list.push({ key: 'batteryToHome', d: pathBatteryToHome(), color: COLOR_BATTERY_DISCHARGE, dur: '2.4s', endpoint: P_DOOR, endKey: 'door' });
		if (showBatteryToCar) list.push({ key: 'batteryToCar', d: pathBatteryToCar(), color: COLOR_BATTERY_DISCHARGE, dur: '2.4s', endpoint: P_CAR, endKey: 'car' });
		return list;
	})());

	// === Verbruik per apparaat sub-modal ===
	let devicesOpen = $state(false);
	let chartMode = $state<'now' | 'today'>('today');
	let hiddenEntities = $state<Set<string>>(new Set());
	function toggleEntityVisibility(entityId: string) {
		const next = new Set(hiddenEntities);
		if (next.has(entityId)) next.delete(entityId);
		else next.add(entityId);
		hiddenEntities = next;
	}
	const hasDevices = $derived((energyDeviceEntityIds ?? []).filter((id) => id && id.trim().length > 0).length > 0);
	const canOpenDevices = $derived(hasDevices);

	// Rename UI state
	let renameEntityId = $state('');
	let renameDraft = $state('');
	function openRename(entityId: string, currentName: string) {
		renameEntityId = entityId;
		renameDraft = currentName;
	}
	function cancelRename() {
		renameEntityId = '';
		renameDraft = '';
	}
	function commitRename() {
		const id = renameEntityId.trim();
		const name = renameDraft.trim();
		if (id && name && onEntityAliasChange) {
			onEntityAliasChange(id, name);
		}
		renameEntityId = '';
		renameDraft = '';
	}

	// === Snapshot-mechanisme voor kWh vandaag ===
	// Snapshot wordt server-side opgeslagen via panel-state (zelfde flow als aliases),
	// dus synct automatisch tussen apparaten. De modal stuurt onSnapshotChange wanneer
	// nieuwe waarden moeten worden vastgelegd (dagstart of nieuwe entity).
	type DaySnapshot = {
		date: string; // YYYY-MM-DD
		values: Record<string, number>; // entityId -> kWh-stand bij dagstart
	};

	function todayDateString(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	// We houden lokaal een effective snapshot bij die door $effect wordt onderhouden.
	// Wanneer het verschilt van wat in panel-state staat, vuren we onSnapshotChange.
	let effectiveSnapshot = $state<DaySnapshot>({ date: todayDateString(), values: {} });

	// Synchroniseer effectiveSnapshot met de prop wanneer die binnenkomt of verandert.
	$effect(() => {
		const today = todayDateString();
		const incoming = energyDeviceSnapshot;
		if (!incoming || incoming.date !== today) {
			// Nieuwe dag of nog geen snapshot — start met lege snapshot voor vandaag
			effectiveSnapshot = { date: today, values: {} };
		} else {
			effectiveSnapshot = { date: incoming.date, values: { ...incoming.values } };
		}
	});

	// Wanneer een entity nog geen snapshot-waarde heeft, vul deze in op basis van huidige meterstand
	// en stuur de update door naar panel-state. Hier doen we het via een ander $effect dat alleen
	// vuurt als er daadwerkelijk nieuwe entities zijn die een initiële waarde nodig hebben.
	$effect(() => {
		if (!onSnapshotChange) return;
		const today = todayDateString();
		const ids = (energyDeviceTodayEntityIds ?? []).filter((id) => id && id.trim().length > 0);
		if (ids.length === 0) return;

		// Als de datum oud is, beginnen we leeg
		const currentDate = effectiveSnapshot.date === today ? effectiveSnapshot.date : today;
		const currentValues = effectiveSnapshot.date === today ? effectiveSnapshot.values : {};

		const nextValues: Record<string, number> = { ...currentValues };
		let dirty = currentDate !== effectiveSnapshot.date;
		for (const id of ids) {
			if (nextValues[id] === undefined) {
				const current = getNumeric(id);
				if (current !== null && !isNaN(current)) {
					const unit = getUnit(id).toLowerCase();
					const kwh = unit === 'wh' ? current / 1000 : current;
					nextValues[id] = kwh;
					dirty = true;
				}
			}
		}
		if (dirty) {
			const next: DaySnapshot = { date: today, values: nextValues };
			effectiveSnapshot = next;
			onSnapshotChange(next);
		}
	});

	// Check elke minuut of de dag is gewisseld → reset snapshot via panel-state
	$effect(() => {
		if (typeof window === 'undefined') return;
		const interval = window.setInterval(() => {
			const today = todayDateString();
			if (effectiveSnapshot.date !== today && onSnapshotChange) {
				const next: DaySnapshot = { date: today, values: {} };
				effectiveSnapshot = next;
				onSnapshotChange(next);
			}
		}, 60000);
		return () => window.clearInterval(interval);
	});

	function kwhTodayFromSnapshot(id: string): number | null {
		const current = getNumeric(id);
		if (current === null || isNaN(current)) return null;
		const unit = getUnit(id).toLowerCase();
		const currentKwh = unit === 'wh' ? current / 1000 : current;
		const base = effectiveSnapshot.values[id];
		if (base === undefined) return 0; // Wordt in volgende cycle ingevuld door $effect
		const delta = currentKwh - base;
		// Negatief = teller is gereset; val terug op huidige waarde (waarschijnlijk al dagelijkse teller)
		if (delta < 0) return Math.max(0, currentKwh);
		return delta;
	}

	type DeviceRow = {
		entityId: string;
		name: string; // alias of friendly_name of entity_id
		friendlyName: string;
		powerW: number | null;
		kwhToday: number | null;
		kwhEntityId: string | null;
	};

	function baseNameForMatch(id: string): string {
		// "sensor.koelkast_power" → "koelkast"
		const noPrefix = id.replace(/^[a-z_]+\./, '').toLowerCase();
		return noPrefix
			.replace(/_power$|_vermogen$|_w$|_kw$/g, '')
			.replace(/_energy(_today)?$|_energie(_vandaag)?$|_kwh(_today)?$|_today$|_vandaag$/g, '')
			.replace(/_+/g, '_')
			.replace(/^_+|_+$/g, '');
	}

	function resolveDisplayName(entityId: string, friendlyName: string): string {
		const alias = energyDeviceAliases?.[entityId];
		if (typeof alias === 'string' && alias.trim().length > 0) return alias.trim();
		return friendlyName || entityId;
	}

	const deviceRows = $derived((() => {
		const power = (energyDeviceEntityIds ?? []).filter((id) => id && id.trim().length > 0);
		const today = (energyDeviceTodayEntityIds ?? []).filter((id) => id && id.trim().length > 0);

		const todayByBase = new Map<string, string>();
		for (const t of today) {
			const key = baseNameForMatch(t);
			if (!todayByBase.has(key)) todayByBase.set(key, t);
		}
		const usedToday = new Set<string>();

		const rows: DeviceRow[] = [];
		for (let i = 0; i < power.length; i++) {
			const pid = power[i].trim();
			if (!pid) continue;

			let tid: string | null = null;
			if (i < today.length && today[i] && today[i].trim().length > 0) {
				const candidate = today[i].trim();
				if (baseNameForMatch(candidate) === baseNameForMatch(pid)) {
					tid = candidate;
					usedToday.add(candidate);
				}
			}
			if (!tid) {
				const base = baseNameForMatch(pid);
				const match = todayByBase.get(base);
				if (match && !usedToday.has(match)) {
					tid = match;
					usedToday.add(match);
				}
			}

			const ent = getEntity(pid);
			const friendly = (ent?.attributes as { friendly_name?: string } | undefined)?.friendly_name ?? pid;
			rows.push({
				entityId: pid,
				name: resolveDisplayName(pid, friendly),
				friendlyName: friendly,
				powerW: powerW(pid),
				kwhToday: tid ? kwhTodayFromSnapshot(tid) : null,
				kwhEntityId: tid
			});
		}
		rows.sort((a, b) => {
			// Primair: aflopend op kWh-vandaag (zichtbaar in chart)
			const aKwh = a.kwhToday ?? -1;
			const bKwh = b.kwhToday ?? -1;
			if (bKwh !== aKwh) return bKwh - aKwh;
			// Secundair: aflopend op live W
			return (b.powerW ?? -Infinity) - (a.powerW ?? -Infinity);
		});
		return rows;
	})());
	const devicesTotalW = $derived(deviceRows.reduce((sum, r) => sum + (r.powerW ?? 0), 0));
	const devicesTotalKwh = $derived((() => {
		const vals = deviceRows.map((r) => r.kwhToday).filter((v): v is number => v !== null);
		return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) : null;
	})());
	const maxRowKwh = $derived(deviceRows.reduce((max, r) => Math.max(max, r.kwhToday ?? 0), 0));
	const visibleRows = $derived(deviceRows.filter((r) => !hiddenEntities.has(r.entityId)));
	const chartMax = $derived((() => {
		if (chartMode === 'now') {
			return visibleRows.reduce((max, r) => Math.max(max, r.powerW ?? 0), 0);
		}
		return visibleRows.reduce((max, r) => Math.max(max, r.kwhToday ?? 0), 0);
	})());
	function valueFor(row: DeviceRow): number {
		if (chartMode === 'now') return row.powerW ?? 0;
		return row.kwhToday ?? 0;
	}
	function fmtValue(v: number): string {
		if (chartMode === 'now') return fmtPowerW(v);
		return `${fmtKwh(v)} kWh`;
	}

	// 11 onderscheidende kleuren voor de bars (cyclisch)
	const COLORS = ['#fb923c', '#60a5fa', '#a78bfa', '#4ade80', '#facc15', '#f472b6', '#22d3ee', '#fb7185', '#34d399', '#c084fc', '#f59e0b'];
	function colorFor(entityId: string): string {
		const idx = deviceRows.findIndex((r) => r.entityId === entityId);
		return COLORS[((idx >= 0 ? idx : 0)) % COLORS.length];
	}

	function openDevices() {
		if (canOpenDevices) devicesOpen = true;
	}
	function closeDevices() {
		devicesOpen = false;
	}
</script>

<button type="button" class="modal-overlay" onclick={onClose} aria-label={translate('close', $selectedLanguageStore)}></button>
<section class="energy-modal np-detail" role="dialog" aria-modal="true" aria-label={translate('Energieoverzicht', $selectedLanguageStore)}>
	<div class="np-detail-head" style="--np-tint: rgba(74,222,128,0.18); --np-color: #4ade80;">
		<div class="np-detail-head-glow" aria-hidden="true"></div>
		<div class="np-detail-head-icon"><TablerIcon name="bolt" size={22} /></div>
		<div class="np-detail-head-text">
			<div class="np-detail-head-title">{translate('Energie', $selectedLanguageStore)}</div>
			<div class="np-detail-head-sub">{translate('Vandaag', $selectedLanguageStore)}</div>
		</div>
	</div>

	<div class="modal-body">
		<div class="stat-row top">
			<div class="stat">
				<div class="stat-label">{translate('Opwek', $selectedLanguageStore)}</div>
				<div class="stat-value">
					<span class="num">{fmtKwh(solarToday)}</span>
					<span class="unit">kWh</span>
				</div>
			</div>
			<div class="stat right">
				<div class="stat-label">{translate('Zelfvoorzienend', $selectedLanguageStore)}</div>
				<div class="stat-value">
					<span class="num">{selfSufficiencyComputed !== null ? Math.round(selfSufficiencyComputed) : '–'}</span>
					<span class="unit">%</span>
				</div>
			</div>
		</div>

		<div class="hero-frame">
			<img class="hero-bg" src={bgImage} alt="" aria-hidden="true" />
			<svg class="flow-overlay" viewBox="0 0 1000 1000" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
				{#each activeFlows as f (f.key)}
					<!-- Donkergrijze rail -->
					<path d={f.d} fill="none" stroke={COLOR_RAIL} stroke-width="3" stroke-linejoin="round" stroke-linecap="round" />
					<!-- Bewegend gekleurd segment overheen -->
					<path d={f.d} fill="none" stroke={f.color} stroke-width="3" stroke-linejoin="round" stroke-linecap="round" pathLength="1000" stroke-dasharray="140 860" stroke-dashoffset="1000">
						<animate attributeName="stroke-dashoffset" from="1000" to="0" dur="{f.dur}" repeatCount="indefinite" />
					</path>
				{/each}
			</svg>
		</div>

		<div class="stat-row bottom">
			<div class="stat">
				<div class="stat-label">{translate('Net', $selectedLanguageStore)}</div>
				<div class="stat-value">
					<span class="num">{fmtKwh(importToday)}</span>
					<span class="unit">kWh</span>
				</div>
			</div>
			<div class="stat center">
				<div class="stat-label">{translate('Kosten', $selectedLanguageStore)}</div>
				<div class="stat-value">
					<span class="num">{netCostToday !== null ? fmtEuro(netCostToday) : '–'}</span>
				</div>
			</div>
			<div class="stat right">
				<div class="stat-label">{translate('Teruglevering', $selectedLanguageStore)}</div>
				<div class="stat-value">
					<span class="num">{fmtKwh(exportToday)}</span>
					<span class="unit">kWh</span>
				</div>
			</div>
		</div>

		{#if canOpenDevices}
			<button
				type="button"
				class="hero-status hero-status-btn"
				style="color: {netStatus.color}"
				onclick={openDevices}
				aria-label={translate('Bekijk verbruik per apparaat', $selectedLanguageStore)}
			>
				<div class="hero-value">{netStatus.value}</div>
				<div class="hero-label">
					{netStatus.label}
					<span class="hero-chevron" aria-hidden="true">
						<TablerIcon name="chevron-right" size={14} />
					</span>
				</div>
			</button>
		{:else}
			<div class="hero-status" style="color: {netStatus.color}">
				<div class="hero-value">{netStatus.value}</div>
				<div class="hero-label">{netStatus.label}</div>
			</div>
		{/if}
	</div>
</section>

{#if devicesOpen}
	<button type="button" class="modal-overlay devices-overlay" onclick={closeDevices} aria-label={translate('close', $selectedLanguageStore)}></button>
	<section class="devices-modal np-detail" role="dialog" aria-modal="true" aria-label={translate('Verbruik per apparaat', $selectedLanguageStore)}>
		<div class="np-detail-head" style="--np-tint: rgba(251,146,60,0.18); --np-color: #fb923c;">
			<div class="np-detail-head-glow" aria-hidden="true"></div>
			<div class="np-detail-head-icon"><TablerIcon name="device-desktop-analytics" size={22} /></div>
			<div class="np-detail-head-text">
				<div class="np-detail-head-title">{translate('Verbruik per apparaat', $selectedLanguageStore)}</div>
				<div class="np-detail-head-sub">{translate('Live', $selectedLanguageStore)} · {translate('vandaag', $selectedLanguageStore)}</div>
			</div>
			<button type="button" class="devices-close" onclick={closeDevices} aria-label={translate('close', $selectedLanguageStore)}>
				<TablerIcon name="x" size={18} />
			</button>
		</div>

		<div class="modal-body devices-body">
			<div class="devices-summary">
				<div class="summary-card">
					<div class="summary-label">{translate('Live verbruik', $selectedLanguageStore)}</div>
					<div class="summary-value">
						<span class="num">{fmtPowerW(devicesTotalW)}</span>
					</div>
					<div class="summary-foot">{deviceRows.filter((r) => (r.powerW ?? 0) > 50).length} {translate('apparaten actief', $selectedLanguageStore)}</div>
				</div>
				<div class="summary-card summary-card-accent">
					<div class="summary-label">{translate('Vandaag', $selectedLanguageStore)} {translate('Totaal', $selectedLanguageStore).toLowerCase()}</div>
					<div class="summary-value">
						<span class="num">{fmtKwh(devicesTotalKwh)}</span>
						<span class="unit">kWh</span>
					</div>
					<div class="summary-foot">{translate('sinds 00:00', $selectedLanguageStore)}</div>
				</div>
			</div>

			<!-- Toggle: nu vs vandaag -->
			<div class="chart-mode-toggle">
				<button
					type="button"
					class="chart-mode-btn"
					class:active={chartMode === 'now'}
					onclick={() => (chartMode = 'now')}
				>
					<TablerIcon name="bolt" size={13} />
					{translate('Huidig verbruik', $selectedLanguageStore)}
				</button>
				<button
					type="button"
					class="chart-mode-btn"
					class:active={chartMode === 'today'}
					onclick={() => (chartMode = 'today')}
				>
					<TablerIcon name="chart-bar" size={13} />
					{translate('Vandaag', $selectedLanguageStore)} {translate('Totaal', $selectedLanguageStore).toLowerCase()}
				</button>
			</div>

			<!-- Staafgrafiek -->
			<div class="chart-wrap">
				{#if visibleRows.length === 0}
					<div class="chart-empty">
						{#if deviceRows.length === 0}
							{translate('Geen apparaten geconfigureerd.', $selectedLanguageStore)}
						{:else}
							{translate('Alle apparaten verborgen — klik er hieronder eentje aan.', $selectedLanguageStore)}
						{/if}
					</div>
				{:else}
					<svg class="chart-svg" viewBox="0 0 {Math.max(320, visibleRows.length * 60)} 220" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
						<!-- Achtergrond grid lines -->
						{#each [0.25, 0.5, 0.75, 1] as ratio (ratio)}
							<line x1="0" y1={180 - ratio * 160} x2={Math.max(320, visibleRows.length * 60)} y2={180 - ratio * 160} stroke="rgba(255,255,255,0.05)" stroke-width="1" stroke-dasharray="2 4" />
						{/each}
						<!-- Bars -->
						{#each visibleRows as row, idx (row.entityId)}
							{@const v = valueFor(row)}
							{@const h = chartMax > 0 ? (v / chartMax) * 160 : 0}
							{@const barW = 40}
							{@const gap = 60}
							{@const x = idx * gap + 10}
							{@const color = colorFor(row.entityId)}
							<g>
								<defs>
									<linearGradient id="bar-grad-{idx}" x1="0" y1="0" x2="0" y2="1">
										<stop offset="0%" stop-color={color} stop-opacity="0.95"/>
										<stop offset="100%" stop-color={color} stop-opacity="0.45"/>
									</linearGradient>
								</defs>
								<rect
									x={x}
									y={180 - h}
									width={barW}
									height={h}
									rx="4"
									fill="url(#bar-grad-{idx})"
								>
									<title>{row.name}: {fmtValue(v)}</title>
								</rect>
								<!-- Value label boven de bar -->
								{#if v > 0}
									<text
										x={x + barW / 2}
										y={180 - h - 6}
										text-anchor="middle"
										font-size="10"
										font-weight="600"
										fill="rgba(255,255,255,0.85)"
									>{fmtValue(v)}</text>
								{/if}
								<!-- Naam onder de bar (afgekort) -->
								<text
									x={x + barW / 2}
									y="200"
									text-anchor="middle"
									font-size="10"
									fill="rgba(255,255,255,0.55)"
								>{row.name.length > 9 ? row.name.slice(0, 8) + '…' : row.name}</text>
							</g>
						{/each}
						<!-- Baseline -->
						<line x1="0" y1="180" x2={Math.max(320, visibleRows.length * 60)} y2="180" stroke="rgba(255,255,255,0.18)" stroke-width="1" />
					</svg>
				{/if}
			</div>

			<!-- Legenda — klikbaar om te tonen/verbergen -->
			<div class="chart-legend">
				{#each deviceRows as row (row.entityId)}
					{@const isHidden = hiddenEntities.has(row.entityId)}
					{@const isActive = (row.powerW ?? 0) > 50}
					<div class="legend-item" class:hidden={isHidden}>
						{#if renameEntityId === row.entityId}
							<div class="legend-btn legend-btn-static" role="group" aria-label={translate('Hernoemen', $selectedLanguageStore)}>
								<span class="legend-dot" style="background: {colorFor(row.entityId)}"></span>
								<div class="device-rename" onclick={(e) => e.stopPropagation()} role="presentation">
									<input
										class="device-rename-input"
										type="text"
										value={renameDraft}
										oninput={(e) => (renameDraft = (e.currentTarget as HTMLInputElement).value)}
										onkeydown={(e) => {
											if (e.key === 'Enter') commitRename();
											if (e.key === 'Escape') cancelRename();
										}}
										aria-label={translate('Naam', $selectedLanguageStore)}
									/>
									<button type="button" class="device-rename-btn save" onclick={(e) => { e.stopPropagation(); commitRename(); }} aria-label={translate('save', $selectedLanguageStore)}>
										<TablerIcon name="check" size={12} />
									</button>
									<button type="button" class="device-rename-btn cancel" onclick={(e) => { e.stopPropagation(); cancelRename(); }} aria-label={translate('cancel', $selectedLanguageStore)}>
										<TablerIcon name="x" size={12} />
									</button>
								</div>
							</div>
						{:else}
							<button
								type="button"
								class="legend-btn"
								onclick={() => toggleEntityVisibility(row.entityId)}
								aria-pressed={!isHidden}
								title={isHidden ? translate('Tonen', $selectedLanguageStore) : translate('Verbergen', $selectedLanguageStore)}
							>
								<span class="legend-dot" style="background: {colorFor(row.entityId)}"></span>
								<span class="legend-name">{row.name}</span>
								{#if isActive && !isHidden}
									<span class="legend-live-dot"></span>
								{/if}
								<span class="legend-value">{fmtValue(valueFor(row))}</span>
							</button>
						{/if}
						{#if renameEntityId !== row.entityId && onEntityAliasChange}
							<button
								type="button"
								class="legend-rename"
								onclick={(e) => { e.stopPropagation(); openRename(row.entityId, row.name); }}
								aria-label={translate('Hernoemen', $selectedLanguageStore)}
								title={translate('Hernoemen', $selectedLanguageStore)}
							>
								<TablerIcon name="pencil" size={11} />
							</button>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	</section>
{/if}

<style>
	.modal-overlay {
		position: fixed; inset: 0;
		background: rgba(0,0,0,0.55);
		backdrop-filter: blur(2px);
		border: 0; padding: 0; margin: 0;
		z-index: 40; cursor: default;
	}
	.energy-modal {
		position: fixed;
		top: 50%; left: 50%;
		transform: translate(-50%, -50%);
		z-index: 60;
		width: min(var(--popup-width, 850px), calc(100vw - 1.5rem));
		height: min(var(--popup-height, 1140px), calc(100vh - 1.5rem));
		max-height: calc(100vh - 1.5rem);
		display: flex; flex-direction: column;
		background: linear-gradient(180deg, #1a2238 0%, #0f1424 100%);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 18px;
		overflow: hidden;
	}
	.energy-modal::before { content: ''; position: absolute; top: 0; left: 50%; width: 60%; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent); transform: translateX(-50%); pointer-events: none; z-index: 5; }

	/* Premium header — match alle detail-modals */
	.np-detail-head {
		padding: 18px 22px 14px;
		border-bottom: 0.5px solid rgba(255,255,255,0.06);
		display: flex; align-items: center; gap: 12px;
		position: relative; overflow: hidden; flex-shrink: 0;
	}
	.np-detail-head-glow {
		position: absolute; top: -100px; left: -40px;
		width: 220px; height: 220px;
		background: radial-gradient(circle, var(--np-tint, rgba(96,165,250,0.18)), transparent 70%);
		pointer-events: none; filter: blur(20px);
	}
	.np-detail-head-icon {
		width: 38px; height: 38px; border-radius: 10px;
		display: grid; place-items: center;
		background: var(--np-tint);
		border: 0.5px solid rgba(255,255,255,0.10);
		color: var(--np-color);
		flex-shrink: 0; position: relative; z-index: 1;
	}
	.np-detail-head-text { flex: 1; min-width: 0; position: relative; z-index: 1; }
	.np-detail-head-title { font-size: 15px; font-weight: 500; letter-spacing: -0.01em; line-height: 1.2; color: #f5f5f5; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.np-detail-head-sub { font-size: 11.5px; color: rgba(255,255,255,0.5); margin-top: 3px; }

	.modal-body {
		flex: 1 1 auto;
		min-height: 0;
		display: flex; flex-direction: column;
		padding: 14px 22px 22px;
		gap: 10px;
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		touch-action: pan-y;
		scrollbar-width: none;
		-ms-overflow-style: none;
	}
	.modal-body::-webkit-scrollbar { width: 0; height: 0; display: none; }

	.stat-row {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		padding: 4px 0;
	}
	.stat-row.bottom {
		grid-template-columns: 1fr 1fr 1fr;
		padding-top: 12px;
		margin-top: 4px;
		border-top: 0.5px solid rgba(255,255,255,0.07);
	}
	.stat {
		display: flex; flex-direction: column; gap: 4px;
		padding: 12px 14px;
		background: rgba(255,255,255,0.025);
		border: 0.5px solid rgba(255,255,255,0.07);
		border-radius: 13px;
		transition: border-color 0.2s, background 0.2s;
	}
	.stat:hover {
		background: rgba(255,255,255,0.035);
		border-color: rgba(255,255,255,0.10);
	}
	.stat.right { text-align: right; }
	.stat.center { text-align: center; }
	.stat-label {
		font-size: 10.5px; color: rgba(255,255,255,0.5);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.stat-value {
		display: flex; align-items: baseline; gap: 4px;
	}
	.stat.right .stat-value { justify-content: flex-end; }
	.stat.center .stat-value { justify-content: center; }
	.stat-value .num {
		font-size: 1.5rem; font-weight: 600;
		color: #fff; letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.stat-value .unit {
		font-size: 12.5px; color: rgba(255,255,255,0.5);
		font-weight: 500;
	}

	.hero-frame {
		position: relative;
		width: 100%;
		aspect-ratio: 1536 / 1024;
		border-radius: 13px;
		overflow: hidden;
		background: #0c1024;
		border: 0.5px solid rgba(255,255,255,0.07);
	}
	.hero-bg {
		position: absolute; inset: 0;
		width: 100%; height: 100%;
		object-fit: contain;
		display: block;
	}
	.flow-overlay {
		position: absolute; inset: 0;
		width: 100%; height: 100%;
		pointer-events: none;
	}

	.hero-status {
		text-align: center;
		padding: 14px 16px;
		background: rgba(255,255,255,0.025);
		border: 0.5px solid rgba(255,255,255,0.07);
		border-radius: 13px;
		display: flex;
		flex-direction: column;
		gap: 4px;
		align-items: center;
		justify-content: center;
	}
	.hero-value {
		font-size: 1.8rem; font-weight: 600;
		letter-spacing: -0.02em; line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}
	.hero-label {
		font-size: 10.5px; font-weight: 600;
		opacity: 0.85; margin-top: 2px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	/* Klikbare variant van hero-status (afname-knop) */
	.hero-status-btn {
		border: 0.5px solid rgba(255,255,255,0.07);
		font: inherit;
		cursor: pointer;
		width: 100%;
		transition: background 0.18s, border-color 0.18s, transform 0.18s;
	}
	.hero-status-btn:hover {
		background: rgba(255,255,255,0.04);
		border-color: rgba(255,255,255,0.12);
	}
	.hero-status-btn:active {
		transform: scale(0.995);
	}
	.hero-chevron {
		display: inline-flex;
		vertical-align: middle;
		margin-left: 6px;
		opacity: 0.65;
	}

	/* Sub-modal "Verbruik per apparaat" */
	.devices-overlay {
		z-index: 70;
	}
	.devices-modal {
		position: fixed;
		top: 50%; left: 50%;
		transform: translate(-50%, -50%);
		z-index: 80;
		width: min(var(--popup-width, 850px), calc(100vw - 1.5rem));
		height: min(var(--popup-height, 1140px), calc(100vh - 1.5rem));
		max-height: calc(100vh - 1.5rem);
		display: flex; flex-direction: column;
		background: linear-gradient(180deg, #1a2238 0%, #0f1424 100%);
		border: 0.5px solid rgba(255,255,255,0.08);
		border-radius: 18px;
		overflow: hidden;
	}
	.devices-modal::before {
		content: '';
		position: absolute;
		top: 0; left: 50%;
		width: 60%; height: 1px;
		background: linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent);
		transform: translateX(-50%);
		pointer-events: none;
		z-index: 5;
	}
	.devices-close {
		position: relative;
		z-index: 1;
		width: 32px; height: 32px;
		border: 0.5px solid rgba(255,255,255,0.10);
		background: rgba(255,255,255,0.04);
		border-radius: 9px;
		color: rgba(255,255,255,0.75);
		display: grid; place-items: center;
		cursor: pointer;
		transition: background 0.18s, color 0.18s;
	}
	.devices-close:hover {
		background: rgba(255,255,255,0.08);
		color: #fff;
	}
	/* === Sub-modal "Verbruik per apparaat" — clean layout, no scrollbars === */
	.devices-body {
		gap: 12px;
		overflow-y: auto;
		overflow-x: hidden;
	}
	.devices-summary {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.summary-card {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 14px 16px;
		background: rgba(255,255,255,0.025);
		border: 0.5px solid rgba(255,255,255,0.07);
		border-radius: 13px;
	}
	.summary-card-accent {
		background: rgba(251,146,60,0.08);
		border-color: rgba(251,146,60,0.18);
	}
	.summary-label {
		font-size: 10.5px;
		color: rgba(255,255,255,0.55);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.summary-value {
		display: flex;
		align-items: baseline;
		gap: 4px;
	}
	.summary-value .num {
		font-size: 1.5rem;
		font-weight: 600;
		color: #fff;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}
	.summary-value .unit {
		font-size: 12.5px;
		color: rgba(255,255,255,0.55);
		font-weight: 500;
	}
	.summary-foot {
		font-size: 11px;
		color: rgba(255,255,255,0.4);
		margin-top: 2px;
	}

	/* Toggle bovenaan tussen 'nu' en 'vandaag' */
	.chart-mode-toggle {
		display: inline-flex;
		gap: 4px;
		padding: 4px;
		background: rgba(0,0,0,0.25);
		border: 0.5px solid rgba(255,255,255,0.06);
		border-radius: 10px;
		align-self: flex-start;
	}
	.chart-mode-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		background: transparent;
		border: 0;
		color: rgba(255,255,255,0.55);
		font-size: 12px;
		font-weight: 500;
		border-radius: 7px;
		cursor: pointer;
		transition: background 0.15s, color 0.15s;
	}
	.chart-mode-btn:hover {
		color: rgba(255,255,255,0.85);
	}
	.chart-mode-btn.active {
		background: rgba(251,146,60,0.18);
		color: #fb923c;
	}

	/* Staafgrafiek SVG container */
	.chart-wrap {
		background: rgba(0,0,0,0.20);
		border: 0.5px solid rgba(255,255,255,0.05);
		border-radius: 12px;
		padding: 16px 14px 10px;
		flex-shrink: 0;
		overflow-x: auto;
		overflow-y: hidden;
	}
	.chart-svg {
		display: block;
		width: 100%;
		min-width: 320px;
		height: 220px;
	}
	.chart-empty {
		text-align: center;
		padding: 36px 12px;
		color: rgba(255,255,255,0.45);
		font-size: 13px;
	}

	/* Legenda — klikbaar */
	.chart-legend {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 6px 10px;
		padding-top: 4px;
	}
	.legend-item {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}
	.legend-btn {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		flex: 1;
		min-width: 0;
		padding: 6px 10px;
		background: rgba(255,255,255,0.025);
		border: 0.5px solid rgba(255,255,255,0.06);
		border-radius: 8px;
		color: #f5f5f5;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s, border-color 0.15s, opacity 0.15s;
	}
	.legend-btn:hover {
		background: rgba(255,255,255,0.045);
		border-color: rgba(255,255,255,0.10);
	}
	.legend-btn-static,
	.legend-btn-static:hover {
		cursor: default;
		background: rgba(255,255,255,0.025);
		border-color: rgba(255,255,255,0.06);
	}
	.legend-item.hidden .legend-btn {
		opacity: 0.4;
	}
	.legend-item.hidden .legend-dot {
		opacity: 0.35;
	}
	.legend-dot {
		width: 10px; height: 10px;
		border-radius: 3px;
		flex-shrink: 0;
		transition: opacity 0.15s;
	}
	.legend-name {
		flex: 1;
		min-width: 0;
		font-size: 12.5px;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		letter-spacing: -0.01em;
	}
	.legend-live-dot {
		width: 5px; height: 5px;
		border-radius: 50%;
		background: #fb923c;
		box-shadow: 0 0 6px rgba(251,146,60,0.6);
		flex-shrink: 0;
		animation: chart-dot-pulse 1.6s ease-in-out infinite;
	}
	@keyframes chart-dot-pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.45; }
	}
	.legend-value {
		font-size: 11.5px;
		font-weight: 600;
		color: rgba(255,255,255,0.7);
		font-variant-numeric: tabular-nums;
		flex-shrink: 0;
		letter-spacing: -0.01em;
	}
	.legend-rename {
		width: 24px; height: 24px;
		display: grid; place-items: center;
		background: transparent;
		border: 0;
		border-radius: 6px;
		color: rgba(255,255,255,0.35);
		cursor: pointer;
		transition: background 0.15s, color 0.15s, opacity 0.15s;
		opacity: 0;
		flex-shrink: 0;
	}
	.legend-item:hover .legend-rename {
		opacity: 1;
	}
	.legend-rename:hover {
		background: rgba(255,255,255,0.08);
		color: #f5f5f5;
	}

	/* Rename inline (binnen legenda) */
	.device-rename {
		display: flex;
		align-items: center;
		gap: 5px;
		flex: 1;
		min-width: 0;
	}
	.device-rename-input {
		flex: 1;
		min-width: 0;
		background: rgba(0,0,0,0.3);
		border: 0.5px solid rgba(251,146,60,0.35);
		border-radius: 6px;
		padding: 3px 7px;
		font-size: 12px;
		color: #f5f5f5;
		outline: none;
		font-family: inherit;
		letter-spacing: -0.01em;
	}
	.device-rename-input:focus {
		border-color: rgba(251,146,60,0.6);
	}
	.device-rename-btn {
		width: 20px; height: 20px;
		display: grid; place-items: center;
		border: 0;
		border-radius: 5px;
		cursor: pointer;
		transition: background 0.15s;
		flex-shrink: 0;
	}
	.device-rename-btn.save {
		background: rgba(74,222,128,0.18);
		color: #4ade80;
	}
	.device-rename-btn.save:hover { background: rgba(74,222,128,0.28); }
	.device-rename-btn.cancel {
		background: rgba(248,113,113,0.14);
		color: #f87171;
	}
	.device-rename-btn.cancel:hover { background: rgba(248,113,113,0.24); }

	/* === BELANGRIJK: scrollen in modal body === */
	.devices-body {
		gap: 14px !important;
		overflow-y: auto !important;
		overflow-x: hidden;
	}

	:global(.devices-modal .devices-body)::-webkit-scrollbar,
	.devices-body::-webkit-scrollbar {
		width: 0;
		height: 0;
		display: none;
	}
	:global(.devices-modal .devices-body)::-webkit-scrollbar-thumb,
	.devices-body::-webkit-scrollbar-thumb {
		background: transparent;
	}
	:global(.devices-modal .devices-body)::-webkit-scrollbar-track,
	.devices-body::-webkit-scrollbar-track {
		background: transparent;
	}

	@media (max-width: 480px) {
		.np-detail-head { padding: 14px 16px 12px; }
		.modal-body { padding: 12px 16px 16px; }
		.np-detail-head-title { font-size: 14px; }
		.devices-summary { grid-template-columns: 1fr; }
		.chart-legend { grid-template-columns: 1fr; }
		.legend-rename { opacity: 1; }
	}
</style>
