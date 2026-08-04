# mind.md — orientation for the next Claude session

**Read this first, then `ROADMAP.md` (the plan), `SECURITY.md` (deploy
blockers), `leaks.md` (original audit, historical).** This file exists so a
fresh session doesn't have to re-derive context that already cost real time
to build. It is a snapshot as of **2026-08-04** — verify anything
load-bearing against the live repo/DB before acting on it, per the memory
rules: a claim that a file/table/function exists is a claim about the past.

## What this product is

**Ryvl / Market Intel** sells market intelligence, not store management. The
scraped competitive market (10 Pakistani e-commerce retailers + Daraz — OLX
was removed, see below) is the product; a seller's own CRM data personalises it.
This is a settled decision, not open for re-litigation — see ROADMAP.md's
"The decision that drives everything below."

Two repos live in this one working directory:
- `horizon-ui-chakra-nextjs-main/` — the Next.js 15 / React 19 RC / Chakra UI
  seller-facing app (Horizon UI template as the base).
- `scraper/` — a standalone Node/TS scraper, cheerio for HTTP sources,
  CloakBrowser/playwright-core for browser sources, run by GitHub Actions
  cron (`.github/workflows/market-scraper.yml`, daily check at 03:30 UTC,
  fires every 2 days via `days_since_epoch % 2`).

Sources as of 2026-08-04: priceoye, telemart, shophive, sapphireonline,
ishopping, goto, daraz, mega, naheed, vmart, shopperspk. **OLX was removed
entirely** (not just disabled) — it was getting 429-blocked on every category
on the CI runner IP; `scraper/src/sources/olx.ts` is deleted and `olx` is out
of `HTTP_SOURCES`. Don't reintroduce it without solving the blocking first.

Both share one Supabase Postgres project (`market_*` tables for scraped
data + `sellers`/`seller_*` for tenant data), RLS everywhere, `SECURITY
INVOKER` on every SQL function (never DEFINER — that would bypass RLS).

## Where the actual plan lives

`ROADMAP.md` is the single source of truth for what's next, phase by phase
(A–F), with a dated progress note at the bottom. **Read that note first** —
it says what's done and what's next as of the last update. Don't plan against
`new_implementation_doc.md` or `implementation_status.txt`; both are
superseded and describe a seller-ops-first product that was explicitly
rejected.

As of 2026-08-04: **Phase A (A1–A5) complete, plus B, C1, C2, D1, D3**, plus a
large amount of homepage/dashboard UI polish and a new opt-in seller
marketing showcase (migration 024) that wasn't a roadmap item. Next roadmap
item up: **C3** (strategic implications) and **C4** (trends/seasonality/risk)
— unstarted as of this snapshot.

## The thing that will bite you if you skip it: migrations are not self-applying

Every `scraper/migrations/0NN_*.sql` file must be run **manually**, in
order, via the Supabase SQL Editor. Nothing in CI or the app applies them.

**Migrations 018–024 are all confirmed applied as of 2026-08-04** (verified
directly against the live DB — `daraz`/`mega`/`naheed`/`vmart`/`shopperspk`
rows exist in `market_platforms`, `market_competitors` has rows, the
`seller_marketing_showcase` view and `top_market_brands()` RPC both resolve
without `PGRST205`). The "inert until applied" state described in the
2026-08-03 version of this file is **stale — don't repeat it.**

That said, migration **025 or later may exist and not be applied** by the
time you read this — always re-verify with the query below rather than
trusting this paragraph. Grep `scraper/migrations/` for the highest number,
then check whether that specific table/column exists live before assuming
anything past 024 is deployed.

**Before trusting any "is X live" claim from an old session, check the DB
directly** — don't take a roadmap "✅ Done" checkbox at face value, it means
the code was written and tested locally, not that it's deployed. See
"How to check what's actually live" below.

## How to check what's actually live

The Supabase MCP tools in this environment are usually connected to the
**wrong account** — `list_projects` returns unrelated projects, not this
one. Don't waste a turn on it before checking. Instead, hit the project's
REST API directly with the service-role key from
`horizon-ui-chakra-nextjs-main/.env.local` (never print the key itself —
read it into a shell var, use it, done):

