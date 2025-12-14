import { useState } from 'preact/hooks';
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

const ddClient = createDockerDesktopClient();

export function Home() {
	const [websocketUrl, setWebsocketUrl] = useState('ws://localhost:8000');
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [success, setSuccess] = useState<string | null>(null);

	const handleReconnect = async () => {
		try {
			setLoading(true);
			setError(null);
			setSuccess(null);

			const response = await ddClient.extension.vm.service.post('/api/reconnect/neuro', {
				websocketUrl
			}) as any;

			if (response?.success) {
				setSuccess('NeuroClient reconnected successfully!');
				ddClient.desktopUI.toast.success('NeuroClient reconnected');
			} else {
				throw new Error(response?.error || 'Failed to reconnect');
			}
		} catch (err) {
			const errorMsg = err instanceof Error ? err.message : 'Failed to reconnect NeuroClient';
			setError(errorMsg);
			ddClient.desktopUI.toast.error(errorMsg);
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

			{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
			{success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

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
							helperText="Enter the WebSocket URL for Neuro-sama API"
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
					</Stack>
				</CardContent>
			</Card>
		</Box>
	);
}
