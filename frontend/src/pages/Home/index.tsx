import { useEffect, useState } from 'preact/hooks';
import {
	Box,
	Typography,
	Button,
	Card,
	CardContent,
	TextField,
	Stack,
	CircularProgress,
	Alert
} from '@mui/material';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import './style.css';

let ddClient: ReturnType<typeof createDockerDesktopClient> | undefined;
let ddClientInitError: string | null = null;
try {
	ddClient = createDockerDesktopClient();
} catch (err) {
	ddClientInitError = err instanceof Error ? err.message : String(err);
	// eslint-disable-next-line no-console
	console.error('Failed to initialize Docker Desktop client', err);
}

function stringifyAny(v: unknown) {
	try {
		if (v instanceof Error) return `${v.name}: ${v.message}\n${v.stack ?? ''}`.trim();
		if (typeof v === 'string') return v;
		return JSON.stringify(v, null, 2);
	} catch {
		return String(v);
	}
}

function normalizeResponse(raw: any) {
	if (typeof raw === 'string') {
		try {
			return JSON.parse(raw);
		} catch {
			return { success: false, error: raw };
		}
	}
	return raw;
}

export function Home() {
	const [websocketUrl, setWebsocketUrl] = useState('ws://host.docker.internal:8000');
	const [backendStatus, setBackendStatus] = useState<any>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [lastReconnectRaw, setLastReconnectRaw] = useState<string | null>(null);
	const [uiBuildHint] = useState(() => String(Date.now()));

	const refreshStatus = async () => {
		try {
			if (!ddClient) return;
			const status = await ddClient.extension.vm.service.get('/api/status');
			setBackendStatus(status);
			// Prefer backend's current URL if present.
			if ((status as any)?.neuro_server) setWebsocketUrl((status as any).neuro_server);
		} catch {
			// ignore
		}
	};

	useEffect(() => {
		refreshStatus();
	}, []);

	const handleReconnect = async () => {
		try {
			if (!ddClient) {
				throw new Error(
					`Docker Desktop extension API client is unavailable${ddClientInitError ? `: ${ddClientInitError}` : ''}`
				);
			}
			setLoading(true);
			setError(null);
			setSuccess(null);
			setLastReconnectRaw(null);

			const raw = await ddClient.extension.vm.service.post('/api/reconnect/neuro', {
				websocketUrl
			}) as any;
			setLastReconnectRaw(stringifyAny(raw));
			const response = normalizeResponse(raw) as any;

			if (response?.success === true || response?.websocketUrl || response?.message) {
				setSuccess(
					`NeuroClient connected: ${response.websocketUrl ?? websocketUrl}\n\nResponse:\n${stringifyAny(response)}`
				);
				await refreshStatus();
				try {
					ddClient.desktopUI.toast.success('NeuroClient reconnected');
				} catch {
					// ignore toast failures
				}
			} else {
				throw new Error(response?.error || `Reconnect failed. Raw response:\n${stringifyAny(raw)}`);
			}
		} catch (err) {
			const errorMsg = `Failed to reconnect NeuroClient.\n\n${stringifyAny(err)}`;
			setLastReconnectRaw(`(error)\n${stringifyAny(err)}`);
			setError(errorMsg);
			await refreshStatus();
			try {
				ddClient?.desktopUI.toast.error('Failed to reconnect NeuroClient');
			} catch {
				// ignore toast failures
			}
		} finally {
			setLoading(false);
		}
	};

	return (
		<Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
			<Typography variant="h4" gutterBottom>
				neurontainer - Neuro-sama Dashboard
			</Typography>
			<Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 4 }}>
				Configure and manage Neuro-sama WebSocket connection
			</Typography>
			<Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
				UI build hint (should change after updates): {uiBuildHint}
			</Typography>

			{ddClientInitError && (
				<Alert severity="warning" sx={{ mb: 2 }}>
					Docker Desktop API client failed to initialize: {ddClientInitError}
				</Alert>
			)}
			{backendStatus && (
				<Alert severity="info" sx={{ mb: 2 }}>
					Backend reports Neuro: {(backendStatus as any)?.neuro ?? 'unknown'} (server {(backendStatus as any)?.neuro_server ?? 'unknown'}) — ws {(backendStatus as any)?.neuro_ws ?? 'unknown'}
					<br />
					Last event: {JSON.stringify((backendStatus as any)?.last_neuro_event ?? null)}
					<br />
					Last reconnect request: {JSON.stringify((backendStatus as any)?.last_reconnect_request ?? null)}
				</Alert>
			)}
			{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
			{success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
			{lastReconnectRaw && (
				<Alert severity="info" sx={{ mb: 2 }}>
					Last reconnect raw response:
					<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{lastReconnectRaw}</pre>
				</Alert>
			)}

			<Card>
				<CardContent>
					<Typography variant="h6" gutterBottom>
						WebSocket Connection
					</Typography>

					<Stack spacing={3}>
						<TextField
							label="WebSocket URL"
							value={websocketUrl}
							onChange={(e) => setWebsocketUrl((e.target as HTMLInputElement).value)}
							fullWidth
							placeholder="ws://localhost:8000"
							helperText="Tip: use ws://host.docker.internal:8000 to reach a Neuro server running on your host (inside the extension container, ws://localhost points to itself)."
							disabled={loading}
						/>

						<Button
							variant="contained"
							onClick={handleReconnect}
							disabled={loading || !websocketUrl}
							fullWidth
							size="large"
						>
							{loading ? <CircularProgress size={24} /> : 'Reconnect NeuroClient'}
						</Button>
						<Button
							variant="outlined"
							onClick={refreshStatus}
							disabled={loading}
							fullWidth
							size="large"
						>
							Refresh backend status
						</Button>
					</Stack>
				</CardContent>
			</Card>
		</Box>
	);
}
