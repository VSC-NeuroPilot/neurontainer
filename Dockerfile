# Stage 1: Build all workspace packages
FROM node:22 AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/
RUN corepack enable pnpm && pnpm install --frozen-lockfile
COPY frontend/ ./frontend/
COPY backend/ ./backend/
RUN pnpm --filter ui build && pnpm --filter vm build

# Stage 2: Final runtime image
FROM node:22-alpine
LABEL org.opencontainers.image.title="neurontainer" \
    org.opencontainers.image.description="Docker Desktop extension for Neuro-sama Docker control" \
    org.opencontainers.image.vendor="neurontainer" \
    com.docker.desktop.extension.api.version="0.3.4" \
    com.docker.extension.screenshots="" \
    com.docker.extension.detailed-description="" \
    com.docker.extension.publisher-url="" \
    com.docker.extension.additional-urls="" \
    com.docker.extension.categories="" \
    com.docker.extension.changelog=""

WORKDIR /app

# Copy backend build
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/package.json ./backend/
COPY --from=builder /app/backend/node_modules ./backend/node_modules

# Copy frontend build to ui directory (required by Docker Desktop)
COPY --from=builder /app/frontend/dist ./ui

# Copy metadata
COPY metadata.json .
COPY docker.svg .

WORKDIR /app/backend

CMD ["node", "dist/index.js"]
