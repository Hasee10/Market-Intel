# Ryvl / Market-Intel — session memory

Keep this file accurate and current. It exists so a fresh Claude session
(no prior conversation context) can read one file and understand the real
state of this project, not just its stated architecture. Update it whenever
something material changes: a shipped feature, a diagnosed root cause, an
open item resolved or newly found, a wrong claim corrected. Prefer editing
this file over letting the conversation be the only record.

## What this project is

Ryvl: a market-intelligence dashboard for online sellers (Pakistan-focused
retail). A daily scraper watches competitor storefronts, the seller's own
store data (orders/products/customers) syncs in, and the app turns the
comparison into plain-English, rule-based insights - deliberately not
AI-guessed. Target users are largely non-technical retailers.

Two packages in one repo:
- `horizon-ui-chakra-nextjs-main/` - Next.js 15 + React 19 + TypeScript app.
  Chakra UI, Supabase (Postgres + RLS + auth), ApexCharts, Vitest, Vercel.
- `scraper/` - Node/TS scraper (`got-scraping`, `cheerio`, `playwright-core`
  + `cloakbrowser`), run via GitHub Actions, writes into the same Supabase DB.

AI touches only: seller assistant chat, marketing chat widget, category
auto-suggest, report narration - all via Groq (`gpt-oss-20b`,
`lib/ai/groq-client.ts`). Everything else (insights, stats, pricing
recommendations, anomaly detection) is rule-based math on real numbers, by
deliberate design choice - do not casually "improve" this with an LLM call
without checking whether that tradeoff was intentional first.

## Current scraper state (as of 2026-08-30/31)

- **56 configured sources**: 53 plain-HTTP + 3 browser-automation
  (iShopping, Goto, Daraz via CloakBrowser). OLX (classifieds) is
  **deliberately disabled** - GitHub runner IPs got a standing 429 block for
  weeks; the plumbing (`market_classified_*` tables, `ClassifiedSourceFn`)
  is left in place for a future source, `CLASSIFIED_SOURCES = []`. Do not
  re-enable without a different fetch origin.
- 45 of the 56 sources are single-brand storefronts built from two shared
  factories (`shopify-source.ts`, `woocommerce-source.ts`). **Only Daraz
  yields competitor seller identity** (`sellerExternalId`) - it is the sole
  source feeding the Competitors feature (scorecards, price index,
  assortment share). This is the real lever for "more competitor data," not
  source count.
