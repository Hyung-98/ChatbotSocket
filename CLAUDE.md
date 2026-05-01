# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server on port 3100
npm run build        # Production build
npm run lint         # ESLint

npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:push      # Apply schema to DB without migration history
npm run db:migrate   # Create and apply a named migration
npm run db:studio    # Open Prisma Studio GUI
```

> **Windows note:** `localhost` resolves to IPv6 (`::1`) on this machine but Postgres listens on IPv4. Always use `127.0.0.1` in `DATABASE_URL` (e.g. `postgresql://postgres:postgres@127.0.0.1:5432/ai_chatbot`).

## Architecture

Single Next.js 14 App Router application (no monorepo). All API logic lives in Route Handlers under `app/api/`.

**Data flow for chat:**
1. Client sends `POST /api/chat` with `{ conversationId?, message }`.
2. Route handler persists the user message to Postgres via Prisma, then calls the Claude API.
3. Claude streams tokens back via SSE (`StreamResponse` type). The route handler writes `data: {...}\n\n` chunks directly to a `ReadableStream`.
4. Client-side hook reads the stream and appends tokens to the UI incrementally.
5. On stream end, the assistant message is persisted.

**Key singletons:**
- [lib/prisma.ts](lib/prisma.ts) — singleton `PrismaClient` (cached on `globalThis` to survive hot-reloads)
- [lib/anthropic.ts](lib/anthropic.ts) — singleton `Anthropic` client; exports `CLAUDE_MODEL` and `DEFAULT_MAX_TOKENS` (4096). The model is currently `claude-sonnet-4-20250514` — update here to change the model globally.
- [lib/google.ts](lib/google.ts) — singleton `GoogleGenAI` client; exports `GEMINI_MODEL` (`gemini-3-flash-preview`) and `gemini` instance. Throws at module load if `GEMINI_API_KEY` is absent.
- [lib/auth.ts](lib/auth.ts) — NextAuth `authOptions` (Credentials + GitHub OAuth providers)

**Types** ([lib/types.ts](lib/types.ts)):
- `ChatMessage` — `{ role: 'user'|'assistant', content }` — the shape sent to the Claude API
- `StreamResponse` — `{ type: 'content'|'error'|'done', content?, error? }` — SSE payload format
- `Message` / `Conversation` — mirror the Prisma models for client-side use

## Database Schema

Six models in [prisma/schema.prisma](prisma/schema.prisma):

**App models:**
- `User` (cuid PK, email unique, optional `passwordHash` for credentials auth) → has many `Conversation`, `Account`, `Session`
- `Conversation` (title, optional `systemPrompt`, optional `userId` FK) → has many `Message`; indexed on `userId`, `createdAt`, `updatedAt`
- `Message` (conversationId FK, `Role` enum: USER/ASSISTANT/SYSTEM, text content); indexed on `conversationId` and `createdAt`

**NextAuth adapter models** (managed by NextAuth, do not modify manually):
- `Account` — OAuth provider accounts linked to a User
- `Session` — active sessions
- `VerificationToken` — email verification tokens

Cascade deletes: User → Conversation → Message. User → Account, Session.

## Environment Variables

Copy `.env.example` to `.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Claude API key (required at module load — see [lib/anthropic.ts](lib/anthropic.ts)) |
| `GEMINI_API_KEY` | Google Gemini API key (required at module load — see [lib/google.ts](lib/google.ts)) |
| `NEXTAUTH_SECRET` | NextAuth encryption key (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | App URL (local: `http://localhost:3100`, prod: Railway URL) |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID (for GitHub login) |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret (for GitHub login) |

## API Endpoints

- `GET /api/health` — health check; returns `{ status: 'ok' }` (used by Railway healthcheck)
- `POST /api/auth/signup` — register with email + password; returns `{ id, email }`
- `GET|POST /api/auth/[...nextauth]` — NextAuth session endpoints (login, logout, OAuth callback)
- `POST /api/chat` — send a message; returns SSE stream of `StreamResponse` chunks
- `GET /api/conversations` — list conversations (auth required)
- `POST /api/conversations` — create a conversation (auth required)
- `GET /api/conversations/:id` — fetch conversation + messages (auth required)
- `PATCH /api/conversations/:id` — update `title` or `systemPrompt` (auth required)
- `DELETE /api/conversations/:id` — delete conversation and its messages (auth required)

## Deployment

Production runs on **Railway** (railway.app).

- [railway.json](railway.json) — build target (`runner` stage of Dockerfile) and deploy config
- Environment variables are set in the Railway dashboard; `DATABASE_URL` and `PORT` are auto-injected by Railway
- DB migrations run automatically via `preDeployCommand: prisma migrate deploy` before each deploy
- CI/CD: GitHub Actions runs lint → build → pushes runner image to GHCR → triggers Railway deploy webhook on `main` push
- Add `RAILWAY_DEPLOY_WEBHOOK` to GitHub repo Secrets (Railway dashboard → Settings → Deploy Webhook)

**First-time Railway setup:**
1. Create project → add PostgreSQL plugin → connect GitHub repo
2. Set env vars in Railway dashboard (see `.env.example` for required keys; skip `DATABASE_URL` and `PORT`)
3. Add `RAILWAY_DEPLOY_WEBHOOK` secret to GitHub repo Settings → Secrets → Actions

## Styling

Tailwind CSS with the `cn()` helper ([lib/utils.ts](lib/utils.ts)) wrapping `clsx` + `tailwind-merge`. Global styles and the `.animate-pulse-slow` class (for streaming cursor) are in [app/globals.css](app/globals.css). Supports dark mode via `prefers-color-scheme`.
