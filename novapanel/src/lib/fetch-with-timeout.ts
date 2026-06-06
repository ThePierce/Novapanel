export async function fetchWithTimeout(
	input: RequestInfo | URL,
	init: RequestInit = {},
	timeoutMs = 10000
): Promise<Response> {
	const controller = new AbortController();
	let timeout: ReturnType<typeof setTimeout> | null = null;
	let abortFromCaller: (() => void) | null = null;

	if (timeoutMs > 0) {
		timeout = setTimeout(() => controller.abort(), timeoutMs);
	}

	if (init.signal) {
		abortFromCaller = () => controller.abort();
		if (init.signal.aborted) {
			controller.abort();
		} else {
			init.signal.addEventListener('abort', abortFromCaller, { once: true });
		}
	}

	try {
		return await fetch(input, { ...init, signal: controller.signal });
	} finally {
		if (timeout) clearTimeout(timeout);
		if (init.signal && abortFromCaller) init.signal.removeEventListener('abort', abortFromCaller);
	}
}
