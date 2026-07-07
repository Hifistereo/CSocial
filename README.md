# CSocial — parent-controlled safe video feed for kids

A TikTok-style short-video app for children (~4–12) where the child **only
ever sees videos a parent has added and approved**. No open search, no
comments, no DMs, no public profiles, no ads, no uploads. Videos are never
downloaded or rehosted — only metadata and the YouTube video ID are stored;
playback uses the official embed player on the privacy-enhanced
`youtube-nocookie.com` domain.

## How it works

1. The parent pastes a YouTube link on the dashboard → metadata is fetched
   (oEmbed, no API key) → the video lands in the **pending** queue.
2. The parent previews it, assigns a category + age group, and
   **approves / rejects** it. Approval can be **revoked** at any time — the
   video disappears from the child's feed instantly.
3. On a shared device the parent opens the Netflix-style profile picker; the
   child taps their profile (no password). The child's session is a scoped
   token that structurally cannot call any parent endpoint.
4. The child gets a full-screen swipe feed of approved videos, filtered by
   their age group and allowed categories — with favorites, an
   "ask parent for more like this" button, and an "I don't like this" report
   button (enum-only, no free text anywhere in the child UI).
5. Leaving kid mode requires the parent PIN.

## Stack

- **Next.js 16** (App Router) + TypeScript + Tailwind 4 — one deployable for
  parent dashboard, child feed, and API
- **Prisma 7** + SQLite (dev) / PostgreSQL-ready schema (prod: switch the
  datasource provider and use `@prisma/adapter-pg`)
- **jose** JWT sessions in a single httpOnly cookie with three scopes:
  `parent` (locked) / `parent_unlocked` (15-min PIN window) / `child`
- **Vitest** — 160 tests, led by an authorization-leak suite

## Security model (three enforced layers)

1. `src/proxy.ts` — path-prefix gating: `/api/child/*` requires child scope,
   `/api/parent/*` + `/dashboard` require an unlocked parent, unknown
   `/api/*` is denied by default. New routes are protected by directory
   placement, not per-route memory.
2. `src/lib/authz.ts` — every handler's first line is a guard that re-verifies
   the cookie and checks `tokenVersion` against the DB.
3. `src/lib/feed.ts` — the only query path serving content to children, with
   `status: "APPROVED"` and the family binding hard-coded.

Child endpoints take **zero identity parameters** — child and family IDs come
only from the verified token. Every approve/reject/revoke/profile change
writes an `AuditLog` row in the same transaction (`src/lib/services/`).

## Development

```bash
npm install               # runs prisma generate via postinstall
cp .env.example .env      # set SESSION_SECRET (openssl rand -hex 32)
npm run db:push           # create the SQLite schema
npm run db:seed           # demo families + curated catalog
npm run dev
```

Demo accounts (seed): `parent@demo.family` / `password123`, PIN `1234`
(children Spark 4–6, Nova 10–12) and `parent2@demo.family` (same password).

```bash
npm test                  # full suite; the leak tests are the acceptance gate
npm run lint
node scripts/smoke-parent.mjs   # Playwright browser smoke (needs `npm run dev`)
node scripts/smoke-child.mjs
```

## Privacy

Data minimization by design: a child is a nickname + age band, nothing else.
Watch history is auto-purged after a configurable retention window (90 days
default). Account deletion removes every row belonging to the family. See
`/privacy` in the app for the plain-language notice.

## Deploying for a pilot

1. Provision PostgreSQL; set `DATABASE_URL`, switch `provider` in
   `prisma/schema.prisma` to `postgresql`, install `@prisma/adapter-pg` and
   swap the adapter in `src/lib/db.ts`.
2. Set a strong `SESSION_SECRET`. Optionally set `YOUTUBE_API_KEY` to enable
   video durations.
3. `npm run build && npm start` behind HTTPS (the session cookie is
   `Secure` in production). Security headers/CSP ship in `next.config.ts`.
