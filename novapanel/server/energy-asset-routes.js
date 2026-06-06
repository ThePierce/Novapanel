import { promises as fs } from 'node:fs';
import path from 'node:path';
import Busboy from 'busboy';

export const ENERGY_VARIANTS = new Set(['day-no-car', 'day-with-car', 'night-no-car', 'night-with-car']);
const ENERGY_MAX_BYTES = 5 * 1024 * 1024;

export function isSafeCardId(id) {
	return typeof id === 'string' && /^[a-z0-9_-]{1,64}$/i.test(id);
}

/** Detect the image format from the leading magic bytes. Returns 'png', 'jpg', or null. */
export function detectImageFormat(buf) {
	if (!buf || buf.length < 4) return null;
	if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
	if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
	return null;
}

function readSingleUploadedFile(req, maxBytes) {
	return new Promise((resolve, reject) => {
		let settled = false;
		let sawFile = false;
		const chunks = [];
		const parser = Busboy({
			headers: req.headers,
			limits: {
				files: 1,
				fileSize: maxBytes,
				fields: 0
			}
		});

		const settle = (error, value = null) => {
			if (settled) return;
			settled = true;
			if (error) reject(error);
			else resolve(value);
		};

		parser.on('file', (_fieldName, file) => {
			sawFile = true;
			file.on('data', (chunk) => chunks.push(chunk));
			file.on('limit', () => settle(new Error('payload-too-large')));
			file.on('error', settle);
		});
		parser.on('error', settle);
		parser.on('finish', () => settle(null, sawFile ? Buffer.concat(chunks) : null));
		req.on('error', settle);
		req.pipe(parser);
	});
}

export function registerEnergyAssetRoutes(app, { dataDir, log }) {
	const assetsDir = path.join(dataDir, 'energy-assets');

	async function ensureEnergyAssetsDir(cardId) {
		const dir = path.join(assetsDir, cardId);
		await fs.mkdir(dir, { recursive: true });
		return dir;
	}

	app.post(['/api/energy-asset/upload', '/local_novapanel/api/energy-asset/upload'], async (req, res) => {
		try {
			const cardId = String(req.query.cardId || '');
			const variant = String(req.query.variant || '');
			if (!isSafeCardId(cardId)) return res.status(400).json({ error: 'invalid-cardId' });
			if (!ENERGY_VARIANTS.has(variant)) return res.status(400).json({ error: 'invalid-variant' });

			const fileBuf = await readSingleUploadedFile(req, ENERGY_MAX_BYTES);
			if (!fileBuf || fileBuf.length === 0) return res.status(400).json({ error: 'no-file' });

			const ext = detectImageFormat(fileBuf);
			if (!ext) return res.status(400).json({ error: 'unsupported-format' });

			const dir = await ensureEnergyAssetsDir(cardId);
			const otherExt = ext === 'png' ? 'jpg' : 'png';
			try {
				await fs.unlink(path.join(dir, `${variant}.${otherExt}`));
			} catch {
				/* noop */
			}
			const fp = path.join(dir, `${variant}.${ext}`);
			await fs.writeFile(fp, fileBuf);

			res.json({ ok: true, ext, size: fileBuf.length });
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			log(`energy-asset upload error: ${msg}`);
			if (msg === 'payload-too-large') return res.status(413).json({ error: 'too-large' });
			res.status(500).json({ error: 'upload-failed' });
		}
	});

	app.delete(['/api/energy-asset', '/local_novapanel/api/energy-asset'], async (req, res) => {
		try {
			const cardId = String(req.query.cardId || '');
			const variant = String(req.query.variant || '');
			if (!isSafeCardId(cardId)) return res.status(400).json({ error: 'invalid-cardId' });
			if (!ENERGY_VARIANTS.has(variant)) return res.status(400).json({ error: 'invalid-variant' });
			const dir = path.join(assetsDir, cardId);
			for (const ext of ['png', 'jpg']) {
				try {
					await fs.unlink(path.join(dir, `${variant}.${ext}`));
				} catch {
					/* noop */
				}
			}
			res.json({ ok: true });
		} catch {
			res.status(500).json({ error: 'delete-failed' });
		}
	});

	app.get(
		['/energy-asset/:cardId/:variant', '/local_novapanel/energy-asset/:cardId/:variant'],
		async (req, res) => {
			try {
				const cardId = String(req.params.cardId || '');
				const variantRaw = String(req.params.variant || '');
				const variant = variantRaw.replace(/\.(png|jpg|jpeg)$/i, '');
				if (!isSafeCardId(cardId)) return res.status(400).end();
				if (!ENERGY_VARIANTS.has(variant)) return res.status(400).end();
				const dir = path.join(assetsDir, cardId);
				for (const ext of ['png', 'jpg']) {
					const fp = path.join(dir, `${variant}.${ext}`);
					try {
						const data = await fs.readFile(fp);
						res.setHeader('Content-Type', ext === 'png' ? 'image/png' : 'image/jpeg');
						res.setHeader('Cache-Control', 'no-cache');
						return res.end(data);
					} catch {
						/* try next */
					}
				}
				res.status(404).end();
			} catch {
				res.status(500).end();
			}
		}
	);

	app.get(['/api/energy-asset/manifest', '/local_novapanel/api/energy-asset/manifest'], async (req, res) => {
		try {
			const cardId = String(req.query.cardId || '');
			if (!isSafeCardId(cardId)) return res.status(400).json({ error: 'invalid-cardId' });
			const dir = path.join(assetsDir, cardId);
			const out = {};
			for (const variant of ENERGY_VARIANTS) {
				let found = false;
				for (const ext of ['png', 'jpg']) {
					try {
						await fs.access(path.join(dir, `${variant}.${ext}`));
						found = true;
						break;
					} catch {
						/* noop */
					}
				}
				out[variant] = found;
			}
			res.json(out);
		} catch {
			res.status(500).json({ error: 'manifest-failed' });
		}
	});
}
