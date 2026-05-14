export function resetHydrationRetry(timer: ReturnType<typeof setTimeout> | null): {
	retries: number;
	timer: ReturnType<typeof setTimeout> | null;
} {
	if (timer) clearTimeout(timer);
	return { retries: 0, timer: null };
}

export function scheduleHydrationRetry(input: {
	currentRetries: number;
	maxRetries: number;
	baseDelayMs: number;
	maxDelayMs: number;
	timer: ReturnType<typeof setTimeout> | null;
	onRetry: () => void;
}): {
	retries: number;
	timer: ReturnType<typeof setTimeout> | null;
} {
	if (input.currentRetries >= input.maxRetries) {
		return { retries: input.currentRetries, timer: input.timer };
	}
	const retries = input.currentRetries + 1;
	if (input.timer) clearTimeout(input.timer);
	const delay = Math.min(input.maxDelayMs, input.baseDelayMs * retries);
	const timer = setTimeout(() => {
		input.onRetry();
	}, delay);
	return { retries, timer };
}
