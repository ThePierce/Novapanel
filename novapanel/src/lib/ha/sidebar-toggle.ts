const NOVAPANEL_TOGGLE_SELECTOR = '.ha-hamburger, [data-np-ha-sidebar-toggle="true"]';

const HA_TOGGLE_SELECTORS = [
	'ha-menu-button',
	'ha-top-app-bar-fixed ha-menu-button',
	'ha-drawer ha-menu-button',
	'ha-icon-button[slot="navigationIcon"]',
	'mwc-icon-button[slot="navigationIcon"]',
	'paper-icon-button[slot="navigationIcon"]',
	'button[slot="navigationIcon"]',
	'button[title*="Zijbalk"]',
	'button[aria-label*="Zijbalk"]',
	'button[title*="Menu"]',
	'button[aria-label*="Menu"]',
	'button[title*="Sidebar"]',
	'button[aria-label*="Sidebar"]',
	'button[title*="menu"]',
	'button[aria-label*="menu"]',
	'button[title*="sidebar"]',
	'button[aria-label*="sidebar"]',
	'ha-sidebar ha-icon-button',
	'ha-sidebar button'
];

const HA_EVENT_TARGET_SELECTOR = [
	'home-assistant',
	'home-assistant-main',
	'ha-drawer',
	'app-drawer',
	'ha-sidebar',
	'ha-panel-lovelace',
	'hui-root'
].join(',');

let novaOpenedSidebar = false;
let outsideCleanup: (() => void) | null = null;
let outsideInstallId = 0;

function asHTMLElement(element: Element | null | undefined): HTMLElement | null {
	if (!element || typeof (element as HTMLElement).matches !== 'function') return null;
	return element as HTMLElement;
}

function isNovaPanelToggle(element: HTMLElement): boolean {
	try {
		return (
			element.matches(NOVAPANEL_TOGGLE_SELECTOR) ||
			Boolean(element.closest(NOVAPANEL_TOGGLE_SELECTOR))
		);
	} catch {
		return false;
	}
}

function isUsableHAToggleCandidate(element: Element | null | undefined): element is HTMLElement {
	const htmlElement = asHTMLElement(element);
	if (!htmlElement || isNovaPanelToggle(htmlElement)) return false;
	if ((htmlElement as HTMLButtonElement).disabled) return false;
	return htmlElement.getAttribute('aria-disabled') !== 'true';
}

function deepQuerySelector(root: ParentNode | ShadowRoot, selector: string): HTMLElement | null {
	for (const element of root.querySelectorAll(selector)) {
		if (isUsableHAToggleCandidate(element)) return element;
	}

	for (const element of root.querySelectorAll('*')) {
		const shadow = (element as HTMLElement).shadowRoot;
		if (!shadow) continue;
		const found = deepQuerySelector(shadow, selector);
		if (found) return found;
	}

	return null;
}

function deepQuerySelectorAll(
	root: ParentNode | ShadowRoot,
	selector: string,
	found: Set<EventTarget> = new Set()
): Set<EventTarget> {
	for (const element of root.querySelectorAll(selector)) {
		found.add(element);
	}

	for (const element of root.querySelectorAll('*')) {
		const shadow = (element as HTMLElement).shadowRoot;
		if (!shadow) continue;
		deepQuerySelectorAll(shadow, selector, found);
	}

	return found;
}

function getClickableElement(element: HTMLElement): HTMLElement {
	const shadowButton = element.shadowRoot?.querySelector(
		'button, ha-icon-button, mwc-icon-button, paper-icon-button'
	) as HTMLElement | null;
	if (shadowButton && shadowButton !== element) return getClickableElement(shadowButton);
	return element;
}

function getAccessibleDocument(target: Window): Document | null {
	try {
		return target.document;
	} catch {
		return null;
	}
}

function findHASidebarToggleButton(target: Window): HTMLElement | null {
	// In standalone/current-document mode this app only has its own hamburger button.
	// The real Home Assistant chrome lives in the parent/top frame when running as ingress.
	if (target === window) return null;

	const document = getAccessibleDocument(target);
	if (!document) return null;

	for (const selector of HA_TOGGLE_SELECTORS) {
		const found = deepQuerySelector(document, selector);
		if (found) return getClickableElement(found);
	}

	return null;
}

