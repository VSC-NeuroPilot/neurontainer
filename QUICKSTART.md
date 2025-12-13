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

# Terminal 3: Connect frontend to extension (optional for live UI in Docker Desktop)
pnpm docker:ui-source
```

Neuro server connection:
- Default: `ws://localhost:8000`
- Extension fallbacks: `ws://docker.internal:8000`, then `ws://host.docker.internal:8000`
- Override: set `NEURO_SERVER_URL` (e.g., `setx NEURO_SERVER_URL ws://127.0.0.1:8000`)

Changes to the frontend will hot-reload without rebuilding the Docker image.

## Fresh install and test (Docker Desktop on Windows)

Run these in PowerShell:

1) Use the Desktop Linux context
```
docker context use desktop-linux
docker --context desktop-linux ps   # if this fails, restart Docker Desktop
```

2) Restart Tony (Neuro server) so it is listening on `ws://localhost:8000`. Tony only allows one client; restart it if you need to reconnect.

3) Remove any old extension
```
docker extension rm neurontainer
```

4) Rebuild and install
```
pnpm build
pnpm docker:build
pnpm docker:install   # or pnpm docker:update
```

5) In Docker Desktop, check the extension container; start it if stopped, and view logs. If you see 503s, restart Tony and try again.

6) Verify the service in the Desktop VM
```
docker --context desktop-linux compose -p neurontainer-desktop-extension ps
```

7) Send an action via Tony (e.g., `list_images`) and inspect logs
```
docker --context desktop-linux compose -p neurontainer-desktop-extension logs --tail=50
```

Checking logs in Docker Desktop:
- In the Extensions tab, select neurontainer and use the built-in Logs view (if available), or
- Use the CLI log command above (`docker --context desktop-linux compose ... logs --tail=50`).

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
