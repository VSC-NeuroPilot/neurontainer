# neurontainer - Docker Desktop Extension

A Docker Desktop extension that allows Neuro-sama to control the Docker daemon through a TypeScript-based backend and Preact frontend.

## Project Structure

```
neurontainer/
├── backend/              # Hono-based API server
│   ├── src/
│   │   └── index.ts     # Main backend with Docker API endpoints
│   └── package.json
├── frontend/            # Preact-based UI
│   ├── src/
│   │   ├── index.tsx    # Main app entry
│   │   ├── pages/
│   │   │   └── Home/    # Main dashboard page
│   │   └── components/
│   └── package.json
├── metadata.json        # Extension metadata
├── docker-compose.yml   # Extension service configuration
├── Dockerfile          # Multi-stage build for extension
└── docker.svg          # Extension icon
```

## Development

### Prerequisites

- Docker Desktop 4.8.0 or later
- Node.js 20 or later
- pnpm

### Install Dependencies

```powershell
pnpm install
```

### Build the Extension

```powershell
# Build both backend and frontend
pnpm build

# Build the Docker image
pnpm docker:build
```

### Install to Docker Desktop

```powershell
# Install the extension
pnpm docker:install

# Or update if already installed
pnpm docker:update
```

### Development Mode

For development with hot reload:

```powershell
# Terminal 1: Run backend in dev mode
pnpm dev:backend

# Terminal 2: Run frontend in dev mode  
pnpm dev:frontend

# Terminal 3: Enable UI source for frontend hot reload
pnpm docker:ui-source
```

### Uninstall

```powershell
pnpm docker:uninstall
```

## API Endpoints

The backend provides the following REST API endpoints:

- `GET /api/ping` - Health check
- `GET /api/containers` - List all containers
- `GET /api/images` - List all images
- `POST /api/containers/:id/start` - Start a container
- `POST /api/containers/:id/stop` - Stop a container
- `POST /api/containers/:id/restart` - Restart a container
- `DELETE /api/containers/:id` - Remove a container

## Features

- **Container Management**: Start, stop, restart, and remove containers
- **Image Listing**: View all Docker images with tags and sizes
- **Real-time Updates**: Refresh data on demand
- **Material UI**: Beautiful interface using Docker's MUI theme
- **Docker SDK Integration**: Built with official `@docker/node-sdk`

## Technology Stack

- **Backend**: Hono + Docker Node SDK
- **Frontend**: Preact + Material-UI
- **Build Tool**: Vite
- **Package Manager**: pnpm
- **Extension API**: Docker Extension SDK

## License

MIT
