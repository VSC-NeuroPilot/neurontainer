import path from 'path'

// Persist configuration in the Docker volume mounted at /data (see docker-compose.yml).
// Allow override for local/dev via env.
export const CONFIG_PATH = process.env.NEURONTAINER_CONFIG_PATH || path.join('/data', 'config.json')

// Changelog is baked into the extension image.
export const CHANGELOG_PATH = process.env.NEURONTAINER_CHANGELOG_PATH || path.join('/app', 'CHANGELOG.md')
