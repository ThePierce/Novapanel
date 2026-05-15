function deepQuerySelector(root: ParentNode | ShadowRoot, selector: string): Element | null {
	const direct = root.querySelector(selector);
	if (direct) return direct;
	const nodes = root.querySelectorAll('*');
	for (const node of nodes) {
		const shadow = (node as HTMLElement).shadowRoot;
		if (!shadow) continue;
		const found = deepQuerySelector(shadow, selector);
		if (found) return found;
	}
	return null;
}

function findHASidebarToggleButton(root: ParentNode | ShadowRoot): HTMLElement | null {
	const candidates = [
		'button[title*="Zijbalk"]',
		'button[aria-label*="Zijbalk"]',
		'button[title*="Menu"]',
		'button[aria-label*="Menu"]',
		'button[title*="Sidebar"]',
		'button[aria-label*="Sidebar"]',
		'button[aria-label*="Open Home Assistant sidebar"]',
		'ha-sidebar ha-icon-button',
		'ha-menu-button'
	];
	for (const selector of candidates) {
		const found = deepQuerySelector(root, selector) as HTMLElement | null;
		if (found) return found;
	}
	const sidebars = root.querySelectorAll('ha-sidebar');
	for (const sidebar of sidebars) {
		const shadow = (sidebar as HTMLElement).shadowRoot;
		if (!shadow) continue;
		const localBtn = shadow.querySelector(
			'ha-icon-button, button[title], button[aria-label]'
		) as HTMLElement | null;
		if (!localBtn) continue;
		const innerBtn = (localBtn as HTMLElement).shadowRoot?.querySelector('button') as
			| HTMLElement
			| null;
		return innerBtn ?? localBtn;
	}
	return null;
}

function signalHASidebar(target: Window) {
	const events = ['hass-toggle-menu', 'hass-toggle-sidebar', 'hass-more-info-dismissed'];
	for (const eventName of events) {
		try {
			target.dispatchEvent(new CustomEvent(eventName, { bubbles: true, composed: true }));
		} catch {}
	}
	try {
		target.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', code: 'KeyM', bubbles: true, composed: true }));
	} catch {}
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

export function openHASidebar() {
	const targets = Array.from(new Set([window.parent, window.top, window].filter(Boolean))) as Window[];
	let clicked = false;
	for (const target of targets) {
		try {
			const toggleButton = findHASidebarToggleButton(target.document);
			if (toggleButton) {
				toggleButton.click();
				clicked = true;
			}
		} catch {}
		signalHASidebar(target);
		if (clicked) {
			break;
		}
	}
}
