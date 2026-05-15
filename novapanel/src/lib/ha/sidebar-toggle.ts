const NOVAPANEL_TOGGLE_SELECTOR = '.ha-hamburger, [data-np-ha-sidebar-toggle="true"]';

let novaOpenedSidebar = false;
let outsideCleanup: (() => void) | null = null;
let outsideInstallId = 0;

function isUsableHAToggleCandidate(element: Element): boolean {
	const htmlElement = element as HTMLElement;
	if (typeof htmlElement.matches !== 'function' || typeof htmlElement.closest !== 'function') {
		return false;
	}
	if (
		htmlElement.matches(NOVAPANEL_TOGGLE_SELECTOR) ||
		htmlElement.closest(NOVAPANEL_TOGGLE_SELECTOR)
	) {
		return false;
	}
	const tagName = htmlElement.tagName.toLowerCase();
	if (tagName === 'ha-menu-button' || tagName === 'ha-sidebar') return true;
	return htmlElement.closest('home-assistant, home-assistant-main, ha-drawer, ha-sidebar') !== null;
}

function deepQuerySelector(root: ParentNode | ShadowRoot, selector: string): Element | null {
	const direct = root.querySelector(selector);
	if (direct && isUsableHAToggleCandidate(direct)) return direct;
	const nodes = root.querySelectorAll('*');
	for (const node of nodes) {
		const shadow = (node as HTMLElement).shadowRoot;
		if (!shadow) continue;
		const found = deepQuerySelector(shadow, selector);
		if (found) return found;
	}
	return null;
}

function getClickableElement(element: HTMLElement): HTMLElement {
	const shadowButton = element.shadowRoot?.querySelector(
		'button, ha-icon-button, mwc-icon-button, paper-icon-button'
	) as HTMLElement | null;
	if (shadowButton && shadowButton !== element) return getClickableElement(shadowButton);
	return element;
}

function findHASidebarToggleButton(root: ParentNode | ShadowRoot): HTMLElement | null {
	const candidates = [
		'ha-menu-button',
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
		'ha-icon-button[slot="navigationIcon"]',
		'mwc-icon-button[slot="navigationIcon"]',
		'paper-icon-button[slot="navigationIcon"]',
		'ha-sidebar ha-icon-button',
		'ha-sidebar button'
	];
	for (const selector of candidates) {
		const found = deepQuerySelector(root, selector) as HTMLElement | null;
		if (found) return getClickableElement(found);
	}
	const sidebars = root.querySelectorAll('ha-sidebar');
	for (const sidebar of sidebars) {
		const shadow = (sidebar as HTMLElement).shadowRoot;
		if (!shadow) continue;
		const localBtn = shadow.querySelector(
			'ha-icon-button, button[title], button[aria-label]'
		) as HTMLElement | null;
		if (!localBtn || !isUsableHAToggleCandidate(localBtn)) continue;
		return getClickableElement(localBtn);
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

function dispatchSidebarEvent(target: EventTarget | null | undefined, eventName: string) {
	if (!target) return;
	try {
		target.dispatchEvent(new CustomEvent(eventName, { bubbles: true, composed: true }));
	} catch {}
}

function signalHASidebar(target: Window) {
	const events = ['hass-toggle-menu', 'hass-toggle-sidebar'];
	for (const eventName of events) {
		try {
			dispatchSidebarEvent(target, eventName);
			dispatchSidebarEvent(target.document, eventName);
			dispatchSidebarEvent(target.document.body, eventName);
			dispatchSidebarEvent(target.document.querySelector('home-assistant'), eventName);
		} catch {}
	}
	const messages = [
		{ type: 'hass-toggle-menu' },
		{ type: 'hass-toggle-sidebar' },
		{ type: 'hass-sidebar-toggle' },
		{ command: 'toggle-sidebar' }
	];
	for (const message of messages) {
		try {
			target.postMessage(message, '*');
		} catch {}
	}
}

function toggleNativeHASidebar(): boolean {
	let clicked = false;
	for (const target of getCandidateWindows()) {
		try {
			const toggleButton = findHASidebarToggleButton(target.document);
			if (toggleButton) {
				toggleButton.click();
				clicked = true;
			}
		} catch {}
		if (clicked) break;
		signalHASidebar(target);
	}
	return clicked;
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
	toggleNativeHASidebar();
	novaOpenedSidebar = !novaOpenedSidebar;
	if (novaOpenedSidebar) {
		installOutsideCloseHandler(toggleButton);
	} else {
		clearOutsideHandlers();
	}
}
