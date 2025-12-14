# Stage 1: Build all workspace packages
FROM node:22 AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN corepack enable pnpm && pnpm install --frozen-lockfile
COPY frontend/ ./frontend/
COPY backend/ ./backend/
RUN pnpm -r build

# Stage 2: Final runtime image
FROM node:22-alpine
LABEL org.opencontainers.image.title="neurontainer" \
    org.opencontainers.image.description="Docker Desktop extension for Neuro-sama Docker control" \
    org.opencontainers.image.vendor="VSC-NeuroPilot" \
    org.opencontainers.image.license="MIT" \
    org.opencontainers.image.source="https://github.com/VSC-NeuroPilot/neurontainer" \
    com.docker.desktop.extension.api.version="0.3.4" \
    com.docker.extension.screenshots="" \
    com.docker.extension.detailed-description="This container is a Docker Desktop extension that allows Neuro-sama to control the Docker daemon via the Engine API." \
    com.docker.extension.publisher-url="https://vsc-neuropilot.github.io/docs" \
    com.docker.extension.additional-urls="" \
    com.docker.extension.categories="" \
    com.docker.extension.changelog=""

# Copy metadata to root (required by Docker Desktop)
COPY metadata.json /metadata.json
COPY docker.svg /docker.svg
COPY docker-compose.yml /docker-compose.yml

# Copy frontend build to ui directory (required by Docker Desktop)
COPY --from=builder /app/frontend/dist /ui

# Copy backend
WORKDIR /app/backend
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/package.json ./
COPY --from=builder /app/backend/node_modules ./node_modules
# Copy pnpm store so linked deps (e.g., @hono/node-server) are available at runtime
COPY --from=builder /app/node_modules /app/node_modules

WORKDIR /
RUN ls -Ra /ui

EXPOSE 3000
CMD ["node", "app/backend/dist/index.js"]