function getCandidateWindows(): Window[] {
	const windows: Window[] = [];
	for (const candidate of [window.parent, window.top, window]) {
		if (!candidate || windows.includes(candidate)) continue;
		windows.push(candidate);
	}
	return windows;
}

function createSidebarEvent(target: Window, eventName: string): CustomEvent {
	const EventConstructor = target.CustomEvent ?? CustomEvent;
	return new EventConstructor(eventName, { bubbles: true, composed: true });
}

function dispatchSidebarEvent(targetWindow: Window, target: EventTarget | null | undefined, eventName: string) {
	if (!target) return false;
	try {
		target.dispatchEvent(createSidebarEvent(targetWindow, eventName));
		return true;
	} catch {
		return false;
	}
}

function signalHASidebar(targetWindow: Window): boolean {
	let signalled = false;
	const document = getAccessibleDocument(targetWindow);
	const eventTargets = new Set<EventTarget>([targetWindow]);

	if (document) {
		eventTargets.add(document);
		if (document.documentElement) eventTargets.add(document.documentElement);
		if (document.body) eventTargets.add(document.body);
		for (const target of deepQuerySelectorAll(document, HA_EVENT_TARGET_SELECTOR)) {
			eventTargets.add(target);
		}
	}

	for (const eventName of ['hass-toggle-menu', 'hass-toggle-sidebar']) {
		for (const target of eventTargets) {
			signalled = dispatchSidebarEvent(targetWindow, target, eventName) || signalled;
		}
	}

	for (const message of [
		{ source: 'novapanel', type: 'hass-toggle-menu' },
		{ source: 'novapanel', type: 'hass-toggle-sidebar' },
		{ source: 'novapanel', type: 'hass-sidebar-toggle' },
		{ source: 'novapanel', command: 'toggle-sidebar' }
	]) {
		try {
			targetWindow.postMessage(message, '*');
			signalled = true;
		} catch {}
	}

	return signalled;
}

function toggleNativeHASidebar(): boolean {
	for (const target of getCandidateWindows()) {
		try {
			const toggleButton = findHASidebarToggleButton(target);
			if (toggleButton) {
				toggleButton.click();
				return true;
			}
		} catch {}
	}

	let signalled = false;
	for (const target of getCandidateWindows()) {
		signalled = signalHASidebar(target) || signalled;
	}
	return signalled;
}

function clearOutsideHandlers() {
	outsideInstallId += 1;
	outsideCleanup?.();
	outsideCleanup = null;
}

export function closeHASidebar() {
	if (!novaOpenedSidebar) return;
	novaOpenedSidebar = false;
	clearOutsideHandlers();
	toggleNativeHASidebar();
}

function installOutsideCloseHandler(toggleButton: HTMLElement | null) {
	clearOutsideHandlers();
	const installId = outsideInstallId;
	const handlePointerDown = (event: PointerEvent) => {
		const target = event.target;
		if (target instanceof Node && toggleButton?.contains(target)) return;
		closeHASidebar();
	};
	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key === 'Escape') closeHASidebar();
	};
	window.setTimeout(() => {
		if (installId !== outsideInstallId || !novaOpenedSidebar) return;
		document.addEventListener('pointerdown', handlePointerDown, true);
		document.addEventListener('keydown', handleKeyDown, true);
		outsideCleanup = () => {
			document.removeEventListener('pointerdown', handlePointerDown, true);
			document.removeEventListener('keydown', handleKeyDown, true);
		};
	}, 0);
}

export function openHASidebar(event?: MouseEvent) {
	event?.preventDefault();
	event?.stopPropagation();
	const toggleButton = event?.currentTarget instanceof HTMLElement ? event.currentTarget : null;
	if (!toggleNativeHASidebar()) return;
	novaOpenedSidebar = !novaOpenedSidebar;
	if (novaOpenedSidebar) {
		installOutsideCloseHandler(toggleButton);
	} else {
		clearOutsideHandlers();
	}
}
