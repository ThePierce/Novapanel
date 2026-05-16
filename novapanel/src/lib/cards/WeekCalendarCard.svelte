<script lang="ts">
	import { onMount } from 'svelte';
	import type { CameraConfig } from '$lib/persistence/panel-state-types';
	import { entityStore } from '$lib/ha/entities-store';
	import { browserSafeHomeAssistantUrl, type HomeAssistantEntity } from '$lib/ha/entities-service-helpers';
	import { listCalendarEvents, type CalendarEvent } from '$lib/ha/calendar-service';
	import TablerIcon from '$lib/icons/TablerIcon.svelte';
	import { localeFor, selectedLanguageStore, translate, translateState } from '$lib/i18n';

	type CalendarSource = CameraConfig;
	type PositionedEvent = CalendarEvent & {
		source: CalendarSource;
		sourceName: string;
		color: string;
		startDate: Date;
		endDate: Date;
		allDay: boolean;
	};
	type EventLayout = {
		event: PositionedEvent;
		column: number;
		columns: number;
	};
	type EventDetailLine = {
		label: string;
		value: string;
		href?: string;
	};
	type DayWindow = {
		key: string;
		date: Date;
		windowStart: Date;
		windowEnd: Date;
	};
	type PersonLocation = {
		entity: HomeAssistantEntity;
		lat: number;
		lon: number;
		label: string;
		picture: string;
		isHome: boolean;
	};
	type PersonModalState = {
		source: CalendarSource;
		title: string;
		color: string;
		isGroup: boolean;
		people: PersonLocation[];
	};
	type MapTile = {
		key: string;
		url: string;
		left: number;
		top: number;
		width: number;
		height: number;
	};
	type MapView = {
		zoom: number;
		scale: number;
		leftPx: number;
		topPx: number;
		widthPx: number;
		heightPx: number;
		tiles: MapTile[];
	};

	type Props = {
		title?: string;
		sources?: CalendarSource[];
		expanded?: boolean;
		canToggleExpansion?: boolean;
		onToggleExpansion?: () => void;
	};

	let {
		title = 'Weekkalender',
		sources = [],
		expanded = false,
		canToggleExpansion = false,
		onToggleExpansion
	}: Props = $props();
	let now = $state(new Date());
	let events = $state<PositionedEvent[]>([]);
	let loading = $state(false);
	let error = $state('');
	let personModal = $state<PersonModalState | null>(null);
	let eventModal = $state<PositionedEvent | null>(null);
	let calendarScrollEl = $state<HTMLDivElement | null>(null);
	let invalidAvatarUrls = $state<Record<string, true>>({});
	let loadToken = 0;
	let sourceKey = $state('');
	let lastScrollAnchor = '';

	const timelineHours = 24;
	const visibleHours = $derived(expanded ? 18 : 8);
	const palette = ['#a7f3d0', '#fde68a', '#93c5fd', '#f9a8d4', '#c4b5fd'];
	const todayKey = $derived(localDateKey(now));
	const visibleSources = $derived(
		(sources ?? [])
			.filter((source) => typeof source.entityId === 'string' && source.entityId.trim().length > 0)
	);
	const personEntities = $derived($entityStore.entities.filter((entity) => entity.domain === 'person'));
	const zoneEntities = $derived($entityStore.entities.filter((entity) => entity.domain === 'zone'));
	const homeZone = $derived(zoneEntities.find((entity) => entity.entityId === 'zone.home'));
	const days = $derived(buildDays(todayKey, 0, timelineHours));
	const hourLabels = $derived(
		Array.from({ length: timelineHours + 1 }, (_, index) => index % 24)
	);
	const hasAllDayEvents = $derived(days.some((day) => allDayEventsForDay(day).length > 0));
	const scrollAnchorKey = $derived(`${todayKey}-${expanded ? 'expanded' : 'compact'}-${hasAllDayEvents ? 'all-day' : 'timed'}-${sourceKey}`);
	const displayTitle = $derived(title && title.trim().length > 0 ? title.trim() : translate('Weekkalender', $selectedLanguageStore));

	$effect(() => {
		sourceKey = JSON.stringify(visibleSources.map((source) => [source.entityId, source.alias, source.color, source.personEntityId]));
	});

	$effect(() => {
		void sourceKey;
		const first = days[0]?.windowStart;
		const last = days[days.length - 1]?.windowEnd;
		if (!first || !last) return;
		void loadEvents(first, last);
	});

	$effect(() => {
		if (!calendarScrollEl || visibleSources.length === 0 || scrollAnchorKey === lastScrollAnchor) return;
		lastScrollAnchor = scrollAnchorKey;
		window.requestAnimationFrame(() => scrollCalendarToNow());
	});

	onMount(() => {
		const timer = window.setInterval(() => {
			now = new Date();
		}, 60_000);
		return () => window.clearInterval(timer);
	});

	function scrollCalendarToNow() {
		if (!calendarScrollEl) return;
		const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize || '16') || 16;
		const rowPx = rootFontSize * 3.25;
		const headerPx = rootFontSize * (4.6 + (hasAllDayEvents ? 3 : 0));
		const currentHour = now.getHours() + now.getMinutes() / 60;
		calendarScrollEl.scrollTop = Math.max(0, headerPx + Math.max(0, currentHour - 1) * rowPx);
	}

	function localDateKey(value: Date) {
		return [
			value.getFullYear(),
			String(value.getMonth() + 1).padStart(2, '0'),
			String(value.getDate()).padStart(2, '0')
		].join('-');
	}

	function buildDays(baseKey: string, hour: number, hours: number): DayWindow[] {
		const [year, month, day] = baseKey.split('-').map((part) => Number.parseInt(part, 10));
		const today = new Date(year, (month || 1) - 1, day || 1);
		return Array.from({ length: 7 }, (_, index) => {
			const date = addDays(today, index);
			const windowStart = new Date(date);
			windowStart.setHours(hour, 0, 0, 0);
			const windowEnd = new Date(windowStart);
			windowEnd.setHours(windowStart.getHours() + hours);
			return {
				key: date.toISOString().slice(0, 10),
				date,
				windowStart,
				windowEnd
			};
		});
	}

	function addDays(value: Date, daysToAdd: number) {
		const next = new Date(value);
		next.setDate(next.getDate() + daysToAdd);
		return next;
	}

	function sourceDisplayName(source: CalendarSource) {
		if (source.alias && source.alias.trim().length > 0) return source.alias.trim();
		return $entityStore.entities.find((entity) => entity.entityId === source.entityId)?.friendlyName ?? source.entityId;
	}

	function sourceColor(source: CalendarSource, index: number) {
		return source.color && /^#[0-9a-f]{6}$/i.test(source.color) ? source.color : palette[index % palette.length];
	}

	function normalizeName(value: string) {
		return value
			.toLowerCase()
			.replace(/^calendar\./, '')
			.replace(/^person\./, '')
			.replace(/^zone\./, '')
			.replace(/[_\-.]+/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}

	function personEntityForSource(source: CalendarSource) {
		if (source.personEntityId) {
			const explicit = personEntities.find((entity) => entity.entityId === source.personEntityId);
			if (explicit) return explicit;
		}
		const candidates = [source.alias ?? '', sourceDisplayName(source), source.entityId].map(normalizeName).filter(Boolean);
		return (
			personEntities.find((person) => {
				const personKeys = [person.friendlyName, person.entityId].map(normalizeName).filter(Boolean);
				return personKeys.some((personKey) =>
					candidates.some((candidate) => candidate === personKey || candidate.includes(personKey) || personKey.includes(candidate))
				);
			}) ?? null
		);
	}

	function normalizeAvatarUrl(raw: string): string {
		const trimmed = raw.trim();
		return trimmed ? browserSafeHomeAssistantUrl(trimmed) : '';
	}

	function markAvatarFailed(raw: string) {
		const url = normalizeAvatarUrl(raw);
		if (!url || invalidAvatarUrls[url]) return;
		invalidAvatarUrls = { ...invalidAvatarUrls, [url]: true };
	}

	function safeAvatarUrl(raw: string) {
		const url = normalizeAvatarUrl(raw);
		if (!url || invalidAvatarUrls[url]) return '';
		return url;
	}

	function avatarUrlFor(entity: HomeAssistantEntity | null) {
		const raw = typeof entity?.attributes?.entity_picture === 'string' ? entity.attributes.entity_picture : '';
		return raw ? safeAvatarUrl(raw) : '';
	}

	function initialFor(sourceOrPerson: CalendarSource | HomeAssistantEntity) {
		const name =
			'domain' in sourceOrPerson && sourceOrPerson.domain === 'person'
				? sourceOrPerson.friendlyName
				: sourceDisplayName(sourceOrPerson as CalendarSource);
		return (name.trim().charAt(0) || '?').toUpperCase();
	}

	function numberAttribute(entity: HomeAssistantEntity | undefined, key: string) {
		const raw = entity?.attributes?.[key];
		if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
		if (typeof raw === 'string') {
			const parsed = Number(raw);
			if (Number.isFinite(parsed)) return parsed;
		}
		return null;
	}

	function homeCoordinates() {
		const lat = numberAttribute(homeZone, 'latitude');
		const lon = numberAttribute(homeZone, 'longitude');
		return lat === null || lon === null ? null : { lat, lon };
	}

	function zoneForState(state: string) {
		const normalized = normalizeName(state);
		if (!normalized) return null;
		return (
			zoneEntities.find((zone) => {
				const keys = [zone.friendlyName, zone.entityId].map(normalizeName).filter(Boolean);
				return keys.some((key) => key === normalized || key.includes(normalized) || normalized.includes(key));
			}) ?? null
		);
	}

	function personLocation(entity: HomeAssistantEntity): PersonLocation | null {
		const attrs = entity.attributes ?? {};
		let lat = numberAttribute(entity, 'latitude');
		let lon = numberAttribute(entity, 'longitude');
		const isHome = entity.state === 'home' || normalizeName(entity.state) === normalizeName(homeZone?.friendlyName ?? '');
		if ((lat === null || lon === null) && isHome) {
			const home = homeCoordinates();
			lat = home?.lat ?? null;
			lon = home?.lon ?? null;
		}
		if ((lat === null || lon === null) && entity.state && entity.state !== 'not_home') {
			const zone = zoneForState(entity.state);
			lat = numberAttribute(zone ?? undefined, 'latitude');
			lon = numberAttribute(zone ?? undefined, 'longitude');
		}
		if (lat === null || lon === null) return null;
		return {
			entity,
			lat,
			lon,
			label: locationLabel(entity),
			picture: avatarUrlFor(entity),
			isHome
		};
	}

	function isGroupPerson(entity: HomeAssistantEntity | null) {
		if (!entity) return false;
		const name = `${entity.entityId} ${entity.friendlyName}`.toLowerCase();
		return name.includes('family') || name.includes('household') || name.includes('gezin');
	}

	function peopleForSource(source: CalendarSource) {
		const linkedPerson = personEntityForSource(source);
		if (isGroupPerson(linkedPerson)) {
			const people = personEntities
				.filter((entity) => entity.entityId !== linkedPerson?.entityId)
				.map(personLocation)
				.filter((location): location is PersonLocation => location !== null);
			return people.length > 0 && linkedPerson ? people : linkedPerson ? [personLocation(linkedPerson)].filter((location): location is PersonLocation => location !== null) : [];
		}
		return linkedPerson ? [personLocation(linkedPerson)].filter((location): location is PersonLocation => location !== null) : [];
	}

	function locationLabel(entity: HomeAssistantEntity) {
		if (entity.state === 'home') return translate('Thuis', $selectedLanguageStore);
		if (entity.state === 'not_home') return translate('Niet thuis', $selectedLanguageStore);
		return entity.state ? translateState(entity.state, $selectedLanguageStore) : translate('Locatie onbekend', $selectedLanguageStore);
	}

	function openPersonModal(source: CalendarSource, index: number, event: MouseEvent) {
		event.stopPropagation();
		const linkedPerson = personEntityForSource(source);
		personModal = {
			source,
			title: sourceDisplayName(source),
			color: sourceColor(source, index),
			isGroup: isGroupPerson(linkedPerson),
			people: peopleForSource(source)
		};
	}

	function closePersonModal() {
		personModal = null;
	}

	function handleTitleToggle(event: MouseEvent) {
		event.stopPropagation();
		if (!canToggleExpansion) return;
		onToggleExpansion?.();
	}

	function openEventModal(calendarEvent: PositionedEvent, event: MouseEvent) {
		event.stopPropagation();
		eventModal = calendarEvent;
	}

	function closeEventModal() {
		eventModal = null;
	}

	function boundsFor(people: PersonLocation[]) {
		const home = homeCoordinates();
		const points = [
			...people.map((person) => ({ lat: person.lat, lon: person.lon })),
			...(home ? [home] : [])
		];
		if (points.length === 0) {
			return { minLat: 0, maxLat: 1, minLon: 0, maxLon: 1 };
		}
		let minLat = Math.min(...points.map((point) => point.lat));
		let maxLat = Math.max(...points.map((point) => point.lat));
		let minLon = Math.min(...points.map((point) => point.lon));
		let maxLon = Math.max(...points.map((point) => point.lon));
		const latPad = Math.max(0.004, (maxLat - minLat) * 0.22);
		const lonPad = Math.max(0.004, (maxLon - minLon) * 0.22);
		minLat -= latPad;
		maxLat += latPad;
		minLon -= lonPad;
		maxLon += lonPad;
		return { minLat, maxLat, minLon, maxLon };
	}

	function clampNumber(value: number, min: number, max: number) {
		return Math.max(min, Math.min(max, value));
	}

	function mercatorX(lon: number) {
		return (lon + 180) / 360;
	}

	function mercatorY(lat: number) {
		const safeLat = clampNumber(lat, -85.05112878, 85.05112878);
		const rad = (safeLat * Math.PI) / 180;
		return (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2;
	}

	function tileUrl(zoom: number, x: number, y: number) {
		const world = 2 ** zoom;
		const wrappedX = ((x % world) + world) % world;
		const safeY = clampNumber(y, 0, world - 1);
		return `https://tile.openstreetmap.org/${zoom}/${wrappedX}/${safeY}.png`;
	}

	function mapViewFor(people: PersonLocation[]): MapView {
		const bounds = boundsFor(people);
		const minX = mercatorX(bounds.minLon);
		const maxX = mercatorX(bounds.maxLon);
		const minY = mercatorY(bounds.maxLat);
		const maxY = mercatorY(bounds.minLat);
		const spanX = Math.max(0.000001, maxX - minX);
		const spanY = Math.max(0.000001, maxY - minY);
		const widthPx = 980;
		const heightPx = 430;
		const zoomX = Math.log2(widthPx / (spanX * 256 * 1.5));
		const zoomY = Math.log2(heightPx / (spanY * 256 * 1.5));
		const zoom = Math.floor(clampNumber(Math.min(zoomX, zoomY), 3, 17));
		const scale = 256 * 2 ** zoom;
		const centerX = ((minX + maxX) / 2) * scale;
		const centerY = ((minY + maxY) / 2) * scale;
		const leftPx = centerX - widthPx / 2;
		const topPx = centerY - heightPx / 2;
		const firstTileX = Math.floor(leftPx / 256);
		const lastTileX = Math.floor((leftPx + widthPx) / 256);
		const firstTileY = Math.floor(topPx / 256);
		const lastTileY = Math.floor((topPx + heightPx) / 256);
		const tiles: MapTile[] = [];
		for (let y = firstTileY; y <= lastTileY; y += 1) {
			for (let x = firstTileX; x <= lastTileX; x += 1) {
				tiles.push({
					key: `${zoom}-${x}-${y}`,
					url: tileUrl(zoom, x, y),
					left: ((x * 256 - leftPx) / widthPx) * 100,
					top: ((y * 256 - topPx) / heightPx) * 100,
					width: (256 / widthPx) * 100,
					height: (256 / heightPx) * 100
				});
			}
		}
		return { zoom, scale, leftPx, topPx, widthPx, heightPx, tiles };
	}

	function mapPointStyle(lat: number, lon: number, people: PersonLocation[], view: MapView = mapViewFor(people)) {
		const x = ((mercatorX(lon) * view.scale - view.leftPx) / view.widthPx) * 100;
		const y = ((mercatorY(lat) * view.scale - view.topPx) / view.heightPx) * 100;
		return `left: ${clampNumber(x, 5, 95)}%; top: ${clampNumber(y, 7, 93)}%;`;
	}

	function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
		const rad = Math.PI / 180;
		const dLat = (b.lat - a.lat) * rad;
		const dLon = (b.lon - a.lon) * rad;
		const lat1 = a.lat * rad;
		const lat2 = b.lat * rad;
		const h =
			Math.sin(dLat / 2) * Math.sin(dLat / 2) +
			Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
		return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
	}

	function formatTravelMinutes(minutes: number) {
		if (minutes < 60) return `${minutes} min`;
		const hours = Math.floor(minutes / 60);
		const rest = minutes % 60;
		return rest === 0 ? `${hours} u` : `${hours} u ${rest} min`;
	}

	function travelTimeFor(location: PersonLocation, mode: 'car' | 'bike') {
		const home = homeCoordinates();
		if (!home) return translate('Onbekend', $selectedLanguageStore);
		if (location.isHome) return translate('Thuis', $selectedLanguageStore);
		const km = distanceKm({ lat: location.lat, lon: location.lon }, home);
		if (km < 0.12) return translate('Thuis', $selectedLanguageStore);
		const speed = mode === 'car' ? 45 : 16;
		const buffer = mode === 'car' ? 4 : 2;
		return formatTravelMinutes(Math.max(1, Math.ceil((km / speed) * 60 + buffer)));
	}

	function parseEventDate(value: CalendarEvent['start'] | CalendarEvent['end']): { date: Date; allDay: boolean } | null {
		if (typeof value === 'string') {
			const date = new Date(value);
			return Number.isNaN(date.getTime()) ? null : { date, allDay: false };
		}
		if (!value || typeof value !== 'object') return null;
		if (typeof value.dateTime === 'string') {
			const date = new Date(value.dateTime);
			return Number.isNaN(date.getTime()) ? null : { date, allDay: false };
		}
		if (typeof value.date === 'string') {
			const date = new Date(`${value.date}T00:00:00`);
			return Number.isNaN(date.getTime()) ? null : { date, allDay: true };
		}
		return null;
	}

	function startOfLocalDay(value: Date) {
		const next = new Date(value);
		next.setHours(0, 0, 0, 0);
		return next;
	}

	function looksLikeAllDayEvent(start: Date, end: Date) {
		const duration = end.getTime() - start.getTime();
		if (duration < 23 * 60 * 60 * 1000) return false;
		const durationDays = duration / 86_400_000;
		const fullDays = Math.round(durationDays);
		if (fullDays < 1 || Math.abs(durationDays - fullDays) > 0.04) return false;
		const startMinute = start.getHours() * 60 + start.getMinutes();
		const endMinute = end.getHours() * 60 + end.getMinutes();
		return Math.abs(startMinute - endMinute) <= 2;
	}

	async function loadEvents(start: Date, end: Date) {
		const token = ++loadToken;
		if (visibleSources.length === 0) {
			events = [];
			error = '';
			return;
		}
		loading = true;
		error = '';
		try {
			const batches = await Promise.all(
				visibleSources.map(async (source, index) => {
					const rawEvents = await listCalendarEvents(source.entityId, start, end);
					return rawEvents
						.map((event): PositionedEvent | null => {
							const startParsed = parseEventDate(event.start);
							const endParsed = parseEventDate(event.end);
							if (!startParsed || !endParsed) return null;
							return {
								...event,
								source,
								sourceName: sourceDisplayName(source),
								color: sourceColor(source, index),
								startDate: startParsed.date,
								endDate: endParsed.date,
								allDay: startParsed.allDay || endParsed.allDay || looksLikeAllDayEvent(startParsed.date, endParsed.date)
							};
						})
						.filter((event): event is PositionedEvent => event !== null);
				})
			);
			if (token !== loadToken) return;
			events = batches.flat().sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
		} catch (err) {
			if (token !== loadToken) return;
			error = err instanceof Error && err.message ? err.message : translate('Kalender laden mislukt', $selectedLanguageStore);
			events = [];
		} finally {
			if (token === loadToken) loading = false;
		}
	}

	function isSameCalendarDay(a: Date, b: Date) {
		return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
	}

	function eventsForDay(day: DayWindow) {
		return events.filter((event) => {
			if (event.allDay) return allDayEventCoversDay(event, day);
			return event.endDate > day.windowStart && event.startDate < day.windowEnd;
		});
	}

	function timedEventsForDay(day: DayWindow) {
		return eventsForDay(day).filter((event) => !event.allDay);
	}

	function allDayEventsForDay(day: DayWindow) {
		return eventsForDay(day).filter((event) => event.allDay);
	}

	function allDayEventCoversDay(event: PositionedEvent, day: DayWindow) {
		const eventStart = startOfLocalDay(event.startDate);
		const duration = event.endDate.getTime() - event.startDate.getTime();
		const spanDays = Math.max(1, Math.round(duration / 86_400_000) || 1);
		const eventEnd = addDays(eventStart, spanDays);
		const dayStart = startOfLocalDay(day.date);
		return dayStart >= eventStart && dayStart < eventEnd;
	}

	function eventKey(event: PositionedEvent) {
		return event.uid ?? `${event.source.entityId}-${event.summary}-${event.startDate.toISOString()}-${event.endDate.toISOString()}`;
	}

	function clampedEventStart(event: PositionedEvent, day: DayWindow) {
		return Math.max(event.startDate.getTime(), day.windowStart.getTime());
	}

	function clampedEventEnd(event: PositionedEvent, day: DayWindow) {
		return Math.min(event.endDate.getTime(), day.windowEnd.getTime());
	}

	function layoutTimedEventsForDay(day: DayWindow): EventLayout[] {
		const sorted = timedEventsForDay(day).sort((a, b) => {
			const startDiff = clampedEventStart(a, day) - clampedEventStart(b, day);
			if (startDiff !== 0) return startDiff;
			return clampedEventEnd(b, day) - clampedEventEnd(a, day);
		});
		const clusters: PositionedEvent[][] = [];
		let cluster: PositionedEvent[] = [];
		let clusterEnd = -Infinity;
		for (const event of sorted) {
			const start = clampedEventStart(event, day);
			const end = clampedEventEnd(event, day);
			if (cluster.length > 0 && start >= clusterEnd) {
				clusters.push(cluster);
				cluster = [];
				clusterEnd = -Infinity;
			}
			cluster.push(event);
			clusterEnd = Math.max(clusterEnd, end);
		}
		if (cluster.length > 0) clusters.push(cluster);

		return clusters.flatMap((clusterEvents) => {
			const columnEnds: number[] = [];
			const placed = clusterEvents.map((event) => {
				const start = clampedEventStart(event, day);
				const end = clampedEventEnd(event, day);
				let column = columnEnds.findIndex((columnEnd) => columnEnd <= start);
				if (column === -1) {
					column = columnEnds.length;
					columnEnds.push(end);
				} else {
					columnEnds[column] = end;
				}
				return { event, column, columns: 1 };
			});
			const columns = Math.max(1, columnEnds.length);
			return placed.map((item) => ({ ...item, columns }));
		});
	}

	function eventStyle(event: PositionedEvent, day: DayWindow, layout?: EventLayout) {
		const total = day.windowEnd.getTime() - day.windowStart.getTime();
		const start = clampedEventStart(event, day);
		const end = clampedEventEnd(event, day);
		const top = ((start - day.windowStart.getTime()) / total) * 100;
		const height = Math.max(7, ((end - start) / total) * 100);
		const columns = Math.max(1, layout?.columns ?? 1);
		const column = Math.max(0, layout?.column ?? 0);
		const left = (column / columns) * 100;
		const width = 100 / columns;
		return `--event-color: ${event.color}; top: ${top}%; height: ${height}%; left: calc(${left}% + 0.12rem); width: calc(${width}% - 0.24rem);`;
	}

	function eventVisibleMinutes(event: PositionedEvent, day: DayWindow) {
		const start = clampedEventStart(event, day);
		const end = clampedEventEnd(event, day);
		return Math.max(0, Math.round((end - start) / 60_000));
	}

	function eventHasAvatarRoom(event: PositionedEvent, day: DayWindow) {
		return expanded ? eventVisibleMinutes(event, day) >= 30 : eventVisibleMinutes(event, day) >= 45;
	}

	function currentLineStyle(day: DayWindow) {
		const total = day.windowEnd.getTime() - day.windowStart.getTime();
		const top = ((now.getTime() - day.windowStart.getTime()) / total) * 100;
		return `top: ${Math.max(0, Math.min(100, top))}%;`;
	}

	function isNowInDayWindow(day: DayWindow) {
		return now >= day.windowStart && now <= day.windowEnd && isSameCalendarDay(now, day.date);
	}

	function formatHour(hour: number) {
		return `${String(hour).padStart(2, '0')}:00`;
	}

	function shortLabel(value: string) {
		return value.replace(/\./g, '').trim().slice(0, 3).toLowerCase();
	}

	function formatDayName(date: Date) {
		const value = date.toLocaleDateString(localeFor($selectedLanguageStore), { weekday: expanded ? 'long' : 'short' });
		return expanded ? value : shortLabel(value);
	}

	function formatMonthName(date: Date) {
		const value = date.toLocaleDateString(localeFor($selectedLanguageStore), { month: expanded ? 'long' : 'short' });
		return expanded ? value : shortLabel(value);
	}

	function formatEventTime(event: PositionedEvent) {
		if (event.allDay) return translate('Hele dag', $selectedLanguageStore);
		const start = event.startDate.toLocaleTimeString(localeFor($selectedLanguageStore), { hour: '2-digit', minute: '2-digit', hour12: false });
		const end = event.endDate.toLocaleTimeString(localeFor($selectedLanguageStore), { hour: '2-digit', minute: '2-digit', hour12: false });
		return `${start}-${end}`;
	}

	function formatEventTimeRange(event: PositionedEvent) {
		if (event.allDay) return translate('Hele dag', $selectedLanguageStore);
		const start = event.startDate.toLocaleTimeString(localeFor($selectedLanguageStore), { hour: '2-digit', minute: '2-digit', hour12: false });
		const end = event.endDate.toLocaleTimeString(localeFor($selectedLanguageStore), { hour: '2-digit', minute: '2-digit', hour12: false });
		return `${start} ${translate('tot', $selectedLanguageStore)} ${end}`;
	}

	function formatEventDate(value: Date) {
		return value.toLocaleDateString(localeFor($selectedLanguageStore), { weekday: 'long', day: '2-digit', month: 'long' });
	}

	function visibleAllDayEndDate(event: PositionedEvent) {
		if (!event.allDay) return event.endDate;
		const end = new Date(event.endDate);
		if (end.getHours() === 0 && end.getMinutes() === 0 && end.getSeconds() === 0 && end.getMilliseconds() === 0) {
			end.setDate(end.getDate() - 1);
		}
		return end;
	}

	function formatEventDateRange(event: PositionedEvent) {
		if (event.allDay) {
			const end = visibleAllDayEndDate(event);
			if (isSameCalendarDay(event.startDate, end)) return `${formatEventDate(event.startDate)} · ${translate('Hele dag', $selectedLanguageStore)}`;
			return `${formatEventDate(event.startDate)} ${translate('tot', $selectedLanguageStore)} ${formatEventDate(end)}`;
		}
		if (isSameCalendarDay(event.startDate, event.endDate)) {
			return `${formatEventDate(event.startDate)} · ${formatEventTimeRange(event)}`;
		}
		return `${formatEventDate(event.startDate)} ${formatEventTimeRange(event)} · ${formatEventDate(event.endDate)}`;
	}

	function decodeBasicEntities(value: string) {
		return value
			.replace(/&nbsp;/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>');
	}

	function cleanEventText(value: unknown) {
		if (typeof value !== 'string') return '';
		return decodeBasicEntities(
			value
				.replace(/<br\s*\/?>/gi, '\n')
				.replace(/<\/p>/gi, '\n')
				.replace(/<[^>]+>/g, '')
		)
			.replace(/\r\n/g, '\n')
			.replace(/\n{3,}/g, '\n\n')
			.trim();
	}

	function compactDetailValue(value: unknown): string {
		if (value === null || value === undefined) return '';
		if (typeof value === 'string') return cleanEventText(value);
		if (typeof value === 'number' || typeof value === 'boolean') return String(value);
		if (value instanceof Date) return value.toLocaleString(localeFor($selectedLanguageStore));
		if (Array.isArray(value)) {
			return value.map(compactDetailValue).filter(Boolean).join(', ');
		}
		if (typeof value === 'object') {
			const record = value as Record<string, unknown>;
			const common = ['displayName', 'name', 'email', 'value', 'status']
				.map((key) => compactDetailValue(record[key]))
				.filter(Boolean);
			if (common.length > 0) return common.join(' · ');
			try {
				return JSON.stringify(value);
			} catch {
				return '';
			}
		}
		return '';
	}

	function detailLabelFor(key: string) {
		const labels: Record<string, string> = {
			htmlLink: translate('Link', $selectedLanguageStore),
			link: translate('Link', $selectedLanguageStore),
			url: translate('Link', $selectedLanguageStore),
			status: translate('Status', $selectedLanguageStore),
			organizer: translate('Organisator', $selectedLanguageStore),
			attendees: translate('Deelnemers', $selectedLanguageStore),
			creator: translate('Aangemaakt door', $selectedLanguageStore),
			created: translate('Aangemaakt', $selectedLanguageStore),
			updated: translate('Bijgewerkt', $selectedLanguageStore),
			recurrence: translate('Herhaling', $selectedLanguageStore),
			recurrence_id: translate('Herhaling', $selectedLanguageStore),
			rrule: translate('Herhaling', $selectedLanguageStore)
		};
		if (labels[key]) return labels[key];
		return key
			.replace(/([a-z])([A-Z])/g, '$1 $2')
			.replace(/[_-]+/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.replace(/^./, (char) => char.toUpperCase());
	}

	function isLikelyUrl(value: string) {
		return /^https?:\/\//i.test(value);
	}

	function eventPrimaryDetails(event: PositionedEvent): EventDetailLine[] {
		const details: EventDetailLine[] = [
			{ label: translate('Wanneer', $selectedLanguageStore), value: formatEventDateRange(event) },
			{ label: translate('Kalender', $selectedLanguageStore), value: event.sourceName }
		];
		const location = cleanEventText(event.location);
		if (location) details.push({ label: translate('Locatie', $selectedLanguageStore), value: location });
		return details;
	}

	function eventNotes(event: PositionedEvent) {
		return cleanEventText(event.description);
	}

	function eventAdditionalDetails(event: PositionedEvent): EventDetailLine[] {
		const ignored = new Set([
			'uid',
			'summary',
			'start',
			'end',
			'description',
			'location',
			'source',
			'sourceName',
			'color',
			'startDate',
			'endDate',
			'allDay'
		]);
		return Object.entries(event)
			.filter(([key]) => !ignored.has(key))
			.map(([key, value]) => {
				const text = compactDetailValue(value);
				return {
					label: detailLabelFor(key),
					value: text.length > 280 ? `${text.slice(0, 277)}...` : text,
					href: isLikelyUrl(text) ? text : undefined
				};
			})
			.filter((detail) => detail.value.length > 0);
	}
</script>

<div class="week-calendar-card" class:expanded style={`--visible-hours: ${visibleHours}; --timeline-hours: ${timelineHours};`}>
	<div class="wc-top">
		<div class="wc-title-row">
			<button
				type="button"
				class="wc-title-button"
				class:can-toggle={canToggleExpansion}
				disabled={!canToggleExpansion}
				aria-label={`${expanded ? translate('Maak kleiner', $selectedLanguageStore) : translate('Maak groter', $selectedLanguageStore)}: ${displayTitle}`}
				onclick={handleTitleToggle}
			>
				<span class="wc-title-icon">
					<TablerIcon name={canToggleExpansion ? (expanded ? 'arrows-minimize' : 'arrows-maximize') : 'calendar-week'} size={18} />
				</span>
				<strong>{displayTitle}</strong>
			</button>
			<span class="wc-title-sub">{now.toLocaleDateString(localeFor($selectedLanguageStore), { weekday: 'long', day: '2-digit', month: 'long' })} · {now.toLocaleTimeString(localeFor($selectedLanguageStore), { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
		</div>
		{#if visibleSources.length > 0}
			<div class="wc-people">
				{#each visibleSources as source, index (source.entityId)}
					{@const linkedPerson = personEntityForSource(source)}
					{@const avatar = avatarUrlFor(linkedPerson)}
					<button
						type="button"
						class="wc-person"
						style={`--person-color: ${sourceColor(source, index)};`}
						aria-label={`${translate('Locatie van', $selectedLanguageStore)} ${sourceDisplayName(source)}`}
						onclick={(event) => openPersonModal(source, index, event)}
					>
						{#if avatar}
							<img class="wc-person-avatar" src={avatar} alt="" loading="lazy" onerror={() => markAvatarFailed(avatar)} />
						{:else}
							<span class="wc-person-avatar fallback">{linkedPerson ? initialFor(linkedPerson) : initialFor(source)}</span>
						{/if}
						<span>{sourceDisplayName(source)}</span>
					</button>
				{/each}
			</div>
		{/if}
	</div>

	{#if visibleSources.length === 0}
		<div class="wc-empty">{translate('Kies kalender-entiteiten in edit mode.', $selectedLanguageStore)}</div>
	{:else}
		<div
			class="wc-scroll"
			bind:this={calendarScrollEl}
			onpointerdown={(event) => event.stopPropagation()}
		>
			<div class={`wc-grid ${hasAllDayEvents ? 'has-all-day' : ''}`}>
				<div class="wc-corner"></div>
				{#each days as day (day.key)}
					<div class="wc-day-head" class:today={isSameCalendarDay(day.date, now)}>
						<span class="wc-day-name">{formatDayName(day.date)}</span>
						<strong>{day.date.toLocaleDateString('nl-NL', { day: '2-digit' })}</strong>
						<span class="wc-month-name">{formatMonthName(day.date)}</span>
					</div>
				{/each}

				{#if hasAllDayEvents}
					<div class="wc-all-day-label">{translate('Hele dag', $selectedLanguageStore)}</div>
					{#each days as day (day.key)}
						<div class="wc-all-day-cell">
							{#each allDayEventsForDay(day) as event (eventKey(event))}
								<button
									type="button"
									class="wc-all-day-event"
									style={`--event-color: ${event.color};`}
									title={`${event.summary || translate('Afspraak', $selectedLanguageStore)} · ${translate('Hele dag', $selectedLanguageStore)}`}
									onclick={(clickEvent) => openEventModal(event, clickEvent)}
								>
									<strong>{event.summary || translate('Afspraak', $selectedLanguageStore)}</strong>
								</button>
							{/each}
						</div>
					{/each}
				{/if}

				<div class="wc-hours">
					{#each hourLabels as hour}
						<div>{formatHour(hour)}</div>
					{/each}
				</div>
				{#each days as day (day.key)}
					<div class="wc-day-body">
						{#each Array.from({ length: timelineHours }) as _}
							<div class="wc-hour-line"></div>
						{/each}
						{#if isNowInDayWindow(day)}
							<div class="wc-now-line" style={currentLineStyle(day)}></div>
						{/if}
						{#each layoutTimedEventsForDay(day) as layout (eventKey(layout.event))}
							{@const event = layout.event}
							{@const eventPerson = personEntityForSource(event.source)}
							{@const eventAvatar = avatarUrlFor(eventPerson)}
							<button
								type="button"
								class="wc-event"
								class:overlapped={layout.columns > 1}
								style={eventStyle(event, day, layout)}
								title={`${event.summary} · ${formatEventTime(event)}`}
								onclick={(clickEvent) => openEventModal(event, clickEvent)}
							>
								<strong>{event.summary || translate('Afspraak', $selectedLanguageStore)}</strong>
								<span>{formatEventTime(event)}</span>
								{#if eventAvatar && eventHasAvatarRoom(event, day)}
									<img class="wc-event-avatar" src={eventAvatar} alt="" loading="lazy" onerror={() => markAvatarFailed(eventAvatar)} />
								{/if}
							</button>
						{/each}
					</div>
				{/each}
			</div>
		</div>
		{#if loading}
			<div class="wc-status">{translate('Kalender laden...', $selectedLanguageStore)}</div>
		{:else if error}
			<div class="wc-status error">{error}</div>
		{/if}
	{/if}
</div>

{#if eventModal}
	{@const primaryDetails = eventPrimaryDetails(eventModal)}
	{@const notes = eventNotes(eventModal)}
	{@const additionalDetails = eventAdditionalDetails(eventModal)}
	<button
		type="button"
		class="wc-event-overlay"
		aria-label={translate('closeOverlay', $selectedLanguageStore)}
		onclick={(event) => {
			event.stopPropagation();
			closeEventModal();
		}}
	></button>
	<section
		class="wc-event-modal"
		role="dialog"
		aria-modal="true"
		aria-label={eventModal.summary || translate('Afspraak', $selectedLanguageStore)}
		style={`--event-color: ${eventModal.color};`}
	>
		<div class="wc-event-modal-head">
			<div class="wc-event-modal-title">
				<div class="wc-event-modal-icon">
					<TablerIcon name={eventModal.allDay ? 'calendar-event' : 'clock-hour-3'} size={22} />
				</div>
				<div>
					<strong>{eventModal.summary || translate('Afspraak', $selectedLanguageStore)}</strong>
					<span>{formatEventDateRange(eventModal)}</span>
				</div>
			</div>
			<button
				type="button"
				class="wc-event-close"
				aria-label={translate('close', $selectedLanguageStore)}
				onclick={(event) => {
					event.stopPropagation();
					closeEventModal();
				}}
			>
				<TablerIcon name="x" size={18} />
			</button>
		</div>

		<div class="wc-event-detail-body">
			{#each primaryDetails as detail (detail.label)}
				<div class="wc-event-detail-row">
					<span>{detail.label}</span>
					{#if detail.href}
						<a href={detail.href} target="_blank" rel="noreferrer" onclick={(event) => event.stopPropagation()}>{detail.value}</a>
					{:else}
						<strong>{detail.value}</strong>
					{/if}
				</div>
			{/each}

			{#if notes}
				<div class="wc-event-notes">
					<span>{translate('Notities', $selectedLanguageStore)}</span>
					<p>{notes}</p>
				</div>
			{/if}

			{#if additionalDetails.length > 0}
				<div class="wc-event-extra">
					<span>{translate('Aanvullend', $selectedLanguageStore)}</span>
					{#each additionalDetails as detail (`${detail.label}-${detail.value}`)}
						<div>
							<em>{detail.label}</em>
							{#if detail.href}
								<a href={detail.href} target="_blank" rel="noreferrer" onclick={(event) => event.stopPropagation()}>{detail.value}</a>
							{:else}
								<strong>{detail.value}</strong>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</section>
{/if}

{#if personModal}
	{@const mapView = mapViewFor(personModal.people)}
	<button
		type="button"
		class="wc-person-overlay"
		aria-label={translate('closeOverlay', $selectedLanguageStore)}
		onclick={(event) => {
			event.stopPropagation();
			closePersonModal();
		}}
	></button>
	<section
		class="wc-person-modal"
		role="dialog"
		aria-modal="true"
		aria-label={`${translate('Locatie van', $selectedLanguageStore)} ${personModal.title}`}
		style={`--person-color: ${personModal.color};`}
	>
			<div class="wc-person-modal-head">
				<div class="wc-person-modal-title">
					<div class="wc-person-modal-icon">
						{#if personModal.people[0]?.picture}
							<img src={personModal.people[0].picture} alt="" loading="lazy" onerror={() => markAvatarFailed(personModal.people[0]?.picture ?? '')} />
						{:else}
							<span>{personModal.people[0] ? initialFor(personModal.people[0].entity) : initialFor(personModal.source)}</span>
						{/if}
					</div>
					<div>
						<strong>{personModal.title}</strong>
						<span>{personModal.isGroup ? translate('Locatie van iedereen', $selectedLanguageStore) : (personModal.people[0]?.label ?? translate('Locatie onbekend', $selectedLanguageStore))}</span>
					</div>
				</div>
				<button type="button" class="wc-person-close" aria-label={translate('close', $selectedLanguageStore)} onclick={closePersonModal}>
					<TablerIcon name="x" size={18} />
				</button>
			</div>

			<div class="wc-location-map">
				<div class="wc-map-surface" aria-hidden="true"></div>
				<div class="wc-map-tiles" aria-hidden="true">
					{#each mapView.tiles as tile (tile.key)}
						<img
							class="wc-map-tile"
							src={tile.url}
							alt=""
							loading="lazy"
							referrerpolicy="no-referrer"
							style={`left: ${tile.left}%; top: ${tile.top}%; width: ${tile.width}%; height: ${tile.height}%;`}
						/>
					{/each}
				</div>
				<div class="wc-map-shade" aria-hidden="true"></div>
				{#if homeCoordinates()}
					{@const home = homeCoordinates()}
					<div class="wc-map-marker home" style={home ? mapPointStyle(home.lat, home.lon, personModal.people, mapView) : ''}>
						<TablerIcon name="home" size={15} />
						<span>{translate('Thuis', $selectedLanguageStore)}</span>
					</div>
				{/if}
				{#each personModal.people as person (person.entity.entityId)}
					<div class="wc-map-marker person" style={mapPointStyle(person.lat, person.lon, personModal.people, mapView)}>
						{#if person.picture}
							<img src={person.picture} alt="" loading="lazy" onerror={() => markAvatarFailed(person.picture)} />
						{:else}
							<span>{initialFor(person.entity)}</span>
						{/if}
						<em>{person.entity.friendlyName}</em>
					</div>
				{/each}
				{#if personModal.people.length === 0}
					<div class="wc-map-empty">{translate('Geen locatie beschikbaar. Koppel een person-entiteit of controleer de locatie-attributen.', $selectedLanguageStore)}</div>
				{/if}
				<a
					class="wc-map-attribution"
					href="https://www.openstreetmap.org/copyright"
					target="_blank"
					rel="noreferrer"
					onclick={(event) => event.stopPropagation()}
				>© OpenStreetMap</a>
			</div>

			{#if !personModal.isGroup && personModal.people[0]}
				<div class="wc-travel-grid">
					<div class="wc-travel-item">
						<TablerIcon name="car" size={22} />
						<div>
							<strong>{travelTimeFor(personModal.people[0], 'car')}</strong>
							<span>{translate('met de auto naar huis', $selectedLanguageStore)}</span>
						</div>
					</div>
					<div class="wc-travel-item">
						<TablerIcon name="bike" size={22} />
						<div>
							<strong>{travelTimeFor(personModal.people[0], 'bike')}</strong>
							<span>{translate('met de fiets naar huis', $selectedLanguageStore)}</span>
						</div>
					</div>
				</div>
			{/if}
	</section>
{/if}

<style>
	.week-calendar-card {
		width: 100%;
		min-height: 30rem;
		height: clamp(30rem, 58vh, 42rem);
		display: grid;
		grid-template-rows: auto 1fr auto;
		gap: 0.55rem;
		padding: 0.75rem;
		border-radius: 18px;
		background: transparent;
		box-shadow: none;
		color: #f5f5f5;
		box-sizing: border-box;
		overflow: hidden;
		transition: height 220ms ease;
	}
	.week-calendar-card.expanded {
		height: clamp(32rem, 64vh, 48rem);
	}
	.wc-top {
		display: grid;
		gap: 0.55rem;
	}
	.wc-title-row {
		display: grid;
		justify-items: start;
		gap: 0.12rem;
		min-width: 0;
	}
	.wc-title-button {
		display: inline-flex;
		align-items: center;
		gap: 0.55rem;
		max-width: 100%;
		padding: 0;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		text-align: left;
		appearance: none;
		cursor: default;
	}
	.wc-title-button.can-toggle {
		cursor: zoom-in;
	}
	.week-calendar-card.expanded .wc-title-button.can-toggle {
		cursor: zoom-out;
	}
	.wc-title-button:disabled {
		opacity: 1;
	}
	.wc-title-button:focus-visible {
		outline: 2px solid rgba(56,189,248,0.74);
		outline-offset: 4px;
		border-radius: 0.55rem;
	}
	.wc-title-icon {
		width: 1.95rem;
		height: 1.95rem;
		display: grid;
		place-items: center;
		border-radius: 0.7rem;
		background: rgba(56,189,248,0.1);
		box-shadow: inset 0 0 0 1px rgba(125,211,252,0.13);
		flex: 0 0 auto;
	}
	.wc-title-row :global(.tabler-icon) {
		color: #38bdf8;
	}
	.wc-title-button strong,
	.wc-title-sub {
		display: block;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.wc-title-button strong {
		font-size: 0.94rem;
		line-height: 1.1;
	}
	.wc-title-sub {
		max-width: calc(100% - 2.5rem);
		margin-left: 2.5rem;
		color: rgba(255,255,255,0.56);
		font-size: 0.72rem;
	}
	.wc-people {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
		min-width: 0;
	}
	.wc-person {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		max-width: 10rem;
		height: 1.7rem;
		padding: 0 0.58rem 0 0.22rem;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--person-color) 22%, rgba(255,255,255,0.05));
		color: rgba(255,255,255,0.86);
		font-size: 0.68rem;
		font-weight: 750;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		cursor: pointer;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--person-color) 28%, rgba(255,255,255,0.08));
		transition: transform 150ms ease, background 150ms ease;
	}
	.wc-person:hover {
		transform: translateY(-1px);
		background: color-mix(in srgb, var(--person-color) 30%, rgba(255,255,255,0.06));
	}
	.wc-person span:last-child {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.wc-person-avatar {
		width: 1.26rem;
		height: 1.26rem;
		border-radius: 999px;
		object-fit: cover;
		flex: 0 0 auto;
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--person-color) 46%, rgba(255,255,255,0.18));
	}
	.wc-person-avatar.fallback {
		display: grid;
		place-items: center;
		background: var(--person-color);
		color: rgba(15,23,42,0.85);
		font-size: 0.62rem;
		font-weight: 900;
	}
	.wc-empty,
	.wc-status {
		display: grid;
		place-items: center;
		min-height: 10rem;
		color: rgba(255,255,255,0.58);
		font-size: 0.82rem;
		text-align: center;
	}
	.wc-status {
		min-height: auto;
		place-items: start;
		font-size: 0.72rem;
	}
	.wc-status.error {
		color: #fca5a5;
	}
	.wc-scroll {
		min-height: 0;
		border-radius: 12px;
		overflow: auto;
		background: rgba(255,255,255,0.035);
		scrollbar-width: none;
		-ms-overflow-style: none;
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: contain;
		touch-action: pan-x pan-y;
	}
	.wc-scroll::-webkit-scrollbar {
		width: 0;
		height: 0;
		display: none;
	}
	.wc-grid {
		min-width: 50rem;
		min-height: calc(4.6rem + (var(--timeline-hours) * 3.25rem));
		display: grid;
		grid-template-columns: 3.35rem repeat(7, minmax(0, 1fr));
		grid-template-rows: auto auto;
		overflow: visible;
		background: transparent;
		box-shadow: none;
	}
	.wc-grid.has-all-day {
		min-height: calc(4.6rem + 3rem + (var(--timeline-hours) * 3.25rem));
		grid-template-rows: auto auto auto;
	}
	.wc-corner,
	.wc-day-head {
		position: sticky;
		top: 0;
		z-index: 8;
		min-height: 4.6rem;
		border-bottom: 1px solid rgba(255,255,255,0.07);
		background: rgba(255,255,255,0.035);
		backdrop-filter: blur(10px);
	}
	.wc-day-head {
		min-width: 0;
		padding: 0.45rem 0.25rem;
		text-align: center;
		border-left: 1px solid rgba(255,255,255,0.055);
	}
	.wc-day-head span,
	.wc-day-head strong {
		display: block;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.wc-day-name,
	.wc-month-name {
		color: rgba(255,255,255,0.64);
		font-size: 0.66rem;
		text-transform: capitalize;
	}
	.wc-day-head strong {
		margin-top: 0.05rem;
		font-size: 0.9rem;
	}
	.wc-month-name {
		margin-top: 0.05rem;
		color: rgba(255,255,255,0.48);
		font-size: 0.58rem;
	}
	.week-calendar-card.expanded .wc-day-name {
		font-size: 0.7rem;
	}
	.week-calendar-card.expanded .wc-month-name {
		font-size: 0.62rem;
	}
	.wc-day-head.today strong {
		width: 1.55rem;
		height: 1.55rem;
		margin: 0.12rem auto 0;
		display: grid;
		place-items: center;
		border-radius: 999px;
		background: #2563eb;
	}
	.wc-all-day-label,
	.wc-all-day-cell {
		position: sticky;
		top: 4.6rem;
		z-index: 7;
		min-height: 3rem;
		border-bottom: 1px solid rgba(255,255,255,0.07);
		background: rgba(255,255,255,0.026);
		backdrop-filter: blur(10px);
	}
	.wc-all-day-label {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		padding: 0.38rem 0.36rem;
		color: rgba(255,255,255,0.46);
		font-size: 0.58rem;
		font-weight: 850;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.wc-all-day-cell {
		display: grid;
		align-content: start;
		gap: 0.18rem;
		min-width: 0;
		padding: 0.32rem 0.24rem;
		border-left: 1px solid rgba(255,255,255,0.055);
	}
	.wc-all-day-event {
		min-width: 0;
		width: 100%;
		border: 0;
		border-radius: 0.42rem;
		padding: 0.18rem 0.34rem;
		background: color-mix(in srgb, var(--event-color) 28%, rgba(255,255,255,0.11));
		color: rgba(255,255,255,0.86);
		font: inherit;
		text-align: left;
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--event-color) 28%, rgba(255,255,255,0.08));
		font-size: 0.58rem;
		font-weight: 800;
		line-height: 1.08;
		backdrop-filter: blur(4px);
		cursor: pointer;
		appearance: none;
	}
	.wc-all-day-event:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--event-color) 72%, white);
		outline-offset: 2px;
	}
	.wc-all-day-event strong,
	.wc-all-day-event span {
		display: block;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.wc-all-day-event span {
		margin-top: 0.08rem;
		color: rgba(255,255,255,0.58);
		font-size: 0.5rem;
		font-weight: 750;
	}
	.wc-hours {
		position: relative;
		display: grid;
		grid-template-rows: repeat(var(--timeline-hours), 1fr) 0;
		color: rgba(255,255,255,0.48);
		font-size: 0.58rem;
		background: rgba(0,0,0,0.08);
	}
	.wc-hours div {
		transform: translateY(-0.45rem);
		padding-right: 0.32rem;
		text-align: right;
	}
	.wc-day-body {
		position: relative;
		min-width: 0;
		height: calc(var(--timeline-hours) * 3.25rem);
		border-left: 1px solid rgba(255,255,255,0.055);
		overflow: hidden;
	}
	.wc-hour-line {
		height: 3.25rem;
		border-top: 1px solid rgba(255,255,255,0.06);
	}
	.wc-event {
		position: absolute;
		min-height: 1.75rem;
		padding: 0.32rem 0.35rem;
		border: 0;
		border-radius: 0.48rem;
		background: color-mix(in srgb, var(--event-color) 34%, rgba(255,255,255,0.14));
		color: rgba(255,255,255,0.88);
		font: inherit;
		text-align: left;
		box-shadow:
			inset 0 0 0 1px color-mix(in srgb, var(--event-color) 32%, rgba(255,255,255,0.10)),
			0 8px 20px rgba(0,0,0,0.12);
		overflow: hidden;
		backdrop-filter: blur(4px);
		cursor: pointer;
		appearance: none;
		transition: transform 140ms ease, background 140ms ease, box-shadow 140ms ease;
	}
	.wc-event:hover {
		transform: translateY(-1px);
		background: color-mix(in srgb, var(--event-color) 42%, rgba(255,255,255,0.15));
	}
	.wc-event:focus-visible {
		outline: 2px solid color-mix(in srgb, var(--event-color) 72%, white);
		outline-offset: 2px;
	}
	.wc-event.overlapped {
		padding: 0.28rem 0.3rem;
	}
	.wc-event strong,
	.wc-event span {
		display: block;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.wc-event strong {
		font-size: 0.64rem;
		line-height: 1.05;
	}
	.wc-event.overlapped strong {
		white-space: normal;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		line-height: 1.08;
	}
	.wc-event span {
		margin-top: 0.12rem;
		font-size: 0.54rem;
		font-style: normal;
		font-weight: 750;
		opacity: 0.66;
	}
	.wc-event.overlapped span {
		font-size: 0.5rem;
	}
	.wc-event-avatar {
		position: absolute;
		right: 0.32rem;
		bottom: 0.32rem;
		width: 1.08rem;
		height: 1.08rem;
		border-radius: 999px;
		object-fit: cover;
		box-shadow:
			0 0 0 2px rgba(255,255,255,0.28),
			0 4px 10px rgba(0,0,0,0.18);
		pointer-events: none;
	}
	.week-calendar-card.expanded .wc-event-avatar {
		width: 1.18rem;
		height: 1.18rem;
	}
	.wc-now-line {
		position: absolute;
		left: 0;
		right: 0;
		z-index: 3;
		height: 2px;
		background: #3b82f6;
		box-shadow: 0 0 0 1px rgba(59,130,246,0.18), 0 0 14px rgba(59,130,246,0.45);
	}
	.wc-event-overlay {
		position: fixed;
		inset: 0;
		z-index: 82;
		display: block;
		padding: 1.25rem;
		border: 0;
		margin: 0;
		background: rgba(0,0,0,0.38);
		backdrop-filter: blur(14px);
	}
	.wc-event-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		z-index: 83;
		transform: translate(-50%, -50%);
		width: min(34rem, calc(100vw - 2rem));
		max-height: min(38rem, calc(100vh - 2rem));
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		gap: 0.85rem;
		padding: 1rem;
		border-radius: 22px;
		background:
			radial-gradient(circle at 18% 10%, color-mix(in srgb, var(--event-color) 22%, transparent), transparent 42%),
			rgba(20,28,44,0.96);
		color: #f8fafc;
		box-shadow:
			inset 0 0 0 1px rgba(255,255,255,0.09),
			0 26px 80px rgba(0,0,0,0.42);
		overflow: hidden;
	}
	.wc-event-modal-head,
	.wc-event-modal-title {
		display: flex;
		align-items: center;
		min-width: 0;
	}
	.wc-event-modal-head {
		justify-content: space-between;
		gap: 1rem;
	}
	.wc-event-modal-title {
		gap: 0.75rem;
	}
	.wc-event-modal-icon {
		width: 3rem;
		height: 3rem;
		display: grid;
		place-items: center;
		border-radius: 1rem;
		background: color-mix(in srgb, var(--event-color) 24%, rgba(255,255,255,0.08));
		color: color-mix(in srgb, var(--event-color) 82%, white);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--event-color) 32%, rgba(255,255,255,0.08));
		flex: 0 0 auto;
	}
	.wc-event-modal-title strong,
	.wc-event-modal-title span {
		display: block;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.wc-event-modal-title strong {
		font-size: 1.08rem;
		line-height: 1.08;
	}
	.wc-event-modal-title span {
		margin-top: 0.18rem;
		color: rgba(255,255,255,0.62);
		font-size: 0.78rem;
		font-weight: 750;
	}
	.wc-event-close {
		width: 2.35rem;
		height: 2.35rem;
		border: 0;
		border-radius: 999px;
		display: grid;
		place-items: center;
		background: rgba(255,255,255,0.08);
		color: rgba(255,255,255,0.86);
		cursor: pointer;
	}
	.wc-event-detail-body {
		min-height: 0;
		display: grid;
		gap: 0.6rem;
		overflow: auto;
	}
	.wc-event-detail-row,
	.wc-event-notes,
	.wc-event-extra {
		min-width: 0;
		padding: 0.72rem;
		border-radius: 0.95rem;
		background: rgba(255,255,255,0.06);
		box-shadow: inset 0 0 0 1px rgba(255,255,255,0.075);
	}
	.wc-event-detail-row span,
	.wc-event-notes > span,
	.wc-event-extra > span {
		display: block;
		margin-bottom: 0.22rem;
		color: rgba(255,255,255,0.5);
		font-size: 0.64rem;
		font-weight: 850;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.wc-event-detail-row strong,
	.wc-event-detail-row a {
		display: block;
		color: rgba(255,255,255,0.9);
		font-size: 0.86rem;
		font-weight: 800;
		line-height: 1.28;
		overflow-wrap: anywhere;
	}
	.wc-event-detail-row a,
	.wc-event-extra a {
		color: color-mix(in srgb, var(--event-color) 74%, white);
		text-decoration: none;
	}
	.wc-event-notes p {
		margin: 0;
		color: rgba(255,255,255,0.86);
		font-size: 0.82rem;
		font-weight: 650;
		line-height: 1.42;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.wc-event-extra {
		display: grid;
		gap: 0.45rem;
	}
	.wc-event-extra div {
		display: grid;
		gap: 0.14rem;
		min-width: 0;
	}
	.wc-event-extra em {
		color: rgba(255,255,255,0.48);
		font-size: 0.66rem;
		font-style: normal;
		font-weight: 800;
	}
	.wc-event-extra strong,
	.wc-event-extra a {
		min-width: 0;
		color: rgba(255,255,255,0.86);
		font-size: 0.76rem;
		font-weight: 750;
		line-height: 1.3;
		overflow-wrap: anywhere;
	}
	.wc-person-overlay {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: block;
		padding: 1.25rem;
		border: 0;
		margin: 0;
		background: rgba(0,0,0,0.38);
		backdrop-filter: blur(14px);
	}
	.wc-person-modal {
		position: fixed;
		top: 50%;
		left: 50%;
		z-index: 81;
		transform: translate(-50%, -50%);
		width: min(40rem, calc(100vw - 2rem));
		max-height: min(42rem, calc(100vh - 2rem));
		display: grid;
		grid-template-rows: auto minmax(16rem, 1fr) auto;
		gap: 0.85rem;
		padding: 1rem;
		border-radius: 22px;
		background:
			radial-gradient(circle at 18% 10%, color-mix(in srgb, var(--person-color) 20%, transparent), transparent 42%),
			rgba(20,28,44,0.96);
		color: #f8fafc;
		box-shadow:
			inset 0 0 0 1px rgba(255,255,255,0.09),
			0 26px 80px rgba(0,0,0,0.42);
		overflow: hidden;
	}
	.wc-person-modal-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		min-width: 0;
	}
	.wc-person-modal-title {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		min-width: 0;
	}
	.wc-person-modal-icon {
		width: 3rem;
		height: 3rem;
		display: grid;
		place-items: center;
		border-radius: 1rem;
		background: color-mix(in srgb, var(--person-color) 24%, rgba(255,255,255,0.08));
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--person-color) 32%, rgba(255,255,255,0.08));
		overflow: hidden;
		flex: 0 0 auto;
	}
	.wc-person-modal-icon img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.wc-person-modal-icon span {
		color: color-mix(in srgb, var(--person-color) 85%, white);
		font-size: 1.1rem;
		font-weight: 900;
	}
	.wc-person-modal-title strong,
	.wc-person-modal-title span {
		display: block;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.wc-person-modal-title strong {
		font-size: 1.05rem;
		line-height: 1.05;
	}
	.wc-person-modal-title span {
		margin-top: 0.16rem;
		color: rgba(255,255,255,0.62);
		font-size: 0.78rem;
		font-weight: 750;
	}
	.wc-person-close {
		width: 2.35rem;
		height: 2.35rem;
		border: 0;
		border-radius: 999px;
		display: grid;
		place-items: center;
		background: rgba(255,255,255,0.08);
		color: rgba(255,255,255,0.86);
		cursor: pointer;
	}
	.wc-location-map {
		position: relative;
		min-height: 18rem;
		border-radius: 1.1rem;
		overflow: hidden;
		background:
			linear-gradient(135deg, rgba(56,189,248,0.16), transparent 38%),
			linear-gradient(315deg, rgba(34,197,94,0.15), transparent 40%),
			rgba(255,255,255,0.045);
		box-shadow: inset 0 0 0 1px rgba(255,255,255,0.075);
	}
	.wc-map-surface {
		position: absolute;
		inset: 0;
		z-index: 0;
		background-image:
			linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
		background-size: 3.3rem 3.3rem;
		mask-image: radial-gradient(circle at center, black, transparent 84%);
		opacity: 0.42;
	}
	.wc-map-tiles {
		position: absolute;
		inset: 0;
		z-index: 1;
		background: rgba(17,24,39,0.2);
	}
	.wc-map-tile {
		position: absolute;
		display: block;
		object-fit: cover;
		filter: saturate(0.82) brightness(0.72) contrast(1.08);
	}
	.wc-map-shade {
		position: absolute;
		inset: 0;
		z-index: 2;
		pointer-events: none;
		background:
			radial-gradient(circle at 50% 44%, transparent 0 36%, rgba(15,23,42,0.1) 70%),
			linear-gradient(180deg, rgba(15,23,42,0.12), rgba(15,23,42,0.24));
	}
	.wc-map-marker {
		position: absolute;
		z-index: 4;
		transform: translate(-50%, -50%);
	}
	.wc-map-attribution {
		position: absolute;
		right: 0.5rem;
		bottom: 0.45rem;
		z-index: 5;
		padding: 0.16rem 0.36rem;
		border-radius: 999px;
		background: rgba(15,23,42,0.68);
		color: rgba(255,255,255,0.72);
		font-size: 0.52rem;
		font-weight: 750;
		text-decoration: none;
		box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
	}
	.wc-map-marker.person {
		display: grid;
		place-items: center;
	}
	.wc-map-marker.person img,
	.wc-map-marker.person > span {
		width: 2.55rem;
		height: 2.55rem;
		border-radius: 999px;
		background: var(--person-color);
		color: rgba(15,23,42,0.88);
		display: grid;
		place-items: center;
		object-fit: cover;
		font-weight: 900;
		box-shadow:
			0 0 0 4px rgba(255,255,255,0.16),
			0 12px 28px rgba(0,0,0,0.28);
	}
	.wc-map-marker.person em {
		margin-top: 0.35rem;
		padding: 0.18rem 0.45rem;
		border-radius: 999px;
		background: rgba(15,23,42,0.72);
		color: rgba(255,255,255,0.88);
		font-size: 0.62rem;
		font-style: normal;
		font-weight: 800;
		white-space: nowrap;
		box-shadow: inset 0 0 0 1px rgba(255,255,255,0.08);
	}
	.wc-map-marker.home {
		display: inline-flex;
		align-items: center;
		gap: 0.28rem;
		padding: 0.28rem 0.5rem;
		border-radius: 999px;
		background: rgba(15,23,42,0.76);
		color: #e0f2fe;
		font-size: 0.66rem;
		font-weight: 850;
		box-shadow:
			inset 0 0 0 1px rgba(125,211,252,0.26),
			0 12px 28px rgba(0,0,0,0.22);
	}
	.wc-map-empty {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1.25rem;
		text-align: center;
		color: rgba(255,255,255,0.58);
		font-size: 0.82rem;
	}
	.wc-travel-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.65rem;
	}
	.wc-travel-item {
		display: flex;
		align-items: center;
		gap: 0.65rem;
		min-width: 0;
		padding: 0.72rem;
		border-radius: 0.95rem;
		background: rgba(255,255,255,0.06);
		box-shadow: inset 0 0 0 1px rgba(255,255,255,0.075);
	}
	.wc-travel-item :global(.tabler-icon) {
		color: color-mix(in srgb, var(--person-color) 76%, white);
		flex: 0 0 auto;
	}
	.wc-travel-item strong,
	.wc-travel-item span {
		display: block;
		min-width: 0;
	}
	.wc-travel-item strong {
		font-size: 0.95rem;
		line-height: 1.05;
	}
	.wc-travel-item span {
		margin-top: 0.12rem;
		color: rgba(255,255,255,0.58);
		font-size: 0.68rem;
		font-weight: 750;
	}
	@media (max-width: 760px) {
		.week-calendar-card {
			padding: 0.62rem;
			height: clamp(28rem, 68vh, 38rem);
		}
		.wc-grid {
			min-width: 44rem;
			grid-template-columns: 2.9rem repeat(7, minmax(0, 1fr));
		}
		.wc-event {
			padding: 0.25rem;
		}
		.wc-event-overlay {
			padding: 0.75rem;
		}
		.wc-event-modal {
			padding: 0.85rem;
		}
		.wc-person-overlay {
			padding: 0.75rem;
		}
		.wc-person-modal {
			grid-template-rows: auto minmax(15rem, 1fr) auto;
			padding: 0.85rem;
		}
		.wc-travel-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
