# syntax=docker/dockerfile:1.7
# =============================================================================
# Multi-stage build for @peaku/auth-service
# Context: repo root (monorepo) — required so we can resolve workspace packages.
# =============================================================================

# --- builder ----------------------------------------------------------------
FROM node:22.22.3-bookworm-slim AS builder
WORKDIR /repo

# Instalamos pnpm directamente con npm en vez de corepack.
# Las signing keys built-in de corepack en Node 22.x quedaron desactualizadas
# (issue nodejs/corepack#612 y similares), causando fallos de verificación de
# firma al hacer `corepack prepare pnpm@<ver> --activate`. npm i -g evita
# el problema y es reproducible.
RUN npm install -g pnpm@11.1.3

# Copy workspace manifests + .npmrc (better caching + apply security flags)
# Copiamos TODOS los package.json del workspace (no sólo el del servicio que
# se buildea). pnpm-workspace.yaml declara apps/* y libs/*, y --frozen-lockfile
# falla si pnpm no puede resolver el grafo completo contra el lockfile.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .npmrc ./
COPY libs/shared/package.json ./libs/shared/
COPY apps/auth-service/package.json ./apps/auth-service/
COPY apps/products-service/package.json ./apps/products-service/
COPY apps/api-gateway/package.json ./apps/api-gateway/

# Restringimos la instalación al grafo de auth-service + sus deps workspace.
RUN pnpm install --frozen-lockfile --filter "@peaku/auth-service..."

# Source del servicio + lib compartida
COPY libs/shared ./libs/shared
COPY apps/auth-service ./apps/auth-service

# Buildeamos primero la lib y después el servicio, luego prune dev deps.
# `deploy --legacy`: pnpm 10+ requiere inject-workspace-packages para deploy
# con symlinks. Usamos --legacy para mantener el comportamiento clásico
# (deploy resuelve symlinks copiando los archivos al output).
RUN pnpm --filter @peaku/shared run build \
 && pnpm --filter @peaku/auth-service build \
 && pnpm --filter @peaku/auth-service deploy --legacy --prod /out

# --- runtime ----------------------------------------------------------------
FROM node:22.22.3-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production

# La imagen oficial de Node ya provee un usuario no-root `node` (uid 1000).
# Lo reutilizamos en vez de crear uno nuevo — más simple y portable entre
# alpine/slim/distroless.
COPY --from=builder --chown=node:node /out/dist ./dist
COPY --from=builder --chown=node:node /out/node_modules ./node_modules
COPY --from=builder --chown=node:node /out/package.json ./package.json

USER node
EXPOSE 3001

# Healthcheck sin wget/curl (no vienen en bookworm-slim): usamos node fetch
# nativo (>= Node 22). Portable a alpine/slim/distroless.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
