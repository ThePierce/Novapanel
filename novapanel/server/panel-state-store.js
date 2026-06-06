export function mergePanelStatePayload(current, body, now = Date.now()) {
	const c = current && typeof current === 'object' ? { ...current } : {};
	if (!body || typeof body !== 'object') return c;
	const out = { ...c };
	for (const [key, value] of Object.entries(body)) {
		if (key === 'dashboard' && value && typeof value === 'object') {
			const prev = c.dashboard && typeof c.dashboard === 'object' ? c.dashboard : {};
			out.dashboard = { ...prev, ...value, updatedAt: now };
		} else if (key === 'configuration' && value && typeof value === 'object') {
			const prev = c.configuration && typeof c.configuration === 'object' ? c.configuration : {};
			out.configuration = { ...prev, ...value, updatedAt: now };
		} else if (key !== 'dashboard' && key !== 'configuration') {
			out[key] = value;
		}
	}
	return out;
}

export function panelStateWriteAck(payload) {
	const dashboardUpdatedAt =
		payload?.dashboard && typeof payload.dashboard === 'object' ? payload.dashboard.updatedAt : undefined;
	const configurationUpdatedAt =
		payload?.configuration && typeof payload.configuration === 'object'
			? payload.configuration.updatedAt
			: undefined;
	return {
		ok: true,
		...(typeof dashboardUpdatedAt === 'number' ? { dashboardUpdatedAt } : {}),
		...(typeof configurationUpdatedAt === 'number' ? { configurationUpdatedAt } : {})
	};
}

export function createSerializedTaskQueue() {
	let chain = Promise.resolve();
	return function serialize(operation) {
		const run = chain.catch(() => {}).then(operation);
		chain = run.then(
			() => {},
			() => {}
		);
		return run;
	};
}
