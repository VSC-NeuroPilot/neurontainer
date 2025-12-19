import { useEffect, useMemo, useState } from 'preact/hooks';
import { Box, Card, CardContent, CircularProgress, Alert, Typography, Button } from '@mui/material';
import { createDockerDesktopClient } from '@docker/extension-api-client';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeSanitize from 'rehype-sanitize';
import rehypeStringify from 'rehype-stringify';
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

export function Changelog() {
    const processor = useMemo(
        () =>
            unified()
                .use(remarkParse)
                .use(remarkRehype)
                .use(rehypeSanitize)
                .use(rehypeStringify),
        []
    );

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [markdown, setMarkdown] = useState<string | null>(null);
    const [html, setHtml] = useState<string>('');

    const loadChangelog = async () => {
        try {
            if (!ddClient) {
                throw new Error(
                    `Docker Desktop extension API client is unavailable${ddClientInitError ? `: ${ddClientInitError}` : ''}`
                );
            }
            setLoading(true);
            setError(null);

            const raw = (await ddClient.extension.vm.service.get('/api/changelog')) as any;
            const response = normalizeResponse(raw) as any;
            if (!response?.success) {
                const errMsg =
                    typeof response?.error === 'string'
                        ? response.error
                        : response?.error
                            ? stringifyAny(response.error)
                            : `Failed to load changelog. Raw response:\n${stringifyAny(raw)}`;
                throw new Error(errMsg);
            }
            const md = String(response.markdown ?? '');
            setMarkdown(md);
            const file = await processor.process(md);
            setHtml(String(file));
        } catch (err) {
            setError(stringifyAny(err));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadChangelog();
    }, []);

    return (
        <Box className="changelog-page">
            <Typography variant="h4" gutterBottom>
                Changelog
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                This is loaded from <code>/app/CHANGELOG.md</code> inside the extension container.
            </Typography>

            {ddClientInitError && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Docker Desktop API client failed to initialize: {ddClientInitError}
                </Alert>
            )}
            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Card>
                <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6">Release notes</Typography>
                        <Button variant="outlined" onClick={loadChangelog} disabled={loading}>
                            Refresh
                        </Button>
                    </Box>

                    {loading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    )}

                    {!loading && markdown && (
                        <div className="changelog-markdown" dangerouslySetInnerHTML={{ __html: html }} />
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}

