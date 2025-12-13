import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { DockerClient } from '@docker/node-sdk'
import { NeuroClient } from 'neuro-game-sdk'
import fs from 'fs'
import { CONT } from './consts/index.js'

// Use loose typing to avoid Hono TS overload friction on route definitions
const app = new Hono()

// Enable CORS for Docker Desktop extension
app.use('/*', cors())

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

function describeWs(ws: any) {
  if (!ws) return 'ws: none'
  const rs = typeof ws.readyState === 'number' ? ws.readyState : 'unknown'
  const url = ws.url ?? 'unknown'
  return `ws[url=${url}, readyState=${rs}]`
}

let dockerClientPromise: Promise<DockerClient> | null = null

function initDockerClient() {
  if (!dockerClientPromise) {
    console.log('Initializing Docker client...')
    console.log(`DOCKER_HOST: ${process.env.DOCKER_HOST || 'unset'}`)
    if (!dockerSocketExists()) {
      console.warn(
        `Docker socket not found at ${socketPathFromDockerHost(process.env.DOCKER_HOST || '') || '<none>'}`
      )
    }

    dockerClientPromise = DockerClient.fromDockerConfig()
      .then((client) => {
        CONT.docker = client
        console.log('Docker client connected')
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

  CONT.neuro = new NeuroClient(currentNeuroUrl, GAME_NAME, () => {
    neuroConnected = true
    console.log(`Connected to Neuro-sama server at ${currentNeuroUrl}`)

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
    const wsInfo = describeWs(CONT.neuro?.ws)
    if (neuroConnected) {
      console.warn(`${errLabel} after connected; ignoring. ${wsInfo}`)
      return
    }
    console.error(`${errLabel}; unable to connect to Neuro server at ${NEURO_SERVER_URL}. ${wsInfo}`, err)
  }

  CONT.neuro.onError = (e: any) => {
    handleError('Neuro client error', e)
  }

  // Some errors surface as close without a ready connection
  CONT.neuro.onClose = (e?: any) => {
    const code = e?.code ?? e?.kCode ?? 'unknown'
    const reason = e?.reason ?? e?.kReason ?? ''
    const wsInfo = describeWs(CONT.neuro?.ws)
    handleError(`Neuro client closed before ready (code=${code}, reason=${reason}) ${wsInfo}`)
  }
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
    neuro_server: currentNeuroUrl,
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
;(function () {
  initDockerClient().catch(() => {
    // Initialization is also attempted lazily in each handler; log and continue
    console.error('Docker client initialization failed at startup; will retry on demand')
  })

  // Initialize Neuro connection
  initNeuro()

  // Start minimal HTTP server for configuration
  serve(
    {
      fetch: fetchWithDelete as any,
      port: 3000
    },
    (info) => {
      console.log(`Configuration server running on http://localhost:${info.port}`)
      console.log('neurontainer is waiting for Neuro commands...')
      console.log(`Neuro server: ${currentNeuroUrl}`)
      console.log(`Game name: ${GAME_NAME}`)
    }
  )
})()

