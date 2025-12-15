import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { DockerClient } from '@docker/node-sdk'
import { NeuroClient } from 'neuro-game-sdk'
import fs from 'fs'
import { createServer } from 'node:http'
import { CONT } from './consts/index.js'

const SOCKET_PATH = '/run/guest-services/backend.sock';

if (fs.existsSync(SOCKET_PATH)) fs.unlinkSync(SOCKET_PATH);

// Use loose typing to avoid Hono TS overload friction on route definitions
const app = new Hono()

// Enable CORS for Docker Desktop extension
app.use('/*', cors())

// Log every HTTP request so we can confirm UI->backend calls.
app.use('*', async (c: any, next: any) => {
  const started = Date.now()
  const method = c.req.method
  const path = c.req.path || new URL(c.req.url).pathname
  console.log(`[http] ${method} ${path}`)
  try {
    await next()
  } finally {
    const status = c.res?.status ?? 'unknown'
    const ms = Date.now() - started
    console.log(`[http] ${method} ${path} -> ${status} (${ms}ms)`)
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

const NEURO_SERVER_URL =
  process.env.NEURO_SERVER_URL ||
  // Docker Desktop extension container talking to host
  'ws://host.docker.internal:8000'
const GAME_NAME = 'neurontainer'
let currentNeuroUrl = NEURO_SERVER_URL
let neuroConnected = false
let neuroGeneration = 0

type NeuroEvent =
  | { type: 'connect_attempt'; at: number; url: string }
  | { type: 'connected'; at: number; url: string; ws: string }
  | { type: 'error'; at: number; url: string; ws: string; error: string }
  | { type: 'close'; at: number; url: string; ws: string; code: string; reason: string }
  | { type: 'reconnect_request'; at: number; requested: string; normalized: string; note?: string }
  | { type: 'reconnect_success'; at: number; url: string; ws: string }
  | { type: 'reconnect_fail'; at: number; requested: string; normalized: string; error: string }

let lastNeuroEvent: NeuroEvent | null = null
let lastReconnectRequest: { requested: string; normalized: string; note?: string; at: number } | null = null

function setLastNeuroEvent(e: NeuroEvent) {
  lastNeuroEvent = e
}

function errToString(err: unknown) {
  if (err instanceof Error) return `${err.name}: ${err.message}`
  return typeof err === 'string' ? err : JSON.stringify(err)
}

function describeWs(ws: any) {
  if (!ws) return 'ws: none'
  const rs = typeof ws.readyState === 'number' ? ws.readyState : 'unknown'
  const url = ws.url ?? 'unknown'
  return `ws[url=${url}, readyState=${rs}]`
}

let dockerClientPromise: Promise<DockerClient> | null = null

function initDockerClient() {
  if (!dockerClientPromise) {
    const dockerHost = process.env.DOCKER_HOST || DEFAULT_DOCKER_HOST
    console.log('Initializing Docker client...')
    console.log(`DOCKER_HOST: ${dockerHost}`)
    if (!dockerSocketExists()) {
      console.warn(`Docker socket not found at ${socketPathFromDockerHost(dockerHost) || '<none>'}`)
    }

    // Explicitly respect the resolved host (supports npipe on Windows host, unix socket in container)
    dockerClientPromise = DockerClient.fromDockerHost(dockerHost)
      .then(async (client) => {
        CONT.docker = client
        // Test the connection
        try {
          await client.systemPing()
          console.log('Docker client connected and verified')
        } catch (pingError) {
          console.error('Docker ping failed:', pingError)
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
        if ((error as any)?.code === 'ENOENT') {
          console.error(
            'Docker socket not found. Ensure /var/run/docker.sock is mounted or DOCKER_HOST points to a reachable daemon.'
          )
        }
        throw error
      })
  }

  return dockerClientPromise
}

async function getDockerClient() {
  return initDockerClient()
}

function initNeuro() {
  if (neuroConnected) return

  currentNeuroUrl = NEURO_SERVER_URL
  console.log(`Trying Neuro server: ${currentNeuroUrl}`)
  setLastNeuroEvent({ type: 'connect_attempt', at: Date.now(), url: currentNeuroUrl })
  const gen = ++neuroGeneration

  CONT.neuro = new NeuroClient(currentNeuroUrl, GAME_NAME, () => {
    if (gen !== neuroGeneration) return
    neuroConnected = true
    const wsInfo = describeWs(CONT.neuro?.ws)
    console.log(`Connected to Neuro-sama server at ${currentNeuroUrl} ${wsInfo}`)
    setLastNeuroEvent({ type: 'connected', at: Date.now(), url: currentNeuroUrl, ws: wsInfo })

    // Register actions that Neuro can execute
    CONT.neuro.registerActions([
      {
        name: 'list_containers',
        description: 'List all Docker containers with their current status',
        schema: {}
      },
      {
        name: 'start_container',
        description: 'Start a Docker container by name or ID',
        schema: {
          type: 'object',
          properties: {
            container: { type: 'string', description: 'Container name or ID' }
          },
          required: ['container']
        }
      },
      {
        name: 'stop_container',
        description: 'Stop a running Docker container by name or ID',
        schema: {
          type: 'object',
          properties: {
            container: { type: 'string', description: 'Container name or ID' }
          },
          required: ['container']
        }
      },
      {
        name: 'restart_container',
        description: 'Restart a Docker container by name or ID',
        schema: {
          type: 'object',
          properties: {
            container: { type: 'string', description: 'Container name or ID' }
          },
          required: ['container']
        }
      },
      {
        name: 'remove_container',
        description: 'Remove a Docker container by name or ID',
        schema: {
          type: 'object',
          properties: {
            container: { type: 'string', description: 'Container name or ID' }
          },
          required: ['container']
        }
      },
      {
        name: 'list_images',
        description: 'List all Docker images available on the system',
        schema: {}
      }
    ])

    // Handle actions from Neuro
    CONT.neuro.onAction(async (actionData) => {
      console.log(`Received action from Neuro: ${actionData.name}`, actionData.params)

      try {
        switch (actionData.name) {
          case 'list_containers': {
            if (!CONT.docker) throw new Error('Docker client not initialized')
            const containers = await CONT.docker.containerList({ all: true })
            const containerInfo = containers.map((c: any) => ({
              name: c.Names?.[0]?.replace('/', '') || c.Id.substring(0, 12),
              state: c.State,
              status: c.Status,
              image: c.Image
            }))

            CONT.neuro.sendActionResult(
              actionData.id,
              true,
              `Found ${containers.length} containers: ${containerInfo.map(c => `${c.name} (${c.state})`).join(', ')}`
            )
            break
          }

          case 'start_container': {
            if (!CONT.docker) throw new Error('Docker client not initialized')
            const containerId = actionData.params.container
            await CONT.docker.containerStart(containerId)
            CONT.neuro.sendActionResult(actionData.id, true, `Container ${containerId} started successfully`)
            break
          }

          case 'stop_container': {
            if (!CONT.docker) throw new Error('Docker client not initialized')
            const containerId = actionData.params.container
            await CONT.docker.containerStop(containerId)
            CONT.neuro.sendActionResult(actionData.id, true, `Container ${containerId} stopped successfully`)
            break
          }

          case 'restart_container': {
            if (!CONT.docker) throw new Error('Docker client not initialized')
            const containerId = actionData.params.container
            await CONT.docker.containerRestart(containerId)
            CONT.neuro.sendActionResult(actionData.id, true, `Container ${containerId} restarted successfully`)
            break
          }

          case 'remove_container': {
            if (!CONT.docker) throw new Error('Docker client not initialized')
            const containerId = actionData.params.container
            await CONT.docker.containerDelete(containerId, { force: true })
            CONT.neuro.sendActionResult(actionData.id, true, `Container ${containerId} removed successfully`)
            break
          }

          case 'list_images': {
            if (!CONT.docker) throw new Error('Docker client not initialized')
            const images = await CONT.docker.imageList()
            const imageInfo = images.map((img: any) => ({
              tags: img.RepoTags || ['<none>'],
              size: (img.Size / 1024 / 1024).toFixed(2) + ' MB'
            }))

            CONT.neuro.sendActionResult(
              actionData.id,
              true,
              `Found ${images.length} images: ${imageInfo.map(i => i.tags[0]).join(', ')}`
            )
            break
          }

          default:
            CONT.neuro.sendActionResult(actionData.id, false, `Unknown action: ${actionData.name}`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        const dockerHost = process.env.DOCKER_HOST || 'unset'
        console.error(`Error executing action ${actionData.name}:`, errorMsg, `DOCKER_HOST=${dockerHost}`)
        CONT.neuro.sendActionResult(actionData.id, false, `Failed to execute action: ${errorMsg}`)
      }
    })

    // Send initial context to Neuro
    CONT.neuro.sendContext('neurontainer is now connected and ready to manage Docker containers', false)
  })

  const handleError = (errLabel: string, err?: unknown) => {
    if (gen !== neuroGeneration) return
    const wsInfo = describeWs(CONT.neuro?.ws)
    // Always log; reconnect issues otherwise look like "it didn't try".
    console.error(`${errLabel} (url=${currentNeuroUrl}). ${wsInfo}`, err)
    setLastNeuroEvent({
      type: 'error',
      at: Date.now(),
      url: currentNeuroUrl,
      ws: wsInfo,
      error: errToString(err ?? errLabel)
    })
  }

  CONT.neuro.onError = (e: any) => {
    handleError('Neuro client error', e)
  }

  // Some errors surface as close without a ready connection
  CONT.neuro.onClose = (e?: any) => {
    if (gen !== neuroGeneration) return
    const code = e?.code ?? e?.kCode ?? 'unknown'
    const reason = e?.reason ?? e?.kReason ?? ''
    const wsInfo = describeWs(CONT.neuro?.ws)
    console.warn(`Neuro client closed (code=${code}, reason=${reason}) url=${currentNeuroUrl}. ${wsInfo}`)
    setLastNeuroEvent({
      type: 'close',
      at: Date.now(),
      url: currentNeuroUrl,
      ws: wsInfo,
      code: String(code),
      reason: String(reason)
    })
  }
}

function normalizeNeuroUrl(input: string): { original: string; normalized: string; note?: string } {
  const original = input
  try {
    const u = new URL(input)
    let noteParts: string[] = []

    // If user omitted a port (e.g. ws://localhost), default to 8000 instead of ws default :80.
    if ((u.protocol === 'ws:' || u.protocol === 'wss:') && !u.port) {
      u.port = '8000'
      noteParts.push('Added default port :8000 (ws/wss without explicit port defaults to :80)')
    }

    const isLocal =
      u.hostname === 'localhost' ||
      u.hostname === '127.0.0.1' ||
      u.hostname === '::1' ||
      u.hostname.startsWith('127.')
    // In the extension VM container, localhost points to the container itself.
    if (isLocal && process.platform !== 'win32') {
      u.hostname = 'host.docker.internal'
      noteParts.push('Rewrote localhost -> host.docker.internal (inside container localhost is not the host)')
    }
    const note = noteParts.length ? noteParts.join('; ') : undefined
    return { original, normalized: u.toString(), note }
  } catch {
    return { original, normalized: input }
  }
}

async function waitForNeuroConnection(client: NeuroClient, url: string, timeoutMs = 6000): Promise<void> {
  // Do not override NeuroClient handlers; just wait until ws is OPEN.
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const rs = (client as any)?.ws?.readyState
    if (rs === 1) return
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error(
    `Timed out after ${timeoutMs}ms waiting for Neuro connection (${url}). ${describeWs((client as any)?.ws)}`
  )
}

// Minimal HTTP server for configuration UI
app.get('/', (c: any) => {
  return c.json({
    status: 'running',
    neuro_connected: CONT.neuro?.ws?.readyState === 1,
    game_name: GAME_NAME
  })
})

app.get('/api/status', (c: any) => {
  return c.json({
    docker: CONT.docker ? 'connected' : 'disconnected',
    neuro: CONT.neuro?.ws?.readyState === 1 ? 'connected' : 'disconnected',
    neuro_connected_flag: neuroConnected,
    neuro_server: currentNeuroUrl,
    neuro_ws: describeWs(CONT.neuro?.ws),
    last_neuro_event: lastNeuroEvent,
    last_reconnect_request: lastReconnectRequest,
    docker_host: process.env.DOCKER_HOST || 'unset',
    docker_socket_exists: dockerSocketExists()
  })
});

app.get('/api/ping', (c: any) => {
  return c.json({
    success: true,
    message: 'pong'
  })
})

app.get('/api/containers', async (c: any) => {
  try {
    const docker = await getDockerClient()
    const containers = await docker.containerList({ all: true })

    const data = containers.map((container: any) => ({
      id: container.Id,
      name: container.Names?.[0]?.replace('/', '') ?? container.Id.substring(0, 12),
      image: container.Image,
      state: container.State,
      status: container.Status
    }))

    return c.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list containers'
    return c.json({ success: false, error: message }, 500)
  }
})

app.get('/api/images', async (c: any) => {
  try {
    const docker = await getDockerClient()
    const images = await docker.imageList()

    const data = images.map((image: any) => ({
      id: image.Id,
      tags: image.RepoTags || [],
      size: image.Size,
      created: image.Created
    }))

    return c.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list images'
    return c.json({ success: false, error: message }, 500)
  }
})

app.post('/api/containers/:id/start', async (c: any) => {
  const { id } = c.req.param()
  try {
    const docker = await getDockerClient()
    await docker.containerStart(id)
    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : `Failed to start container ${id}`
    return c.json({ success: false, error: message }, 500)
  }
})

app.post('/api/containers/:id/stop', async (c: any) => {
  const { id } = c.req.param()
  try {
    const docker = await getDockerClient()
    await docker.containerStop(id)
    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : `Failed to stop container ${id}`
    return c.json({ success: false, error: message }, 500)
  }
})

app.post('/api/containers/:id/restart', async (c: any) => {
  const { id } = c.req.param()
  try {
    const docker = await getDockerClient()
    await docker.containerRestart(id)
    return c.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : `Failed to restart container ${id}`
    return c.json({ success: false, error: message }, 500)
  }
})

app.post('/api/reconnect/neuro', async (c) => {
  try {
    const body = await c.req.json()
    const requested = (body.websocketUrl || NEURO_SERVER_URL) as string
    const { normalized: websocketUrl, note } = normalizeNeuroUrl(requested)
    lastReconnectRequest = { requested, normalized: websocketUrl, note, at: Date.now() }
    setLastNeuroEvent({ type: 'reconnect_request', at: Date.now(), requested, normalized: websocketUrl, note })

    console.log(`Reconnect requested. url=${requested}`)
    if (note) console.warn(note)
    console.log(`Reconnecting NeuroClient with URL: ${websocketUrl}`)

    // Close existing connection if present
    if (CONT.neuro) {
      try {
        if (CONT.neuro.ws && CONT.neuro.ws.readyState !== 3) { // Not CLOSED
          CONT.neuro.ws.close()
        }
      } catch (closeError) {
        console.warn('Error closing existing Neuro connection:', closeError)
      }
    }

    // Reset connection state
    neuroConnected = false
    currentNeuroUrl = websocketUrl
    const gen = ++neuroGeneration

    // Reconstruct the NeuroClient and WAIT until it is actually connected (or fails).
    const client = new NeuroClient(currentNeuroUrl, GAME_NAME, () => {
      if (gen !== neuroGeneration) return
      neuroConnected = true
      const wsInfo = describeWs((client as any)?.ws)
      console.log(`Reconnected to Neuro-sama server at ${currentNeuroUrl} ${wsInfo}`)
      setLastNeuroEvent({ type: 'connected', at: Date.now(), url: currentNeuroUrl, ws: wsInfo })

      // Register actions
      CONT.neuro.registerActions([
        {
          name: 'list_containers',
          description: 'List all Docker containers with their current status',
          schema: {}
        },
        {
          name: 'start_container',
          description: 'Start a Docker container by name or ID',
          schema: {
            type: 'object',
            properties: {
              container: { type: 'string', description: 'Container name or ID' }
            },
            required: ['container']
          }
        },
        {
          name: 'stop_container',
          description: 'Stop a running Docker container by name or ID',
          schema: {
            type: 'object',
            properties: {
              container: { type: 'string', description: 'Container name or ID' }
            },
            required: ['container']
          }
        },
        {
          name: 'restart_container',
          description: 'Restart a Docker container by name or ID',
          schema: {
            type: 'object',
            properties: {
              container: { type: 'string', description: 'Container name or ID' }
            },
            required: ['container']
          }
        },
        {
          name: 'remove_container',
          description: 'Remove a Docker container by name or ID',
          schema: {
            type: 'object',
            properties: {
              container: { type: 'string', description: 'Container name or ID' }
            },
            required: ['container']
          }
        },
        {
          name: 'list_images',
          description: 'List all Docker images available on the system',
          schema: {}
        }
      ])

      // Handle actions from Neuro
      CONT.neuro.onAction(async (actionData) => {
        console.log(`Received action from Neuro: ${actionData.name}`, actionData.params)

        try {
          switch (actionData.name) {
            case 'list_containers': {
              if (!CONT.docker) throw new Error('Docker client not initialized')
              const containers = await CONT.docker.containerList({ all: true })
              const containerInfo = containers.map((c: any) => ({
                name: c.Names?.[0]?.replace('/', '') || c.Id.substring(0, 12),
                state: c.State,
                status: c.Status,
                image: c.Image
              }))

              CONT.neuro.sendActionResult(
                actionData.id,
                true,
                `Found ${containers.length} containers: ${containerInfo.map(c => `${c.name} (${c.state})`).join(', ')}`
              )
              break
            }

            case 'start_container': {
              if (!CONT.docker) throw new Error('Docker client not initialized')
              const containerId = actionData.params.container
              await CONT.docker.containerStart(containerId)
              CONT.neuro.sendActionResult(actionData.id, true, `Container ${containerId} started successfully`)
              break
            }

            case 'stop_container': {
              if (!CONT.docker) throw new Error('Docker client not initialized')
              const containerId = actionData.params.container
              await CONT.docker.containerStop(containerId)
              CONT.neuro.sendActionResult(actionData.id, true, `Container ${containerId} stopped successfully`)
              break
            }

            case 'restart_container': {
              if (!CONT.docker) throw new Error('Docker client not initialized')
              const containerId = actionData.params.container
              await CONT.docker.containerRestart(containerId)
              CONT.neuro.sendActionResult(actionData.id, true, `Container ${containerId} restarted successfully`)
              break
            }

            case 'remove_container': {
              if (!CONT.docker) throw new Error('Docker client not initialized')
              const containerId = actionData.params.container
              await CONT.docker.containerDelete(containerId, { force: true })
              CONT.neuro.sendActionResult(actionData.id, true, `Container ${containerId} removed successfully`)
              break
            }

            case 'list_images': {
              if (!CONT.docker) throw new Error('Docker client not initialized')
              const images = await CONT.docker.imageList()
              const imageInfo = images.map((img: any) => ({
                tags: img.RepoTags || ['<none>'],
                size: (img.Size / 1024 / 1024).toFixed(2) + ' MB'
              }))

              CONT.neuro.sendActionResult(
                actionData.id,
                true,
                `Found ${images.length} images: ${imageInfo.map(i => i.tags[0]).join(', ')}`
              )
              break
            }

            default:
              CONT.neuro.sendActionResult(actionData.id, false, `Unknown action: ${actionData.name}`)
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          const dockerHost = process.env.DOCKER_HOST || 'unset'
          console.error(`Error executing action ${actionData.name}:`, errorMsg, `DOCKER_HOST=${dockerHost}`)
          CONT.neuro.sendActionResult(actionData.id, false, `Failed to execute action: ${errorMsg}`)
        }
      })

      CONT.neuro.sendContext('neurontainer reconnected and ready to manage Docker containers', false)
    })
    CONT.neuro = client

      // Ensure failures during/after reconnect are visible, but ignore stale generations.
      ; (client as any).onError = (e: any) => {
        if (gen !== neuroGeneration) return
        const wsInfo = describeWs((client as any)?.ws)
        console.error(`Neuro client error (url=${currentNeuroUrl}). ${wsInfo}`, e)
        setLastNeuroEvent({ type: 'error', at: Date.now(), url: currentNeuroUrl, ws: wsInfo, error: errToString(e) })
      }

      ; (client as any).onClose = (e?: any) => {
        if (gen !== neuroGeneration) return
        const code = e?.code ?? e?.kCode ?? 'unknown'
        const reason = e?.reason ?? e?.kReason ?? ''
        const wsInfo = describeWs((client as any)?.ws)
        console.warn(`Neuro client closed (code=${code}, reason=${reason}) url=${currentNeuroUrl}. ${wsInfo}`)
        setLastNeuroEvent({
          type: 'close',
          at: Date.now(),
          url: currentNeuroUrl,
          ws: wsInfo,
          code: String(code),
          reason: String(reason)
        })
      }

    await waitForNeuroConnection(client, currentNeuroUrl, 6000)
    const wsInfo = describeWs(CONT.neuro?.ws)
    console.log(`Neuro connection confirmed: ${wsInfo}`)
    setLastNeuroEvent({ type: 'reconnect_success', at: Date.now(), url: currentNeuroUrl, ws: wsInfo })

    return c.json({
      success: true,
      message: `NeuroClient connected to ${currentNeuroUrl}`,
      websocketUrl: currentNeuroUrl
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reconnect NeuroClient'
    console.error('Error reconnecting NeuroClient:', error)
    if (lastReconnectRequest) {
      setLastNeuroEvent({
        type: 'reconnect_fail',
        at: Date.now(),
        requested: lastReconnectRequest.requested,
        normalized: lastReconnectRequest.normalized,
        error: message
      })
    }
    return c.json({ success: false, error: message }, 500)
  }
})

// Custom delete handler wired via top-level fetch wrapper (app.delete not available in this Hono build)
async function handleDelete(req: Request) {
  const url = new URL(req.url)
  const match = url.pathname.match(/^\/api\/containers\/([^/]+)$/)
  if (!match) return null

  const id = match[1]
  try {
    const docker = await getDockerClient()
    await docker.containerDelete(id, { force: true })
    return Response.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : `Failed to remove container ${id}`
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}

const fetchWithDelete = async (req: Request, env: any, ctx: any) => {
  if (req.method === 'DELETE') {
    const response = await handleDelete(req)
    if (response) return response
  }
  return app.fetch(req, env, ctx)
}

  // Start the application
  ; (function () {
    initDockerClient().catch(() => {
      // Initialization is also attempted lazily in each handler; log and continue
      console.error('Docker client initialization failed at startup; will retry on demand')
    })

    // Initialize Neuro connection
    initNeuro()

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

      // Call Hono's fetch handler (which includes DELETE handling)
      const response = await fetchWithDelete(request, {}, {})

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
      console.log(`Backend service listening on ${SOCKET_PATH}`)
      console.log('neurontainer is waiting for Neuro commands...')
      console.log(`Neuro server: ${currentNeuroUrl}`)
      console.log(`Game name: ${GAME_NAME}`)
    })
  })()
