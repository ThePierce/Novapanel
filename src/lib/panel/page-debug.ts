import type { ViewSectionDraft } from '$lib/persistence/panel-state';

export const PAGE_DEBUG_KEY = 'np_debug_log_v1';
export const PAGE_DEBUG_BUILD = 'np-debug-2026-04-25T10:40:00Z';

export function countViewCards(sections: ViewSectionDraft[]): number {
	let total = 0;
	for (const section of sections) {
		if (Array.isArray(section.cards)) total += section.cards.length;
	}
	return total;
}

export type DebugLogFn = (event: string, payload: Record<string, unknown>) => void;

export function createDebugLogger(enabled: boolean, key = PAGE_DEBUG_KEY): DebugLogFn {
	return (event: string, payload: Record<string, unknown>) => {
		if (!enabled) return;
		const entry = {
			ts: new Date().toISOString(),
			event,
			...payload
		};
		try {
			const existing = localStorage.getItem(key);
			const parsed = existing ? (JSON.parse(existing) as unknown) : [];
			const list = Array.isArray(parsed) ? parsed : [];
			list.push(entry);
			while (list.length > 120) list.shift();
			localStorage.setItem(key, JSON.stringify(list));
		} catch {}
		console.log('[NovaPanel debug]', entry);
	};
}

function readDashboardCardCounts(storageKey: string): {
	viewCards: number;
	sidebarCards: number;
	rawLength: number;
} {
	let viewCards = -1;
	let sidebarCards = -1;
	let rawLength = -1;
	try {
		const raw = localStorage.getItem(storageKey);
		rawLength = raw ? raw.length : 0;
		const parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
		const sections = Array.isArray(parsed?.viewSections) ? parsed.viewSections : [];
		const sidebar = Array.isArray(parsed?.sidebarCards) ? parsed.sidebarCards : [];
		viewCards = sections.reduce((total, section) => {
			if (!section || typeof section !== "object") return total;
			const cards = (section as Record<string, unknown>).cards;
			return total + (Array.isArray(cards) ? cards.length : 0);
		}, 0);
		sidebarCards = sidebar.length;
	} catch {}
	return { viewCards, sidebarCards, rawLength };
}

export function setupGlobalDebug(enabled: boolean, debugLog: DebugLogFn, build = PAGE_DEBUG_BUILD) {
	if (!enabled) return;
	try {
		(window as Window & { __npDebugBuild?: string }).__npDebugBuild = build;
		localStorage.setItem('np_debug_build', build);
	} catch {}
	console.error('[NovaPanel debug build]', build);
	try {
		window.addEventListener('error', (event) => {
			debugLog('window_error', {
				message: event.message,
				filename: event.filename,
				lineno: event.lineno,
				colno: event.colno,
				error: String(event.error)
			});
		});
		window.addEventListener('unhandledrejection', (event) => {
			debugLog('window_unhandledrejection', {
				reason: String(event.reason)
			});
		});
	} catch {}
	const local = readDashboardCardCounts('np_dashboard_v1');
	const backup = readDashboardCardCounts('np_dashboard_v1_backup');
	debugLog('module_loaded', {
		build,
		pathname: window.location.pathname,
		localDashboardViewCards: local.viewCards,
		localDashboardSidebarCards: local.sidebarCards,
		backupDashboardViewCards: backup.viewCards,
		backupDashboardSidebarCards: backup.sidebarCards,
		localDashboardRawLength: local.rawLength,
		backupDashboardRawLength: backup.rawLength
	});
	queueMicrotask(() => {
		debugLog('module_microtask', { build });
	});
	setTimeout(() => {
		debugLog('module_timeout_0', { build });
	}, 0);
}
