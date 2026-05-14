import { readable } from 'svelte/store';

export const clockNow = readable(new Date(), (set) => {
	const interval = setInterval(() => {
		set(new Date());
	}, 1000);
	set(new Date());
	return () => {
		clearInterval(interval);
	};
});
