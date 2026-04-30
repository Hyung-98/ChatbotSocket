# ============================================================
# Stage 1: Install ALL dependencies (including devDependencies)
# ============================================================
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# ============================================================
# Stage 2: Build the Next.js application
# ============================================================
FROM node:20-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source files (includes prisma.config.ts, prisma/schema.prisma)
COPY . .

# Prisma 7: prisma.config.ts reads DATABASE_URL via env().
# A placeholder is sufficient for `prisma generate` (only reads schema, not DB).
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"

# Generate the Prisma client before building
RUN npm run db:generate

# lib/anthropic.ts and lib/google.ts throw at module load if API keys are absent.
# next build statically analyzes routes and imports these files.
# Pass dummy build-time placeholders so the throw never fires.
# These values are NEVER used for actual API calls — real secrets come from K8s Secrets at runtime.
ENV ANTHROPIC_API_KEY="build-time-placeholder"
ENV GEMINI_API_KEY="build-time-placeholder"
ENV NEXTAUTH_SECRET="build-time-placeholder"
ENV NEXTAUTH_URL="http://localhost:3000"
ENV NODE_ENV="production"

RUN npm run build

# ============================================================
# Stage 3: Production runner (minimal image)
# ============================================================
FROM node:20-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

ENV NODE_ENV="production"
ENV HOSTNAME="0.0.0.0"

# Copy the Next.js standalone server output
COPY --from=builder /app/.next/standalone ./

# Static assets are not included in standalone — copy separately
COPY --from=builder /app/.next/static ./.next/static

# public/ directory (if it exists)
COPY --from=builder /app/public ./public

# Prisma CLI for pre-deploy migration (railway.json preDeployCommand).
# Docker COPY dereferences symlinks, so the .bin/prisma symlink must be recreated.
COPY --from=deps /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
RUN rm -f node_modules/.bin/prisma && \
    ln -sf ../prisma/build/index.js node_modules/.bin/prisma

# Set correct ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3100

# standalone server.js reads PORT from environment automatically
CMD ["node", "server.js"]

# ============================================================
# Stage 4: Migrator (standalone migration runner)
#
# Uses the full node_modules from the deps stage so that the Prisma 7 CLI
# and all its transitive dependencies (@prisma/dev, valibot, etc.) are available.
# On Railway, migrations are handled via railway.json preDeployCommand in the runner image.
# This stage is kept as a reference for alternative deployment environments.
# ============================================================
FROM node:20-alpine AS migrator

RUN apk add --no-cache libc6-compat

WORKDIR /app

# Full node_modules — required for Prisma CLI and prisma.config.ts execution
COPY --from=deps /app/node_modules ./node_modules

# Prisma schema, config, and migration files
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# package.json is referenced by prisma.config.ts tooling
COPY --from=builder /app/package.json ./package.json

# Docker COPY may resolve symlinks; ensure .bin/prisma stays a proper symlink
# so that __dirname resolves to node_modules/prisma/build/ where package.json lives.
RUN rm -f node_modules/.bin/prisma && \
    ln -sf ../prisma/build/index.js node_modules/.bin/prisma

# Security: non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs
RUN chown -R nextjs:nodejs /app

USER nextjs

CMD ["node_modules/.bin/prisma", "migrate", "deploy"]