```bash
export SUPA_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d= -f2- | tr -d '"\r')
export SUPA_KEY=$(grep SUPABASE_SERVICE_ROLE_KEY .env.local | cut -d= -f2- | tr -d '"\r')

# platforms currently registered
curl -s "$SUPA_URL/rest/v1/market_platforms?select=slug" -H "apikey: $SUPA_KEY" -H "Authorization: Bearer $SUPA_KEY"

# does a migration's table exist yet?
curl -s "$SUPA_URL/rest/v1/market_competitors?select=id&limit=1" -H "apikey: $SUPA_KEY" -H "Authorization: Bearer $SUPA_KEY"
# PGRST205 "Could not find the table" = migration not applied

# recent scraper activity (real column is run_at, not created_at)
curl -s "$SUPA_URL/rest/v1/scraper_runs?select=platform_slug,product_count,error,run_at&order=run_at.desc&limit=20" -H "apikey: $SUPA_KEY" -H "Authorization: Bearer $SUPA_KEY"
```

Also check `git status` and `git rev-list --left-right --count origin/main...HEAD`
before assuming code is deployed — a prior session's work can sit committed-
but-unpushed, or written-but-uncommitted, for a while. On 2026-08-03 this
happened: the OLX silent-zero fix and all of C1 (competitor entity) sat
uncommitted locally while the deployed scraper kept running the old code.

## Known live state as of 2026-08-04 (verify before relying on it)

- **Daraz is live and producing real data** — 2,160–3,720 products per run
  as of the last successful runs on 2026-08-03, confirmed via `scraper_runs`.
  The `Unknown platform slug "daraz"` failure mode is resolved; migration 019
  is applied.
- **OLX is fully removed from the pipeline** (see above), not just failing.
  Its last recorded runs before removal were 429-blocked on every category.
- **`mega`, `naheed`, `vmart`, `shopperspk` are registered
  (`market_platforms` has all 4 rows, migration 023 applied) and wired into
  `HTTP_SOURCES` in code, but as of this snapshot have ZERO rows in
  `scraper_runs` — they were pushed at 2026-08-03T17:04 PKT, after that
  day's last cron run (10:20 UTC), so no scheduled run has fired for them
  yet. **Unproven, not broken** — check `scraper_runs` for
  `platform_slug in (mega,naheed,vmart,shopperspk)` before assuming they
  work; if the next 03:30 UTC run still shows zero rows or errors for them,
  that's a real bug to chase, not a timing artifact.
- **New: seller marketing showcase (migration 024, unrelated to the C1–C4
  roadmap).** Sellers can opt in via `seller_public_profile.show_on_marketing_site`
  to appear on the public homepage's company slider. Zero sellers have opted
  in yet (checked live, empty result) — expected, this is brand new and
  there's no UI prompt driving adoption yet. `top_market_brands()` RPC works
  and returns real scraped brand data (Naviforce, Samsung, Xiaomi, etc.).
- Retailer-marketplace category coverage should now be broader than the
  "2 of 12" figure from 2026-08-03 (Daraz + 4 new retailers), but that
  hasn't been re-measured against all 12 seller categories — don't restate
  the old "2 of 12" number without rechecking `market_category_map`.

## Standing product/engineering decisions (don't re-litigate)

- **Market intelligence first.** Benchmarks lead with scraped-market data;
  peer benchmarks (needs 3+ opted-in sellers) are demoted to premium,
  labelled "as the network grows" — never sold as a day-one feature.
  Everything at the `paid` entitlement tier must render meaningfully for a
  brand-new seller with zero other customers on the platform.
- **Daraz was prioritised** despite being the hardest site to scrape (accept
  the engineering cost) — it's the only source naming the seller behind a
  listing, which is what makes the competitor entity (C1) possible at all.
- **Clerk integration stays deferred.** A1 in the roadmap was completed as a
  *deletion* (removing `BYPASS_AUTH`/`BYPASS_ENTITLEMENTS`), not as a Clerk
  migration.
- **UI ships with each roadmap item now**, not deferred wholesale to Phase F.
  This changed mid-project (2026-08-03) — earlier items may have thinner UI
  than later ones for this reason, that's expected, not a bug.
- **No dev auth/entitlement bypass exists anywhere.** `BYPASS_AUTH` and
  `BYPASS_ENTITLEMENTS` were deleted from every code path, not just disabled.
  To view a paid/premium screen locally, set `sellers.plan_tier` directly in
  Supabase — there is no checkout flow yet, that's how upgrades happen today.
- **Robots.txt compliance is load-bearing, not advisory.** Daraz specifically:
  do not add a keyword/search mode (the `/catalog/` path is disallowed), do
  not follow sellers to their shop pages (`/shop/*.htm` is disallowed). Both
  are noted inline in `daraz.ts` — read the comment before touching that file.
