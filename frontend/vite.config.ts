import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';
import fs from 'node:fs';

function resolvePublicAppVersion() {
	try {
		const repoRootPackageJsonPath = path.resolve(__dirname, '..', 'package.json');
		const raw = fs.readFileSync(repoRootPackageJsonPath, 'utf-8');
		const parsed = JSON.parse(raw) as { version?: string };
		return parsed.version || '0.0.0';
	} catch {
		return '0.0.0';
	}
}

// https://vitejs.dev/config/
export default defineConfig(() => {
	const buildId = Date.now().toString(36);
	const appVersion = resolvePublicAppVersion();
	return {
		define: {
			PUBLIC_APP_VERSION: JSON.stringify(appVersion),
		},
		plugins: [
			preact(),
			{
				// Cache-bust file:// asset caching in Docker Desktop webviews
				name: 'neurontainer-build-id',
				transformIndexHtml: {
					order: 'post',
					handler(html) {
						return html
							.replace(/src="\.\/assets\/index\.js"/, `src="./assets/index.js?v=${buildId}"`)
							.replace(/href="\.\/assets\/index\.css"/, `href="./assets/index.css?v=${buildId}"`);
					},
				},
			},
		],
		// Docker Desktop serves the UI from a non-root path; use relative asset URLs.
		base: './',
		build: {
			outDir: 'dist',
			emptyOutDir: true,
			// Docker Desktop sometimes caches the extracted UI; avoid hashed filenames
			// so index.html always matches the extracted asset names.
			rollupOptions: {
				output: {
					entryFileNames: 'assets/index.js',
					chunkFileNames: 'assets/chunk-[name].js',
					assetFileNames: 'assets/[name][extname]',
				},
			},
		},
		server: {
			port: 5173,
		},
	};
});
