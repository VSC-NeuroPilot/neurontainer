import { useState, useEffect } from 'preact/hooks';
import {
	Box,
	Typography,
	Button,
	Card,
	CardContent,
	Stack,
	Chip,
	CircularProgress,
	Alert
} from '@mui/material';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import './style.css';

const ddClient = createDockerDesktopClient();

interface Container {
	id: string;
	name: string;
	image: string;
	state: string;
	status: string;
}

interface Image {
	id: string;
	tags: string[];
	size: number;
	created: number;
}

export function Home() {
	const [containers, setContainers] = useState<Container[]>([]);
	const [images, setImages] = useState<Image[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchData = async () => {
		try {
			setLoading(true);
			setError(null);

			// Fetch containers
			const containersRes = await ddClient.extension.vm.service.get('/api/containers') as any;
			if (containersRes?.success) {
				setContainers(containersRes.data);
			}

			// Fetch images
			const imagesRes = await ddClient.extension.vm.service.get('/api/images') as any;
			if (imagesRes?.success) {
				setImages(imagesRes.data);
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch data');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchData();
	}, []);

	const handleContainerAction = async (id: string, action: string) => {
		try {
			const endpoint = `/api/containers/${id}/${action}`;
			const method = action === 'remove' ? 'DELETE' : 'POST';

			if (method === 'DELETE') {
				await ddClient.extension.vm.service.delete(endpoint);
			} else {
				await ddClient.extension.vm.service.post(endpoint, {});
			}

			await fetchData();
			ddClient.desktopUI.toast.success(`Container ${action} successful`);
		} catch (err) {
			ddClient.desktopUI.toast.error(`Failed to ${action} container: ${err}`);
		}
	};

	if (loading) {
		return (
			<Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
				<CircularProgress />
			</Box>
		);
	}

	return (
		<Box sx={{ p: 3 }}>
			<Typography variant="h4" gutterBottom>
				neurontainer - Docker Desktop Extension
			</Typography>
			<Typography variant="body1" color="text.secondary" gutterBottom sx={{ mb: 3 }}>
				Control Docker containers and images for Neuro-sama integration
			</Typography>

			{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

			<Button variant="contained" onClick={fetchData} sx={{ mb: 3 }}>
				Refresh
			</Button>

			<Typography variant="h5" gutterBottom sx={{ mt: 3 }}>
				Containers ({containers.length})
			</Typography>

			<Stack spacing={2} sx={{ mb: 4 }}>
				{containers.length === 0 ? (
					<Typography color="text.secondary">No containers found</Typography>
				) : (
					containers.map((container) => (
						<Card key={container.id}>
							<CardContent>
								<Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
									<Box>
										<Typography variant="h6">{container.name || container.id.substring(0, 12)}</Typography>
										<Typography variant="body2" color="text.secondary">
											Image: {container.image}
										</Typography>
										<Typography variant="body2" color="text.secondary">
											Status: {container.status}
										</Typography>
										<Chip
											label={container.state}
											color={container.state === 'running' ? 'success' : 'default'}
											size="small"
											sx={{ mt: 1 }}
										/>
									</Box>
									<Stack direction="row" spacing={1}>
										{container.state !== 'running' && (
											<Button
												size="small"
												variant="outlined"
												onClick={() => handleContainerAction(container.id, 'start')}
											>
												Start
											</Button>
										)}
										{container.state === 'running' && (
											<>
												<Button
													size="small"
													variant="outlined"
													onClick={() => handleContainerAction(container.id, 'stop')}
												>
													Stop
												</Button>
												<Button
													size="small"
													variant="outlined"
													onClick={() => handleContainerAction(container.id, 'restart')}
												>
													Restart
												</Button>
											</>
										)}
										<Button
											size="small"
											variant="outlined"
											color="error"
											onClick={() => handleContainerAction(container.id, 'remove')}
										>
											Remove
										</Button>
									</Stack>
								</Box>
							</CardContent>
						</Card>
					))
				)}
			</Stack>

			<Typography variant="h5" gutterBottom>
				Images ({images.length})
			</Typography>

			<Stack spacing={2}>
				{images.length === 0 ? (
					<Typography color="text.secondary">No images found</Typography>
				) : (
					images.map((image) => (
						<Card key={image.id}>
							<CardContent>
								<Typography variant="h6">
									{image.tags && image.tags.length > 0 ? image.tags[0] : image.id.substring(0, 12)}
								</Typography>
								<Typography variant="body2" color="text.secondary">
									Size: {(image.size / 1024 / 1024).toFixed(2)} MB
								</Typography>
								{image.tags && image.tags.length > 1 && (
									<Box sx={{ mt: 1 }}>
										{image.tags.slice(1).map((tag) => (
											<Chip key={tag} label={tag} size="small" sx={{ mr: 0.5 }} />
										))}
									</Box>
								)}
							</CardContent>
						</Card>
					))
				)}
			</Stack>
		</Box>
	);
}
