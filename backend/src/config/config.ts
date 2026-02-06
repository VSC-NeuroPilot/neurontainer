import fs from 'fs'
import path from 'path'

export type NeuroConfig = {
    websocketUrl?: string
}

export type DiskConfig = {
    permissions?: Record<string, unknown>
    neuro?: NeuroConfig
}

export function readDiskConfig(configPath: string): DiskConfig {
    try {
        if (!fs.existsSync(configPath)) return {}
        const raw = fs.readFileSync(configPath, 'utf-8')
        if (!raw.trim()) return {}
        const parsed = JSON.parse(raw) as unknown
        if (!parsed || typeof parsed !== 'object') return {}
        return parsed as DiskConfig
    } catch {
        return {}
    }
}

export function writeDiskConfig(configPath: string, disk: DiskConfig): void {
    const dir = path.dirname(configPath)
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(configPath, JSON.stringify(disk, null, 2))
}
