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
	Alert,
	Tabs,
	Tab
} from '@mui/material';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import { QuickActions, type QuickActionDefinition } from '../../components/QuickActions';
import './style.css';

function stringifyAny(v: unknown) {
	try {
		if (v instanceof Error) return `${v.name}: ${v.message}\n${v.stack ?? ''}`.trim();
		if (typeof v === 'string') return v;
		return JSON.stringify(v, null, 2);
	} catch {
		return String(v);
	}
}

let ddClient: ReturnType<typeof createDockerDesktopClient> | undefined;
let ddClientInitError: string | null = null;
try {
	ddClient = createDockerDesktopClient();
} catch (err) {
	ddClientInitError = stringifyAny(err);
	// eslint-disable-next-line no-console
	console.error('Failed to initialize Docker Desktop client', err);
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

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
	let timeoutHandle: number | undefined;
	const timeoutPromise = new Promise<never>((_, reject) => {
		timeoutHandle = window.setTimeout(() => {
			reject(new Error(`${label} timed out after ${timeoutMs}ms`));
		}, timeoutMs);
	});
	try {
		return await Promise.race([promise, timeoutPromise]);
	} finally {
		if (timeoutHandle !== undefined) window.clearTimeout(timeoutHandle);
	}
}

export function Home() {
	const [websocketUrl, setWebsocketUrl] = useState('ws://host.docker.internal:8000');
	const [backendStatus, setBackendStatus] = useState<any>(null);
	const [neuroLoading, setNeuroLoading] = useState(false);
	const [dockerLoading, setDockerLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);
	const [lastReconnectRaw, setLastReconnectRaw] = useState<string | null>(null);
	const [tab, setTab] = useState<'quick' | 'configs'>('quick');
	const [configLoaded, setConfigLoaded] = useState(false);

	const refreshStatus = async () => {
		try {
			if (!ddClient) return;
			const status = await ddClient.extension.vm.service.get('/api/status');
			setBackendStatus(status);
		} catch {
			// ignore
		}
	};

	const refreshConfig = async () => {
		try {
			if (!ddClient) return;
			const raw = await ddClient.extension.vm.service.get('/api/config');
			const response = normalizeResponse(raw) as any;
			const url = response?.config?.neuro?.websocketUrl;
			if (typeof url === 'string' && url.trim()) {
				setWebsocketUrl(url);
			}
			setConfigLoaded(true);
		} catch {
			// ignore
		}
	};

	const saveNeuroWebsocketUrl = async (opts?: { silent?: boolean }) => {
		try {
			if (!ddClient) {
				throw new Error(
					`Docker Desktop extension API client is unavailable${ddClientInitError ? `: ${ddClientInitError}` : ''}`
				);
			}
			setError(null);

			const raw = await withTimeout(
				ddClient.extension.vm.service.put('/api/config', {
					config: { neuro: { websocketUrl } }
				}) as any,
				15000,
				'Save Neuro config'
			);
			const response = normalizeResponse(raw) as any;
			if (response?.success !== true) {
				throw new Error(response?.error || response?.message || stringifyAny(raw));
			}
			setConfigLoaded(true);
			if (!opts?.silent) {
				setSuccess('Neuro config saved');
				try {
					ddClient.desktopUI.toast.success('Neuro config saved');
				} catch {
					// ignore toast failures
				}
			}
		} catch (err) {
			setError(`Failed to save Neuro config.\n\n${stringifyAny(err)}`);
			try {
				ddClient?.desktopUI.toast.error('Failed to save Neuro config');
			} catch {
				// ignore toast failures
			}
		}
	};

	useEffect(() => {
		refreshStatus();
		refreshConfig();
	}, []);

	const handleReconnect = async () => {
		try {
			if (!ddClient) {
				throw new Error(
					`Docker Desktop extension API client is unavailable${ddClientInitError ? `: ${ddClientInitError}` : ''}`
				);
			}
			// Persist the URL in config so backend defaults match UI.
			await saveNeuroWebsocketUrl({ silent: true });
			setNeuroLoading(true);
			setError(null);
			setSuccess(null);
			setLastReconnectRaw(null);

			const raw = await withTimeout(
				ddClient.extension.vm.service.post('/api/reconnect/neuro', { websocketUrl }) as any,
				15000,
				'Neuro reconnect request'
			);
			setLastReconnectRaw(stringifyAny(raw));
			const response = normalizeResponse(raw) as any;

			if (response?.success === true || response?.websocketUrl || response?.message) {
				setSuccess(
					`NeuroClient connected: ${response.websocketUrl ?? websocketUrl}\n\nResponse:\n${stringifyAny(response)}`
				);
				await refreshStatus();
				await refreshConfig();
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
			// Re-enable the button immediately; refresh status in the background.
			setNeuroLoading(false);
			void refreshStatus();
			void refreshConfig();
			try {
				ddClient?.desktopUI.toast.error('Failed to reconnect NeuroClient');
			} catch {
				// ignore toast failures
			}
		} finally {
			setNeuroLoading(false);
		}
	};

	const handleDockerReconnect = async () => {
		try {
			if (!ddClient) {
				throw new Error(
					`Docker Desktop extension API client is unavailable${ddClientInitError ? `: ${ddClientInitError}` : ''}`
				);
			}
			setDockerLoading(true);
			setError(null);
			setSuccess(null);

			const raw = await withTimeout(
				ddClient.extension.vm.service.post('/api/reconnect/docker', {}) as any,
				15000,
				'Docker reconnect request'
			);
			const response = normalizeResponse(raw) as any;

			if (response?.success === true) {
				setSuccess(
					`Docker client reconnected successfully\n\nResponse:\n${stringifyAny(response)}`
				);
				await refreshStatus();
				await refreshConfig();
				try {
					ddClient.desktopUI.toast.success('Docker client reconnected');
				} catch {
					// ignore toast failures
				}
			} else {
				throw new Error(response?.error || `Docker reconnect failed. Raw response:\n${stringifyAny(raw)}`);
			}
		} catch (err) {
			const errorMsg = `Failed to reconnect Docker client.\n\n${stringifyAny(err)}`;
			setError(errorMsg);
			// Re-enable the button immediately; refresh status in the background.
			setDockerLoading(false);
			void refreshStatus();
			void refreshConfig();
			try {
				ddClient?.desktopUI.toast.error('Failed to reconnect Docker client');
			} catch {
				// ignore toast failures
			}
		} finally {
			setDockerLoading(false);
		}
	};

	const executeQuickAction = async (id: string, params: Record<string, unknown>) => {
		try {
			if (!ddClient) {
				throw new Error(
					`Docker Desktop extension API client is unavailable${ddClientInitError ? `: ${ddClientInitError}` : ''}`
				);
			}
			setError(null);
			setSuccess(null);

			const raw = await withTimeout(
				ddClient.extension.vm.service.post('/api/quick-actions/execute', { id, params }) as any,
				15000,
				`Quick action "${id}"`
			);
			const response = normalizeResponse(raw) as any;
			if (response?.success === true) {
				setSuccess(stringifyAny(response?.message ?? response));
				void refreshStatus();
				void refreshConfig();
				try {
					ddClient.desktopUI.toast.success('Quick action executed');
				} catch {
					// ignore toast failures
				}
				return;
			}
			throw new Error(response?.error || response?.message || stringifyAny(raw));
		} catch (err) {
			setError(`Failed to execute quick action "${id}".\n\n${stringifyAny(err)}`);
			try {
				ddClient?.desktopUI.toast.error('Quick action failed');
			} catch {
				// ignore toast failures
			}
		}
	};

	const quickActions: QuickActionDefinition[] = [
		{
			type: 'button',
			id: 'example_action',
			label: 'Example quick action',
			description: 'Replace/remove this and add your own actions.',
			variant: 'outlined',
			params: {}
		}
	];

	return (
		<Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
			<Typography variant="h4" gutterBottom>
				neurontainer
			</Typography>
			<Tabs
				value={tab}
				onChange={(_e, v) => setTab(v)}
				sx={{ mb: 2 }}
			>
				<Tab value="quick" label="Quick Actions" />
				<Tab value="configs" label="Configs" />
			</Tabs>

			{ddClientInitError && (
				<Alert severity="warning" sx={{ mb: 2 }}>
					Docker Desktop API client failed to initialize: {ddClientInitError}
				</Alert>
			)}

			{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
			{success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

			{tab === 'quick' && (
				<Card>
					<CardContent>
						<Typography variant="h6" gutterBottom>
							Quick Actions
						</Typography>
						<QuickActions
							actions={quickActions}
							disabled={Boolean(neuroLoading || dockerLoading)}
							onExecute={executeQuickAction}
						/>
					</CardContent>
				</Card>
			)}

			{tab === 'configs' && (
				<Stack spacing={2}>
					{backendStatus && (
						<Alert severity="info">
							Backend reports Neuro: {(backendStatus as any)?.neuro ?? 'unknown'} (server {(backendStatus as any)?.neuro_server ?? 'unknown'}) — ws {(backendStatus as any)?.neuro_ws ?? 'unknown'}
							<br />
							Last event: {JSON.stringify((backendStatus as any)?.last_neuro_event ?? null)}
							<br />
							Last reconnect request: {JSON.stringify((backendStatus as any)?.last_reconnect_request ?? null)}
						</Alert>
					)}

					{lastReconnectRaw && (
						<Alert severity="info">
							Last reconnect raw response:
							<pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{lastReconnectRaw}</pre>
						</Alert>
					)}

					<Card>
						<CardContent>
							<Typography variant="h6" gutterBottom>
								NeuroClient
							</Typography>
							<Stack spacing={2}>
								<TextField
									label="WebSocket URL"
									value={websocketUrl}
									onChange={(e) => setWebsocketUrl((e.target as HTMLInputElement).value)}
									fullWidth
									placeholder="ws://localhost:8000"
									helperText="Tip: use ws://host.docker.internal:8000 to reach a Neuro server running on your host (inside the extension container, ws://localhost points to itself)."
									disabled={neuroLoading}
								/>
								<Button
									variant="outlined"
									onClick={() => saveNeuroWebsocketUrl()}
									disabled={neuroLoading || !websocketUrl}
									fullWidth
									size="large"
								>
									Save Neuro config
								</Button>
								{!configLoaded && (
									<Alert severity="warning">
										Config not loaded yet; using UI default.
									</Alert>
								)}
								<Button
									variant="contained"
									onClick={handleReconnect}
									disabled={neuroLoading || !websocketUrl}
									fullWidth
									size="large"
								>
									{neuroLoading ? <CircularProgress size={24} /> : 'Reconnect NeuroClient'}
								</Button>
							</Stack>
						</CardContent>
					</Card>

					<Card>
						<CardContent>
							<Typography variant="h6" gutterBottom>
								Clients
							</Typography>
							<Stack spacing={2}>
								<Button
									variant="contained"
									color="secondary"
									onClick={handleDockerReconnect}
									disabled={dockerLoading}
									fullWidth
									size="large"
								>
									{dockerLoading ? <CircularProgress size={24} /> : 'Reconnect Docker Client'}
								</Button>
								<Button
									variant="outlined"
									onClick={refreshStatus}
									disabled={neuroLoading || dockerLoading}
									fullWidth
									size="large"
								>
									Refresh backend status
								</Button>
							</Stack>
						</CardContent>
					</Card>
				</Stack>
			)}
		</Box>
	);
}
