# Ryvl - seller market intelligence

## Repo layout

Git root is `D:\Market-Intel`. It holds several packages; only two are live:

| Path | What it is |
|---|---|
| `app/` | **The app.** Next.js 15 App Router + Supabase. Own `package.json`/lockfile. |
| `scraper/` | Separate npm package. Scrapes marketplaces on a cron, writes with a service-role key. |
| `scraper/migrations/` | **All SQL migrations live here**, including the app's own tables. Not under the app dir. |
| `.github/workflows/` | CI **and all cron triggers**, at the **repo root** - not inside the app package. The only path GitHub reads. |
| `docs/` | Everything that isn't code. `docs/README.md` indexes it. |
| `vendor/tailadmin-dashboard/`, `vendor/agency-landing-template/` | Vendor templates kept for reference. Not built or deployed, and nothing imports from them. |

Most work happens in `app/`. Run npm commands from there, not the root.

## Commands

```bash
cd app
npx tsc --noEmit        # typecheck
npm run lint            # next lint (deprecated upstream; one known <img> warning is expected)
npm run test            # vitest run
npm run build           # needs the two env vars below
```

`next build` needs Supabase env vars present but not real:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder npm run build
```

If the build ever starts needing real credentials, that's the bug.

## The verification bar

Before calling anything done: **typecheck, lint, tests, and a real `next build`** — all four. CI runs exactly these.

The build is not optional. It is the only step that catches Server/Client component boundary errors, and it has caught them here: importing raw Chakra components into a `loading.tsx` (a Server Component by default) crashes prerendering with `d.createContext is not a function`, while tsc, lint and 390 tests all pass.

## Conventions

**Pages are Server Components.** The established shape, applied across `/dashboard/*` and `/apps/*`:

- `page.tsx` — async Server Component, resolves the seller and fetches data
- `SomethingView.tsx` — `'use client'`, pure rendering, takes data as props
- `loading.tsx` — route-level skeleton matching what the page used to show inline

No page fetches its own data from the client. After a client mutation, call `router.refresh()` — there is no `refetch()` to reach for. The shell's data (`domains`, `notifications`, `planTier`) is resolved once in the layout via `getShellData()`, not per-widget.

**Data access lives in `lib/market-intel/seller/*`, and throws on error.** Route handlers are thin wrappers that catch and shape the response. Don't return raw Postgres errors — `apiError(err, message, status, scope)` logs the detail and returns a safe summary.

**Request bodies go through `parseJsonBody(request, Schema)`** (`lib/api-validation.ts`). Use `blankToNull()` for fields the UI sends as `''` to mean "not set". Zod validation messages are user-facing and deliberately preserved; internal errors are not.

**Errors report through `reportError()`** (`lib/observability/report-error.ts`). There's no Sentry yet — that's the seam it plugs into.

## Gotchas

- **`'server-only';` as a bare string is a no-op.** The package isn't installed. Most lib files use it as a marker; it enforces nothing. `import 'server-only'` (real form) breaks vitest.
- **`strictNullChecks` is on.** Turned on deliberately; don't turn it off to make an error go away.
- **Ownership is checked in app code, not just RLS.** RLS policies exist and hold, but seller-scoped queries state the rule too — one dropped policy shouldn't mean cross-tenant access.
- **Windows/Git Bash:** paths written to `/tmp` in a Bash call are not visible to Python invoked from the same shell. Use the session scratchpad dir instead.

## Context docs

At the repo root, because they're consulted constantly and cited by name from code comments and migration headers:

- `ROADMAP.md` — **source of truth for what gets built next**
- `FEATURES.md` — what exists today
- `SECURITY.md` — open findings + required deploy steps
- `SCRAPING.md` — scraping compliance policy. Read before adding a source; a robots.txt violation has already shipped once

Under `docs/` (indexed by `docs/README.md`):

- `docs/memory.md` — dated engineering log; **why** the code is the way it is. Check here before "fixing" something that looks odd
- `docs/mind.md` — what's live vs. what needs migrations applied manually
- `docs/architecture/MIGRATION_PLAN.md` — the in-progress Chakra→Tailwind migration
- `docs/audits/leaks.md` — numbered security findings; code cites them as "leaks.md finding #N"
- `docs/history/` — **superseded. Do not plan against it.**

Two read-only checkers worth knowing: `scraper/migrations/_check_applied.sql` (which migrations are live) and `_check_coverage.sql` (which categories actually have scraped data).
