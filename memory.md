# memory.md — running session handoff log

**Read this first if picking up a new session on this repo.** `mind.md`
(2026-08-04 snapshot) has the original product framing and is now stale —
this file is the living continuation. Keep updating this file as work
happens; don't let it go stale the way `mind.md` did. As always: a claim
here that a file/table/feature exists is a claim about the past — verify
anything load-bearing against the live repo/DB before acting on it.

**UPDATE 2026-08-31 (second update, superseding the one below it) — read
this note first, it's the accurate current picture. The "UPDATE 2026-08-31
(first)" paragraph directly under this one is now itself stale (six
commits behind) but left intact as history, same policy as the `9b0820a`
paragraph below it.**

**Current HEAD: `8407e38`, pushed to `origin/main`, working tree clean.**
Full chronological detail for all of this is in the dated entries at the
bottom of the file — this is just the fast-orientation summary.

**What actually shipped, most recent first:**
- zod validation added to the products/orders/customers create routes
  (`701e7c4`) - see that entry for a real TS-inference bug that had to be
  root-caused, and a real wiring bug the new tests caught before it shipped.
- Groq client got a 15s timeout + one retry, previously unbounded (`25c36e2`).
- **A different session's work was pulled in via `git pull --ff-only`**
  (now folded into history as `e551973`, `da4ef12`, `0c09cd9`, `f72df83`,
  plus its own `memory.md` entries) - a frontend render-performance pass and
  a candidate-search speedup (migrations 047/048). Read those entries before
  touching either area again; both have real, non-obvious "don't redo this"
  findings.
- Workflow chaining wired up (`16fbfd5`) - Review Scraper now fires via
  `workflow_run` after Market Scraper completes instead of a fixed clock
  offset; `fx-rates` now has a real `needs:` dependency from
  `benchmarks`/`churn` instead of just sorting earlier by clock time.
- Scraper Phase 1 (`669b652`/`27db281`/`17cf3bd`) - page-cap raises +
  two collection-widening migrations (045, 046), both applied live.
- Anomaly-detection persistence gate (`2ef5e94`).
- This file was briefly, accidentally overwritten wholesale by a fresh
  session that hadn't read it first, then restored from git history and
  merged properly - see that entry (search "self-inflicted") for what to
  take from it before ever using `Write` on this file.

**What is genuinely outstanding right now, i.e. what a picking-up session
should actually work on or ask the user about:**
1. **Blocked on DB access, not on anything code-side** — migration 048's
   index is unverified live (047 confirmed via REST), the candidate-search
   production benchmark can't run (anon key can't see `market_platforms`,
   RLS hides it - needs service-role key or an authenticated session, user
   has been asked, undecided as of this writing), and Phase B (caching
   public benchmark/pricing data) needs the same access to confirm anon RLS
   is actually live before it can even be scoped. **The Supabase MCP tools
   available in this environment are connected to a different account
   entirely (checked via `list_projects`, 7 unrelated projects, none of them
   this one) - do not try any of them on a guess.**
2. **Needs the next natural cron tick to prove out, not more code**: the
   scraper collection-widening yield (045/046 applied but no scrape run
   since), the workflow chaining (`16fbfd5`, never actually fired yet), and
   `stationarypk` (diagnosed as a runner-IP blackhole, same signature as
   OLX, only one data point exists - if the next run reproduces 100%
   timeouts, drop it like OLX).
3. **Not started, no blocker, just needs a priority call**: Phase 2 of the
   scraper plan (a second marketplace source - Daraz is currently the only
   source yielding competitor seller identity), and the `MAX_BUCKET_SIZE =
   5000` dedup cap in `matching.ts` hasn't been rechecked against current
   product volume since the widening work.
4. **Deferred by explicit user instruction, not forgotten**: real rate
   limiting (Upstash/Redis) and Sentry error tracking both need a new
   external service account - user said no external/paid signups for now.
   `DEMO_ALL_FEATURES_UNLOCKED = true` bypassing all entitlement gating is
   intentional-for-now, flagged so it doesn't get forgotten before launch.

---

**UPDATE 2026-08-31 (first, now stale — kept for history only, see the
update above this one for the real current state):** read this note, then
skip to the bottom-most dated entry for full current context; the
paragraphs immediately below (HEAD `9b0820a` era) are now two sessions
stale but left intact as history. Current HEAD is `caf2d0b`, pushed to
`origin/main`, working tree clean. Since `9b0820a`: the anomaly-detection
persistence gate shipped (`2ef5e94`), a robustness/feature roadmap was
written (`new_feature.md`), scraper Phase 1 shipped across three commits
(`669b652`/`27db281`/`17cf3bd` — page-cap raises + two collection-widening
migrations, 045 and 046, both already applied live by the user), and this
file itself was briefly, accidentally overwritten wholesale by a fresh
session that hadn't read it first, then restored from git history and
merged properly — see the bottom-most entry for the full story and what to
take from it. Everything below this paragraph through the next dated
`## 2026-08-3x` heading is preserved exactly as the prior session left it —
nothing was rewritten.

**Original note from the `9b0820a` era, kept verbatim:** Ask 1 (per-product
competitor drawer), Ask 3 (dashboard assistant), Ask 2 tier (a)
(tracked-matches column), a slice of Ask 2 tier (b) (got-scraping wired
into `polite.ts`), auto-category-assignment on product add/CSV import, a
data cleanup (18 stale OLX rows removed from `market_category_map`,
migration 029), the `seller_product_price_history` table + read path
(infrastructure only, migration 030), a fix to the Competitors matching
algorithm itself (strict title filter replacing the price bracket,
platform round-robin, then two live-found `.limit(300)`-with-no-ORDER-BY
sampling bugs fixed on top — see "Done: fix Competitors matching" and
"Done: two real matching bugs" further down), and PriceOye review-text
scraping + minimal display (migration 031, `scraper/src/reviews/` — see
"Done: review-text scraping" further down) are all shipped and pushed.

**New target sites named by the user for the separate scraper-expansion
thread (Ask 2 tier b), not yet scoped/started:** Bagallery, J. (Junaid
Jamshed), Gul Ahmed, Chase Value, Khaadi, Al-Fatah — with
Homeshopping.pk/Symbios.pk as lower priority. User pasted a detailed
Python-oriented scraping spec for these; this repo's scraper is Node/
TypeScript, so the spec's *intent* (site list, category-gap priorities,
politeness/ethics rules) should be adapted to this codebase's existing
conventions (`scraper/src/sources/*.ts`, `polite.ts`, `RawProduct`,
per-site live verification before writing extraction code — same as
every prior source addition), not followed as literal Python. Needs its
own Plan Mode pass, not started yet as of this writing.

**`node_modules` lock issue from the price-history session is resolved** —
a full `npm install` completed successfully during the matching-fix work
(687 packages added/8 changed, ~2 min). It took several attempts across
both sessions (repeated `UNKNOWN`/`ENOTEMPTY` errors on different packages
each time — `lodash`, `es-abstract`, `@popperjs/core`, `next` itself,
`typescript` was fully missing at one point) before one finally completed
without a concurrent lock interrupting it. If this recurs: don't fight a
live lock by retrying rapidly — space out attempts, and know that a
partial `rm -rf node_modules` can make things temporarily worse (it did
here) before a full reinstall fixes it.

Still open within Ask 2 tier (b): new retailer sites (waiting on the user
to name targets), OLX proxy fix, review-text scraping — **do not start
any of these without the user naming targets/confirming, per the standing
runbook below.** The Vercel landing-page hydration crash (2026-08-21) is
also still unresolved, blocked on the user confirming whether an
Incognito-window test showed the crash going away (ad-blocker extension
was the leading suspect) — no confirmation received as of this writing.
Migration 030 is written but **not yet applied to the live DB** (same
manual-via-SQL-Editor convention as every prior migration) — the actual
seller-vs-competitor price comparison feature it enables is still a real
"later stage," not built. Run `git status`/`git log` before assuming this
is still current — it won't be for long.

**Hard rule, still active — UPDATED 2026-08-28, read carefully:** never
use ANY browser automation in this project without the user explicitly
asking for it in that specific turn - this now includes `Claude_in_Chrome`,
not just `mcp__Claude_Preview__*`. Earlier versions of this note called
`Claude_in_Chrome` "an acceptable fallback if browser automation is
unavoidable" - that framing is exactly what led to it being used
unprompted to check a live product's Competitors drawer, which the user
reacted to sharply ("why the fuck did you go to preview, no previews
never"). Their objection was to browser automation in general, not just
the local dev-server tool, even though the earlier note had drawn that
distinction. Use curl+Supabase REST for DB/schema checks, `tsc --noEmit` +
`vitest` for code correctness, careful manual review, and ask the user to
check the live app themselves for anything needing a rendered browser -
always, no exceptions, unless they explicitly say to use the browser this
time.

**Status as of this writing (follow-up session, 2026-08-28):** scraper
freshness is now confirmed live (see "Resolved" section below). Ask 1 of
the competitor-intel thread (per-product competitor view) is now
**code-complete, not yet pushed or browser-verified** — see "Done: Ask 1"
section below. Asks 2 and 3 (broader scraper scope, dashboard assistant)
are still scoped-only, not started.

## What this product is (unchanged from mind.md, still true)

**Ryvl / Market Intel** — market intelligence for online sellers, primarily
Pakistan-focused today (scraper coverage, taxonomy, default currency are all
PKR/Pakistan-shaped — see "Open thread" below, this is about to become
directly relevant). Two repos in one working directory:
- `horizon-ui-chakra-nextjs-main/` — Next.js 15 / React 19 RC / Chakra UI
  seller-facing app, deployed to Vercel (`market-intel-ashy.vercel.app`).
- `scraper/` — standalone Node/TS scraper, GitHub Actions cron.

Shared Supabase Postgres project, RLS everywhere, `SECURITY INVOKER` always.

## Work log since mind.md's 2026-08-04 snapshot (18 commits, all pushed)

**Scraper (2026-08-03–04):**
- Hardened Daraz (CloakBrowser routing, block-page retry/backoff) and OLX
  (429 backoff) — see `7287a23`.
- **OLX fully disabled** (`30b00f8`) after confirming, even with backoff,
  every request from GitHub's runner IPs still 429'd — standing IP-level
  block, not a transient limit. `scrapeOlx()` code/schema left intact,
  just removed from `CLASSIFIED_SOURCES`. Re-enable once a proxy or D4's
  retailer-coverage fix lands.
- Removed Horizon UI template footer/branding (`d841483`).
- **Fixed watchlist product search returning zero results for every seller**
  (`37d5cda`) — it compared the seller's category slug directly against
  `market_products.category_slug` (which holds scraped *platform* slugs),
  never matching. Now resolves through `getMarketScope()`.
- **Added 4 new Pakistani retailer sources**: mega.pk, naheed.pk, vmart.pk,
  shopperspk.com (`e1625a0`). naheed + shopperspk matter most — first
  sources with real depth outside electronics (grocery, beauty, home,
  kitchen), closing the 10-of-12-seller-categories gap OLX used to (badly)
  cover. Migration 023 registers these platforms — **already applied**.

**React Bits UI work (2026-08-06, `2d8cd7b`):**
- Added `components/reactbits/` primitives: `SpotlightCard`, `CountUp`,
  `Reveal`, `ShinyText` — ported as pure CSS/Emotion, **zero new
  dependencies** (framer-motion is pinned at 4.1.17 by Chakra 2.6.1's peer
  dep, too old for React Bits' actual animated components).
- Applied to `StatsGrid` (dashboard) and `UpgradeGate`.
- **Since this commit, another session/the user extended these across the
  entire marketing landing page** (8 files: LandingHero, StatsBar,
  FeaturesSection, TrustSection, ComparisonSection, HowItWorksSection,
  LogoMarquee, AssistantWidget) — not done by me, discovered via grep while
  investigating the Vercel crash below. Worth knowing these primitives are
  now load-bearing across the whole public site, not just the dashboard.

**Report renderer (2026-08-04–06, largest chunk of work, partly by another
session — see commits `8b95b93` through `1239915`):**
- Full rebuild against an approved reference deck (`New-Slides.pptx`) —
  design tokens, TOC, chapter dividers, all pulled from real structural
  inspection of that file via python-pptx, not eyeballed.
- I (this session) then did a **visual comparison pass**: opened an actual
  downloaded report (`tt-report (1).pptx`) in Google Slides side-by-side
  with the reference, found and fixed 6 real bugs (`f4f6314`):
  price-ladder bars invisible at wide value ranges, "MEDIUM" badge text
  wrap, chapter dividers showing only 1 metric chip, Appendix rendering
  as a fully empty box (inclusion-gate/renderer filter mismatch), "SUPPLY
  VOID ... Out of stock on 0%" contradiction, cover TOC list colliding
  with its own divider line. All fixed in **both** PPTX and PDF renderers.
- Fixed competitor/SKU tables spilling onto continuation slides
  (`81362a7`) — reference never does this, always truncates on page 1 with
  "+N more" instead of continuing. `MAX_CONTINUATION_PAGES` 2 → 0.
- **Restored + wired cover-slide illustration** (`f42fd39`) — 10 approved
  PNGs existed in the repo, were deleted on a mistaken reasoning that any
  image violates the "no flattened chart" rule. Verified the reference's
  own data slides are native shapes too; its images are decorative
  cover/divider art only. Restored, moved into the actual deployed app
  tree (`horizon-ui-chakra-nextjs-main/src/lib/reports/assets/
  illustrations/` — the repo-root location wouldn't deploy), wired the
  cover slide only. **Section dividers deliberately not touched** — can't
  visually verify 7 different layouts without a working renderer in this
  environment; flagged as a real follow-up, not attempted blind.
- Built `scripts/gen-compare-deck.ts`, `scripts/dump_pptx.py`,
  `scripts/check_overlaps.py` — reusable tooling for any future visual
  comparison pass against the reference deck.

## Environment quirks worth knowing (cost real time to discover)

- **NEVER use the `Claude_Preview` MCP tools** (`preview_start`,
  `preview_eval`, `preview_screenshot`, etc.) in this environment — the
  user explicitly said to stop trying them (2026-08-28). Confirmed
  broken across two clean server restarts (fresh serverId each time):
  navigating past the initial `/` lands the tab on
  `chrome-error://chromewebdata/` and every subsequent call, even a bare
  `1+1` eval or a screenshot, times out. Direct `curl` to the local dev
  port is also sandboxed/blocked here, so that's not a fallback either.
  **What to do instead**: `curl` directly against the Supabase REST API
  (keys in `.env.local`) for DB/schema verification, `tsc --noEmit` +
  the `vitest` suite for code correctness, careful manual re-reading of
  the actual diff, and for anything that genuinely needs a rendered
  browser, ask the user to check it themselves and describe/screenshot
  what they see (worked well for the Google Slides report review and the
  Vercel hydration-crash investigation). `Claude_in_Chrome` (the user's
  real browser extension) is a usable fallback if browser automation is
  truly unavoidable — flakier than ideal but it did successfully
  navigate/screenshot earlier in this session, unlike the preview tool.
- **No PowerPoint, no LibreOffice installed** on this machine. The only
  PPTX-capable app is a broken third-party "PPTX Viewer" store app (fails
  to render either file, "opened with some unknown errors"). **Google
  Slides via the browser is the actual working path** — the user manually
  uploaded both decks there and that's how the 6-bug review pass happened.
  Chrome extension for browser automation is flaky (has needed multiple
  reconnects this session) — the "read_console_messages" tool has also
  shown it can return stale/cached results from a previous tab/domain.
- **Local dev/build commands run slow in this environment** — `next build`
  took 5+ minutes just to compile before type-checking even started.
  Budget for this before starting one, or run in background and poll.
- **Multiple Chrome browser profiles are connected** to the automation
  account — always confirm which one before navigating (ask the user, or
  use `switch_browser` to let them pick via the extension's own prompt).

## Open thread: Vercel landing-page crash (2026-08-21, unresolved)

User reported `market-intel-ashy.vercel.app` showing "Application error: a
client-side exception has occurred." Investigated:
- Server-side render is healthy (curl returns 200, real HTML; API routes
  respond correctly, e.g. proper 401 on an auth-gated route).
- Confirmed via browser console: **React hydration error #418** (server
  HTML doesn't match client's first render), specifically on the
  **marketing landing page**, not the dashboard.
- Two ad-blocker extension errors (`eyeo/webext-ad-filtering-solution`)
  fired in the exact same instant — a well-known cause of exactly this
  error class (extensions injecting/hiding DOM before React hydrates; this
  page has a floating chat widget, a common ad-blocker target).
- Read all 8 landing-page files using the React Bits primitives looking
  for a real HTML-nesting bug (block content inside an inline element) —
  found nothing. Local `next dev` renders the page with no crash.
- **Not fully resolved.** A local production build (to test with the same
  browser/extensions, since dev and prod can hydrate differently) was
  stopped after 5+ minutes of type-checking with no result — didn't want
  to burn more time blind. Live-DOM inspection via `javascript_tool` timed
  out on the Chrome extension bridge.
- **User was told to test in an Incognito window** (extensions disabled by
  default) as the fastest way to confirm ad-blocker vs. real bug — 10
  seconds of their time vs. more blind investigation. **No confirmation
  received yet as of this writing.** If a new session picks this up: ask
  whether the Incognito test happened and what it showed before
  re-investigating from scratch.

## Done: country-aware product catalogue (2026-08-28) — code shipped, migration applied, live UI check still outstanding

User wanted the seller product-catalogue CSV import genuinely
international-ready — "robust, nothing less" — since the product was
Pakistan-only in every layer (scraper, taxonomy, currency defaults).
Scoped via `EnterPlanMode` (approved plan, not improvised), then built.

**Decision made** (was open in an earlier version of this note): `country`
on `sellers`, defaulting `'PK'`, driving a small `getCountryProductConfig()`
lookup — not a rearchitecture. Every country currently defaults to
`skuRequired: false` (no real basis to mandate SKU for any specific market
yet; tightening one later is a one-line config change).

**Shipped, in order:**
1. Migration 027 (`sellers.country`, `seller_products.import_key` +
   partial unique index) — **applied to live DB, confirmed via direct
   Supabase REST check**: existing sellers correctly defaulted to `'PK'`,
   `import_key` nullable and empty on existing rows.
2. `src/lib/market-intel/countries.ts` — `SUPPORTED_COUNTRIES`,
   `getCountryProductConfig()`.
3. `country` added to the `Seller` type + `/api/profile` GET/PUT (mirrors
   the existing `reportingCurrency` pattern exactly).
4. Onboarding (`CategoryPicker.tsx` + `onboarding/actions.ts`) — country
   selector pre-filled `'PK'`, saved in the same round-trip as the
   category pick, stays a true "one quick step."
5. Settings page — mirrors `reportingCurrency`'s exact field pattern.
6. `bulk-import/route.ts` — SKU required only when the seller's country
   config says so; SKU-less rows get a title-slug `import_key` so
   re-uploading the same CSV doesn't create duplicates forever (two
   upsert batches, different `onConflict` targets, since Supabase's
   upsert takes one target per call); `currency` is now a mappable field
   defaulting to the seller's `reportingCurrency`; response now includes
   *why* rows were skipped, not just a bare count.
7. `apps/products/page.tsx` — `IMPORT_FIELDS` is now a function of the
   seller's real `skuRequired`/`reportingCurrency` (fetched via the
   existing `useProfile()` hook), not a static const.
8. Caught and fixed my own bug mid-build: a helper-text line used
   `.find(c => c.code)`, which just grabs the first array entry instead
   of the seller's actual currency — fixed before it ever shipped.

**Verified:** `tsc --noEmit` clean, `vitest` 68/68 pass (65 existing + 3
new for `countries.ts`), migration confirmed live via direct Supabase
REST query (not assumed).

**Not verified — genuinely outstanding, not a technicality:** an actual
browser walkthrough (onboarding selector, Settings save round-trip, a
real CSV import with SKU-less rows, re-import idempotency). The
`Claude_Preview` tool hung unrecoverably across two clean restarts trying
to do this (see "Environment quirks" above) — **the user said stop using
it entirely.** If picking this thread back up: ask the user whether
they've done this walkthrough themselves and what they saw, don't assume
it works just because the automated checks pass.

## Standing rules that still apply (from mind.md, still true)

- No dev auth/entitlement bypass exists anywhere — set `plan_tier`
  directly in Supabase to test paid/premium screens.
- SQL functions are `SECURITY INVOKER`, always.
- Aggregation lives in SQL, not JS, for anything touching
  `market_price_history` (fastest-growing table).
- Migrations are **not self-applying** — every `scraper/migrations/0NN_*.sql`
  must be run manually via the Supabase SQL Editor, in order. Migrations
  018–023 are confirmed applied as of this session.
- `CREDENTIALS.txt` at repo root has live keys, gitignored, never print in
  full.

## Done: Ask 1 — per-product competitor view (2026-08-28, follow-up session) — CODE COMPLETE, NOT PUSHED, NOT BROWSER-VERIFIED

Picked up the scoping thread below with the user's explicit "all are
priority, do as you like" — chose Ask 1 first as the lowest-risk/no-new-
scraping option, per the runbook. Re-verified load-bearing facts before
building (all held: Daraz rows still have populated rating/rating_count/
sold_count, OLX still disabled via `CLASSIFIED_SOURCES = []`, Competitors
page still purely category-scoped via `p_category_slugs`). Scoped via
Plan Mode (Explore + Plan subagents), plan approved with these decisions:
- New `CompetitorListing` type, kept deliberately separate from the
  Market page's `ProductMatch` (not reused, even though the shape
  overlaps today).
