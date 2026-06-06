import { describe, expect, it } from 'vitest';
import { parseTuneInOpml, parseTuneInResolveSourceUrl, safeResolvedStreamUrl } from './tunein-routes.js';

const SAMPLE_OPML = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="1">
  <body>
    <outline type="link" text="Stations" key="stations">
      <outline type="audio" text="Radio One" URL="http://stream.example.com/1" image="http://img.example.com/1.png" bitrate="128" formats="mp3" guide_id="s1" />
      <outline type="audio" text="Radio Two" URL="http://stream.example.com/2" preset_id="s2" />
      <outline type="link" text="More results" URL="http://opml.radiotime.com/more" />
    </outline>
  </body>
</opml>`;

describe('parseTuneInOpml', () => {
	it('extracts only audio outlines, recursively', () => {
		const items = parseTuneInOpml(SAMPLE_OPML);
		expect(items).toHaveLength(2);
		expect(items[0]).toMatchObject({
			text: 'Radio One',
			url: 'http://stream.example.com/1',
			image: 'http://img.example.com/1.png',
			bitrate: '128',
			formats: 'mp3',
			guideId: 's1'
		});
		expect(items[1].text).toBe('Radio Two');
		expect(items[1].guideId).toBe('s2'); // falls back to preset_id
	});
	it('drops audio outlines without a URL and tolerates junk input', () => {
		expect(parseTuneInOpml('<opml><body><outline type="audio" text="No URL" /></body></opml>')).toEqual([]);
		expect(parseTuneInOpml('')).toEqual([]);
		expect(parseTuneInOpml('<not><valid/></not>')).toEqual([]);
	});
});

describe('parseTuneInResolveSourceUrl (allowlist + SSRF)', () => {
	it('accepts allow-listed TuneIn hosts', () => {
		expect(parseTuneInResolveSourceUrl('http://opml.radiotime.com/Tune.ashx?id=s1').hostname).toBe(
			'opml.radiotime.com'
		);
		expect(parseTuneInResolveSourceUrl('https://tunein.com/x').hostname).toBe('tunein.com');
	});
	it('rejects hosts outside the allowlist', () => {
		expect(() => parseTuneInResolveSourceUrl('http://evil.com/x')).toThrow('tunein_resolve_host_not_allowed');
	});
	it('rejects blocked/internal hosts before the allowlist check', () => {
		expect(() => parseTuneInResolveSourceUrl('http://127.0.0.1/x')).toThrow('blocked_url_host');
	});
});

describe('safeResolvedStreamUrl', () => {
	it('returns a normalized URL for public streams', () => {
		expect(safeResolvedStreamUrl('http://stream.example.com/1')).toBe('http://stream.example.com/1');
	});
	it('returns empty string for blocked or invalid URLs', () => {
		expect(safeResolvedStreamUrl('http://127.0.0.1/x')).toBe('');
		expect(safeResolvedStreamUrl('not a url')).toBe('');
		expect(safeResolvedStreamUrl('')).toBe('');
	});
});
