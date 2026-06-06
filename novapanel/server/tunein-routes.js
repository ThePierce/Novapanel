import { XMLParser } from 'fast-xml-parser';
import { asTrimmedString, hostnameMatchesAllowed, parsePublicHttpUrl, splitCsv } from './shared.js';

const tuneInXmlParser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '',
	parseAttributeValue: false,
	trimValues: true
});

function collectTuneInOutlines(value, items = []) {
	if (Array.isArray(value)) {
		for (const entry of value) collectTuneInOutlines(entry, items);
		return items;
	}
	if (!value || typeof value !== 'object') return items;
	const record = value;
	const url = asTrimmedString(record.URL || record.url);
	if (record.type === 'audio' && url) {
		items.push({
			text: asTrimmedString(record.text),
			url,
			image: asTrimmedString(record.image),
			subtext: asTrimmedString(record.subtext),
			bitrate: asTrimmedString(record.bitrate),
			formats: asTrimmedString(record.formats),
			guideId: asTrimmedString(record.guide_id || record.preset_id)
		});
	}
	for (const child of Object.values(record)) collectTuneInOutlines(child, items);
	return items;
}

export function parseTuneInOpml(xml) {
	const parsed = tuneInXmlParser.parse(xml);
	return collectTuneInOutlines(parsed);
}

function tuneInResolveAllowedHosts() {
	return [
		'opml.radiotime.com',
		'radiotime.com',
		'tunein.com',
		...splitCsv(process.env.NOVAPANEL_TUNEIN_RESOLVE_ALLOWED_HOSTS)
	].map((entry) => entry.toLowerCase());
}

export function parseTuneInResolveSourceUrl(value) {
	const parsed = parsePublicHttpUrl(value);
	if (!hostnameMatchesAllowed(parsed.hostname, tuneInResolveAllowedHosts())) {
		throw new Error('tunein_resolve_host_not_allowed');
	}
	return parsed;
}

export function safeResolvedStreamUrl(value) {
	try {
		return parsePublicHttpUrl(value).toString();
	} catch {
		return '';
	}
}

export function registerTuneInRoutes(app, { fetchWithTimeout, log, timeoutMs }) {
	app.get(['/api/tunein/search', '/local_novapanel/api/tunein/search'], async (req, res) => {
		try {
			const query = asTrimmedString(req.query?.q);
			if (!query) {
				res.status(400).json({ error: 'missing_query' });
				return;
			}
			const params = new URLSearchParams({ query, types: 'station' });
			const opmlUrl = `https://opml.radiotime.com/Search.ashx?${params.toString()}`;
			const response = await fetchWithTimeout(
				opmlUrl,
				{
					headers: {
						'user-agent': 'Mozilla/5.0 Novapanel',
						accept: 'text/xml,application/xml,*/*'
					}
				},
				timeoutMs
			);
			if (!response.ok) {
				res.status(response.status).json({ error: 'tunein_search_failed', status: response.status });
				return;
			}
			const xml = await response.text();
			const items = parseTuneInOpml(xml);
			res.status(200).json({ ok: true, items });
		} catch (error) {
			log(`tunein search error: ${error instanceof Error ? error.message : String(error)}`);
			res.status(500).json({ error: 'tunein_search_failed' });
		}
	});

	app.get(['/api/tunein/resolve', '/local_novapanel/api/tunein/resolve'], async (req, res) => {
		try {
			const tuneUrl = asTrimmedString(req.query?.url);
			if (!tuneUrl) {
				res.status(400).json({ error: 'missing_url' });
				return;
			}
			const sourceUrl = parseTuneInResolveSourceUrl(tuneUrl);
			const response = await fetchWithTimeout(
				sourceUrl,
				{
					headers: { 'user-agent': 'Novapanel/1.0' }
				},
				timeoutMs
			);
			const text = await response.text();
			if (text.includes('<outline')) {
				const items = parseTuneInOpml(text);
				for (const item of items) {
					const streamUrl = safeResolvedStreamUrl(item?.url);
					if (streamUrl) {
						res.status(200).json({ ok: true, streamUrl });
						return;
					}
				}
			}
			const plsMatch = /File\d+=(\S+)/i.exec(text);
			const plsStreamUrl = plsMatch ? safeResolvedStreamUrl(plsMatch[1]) : '';
			if (plsStreamUrl) {
				res.status(200).json({ ok: true, streamUrl: plsStreamUrl });
				return;
			}
			const lines = text
				.split(/\r?\n/)
				.map((line) => line.trim())
				.filter((line) => line && !line.startsWith('#'));
			for (const line of lines) {
				const streamUrl = safeResolvedStreamUrl(line);
				if (streamUrl) {
					res.status(200).json({ ok: true, streamUrl });
					return;
				}
			}
			res.status(404).json({ error: 'no_stream_found' });
		} catch (error) {
			log(`tunein resolve error: ${error instanceof Error ? error.message : String(error)}`);
			const message = error instanceof Error ? error.message : '';
			if (message.includes('not_allowed') || message.includes('blocked') || message.includes('invalid_url')) {
				res.status(400).json({ error: 'invalid_tunein_resolve_url' });
				return;
			}
			res.status(500).json({ error: 'tunein_resolve_failed' });
		}
	});
}
