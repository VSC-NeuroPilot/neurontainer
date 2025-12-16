import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { DockerClient } from '@docker/node-sdk'
import fs from 'fs'
import { createServer } from 'node:http'
import { CONT } from './consts'
import { logger } from './utils'
import { RCEActionHandler } from './rce'

const SOCKET_PATH = '/run/guest-services/backend.sock';

if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH);

// Use loose typing to avoid Hono TS overload friction on route definitions
const app = new Hono()

// Enable CORS for Docker Desktop extension
app.use('/*', cors())

// Log every HTTP request so we can confirm UI->backend calls.
app.use('*', async (c, next) => {
  const started = Date.now()
  const method = c.req.method
  const path = c.req.path || new URL(c.req.url).pathname
  logger.info(`[http] ${method} ${path}`)
  try {
    await next()
  } finally {
    const status = c.res?.status ?? 'unknown'
    const ms = Date.now() - started
    logger.info(`[http] ${method} ${path} -> ${status} (${ms}ms)`)
  }
})

// Configuration
function resolveDockerHost(): string {
  const envHost = process.env.DOCKER_HOST
  // If running inside container (linux) but host provided a Windows npipe, fall back to socket
  if (envHost && process.platform !== 'win32' && envHost.startsWith('npipe:')) {
    return 'unix:///var/run/docker.sock'
  }
  if (envHost) return envHost
  return process.platform === 'win32'
    ? 'npipe:////./pipe/docker_engine'
    : 'unix:///var/run/docker.sock'
}

const DEFAULT_DOCKER_HOST = resolveDockerHost()
// Force a default DOCKER_HOST so DockerClient.fromDockerConfig works even if env is missing.
process.env.DOCKER_HOST = DEFAULT_DOCKER_HOST

function socketPathFromDockerHost(host: string): string | null {
  if (host.startsWith('unix://')) return host.replace('unix://', '')
  return null
}

function dockerSocketExists(): boolean {
  const socketPath = socketPathFromDockerHost(process.env.DOCKER_HOST || '')
  return socketPath ? fs.existsSync(socketPath) : false
}

const GAME_NAME = 'neurontainer'

let dockerClientPromise: Promise<DockerClient> | null = null

function initDockerClient() {
  if (!dockerClientPromise) {
    const dockerHost = process.env.DOCKER_HOST || DEFAULT_DOCKER_HOST
    logger.info('Initializing Docker client...')
    logger.info(`DOCKER_HOST: ${dockerHost}`)
    if (!dockerSocketExists()) {
      logger.warn(`Docker socket not found at ${socketPathFromDockerHost(dockerHost) || '<none>'}`)
    }

    // Explicitly respect the resolved host (supports npipe on Windows host, unix socket in container)
    dockerClientPromise = DockerClient.fromDockerHost(dockerHost)
      .then(async (client) => {
        CONT.docker = client
        // Test the connection
        try {
          await client.systemPing()
          logger.info('Docker client connected and verified')
        } catch (pingError) {
          logger.error('Docker ping failed:', pingError)
          throw pingError
        }
        return client
      })
      .catch((error) => {
        dockerClientPromise = null
        console.error(
          'Failed to initialize Docker client',
          error,
          `DOCKER_HOST=${process.env.DOCKER_HOST ?? 'unset'}`
        )
        if (error?.code === 'ENOENT') {
          console.error(
            'Docker socket not found. Ensure /var/run/docker.sock is mounted or DOCKER_HOST points to a reachable daemon.'
          )
        }
        throw error
      })
  }

  return dockerClientPromise
}

// Minimal HTTP server for configuration UI
app.get('/', (c) => {
  return c.json({
    status: 'running',
    neuro_connected: CONT.neuro?.ws?.readyState === 1,
    game_name: GAME_NAME
  })
})

