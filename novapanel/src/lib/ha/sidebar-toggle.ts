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

const HA_SIDEBAR_SELECTOR = [
	'ha-sidebar',
	'home-assistant-main ha-sidebar',
	'ha-drawer ha-sidebar',
	'app-drawer ha-sidebar'
].join(',');

const HA_DRAWER_SELECTOR = ['ha-drawer', 'app-drawer'].join(',');

const HA_SIDEBAR_INNER_SELECTOR = [
	'.mdc-drawer',
	'.mdc-drawer--modal',
	'.mdc-drawer--open',
	'aside',
	'nav',
	'#drawer',
	'#sidebar',
	'.drawer',
	'.sidebar'
].join(',');

const SIDEBAR_Z_INDEX = '2147483647';

let novaOpenedSidebar = false;
let sidebarOpening = false;
let openAttemptId = 0;
let outsideCleanup: (() => void) | null = null;
let frameRevealCleanup: (() => void) | null = null;
let outsideInstallId = 0;

type StyleSnapshot = {
	element: HTMLElement;
	property: string;
	value: string;
	priority: string;
};

type AttributeSnapshot = {
	element: HTMLElement;
	name: string;
	hadAttribute: boolean;
	value: string | null;
};

type PropertySnapshot = {
	element: HTMLElement;
	name: string;
	value: unknown;
};

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

function deepQuerySelectorAllElements(
	root: ParentNode | ShadowRoot,
	selector: string,
	found: Set<HTMLElement> = new Set()
): Set<HTMLElement> {
	for (const element of root.querySelectorAll(selector)) {
		const htmlElement = asHTMLElement(element);
		if (htmlElement) found.add(htmlElement);
	}

	for (const element of root.querySelectorAll('*')) {
		const shadow = (element as HTMLElement).shadowRoot;
		if (!shadow) continue;
		deepQuerySelectorAllElements(shadow, selector, found);
	}

	return found;
}

function getClickableElement(element: HTMLElement): HTMLElement {
	const shadowButton = element.shadowRoot?.querySelector(
		'button, ha-button, ha-icon-button, mwc-icon-button, paper-icon-button'
	) as HTMLElement | null;
	if (shadowButton && shadowButton !== element) return getClickableElement(shadowButton);
	return element;
}

function queryShadow(root: Element | ShadowRoot | null | undefined, selector: string): HTMLElement | null {
	if (!root) return null;
	const shadow = root instanceof ShadowRoot ? root : (root as HTMLElement).shadowRoot;
	return asHTMLElement(shadow?.querySelector(selector));
}

function getAccessibleDocument(target: Window): Document | null {
	try {
		return target.document;
	} catch {
		return null;
	}
}

function findKnownHASidebarToggleButton(document: Document): HTMLElement | null {
	const ha = asHTMLElement(document.querySelector('home-assistant'));
	const main = queryShadow(ha, 'home-assistant-main');
	const drawer = queryShadow(main, 'ha-drawer, app-drawer');
	const topBar = queryShadow(main, 'ha-top-app-bar-fixed, ha-top-app-bar, app-header');
	const topBarMenu =
		asHTMLElement(topBar?.querySelector('ha-menu-button')) ?? queryShadow(topBar, 'ha-menu-button');
	if (topBarMenu) return getClickableElement(topBarMenu);

	const sidebar =
		asHTMLElement(drawer?.querySelector('ha-sidebar')) ?? queryShadow(drawer, 'ha-sidebar');
	const sidebarMenu = queryShadow(sidebar, 'ha-menu-button');
	if (sidebarMenu) return getClickableElement(sidebarMenu);

	return null;
}

