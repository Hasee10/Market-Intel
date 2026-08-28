# memory.md — running session handoff log

**Read this first if picking up a new session on this repo.** `mind.md`
(2026-08-04 snapshot) has the original product framing and is now stale —
this file is the living continuation. Keep updating this file as work
happens; don't let it go stale the way `mind.md` did. As always: a claim
here that a file/table/feature exists is a claim about the past — verify
anything load-bearing against the live repo/DB before acting on it.

**Current HEAD as of this writing:** `c259ea7` (2026-08-28), pushed to
`origin/main`, working tree clean. Country-aware product catalogue (see
below) is fully shipped: committed, rebased onto 3 concurrent remote
commits (incl. `5c9d5cc` "Unlock all plan-tier features for demo
purposes" — a real behavior change to entitlements/plan-tier gating, now
live), typecheck+tests re-verified post-rebase, pushed. User is testing it
live themselves. Run `git status`/`git log` before assuming this is still
current — it won't be for long.

**Hard rule, still active:** never use `mcp__Claude_Preview__*` tools in
this project — hangs unrecoverably across two clean-restart attempts, user
explicitly said "never run a preview again." Use curl+Supabase REST for
DB/schema checks, `tsc --noEmit` + `vitest` for code correctness, careful
manual review, and ask the user to check the live app themselves for
anything needing a rendered browser (`Claude_in_Chrome` MCP is an
acceptable fallback if browser automation is unavoidable).

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
