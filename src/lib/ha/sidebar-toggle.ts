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
		'button[title*="Sidebar"]',
		'button[aria-label*="Sidebar"]',
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

export function openHASidebar() {
	try {
		if (window.parent !== window) {
			const targetDocument = window.parent.document;
			const toggleButton = findHASidebarToggleButton(targetDocument);
			if (toggleButton) {
				toggleButton.click();
				return;
			}
			window.parent.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
			window.parent.dispatchEvent(new CustomEvent('hass-toggle-menu', { bubbles: true }));
			window.parent.postMessage({ type: 'hass-sidebar-toggle' }, '*');
			return;
		}
		window.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
		window.dispatchEvent(new CustomEvent('hass-toggle-menu', { bubbles: true }));
	} catch {
		window.parent?.postMessage({ type: 'hass-sidebar-toggle' }, '*');
	}
}