function findHASidebarToggleButton(target: Window): HTMLElement | null {
	const document = getAccessibleDocument(target);
	if (!document) return null;

	const knownButton = findKnownHASidebarToggleButton(document);
	if (knownButton) return knownButton;

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

function setImportant(snapshots: StyleSnapshot[], element: HTMLElement, property: string, value: string) {
	snapshots.push({
		element,
		property,
		value: element.style.getPropertyValue(property),
		priority: element.style.getPropertyPriority(property)
	});
	element.style.setProperty(property, value, 'important');
}

function isCurrentFrame(frame: HTMLElement): boolean {
	const iframe = frame as HTMLIFrameElement;
	try {
		if (iframe.contentWindow === window) return true;
	} catch {}
	const src = iframe.getAttribute('src') ?? '';
	return (
		src.includes('hassio_ingress') ||
		src.includes('novapanel') ||
		src.includes('e806fdae_novapanel')
	);
}

function lowerNovaPanelFrames(targetWindow: Window, snapshots: StyleSnapshot[]) {
	if (targetWindow === window) return;
	const document = getAccessibleDocument(targetWindow);
	if (!document) return;
	for (const frame of deepQuerySelectorAllElements(document, 'iframe')) {
		if (!isCurrentFrame(frame)) continue;
		setImportant(snapshots, frame, 'z-index', '1');
		setImportant(snapshots, frame, 'pointer-events', 'none');
	}
}

function setAttributeTemporarily(
	snapshots: AttributeSnapshot[],
	element: HTMLElement,
	name: string,
	value: string | boolean
) {
	snapshots.push({
		element,
		name,
		hadAttribute: element.hasAttribute(name),
		value: element.getAttribute(name)
	});
	if (value === false) {
		element.removeAttribute(name);
	} else if (value === true) {
		element.setAttribute(name, '');
	} else {
		element.setAttribute(name, value);
	}
}

function setPropertyTemporarily(
	snapshots: PropertySnapshot[],
	element: HTMLElement,
	name: string,
	value: unknown
) {
	snapshots.push({ element, name, value: (element as unknown as Record<string, unknown>)[name] });
	try {
		(element as unknown as Record<string, unknown>)[name] = value;
	} catch {}
}

function restoreTemporaryState(
	styleSnapshots: StyleSnapshot[],
	attributeSnapshots: AttributeSnapshot[],
	propertySnapshots: PropertySnapshot[]
) {
	for (const snapshot of propertySnapshots.reverse()) {
		try {
			(snapshot.element as unknown as Record<string, unknown>)[snapshot.name] = snapshot.value;
		} catch {}
	}
	for (const snapshot of attributeSnapshots.reverse()) {
		if (snapshot.hadAttribute) {
			snapshot.element.setAttribute(snapshot.name, snapshot.value ?? '');
		} else {
			snapshot.element.removeAttribute(snapshot.name);
		}
	}
	for (const snapshot of styleSnapshots.reverse()) {
		if (snapshot.value) {
			snapshot.element.style.setProperty(snapshot.property, snapshot.value, snapshot.priority);
		} else {
			snapshot.element.style.removeProperty(snapshot.property);
		}
	}
}

function isEventInsideHASidebar(event: Event): boolean {
	const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
	return path.some((entry) => {
		const element = asHTMLElement(entry as Element);
		return element?.tagName.toLowerCase() === 'ha-sidebar';
	});
}

function installParentOutsideHandler(targetWindow: Window, cleanupCallbacks: Array<() => void>) {
	const document = getAccessibleDocument(targetWindow);
	if (!document) return;
	const handler = (event: PointerEvent) => {
		if (isEventInsideHASidebar(event)) return;
		closeHASidebar();
	};
	document.addEventListener('pointerdown', handler, true);
	cleanupCallbacks.push(() => document.removeEventListener('pointerdown', handler, true));
}

function applyDrawerOverlay(drawer: HTMLElement, snapshots: StyleSnapshot[]) {
	setImportant(snapshots, drawer, 'display', 'block');
	setImportant(snapshots, drawer, 'visibility', 'visible');
	setImportant(snapshots, drawer, 'opacity', '1');
	setImportant(snapshots, drawer, 'position', 'fixed');
	setImportant(snapshots, drawer, 'z-index', SIDEBAR_Z_INDEX);
	setImportant(snapshots, drawer, 'top', '0');
	setImportant(snapshots, drawer, 'left', '0');
	setImportant(snapshots, drawer, 'right', '0');
	setImportant(snapshots, drawer, 'bottom', '0');
	setImportant(snapshots, drawer, 'width', '100vw');
	setImportant(snapshots, drawer, 'height', '100vh');
	setImportant(snapshots, drawer, 'overflow', 'visible');
	setImportant(snapshots, drawer, 'pointer-events', 'none');
	setImportant(snapshots, drawer, 'transform', 'translateX(0)');
}

function applyExpandedSidebarOverlay(
	sidebar: HTMLElement,
	styleSnapshots: StyleSnapshot[],
	attributeSnapshots: AttributeSnapshot[],
	propertySnapshots: PropertySnapshot[]
) {
	setPropertyTemporarily(propertySnapshots, sidebar, 'alwaysExpand', true);
	setPropertyTemporarily(propertySnapshots, sidebar, 'expanded', true);
	setPropertyTemporarily(propertySnapshots, sidebar, 'narrow', false);
	setPropertyTemporarily(propertySnapshots, sidebar, 'rail', false);
	setAttributeTemporarily(attributeSnapshots, sidebar, 'always-expand', true);
	setAttributeTemporarily(attributeSnapshots, sidebar, 'expanded', true);
	setAttributeTemporarily(attributeSnapshots, sidebar, 'narrow', false);
	setAttributeTemporarily(attributeSnapshots, sidebar, 'rail', false);
	setAttributeTemporarily(attributeSnapshots, sidebar, 'collapsed', false);

	setImportant(styleSnapshots, sidebar, 'display', 'block');
	setImportant(styleSnapshots, sidebar, 'visibility', 'visible');
	setImportant(styleSnapshots, sidebar, 'opacity', '1');
	setImportant(styleSnapshots, sidebar, 'position', 'fixed');
	setImportant(styleSnapshots, sidebar, 'z-index', SIDEBAR_Z_INDEX);
	setImportant(styleSnapshots, sidebar, 'top', '0');
	setImportant(styleSnapshots, sidebar, 'left', '0');
	setImportant(styleSnapshots, sidebar, 'bottom', '0');
	setImportant(styleSnapshots, sidebar, 'height', '100vh');
	setImportant(styleSnapshots, sidebar, 'width', 'min(82vw, 320px)');
	setImportant(styleSnapshots, sidebar, 'min-width', '240px');
	setImportant(styleSnapshots, sidebar, 'max-width', '82vw');
	setImportant(styleSnapshots, sidebar, 'pointer-events', 'auto');
	setImportant(styleSnapshots, sidebar, 'transform', 'translateX(0)');
	setImportant(styleSnapshots, sidebar, 'box-shadow', '0 0 24px rgba(0, 0, 0, 0.32)');

	const menuButtons = sidebar.shadowRoot
		? Array.from(deepQuerySelectorAllElements(sidebar.shadowRoot, 'ha-menu-button'))
		: [];
	for (const menuButton of menuButtons) {
		setImportant(styleSnapshots, menuButton, 'display', 'none');
	}

	if (sidebar.shadowRoot) {
		for (const inner of deepQuerySelectorAllElements(sidebar.shadowRoot, HA_SIDEBAR_INNER_SELECTOR)) {
			setImportant(styleSnapshots, inner, 'display', 'block');
			setImportant(styleSnapshots, inner, 'visibility', 'visible');
			setImportant(styleSnapshots, inner, 'opacity', '1');
			setImportant(styleSnapshots, inner, 'pointer-events', 'auto');
			setImportant(styleSnapshots, inner, 'transform', 'translateX(0)');
			setImportant(styleSnapshots, inner, 'z-index', SIDEBAR_Z_INDEX);
			setImportant(styleSnapshots, inner, 'width', '100%');
			setImportant(styleSnapshots, inner, 'min-width', '240px');
			setImportant(styleSnapshots, inner, 'max-width', '82vw');
			setImportant(styleSnapshots, inner, 'height', '100%');
		}
	}

	try {
		(sidebar as HTMLElement & { requestUpdate?: () => void }).requestUpdate?.();
	} catch {}
}

function revealNativeHASidebarLayer(): boolean {
	frameRevealCleanup?.();
	frameRevealCleanup = null;

	const styleSnapshots: StyleSnapshot[] = [];
	const attributeSnapshots: AttributeSnapshot[] = [];
	const propertySnapshots: PropertySnapshot[] = [];
	const cleanupCallbacks: Array<() => void> = [];
	let revealed = false;

	for (const targetWindow of getCandidateWindows()) {
		const document = getAccessibleDocument(targetWindow);
		if (!document) continue;

		lowerNovaPanelFrames(targetWindow, styleSnapshots);
		for (const drawer of deepQuerySelectorAllElements(document, HA_DRAWER_SELECTOR)) {
			applyDrawerOverlay(drawer, styleSnapshots);
		}

		const sidebars = Array.from(deepQuerySelectorAllElements(document, HA_SIDEBAR_SELECTOR));
		if (sidebars.length > 0) {
			revealed = true;
			for (const sidebar of sidebars) {
				applyExpandedSidebarOverlay(sidebar, styleSnapshots, attributeSnapshots, propertySnapshots);
			}
			for (const delay of [60, 180, 420]) {
				const timerId = targetWindow.setTimeout(() => {
						for (const sidebar of sidebars) {
							applyExpandedSidebarOverlay(
								sidebar,
								styleSnapshots,
								attributeSnapshots,
								propertySnapshots
							);
						}
					}, delay);
				cleanupCallbacks.push(() => targetWindow.clearTimeout(timerId));
			}
			installParentOutsideHandler(targetWindow, cleanupCallbacks);
		}
	}

	frameRevealCleanup = () => {
		for (const cleanup of cleanupCallbacks) cleanup();
		restoreTemporaryState(styleSnapshots, attributeSnapshots, propertySnapshots);
	};
	return revealed;
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function revealNativeHASidebarLayerEventually(): Promise<boolean> {
	for (const delay of [0, 40, 90, 160, 260, 420, 650]) {
		if (delay > 0) await wait(delay);
		if (revealNativeHASidebarLayer()) return true;
	}
	return false;
}

function clearFrameRevealStyles() {
	frameRevealCleanup?.();
	frameRevealCleanup = null;
}

function createSidebarEvent(target: Window, eventName: string, detail?: unknown): CustomEvent {
	const EventConstructor = target.CustomEvent ?? CustomEvent;
	return new EventConstructor(eventName, { bubbles: true, composed: true, detail });
}

function dispatchSidebarEvent(
	targetWindow: Window,
	target: EventTarget | null | undefined,
	eventName: string,
	detail?: unknown
) {
	if (!target) return false;
	try {
		target.dispatchEvent(createSidebarEvent(targetWindow, eventName, detail));
		return true;
	} catch {
		return false;
	}
}

function openNativeHASidebarExpanded(): boolean {
	let signalled = false;
	for (const targetWindow of getCandidateWindows()) {
		const document = getAccessibleDocument(targetWindow);
		if (!document) continue;
		for (const main of deepQuerySelectorAll(document, 'home-assistant-main')) {
			signalled =
				dispatchSidebarEvent(targetWindow, main, 'hass-toggle-menu', { open: true }) || signalled;
		}
	}
	return signalled;
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
	if (!novaOpenedSidebar && !sidebarOpening) return;
	openAttemptId += 1;
	novaOpenedSidebar = false;
	sidebarOpening = false;
	clearOutsideHandlers();
	clearFrameRevealStyles();
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
	if (novaOpenedSidebar || sidebarOpening) {
		closeHASidebar();
		return;
	}
	void openHASidebarAsync(toggleButton);
}

async function openHASidebarAsync(toggleButton: HTMLElement | null) {
	const attemptId = openAttemptId + 1;
	openAttemptId = attemptId;
	sidebarOpening = true;
	clearOutsideHandlers();
	novaOpenedSidebar = false;
	clearFrameRevealStyles();

	openNativeHASidebarExpanded();
	let revealed = await revealNativeHASidebarLayerEventually();

	if (!revealed) {
		toggleNativeHASidebar();
		revealed = await revealNativeHASidebarLayerEventually();
	}

	if (attemptId !== openAttemptId) return;

	if (!revealed) {
		sidebarOpening = false;
		clearFrameRevealStyles();
		return;
	}

	sidebarOpening = false;
	novaOpenedSidebar = true;
	installOutsideCloseHandler(toggleButton);
}
