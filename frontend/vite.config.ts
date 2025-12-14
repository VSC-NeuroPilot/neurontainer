import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// https://vitejs.dev/config/
export default defineConfig(() => {
	const buildId = Date.now().toString(36);
	return {
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
