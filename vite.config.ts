import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

const hassToken = process.env.HASS_TOKEN || process.env.HA_TOKEN || '';
const hassHeaders = hassToken ? { Authorization: `Bearer ${hassToken}` } : undefined;

export default defineConfig({
	plugins: [sveltekit()],
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
