/** Whether a string is a safe MDI icon name to forward to the CDN. */
export function isValidMdiIconName(raw) {
	return typeof raw === 'string' && raw.length > 0 && /^[a-z0-9-]+$/i.test(raw);
}

/** Bounded LRU cache (most-recently-used kept, oldest evicted past maxEntries). */
export function createMdiIconCache(maxEntries = 500) {
	const iconCache = new Map();
	return {
		get(name) {
			if (!iconCache.has(name)) return null;
			const svg = iconCache.get(name);
			iconCache.delete(name);
			iconCache.set(name, svg);
			return svg;
		},
		set(name, svg) {
			if (iconCache.has(name)) iconCache.delete(name);
			iconCache.set(name, svg);
			while (iconCache.size > maxEntries) {
				const oldestKey = iconCache.keys().next().value;
				if (oldestKey === undefined) break;
				iconCache.delete(oldestKey);
			}
		},
		get size() {
			return iconCache.size;
		}
	};
}

export function registerMdiIconRoutes(app, { fetchWithTimeout, log, timeoutMs }) {
	const cache = createMdiIconCache(500);

	app.get('/api/mdi-icon/:name', async (req, res) => {
		try {
			const raw = typeof req.params.name === 'string' ? req.params.name.trim() : '';
			if (!isValidMdiIconName(raw)) {
				res.status(400).send('invalid_icon_name');
				return;
			}
			const cachedSvg = cache.get(raw);
			if (cachedSvg !== null) {
				res.setHeader('content-type', 'image/svg+xml; charset=utf-8');
				res.setHeader('cache-control', 'public, max-age=86400');
				res.status(200).send(cachedSvg);
				return;
			}
			const url = `https://cdn.jsdelivr.net/npm/@mdi/svg/svg/${encodeURIComponent(raw)}.svg`;
			const upstream = await fetchWithTimeout(url, {}, timeoutMs);
			if (!upstream.ok) {
				res.status(404).send('icon_not_found');
				return;
			}
			const svg = await upstream.text();
			cache.set(raw, svg);
			res.setHeader('content-type', 'image/svg+xml; charset=utf-8');
			res.setHeader('cache-control', 'public, max-age=86400');
			res.status(200).send(svg);
		} catch (error) {
			log(`mdi icon proxy error: ${error instanceof Error ? error.message : String(error)}`);
			res.status(500).send('mdi_proxy_failed');
		}
	});
}
