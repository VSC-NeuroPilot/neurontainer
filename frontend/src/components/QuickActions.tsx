import { useMemo, useState } from 'preact/hooks';
import {
    Box,
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography
} from '@mui/material';

export type QuickActionDefinition =
    | {
        type: 'button';
        id: string;
        label: string;
        description?: string;
        variant?: 'contained' | 'outlined' | 'text';
        color?: 'primary' | 'secondary' | 'inherit' | 'success' | 'error' | 'info' | 'warning';
        params?: Record<string, unknown>;
    }
    | {
        type: 'text';
        id: string;
        label: string;
        description?: string;
        placeholder?: string;
        initialValue?: string;
        buttonLabel?: string;
        variant?: 'contained' | 'outlined' | 'text';
        color?: 'primary' | 'secondary' | 'inherit' | 'success' | 'error' | 'info' | 'warning';
        paramsKey?: string;
    }
    | {
        type: 'select';
        id: string;
        label: string;
        description?: string;
        options: Array<{ label: string; value: string }>;
        initialValue?: string;
        buttonLabel?: string;
        variant?: 'contained' | 'outlined' | 'text';
        color?: 'primary' | 'secondary' | 'inherit' | 'success' | 'error' | 'info' | 'warning';
        paramsKey?: string;
    };

export type ExecuteQuickAction = (id: string, params: Record<string, unknown>) => Promise<void>;

export function QuickActions(props: {
    actions: QuickActionDefinition[];
    disabled?: boolean;
    onExecute: ExecuteQuickAction;
}) {
    const { actions, disabled, onExecute } = props;

    const initialState = useMemo(() => {
        const next: Record<string, string> = {};
        for (const action of actions) {
            if (action.type === 'text') next[action.id] = action.initialValue ?? '';
            if (action.type === 'select') {
                next[action.id] = action.initialValue ?? action.options[0]?.value ?? '';
            }
        }
        return next;
    }, [actions]);

    const [values, setValues] = useState<Record<string, string>>(initialState);

    const setValue = (id: string, value: string) => {
        setValues((prev) => ({ ...prev, [id]: value }));
    };

    return (
        <Stack spacing={2}>
            {actions.map((action) => {
                const commonButtonProps = {
                    variant: action.variant ?? 'contained',
                    color: action.color ?? 'primary',
                    disabled: Boolean(disabled)
                } as const;

                if (action.type === 'button') {
                    return (
                        <Box key={action.id}>
                            <Stack spacing={1}>
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <Button
                                        {...commonButtonProps}
                                        onClick={() => onExecute(action.id, action.params ?? {})}
                                    >
                                        {action.label}
                                    </Button>
                                    {action.description && (
                                        <Typography variant="body2" color="text.secondary">
                                            {action.description}
                                        </Typography>
                                    )}
                                </Stack>
                            </Stack>
                        </Box>
                    );
                }

                if (action.type === 'text') {
                    const v = values[action.id] ?? '';
                    const paramsKey = action.paramsKey ?? 'value';
                    return (
                        <Box key={action.id}>
                            <Stack spacing={1}>
                                <TextField
                                    label={action.label}
                                    placeholder={action.placeholder}
                                    value={v}
                                    onChange={(e) => setValue(action.id, (e.target as HTMLInputElement).value)}
                                    disabled={Boolean(disabled)}
                                    fullWidth
                                />
                                <Stack direction="row" spacing={2} alignItems="center">
                                    <Button
                                        {...commonButtonProps}
                                        onClick={() => onExecute(action.id, { [paramsKey]: v })}
                                    >
                                        {action.buttonLabel ?? 'Run'}
                                    </Button>
                                    {action.description && (
                                        <Typography variant="body2" color="text.secondary">
                                            {action.description}
                                        </Typography>
                                    )}
                                </Stack>
                            </Stack>
                        </Box>
                    );
                }

                const v = values[action.id] ?? '';
                const paramsKey = action.paramsKey ?? 'value';
                return (
                    <Box key={action.id}>
                        <Stack spacing={1}>
                            <FormControl fullWidth disabled={Boolean(disabled)}>
                                <InputLabel id={`${action.id}-label`}>{action.label}</InputLabel>
                                <Select
                                    labelId={`${action.id}-label`}
                                    label={action.label}
                                    value={v}
                                    onChange={(e: any) => setValue(action.id, String(e?.target?.value ?? ''))}
                                >
                                    {action.options.map((opt) => (
                                        <MenuItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <Stack direction="row" spacing={2} alignItems="center">
                                <Button
                                    {...commonButtonProps}
                                    onClick={() => onExecute(action.id, { [paramsKey]: v })}
                                >
                                    {action.buttonLabel ?? 'Run'}
                                </Button>
                                {action.description && (
                                    <Typography variant="body2" color="text.secondary">
                                        {action.description}
                                    </Typography>
                                )}
                            </Stack>
                        </Stack>
                    </Box>
                );
            })}
        </Stack>
    );
}
