# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server on port 3000
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

**Types** ([lib/types.ts](lib/types.ts)):
- `ChatMessage` — `{ role: 'user'|'assistant', content }` — the shape sent to the Claude API
- `StreamResponse` — `{ type: 'content'|'error'|'done', content?, error? }` — SSE payload format
- `Message` / `Conversation` — mirror the Prisma models for client-side use

## Database Schema

Three models in [prisma/schema.prisma](prisma/schema.prisma):
- `User` (cuid PK, email unique) → has many `Conversation`
- `Conversation` (title, userId FK) → has many `Message`; indexed on `userId` and `createdAt`
- `Message` (conversationId FK, `Role` enum: USER/ASSISTANT/SYSTEM, text content); indexed on `conversationId` and `createdAt`

Cascade deletes: deleting a User deletes its Conversations; deleting a Conversation deletes its Messages.

## Environment Variables

Copy `.env.example` to `.env`:

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | Claude API key (required at module load — see [lib/anthropic.ts](lib/anthropic.ts)) |
| `NEXTAUTH_SECRET` | NextAuth encryption key (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | App URL (default `http://localhost:3000`) |

## API Endpoints

- `POST /api/chat` — send a message; returns SSE stream of `StreamResponse` chunks
- `GET /api/conversations` — list conversations
- `POST /api/conversations` — create a conversation
- `DELETE /api/conversations/:id` — delete a conversation

## Styling

Tailwind CSS with the `cn()` helper ([lib/utils.ts](lib/utils.ts)) wrapping `clsx` + `tailwind-merge`. Global styles and the `.animate-pulse-slow` class (for streaming cursor) are in [app/globals.css](app/globals.css). Supports dark mode via `prefers-color-scheme`.