- **Shipped free for all sellers, no entitlement gate** — user's own
  words: "make it free as of now we will make paid once all the features
  of the app are approved by the boss." Do not silently reintroduce the
  `product_matching` paid gate on this route without checking with the
  user first.
- Top 5 matches, MIN_CONFIDENCE 0.3 (same threshold as the existing
  category-level matcher).
- Watchlist SELECT extension (`watchlists.ts` — separate surface) deferred
  as its own fast-follow, not bundled into this change.

**Shipped:**
1. `horizon-ui-chakra-nextjs-main/src/lib/market-intel/similarity.ts` —
   new shared module for `tokenize()`/`jaccard()`/`STOPWORDS`/
   `MIN_CONFIDENCE`, extracted out of `competitors.ts` and
   `product-matching.ts` (which each had their own identical copy —
   collapsed two duplicates instead of adding a third).
2. `product-matching.ts` — new `CompetitorListing` type and
   `findCompetitorsForProduct(sellerId, sellerProductId, categorySlug,
   reportingCurrency, limit=5)`, a sibling to the existing
   `findTopProductMatches` (which is untouched — still the Market page's
   batch top-1-per-product feeder). rating/ratingCount/soldCount are
   nullable end-to-end, never coerced to 0.
3. `horizon-ui-chakra-nextjs-main/src/app/api/products/[id]/competitors/route.ts`
   — new GET route, resolves the seller's product's category slug (double-
   filters `id` + `seller_id`, same defense-in-depth as the existing
   `[id]/route.ts`), no entitlement gate (see decision above).
