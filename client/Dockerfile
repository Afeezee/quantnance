# ── Quantnance Frontend ─────────────────────────────────────────────────────
# Two-stage build: Node 22 Alpine (build) → Nginx Alpine (serve)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stage 1 — Build the React/Vite production bundle
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FROM node:22-alpine AS builder

WORKDIR /app

# Build-time secrets (baked into the JS bundle by Vite)
# VITE_API_URL is intentionally left empty — Nginx proxies /api/* to the backend
ARG VITE_CLERK_PUBLISHABLE_KEY
ENV VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY

# Install dependencies (separate layer for Docker cache)
COPY package*.json ./
RUN npm ci --prefer-offline

# Copy source and build
COPY . .
RUN npm run build

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Stage 2 — Serve the static bundle with Nginx
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FROM nginx:alpine

# Copy the compiled frontend from stage 1
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config as a template (uses ${BACKEND_URL} for envsubst at runtime)
COPY nginx.conf /etc/nginx/conf.d/default.conf.template

EXPOSE 8080

# At container start, substitute BACKEND_URL env var into the nginx config, then start nginx
CMD ["/bin/sh", "-c", "envsubst '$BACKEND_URL' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
