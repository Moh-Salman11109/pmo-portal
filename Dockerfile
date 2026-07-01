# syntax=docker/dockerfile:1.7

# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 — deps: install node_modules from the lockfile (cached separately
# from source so code changes don't bust the dependency layer).
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 — build: compile the Vite SPA to /app/dist.
# No VITE_* build args are passed on purpose — configuration is injected at
# RUNTIME via /config.js (see docker/40-render-config.sh), so one image serves
# every environment. NODE_ENV=production trims dev-only behaviour.
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN node node_modules/vite/bin/vite.js build

# ─────────────────────────────────────────────────────────────────────────────
# Stage 3 — runtime: serve the static build with a non-root nginx on :8080.
# nginx-unprivileged runs as uid 101 and listens on 8080 out of the box.
# ─────────────────────────────────────────────────────────────────────────────
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# Server + SPA routing + security headers.
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

# Entrypoint hook: nginx's official image runs every /docker-entrypoint.d/*.sh
# before starting. This one renders /config.js from the container environment.
COPY docker/40-render-config.sh /docker-entrypoint.d/40-render-config.sh

# Static assets.
COPY --from=build /app/dist /usr/share/nginx/html

# The rendered /config.js must be writable at startup by the non-root user.
USER root
RUN chmod +x /docker-entrypoint.d/40-render-config.sh \
    && chown -R 101:101 /usr/share/nginx/html
USER 101

EXPOSE 8080

# Liveness: hit the lightweight /healthz endpoint defined in nginx.conf.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1:8080/healthz || exit 1
