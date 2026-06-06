import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

const hassToken = process.env.HASS_TOKEN || process.env.HA_TOKEN || '';
const hassHeaders = hassToken ? { Authorization: `Bearer ${hassToken}` } : undefined;

function tablerIconsWoff2Only() {
	return {
		name: 'tabler-icons-woff2-only',
		enforce: 'pre' as const,
		transform(code: string, id: string) {
			if (!id.includes('@tabler/icons-webfont') || !id.includes('tabler-icons.min.css')) return null;
			return code.replace(
				/(src:url\("\.\/fonts\/tabler-icons\.woff2\?v[^"]*"\) format\("woff2"\)),url\("\.\/fonts\/tabler-icons\.woff\?[^"]*"\) format\("woff"\),url\("\.\/fonts\/tabler-icons\.ttf\?v[^"]*"\) format\("truetype"\)/,
				'$1'
			);
		}
	};
}

export default defineConfig({
	plugins: [tablerIconsWoff2Only(), sveltekit()],
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts', 'server/**/*.test.js']
	},
	server: {
		host: true,
		allowedHosts: true,
		proxy: {
			'/hacsfiles/': {
				target: process.env.HASS_URL,
				changeOrigin: true,
				headers: hassHeaders
			},
			'/local/': {
				target: process.env.HASS_URL,
				changeOrigin: true,
				headers: hassHeaders
			},
			'/api/': {
				target: process.env.HASS_URL,
				changeOrigin: true,
				ws: true,
				headers: hassHeaders
			}
		}
	}
});
