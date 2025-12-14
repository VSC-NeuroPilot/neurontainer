import { render } from 'preact';
import { DockerMuiV6ThemeProvider } from '@docker/docker-mui-theme';
import { CssBaseline } from '@mui/material';

import { Home } from './pages/Home';
import './style.css';

function stringifyError(err: unknown) {
	try {
		if (err instanceof Error) return `${err.name}: ${err.message}\n${err.stack ?? ''}`.trim();
		return typeof err === 'string' ? err : JSON.stringify(err, null, 2);
	} catch {
		return String(err);
	}
}

function showFatalOverlay(err: unknown) {
	const message = stringifyError(err);
	try {
		localStorage.setItem('neurontainer:lastFatalError', message);
	} catch {
		// ignore
	}

	// Ensure we show something even if the app fails during boot.
	document.body.innerHTML = '';
	const pre = document.createElement('pre');
	pre.style.whiteSpace = 'pre-wrap';
	pre.style.padding = '16px';
	pre.style.margin = '0';
	pre.style.fontFamily =
		'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace';
	pre.textContent =
		'Neurontainer UI crashed during startup.\n\n' +
		'Open the extension DevTools console to see details.\n\n' +
		message;
	document.body.appendChild(pre);
}

window.addEventListener('error', (e) => {
	// Avoid replacing the UI for benign resource load errors.
	if ((e as ErrorEvent)?.error) showFatalOverlay((e as ErrorEvent).error);
});
window.addEventListener('unhandledrejection', (e) => {
	showFatalOverlay((e as PromiseRejectionEvent).reason);
});

export function App() {
	return (
		<DockerMuiV6ThemeProvider>
			<CssBaseline />
			<main>
				<Home />
			</main>
		</DockerMuiV6ThemeProvider>
	);
}

try {
	const root = document.getElementById('app');
	if (!root) throw new Error('Missing #app root element');
	// Ensure the initial "Loading..." placeholder is removed.
	root.textContent = '';
	render(<App />, root);
} catch (err) {
	// eslint-disable-next-line no-console
	console.error('Neurontainer UI fatal error', err);
	showFatalOverlay(err);
}