- Runs via `.github/workflows/market-scraper.yml`, daily cron gated to an
  every-other-day cadence (epoch-day math, immune to calendar drift),
  `timeout-minutes: 360` (GitHub's hard platform max, cannot be raised).
  **Real measured runtime: 24-64 minutes** - roughly 5 hours of idle budget
  as of this writing, confirmed via `gh run list` on real run timestamps,
  not assumed.
- Other workflows that exist and are easy to miss: `review-scraper.yml`
  (daily, PriceOye reviews only) and `market-intel-cron.yml` (POSTs to
  `/api/cron/{benchmarks,price-alerts,low-stock,churn,fx-rates}` on various
  daily/6-hourly schedules). **Do not conclude a cron job is unscheduled
  just because `vercel.json` doesn't exist - check every `.github/workflows/*.yml`
  file first.** (I got this wrong once and had to correct `new_feature.md`.)

### 2026-08-30/31 scraper widening (commits `669b652`, `27db281`, `17cf3bd`)

Per-source page caps (`MAX_PAGES`) on the Shopify factory, WooCommerce
factory, and `shopperspk.ts` were raised 10 -> 30. Real run data showed
Habitt at 9,796/10,000 ceiling, autostorepk and shopperspk both near their
1,000/category ceiling - genuine truncation, not headroom. Daraz's cap
(15) was deliberately left alone: it returned 1,916 products with zero
errors, nowhere near its cap - the ceiling isn't what limits it.

Two migrations (**both must be applied manually in Supabase SQL Editor,
same as every migration 001+ in this repo - they do not self-apply**):
- `045_widen_undersized_collections.sql` - junaidjamshed (23->~4,000
  potential) and chasevalue (55->~4,000+ potential): both were configured
  with narrow sub-collections while the store's real top-level catalogue
  (`men-collections`/`women-collections`, `beauty-personal-care`/etc.) was
  never scraped.
- `046_widen_more_undersized_collections.sql` - same audit applied to
  bodybrics, activitysphere, mercurystationery, coffeecrest, wellpakistan,
  scafe, redberryroasters. wellpakistan was the worst case: 38 products
  scraped against a 65-product category (`male-sexual-wellness` - a
  standard pharmacy/wellness category, not adult content, given its own
  neutral segment label) that was simply never configured, out of 205
  non-empty collections on the site.
- **Both migrations have been applied by the user as of this writing.**
  The next natural cron run (not yet triggered on purpose) is the real
  proof; nothing has been verified live post-migration yet.

Every added collection handle was verified live against the real
`/collections/<handle>/products.json` (Shopify) or
`/wp-json/wc/store/v1/products?category=<slug>` (WooCommerce) endpoint
before being added - this repo's established convention (see migration
032's header). Never add a collection/category slug on the strength of
`/collections.json`'s listing alone; verify the products endpoint too.

**Ordering matters**: `scraper/src/db.ts`'s `saveProducts()` dedupes a
run's products by `external_id` with **last-collection-wins**. When a
broad and a narrow collection overlap (e.g. `women-collections` and
`womens-bags`), the broad one must be listed *first* in the env var so the
narrower, more precise category mapping survives the overwrite. This
ordering is documented inline in `market-scraper.yml` at each edited line
- preserve it if editing those lists again.

**sewmarkaz and ginnasticnutrition were checked and left alone** - both
small stores whose existing 4 configured collections already are the
store's largest available. Not every low-count source is under-configured;
some are just small stores at their real ceiling.

### stationarypk: unresolved, diagnosed not fixed

Returns 0 products - not a bad config. Live-verified: the endpoint is up,
all 4 configured slugs are valid, the category filter genuinely filters,
and the site responds in ~4.1s. But every single scraper request timed out
at the 30s `polite.ts` timeout, 100% failure rate, tripping the circuit
breaker. This is the same signature as the OLX block (GitHub runner IPs
silently blackholed, not rate-limited - no 429/403, just timeouts).
**Deliberately left unchanged** - editing slugs or the timeout would be
fixing something that isn't broken. Only one full run of data exists since
this source was added (2026-08-29); if the next natural cron run reproduces
the same 100%-timeout pattern, treat it like OLX (drop the source, leave
the plumbing) rather than retrying indefinitely.

## Anomaly detection: persistence gate (commit `2ef5e94`)

`horizon-ui-chakra-nextjs-main/src/lib/market-intel/anomalies.ts` - both
detectors (`detectOwnRevenueAnomalies` z-score, `detectCompetitorPriceAnomalies`
IQR) now require a flagged condition to hold across
`ANOMALY_CONFIRMATION_CYCLES` (= 2: today + one prior evaluation) before
surfacing, so a single glitchy scrape doesn't become an instant
user-facing alert. Underlying math is byte-identical to before - the gate
only filters *when* a flag surfaces, not the z-score/IQR calculation
itself. Full test coverage in `anomalies.test.ts` (11 cases), all passing.
Signatures/return types of both exported functions are unchanged, so every
caller (Overview, Market, Competitors, `api/anomalies/revenue`) needed zero
changes.

The competitor-anomaly gate's "confirmation" is an honest approximation,
not symmetric with the revenue gate: it re-validates against a
one-day-older baseline (a second `market_scope_price_baseline` RPC call),
which catches a bad/stale *baseline* row but can't catch a bad *current*
price reading, since there's only ever one live current-price observation
available. This is documented in the code comment - don't oversell it as
identical protection if touching this again.

## Robustness/feature roadmap: `new_feature.md`

Full audit-grounded roadmap lives at repo root (`new_feature.md`, commits
`edd89d5`, `698695c`). P0 items not yet started: real rate limiting
(current `lib/rate-limit.ts` is in-memory, provably broken across Vercel's
multi-instance serverless model), Sentry/error tracking (none exists),
Groq call timeout/retry (`groq-client.ts` has neither),
`DEMO_ALL_FEATURES_UNLOCKED = true` bypasses all entitlement gating
(intentional for now, flagged so it's not forgotten), zod schema
validation on API routes (currently manual `typeof` checks). Read that file
before proposing "what should we build next" - it's already been through
one research pass, don't redo it from scratch.

## Environment gotchas (Windows, this machine specifically)

- **The E: drive had real filesystem corruption** (`fsutil dirty query`
  showed dirty, `Get-Volume` showed `Full Repair Needed`) at least once
  this project's history - not just flaky `node_modules`. A user-run
  `chkdsk` fixed the filesystem layer, but **git's own object store still
  needed a separate repair** afterward (`git fetch origin --refetch` -
  non-destructive, re-downloads objects without assuming local ones exist;
  do NOT re-clone, since `.env.local` holding live Supabase/Groq keys is
  gitignored and would be lost). If `git commit`/`fsck` ever errors with
  `invalid object` or `object corrupt or missing`, this is the fix, not a
  reason to panic or re-clone.
- `core.autocrlf=true` is set globally - restored/checked-out files will
  show as `M` in `git status` even with zero content changes (verify with
  `git diff --ignore-cr-at-eol --stat`). This is normal, not corruption.
- No `package-lock.json` was tracked at the repo root historically; the app's
  real lockfile lives at `horizon-ui-chakra-nextjs-main/package-lock.json`
  and *is* tracked. An `npm install` run from the wrong directory can
  generate a bogus root-level stub lockfile (`"packages": {}`) - delete it,
  don't commit it.
- `npm ci` requires the lockfile to already exist; use `npm install` if
  it's missing. `esbuild`'s postinstall step has crashed with a Windows
  access-violation at least once (transient - retry the install).

## Working conventions established this session

- Migrations in `scraper/migrations/` **never self-apply** - always applied
  manually via Supabase SQL Editor, in numeric order. Always say this
  explicitly when a migration is added.
- Never propose a scraper config change (new collection/category slug, cap
  change) without live-verifying it against the real product endpoint
  first, and citing the actual numbers (not assumptions) in the commit
  message.
- Real production data (via `gh run list` / `gh run view --log`) beats
  assumptions every time - the original Phase 1 plan (raise Daraz's cap)
  was wrong until checked against actual run logs, which pointed at a
  completely different, more valuable fix instead.
- Commit messages: factual, "why" over "what," no filler - see recent log
  for the established voice. Only commit/push when explicitly asked; never
  batch unrelated changes into one commit.
- This user reacts badly to being told "I can't verify X" as a dead end -
  find the self-serve way to check (GitHub Actions logs via `gh`, live
  endpoint probes via `curl`, etc.) before reporting a limitation.
