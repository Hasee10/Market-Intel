# mind.md — orientation for the next Claude session

**Read this first, then `ROADMAP.md` (the plan), `SECURITY.md` (deploy
blockers), `leaks.md` (original audit, historical).** This file exists so a
fresh session doesn't have to re-derive context that already cost real time
to build. It is a snapshot as of **2026-08-03** — verify anything
load-bearing against the live repo/DB before acting on it, per the memory
rules: a claim that a file/table/function exists is a claim about the past.

## What this product is

**Ryvl / Market Intel** sells market intelligence, not store management. The
scraped competitive market (7 Pakistani e-commerce retailers + OLX
classifieds + Daraz) is the product; a seller's own CRM data personalises it.
This is a settled decision, not open for re-litigation — see ROADMAP.md's
"The decision that drives everything below."

Two repos live in this one working directory:
- `horizon-ui-chakra-nextjs-main/` — the Next.js 15 / React 19 RC / Chakra UI
  seller-facing app (Horizon UI template as the base).
- `scraper/` — a standalone Node/TS scraper, cheerio for HTTP sources,
  CloakBrowser/playwright-core for browser sources, run by GitHub Actions
  cron (`.github/workflows/market-scraper.yml`, daily check, fires every 2
  days via `days_since_epoch % 2`).

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

As of 2026-08-03: **Phase A (A1–A5) complete, plus B, C1, C2, D1, D3.** Next
up: **C3** (strategic implications) and **C4** (trends/seasonality/risk).

## The thing that will bite you if you skip it: migrations are not self-applying

Every `scraper/migrations/0NN_*.sql` file must be run **manually**, in
order, via the Supabase SQL Editor. Nothing in CI or the app applies them.
**Verified directly against the live DB on 2026-08-03: migrations 019–022 are
NOT applied yet** — no `daraz` row in `market_platforms`, no
`market_category_map`, `seller_market_definitions`, or `market_competitors`
tables exist. Until someone runs them:
- Daraz never scrapes successfully (`Unknown platform slug "daraz"` on every
  attempt).
- Market Definition, category pricing, price trend, and Competitors pages all
  render their honest-empty states, not real numbers.

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

## Known live state as of 2026-08-03 (verify before relying on it)

- 5,651 real scraped products in `market_products` across 6 retailer
  platforms (priceoye, telemart, shophive, sapphireonline, ishopping, goto).
  This is genuine scraped data, confirmed via `scraper_runs`.
- **OLX has returned 0 products on every run for weeks.** Root cause was
  diagnosed (categories 403 silently, both layers swallowed the failure) and
  a fix was written (`scraper/src/sources/olx.ts`, `scraper/src/pipeline.ts`)
  but **not yet pushed** as of this writing — check `git log` before
  assuming it's deployed. The durable fix is D1/D4 (Daraz), not OLX itself.
- **Daraz has never successfully run.** Code is committed and pushed
  (`scraper/src/sources/daraz.ts`, wired into `HTTP_SOURCES`), but migration
  019 isn't applied, so every attempt throws `Unknown platform slug "daraz"`
  before it can write anything. Zero rows for `daraz` exist in
  `scraper_runs`, ever.
- Only **2 of 12** seller categories (`mobiles-and-electronics`,
  `fashion-and-apparel`) have any retailer-marketplace coverage. The other
  ten depend entirely on OLX (currently dead) or Daraz (not yet applied).
  This is *why* C2's empty states matter — they tell the truth about 10/12
  categories instead of rendering zeroes as findings.

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
- **SQL functions are `SECURITY INVOKER`, always.** A `SECURITY DEFINER`
  function on `market_products`/`market_classified_listings` would let any
  authenticated caller read past RLS. Every migration since 021 states this
  explicitly in a comment; keep doing that.
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

As of 2026-08-03, `npm audit --audit-level=high` is clean on the app after
adding `"overrides"` to `package.json` for `postcss` (8.5.25) and `sharp`
(0.35.3) — both are pinned exactly by `next@15.5.x` itself, and
`npm audit fix --force` would have downgraded to `next@9.3.3`, which is not
a real fix. Re-check this override the next time Next.js is bumped; a future
release may make it redundant.

## Things to not do (from prior explicit correction)

- Don't present a list of scraped **category slugs** as if it were a list of
  new **sites**. There are 8 sources total (7 original + Daraz). Migrations
  like 020 are lookup tables over categories the existing scrapers already
  fetch — say that plainly, don't let a long list of slugs read as scope
  creep.
- Don't guess at a production root cause you can't observe. When `gh` isn't
  available to read Actions logs, make the failure self-reporting (record
  the real error to `scraper_runs`) rather than asserting a fix worked.
