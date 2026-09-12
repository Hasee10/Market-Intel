# Ryvl — seller market intelligence

Competitive pricing, competitor tracking and demand signals for Pakistani
e-commerce sellers. A seller connects their catalog and sees where they sit
against the market: who undercuts them, on what, and what to do about it.

**This runs.** It is a deployed Next.js 15 app plus a scraper that runs on a
cron. It is not an archive or a prototype.

> Previously this file described the repo as a non-running archive extracted
> out of a job board ("JobLo"). That was true in July 2026 and has been wrong
> for months. If you are looking for that history it is in
> [`docs/history/`](docs/history/).

---

## Repo layout

Two packages are live. Everything else is reference material.

| Path | What it is |
|---|---|
| **`app/`** | **The app.** Next.js 15 App Router + Supabase. Own `package.json` and lockfile. Most work happens here. |
| **`scraper/`** | Separate npm package. Scrapes marketplaces on a cron, writes with a service-role key. |
| `scraper/migrations/` | **All SQL migrations live here** — including the app's own tables, not just the scraper's. |
| `.github/workflows/` | CI and all cron triggers. At the **repo root**, not inside the app package. |
| `docs/` | Everything that isn't code. See [`docs/README.md`](docs/README.md). |
| `assets/landing-page/`, `assets/brand/` | Brand and landing-page source assets. See [`docs/ASSETS.md`](docs/ASSETS.md). |
| `vendor/agency-landing-template/`, `vendor/tailadmin-dashboard/` | Vendor UI templates kept as visual reference. **Not built, not deployed, not imported.** |

The two vendor template directories are the most common source of confusion
here: they are third-party downloads the live UI was modelled on. Nothing in
`app/` imports from them.

## Getting started

```bash
cd app
npm install
npm run dev
```

You need a `.env.local` with Supabase credentials. `next build` needs the two
public vars present but they do not have to be real:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co \
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder npm run build
```

If the build ever starts needing *real* credentials, that is a bug.

## The verification bar

Before calling anything done — **all four**, from
`app/`:

```bash
npx tsc --noEmit        # typecheck
npm run lint            # one known <img> warning is expected
npm run test            # vitest
npm run build           # see env vars above
```

CI runs exactly these. **The build is not optional**: it is the only step
that catches Server/Client component boundary errors, and it has caught real
ones here that `tsc`, lint and the full test suite all passed.

## How the app is put together

- **Pages are Server Components.** The established shape across
  `/dashboard/*` and `/apps/*` is `page.tsx` (async, resolves the seller and
  fetches) → `SomethingView.tsx` (`'use client'`, pure rendering, takes data
  as props) → `loading.tsx` (route-level skeleton). No page fetches its own
  data from the client; after a mutation, call `router.refresh()`.
- **Data access lives in `src/lib/market-intel/`**, split into `core/`,
  `market/`, `seller/` and `jobs/`. These functions throw on error; route
  handlers are thin wrappers that catch and shape the response.
- **Migrations are applied by hand** via the Supabase SQL Editor. There is no
  migration tracking table — run
  [`scraper/migrations/_check_applied.sql`](scraper/migrations/_check_applied.sql)
  (read-only) to see what is actually live.

`CLAUDE.md` has the fuller conventions and the known gotchas.

## Where to look next

| Question | File |
|---|---|
| What are we building next? | [`ROADMAP.md`](ROADMAP.md) — the source of truth |
| What exists today? | [`FEATURES.md`](FEATURES.md) |
| What is unfixed or must happen before deploy? | [`SECURITY.md`](SECURITY.md) |
| Is it legal/polite to scrape this site? | [`SCRAPING.md`](SCRAPING.md) — read before adding a source |
| Why is the code like this? | [`docs/memory.md`](docs/memory.md) — dated engineering log |
| Everything else | [`docs/README.md`](docs/README.md) |

## Known state, honestly

- **Data coverage is the binding constraint.** `ROADMAP.md` records 2 of 12
  seller categories having scraped rows; OLX, the only source for most of the
  rest, is disabled on a standing IP-level block. That figure predates the
  Daraz rollout — re-measure with
  [`scraper/migrations/_check_coverage.sql`](scraper/migrations/_check_coverage.sql)
  before planning against it.
- **There is no billing.** Plan tiers exist in `entitlements.ts` but demo mode
  unlocks everything and no checkout exists.
- The account naming `market_analyst` / `market_accounts` predates the
  seller-focused positioning and is due a rename.
