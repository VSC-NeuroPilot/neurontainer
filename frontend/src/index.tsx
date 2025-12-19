import { render } from 'preact';
import { useState } from 'preact/hooks';
import { DockerMuiV6ThemeProvider } from '@docker/docker-mui-theme';
import { CssBaseline, Tabs, Tab, Box, Typography } from '@mui/material';

import { Home } from './pages/Home';
import { Config } from './pages/Config';
import { Changelog } from './pages/Changelog';
import './style.css';
import neurontainer from '../../neurontainer.svg';

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
	const [currentTab, setCurrentTab] = useState(0);
	const [uiBuildHint] = useState(() => String(Date.now()));

	const handleTabChange = (_event: any, newValue: number) => {
		setCurrentTab(newValue);
	};

	return (
		<DockerMuiV6ThemeProvider>
			<CssBaseline />
			<main>
				<Box sx={{ width: '100%', p: 3, maxWidth: 800, mx: 'auto' }}>
					<Typography variant="h4" gutterBottom>
						neurontainer - Neuro-sama Dashboard
					</Typography>
					<Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 2 }}>
						Configure and manage Neuro-sama WebSocket connection
					</Typography>
					<img class="app-logo" src={neurontainer} alt="neurontainer logo" />
					<Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
						UI build hint (should change after updates): {uiBuildHint}
					</Typography>
				</Box>
				<Box sx={{ width: '100%', borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'center' }}>
					<Tabs value={currentTab} onChange={handleTabChange} aria-label="neurontainer tabs">
						<Tab label="Home" />
						<Tab label="Configuration" />
						<Tab label="Changelog" />
					</Tabs>
				</Box>
				<Box sx={{ width: '100%', p: 0 }}>
					{currentTab === 0 && <Home />}
					{currentTab === 1 && <Config />}
					{currentTab === 2 && <Changelog />}
				</Box>
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
