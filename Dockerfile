# ============== Stage 1: Dependencies ==============
FROM node:20-alpine AS deps
WORKDIR /app

# Install build tools for native modules (argon2)
RUN apk add --no-cache python3 make g++

# Backend deps
COPY backend/package.json backend/package-lock.json* ./backend/
RUN cd backend && npm ci --omit=dev

# Frontend deps
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd frontend && npm ci --omit=dev

# ============== Stage 2: Builder ==============
FROM node:20-alpine AS builder
WORKDIR /app

# Copy deps
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/frontend/node_modules ./frontend/node_modules

# Copy source
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Generate Prisma client & build backend
RUN cd backend && npx prisma generate && npm run build

# Build frontend
RUN cd frontend && npm run build

# ============== Stage 3: Runner ==============
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser

# Copy built artifacts
COPY --from=builder --chown=appuser:nodejs /app/backend/dist ./backend/dist
COPY --from=builder --chown=appuser:nodejs /app/backend/node_modules ./backend/node_modules
COPY --from=builder --chown=appuser:nodejs /app/backend/prisma ./backend/prisma
COPY --from=builder --chown=appuser:nodejs /app/backend/package.json ./backend/package.json

COPY --from=builder --chown=appuser:nodejs /app/frontend/.next ./frontend/.next
COPY --from=builder --chown=appuser:nodejs /app/frontend/node_modules ./frontend/node_modules
COPY --from=builder --chown=appuser:nodejs /app/frontend/package.json ./frontend/package.json
COPY --from=builder --chown=appuser:nodejs /app/frontend/public ./frontend/public

USER appuser

EXPOSE 3000 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1
