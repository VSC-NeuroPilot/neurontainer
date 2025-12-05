import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { DockerClient } from '@docker/node-sdk'
import { NeuroClient } from 'neuro-game-sdk'

const app = new Hono()

// Enable CORS for Docker Desktop extension
app.use('/*', cors())

// Initialize Docker client
let docker: DockerClient
let neuro: NeuroClient

// Configuration
const NEURO_SERVER_URL = process.env.NEURO_SERVER_URL || 'ws://localhost:8000'
const GAME_NAME = 'neurontainer'

async function initDocker() {
  docker = await DockerClient.fromDockerConfig()
}

function initNeuro() {
  neuro = new NeuroClient(NEURO_SERVER_URL, GAME_NAME, () => {
    console.log('Connected to Neuro-sama server')

    // Register actions that Neuro can execute
    neuro.registerActions([
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
    neuro.onAction(async (actionData) => {
      console.log(`Received action from Neuro: ${actionData.name}`, actionData.params)

      try {
        switch (actionData.name) {
          case 'list_containers': {
            const containers = await docker.containerList({ all: true })
            const containerInfo = containers.map((c: any) => ({
              name: c.Names?.[0]?.replace('/', '') || c.Id.substring(0, 12),
              state: c.State,
              status: c.Status,
              image: c.Image
            }))

            neuro.sendActionResult(
              actionData.id,
              true,
              `Found ${containers.length} containers: ${containerInfo.map(c => `${c.name} (${c.state})`).join(', ')}`
            )
            break
          }

          case 'start_container': {
            const containerId = actionData.params.container
            await docker.containerStart(containerId)
            neuro.sendActionResult(actionData.id, true, `Container ${containerId} started successfully`)
            break
          }

          case 'stop_container': {
            const containerId = actionData.params.container
            await docker.containerStop(containerId)
            neuro.sendActionResult(actionData.id, true, `Container ${containerId} stopped successfully`)
            break
          }

          case 'restart_container': {
            const containerId = actionData.params.container
            await docker.containerRestart(containerId)
            neuro.sendActionResult(actionData.id, true, `Container ${containerId} restarted successfully`)
            break
          }

          case 'remove_container': {
            const containerId = actionData.params.container
            await docker.containerDelete(containerId, { force: true })
            neuro.sendActionResult(actionData.id, true, `Container ${containerId} removed successfully`)
            break
          }

          case 'list_images': {
            const images = await docker.imageList()
            const imageInfo = images.map((img: any) => ({
              tags: img.RepoTags || ['<none>'],
              size: (img.Size / 1024 / 1024).toFixed(2) + ' MB'
            }))

            neuro.sendActionResult(
              actionData.id,
              true,
              `Found ${images.length} images: ${imageInfo.map(i => i.tags[0]).join(', ')}`
            )
            break
          }

          default:
            neuro.sendActionResult(actionData.id, false, `Unknown action: ${actionData.name}`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Error executing action ${actionData.name}:`, errorMsg)
        neuro.sendActionResult(actionData.id, false, `Failed to execute action: ${errorMsg}`)
      }
    })

    // Send initial context to Neuro
    neuro.sendContext('neurontainer is now connected and ready to manage Docker containers', false)
  })
}

// Minimal HTTP server for configuration UI
app.get('/', (c) => {
  return c.json({
    status: 'running',
    neuro_connected: neuro?.ws?.readyState === 1,
    game_name: GAME_NAME
  })
})

app.get('/api/status', (c) => {
  return c.json({
    docker: docker ? 'connected' : 'disconnected',
    neuro: neuro?.ws?.readyState === 1 ? 'connected' : 'disconnected',
    neuro_server: NEURO_SERVER_URL
  })
})

// Start the application
initDocker().then(() => {
  console.log('Docker client initialized')

  // Initialize Neuro connection
  initNeuro()

  // Start minimal HTTP server for configuration
  serve({
    fetch: app.fetch,
    port: 3000
  }, (info) => {
    console.log(`Configuration server running on http://localhost:${info.port}`)
    console.log('neurontainer is waiting for Neuro commands...')
    console.log(`Neuro server: ${NEURO_SERVER_URL}`)
    console.log(`Game name: ${GAME_NAME}`)
  })
}).catch(error => {
  console.error('Failed to initialize Docker client:', error)
  process.exit(1)
})

