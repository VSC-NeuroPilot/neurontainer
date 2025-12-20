import fs from 'fs'
import path from 'path'

export interface ActionConfig {
    [actionName: string]: boolean
}

interface DiskConfig {
    permissions: ActionConfig
}

export type ActionLike = { name: string }

export type LoggerLike = {
    info: (message: string, ...meta: any[]) => void
    warn: (message: string, ...meta: any[]) => void
    error: (message: string, ...meta: any[]) => void
}

export function getDefaultConfig(actions: readonly ActionLike[]): ActionConfig {
    const config: ActionConfig = {}
    for (const action of actions) {
        config[action.name] = true
    }
    return config
}

export function normalizeConfig(
    actions: readonly ActionLike[],
    input: Partial<ActionConfig> | null | undefined,
    previous?: ActionConfig,
): ActionConfig {
    const base = getDefaultConfig(actions)
    const mergedRaw: Record<string, boolean | undefined> = { ...base, ...(previous ?? {}), ...(input ?? {}) }

    const merged: ActionConfig = {}
    for (const name of Object.keys(mergedRaw)) {
        merged[name] = Boolean(mergedRaw[name])
    }
    return merged
}

export function readConfig(
    actions: readonly ActionLike[],
    configPath: string,
    logger: LoggerLike,
): ActionConfig {
    try {
        if (!fs.existsSync(configPath)) {
            const defaultConfig = getDefaultConfig(actions)
            writeConfig(configPath, defaultConfig, logger)
            return defaultConfig
        }

        const data = fs.readFileSync(configPath, 'utf-8')
        if (!data.trim()) {
            const defaultConfig = getDefaultConfig(actions)
            writeConfig(configPath, defaultConfig, logger)
            return defaultConfig
        }

        const parsed = JSON.parse(data) as unknown
        if (!parsed || typeof parsed !== 'object') {
            const defaultConfig = getDefaultConfig(actions)
            writeConfig(configPath, defaultConfig, logger)
            return defaultConfig
        }

        // New format: { permissions: { ... } }
        const maybePermissions = (parsed as { permissions?: unknown }).permissions
        if (maybePermissions && typeof maybePermissions === 'object') {
            return maybePermissions as ActionConfig
        }

        // Legacy format: { actionName: true/false }
        // Migrate it to the new format on next write.
        const legacy = parsed as ActionConfig
        const normalized = normalizeConfig(actions, legacy)
        writeConfig(configPath, normalized, logger)
        return normalized
    } catch (error) {
        logger.error('Error reading config:', error)
        return getDefaultConfig(actions)
    }
}

export function writeConfig(configPath: string, config: ActionConfig, logger: LoggerLike): void {
    try {
        const dir = path.dirname(configPath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        const disk: DiskConfig = { permissions: config }
        fs.writeFileSync(configPath, JSON.stringify(disk, null, 2))
        logger.info('Config saved')
    } catch (error) {
        logger.error('Error writing config:', error)
        throw error
    }
}

export function validateIncomingConfig(
    actions: readonly ActionLike[],
    incoming: unknown,
): { ok: true; value: Partial<ActionConfig> } | { ok: false; error: string } {
    if (!incoming || typeof incoming !== 'object') {
        return { ok: false, error: 'Invalid config format' }
    }

    const validActionNames = new Set(actions.map((a) => a.name))
    for (const actionName of Object.keys(incoming as Record<string, unknown>)) {
        if (!validActionNames.has(actionName)) {
            return { ok: false, error: `Unknown action: ${actionName}` }
        }
    }

    return { ok: true, value: incoming as Partial<ActionConfig> }
}
