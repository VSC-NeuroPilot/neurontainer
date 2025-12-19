import { useEffect, useState } from 'preact/hooks';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Switch,
    FormControlLabel,
    Button,
    Stack,
    CircularProgress,
    Alert,
    Divider
} from '@mui/material';
import { createDockerDesktopClient } from '@docker/extension-api-client';
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

interface ActionConfig {
    [actionName: string]: boolean;
}

export function Config() {
    const [config, setConfig] = useState<ActionConfig | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const loadConfig = async () => {
        try {
            if (!ddClient) {
                throw new Error(
                    `Docker Desktop extension API client is unavailable${ddClientInitError ? `: ${ddClientInitError}` : ''}`
                );
            }
            setLoading(true);
            setError(null);

            const response = await ddClient.extension.vm.service.get('/api/config') as any;
            if (response?.success && response?.config) {
                setConfig(response.config);
            } else {
                const errMsg = typeof response?.error === 'string' ? response.error : stringifyAny(response?.error) || 'Failed to load config';
                throw new Error(errMsg);
            }
        } catch (err) {
            setError(stringifyAny(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConfig();
    }, []);

    const handleToggle = (actionName: string) => {
        if (!config) return;
        setConfig({
            ...config,
            [actionName]: !config[actionName]
        });
    };

    const handleSave = async () => {
        try {
            if (!ddClient || !config) {
                throw new Error('Config not loaded or client unavailable');
            }
            setLoading(true);
            setError(null);
            setSuccess(null);

            const response = await ddClient.extension.vm.service.put('/api/config', {
                config
            }) as any;

            if (response?.success) {
                setSuccess('Configuration saved and applied successfully!');
                try {
                    ddClient.desktopUI.toast.success('Configuration saved');
                } catch {
                    // ignore toast failures
                }
            } else {
                const errMsg = typeof response?.error === 'string' ? response.error : stringifyAny(response?.error) || 'Failed to save config';
                throw new Error(errMsg);
            }
        } catch (err) {
            setError(stringifyAny(err));
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        loadConfig();
        setSuccess(null);
        setError(null);
    };

    if (loading && !config) {
        return (
            <Box className="config-page">
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    return (
        <Box className="config-page">
            <Typography variant="h4" gutterBottom>
                Action Configuration
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Toggle Neuro actions on or off. Disabled actions will be unregistered and unavailable to Neuro.
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                    {success}
                </Alert>
            )}

            {config && (
                <>
                    <Card>
                        <CardContent>
                            <Stack spacing={1}>
                                {Object.entries(config)
                                    .sort(([a], [b]) => a.localeCompare(b))
                                    .map(([actionName, enabled], index, array) => (
                                        <Box key={actionName}>
                                            <FormControlLabel
                                                control={
                                                    <Switch
                                                        checked={enabled}
                                                        onChange={() => handleToggle(actionName)}
                                                        disabled={loading}
                                                    />
                                                }
                                                label={
                                                    <Box>
                                                        <Typography variant="body1">{actionName}</Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {enabled ? 'Enabled' : 'Disabled'}
                                                        </Typography>
                                                    </Box>
                                                }
                                            />
                                            {index < array.length - 1 && <Divider sx={{ my: 1 }} />}
                                        </Box>
                                    ))}
                            </Stack>
                        </CardContent>
                    </Card>

                    <Stack direction="row" spacing={2} sx={{ mt: 3 }}>
                        <Button
                            variant="contained"
                            onClick={handleSave}
                            disabled={loading}
                        >
                            {loading ? <CircularProgress size={24} /> : 'Save Configuration'}
                        </Button>
                        <Button
                            variant="outlined"
                            onClick={handleReset}
                            disabled={loading}
                        >
                            Reset
                        </Button>
                    </Stack>
                </>
            )}
        </Box>
    );
}