- **SQL functions are `SECURITY INVOKER`, always.** Views are a separate,
  pre-existing, narrower exception: `seller_public_profiles_view` (migration
  012) already uses view-owner (definer-like) semantics to expose a couple
  of controlled columns from the owner-only-RLS `seller_public_profile`
  table to authenticated peers. Migration 024's `seller_marketing_showcase`
  view **reuses that exact same established convention** for the public
  homepage (2 columns, opt-in rows only via `show_on_marketing_site`) — it
  is not a new precedent, just the second application of one. Don't extend
  this to functions (those stay invoker), and don't widen either view's
  column set without a similarly explicit, narrow, commented reason.
- **Aggregation lives in SQL, not JS**, since A4 (migration 021). Don't
  reintroduce a "pull every row into JS and sort" pattern for anything that
  touches `market_price_history` — it's the fastest-growing table in the
  schema (one row per product per scrape run, forever).

## Security posture

`SECURITY.md` is the living remediation status against `leaks.md` (the
original 2026-08-02 audit — left unedited as a historical record, don't
update it). Three required deploy steps are tracked at the top of
`SECURITY.md`: apply migrations 018–022, set the Supabase Auth password
policy (can't be done in code — the signup page calls
`supabase.auth.signUp()` directly from the browser), and confirm
`CRON_SECRET` is set in Vercel.

`CREDENTIALS.txt` at the repo root has live keys, is gitignored, is not
tracked, must never be committed or printed in full.

As of 2026-08-04, `npm audit --audit-level=high` is clean on the app after
adding `"overrides"` to `package.json` for `postcss` (8.5.25) and `sharp`
(0.35.3) — both are pinned exactly by `next@15.5.x` itself, and
`npm audit fix --force` would have downgraded to `next@9.3.3`, which is not
a real fix. Re-check this override the next time Next.js is bumped; a future
release may make it redundant. A later commit (`d0e3777`) ran a second
`npm audit fix` that only bumped `brace-expansion` (transitive, dev-only,
in-range) — it did not touch or duplicate the `overrides` block, no conflict.

## Open items that need attention (as of 2026-08-04)

- ~~`/api/assistant` has no rate limiting~~ — **fixed 2026-08-04**:
  `src/lib/rate-limit.ts`, an in-memory fixed-window limiter (12 req/min per
  IP, 429 past that), wired into the route. It's explicitly *not* the fix
  for the older "no rate limiting on auth endpoints" finding (that still
  needs a shared store like Upstash, since Vercel runs many instances that
  don't share this Map) — this is a much smaller bar for one non-auth route.
- ~~`NEXT_PUBLIC_LOGO_DEV_TOKEN`/`LOGO_DEV_SECRET_KEY` missing~~ — confirmed
  set in Vercel by the user on 2026-08-04. No longer a gap; logo sliders
  should render real logos in production, not just initials.
- **The 4 new retailer sources are unproven** (see "Known live state" above)
  — check `scraper_runs` for them after the next cron fire before assuming
  they work like the rest of `HTTP_SOURCES`.
- **Migration numbering: verify the current tip.** This file says 018–024
  are applied as of 2026-08-04; a fresh session must re-check for anything
  past 024 before trusting that. **Migration 025 (`report_snapshots`,
  `report_reviews`, `report_exports`) exists but is confirmed NOT applied**
  as of this same date — see the next item.
- **Report generation v2 was rebuilt from scratch on 2026-08-04** — read
  `docs/reports-v2-architecture.md` before touching anything under
  `lib/reports/`. Short version: PPTX/PDF now both render from one typed
  `ReportSnapshot` (`lib/reports/schema.ts`), generated dynamically per
  seller (no fixed slide count, no flattened chart images — `pptxgenjs`
  builds the whole deck from code, no template file). Phases 0-4 and 7 of
  that doc's plan are done and merged; Phases 5 (internal review API) and 6
  (seller-facing reports list UI) are not. **Migration 025 must be applied
  before report history/persistence actually works** — until then,
  `/api/reports/generate` still works for a seller's own download (fails
  soft, logs the persistence error) but nothing is saved anywhere.

## Things to not do (from prior explicit correction)

- Don't present a list of scraped **category slugs** as if it were a list of
  new **sites**. There are 11 sources total as of 2026-08-04 (10 retailers +
  Daraz — check the top of this file for the current list; OLX was removed).
  Migrations like 020 are lookup tables over categories the existing
  scrapers already fetch — say that plainly, don't let a long list of slugs
  read as scope creep.
- Don't guess at a production root cause you can't observe. When `gh` isn't
  available to read Actions logs, make the failure self-reporting (record
  the real error to `scraper_runs`) rather than asserting a fix worked.
