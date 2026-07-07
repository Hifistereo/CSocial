# Getting Started

This walks through setting up CSocial locally, from a clean clone to a
running dev server with seeded demo data. See `README.md` for what the
product does and how the security model works.

## Prerequisites

- Node.js 20+ and npm
- No external services required for local dev — SQLite is used out of the
  box, and video metadata is fetched via YouTube's public oEmbed endpoint
  (no API key needed).

## 1. Install dependencies

```bash
npm install
```

This also runs `prisma generate` automatically (via the `postinstall`
script), which builds the Prisma client into `src/generated/prisma`.

## 2. Configure environment variables

```bash
cp .env.example .env
```

Then edit `.env` and set `SESSION_SECRET` to a random 32+ byte hex value:

```bash
openssl rand -hex 32
```

`DATABASE_URL` already defaults to a local SQLite file
(`file:./prisma/dev.db`) and needs no changes for dev. `YOUTUBE_API_KEY`
is optional — it only enables fetching video durations; everything else
works without it.

## 3. Create and seed the database

```bash
npm run db:push    # applies prisma/schema.prisma to prisma/dev.db
npm run db:seed    # creates demo families + a curated video catalog
```

If you need to start over at any point:

```bash
npm run db:reset    # deletes the SQLite file, re-pushes schema, reseeds
```

## 4. Run the dev server

```bash
npm run dev
```

Visit `http://localhost:3000`.

### Demo accounts

| Role   | Email                  | Password      | PIN  |
|--------|-------------------------|---------------|------|
| Parent | `parent@demo.family`    | `password123` | 1234 |
| Parent | `parent2@demo.family`   | `password123` | 1234 |

The first family has two seeded child profiles: **Spark** (age 4–6) and
**Nova** (age 10–12). Log in as a parent to see the dashboard, or use the
profile picker to enter kid mode as a child (no password needed once a
parent has unlocked the device).

## 5. Verify your setup

```bash
npm test                        # Vitest suite; authorization-leak tests are the acceptance gate
npm run lint
```

Optional end-to-end smoke tests (require `npm run dev` running in another
terminal — these drive a real headless browser via Playwright):

```bash
node scripts/smoke-parent.mjs
node scripts/smoke-child.mjs
```

## Finding your way around

- `src/app/(parent)` — parent dashboard: add/approve/reject videos, manage
  child profiles, view activity
- `src/app/(child)` — the full-screen swipe feed children see
- `src/app/(family)` — shared-device profile picker
- `src/app/(public)` — marketing/privacy pages, no auth required
- `src/app/api` — API routes, gated by `src/proxy.ts` based on path prefix
- `src/lib/authz.ts` — the auth guard every handler calls first
- `src/lib/feed.ts` — the single query path that serves content to children
- `src/lib/services/` — business logic; parent actions (approve, reject,
  revoke, profile edits) write an `AuditLog` row in the same transaction
- `prisma/schema.prisma` / `prisma/seed.ts` — data model and demo data
- `tests/feed-leak.test.ts`, `tests/authz-boundary.test.ts` — tests that
  specifically check a child session can never reach parent-only data

## A note on Next.js

`AGENTS.md` (linked from `CLAUDE.md`) flags that this project pins a
version of Next.js with breaking changes relative to older training data —
check `node_modules/next/dist/docs/` before writing new framework code.

## Troubleshooting

- **Prisma client errors after pulling new changes**: re-run
  `npm install` (or `npx prisma generate` directly) so the generated
  client in `src/generated/prisma` matches `prisma/schema.prisma`.
- **Login fails after `db:push` without seeding**: the schema exists but
  there's no data yet — run `npm run db:seed`.
- **Smoke scripts fail to connect**: make sure `npm run dev` is running
  in a separate terminal first; the smoke scripts drive a real browser
  against `http://localhost:3000`.
