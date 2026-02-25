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
ENV PORT=3100
ENV HOSTNAME="0.0.0.0"

# Copy the Next.js standalone server output
COPY --from=builder /app/.next/standalone ./

# Static assets are not included in standalone — copy separately
COPY --from=builder /app/.next/static ./.next/static

# public/ directory (if it exists)
COPY --from=builder /app/public ./public

# Copy Prisma files needed by the init container (prisma migrate deploy)
# The runner CMD runs `node server.js`, but when used as a K8s init container
# the CMD is overridden to `npx prisma migrate deploy`.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Copy the Prisma CLI and engines from builder so `npx prisma` works in init container
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Set correct ownership
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3100

# standalone server.js reads PORT from environment automatically
CMD ["node", "server.js"]
