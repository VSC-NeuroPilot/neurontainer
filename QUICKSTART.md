# Quick Start Guide - neurontainer Docker Extension

This guide will help you get the neurontainer Docker Desktop extension up and running.

## Step 1: Install Dependencies

```powershell
pnpm install
```

## Step 2: Build the Extension

```powershell
# Build backend and frontend
pnpm build

# Build Docker image
pnpm docker:build
```

## Step 3: Install to Docker Desktop

```powershell
pnpm docker:install
```

The extension will now appear in Docker Desktop under the "Extensions" tab.

## Step 4: Using the Extension

1. Open Docker Desktop
2. Navigate to the "Extensions" tab in the sidebar
3. Click on "neurontainer"
4. You'll see a dashboard showing:
   - All Docker containers (with start/stop/restart/remove controls)
   - All Docker images (with size and tag information)

## Updating the Extension

After making code changes:

```powershell
# Rebuild
pnpm build
pnpm docker:build

# Update the installed extension
pnpm docker:update
```

## Development Workflow

For faster development with hot reload:

```powershell
# Terminal 1: Backend dev server
pnpm dev:backend

# Terminal 2: Frontend dev server
pnpm dev:frontend

# Terminal 3: Connect frontend to extension
pnpm docker:ui-source
```

Now changes to the frontend will hot-reload without rebuilding the Docker image!

## Troubleshooting

### Extension won't install

- Make sure Docker Desktop is running
- Check Docker Desktop version (requires 4.8.0+)
- Try: `docker extension ls` to see installed extensions

### Backend not connecting to Docker

- Verify Docker socket is mounted in `docker-compose.yml`
- Check backend logs: `docker logs <container-id>`

### Frontend not loading

- Check that the UI is built: `ls frontend/dist`
- Verify `metadata.json` points to correct paths

## Uninstalling

```powershell
pnpm docker:uninstall
```

## Next Steps

- Integrate Neuro SDK for AI control
- Add WebSocket support for real-time updates
- Implement container creation/configuration UI
- Add network and volume management
