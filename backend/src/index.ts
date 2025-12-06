import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { NeuroClient } from 'neuro-game-sdk'
import { CONT } from './consts/index.js'

const app = new Hono()

// Enable CORS for Docker Desktop extension
app.use('/*', cors())

// Configuration
const NEURO_SERVER_URL = process.env.NEURO_SERVER_URL || 'ws://host.docker.internal:8000'
const GAME_NAME = 'neurontainer'

function initNeuro() {
  CONT.neuro = new NeuroClient(NEURO_SERVER_URL, GAME_NAME, () => {
    console.log('Connected to Neuro-sama server')

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
            const containerId = actionData.params.container
            await CONT.docker.containerStart(containerId)
            CONT.neuro.sendActionResult(actionData.id, true, `Container ${containerId} started successfully`)
            break
          }

          case 'stop_container': {
            const containerId = actionData.params.container
            await CONT.docker.containerStop(containerId)
            CONT.neuro.sendActionResult(actionData.id, true, `Container ${containerId} stopped successfully`)
            break
          }

          case 'restart_container': {
            const containerId = actionData.params.container
            await CONT.docker.containerRestart(containerId)
            CONT.neuro.sendActionResult(actionData.id, true, `Container ${containerId} restarted successfully`)
            break
          }

          case 'remove_container': {
            const containerId = actionData.params.container
            await CONT.docker.containerDelete(containerId, { force: true })
            CONT.neuro.sendActionResult(actionData.id, true, `Container ${containerId} removed successfully`)
            break
          }

          case 'list_images': {
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
        console.error(`Error executing action ${actionData.name}:`, errorMsg)
        CONT.neuro.sendActionResult(actionData.id, false, `Failed to execute action: ${errorMsg}`)
      }
    })

    // Send initial context to Neuro
    CONT.neuro.sendContext('neurontainer is now connected and ready to manage Docker containers', false)
  })
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
    neuro_server: NEURO_SERVER_URL
  })
});

// Start the application
(function () {
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
})()