app.get('/api/status', (c) => {
  return c.json({
    docker: CONT.docker ? 'connected' : 'disconnected',
    neuro: CONT.neuro?.ws?.readyState === 1 ? 'connected' : 'disconnected',
    neuro_connected_flag: CONT.neuroConnected,
    neuro_server: CONT.currentNeuroUrl,
    neuro_ws: CONT.neuro?.ws ? `ws[url=${CONT.neuro.ws.url ?? 'unknown'}, readyState=${CONT.neuro.ws.readyState}]` : 'ws: none',
    last_neuro_event: CONT.lastNeuroEvent,
    last_reconnect_request: CONT.lastReconnectRequest,
    docker_host: process.env.DOCKER_HOST || 'unset',
    docker_socket_exists: CONT.docker ? true : false
  })
});

app.get('/api/ping', (c) => {
  return c.json({
    success: true,
    message: 'pong'
  })
})

app.post('/api/reconnect/neuro', async (c) => {
  try {
    const body = await c.req.json()
    const requested = (body.websocketUrl || CONT.currentNeuroUrl) as string
    const { normalized: websocketUrl, note } = CONT.normalizeNeuroUrl(requested)
    CONT.lastReconnectRequest = { requested, normalized: websocketUrl, note, at: Date.now() }
    CONT.lastNeuroEvent = { type: 'reconnect_request', at: Date.now(), requested, normalized: websocketUrl, note }

    console.log(`Reconnect requested. url=${requested}`)
    if (note) console.warn(note)
    console.log(`Reconnecting NeuroClient with URL: ${websocketUrl}`)

    await CONT.reconnectNeuro(websocketUrl)
    const wsInfo = CONT.neuro?.ws ? `ws[url=${CONT.neuro.ws.url ?? 'unknown'}, readyState=${CONT.neuro.ws.readyState}]` : 'ws: none'
    console.log(`Neuro connection confirmed: ${wsInfo}`)
    CONT.lastNeuroEvent = { type: 'reconnect_success', at: Date.now(), url: CONT.currentNeuroUrl, ws: wsInfo }

    return c.json({
      success: true,
      message: `NeuroClient connected to ${CONT.currentNeuroUrl}`,
      websocketUrl: CONT.currentNeuroUrl
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reconnect NeuroClient'
    console.error('Error reconnecting NeuroClient:', error)
    if (CONT.lastReconnectRequest) {
      CONT.lastNeuroEvent = {
        type: 'reconnect_fail',
        at: Date.now(),
        requested: CONT.lastReconnectRequest.requested,
        normalized: CONT.lastReconnectRequest.normalized,
        error: message
      }
    }
    return c.json({ success: false, error: message }, 500)
  }
})
  // Start the application
  ; (function () {
    // Set action handler
    CONT.neuro.onAction(RCEActionHandler)

    // Remove existing socket if present
    if (fs.existsSync(SOCKET_PATH)) {
      fs.unlinkSync(SOCKET_PATH)
    }

    // Create HTTP server with Hono's fetch handler
    const server = createServer(async (req, res) => {
      // Convert Node.js IncomingMessage to Web API Request
      const url = new URL(req.url || '/', `http://localhost`)
      const headers = new Headers()

      Object.entries(req.headers).forEach(([key, value]) => {
        if (value) headers.set(key, Array.isArray(value) ? value[0] : value)
      })

      let body: Buffer | undefined = undefined
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks: Buffer[] = []
        for await (const chunk of req) {
          chunks.push(chunk as Buffer)
        }
        body = Buffer.concat(chunks as unknown as Uint8Array[])
      }

      const request = new Request(url.href, {
        method: req.method,
        headers,
        body: body as any
      })

      // Call Hono's fetch handler
      const response = await app.fetch(request)

      // Convert Web API Response back to Node.js ServerResponse
      res.writeHead(response.status, Object.fromEntries(response.headers))

      if (response.body) {
        const reader = response.body.getReader()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          res.write(value)
        }
      }

      res.end()
    })

    // Listen on Unix socket
    server.listen(SOCKET_PATH, () => {
      logger.info(`Backend service listening on ${SOCKET_PATH}`)
      logger.info('neurontainer is waiting for Neuro commands...')
      logger.info(`Neuro server: ${CONT.currentNeuroUrl}`)
      logger.info(`Game name: ${GAME_NAME}`)
    })
  })()