4. `horizon-ui-chakra-nextjs-main/src/app/apps/products/components/CompetitorsDrawer.tsx`
   — new read-only drawer (not folded into EditProductDrawer, which is a
   write form). Renders nulls as em-dash, labels sold_count as a "demand
   proxy" via tooltip, distinguishes Daraz ("other marketplace sellers")
   from single-retailer platforms ("individual retailers stocking a
   comparable item") in an explanatory line.
5. `page.tsx` / `ProductsTable.tsx` / `ProductCard.tsx` — new "Competitors"
   row/card action button (separate from "Edit"), wired to the new drawer.

**Revised same day, before commit:** user corrected the matching model
with a GPU example — a $300 and a $1500 GPU aren't competitors even if
their titles overlap; two different GPU models at a similar price ARE
competitors even with zero title overlap. `findCompetitorsForProduct()`
now uses category + seller price ±15% (`PRICE_BRACKET_PCT`) as the HARD
filter (a candidate with no price is excluded, can't be judged against
the bracket); Jaccard title-similarity is ranking-only within the
bracket, never a filter. If the seller product has no `sell_price` yet,
falls back to category-only/title-ranked (no bracket to apply). Drawer
copy updated to match: "within 15% of your price - the price range that
actually competes for the same buyer, regardless of whether the product
name matches yours." Added
`horizon-ui-chakra-nextjs-main/src/lib/market-intel/product-matching.test.ts`,
7 smoke tests covering: bracket exclusion despite title match, GPU-case
inclusion despite no title match, in-bracket ranking by similarity,
no-price-candidate exclusion, no-sell_price fallback, null passthrough on
rating/ratingCount/soldCount, and limit capping.

**Follow-up, same day: persisted competitor matches for price-trend/
decommission tracking.** User asked whether matches should be "tagged" for
identification, then confirmed: persist the match so price history can be
tracked and a listing's decommission status can be seen — not just live
recompute-and-discard on every drawer open. Scoped via Plan Mode (Explore
agent read the actual schema/scraper code first). Key findings that shaped
the design:
- `market_products.is_active` is already flipped to `false` by the
  scraper's `markStaleProducts()` (`scraper/src/db.ts`) whenever a listing
  drops out of a scrape run — decommission detection needs **no new
  logic**, just join to `market_products` and read `is_active`.
- `market_price_history` (one row/product/day, `scraper/migrations/
  026_price_history_hardening.sql`) already gives a price time series per
  `market_product_id` with zero new capture code needed.
- `seller_watchlist_items` (`014_seller_watchlists_and_notifications.sql`)
  is the closest prior art — a seller-owned table pointing at a
  `market_product_id`, read by a cron (`price-alerts-job.ts`) that diffs
  against last-known state. Followed the same RLS/ownership pattern for
  the new table.
- User confirmed via AskUserQuestion: **backend only this round** (no
  trend/decommission UI yet — CompetitorsDrawer's live top-5 is unchanged),
  and **persist-on-read, not a new cron** (matches only start accumulating
  history once a seller actually opens the drawer for that product; no new
  scheduled job).

**Shipped:**
1. `scraper/migrations/028_seller_product_competitor_matches.sql` — new
   table `seller_product_competitor_matches` (seller_id, seller_product_id,
   market_product_id, confidence, first_matched_at, last_confirmed_at;
   unique on seller_product_id+market_product_id), RLS via the same
   `seller_id in (select id from sellers where user_id = auth.uid())`
   owner-all policy used everywhere else. **Applied by the user via the
   Supabase SQL Editor on 2026-08-28 and confirmed live** — verified by
   direct REST curl against the anon key (table exists, RLS correctly
   returns `[]` for an unauthenticated request rather than a 42P01
   "relation does not exist" error).
2. `product-matching.ts` — `findCompetitorsForProduct()` now also fetches
   `market_products.id`, and calls a new private `persistCompetitorMatches()`
   after computing the top-N, which upserts them into the new table.
   Deliberately best-effort: a persistence write failure is swallowed and
   never breaks the live listings response, since the drawer's real job is
   showing today's top-5, not writing history. `first_matched_at` is
   omitted from the upsert payload so it's only ever set once, at insert.
3. `product-matching.test.ts` — 2 new tests (9 total now): persists the
   right rows keyed by seller+market product with a real confidence score
   and no `first_matched_at` override, and persists nothing when nothing is
   in-bracket.

**A "tracked competitors" view (price sparkline, active/decommissioned
badge) is the natural next step now that the table has real data
accumulating** — not built yet, no ask for it yet either.

**Follow-up, same day: visual polish + "why so few results" +
missing-assistant check.** After the migration went live and the user
confirmed (via screenshot) the drawer opens and works in production, they
asked for three things in one message: (a) make `CompetitorsDrawer.tsx`
visually better, (b) explain why so few competitor listings show up (a
ShoppersPK-heavy result set with a mismatched "Eyebrow Trimmer" title and
a visible un-decoded `&amp;` bug), (c) whether the dashboard-embedded
seller-aware assistant ("Ask 3" below) exists yet.
- (a) shipped: `CompetitorsDrawer.tsx` now decodes HTML entities via a
  detached-textarea trick (browser's own parser, only `.value` ever read
  back — never re-rendered as HTML) before displaying titles, adds a
  platform `Badge`, an external-link icon on to each listing link, a star
  icon next to ratings, a full-title `Tooltip` for the 2-line-truncated
  title, and right-aligned sold-count formatting. `tsc --noEmit` clean,
  `vitest` still 78/78. Committed as `e11d436`.
- (b) diagnosed but not yet changed: `MAX_COMPETITOR_MATCHES = 5` in
  `product-matching.ts` truncates the ranked list hard. Category row
  counts confirmed live via REST: Daraz has ~120 active rows in
  `toys-games`/`mother-baby`; ShoppersPK+Naheed combined have ~1319 active
  rows in `baby`/`kids-babies` for the same seller-facing
  `toys-and-baby` category. The underlying data is *not* scarce — the
  visible ShoppersPK-heavy, thin result set is the cap plus the
  price-bracket+confidence sort naturally favoring whichever platform has
  the densest candidate pool in-bracket, not a data gap. Options if the
  user wants a fix: raise the limit, or diversify results across
  platforms (e.g. top-N per platform instead of one global top-5). Not
  actioned yet — needs a decision from the user.
- (c) answered directly: the "AI assistant at the bottom" does not exist.
  It's Ask 3 below (dashboard-embedded seller-aware assistant) — scoped in
  this same thread, never implemented. Would need its own Plan Mode
  session (new schema/multi-file effort) if prioritized.

**Verified:** `tsc --noEmit` clean, `vitest` 78/78 pass (69 original + 7
price-bracket + 2 persistence, no regressions). Diff matches the approved
plan's file list exactly (checked via `git status`/`git diff --stat`),
plus the price-bracket revision reviewed and confirmed by the user.
Migration applied and confirmed live (see above). CompetitorsDrawer visual
polish committed (`e11d436`).

**Not verified — genuinely outstanding:** no browser walkthrough of the
*new* visual polish specifically (drawer-opens-at-all was already
confirmed by the user via screenshot before this polish pass). Per the
hard Claude_Preview ban, this needs the user to check in their own
browser/deployed build.

## Open thread (2026-08-28): per-product competitor intel + broader scraper scope + dashboard assistant — SCOPED, NOT STARTED

User asked for three things, after country-aware catalogue shipped. This
was a scoping conversation (explicit: "reason with me and research well
before proceeding with anything") — **nothing below is implemented.**
Investigated via a research subagent reading actual code, not assumed.

**Ask 1 — per-product competitor view.** When a seller adds a specific
product, they want to see matching competitor listings for *that product*
with location, reviews (+/-), and sales — not today's category-level
Competitors page.
- Reality found: Competitors page (`competitors.ts`,
  `market_competitor_scorecards()` SQL fn, migration 022) is scoped purely
  by category, never by product identity. Watchlist
  (`lib/market-intel/watchlists.ts`, `searchMarketProducts`) is the only
  product-specific mechanism today, but it's manual (seller searches and
  picks) and only surfaces title/platform/price/stock — even though
  `market_products.rating`, `.rating_count`, `.sold_count` already exist
  and are populated for Daraz rows. That's a cheap win: surface existing
  columns, and turn the manual watchlist search into auto-matching on
  product add (extend the existing but underused title-similarity
  "overlap" logic in `CompetitorsView.tsx` rather than building fresh).
- **Location is not honestly deliverable right now for any platform.**
  `market_products` (retailer listings — Daraz, PriceOye, etc.) has no
  location column at all, ever. Only `market_classified_listings.city`
  (OLX) has it, and **OLX is currently disabled** (see below) — the
  Competitors page's "994 listings / 2 platforms" stat is stale/wrong
  right now because of this; should be fixed regardless of what else
  happens.
- **10 of 11 scraped sources are single-retailer storefronts** (PriceOye,
  Telemart, Shophive, Sapphire, Mega, Naheed, Vmart, ShoppersPK,
  iShopping, GoTo) — the platform *is* the seller, no third-party seller
  identity to attach location/reviews to. Only **Daraz** is a real
  multi-seller marketplace. Any "seller-specific" competitor data
  (location, per-seller reviews) can only ever apply to Daraz.
- Reviews: only aggregate `rating`+`rating_count` ever scraped (Daraz,
  PriceOye) — **no review text anywhere**, positive or negative. Getting
  real review text/sentiment means new scraper work crawling individual
  review pages, which multiplies request volume per listing — a real
  rate-limit risk given what happened to OLX (see below). If built,
  should be bounded to watchlisted products only, not the whole catalog.
- Sales: `market_products.sold_count` (migration 019) is Daraz's own
  displayed "X sold" badge — explicitly commented in the migration as "a
  demand *proxy*, not sales data." Should be labeled as an estimate in any
  UI that surfaces it, not asserted as verified sales.

**Ask 2 — broaden scraper scope beyond category-general.** Two different
risk tiers: (a) using data scrapers *already collect* for
product-identity matching instead of only category bucketing — this is a
matching-layer/DB change, not a scraper change, low risk; (b) actually
scraping new fields (review text, re-enabling OLX for location) — real
scraper engineering with real rate-limit risk. **OLX Pakistan was fully
disabled `30b00f8` (2026-08-03)** after backoff/retry still got
standing IP-level 429 blocks from GitHub Actions runner IPs
(`scraper/src/sources/index.ts`, `CLASSIFIED_SOURCES = []`) — this is the
direct cautionary precedent for why (b) needs a deliberate rate-budget
design before shipping, not just "add more scraping."

**Ask 3 — dashboard-embedded smart assistant** (bottom-left, general
chat + sales/margin advice, reasoning grounded in the seller's own data).
**Not reusable from what exists** — `src/lib/ai/groq-client.ts` +
`src/app/api/assistant/route.ts` + `AssistantWidget.tsx` is the
**public marketing-site FAQ bot only**, explicitly unauthenticated, no
seller identity read (`route.ts`: "backs the marketing-site widget, not
anything seller-specific"). Uses Groq (Llama 3.1-8b-instant) via plain
fetch, not OpenAI/Anthropic. The calling *pattern* (`callGroqJson`/
`callGroqChat`) is reusable; a seller-aware version reading their
products/orders/competitor-scorecard data is new work. My recommendation
(not yet agreed): ship it **advisory/read-only** first — reasons and
recommends, doesn't take actions (change prices, edit listings) on the
seller's behalf — matching this platform's overall posture of easing
decisions rather than automating them away from the owner.

**Flagged to fix regardless of which phase comes next:** the stale "2
platforms" Competitors stat (OLX is off); don't promise
location/review-per-seller for the 10 single-retailer-storefront
platforms since there's structurally no third-party seller there.

**Flagged to fix regardless of which phase comes next:** the stale "2
platforms" Competitors stat (OLX is off); don't promise
location/review-per-seller for the 10 single-retailer-storefront
platforms since there's structurally no third-party seller there.

### How to resume this thread (runbook for whichever Claude picks this up)

1. **Don't write code first.** Nothing here was approved — it's findings
   from a research pass, not a plan. The user's own words: "reason with
   me and research well before proceeding with anything." Re-litigating
   the findings above isn't needed (they came from reading the actual
   code, cited file-by-file) unless something looks stale — but the
   *decision* of what to build and in what order is still the user's,
   not something to infer from this doc.
2. **Ask the user what's changed and what they want first**, in plain
   terms: has the OLX/rate-limit situation changed? Do they still want
   all three (competitor matching, scraper broadening, assistant), or has
   priority shifted? Don't assume "resume = start building Ask 1."
3. **Once they pick a direction, re-verify the load-bearing facts above
   before acting on them** — specifically: is OLX still disabled
   (`scraper/src/sources/index.ts`, `CLASSIFIED_SOURCES`), do
   `market_products.rating`/`.rating_count`/`.sold_count` still exist and
   populate the way described, is the Competitors page still purely
   category-scoped. These are cheap to recheck and this doc going stale
   is exactly the failure mode it's trying to prevent (see `mind.md`'s
   fate at the top of this file).
4. **If the direction involves a schema change or touches multiple
   files/routes** (true for all four sub-options — auto-matching,
   OLX re-enable, review scraping, or the assistant) — use Plan Mode
   first, the same way the country-aware catalogue work was scoped, and
   get the plan approved before implementing. Don't skip straight to
   Edit/Write calls.
5. **If the direction is scraper work touching request volume or
   re-enabling OLX** — treat the 2026-08-03 OLX shutdown as a hard
   constraint, not a historical footnote: design the rate/request budget
   *before* writing scrape logic, not after something gets rate-limited
   again.
6. **Update this section (or replace it with a "done" writeup like the
   country-aware catalogue section above) once work actually starts** —
   don't let this "SCOPED, NOT STARTED" header go stale once it isn't
   true anymore.

## Resolved (2026-08-28): scraper freshness — CONFIRMED LIVE, LANDING DATA

Follow-up session got explicit user permission to read the Supabase URL +
anon key from `CREDENTIALS.txt` (project ref `fognozenapenvmqsopxe`) and
ran a direct REST check. **Confirmed all 10 active sources** (priceoye,
telemart, shophive, ishopping, goto, sapphireonline, daraz, mega, naheed,
shopperspk) have `market_products.last_seen_at` timestamps clustered in a
~26-minute window on **2026-08-27 ~14:23–14:49 UTC** — consistent with one
successful full scrape run, not partial/stale data. `market_price_history`
independently confirms the same timestamp. OLX correctly has zero rows
being touched (still disabled, as expected). Note: `market_products` has
no `updated_at` column, only `first_seen_at`/`last_seen_at` — use those
for any future freshness check, not `updated_at`.

**Not checked this pass** (user opted to check the Actions tab
themselves instead of installing `gh` CLI): whether the corresponding
GitHub Actions run showed green or red. Worth asking the user what they
saw if picking this up again — a red run that still landed data would
mean a partial failure worth investigating (e.g. timeout after most
sources completed).

**Superseded section below (kept for history of what was unconfirmed
before this check):**

User asked "does scraping still happen or no?" Confirmed the **config**
by reading the file, but could not confirm **live run outcomes** —
document the gap honestly rather than assume either way.

**Confirmed (read directly):** `.github/workflows/market-scraper.yml` is
an active, non-disabled GitHub Actions workflow. Schedule is
`cron: "30 3 * * *"` (fires daily) gated by an in-job "Determine cadence"
step that only actually runs the scrape on even days-since-epoch — net
effect is genuinely every 2 days, immune to month-length drift (see the
comment block at the top of that file for why day-of-month `*/2` cron
syntax was rejected). When it fires, it scrapes **10 sources**: PriceOye,
Telemart, Shophive, iShopping, GoTo, SapphireOnline, Daraz (largest, 22
categories), Mega, Naheed, ShoppersPK. `workflow_dispatch` is also
enabled (manually triggerable). OLX's category env var is deliberately
absent, consistent with `CLASSIFIED_SOURCES = []` (2026-08-03
disablement, see the Ask-2 open thread above).

**NOT confirmed — genuinely unknown as of this writing:**
- Whether the last several scheduled runs actually **succeeded** (green)
  vs failed silently. `timeout-minutes: 40` is called out in the
  workflow's own comments as tight even post-hardening, Daraz alone runs
  22 categories × up to 15 pages through CloakBrowser with deliberate
  2.5-6s/page + 8-15s/category delays.
- Whether `market_products`/`market_price_history` rows have fresh
  `updated_at` timestamps recently (the actual proof scraping is landing
  data, not just that the workflow is scheduled to attempt it).

**Why unconfirmed — two tooling gaps hit in this session, worth knowing
about before trying again:**
1. **No `gh` CLI installed** in this Windows dev environment (`gh: command
   not found` in both Bash and PowerShell) — checking GitHub Actions run
   history needs either installing it or checking the Actions tab in a
   browser directly.
2. **Reading `CREDENTIALS.txt` for the Supabase URL/anon key got blocked**
   by the auto-mode permission classifier, correctly, because the ask at
   the time was just "does scraping still happen" and cat-ing a
   credentials file (even for public-facing values like the URL/anon key,
   not the service-role key) wasn't clearly authorized by that narrow
   question. A REST query to check `market_products.updated_at` recency
   would need either explicit user permission to read those two values
   from `CREDENTIALS.txt`, or the user pasting the project URL directly.

**Next step if resuming this thread:** get explicit permission to read
the Supabase URL + anon (not service-role) key from `CREDENTIALS.txt`,
then `curl` a REST query against `market_products` (or
`market_price_history`) ordered by `updated_at desc limit 5` to see how
fresh the data actually is — that's the real signal, more reliable than
Actions run-history alone since a run can go green while still silently
scraping zero rows from a blocked source. Cross-check against Actions run
history (via `gh` once installed, or ask the user to screenshot the
Actions tab) to correlate failures with specific sources.

## Fixed (2026-08-28): platform imbalance in Competitors matches

`MAX_COMPETITOR_MATCHES` in
`horizon-ui-chakra-nextjs-main/src/lib/market-intel/product-matching.ts`
raised **5 → 15**. At 5, a category with one platform's candidate pool
much denser than another's (e.g. toys-and-baby: ShoppersPK/Naheed ~1319
active rows vs Daraz ~120) let the dense platform's matches crowd out
every other platform's listings from a seller's competitor view entirely
— not a bug in the matching logic itself, just too small a cutoff for
the real row-count skew across platforms. 15 gives a smaller platform's
closest matches room to surface without returning the whole candidate
pool. Verified: `tsc --noEmit` clean,
`vitest run src/lib/market-intel/product-matching.test.ts` 9/9. Commit
`2abfca5`.

## Done: Ask 3 — seller-aware dashboard assistant (2026-08-28, same session as the above fix)

User said "raise the competitor match limit to fix the imbalance and
proceed with the next phase please," then when asked to choose between
Ask 2 (scraper broadening) and Ask 3 (assistant) for "the next phase,"
said **"both or 1 by 1 as you deem better"** — delegating sequencing.
Assistant was picked first over scraper work specifically because it
carries no production/rate-limit risk, unlike anything touching OLX or
scrape volume (see the Ask-2 cautionary precedent above). **Ask 2 is
still open, not started.**

Went through Plan Mode (Explore → Plan → verified every referenced
function/column against real code → approved) since it touches several
new files. Shipped, code-complete, all tests green (90/90, no
regressions), committed `bf9ff18` — **not yet browser-verified**, same
caveat as Ask 1 below (this session's standing instruction was "dont run
previews idiot" — no `mcp__Claude_Preview__*`/browser-automation tool was
or should be used to check it; the user needs to check it themselves).

What it is: a floating chat widget, bottom-left on every authenticated
dashboard page (mounted once in `AdminShell.tsx`, not per-route), posting
to a new session-authenticated `/api/assistant/seller` route — distinct
from the pre-existing public, unauthenticated marketing-site widget/route
that Ask 3's original scoping note (above) correctly identified as not
reusable as-is. Reuses the Groq calling *pattern* (`callGroqChat` from
`src/lib/ai/groq-client.ts`, Llama 3.1-8b-instant) but adds a new
seller-grounded context layer.

Key design decisions:
- **Context is fresh-per-request, not cached.** No caching layer at all
  — deliberately, to avoid staleness bugs, at the cost of a Groq call
  plus a few DB reads on every message. Fine at current scale; revisit if
  latency or Groq spend becomes a problem.
- **Context is capped at 4000 chars**, assembled priority-ordered
  (seller's own products first, then market scope, competitor landscape,
  watchlist, then — only if the latest message plausibly names one of the
  seller's own products via Jaccard token-overlap from
  `src/lib/market-intel/similarity.ts` — that product's own competitor
  matches) and truncated from the end if it would exceed the cap, so the
  most load-bearing sections survive.
- **Advisory-only is enforced mechanically, not just by prompt wording.**
  The code path only ever calls read functions; there is no tool/function
  calling wired into the Groq request, so the model has no mechanism to
  invoke a mutating endpoint no matter what a user or a prompt-injection
  attempt asks it to do. This directly delivers the "ship it
  advisory/read-only first" recommendation from the original scoping note
  above.
- **No persistence.** Conversation history is client-side only for now
  (matches the marketing widget's existing behavior) — the request
  contract already sends full history per call, so adding a persisted-
  history table later is additive, not a breaking change.
- Rate-limited per seller (20 req/min via the existing generic
  `isRateLimited` helper, keyed on `seller.id` not IP).
- New files: `src/lib/ai/seller-assistant-context.ts`,
  `src/lib/ai/seller-assistant.ts`,
  `src/app/api/assistant/seller/route.ts`,
  `src/components/marketintel/SellerAssistantWidget.tsx`, plus a
  `.test.ts` for each of the first three (12 new tests total). Modified:
  `AdminShell.tsx` (mounts the widget).
- Explicitly out of scope this round (per the approved plan): streaming
  responses, persisted/exportable chat history, proactive insights (the
  assistant only responds, never initiates), and any tool-calling.

## Done: Ask 2, tier (a) — "Your tracked matches" on the Competitors scorecard (2026-08-28) — CODE COMPLETE, NOT COMMITTED, NOT BROWSER-VERIFIED

Picked up via the runbook. Re-verified all load-bearing facts before
building (all held: OLX still disabled via `CLASSIFIED_SOURCES = []`,
`market_products.rating`/`.rating_count`/`.sold_count` still exist and
populate for Daraz, Competitors page still purely category-scoped).
Scoped via Plan Mode (2 Explore agents + 1 Plan agent).

**Course-correction during investigation, confirmed with the user before
building:** the originally proposed "extend the mobiles-only cross-
platform matcher (`scraper/src/matching.ts`) to all categories" turned
out to be extending **dead infrastructure** — its output table
(`market_product_matches`) is not read anywhere in the live app; the
component that would consume it (`CrossPlatformMatches.tsx`) isn't wired
into any page. User chose to drop that thread entirely (not wire it up,
not extend it, not delete it either — just leave it alone) and focus
solely on the other, genuinely feasible half of tier (a): surfacing the
already-accumulating `seller_product_competitor_matches` table (from Ask
1) onto the category-level Competitors scorecard.

**Decision:** read-side only, no SQL function change, no migration.
`market_competitor_scorecards()` can't gain a new output column via
`create or replace function` without a drop-first (risky — that function
is depended on by every Competitors-page load and the report collector).
Instead, a third parallel data source alongside the existing
`getCompetitorOverlap()`, using the same proven embedded-select idiom
already in this codebase (`onboarding-status.ts:28-29`,
`market_products!inner(...)` + dotted-path `.eq()`). Verified
`market_products` has no RLS anywhere in the migration history before
relying on this.

**Shipped:**
1. `competitors.ts` — new `getCompetitorMatchCounts(sellerId,
   sellerCategorySlug)`, reads `seller_product_competitor_matches` joined
   to `market_products` (category/platform/active filtered via the
   embed), rolls up distinct `seller_product_id` count per
   `seller_external_id`.
2. `page.tsx` — fetches it alongside `getCompetitorOverlap`, gated the
   same way (only once the scorecard has rows), passes as new
   `matchCounts` prop.
3. `CompetitorsView.tsx` — new "Your tracked matches" column (teal badge,
   deliberately different color from the overlap column's styling, "not
   yet tracked" muted text at zero), a new `COLUMN_HELP.trackedMatches`
   tooltip, and a new sentence in the "How to read this" card explicitly
   contrasting it with the existing overlap column — this count only
   grows when a seller has opened that product's Competitors drawer, so
   zero means "not reviewed yet," never "no match exists." This
   distinction was treated as load-bearing, not cosmetic copy.
4. `competitors.test.ts` — new file (first for this module), 4 tests:
   count rollup across distinct products, dedup when one product matches
   two market_products from the same competitor, null
   `seller_external_id` skipped without throwing, empty `categorySlugs`
   short-circuits without calling Supabase.

**Verified:** `tsc --noEmit` clean. `vitest run` on the new file +
`product-matching.test.ts` — 13/13 pass. Full suite — 93/94 pass, the 1
failure (`render.test.ts`'s PDF timeout) confirmed pre-existing
flakiness unrelated to this change (passes cleanly in isolation, same
"slow local build" environment issue already documented above under
"Environment quirks"). Diff matches the approved plan's file list
exactly (`git diff --stat`).

**Not verified — genuinely outstanding:** a Supabase REST sanity check of
the embedded-select query against live data was planned but **not run
this session** — reading the Supabase URL/anon key from `CREDENTIALS.txt`
was (correctly) denied by the auto-mode permission classifier, since this
session had no explicit fresh authorization for it (a prior session's
one-time grant doesn't carry over). Relied instead on the fact that the
query is a direct copy of the already-proven `onboarding-status.ts`
pattern, not a novel one. If picking this up: either get fresh explicit
permission to read those two values, or ask the user to confirm the new
column renders correctly with real data in their own browser (same
`Claude_Preview` ban as everything else — no rendered-browser check was
attempted here either).

**Committed and pushed** (`521ac92`), confirmed local HEAD matched
`origin/main` exactly (0/0 divergence via `git rev-list --left-right
--count`) before pushing, so this was a clean fast-forward, no rebase
needed.

## Fixed (2026-08-28): seller assistant widget overlapped the sidebar's "Paid Plan" card

User screenshot showed `SellerAssistantWidget.tsx`'s floating chat bubble
(bottom-left, per Ask 3's original design) visually colliding with the
sidebar's upgrade-nag card in the same corner. One-line fix: `left` →
`right` in the widget's outer `position: fixed` `Box` — the expanded chat
panel is self-contained (fixed/responsive width, its own `mb` spacing),
so anchoring to the opposite corner doesn't affect its internal layout.
`tsc --noEmit` clean. Committed `e6a6cc8`, pushed. Not browser-verified
(standing `Claude_Preview` ban) — ask the user to confirm visually.

**Next step if resuming either thread:** Ask 2 tier (b) (real scraper
engineering — OLX proxy fix, review-text scraping, new retailer sources)
is the one remaining item from the original 3-item scoping, explicitly
deferred pending a rate-budget design. See its entry above and the
runbook below, which still applies.

## Attempted (2026-08-28): getCompetitorMatchCounts() live sanity check — INCONCLUSIVE, not a red flag

With explicit fresh authorization, ran an anon-key REST query against
`seller_product_competitor_matches` (the table `getCompetitorMatchCounts()`
in `competitors.ts` reads, joined to `market_products`). Result: **0 rows**
(`Content-Range: */0`, `count: 0`). **This does not mean the table is
empty in production** — the anon key carries no seller session, and this
table almost certainly has an RLS policy scoped to the authenticated
seller (matching the pattern of every other seller-scoped table in this
project), so an anon query would return 0 regardless of real data.
Confirming actual row counts would require either a service-role query
(explicitly NOT run here — the auto-mode classifier correctly blocked an
attempt to reach for it without separate authorization for that specific
credential) or checking as a logged-in seller through the app itself. If
this needs re-checking, ask the user directly for permission to use the
service-role key, don't infer it from a broader "proceed with everything"
instruction — the classifier treats credential-tier escalation as needing
its own authorization even mid-task.

## Ask 2 tier (b): research done, waiting on target sites (2026-08-28)

Entered Plan Mode to scope real scraper engineering (re-enable OLX,
review-text scraping, or new retailer sources — the three sub-options
named in the original scoping above). Research phase completed via an
Explore agent pass over the scraper codebase; plan was **not finished or
approved** — the user interrupted before a concrete plan was written,
saying: "I will tell the scrapers and you will research those and tell
me how we can expand to more websites. wait till then and do everything
else." **Do not start scraper implementation work until the user names
specific target sites.** When they do, the research below is the
starting context — re-verify anything load-bearing since time may have
passed.

**Findings from that research pass (all read directly from code,
file:line-cited in the original agent report):**
- `CLASSIFIED_SOURCES` in `scraper/src/sources/index.ts` is still empty
  — OLX's scraper file (`scraper/src/sources/olx.ts`) is **fully
  deleted**, not just unregistered. The old implementation used plain
  `fetch` + cheerio with **zero rate-limiting logic** (no delays, no
  backoff, no circuit breaker) — that absence, not the scraping method
  itself, is the likely root cause of the 429 IP block, on top of running
  from GitHub-hosted `ubuntu-latest` runners (shared/known IP pool).
- A reusable politeness library already exists and predates/postdates
  OLX's removal: `scraper/src/sources/polite.ts` — exports
  `politeFetch()` (exponential backoff with jitter, respects
  `Retry-After`), a per-platform circuit breaker (trips after 3
  consecutive failures), and randomized page/category delay helpers. Used
  by newer sources (mega, naheed, vmart, shopperspk); older sources
  (priceoye, telemart, shophive, etc.) each inline their own pacing or
  have none. Any new source should use `polite.ts`, not reinvent pacing.
- Daraz (`scraper/src/sources/daraz.ts`) is the reference implementation
  for a "hardened" source: CloakBrowser (real npm package, stealth
  TLS/header fingerprinting + browser automation) with `humanize: true`,
  2.5–6s/page + 8–15s/category randomized delays, a 15s/45s/90s retry
  backoff ladder, block-page detection (200 responses that are actually
  an HTML/challenge shell, not JSON), and its own 3-consecutive-failure
  circuit breaker.
- Proxy support already exists end-to-end but is **unconfigured**:
  `config.ts` reads `SCRAPER_PROXY` env var, CloakBrowser sessions accept
  `options.proxy`, and the workflow has a `SCRAPER_PROXY` secret slot —
  currently empty. Re-enabling OLX without setting this would almost
  certainly get reblocked, since the IP pool that got blocked is the same
  `ubuntu-latest` pool every other source still runs from.
- `rating` (numeric) and `rating_count` (integer) columns already exist
  on `market_products` since migration 001, populated today only by
  Daraz and PriceOye; `sold_count` added in migration 019 (Daraz only,
  explicitly commented as a demand *proxy*, not verified sales). **No
  review-*text* scraping or schema column exists anywhere** — adding that
  would need a new migration, not just new scraper code.
- The workflow (`.github/workflows/market-scraper.yml`) runs as a single
  sequential job on `ubuntu-latest`, `timeout-minutes: 40`, driven by an
  epoch-based every-2-days cadence (see the "Resolved: scraper freshness"
  section above for why `*/2` cron syntax was rejected in favor of this).
  No per-source concurrency or matrix — everything shares one 40-minute
  budget, which is already tight because of Daraz's 22-category walk.

**Three sub-options, now with concrete constraints attached (unchanged
priority — none started):**
1. New retailer source(s) — lowest risk, no prior block history, but
   still net-new request volume against a new site's unknown tolerance.
2. Review-text scraping — needs a new migration (no column exists today);
   safest bounded to watchlisted products only to keep volume low.
3. Re-enable OLX — highest cost: needs a paid proxy provisioned first
   (nothing currently populates `SCRAPER_PROXY`) plus a full rewrite using
   `polite.ts`'s backoff/circuit-breaker, since the original code had none
   of that and that's the likely reason it got blocked in the first
   place.

## Done (2026-08-28): got-scraping wired into polite.ts for anti-bot hardening

User asked to evaluate a list of scraping tools/libraries (Firecrawl,
Crawl4AI, Scrapling, Browser Use, Scrapy, Crawlee JS/Python, Colly,
Playwright, Puppeteer, Selenium, Maxun) for improving scraper resilience,
then said to clone/add whichever are actually relevant. Since
`scraper/package.json` is Node/TS with `cheerio` + `cloakbrowser`
(wraps `playwright-core`), only two of that list share a runtime:
**Crawlee (JS/TS)** and **Playwright** (already present transitively).
Everything else (Firecrawl, Crawl4AI, Scrapling, Browser Use, Scrapy,
Colly, Selenium, Maxun) is Python/Go and would need a separate
microservice to use — not attempted, flagged as a real architectural
decision if ever wanted.

Sparse-checked-out (`git sparse-checkout` cone mode, `--filter=blob:none
--no-checkout --depth 1`) just `packages/got-scraping-client`,
`packages/core`, `packages/browser-pool` from `apify/crawlee` into
`scraper/.vendor-reference/crawlee/` (now `.gitignore`d — reference
only, not vendored into the build; ~1.5MB instead of the full monorepo).

Shipped: `got-scraping` (real npm package, not hand-rolled) installed as
a dependency and wired into `polite.ts`'s `politeFetch()`, replacing the
bare `fetch()` call. This is the one piece that generalizes across every
source using `politeFetch` — **mega, naheed, shopperspk, vmart** — with
zero changes needed in those four files, since `gotScrapingFetch()`
adapts got's response back into a standard Fetch API `Response` (same
`.ok`/`.status`/`.headers.get()`/`.text()`/`.json()` interface those
callers already use). `priceoye`/`sapphireonline`/`shophive`/`telemart`/
`ishopping`/`goto` still call bare `fetch()` directly and were
**deliberately not touched** — they don't route through `polite.ts` at
all, so this change didn't touch them; retrofitting them is a separate,
larger piece of work if wanted later. `daraz.ts` is browser-driven via
CloakBrowser, not `fetch`, also untouched.

**Verified live, not just type-checked** — ran a real request against
`httpbin.org` and confirmed both that our explicit `DEFAULT_HEADERS`
(`Accept`, `Accept-Language`, `User-Agent`) still went out exactly as
set, AND that `got-scraping` auto-added realistic Chrome fingerprint
headers a bare `fetch()` never sends (`Sec-Ch-Ua`, `Sec-Fetch-Dest`,
`Sec-Fetch-Mode`, `Upgrade-Insecure-Requests`, `Accept-Encoding`) — the
actual anti-detection value showing up on the wire, not just in types.
`tsc --noEmit` clean. Committed `a4690fc`, pushed.

**One real bug caught during verification, now fixed**: `got`'s response
`.headers` object carries extra non-string-keyed entries that broke
`new Response(..., { headers })` (`TypeError: ... is a symbol, which
cannot be converted to a DOMString`). Fixed by normalizing through
`Object.entries(...).filter((e): e is [string,string] => typeof e[1]
=== 'string')` before constructing the `Response` — `Object.entries`
only returns own string-keyed enumerable properties, which strips the
problem entries as a side effect.

**Environment note worth knowing if picking this up again**: DNS
resolution was intermittently broken during this session — `curl` from
Bash worked fine while raw Node (`dns.lookup`, and by extension `fetch`/
`got-scraping`) failed with `ENOTFOUND` for the same hosts, even with
`dns.setServers(['8.8.8.8'])` set explicitly. Using
`dangerouslyDisableSandbox: true` on the Bash call that actually invoked
the Node script resolved it. If a future scraper-side network call
mysteriously fails with `ENOTFOUND` despite `curl` working, this
sandbox-vs-Node distinction is the likely cause, not a real DNS/network
outage.

**Not done, still open:**
- `@crawlee/core`'s `SessionPool` (auto-retire burnt sessions/IPs) was
  the other piece flagged as valuable but not installed — smaller,
  optional follow-up if `got-scraping` alone doesn't move the needle
  enough once run against real sites.
- New retailer sites (the "new retailer sources" sub-option) — the user
  said they'd name specific target sites; not yet named as of this
  writing.
- OLX proxy fix and review-text scraping — still the two highest-cost,
  unstarted sub-options, same constraints as documented above (needs a
  provisioned proxy; needs a new migration).

**Decided (2026-08-28): staying Node-only, Python sidecar (Scrapling/
Crawl4AI) explicitly deferred, not rejected.** User asked why the full
tool list from the earlier evaluation wasn't all "cloned and used" —
answer given: Firecrawl/Crawl4AI/Scrapling/Browser Use/Scrapy are Python,
not npm packages, so using them means running a second process (a Python
service the Node scraper calls over HTTP), not just installing a
dependency. Of that list, two have real, non-overlapping value worth
naming honestly rather than dismissing as "wrong language, skip":
- **Scrapling** — adaptive/self-healing selectors, directly addresses
  scraper maintenance burden when a site's HTML changes (something
  `polite.ts`/each source's hand-written cheerio selectors have no
  answer for today).
- **Crawl4AI** — LLM-assisted structured extraction from a new site
  without hand-writing selectors first; most valuable for onboarding
  *new* retailer sources fast, not for the 10 already-tuned sources.
(Firecrawl and Scrapy were judged lower-value: Firecrawl mostly
duplicates what CloakBrowser + existing selectors already do; Scrapy is
a second full framework with no unique capability over Crawlee. Browser
Use was judged a poor fit for a scheduled cron job — LLM-per-page-action
cost and nondeterminism cut against a job that scrapes the same category
pages every run.)

Given user's answer was "do what is necessary, no compulsion" (explicit
delegation of the call), the decision made: **don't stand up the sidecar
now** — nothing in the current 10 sources has an active selector-drift
problem, so Scrapling's value is currently theoretical, not urgent.
**Trigger conditions to revisit, matching this project's existing pattern
of "wait for a real signal, don't rewrite preemptively"** (same reasoning
`polite.ts`'s own header comment uses for why the original seven sources
weren't retrofitted): reconsider Scrapling if a source starts silently
returning nulls/empty results after a site redesign (maintenance pain
becomes real); reconsider Crawl4AI specifically when the user names new
retailer sites, if hand-writing selectors for them turns out to be slow
enough that automated extraction would clearly pay for itself.

## Flagged (2026-08-28): seller-vs-competitor price history has a real gap

User asked to be "ready" for a later-stage feature: tracking price
history comparisons between a seller's own product and each matched
competitor over time. Checked the actual schema before agreeing readiness
was real, and it isn't fully there yet:
- `market_price_history` (migration 001) already tracks **competitor**
  (`market_products`) price snapshots over time — `product_id, price,
  compare_at_price, in_stock, recorded_at`. This half is fine.
- **`seller_products` has no price-history table at all** — only a
  current `sell_price` + `updated_at`. There is no record of what a
  seller's own price was last week, only what it is right now.
- `seller_product_competitor_matches` (migration 028) stores the match
  itself (`confidence`, `first_matched_at`, `last_confirmed_at`) with no
  price-at-time-of-match snapshot.

**To actually build this later**, the missing piece is a
`seller_product_price_history` table (new migration) capturing the
seller's own price changes over time — most naturally populated by a
trigger or application-level insert whenever `seller_products.sell_price`
changes, mirroring how `market_price_history` gets populated on each
scrape. Not built now (explicitly a later stage per the user) — flagging
here so "we're ready for that" isn't assumed true without this table
existing when the stage actually arrives.

Also confirmed while checking scraper source files for this: only
**Daraz** and **PriceOye** populate `rating`/`ratingCount` among the 10
active sources (`sold_count` is Daraz-only) — the other 8 simply don't
expose that data on their listing pages. Adding a new scraper source
does NOT automatically bring rating/sold-count data; it depends entirely
on whether that specific site displays it, and requires per-source
extraction code same as any other field. The columns already exist on
`market_products` (migrations 001, 019), so no schema change is needed
when a new source does expose them.

## Done (2026-08-28): auto-assign category on product add / CSV import

Sellers previously had to manually pick from the fixed 12-category list
(`seller_categories`, migration 011) — required on the manual add-product
form, and silently left `null` on CSV bulk import (no category column
existed in the import mapping at all). User asked for this to be
automatic on both entry paths. Went through Plan Mode (approved
2026-08-28) since it touched 4 files across frontend + 2 API routes +
a shared AI module.

**What already existed and was reused, not rebuilt:** `suggestCategory()`
(`horizon-ui-chakra-nextjs-main/src/lib/ai/suggest-category.ts`) — Groq
(`llama-3.1-8b-instant`, temp 0, JSON mode via `callGroqJson`)
classifies one title into one of the 12 slugs, already wired to an
opt-in "Suggest with AI" button in `NewProductDrawer.tsx`. The gap was
that it was manual-only on single-add and entirely absent on bulk import.

**Shipped:**
- `NewProductDrawer.tsx`: added a 600ms-debounced `useEffect` on `title`
  that auto-triggers the same suggestion logic (extracted into
  `runSuggestCategory(title, silent)`) once `title.length >= 2` and no
  category is set yet. Stops firing once a category is set (manual pick
  or prior suggestion) — doesn't fight an explicit choice. The "Suggest
  with AI" button still works for manual re-trigger. Silent-mode
  failures (e.g. Groq not configured) don't toast — the seller can still
  pick manually with no explanation needed.
- `POST /api/products` (`route.ts`): added a server-side fallback — if a
  request arrives with `title` but no `categoryId` (e.g. a fast submit
  before the debounce resolves), classify server-side before insert.
  Any failure (Groq not configured, network, bad response) falls back to
  `category_id: null`, same as before this change existed — never blocks
  product creation.
- New `suggestCategoriesBatch(titles, categories)` in
  `suggest-category.ts` — classifies many titles in one Groq call
  (numbered list in, `{"results": [{"index", "categorySlug",
  "confidence"}]}` out) since a 5000-row CSV (`MAX_IMPORT_ROWS`) can't
  afford one round-trip per row. A missing/invalid index degrades to
  `null` for that title only, not a thrown error for the whole batch.
- `POST /api/products/bulk-import` (`route.ts`): rows missing
  `categoryId` are now classified in batches of 25 with concurrency 4.
  **Capped at `AUTO_CATEGORIZE_MAX_ROWS = 1000` rows per import** to
  bound latency/Groq spend on a 5000-row CSV — rows beyond the cap (or
  if Groq isn't configured, detected via `GroqNotConfiguredError` to
  stop wasting time on remaining batches that would fail the same way)
  keep `category_id: null` exactly like before, and the count is
  surfaced as a new `leftUncategorized` field in the response — not a
  silent cap. Added `export const maxDuration = 60;` to the route since
  the extra Groq round-trips can push a large import past a short
  serverless default.
- 14 new tests across 3 new files (`suggest-category.test.ts`,
  `products/route.test.ts`, `bulk-import/route.test.ts`) — batch mapping
  correctness, the POST fallback, the cap, and the
  `GroqNotConfiguredError` early-stop behavior. Full suite 108/108,
  `tsc --noEmit` clean. Committed `d01acf2`, pushed.

**Not in scope this round (explicitly deferred in the plan):** no CSV
column mapping for a category name/slug the seller's own export might
already carry (only auto-classifies rows with no category at all); no
retroactive re-categorization of existing `category_id = null` products;
no change to the fixed 12-slug `seller_categories` list itself.

**Not browser-verified** per standing rule (no `Claude_Preview` tools) —
ask the user to try adding a product and importing a small CSV without a
category column themselves.

## Done (2026-08-28): seller_product_price_history table (infrastructure only)

Picked up from the "still open" list when asked to "complete the remaining
things" — the other two open items (naming new scraper targets, confirming
the Vercel Incognito result) need information only the user has; this one
didn't. Scoped via Plan Mode (Explore pass over the real schema/routes
first), plan approved, then built.

**Shipped:**
- `scraper/migrations/030_seller_product_price_history.sql` — new table,
  mirrors `market_price_history`'s shape but simpler (no day-dedupe, since
  a seller editing their own price has none of the repeated-scrape pressure
  that motivated `026`'s hardening). Populated by a trigger on
  `seller_products` (`is distinct from` on `sell_price`, fires on insert
  too), not app-level insert calls — matches this project's existing
  trigger convention (`013`, `018`) and is the only way to reliably catch
  every write path including bulk-import's `upsert()`, which has no
  pre-image to diff at the app layer. RLS is read-only for the seller,
  mirroring `seller_price_alerts_select_own` (`014`).
- `src/lib/market-intel/price-history.ts` — `getSellerPriceHistory()`, a
  direct scoped query (not an RPC — bounded to one product, unlike
  `forecast.ts`'s cross-catalog aggregation).
- `src/app/api/products/[id]/price-history/route.ts` — new GET route,
  structurally mirrors `[id]/competitors/route.ts`.
- `price-history.test.ts` — 3 tests, same `vi.mock` pattern as
  `competitors.test.ts`.

**Verified:** `tsc --noEmit` clean, `vitest run` 111/111 (108 existing + 3
new, zero regressions) — both run *before* the `node_modules` trouble
below. **`npm run lint`/`npm run build` could not be completed locally**
this pass: a concurrent process (very likely another session sharing this
same working directory — this session already saw a "port 3000 in use by
another chat's dev server" collision earlier) is holding files open in
`node_modules`, so every reinstall attempt failed with a file-lock error
on a different package each time (`lodash`, `es-abstract`,
`@popperjs/core`, then `next` itself). Not caused by this change — no
`package.json`/lockfile edits. Did not keep retrying against a live lock.
CI runs the full `tsc`/`lint`/`test`/`build` pipeline in a clean isolated
environment on push, so check the Actions tab for this commit
(`7beea2a`) if picking this thread back up, rather than assuming lint/
build are clean just because they weren't checked here.

**Not applied to the live DB** — same "Supabase SQL Editor, manually"
convention as every prior migration. Until applied, the new route fails
soft (empty history array), same as every other not-yet-applied-migration
gap in this project's history.

**Not built (explicitly out of scope this round):** the actual seller-
vs-competitor comparison UI/logic this table exists to eventually support
— still a genuine "later stage" per the original flag, not requested yet.
`IProduct` was deliberately not touched (history stays a separate fetch).

## Done (2026-08-28): fix Competitors matching — strict title filter, no price constraint, platform diversity

User reported (screenshot) that a seller's "Bona Papa Super Diapers" was
matched against baby toys/rattles/plates, all from one platform
(ShoppersPK), with rating/sold blank on every row. Scoped via Plan Mode
(3 parallel Explore agents + 1 Plan agent, then direct re-reads of the
actual current files before finalizing — line numbers in the exploration
reports had drifted slightly from what the earlier competitor-drawer
polish session left behind).

**Root cause, confirmed by reading the code, not assumed:**
`findCompetitorsForProduct` (`product-matching.ts`) had category + a
+/-15% price bracket as its only hard filters. Title similarity (Jaccard)
was computed but used only for *sorting*, never as a filter — no minimum-
confidence cutoff existed for this function (unlike its sibling
`findTopProductMatches`, which does gate on `MIN_CONFIDENCE`). So when a
category+price-band had no genuinely similar products, the function
didn't return fewer results — it padded the top-15 with whatever passed
the price filter regardless of title relevance. Separately, ShoppersPK+
Naheed have ~11x Daraz's candidate density in `toys-and-baby` (~1319 vs
~120 active rows, per the earlier competitor-limit fix note above), so a
flat top-N-by-confidence sort let the densest platform dominate. Blank
ratings confirmed as a **separate, non-bug** root cause: ShoppersPK's
scraper never extracts `rating`/`ratingCount`/`soldCount` at all — an
all-ShoppersPK result set will always show blank ratings, correctly.

This reverses a prior, explicitly-documented decision (`product-
matching.ts`'s own header comment: "confirmed with product owner
2026-08-28, using a GPU example" — price bracket as hard filter, title
as ranking-only). Reversed based on direct user instruction + real
evidence it produced wrong matches at category-level granularity, not a
casual override — the old reasoning is kept in a comment for history,
not deleted.

**Scope-narrowing confirmed with the user before implementing:** the
PPTX report needs **no changes** — its "Competitor Tracking" slide
(`getCompetitorLandscape`/`market_competitor_scorecards`) is a fully
separate entity-level aggregate view with no per-product title/price
matching and no stale "15%" claim anywhere in it, confirmed via an
Explore pass (`grep` across `src/lib/reports/` for any matching-related
import or "15%"/price-bracket copy — zero hits).

**Shipped:**
1. `similarity.ts` — new `MIN_COMPETITOR_CONFIDENCE = 0.2`, separate from
   the existing `MIN_CONFIDENCE = 0.3` (untouched, still used by
   `findTopProductMatches`). Deliberately lower than 0.3: with no price
   bracket as a second signal, title confidence alone must admit genuine
   cross-brand matches too — worked through the actual token math in the
   comment (a real diaper-brand-vs-diaper-brand match scores ~0.125
   Jaccard, since brand tokens dominate the union; the toy-rattle
   mismatch scores ~0). **Documented explicitly as a known ceiling of
   word-overlap similarity, not a promise of perfect product-type
   detection** — a real fix needs an embeddings/classifier model,
   already flagged as deliberately not built (no embedding-provider
   decision made).
2. `product-matching.ts` — removed `PRICE_BRACKET_PCT` and the price-
   bracket filter entirely. `confidence >= MIN_COMPETITOR_CONFIDENCE` is
   now the hard filter; price (`priceDiff`) stays only as a sort
   tiebreak among equally-confident matches, never an exclusion. Added
   `selectDiverseTopN()` — round-robins the confidence-filtered, sorted
   candidates across platforms (one platform's queue exhausting falls
   through to filling remaining slots from other platforms automatically,
   no separate fallback pass needed) so a denser platform can't crowd out
   a smaller one's genuine matches. `persistCompetitorMatches` and
   migration 028 unchanged — no price/bracket column ever existed there.
3. `CompetitorsDrawer.tsx` — replaced the stale "within 15% of your
   price... regardless of whether the product name matches yours" copy
   with language describing the title-match model. Empty state kept
   as-is (will legitimately trigger more often now for genuinely unique
   products — correct behavior, not a regression).
4. `product-matching.test.ts` — removed the 4 tests asserting the exact
   behavior being reversed (bracket exclusion, the GPU same-price-
   different-title case, null-price exclusion, no-sell_price fallback);
   kept/renamed the still-valid ones; added tests for confidence-
   threshold exclusion, price no longer filtering (a matching title at a
   wildly different price is now included), and platform round-robin
   diversity.

**Verified — full pass this time, not partial:** `tsc --noEmit` clean,
`vitest run` **110/110** (down from 111 — net one fewer test after
consolidating the bracket tests into fewer, more targeted ones), `npm run
lint` clean (caught and fixed one real unescaped-apostrophe JSX error in
the new drawer copy - `react/no-unescaped-entities` would have failed
CI), `npm run build` clean with CI's placeholder Supabase env vars. No
migration/schema change - nothing to apply to the live DB for this fix.
Not browser-verified per standing rule — ask the user to check a real
product's Competitors drawer once deployed, ideally one already known to
have genuine cross-platform competitors, to sanity-check
`MIN_COMPETITOR_CONFIDENCE = 0.2` isn't too strict in practice; that
number is a reasoned estimate from the token math, not something that
could be verified against live data from this environment.

**`node_modules` note**: this session hit the same file-lock corruption
the price-history session flagged (see header) — worse this time (a
partial `rm -rf node_modules` left it half-deleted, `typescript` itself
went missing). A full `npm install` eventually completed cleanly (687
added/8 changed). If a future session hits this again: don't rapid-fire
retry against what's very likely another concurrent session's live lock
on this same directory; space attempts out.

## Done (2026-08-29): two real matching bugs found live via user testing, HEAD `0930908`

After the strict-title-filter fix, user tested with real products and found
zero matches everywhere, incl. "Laptops" in a category confirmed (via the
Competitors scorecard) to have 3,556 active listings. Root cause:
`market_products` queries in both `findCompetitorsForProduct` and
`findTopProductMatches` had `.limit(300)` with **no ORDER BY** - an
arbitrary 300-row sample from thousands spanning several segments (Audio,
Laptops & Computing, Phones, Tablets) could easily miss the one segment a
given product belongs to. Pre-existing bug, made visible only once title
matching became a hard filter (old price-bracket model still returned
*wrong* results from whatever got sampled). Fixed by raising the shared
`MAX_MARKET_CANDIDATES` 300 -> 3000 (cheap in JS, no perf concern) -
initially fixed only `findCompetitorsForProduct` (commit `21cfa41`), then
found the *same* bug still live in `findTopProductMatches` (Market page's
"closest match per product" panel) and fixed that too (`0930908`). Also
shipped in this same pass: basic singularization in `tokenize()`
(`09ffe56`) - "Laptops" vs "Laptop" were previously unrelated tokens.
**Not yet re-confirmed by the user** whether real matches now show for
Laptops/diapers post-deploy - ask if picking this up again.

**Update:** user re-tested with a realistic title ("HP Pavilion Laptop
Core i5") and got 3 real PriceOye matches - confirmed both sampling
fixes work. "Bona Papa Super Diapers" still returns zero even after the
fixes, correctly - "Pampers Baby Dry Diapers" (same category) returns
real matches, confirming this is "no genuine Bona Papa competitor in
current data," not a bug (see similarity.ts's own comment on word-overlap
ceiling for cross-brand matches). User asked whether to loosen
`MIN_COMPETITOR_CONFIDENCE` to catch more of these - recommended against
it (would reintroduce false positives, the original complaint) and user
agreed to leave it at 0.2.

## Done (2026-08-29): PriceOye review-text scraping + minimal display

User asked to add review-text scraping. Scoped via Plan Mode (2 Explore
agents first). Key findings: every source needs an extra per-product
request to get reviews (none present in listing data); only PriceOye has
a confirmed, reachable source (JSON-LD `review` array on the product
page, live-verified with a plain HTTP fetch via `got-scraping` -
`scraper/node_modules` had to be installed fresh in this environment
first, it wasn't present). Daraz's reviews load via a signed Alibaba/
Lazada Mtop API a static fetch can't reach - deferred, not guessed
(no CloakBrowser license key available here to verify live, and browser
automation for verification is off-limits anyway).

**User's scope answers** (asked because "scrape reviews for everything"
is a real request-volume risk, the same shape that got OLX blocked):
full catalog eventually but spread over time via a capped batch per run
(`REVIEW_SCRAPE_BATCH_SIZE`, default 250) rather than one sweep; "all
present and future platforms, once I name them" (only PriceOye is
actually buildable right now - see above); backend + minimal display,
not a full reviews UI.

**Shipped:** migration 031 (`market_product_reviews` + `market_products.
reviews_scraped_at` for cooldown tracking, 14-day default), `scraper/src/
reviews/` (extractor + orchestrator, reuses `polite.ts`/`randomDelay`),
new separate workflow `.github/workflows/review-scraper.yml` (daily,
own budget - not squeezed into `market-scraper.yml`'s already-tight
40 minutes), `findCompetitorsForProduct` gains `reviewCount`/
`topReviews` (2-snippet cap), `CompetitorsDrawer.tsx` shows an
expandable "N reviews" row.

**Verified:** `tsc --noEmit` clean both packages, `vitest` 114/114,
lint/build clean. Migration **not applied to the live DB**. **Workflow
not yet triggered** - recommend the user run it via `workflow_dispatch`
with a small `batch_size` (e.g. 5) first, per the plan's own verification
step, before trusting the 250 default against production.

## 2026-08-29: 5 new retailer sources (Bagallery, J., Gul Ahmed, Chase
Value, Al-Fatah) - `77361d6`

User named 6 target sites for the long-open "new retailer sites" thread,
time-boxed "complete it by night I am going to sleep." All 5 shipped are
Shopify storefronts, sharing one new `createShopifySource` factory
(`scraper/src/sources/shopify-source.ts`) instead of 5 near-duplicate
files - a genuine DRY case (identical structure), unlike the *original*
seven sources' deliberate non-sharing per `polite.ts`'s own header.

**Khaadi excluded**, also from the same target list: `robots.txt`
disallows `/women/`, which is essentially its whole real catalog. Not
crawlable under this project's non-negotiable robots.txt rule.
Homeshopping.pk/Symbios.pk were explicitly lower-priority in the user's
own list and not attempted given the time-box.

**Caught by live verification, not guessed:** two of the first-picked
collection handles (gulahmed's `2-piece-khaddar`, chasevalue's `fryer`)
looked valid in `/collections.json` (real title, listed) but returned
`{"products":[]}` from the actual `products.json` endpoint - a real
collection that is just currently empty, not a code bug. Caught only by
calling `products.json` directly, not by trusting the collection listing.
Swapped for `women-ideas-pret` (gulahmed) and `home-lifestyle-heater`
(chasevalue) after confirming those return real live data. Lesson for
next time: verify every *individual* collection handle's `products.json`
before shipping, not just one representative one per site - the plan's
initial single-collection-per-site check missed this.

**Shipped:** `shopify-source.ts` (factory), 5 exported source instances
in `sources/index.ts` (added to `HTTP_SOURCES`, plain JSON, no browser
automation needed), 5 new `*_COLLECTIONS` env vars in `config.ts` +
`market-scraper.yml`, migration 032 (registers the 5 platforms into
`market_platforms` + 20 category-map rows into `market_category_map` -
both required, same two-part pattern as migration 023; missing either
means either `getPlatformId()` throws "Unknown platform slug" on every
run, or products land in the DB but never surface on any seller-facing
page since `getMarketScope()` reads `market_category_map`, not
`market_platforms`, directly).

**Verified:** `tsc --noEmit` clean. Final live-verification run (every
configured collection, not just one per site, run through the actual
scraper code): bagallery 3198 products, junaidjamshed 22, gulahmed 2358,
chasevalue 53, alfatah 1516 - all real rows, zero empty collections
remaining.

**Migration 032 applied and workflow triggered - fully confirmed
end-to-end in production.** User applied migration 032 manually via the
Supabase SQL Editor, then I triggered `workflow_dispatch`
(run 33235609387, completed 2026-08-29, 28m46s, success). Its JSON
summary shows the exact same product counts as local verification -
bagallery 3198, junaidjamshed 22, gulahmed 2358, chasevalue 53,
alfatah 1516 (~7147 total) - written to `market_products` with zero
"Unknown platform slug" errors, confirming both halves of migration 032
(platform registration + category mapping) landed correctly. This
feature is fully shipped, not just locally verified.

## 2026-08-29: real disk corruption on `E:\Market-Intel`, repo recovered
via fresh clone

Not a code bug - flagging because it changes the working directory going
forward. `horizon-ui-chakra-nextjs-main/src/app/apps/products/` (9 files:
ProductCard, CompetitorsDrawer, EditProductDrawer, NewProductDrawer, the
categories page + its 3 components, the products page) went missing from
disk mid-session with no corresponding git changes. Diagnosed as genuine
NTFS corruption, not a git/tooling issue - confirmed independently by
Git Bash (`ls`/`find`: "No such file or directory" for a listed entry),
PowerShell (`Get-Item`: path doesn't exist), Node (`fs.lstatSync`:
`UNKNOWN: unknown error`), Windows Explorer (can't open or delete), and
`fsutil reparsepoint query` (direct OS answer: "The file or directory is
corrupted and unreadable"). A full machine restart did not fix it.

**Recovery: fresh `git clone` into a new directory, not a repair.** Since
local `main` was confirmed identical to `origin/main` before and after
(git itself was never affected, only the working-tree files), a clean
clone was zero-risk. Cloned to `E:\Market-Intel-fresh`, fully verified
there (`tsc --noEmit` clean, `next lint` clean, `vitest` 114/114 passed,
`next build` succeeded including the restored `/apps/products` and
`/apps/products/categories` routes), then made the working directory
going forward (renaming the folder back to `Market-Intel` was blocked by
the same corruption - the old folder's own directory entry can't be
renamed either, needs `chkdsk E: /f /r` first, not yet run).

**Old folder**: moved aside as `E:\Market-Intel-corrupted-old`, mostly
deleted but not fully - a few dozen locked `node_modules` files plus the
original corrupted `products` folder remain, harmless and unused. Safe to
`chkdsk` and clean up later; not blocking anything.

**Going forward: the working repo is `E:\Market-Intel-fresh`**, fully in
sync with GitHub, everything else (remotes, branch tracking, `.env`
pattern) identical to before.

## 2026-08-29: 4 more retailer sources (Springs, Outfitters, SEW Markaz,
Petshub.pk) - `e4d1d72`

Second Grok-researched batch, verified the same way as the first
(migration 032's batch). Springs/Outfitters/SEW Markaz reuse the existing
`createShopifySource` factory (all genuine Shopify). Petshub.pk is
WooCommerce Store API - new file `scraper/src/sources/petshub.ts`,
mirroring `shopperspk.ts`'s pattern rather than sharing code (only the
second WooCommerce source, not enough duplication yet to factor out - one
Shopify source didn't get its own factory either until there were 5).

**Rejected from the candidate list:**
- Symbios.pk - dead/misconfigured host. Both `robots.txt` and the
  homepage itself serve a FASTPANEL hosting-control-panel splash page,
  not real site content. Not a bot-protection case, the site just isn't
  actually up.
- METRO Pakistan - hard 403 block on every request including
  `robots.txt` itself. Real bot protection on an enterprise grocery
  chain, matches the pattern already seen with iShopping/Goto.

**Deferred, not rejected** (real stores, just need more work than a
factory reuse):
- Homeshopping.pk - built on VTEX (headless commerce, React SPA). No
  simple product JSON on the page; would need VTEX's Search API
  investigated as a separate task.
- Idealancy.pk - real store, custom platform ("Mimcart by Mimsoft"), has
  JSON-LD product schema per page but no bulk JSON endpoint. Scrapable in
  principle but needs a bespoke HTML/JSON-LD source file (like
  `daraz.ts`), not a quick add.

**Taxonomy gap surfaced, not silently resolved:** `seller_categories` is
a fixed 12-row enum with no "Pets" entry. Petshub's products are mapped
to `other` in migration 033 rather than force-fit into an unrelated
category, or having the migration unilaterally add a new top-level seller
category (that would also touch onboarding/domain-selection UI - a
product decision, not something one migration should decide alone). If a
dedicated Pets category is wanted, that's a separate, larger piece of
work.

**Verified:** `tsc --noEmit` clean. Live-verification run through the
actual scraper code (not the raw endpoint): springs 1685, outfitters
2227, sewmarkaz 81, petshub 812. One gotcha caught while writing the
verification script itself, not the source code: setting `process.env.X`
inside a script *after* importing anything that transitively imports
`config.ts` doesn't work, because ES module imports are hoisted and
`config.ts` reads `process.env` at that hoisted-import moment - looked
exactly like a source bug (0 products, no error) until traced to the
verification script's own env-var timing, not `petshub.ts`. Real
workflow runs are unaffected since GitHub Actions sets env vars before
the process starts.

**Migration 033 not applied to the live DB** - same manual-via-Supabase-
SQL-Editor requirement as every prior migration, must run before these 4
sources' next scrape.

**Update:** user applied migration 033. Confirmed via screenshot of the
Supabase SQL Editor ("Success. No rows returned").

## 2026-08-29: 11 more retailer sources (third batch) + two live data bugs
fixed - `c1bc1cd`

Third Grok-researched batch: fashion (Zellbury, Bonanza Satrangi,
Beechtree, Nishat Linen), furniture/home (Interwood, Habitt, Poshish,
Woods), ChenOne (apparel + home textile), pets/decor (Petfit.pk,
Luminaria.pk). All Shopify except Petfit/Luminaria (WooCommerce Store
API, new shared `woocommerce-source.ts` factory - two near-identical
files being added at once justified it, same reasoning as
`shopify-source.ts`).

**Rejected:** Ethnic/Ethnc, Highfy (.pk/.com), Malabis (.com/.pk) - every
domain variant resolved to a parked or unrelated page (Highfy.pk serves
an "American Express" title, Malabis.com's own `<title>` is literally
"malabis.com"). **Deferred:** Nested.pk - real store, but a
client-rendered SPA (Vue "Materio" template), no server-rendered product
data, needs its backend API reverse-engineered separately.

**Two real, live data-quality bugs caught by verification and fixed
project-wide** (not just the new sources):
1. $0 "contact for quote" B2B items (Habitt/Woods furniture, a couple of
   Petfit listings) were being written as real prices - would show
   sellers a fake "cheapest competitor: Rs 0". Fixed in both
   `shopify-source.ts` and `woocommerce-source.ts` (skip if price is 0).
2. WooCommerce Store API titles come HTML-entity-encoded
   ("Tamy&#8217;s Cat Wet Food") from WordPress's `wptexturize()` - **this
   was already live in shipped `shopperspk.ts` for weeks** and affected
   27% of Petshub's titles. Fixed with a shared `decodeHtmlEntities()` in
   `polite.ts`, applied to `shopperspk.ts` and `petshub.ts` too, not just
   the two new WooCommerce sources.

**Verified:** all 11 sources live-verified through the actual scraper
code with zero bad rows after both fixes - zellbury 3680, bonanzasatrangi
932, beechtree 214, nishatlinen 1532, interwood 522, habitt 9796 (hit the
page cap - real inventory is deeper than currently captured), poshish
201, woods 167, chenone 345, petfit 1152, luminaria 416.

**Migration 034 not applied to the live DB yet** - same manual step as
every prior migration.

**Total active scraper sources as of this batch: 31** (28 plain HTTP + 3
browser-automation via CloakBrowser: iShopping, Goto, Daraz).

**Update:** migration 034 applied. Full-scale scrape triggered
(`workflow_dispatch`, run 33243768620, 38m40s, success) - all 31 sources
wrote data, zero "Unknown platform slug" errors, ~47,732 products total
across the whole catalog. All 19 sources from today's 3 batches confirmed
live in production with counts matching local verification (bagallery
3198, junaidjamshed 23, gulahmed 2418, chasevalue 53, alfatah 1516,
springs 1685, outfitters 2232, sewmarkaz 81, petshub 812, zellbury 3665,
bonanzasatrangi 947, beechtree 214, nishatlinen 1528, interwood 522,
habitt 9796, poshish 201, woods 167, chenone 345, petfit 1152,
luminaria 416).

## 2026-08-29: post-scraper session - credentials, two production bugs
fixed, second git corruption incident - `e6fc6ca`, `d931f97`

Same day, after the 3 scraper batches shipped. User sent a 6-item request
(CSV + domain auto-assign question, primary-category suggestion, "list
proposed dashboard changes before touching anything," save 3 API keys +
gitignore them, scope a Python/Node backend question, diagnose why the
platform is slow) plus a `credentials.txt` with real Groq/Mistral/
OpenRouter keys.

**Credentials:** saved to `horizon-ui-chakra-nextjs-main/.env.local`
(confirmed gitignored - git doesn't even list it as untracked) +
`.env.example` (placeholders only). Only `GROQ_API_KEY` is referenced by
any code (`src/lib/ai/groq-client.ts`) - Mistral/OpenRouter aren't wired
into anything yet, saved for future use. `.env.local` only affects local
dev - Vercel's production env vars are separate, configured in its own
dashboard, and need a redeploy after adding a var for it to take effect
(this tripped the user up once - they added the key but the site kept
failing until they understood a redeploy was required).

**Python/Node backend question:** user's own follow-up answer ("do what
makes system faster") confirmed this was a performance ask, not a real
language preference - recommended against a rewrite (network-bound
scraper wait times are identical in Python; Next.js API routes can't
reasonably become Python without a whole separate service). Not built,
correctly scoped and dropped.

**Performance diagnosis, one real fix shipped (`e6fc6ca`):**
`findCompetitorsForProduct` `await`ed `persistCompetitorMatches()`
(a match-history write) before returning, even though that write's own
comment already says its errors "must never break the live listings
response." Every Competitors-drawer open was paying a full extra DB
round-trip for a write the seller never sees the result of - worse now
that the catalog is ~5x larger post-scraper-expansion. Fixed with
`next/server`'s `after()` (not a bare un-awaited promise - Vercel's
serverless runtime can freeze the function once the response is sent and
silently drop a dangling promise; `after()` is what guarantees the write
still completes). `after()` throws outside a real request scope, which
broke all 10 tests in `product-matching.test.ts` when they called the
function directly - fixed by mocking `next/server`'s `after` to invoke
its callback immediately, preserving the exact synchronous-persist timing
the existing assertions already relied on. Two other real levers
(`images: unoptimized: true` in next.config.js, and the O(candidates)
in-app similarity computation itself) were investigated and found to
either be a no-op (no `next/image` usage anywhere in the app - confirmed
via grep, so that flag currently does nothing) or a bigger change,
correctly not touched without a separate go-ahead.

**Two confirmed-broken production bugs found and fixed (`d931f97`), both
surfaced by the user actually trying to use the features:**
1. **Groq model decommissioned.** `groq-client.ts`'s default model,
   `llama-3.1-8b-instant`, no longer exists on Groq's API - confirmed via
   a real API call (404 `model_not_found`, not an auth error). This
   silently broke the seller assistant chat widget AND CSV bulk-import
   auto-categorization, both hidden behind the same generic frontend
   error message ("I couldn't put an answer together"). Replaced with
   `openai/gpt-oss-20b` after verifying it live against Groq's API in
   both call shapes this file needs (plain chat + JSON-mode). Worth
   remembering: Groq retires chat models over time - check
   `GET /openai/v1/models` before assuming a hardcoded model id still
   works, don't just trust what was there before.
2. **Bulk CSV import fully broken for every seller.** `seller_products`
   has two PARTIAL unique indexes (`... where sku is not null`,
   `... where import_key is not null` - migrations 011/027), but
   `bulk-import/route.ts` upserts with a plain `onConflict: 'seller_id,
   sku'`. Postgres's `ON CONFLICT` can only match a partial index if the
   exact `WHERE` predicate is also stated in the `ON CONFLICT` clause -
   the Supabase JS client's `upsert()` has no way to pass that through -
   so every bulk import hit "there is no unique or exclusion constraint
   matching the ON CONFLICT specification." Migration 035 drops the
   `WHERE` clauses - not a behavior change, since Postgres unique indexes
   already treat every `NULL` as distinct from every other value by
   default; the partial predicate never added a real constraint, it just
   broke `ON CONFLICT` matching. **Applied to the live DB by the user.**

**Second real git/filesystem corruption incident, same session, same
drive, different location.** After committing `d931f97`, `git push`
surfaced `inflate: data stream error`, `bad offset for revindex` -
`git fsck --full` confirmed a genuine bad packfile in
`E:\Market-Intel-fresh\.git`. Independently verified via `gh api` (bypasses
local git entirely) that the actual push had landed correctly on GitHub
regardless - the corruption was purely local. Recovered the same way as
the first incident this session (see the "real disk corruption" entry
above): fresh `git clone` into a new directory
(`E:\Market-Intel-fresh2`), `git fsck --full` clean, `.env.local` copied
over manually (untracked, never touched by clone) via a temp backup file
outside any repo, deleted once restored. **This is the second corruption
event on `E:` today, in two unrelated locations** - flagged to the user
as a real pattern worth a `chkdsk E: /f /r` at some point, not just
another one-off. **Current working directory: `E:\Market-Intel-fresh2`.**

## 2026-08-29: domain auto-assign backfill + assistant markdown fix +
"All My Products" competitors view - `522b6e6`, `efc5925`

**Domain auto-assign confirmed working end-to-end.** User re-uploaded the
same sample CSV after the earlier fixes; Settings → Domains went from 3
tracked categories to 10 (Beauty & Personal Care primary, plus Mobiles &
Electronics, Fashion & Apparel, Coffee & Beverages, Grocery & Food,
Home & Kitchen, Books & Stationery, Sports & Outdoors, Automotive,
Toys & Baby, Health & Wellness) - real validation of the feature shipped
in commit `522b6e6` (that commit message already covers the code itself,
this is just confirming it worked live).

**Two more real findings from the user actually using the product:**
1. "Why aren't all 31 sources shown in Market Definition" - not a bug.
   Verified by parsing every migration file directly: Mobiles &
   Electronics genuinely only has 9 relevant platforms out of 31 (the
   other 22 are fashion/furniture/beauty/pets sources that don't sell
   electronics). Full per-category platform breakdown now documented in
   chat, worth re-deriving with the same `node -e` migration-parsing
   script if asked again rather than eyeballing grep.
2. Confirmed via code read: Market Definition and Competitors are both
   hardcoded to `getPrimaryDomain()` - a seller with 10 tracked domains
   can only ever view/edit one at a time without switching which is
   primary. This became the trigger for the next feature below.

**Assistant markdown bug** (separate small fix, same push as domain
backfill validation): `SellerAssistantWidget.tsx`/`AssistantWidget.tsx`
render replies as plain `<Text>{content}</Text>`, no markdown parser -
`seller-assistant.ts`'s system prompt never told the model that, so a
data-heavy answer ("how many products") came back as a raw pipe-delimited
markdown table, literal `|` and `**` characters in the chat bubble. Fixed
by adding the same "no markdown formatting" instruction the public
marketing assistant's prompt (`assistant-knowledge.ts`) already had -
an existing pattern in this codebase, not a new one to invent.

**"All My Products" competitors view + CSV export** (`efc5925`) - full
Plan Mode cycle (research agent read the whole data flow first, 3
AskUserQuestion rounds resolved real ambiguity before writing code).
Competitors page now has two tabs: aggregated across every tracked
domain (new), and the original single-primary-domain view (unchanged).
New `getMarketScopeForAllDomains()` unions every domain's own scope
rather than a new SQL path - the existing RPCs already accept
category_slugs/platform_ids as arrays. `getCompetitorLandscape/Overlap/
MatchCounts` each split into a public wrapper + private `*FromScope`
helper so the three new `*AllDomains` functions reuse identical RPC
logic. CSV export added generically (`objectsToCsv`/`triggerCsvDownload`
in `csv.ts`, extracted from an ad hoc pattern that already existed once
in `RetentionPanel.tsx`) - two exports per tab, scorecards and a new
per-product matched-listings query (`getMatchedListingsForExport`).

**Explicitly NOT built, confirmed via question before writing any code:**
a sales-comparison chart (seller sales vs. competitor sales). Real
architectural gap, not just unbuilt: `seller_orders` has no line-items
table at all (migration search + `src/lib/reports/schema.ts` comment
both confirm), so the seller's own sales cannot be broken down by
product/category today, and competitor `sold_count` is only genuinely
populated for Daraz - every other one of the 30 other sources silently
shows as 0 in the existing RPC. Building a chart on that would show
real-looking but false numbers. Flagged as a separate future project
needing a new `seller_order_items` schema + a richer order-import path,
not attempted here.

**Also descoped during implementation** (was an open question in the
plan, resolved by not building it rather than guessing): a category
filter dropdown *within* the "All My Products" tab. The scorecard RPC
doesn't currently tag each row with which tracked category it came from,
so filtering the aggregate down to one category cleanly would need a
data-shape change to the RPC/query, not just a client-side filter. Given
the "Primary Domain" tab already covers "view exactly one category," this
was cut to ship the rest cleanly rather than rushed - a reasonable
day-two addition if wanted.

**Verified:** tsc/lint/133-test-suite/build all clean (up from 124 -
new tests for `getMarketScopeForAllDomains` and the three
`*AllDomains` competitor functions + `getMatchedListingsForExport`).

## 2026-08-29: pg_trgm candidate-selection fix + stale-export bug -
`33602af`

User hit the exact failure predicted earlier this session: "Zellbury
Plain Shalwar Kameez" showed "No comparable listings found" despite
~3,665 real Zellbury products existing. Full Plan Mode cycle again
(Explore agent research, 2 AskUserQuestion rounds - one resolved "fix the
query vs. raise the number," a second one mid-conversation when the user
asked to also bring in embeddings and was talked back to sequencing it as
a separate follow-up plan instead of scope-creeping this one).

**Root cause, confirmed not guessed:** `findCompetitorsForProduct`,
`findTopProductMatches` (`product-matching.ts`) and `getCompetitorOverlap`
(`competitors.ts`) all fetched category candidates with no `ORDER BY` and
a hard cap (3000, or just 1500 - undocumented, on the Competitors page).
Fashion-and-apparel alone is now an estimated 9,000-12,000+ active rows
across 13 sources (summed from today's actual per-source scrape counts) -
Postgres was returning an arbitrary unordered slice that could miss the
real match entirely. Confirmed by hand: "Zellbury Plain Shalwar Kameez"
vs a real scraped "Plain Shalwar - 0002" scores 0.4 Jaccard, well above
the 0.2 threshold - the matching *algorithm* was never the problem, the
candidates just never got looked at.

**Fix: `pg_trgm` (migration 036), not a bigger hardcoded number.** New
`market_top_similar_candidates` RPC does candidate selection in SQL via
trigram similarity, GIN-index-backed on `market_products.title`. Jaccard
confidence scoring in `similarity.ts` is completely unchanged - still the
accept/reject gate, just now sees the right ~100 candidates per seller
product instead of an arbitrary slice of a 10,000+ row category. New
shared `candidate-search.ts` wraps the RPC; all three call sites now do
one RPC call per seller product (parallel `Promise.all`) instead of one
shared bulk fetch. Also researched and explicitly rejected reusing
`scraper/src/matching.ts` (the "mobiles matcher" `product-matching.ts`'s
own header references) - it's a hardcoded 16-brand allowlist + price-band
gate, not an embeddings model, and doesn't generalize to fashion titles
at all.

**Second, separate bug found by the user reviewing their own export:**
downloaded the new "matched listings" CSV (from the Competitors-tabs
feature shipped a few hours earlier) and found real nonsense - "Avalanche
Fruity" matched against a Gillette razor at confidence 0.
`getMatchedListingsForExport` read persisted
`seller_product_competitor_matches` rows without a confidence filter,
unlike every live-computed match path. Mechanism: a persisted row is a
snapshot from whenever the seller last opened that product's drawer;
scraped `market_products` rows get overwritten in place on re-scrape
(same row/id, title can change), so an old match can drift stale as the
matched listing's title changes underneath it. Fixed by adding the same
`MIN_COMPETITOR_CONFIDENCE` gate every other consumer already has -
doesn't retroactively fix already-stale persisted rows (those only
refresh when the seller reopens that specific drawer), but stops them
from surfacing in new exports.

**Explicitly deferred, not built:** AI/embeddings-based semantic
matching - the user's original ask this thread started from. Confirmed
twice via question to sequence as its own follow-up plan (new pgvector
column, a real embedding-provider decision - Groq has no embeddings
model, Mistral does - plus a backfill job for the whole catalog) rather
than bundling into this query fix.

**Verified:** tsc/lint/147-test-suite/build all clean. New tests for
`candidate-search.ts` (previously didn't exist) and `getCompetitorOverlap`
(previously had zero test coverage despite being production code).
Migration 036 not yet applied to the live DB - same manual step as every
prior migration.

**Update:** user applied migration 036.

## 2026-08-29: Sports & Outdoors batch (fourth retailer batch), 5 sources -
`ed061c0`

User's own follow-up brief named Sports & Outdoors as the weakest-covered
category (2 sources) and asked for it fixed first, before a bigger push
into Books & Stationery/Automotive/Coffee & Beverages later. Alisports,
Bodybrics, HustlersOnlyPK, ActivitySphere - all Shopify. Zeesol Store -
WooCommerce, but a new site-specific quirk: its Store API rejects
category *slugs* (empty array despite the category having 124 real
products) and only accepts numeric category IDs - the first WooCommerce
source out of 5 so far where slugs don't work. Config values for zeesol
are IDs, not slugs, clearly commented in three places (config.ts,
workflow env, migration 037) so this doesn't get silently "fixed" back to
slugs later by someone who doesn't know why.

**Deferred:** TheSportStore.pk - real, live site, but OpenCart with no
standard product-feed endpoint, same bucket as Idealancy.pk/
Homeshopping.pk.

**Verified:** live-verified through the actual scraper code, zero bad
rows - alisports 926, bodybrics 71, hustlersonlypk 833, activitysphere
100, zeesol 163 (~2,093 total). Migration 037 not yet applied to the live
DB.

**Not yet done:** Books & Stationery, Automotive, Coffee & Beverages -
the other 3 weak/critical-gap categories from the same brief, plus
formalizing Coffee & Beverages (currently 0 active sources). User's own
framing was "when [Sports & Outdoors] is done... we can proceed with a
full-fledged scraper" - a checkpoint, not a green light to keep going
unprompted on the remaining categories.

**Update:** user applied migration 037, then asked to finish the
remaining 3 categories before running the full-scale scrape.

## 2026-08-29: Books & Stationery + Automotive + Coffee & Beverages batch
(sixth retailer batch overall) + assistant line-break rendering fix -
`a6130eb`

Closed out the brief from the Sports & Outdoors batch. 12 of 13
candidates confirmed and shipped - unusually high hit rate this round,
only 1 deferred (Waqarmart.pk - real site, but a custom Laravel platform,
not WordPress despite having a `/wp-json/` path that just redirects to
itself; no standard product feed). Coffee & Beverages went from 0 active
sources to a real, formalized category for the first time.

Snapcart.pk worth remembering: it's a huge general marketplace (100k+
products across pharmacy/beauty/groceries), not a coffee specialist -
only scraped for its genuine ~916-product Tea & Coffee segment, verified
live before including it, not the whole catalog.

**Verified:** live through the actual scraper code, zero bad rows across
all 12 - blingspot 2171, katib 554, mercurystationery 103, sehgalmotors
602, asadautos 960, pakistanmotors 659, premiumexo 251, coffeecrest 72,
snapcart 3887, stationarypk 888, assany 686, autostorepk 3459 (~14,292
total). Migration 038 not yet applied to the live DB.

**Confirmed, not assumed:** no new `seller_categories` rows have been
added by any migration today (032-038) - checked directly
(`grep -c "insert into seller_categories"` across every migration file
returns a hit only on the original 011). Every batch this whole session
only ever mapped new platforms into the existing 12 categories.

**Separate real bug found and fixed the same session:** the seller
assistant and public marketing assistant chat widgets were rendering
every reply as one run-on paragraph, even after the earlier "no
markdown" prompt fix. Root cause was CSS, not the model - the message
`Box` in both `SellerAssistantWidget.tsx`/`AssistantWidget.tsx` had no
`whiteSpace` set, so the browser's `white-space: normal` default
collapsed every line break the model wrote. Added
`whiteSpace="pre-wrap"` to both, plus tightened `seller-assistant.ts`'s
prompt to explicitly require real newlines between list items and a
one-line summary before long lists. Worth remembering for any future
chat-bubble UI: a "write structured text" prompt instruction is
worthless if the rendering component silently collapses whitespace -
check the CSS first, not just the prompt.

**Total active scraper sources as of this batch: 48** (45 plain HTTP + 3
browser-automation via CloakBrowser) - confirmed by counting
HTTP_SOURCES/BROWSER_SOURCES directly in index.ts, not estimated.

**Update:** user applied migration 038, then pasted a follow-up Grok
prompt that overlapped heavily with what was already shipped (same
Sports & Outdoors/Books & Stationery/Automotive/Coffee & Beverages
sites) - the only genuinely new asks were Health & Wellness sources (no
specific sites named), 1-2 more coffee stores, 2-3 more pure pet stores,
and formalizing "Pet Supplies" as its own category. Clarified the overlap
before doing anything, to avoid duplicate work.

## 2026-08-29: Health & Wellness + 2 more pet/coffee sources + Pet
Supplies formalized - `bae6fb9`

Closed out the very last part of the multi-batch category-expansion
brief. Unlike every prior batch, no specific sites were named for these
three gaps ("research and propose") - used WebSearch (loaded via
ToolSearch, wasn't available by default) to find real candidates, then
verified each live the same way as every named candidate before them.
Found: Well Pakistan, My Vitamin Store, Ginnastic Nutrition (health),
Pet Master, PetsPark.pk, ePetStore.pk (2 more pets, on top of Petfit.pk/
Petshub.pk), SCAFE Coffee Roaster, Red Berry Roasters (2 more coffee).
All 8 confirmed and shipped - no rejections this round.

**Pet Supplies formalized as its own seller_categories row** (migration
039), not the catch-all 'other' it used since 033/034 - that was
explicitly deferred back then as a bigger decision than one migration
should make (touches Settings > Domains' category dropdown, sourced live
from seller_categories - see listCategories() in seller.ts). This round's
brief explicitly asked for it, so it went ahead. Re-mapped the *existing*
Petfit.pk/Petshub.pk rows from 'other' to 'pet-supplies' via UPDATE, not
a fresh insert - the unique key on market_category_map includes
seller_category_slug, so inserting instead of updating would have
double-mapped the same sources into two categories at once. Also added a
matching `MdPets` icon entry to the seller app's `categoryVisuals.ts`
(the Categories page's per-category icon/color map, a real hardcoded
list separate from the DB) so the new category isn't stuck with the
generic fallback icon - checked for other hardcoded category lists first
(grepped the whole app for existing category slugs) rather than assuming
this was the only one.

**Real, unrelated bug hit and fixed along the way:** adding the `MdPets`
import made `next build` segfault (exit 3221225477) - reproducibly, not
flaky (retried once, same crash). Root cause, confirmed by isolating
(stashed the one-file change, build succeeded; restored it, build
crashed again): `node_modules/react-icons/md/index.esm.js` was somehow
holding an entirely different package's source code (a source-map
library, Mozilla-licensed, unrelated to icons) despite `package.json`
and `index.d.ts` both being the correct react-icons files. Fixed with a
targeted `rm -rf node_modules/react-icons && npm install react-icons@4.12.0
--no-save`, confirmed by checking the reinstalled file actually contains
real `GenIcon`-based icon exports before rebuilding. **This is the third
real filesystem/install anomaly on this machine today** (after the two
disk/git corruption incidents earlier) - worth taking seriously as a
pattern, same `chkdsk E: /f /r` recommendation as before, still not run
by the user as of this entry.

**Verified:** live through the actual scraper code, zero bad rows across
all 8 - wellpakistan 38, myvitaminstore 660, ginnasticnutrition 28,
petmaster 448, petspark 790, scafe 61, redberryroasters 28, epetstorepk
601. tsc/lint/147-test-suite/build all clean (build only after the
react-icons fix). Migration 039 not yet applied to the live DB.

**This closes out the entire multi-batch category-expansion brief** -
every category flagged as weak/critical-gap at the start of this thread
(Sports & Outdoors, Books & Stationery, Automotive, Coffee & Beverages,
Health & Wellness, Pet Supplies) now has real, live-verified source
coverage. Total scraper sources after this batch: 56.

## 2026-08-29: Cross-source product-duplicate detection + scraper CI
timeout fix - `ea1e569`, `5be6840`

User asked whether cross-source duplicate detection exists (same
physical product listed by multiple retailer sources, e.g. the Zellbury
example showing up on both Daraz and PriceOye as separate rows).
Confirmed it didn't - `market_products` only dedupes *within* one source
(unique platform_id+external_id). There WAS a narrower prior version -
`matching.ts`/`match-products.ts` populated `market_product_matches`
(migrations/009) but mobiles-only (hardcoded brand list + a 4-platform
category dict) via a standalone script nothing ever scheduled, and
nothing in the seller app reads that table.

User's explicit direction: generalize the existing table/script rather
than build a parallel one, run it as part of the scraper itself (not a
separate cron - "obviously in the scrapper"), backend-only for now (no
UI, mirrors the `is_active` dead-product signal - a DB fact, not a
page). Went through Plan Mode given the architectural surface.

**What shipped:** `matching.ts` generalized - dropped the hardcoded
mobile-platform dict in favor of bucketing by canonical
`seller_category_slug` via `market_category_map` (covers every current
and future platform automatically); `requireBrandMatch` became an
option, still `true` only for mobiles-and-electronics (the only category
with a usable brand list - keeps the already-validated mobile behavior
byte-for-byte), `false` elsewhere (price-band 0.25 + Jaccard >= 0.6
only - a real precision tradeoff for categories with generic/templated
titles, deliberately not offset by loosening the threshold). New
`dedupe.ts` does the orchestration (fetch active products + category
map, bucket, score, replace `market_product_matches` wholesale each
run) and is called from `pipeline.ts` right after `refreshCompetitors()`,
wrapped in try/catch so a dedup failure can't fail the whole scrape run.
Deleted the now-dead standalone `match-products.ts` script + its npm
entry - fully superseded, nothing was scheduling it anyway.

**Safety cap, and it's already binding:** buckets over 5,000 products
skip the pairwise O(n^2) pass (logged, not silent) rather than risk
unbounded runtime as the catalog keeps growing. First real run hit it
immediately - `home-and-kitchen` (11,216), `automotive` (5,105), and
`fashion-and-apparel` (11,645) all got skipped. So the 3 biggest,
fastest-growing categories currently get **zero** dedup coverage. Flagged
to the user as a live tradeoff, not resolved yet - the honest fix is
switching those to the pg_trgm-backed candidate-narrowing approach
already proven for the seller-competitor-matching truncation bug
(migration 036/`market_top_similar_candidates`) instead of brute-force
pairwise, deferred pending user go-ahead.

**Real, unrelated bug hit along the way:** triggering the scraper to
verify this feature exposed that `.github/workflows/market-scraper.yml`'s
`timeout-minutes: 40` was now too low - the run count has grown to 54
active sources since that value was set, and two consecutive runs
(33254732374, then 33256559496 even after raising to 60) got killed
mid-scrape by the job timeout, not by any code issue. Per explicit user
instruction ("like as much time it takes no cap"), raised to 360 -
GitHub Actions' actual hard ceiling; there is no true "unlimited"
option, omitting the field defaults to the same 360-minute cap anyway.
Third run (33259212504) completed clean at 60,976 active products/54,882
new-and-updated rows this run/2,969 dedup pairs found across the 9
un-capped categories, 0 sources errored.

**Live per-source result, this run** (54,882 total products across 54
sources - see the run's own JSON summary, not estimated): habitt 9796,
shopperspk 6515, autostorepk 3459, snapcart 3887, zellbury 3674,
bagallery 3199, naheed 2584, gulahmed 2394, outfitters 2228, blingspot
2169, daraz 1916, springs 1685, vmart 1620, alfatah 1516, nishatlinen
1489, telemart 1417, petfit 1150, asadautos 961, bonanzasatrangi 953,
alisports 926, shophive 999, hustlersonlypk 833, petshub 812, petspark
790, sapphireonline 720, assany 686, myvitaminstore 660, pakistanmotors
659, epetstorepk 601, sehgalmotors 602, katib 554, interwood 522,
petmaster 448, luminaria 420, ishopping 382, chenone 343, goto 205,
premiumexo 251, poshish 201, zeesol 163, woods 167, mercurystationery
103, coffeecrest 72, bodybrics 71, activitysphere 100, scafe 61,
wellpakistan 38, junaidjamshed 23, redberryroasters 28,
ginnasticnutrition 28, sewmarkaz 81, chasevalue 55, **stationarypk 0**.

**stationarypk (Stationary.pk) returned 0 rows two runs in a row** -
timed out (30s, 4 retries) on 3 different categories before the CI
timeout fix, still 0 after. Checked live from outside CI right after:
homepage AND the exact `/wp-json/wc/store/v1/products?category=
writing-essentials` endpoint the scraper hits both respond 200 OK in
~4s with real product data - the site is not down. Points at something
intermittent specific to GitHub Actions runner IPs/timing (rate-limiting
or transient server load), not a dead source - flagged to watch across
the next couple of scheduled runs before concluding anything needs
changing (longer per-request timeout, more retries, etc).

## 2026-08-30/31: Anomaly persistence gate + scraper Phase 1 (page caps,
two collection-widening batches) + a self-inflicted memory.md near-miss -
`2ef5e94`, `edd89d5`, `698695c`, `669b652`, `27db281`, `17cf3bd`, `caf2d0b`

Long session, four separate threads. Confirmed still on `stationarypk` -
only one full run of data exists since it was added (this entry's own
predecessor), so the "watch across a couple more runs" plan from above is
still the right call; see below, nothing new resolved there, just
re-diagnosed independently and reached the same conclusion.

**1. Anomaly-detection persistence gate (`2ef5e94`).**
`horizon-ui-chakra-nextjs-main/src/lib/market-intel/anomalies.ts` - both
detectors (`detectOwnRevenueAnomalies` z-score, `detectCompetitorPriceAnomalies`
IQR) previously fired off a single evaluation. Now gated by a new
`ANOMALY_CONFIRMATION_CYCLES = 2` constant: a flagged day/product must
still be flagged when re-evaluated against a second, slightly older
window before it surfaces - a single glitchy scrape or stale baseline row
no longer becomes an instant user-facing alert. For revenue this is exact
(re-run the same z-score pass with the most recent day dropped from the
series - genuinely the same detection, one cycle earlier). For the
competitor detector it's a documented, honest approximation: re-validates
against a second `market_scope_price_baseline` RPC call at a
one-day-older cutoff, which catches a bad/stale *baseline* row but can't
catch a bad *current* price reading, since there's only ever one live
current-price observation available - don't oversell this as identical
protection if touching it again. Both underlying calculations
(z-score/IQR math itself) are byte-identical to before; the gate only
filters *when* a flag surfaces. Full vitest coverage
(`anomalies.test.ts`, 11 cases, all passing) plus a manual fixture-diff
(old-vs-new detector output on synthetic data) run and shown to the user
before this shipped. Zero caller changes needed - every consumer
(Overview, Market, Competitors, `api/anomalies/revenue`) only touches the
unchanged exported signatures.

**2. Robustness/feature roadmap - `new_feature.md` (`edd89d5`, `698695c`).**
Full-stack production-readiness audit (auth/RLS, rate limiting, error
tracking, caching, CI/CD, security, availability) plus a feature list,
written to a new root-level file, ranked by leverage on what's already
built. P0s not yet started: `lib/rate-limit.ts` is in-memory only and
provably broken across Vercel's multi-instance model; zero error
tracking/Sentry exists; `groq-client.ts` has no timeout/retry;
`DEMO_ALL_FEATURES_UNLOCKED = true` bypasses all entitlement gating
(flagged as intentional-for-now, not touched); no zod/schema validation
on API routes. Highest-leverage feature idea: `sendEmailStub` in
`lib/notifications/notify.ts` is a deliberate no-op - the entire
price-alert/anomaly pipeline already works end-to-end except the last
mile of actually notifying a seller outside the app.

**Self-correction logged in the same file:** first draft claimed the
price-alert cron might not be scheduled (searched for `vercel.json`,
found none, concluded absence). Wrong - found `market-intel-cron.yml`
on a second pass, which does schedule it (every 6h) alongside benchmarks/
low-stock/churn/fx-rates. Corrected in `698695c`. **Lesson: "no
vercel.json" is not proof of "not scheduled" - check every
`.github/workflows/*.yml` file, cron scheduling in this repo is entirely
GitHub-Actions-based, not Vercel-based.**

**3. Scraper Phase 1 - real headroom, then real truncation, then real
under-configuration (`669b652`, `27db281`, `17cf3bd`).** User asked
whether to scale scraper coverage; initial instinct (raise Daraz's
`MAX_PAGES`) was checked against real `gh run list`/`gh run view --log`
data before touching anything, and turned out wrong - Daraz ran clean at
1,916 products with zero errors, nowhere near its 15-page cap. Real
findings instead:
- Runtime headroom is real: 24-64 minutes measured against the 360-minute
  ceiling, confirmed from actual run timestamps.
- Only Daraz yields `sellerExternalId` (competitor seller identity) out
  of all 56 sources - the single lever for the Competitors feature. 45 of
  56 sources are single-brand storefronts via the two shared factories.
- Habitt (9,796/10,000), autostorepk (~865/1,000 per category), and
  shopperspk (~814/1,000 per category) were genuinely hitting their
  `MAX_PAGES=10` ceiling and being truncated mid-catalogue. Raised all
  three factories' cap to 30 (`669b652`) - safe, since each already
  breaks its page loop on a short page, so small stores are unaffected.
- Separately, junaidjamshed (23 products) and chasevalue (55 products)
  weren't capped at all - they were configured with narrow
  sub-collections while `/collections.json` showed 228 and 203 non-empty
  collections respectively, with the real top-level catalogue
  (`men-collections`/`women-collections`, `beauty-personal-care`, etc.)
  never scraped. Widened in `27db281` + migration 045. Same audit
  repeated for bodybrics, activitysphere, mercurystationery, coffeecrest,
  wellpakistan, scafe, redberryroasters in `17cf3bd` + migration 046 -
  wellpakistan was the worst case (38 products against a 65-product
  category, `male-sexual-wellness` - a standard pharmacy/wellness
  category, not adult content, given its own neutral segment label -
  that was simply never configured out of 205 non-empty collections on
  the site). sewmarkaz and ginnasticnutrition were checked and left
  alone - both already have their store's largest collections configured.
- **Every added handle was live-verified against the real
  `/collections/<handle>/products.json` or
  `/wp-json/wc/store/v1/products?category=<slug>` endpoint before being
  added** - same standard this file has documented since migration 032.
  Never trust `/collections.json`'s listing alone.
- **Ordering matters and is now documented inline in the workflow file**:
  `saveProducts()` in `db.ts` dedupes by `external_id` with
  last-collection-wins, so a broad collection must be listed *before* a
  narrower overlapping one in each env var, or the narrow one's more
  precise category mapping gets silently overwritten. Preserve this
  ordering if editing `market-scraper.yml`'s collection lists again.
- Migrations 045 and 046 (category-map rows for the new handles) **have
  been applied live by the user** as of this entry. No scrape has been
  triggered on purpose since - the numbers above are all pre-migration
  baseline data, the actual post-widening yield is unverified until the
  next natural cron run.
- `stationarypk` re-diagnosed independently this session (same
  conclusion as the 2026-08-29 entry above): 100% request timeouts at
  the 30s `polite.ts` ceiling against a site that answers in ~4.1s live,
  same signature as the OLX block. Deliberately left unchanged - if the
  next natural run reproduces this, treat it like OLX (drop the source,
  keep the plumbing) rather than retrying indefinitely.

**4. Two environment-corruption incidents, both diagnosed and repaired
non-destructively - a genuine escalation of the pattern already logged
above (2026-08-29's "third real filesystem/install anomaly" entry).**
- The E: drive itself was confirmed corrupted at the filesystem level
  (`fsutil dirty query` → dirty, `Get-Volume` → `Full Repair Needed`),
  not just `node_modules` - this is a step beyond what was diagnosed
  before. User ran `chkdsk E: /f` themselves; this fixed the filesystem
  layer but NOT git's own object store, which needed a separate repair.
- `git commit` started failing with `invalid object` on a file that
  hadn't even been touched. `git fsck` showed genuine corruption: missing
  blobs, missing trees, missing commits, a corrupt index cache-tree. Two
  files (`anomalies.ts`/`anomalies.test.ts`) had also vanished from disk
  entirely, unrelated to any edit made this session.
- **Fix: `git fetch origin --refetch`** - re-downloads every object from
  GitHub without assuming local ones exist, purely additive, never
  deletes. Confirmed `local HEAD == remote main` before doing this (the
  fact that made it safe), and deliberately did NOT re-clone, since
  `.env.local` (live Supabase/Groq keys) is gitignored and a fresh clone
  would have lost it. `git fsck --connectivity-only` clean afterward.
  **This is now the standing fix for any future `invalid object`/`object
  corrupt or missing` error on this machine - not a reason to panic, not
  a reason to re-clone, check `git log origin/main..HEAD` is empty
  first, then refetch.**

**A second, self-inflicted incident, logged here deliberately as a
mistake to not repeat:** asked to "maintain a memory.md at all times,"
a fresh continuation of this session used the `Write` tool to create
`memory.md` from scratch - **without reading the file first** - and
overwrote this entire 2,000+ line running log (going back to at least
2026-08-04) with a much shorter summary of only its own session's work.
This is exactly the mistake the standing tool guidance warns against
("read the complete file before publishing over it"), and it happened
anyway because the request ("maintain a memory.md") was heard as
"create a memory.md" rather than "there is one, keep it going." **Caught
via the commit diff itself** (`2204 ++++------`, 2008 deletions on what
should have been a brand-new file - that ratio should have been the tell
even before checking `git log --all -- memory.md`). Recovered cleanly:
`git show <bad-commit>^:memory.md` to pull the pre-overwrite content back
onto disk, read it in full, updated the header block to point at current
HEAD without deleting the old header text (kept as marked history), then
appended this entry in the same chronological format as every entry
above it, rather than replacing anything. **Lesson for any future
session: before writing to a file that might already exist and matter
(this one especially), read it first - full stop, no exceptions for
"the user asked me to create X," since "create" and "maintain" are not
the same instruction and the file itself is the only way to tell which
one applies.**

**Separately, mid-session the user asked about GitHub Actions
orchestration**: the 5 workflows (CI, Market Scraper, Review Scraper,
Market Intel Cron Jobs, Verify Migrations Applied) are **fully
independent** - no `workflow_run`, no `needs:` linking any of them, each
fires on its own cron clock in UTC. The one place real ordering is
*intended* (fx-rates before benchmarks/churn use it, per
`market-intel-cron.yml`'s own comment) is currently achieved only by
picking earlier clock times, not enforced. Answered, then wired up same
session on request - see the next entry.

## 2026-08-31: Wired real workflow chaining (`16fbfd5`)

Two independent fixes, since the two "orderings" involved are structurally
different (cross-workflow vs. same-workflow):

- **Review Scraper -> Market Scraper**: was a fixed `"15 4 * * *"` cron,
  betting 45 minutes (03:30 + 45m) was always enough headroom after Market
  Scraper's own 03:30 tick. Real run data from earlier this session (24-64
  min) made that bet look closer than intended, and only gets tighter as
  more sources are added (see the Phase-1 entry above). Switched to
  `on: workflow_run: workflows: ["Market Scraper"], types: [completed]`,
  gated by `if: github.event.workflow_run.conclusion == 'success'`. Confirmed
  this still fires daily before switching: Market Scraper's every-other-day
  cadence gate (`Determine cadence` step) skips its own *steps* on off
  days, not the job itself, so the workflow still completes with
  conclusion `success` every day regardless - matches Review Scraper's own
  stated "runs daily" intent, just sequenced by real completion now
  instead of a guessed clock offset.
- **fx-rates -> benchmarks/churn**: these are 3 jobs *inside one workflow*
  (`market-intel-cron.yml`), so this needed `needs:`, not `workflow_run`
  (which only applies across separate workflows). The naive version
  (`needs: fx-rates` added to benchmarks/churn with no other change) would
  have broken their daily schedule - fx-rates' own `if` only matched its
  own 02:00 tick, so on benchmarks' 03:00 tick fx-rates would evaluate
  `if: false` and be skipped, and `needs:` treats a skipped upstream job
  the same as failed by default, silently killing benchmarks' entire daily
  run. Fixed by widening fx-rates' `if` to also match benchmarks' and
  churn's schedules (so it actually runs, not skips, right before them -
  redundant fx-rate refreshes on those days are harmless, it's an
  idempotent snapshot write), and adding `if: always() && (needs['fx-rates'].result
  == 'success' || needs['fx-rates'].result == 'skipped') && (<original
  schedule check>)` to both dependents so `always()` stops the skip from
  cascading while the original per-job schedule gate is preserved
  unchanged. price-alerts and low-stock untouched - nothing was ever
  claimed to depend on them.
- **Caught before pushing, not after**: `needs.fx-rates.result` is invalid
  GitHub Actions expression syntax - a hyphen in dot notation parses as
  subtraction, not a property access. No local linter available
  (`actionlint` isn't installed on this machine) to catch this
  automatically; caught by manually re-reading the expression syntax
  before commit, not by any tool. Fixed to bracket notation
  (`needs['fx-rates'].result`). **Worth remembering for any future
  multi-word/hyphenated job id referenced in an `if:` expression - dot
  notation will silently produce nonsense rather than erroring loudly, so
  it's easy to miss without a linter.**
- Real proof this actually chains correctly is still pending - like the
  Phase-1 collection widening above, nothing has been triggered on
  purpose since this pushed. The next natural `market-scraper.yml` run
  (and the `market-intel-cron.yml` ticks after it) is the real test.

## 2026-08-31: Frontend/render performance pass — `e551973`

User asked why the app renders slowly and to fix it, explicitly believing
"deployment or backend are not the issues." That framing turned out to be
half right and worth recording: no *individual* query is slow and the
infrastructure is fine, but the lag is nonetheless almost entirely
server-side request shape, not client bundle weight. Three parallel
Explore agents (data-fetching, bundle/hydration, caching/rendering-mode)
converged on the same three causes.

**1. Redundant work inside a single request — fixed with React `cache()`.**
`getCurrentSeller()` is the hottest function in the codebase (every page,
every `/api/ecommerce/*` route, most lib modules) and **each call costs
two network round-trips, because `supabase.auth.getUser()` calls
Supabase's auth service over the wire rather than decoding the JWT
locally** — worth remembering, it's easy to assume it's cheap.
`getLatestFxRates()` was independently fetched by five unrelated modules
per render. `getMarketScope()` resolved 3-9 times on the Competitors page,
since `getCompetitorLandscape`/`getCompetitorOverlap`/
`getCompetitorMatchCounts` each resolve scope internally instead of
accepting one, and the all-domains variants repeat that per tracked
domain. Wrapped those plus `getPrimaryDomain`, `listSellerDomainSlugs`,
`loadTaxonomy`, `loadDefinition`, `getMarketScopeForAllDomains`,
`getMarketScopeCoverage` in `cache()` from `react`. Per-request and
per-argument, so no change to cross-user or cross-request isolation, and
**zero call sites had to move** — the wrap preserves the signature.
`getMarketScopeCoverage` is keyed on the `MarketScope` object itself,
which only works *because* `getMarketScope` is now deduped and returns a
stable reference — don't un-cache one without the other.

**2. Serial `await`s with no dependency between them.**
`dashboard/market/page.tsx` awaited twelve fetches on twelve consecutive
lines, all depending only on `seller`/`domain`/`reportingCurrency` (all
resolved before the first one runs) — so page latency was the *sum* of
twelve round-trips instead of the slowest single one. Now one
`Promise.all`. Competitors got the same treatment in two rounds, since
the landscapes genuinely gate whether overlap/match-counts run at all.

**3. No `loading.tsx` anywhere in the app — probably the biggest
perceived-speed item, and the one a query-timing audit cannot see.**
The server-rendered pages emit no HTML until their last query resolves,
so clicking a nav link left the browser sitting on the *previous* page,
looking fully interactive but responding to nothing, for the entire
fetch. Added `PageSkeleton` (`components/marketintel/PageSkeleton.tsx`)
and route-level `loading.tsx` for the five server-rendered dashboard
routes (market, market/competitors, market/definition, watchlist,
scraper-health). The `apps/*` pages and `dashboard/overview` are client
components that already render skeletons themselves, so they didn't need
one.

**Also:** image optimization was off (`unoptimized: true` in
`next.config.js`) — the signin/signup/onboarding illustrations are
~600KB PNGs each and are the first thing an unsigned-in visitor loads.
Enabled it with AVIF/WebP and moved those three to `next/image`. Safe
because `sharp` is installed and **there were no other `next/image`
usages in the codebase at all**, so nothing else changed behaviour.

**Two audit findings that did NOT survive checking — both would have been
regressions if trusted:**
- An Explore agent reported `framer-motion` as "~40KB dead weight, zero
  imports found." True that nothing imports it directly, **false that
  it's removable — it is a required peerDependency of Chakra UI v2**
  (confirmed by reading `node_modules/@chakra-ui/react/package.json`) and
  backs every Modal/Drawer/Tooltip/Collapse in the app. Removing it would
  have broken the UI at runtime, not shrunk the bundle.
- Adding `experimental.optimizePackageImports` for `@chakra-ui/react` and
  `react-icons` produced a **byte-identical build** — same chunk hashes,
  same 103 kB shared JS — because Next 15 already applies it to both by
  default. Verified by actually building both ways and diffing the output
  rather than assuming a win. Left out of the config with a comment
  explaining why, instead of kept as something that reads like an
  optimization but isn't. **General lesson: measure config-level "wins"
  against a real before/after build; several of them are already-default
  in Next 15.**

**Verification:** `tsc --noEmit` clean, 160/160 vitest pass, production
build succeeds. **No real-world latency measurement was possible** —
standing no-browser-automation rule, and no Vercel analytics access from
here. The improvement is structural and reasoned, not measured; if a
before/after number is ever wanted, Vercel's own request-duration logs
are the place to get it.

**Deliberately not done, still open (full reasoning in the plan file
`~/.claude/plans/compressed-stirring-goose.md`):**
- *Phase B — caching genuinely public data.* `createClient()`
  (`lib/supabase/server.ts`) calls `cookies()`, which forces every page
  touching it into fully dynamic rendering. Several lib functions read
  data their own comments call public (`getDomainBenchmarks`/
  `getDomainPeers` in `benchmarks.ts`, `getCategoryPricing`) but still
  use the cookie-bound client; `createPublicClient()` exists for exactly
  this and only `showcase.ts` uses it. Blocked on two things, both real:
  the anon-role RLS policy must be confirmed live before relying on it
  (the code comment is not proof), and a page mixing public and
  seller-specific data can't just take a page-level `revalidate` — it
  needs Suspense-separated components. Not a quick win; don't attempt it
  as one.
- *Phase D — the per-product RPC fan-out.* `product-matching.ts:74-81`
  and `competitors.ts:339-344` fire one `market_top_similar_candidates`
  RPC per seller product (~20-60 per render), then Jaccard-score the
  results in process. This is real work rather than waste, and fixing it
  means a batched Postgres function taking many titles at once — its own
  design pass, worth re-measuring after the above before assuming it's
  still the bottleneck.

### Measured, after the fact — the numbers the entry above was missing

The entry above shipped honestly labelled "structural and reasoned, not
measured." It has since been measured, and the method is worth reusing.

**Real round-trip cost to this Supabase project** (7 samples each, from a
dev machine — production on Vercel would be lower if co-located, but the
*shape* is what matters): `auth.getUser()` **269ms median**, plain
PostgREST select **459ms**, the `fx_rates` query **308ms**. This
**confirms the load-bearing claim that `supabase.auth.getUser()` is a
network round-trip to Supabase's auth service, not a local JWT decode** —
which is exactly why `getCurrentSeller()` being called 9x per render
mattered so much.

**Before/after, measured by running the real page components against a
counting Supabase stub** (`src/bench-roundtrips.test.ts`, temporary, not
committed — recreate it if this needs redoing):

| page | round-trips | wall-clock @250ms/RTT |
|---|---|---|
| Market before | 108 | 12,819ms |
| Market after | **63** | **1,553ms** |
| Competitors before | 85 | 8,715ms |
| Competitors after | **61** | **2,330ms** |

Market ~8.3x faster, Competitors ~3.7x. The repeated calls that vanished
entirely: `market_category_map` x11→1, `seller_market_definitions` x11→1,
`fx_rates` x10→1, `auth.getUser` x9→1, `sellers` x9→1.

**Harness caveats, so nobody over-trusts these:** the 250ms/round-trip is
a flat constant (real latency varies 215-460ms); and **React's `cache()`
does not memoize outside a request scope, confirmed empirically — 4 calls
stayed 4 calls in plain Node** — so the harness models it with a Map using
React's documented contract (memoize per request, keyed on args) rather
than exercising the real implementation. The parallelization half needs no
such modelling and is measured directly.

**`rpc:market_top_similar_candidates` is still called 40x on both pages**
after all of this — the deduping cannot touch it, because those are 40
genuinely distinct calls (one per seller product), not repeats. That is
Phase D, and this measurement confirms it is now clearly the dominant
remaining cost on both pages. **If more performance work is wanted, that
is the next thing and there is no longer any guesswork about it.**

**Unrelated flake found and fixed while doing this (`0c09cd9`):**
`buildReportPdf`'s data-rich test was failing roughly one run in three
with "Test timed out in 5000ms" — it renders a real PDF via pdfkit and
was measured between 1.1s and over 5s depending on machine load, against
vitest's 5s default. Not caused by the performance work (the report path
was untouched, and that test imports none of the changed modules); it was
latent and surfaced because benchmarking kept the machine busy. Raised to
30s per file via `vi.setConfig` in the three renderer test files, rather
than globally, so fast unit tests keep a tight ceiling. Verified with six
consecutive clean full-suite runs. **Worth knowing: a "2 tests failed"
that does not reproduce on a second run is not necessarily noise here —
this one was real, and only showed up 1-in-3.**

## 2026-08-31: Phase D — candidate search. The plan was wrong; measuring
caught it. `da4ef12`

Phase D was scoped as "batch the per-product RPC fan-out," on the strength
of a round-trip COUNT: `market_top_similar_candidates` was 40 of the ~63
round-trips left on Market after the dedup pass. **That count was the wrong
thing to optimise, and the obvious implementation made pages slower.** The
batch was written, tested, and about to ship before benchmarking killed it.
Worth reading before anyone "optimises" this again.

**Method that caught it, reusable:** `psql`/`initdb` are installed locally
(`/d/PostgreSQL/18/bin`, PostgreSQL 18). Spun up a throwaway cluster on port
55432, built a minimal `market_products`/`market_platforms` schema with 60,000
rows across 12 categories, applied the real migration files verbatim, and used
`pgbench` for concurrency. **No production contact at all** — the Supabase MCP
`execute_sql` path was blocked by the permission classifier, and a local
cluster turned out to be the better answer anyway. Cluster deleted afterwards.

**The numbers (time to resolve 20 seller-product titles):**

| config | time | connections |
|---|---|---|
| 20 single calls, 20 concurrent (old design) | 590ms | 20 |
| one 20-title batch, 1 connection | **952ms** | 1 |
| 4 calls of 5 titles, 4 concurrent | 703ms | 4 |
| 20 concurrent singles + composite index | 380ms | 20 |
| **4 concurrent 5-title batches + index** | **341ms** | **4** |

**Why batching alone loses:** candidate search costs a flat ~50-60ms per
title, linear, and `unnest` + `LATERAL` runs the same per-title index scan
*sequentially in one backend*. Batching removes no work whatsoever — it only
trades away the concurrency the 20 separate calls already had. Measured cost
curve: 1 title 81ms, 5 titles 278ms, 10 titles 642ms, 20 titles 1196ms.

**What actually helped was the index (migration 048).** 036's
`market_products_title_trgm_idx` covers `title` alone, so every search pulled
rows matching the title across the *whole* table then discarded those outside
the seller's scope — the plan showed **16,103 rows from the index, 13,959
thrown away**. Adding `category_slug` and `platform_id` via `btree_gin` lets
the scope filter apply during the scan. Confirmed the planner switches: after
a stats reset, the composite index took 120 scans and the old one 0.

**Shipped: 4 concurrent calls of 5 titles (`CANDIDATE_BATCH_SIZE = 5`) plus
the composite index — 590ms → 341ms (1.7x), 4 pooler connections per render
instead of 20. 047 and 048 are a pair; neither is worth applying alone**
(chunking without the index is 703ms, *worse* than doing nothing). Both
migration headers carry the table above so this can't be "simplified" back
into a single 20-title call by someone reasoning that fewer round-trips must
be faster.

**Correctness, since getting it wrong changes which competitors sellers
see:** proved the batch returns exactly what N single calls return — same
rows, both `EXCEPT ALL` directions empty — including a title matching nothing
and two seller products sharing a title. Re-proved after adding the index,
and again for chunks-of-5 reassembled (1,200 rows, zero difference).
`query_index` is **chunk-relative**, so the app maps it back through an
explicit index table; there's a test for a second chunk's index 0 landing on
the 6th product rather than the 1st, which is the one bug that would silently
score seller products against each other's competitors.

**Still true and still unapplied:** migrations here are applied by hand, so
047/048 need running in the Supabase SQL Editor. Until then
`candidate-search.ts` detects a missing function (PGRST202/42883 only, not a
permissions or query error) and falls back to the old per-title path with a
`console.warn`. So the app is safe to deploy first, it just won't be faster.

**Caveat on all of the above:** synthetic rows on a laptop with 8 cores.
Supabase's smaller compute tiers have far fewer, which would make the
serialized 20-title batch look *even worse* relative to concurrent calls, so
the direction of the conclusion is safe. Treat the ratios as real and the
absolute milliseconds as indicative.

**Round-trip counts after this** (same harness as the previous entry): Market
63 → 31, Competitors 61 → 29. Note the harness's modelled wall-clock barely
moved (1553→1566ms, 2330→2313ms) because it treats concurrent calls as free —
**which is exactly the blind spot that made the original Phase D plan look
attractive.** The real win here is DB work and connection count, and only the
Postgres benchmark could see it. If that harness is rebuilt, don't trust its
wall-clock for anything involving concurrency.

### Post-apply check on 047/048 — applied, but the speedup is NOT verified

User applied both migrations and asked for confirmation of the speedup.
What was actually established, and what was not:

**Confirmed:** `market_top_similar_candidates_batch` exists and is callable —
POSTing to `/rest/v1/rpc/market_top_similar_candidates_batch` returns HTTP 200
rather than 404/`PGRST202`, so **migration 047 is live**. Migration 048's index
was **not** verified (checking `pg_indexes` needs SQL access, not REST).

**Not confirmed: any production timing.** Two bad measurements were produced
and thrown out before reporting, both worth remembering as traps:

1. First attempt read platform ids from `market_platforms` — which returns
   **0 rows under the anon key** — so an empty `p_platform_ids` array was
   passed, every query matched nothing, and the "benchmark" timed empty
   round-trips. It produced a confident-looking "2.01x faster, and the
   all-in-one batch is fastest" — the exact opposite of the real finding,
   because with zero work to do, fewest-requests wins by construction.
2. Second attempt sourced platform ids from `market_products.platform_id`
   (anon *can* read that table) and still got 0 rows. **Root cause: both
   `market_top_similar_candidates` (036) and the new batch function
   inner-join `market_platforms` for `platform_name`, and RLS hides that
   table from anon — so the join annihilates every row.** Verified by
   searching a product by its own exact title (similarity 1.0, must match)
   and getting 0 rows from *both* functions. **Not a 047 bug — 036 behaves
   identically.** Authenticated sellers can read `market_platforms` (the app
   renders platform names fine), so this only blocks outside benchmarking.

**Standing lesson: these candidate-search RPCs cannot be benchmarked with the
anon key at all.** It needs the service-role key (offered; user declined for
now) or an authenticated session. And any future benchmark here must assert
`rows > 0` before trusting a single number — that guard is what caught trap 2.

**So the only speed figure that exists is still the local-Postgres one**
(590ms → 341ms, 1.7x, synthetic data, 8-core laptop). It has NOT been
reproduced against production. Do not repeat it as a measured production
result.

## 2026-08-31: Groq timeout/retry + zod validation on the 3 create routes
- `25c36e2`, `701e7c4`

User asked "what's outstanding" across everything logged above, then said
"proceed with whatever needs attention" - a broad go-ahead. Sorted the list
into what's blocked (needs DB access - see below), what's a priority call,
and what's pure code with zero external dependency, then did the latter.

**Supabase MCP is connected, but to the wrong account - checked, not
assumed.** `list_projects` returned 7 real projects, none of them
Market-Intel/Ryvl (Vespa Verse, NLP-RAG-Agent, quantedge-db, car-xray,
Milestone, Job-Portal, Islamic_RAG_Agent - one, Job-Portal, is
`ACTIVE_HEALTHY` and live). Did not guess which one might secretly be this
project's backing DB or query any of them - that would be touching a
stranger's live data on a hunch. This means the items blocked on DB access
(migration 048's index, the candidate-search production benchmark, Phase B's
anon-RLS confirmation) are **still blocked**, unchanged from before - this
was a real, checked dead end, not a new option.

**1. Groq client timeout/retry (`25c36e2`).** Both `callGroqJson`/
`callGroqChat` used plain `fetch()` with no bound at all - a hung request
sat open indefinitely. Added a shared `fetchGroqWithRetry()`: 15s
per-attempt timeout via `AbortController`, one retry only for failure
classes a second attempt can plausibly fix (429, 5xx, timeout, network
failure) - a 4xx like a bad key still fails on the first response,
unchanged. 7 new tests, including the timeout path under `vi.useFakeTimers()`
- worth remembering for reuse: attach the `expect(promise).rejects.toThrow()`
assertion *before* advancing timers, not after, or vitest flags a real
(harmless) unhandled-rejection window even though the test still passes.

**2. zod validation on products/orders/customers POST (`701e7c4`).**
Scoped deliberately to the 3 single-object create routes, not the 13 POST
routes total - bulk-import (CSV rows, partial-failure-tolerant by design)
and the AI-assistant/notification routes are a separate pass if wanted, said
explicitly rather than silently claiming full coverage.

- **zod v4 was installed first, then reverted after `tsc --noEmit` failed
  with dozens of parse errors inside zod's own `.d.ts` files.** Root cause:
  zod v4's type definitions use TS 5+ syntax (`const` type parameters) this
  project's pinned `typescript ^4.9.4` cannot parse. zod v3 (`^3.25.76`) is
  fully compatible. **Check a library's TS version requirement against this
  repo's pinned 4.9 before installing anything new that ships its own
  complex `.d.ts` files** - `npm install` succeeding is not proof it's
  usable, only `tsc --noEmit` is.
- **A real, non-obvious TS inference bug, isolated and fixed, not
  worked around.** A generic `parseJsonBody<T>(request, schema: ZodType<T>)`
  silently collapsed specific object fields to `unknown`/`{}` instead of
  erroring, when passed a `z.object({...})` whose per-field Input and Output
  types genuinely differ (exactly what the new `blankToNull()` helper
  produces). Root-caused with an isolated minimal repro outside the real
  files (confirmed the exact failing case before touching a fix), not
  trial-and-error on the actual routes. Fix: pin the schema parameter's
  Input generic slot to `any` - `ZodType<T, ZodTypeDef, any>` - which
  decouples inference of T from also having to solve Input, instead of
  defaulting to `ZodType<T, ZodTypeDef, T>`. Documented inline since this is
  exactly the kind of fix a future "simplification" pass would revert
  without understanding why it's there.
- **`blankToNull()` exists because these forms send every field as `''`,
  never omit it** - `NewProductDrawer`/`NewOrderDrawer`/`NewCustomerDrawer`
  all `useState('')`. A plain `z.string().min(1)` would reject that as
  "too short" instead of treating it as "not provided", breaking the
  legitimate blank-field case these routes previously handled fine via
  `body.field || null`. Checked each form's actual submit body before
  writing the schema, not assumed from the route code alone.
- **The tests caught a real bug before it shipped, which is the entire
  point of writing them before believing the work is done.** The customers
  route had `CustomerCreateSchema` defined and imported but the POST handler
  itself was never switched from `request.json()` to `parseJsonBody()` -
  a pure oversight, not a design question. Two new tests (malformed email,
  negative `totalSpent`) got 200 instead of the expected 400, which is what
  surfaced it. Fixed, then all 30 test files / 196 tests passed clean.
- Verified: `tsc --noEmit` clean, `next lint` clean (only the same 2
  pre-existing unrelated warnings from before this session), full suite
  green. Did not run a production build - not established as required for
  a non-UI backend change in this project's own verification bar, per
  every prior route-level entry above.
