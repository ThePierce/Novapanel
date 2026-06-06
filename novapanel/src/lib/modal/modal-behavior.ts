type ModalBehaviorParams = {
	onClose?: () => void;
	initialFocus?: string;
};

const FOCUSABLE_SELECTOR = [
	'a[href]',
	'button:not([disabled])',
	'input:not([disabled])',
	'select:not([disabled])',
	'textarea:not([disabled])',
	'[tabindex]:not([tabindex="-1"])'
].join(',');
const ESCAPE_DEFER_SELECTOR = '[data-modal-escape-scope]';

function focusableElements(node: HTMLElement): HTMLElement[] {
	return Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
		if (element.hasAttribute('disabled')) return false;
		if (element.getAttribute('aria-hidden') === 'true') return false;
		const style = window.getComputedStyle(element);
		return style.display !== 'none' && style.visibility !== 'hidden';
	});
}

function focusInitialElement(node: HTMLElement, selector?: string) {
	const target =
		(selector ? node.querySelector<HTMLElement>(selector) : null) ?? focusableElements(node)[0] ?? node;
	requestAnimationFrame(() => target.focus({ preventScroll: true }));
}

function shouldDeferEscape(node: HTMLElement, event: KeyboardEvent): boolean {
	const target = event.target;
	return (
		target instanceof HTMLElement &&
		Boolean(target.closest(ESCAPE_DEFER_SELECTOR)?.closest('[role="dialog"]') === node)
	);
}

export function modalBehavior(node: HTMLElement, params: ModalBehaviorParams = {}) {
	let current = params;
	const restoreTarget = document.activeElement instanceof HTMLElement ? document.activeElement : null;
	if (!node.hasAttribute('tabindex')) node.tabIndex = -1;

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			if (shouldDeferEscape(node, event)) return;
			event.preventDefault();
			event.stopPropagation();
			current.onClose?.();
			return;
		}
		if (event.key !== 'Tab') return;
		const focusables = focusableElements(node);
		if (focusables.length === 0) {
			event.preventDefault();
			node.focus({ preventScroll: true });
			return;
		}
		const first = focusables[0];
		const last = focusables[focusables.length - 1];
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
			return;
		}
		if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}

	node.addEventListener('keydown', handleKeydown, true);
	focusInitialElement(node, current.initialFocus);

	return {
		update(next: ModalBehaviorParams = {}) {
			current = next;
		},
		destroy() {
			node.removeEventListener('keydown', handleKeydown, true);
			if (restoreTarget?.isConnected) {
				requestAnimationFrame(() => restoreTarget.focus({ preventScroll: true }));
			}
		}
	};
}
