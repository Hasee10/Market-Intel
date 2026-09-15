# Ryvl / Market Intel — Roadmap

**Status as of 2026-08-03.** This document is the single source of truth for
what we build next.

**It supersedes** `new_implementation_doc.md` and `implementation_status.txt`,
both of which describe Phases 1–5 as future work that has since largely been
built, and both of which assume a seller-ops-first product we have now
decided against. Keep `overview.md` and `research.md` as historical product
context only. Do not plan against the superseded docs.

---

## The decision that drives everything below

**We are selling market intelligence, not store management.**

The scraped competitive market is the product. The seller's own CRM data
(products, orders, customers, cost prices) exists to *personalise* that
analysis — it is an input layer, not a destination. A seller should be able
to get value on day one, with zero other customers on the platform, from
scraped data alone.

Three consequences, decided 2026-08-03:

1. **Seller-ops build-out is deprioritised.** The Orders page, marketplace
   write-back connectors, and deeper CRM features are no longer near-term
   priorities. Bulk import stays, because it feeds the analysis.
2. **Peer benchmarks stop being a headline feature.** They cannot render
   until 3+ opted-in sellers share a category (`MIN_SAMPLE_SIZE` in
   `benchmarks-job.ts`), so they become a network feature that lights up as
   we grow — not something we charge for on day one.
3. **Daraz gets scraped.** It is where our target sellers actually compete.
   The ToS/legal review runs alongside it, not after.

---

## Honest assessment of where we stand

Measured against the seven-block market analysis framework:

| # | Block | State | Notes |
|---|---|---|---|
| 1 | Market Definition | **Absent** | Implicit in a hardcoded regex; invisible to the seller |
| 2 | Market Sizing | **Zero** | We compute price distributions, not market size |
| 3 | Customer Segmentation | **Wrong axis** | RFM on own customers ≠ market segmentation |
| 4 | Competitive Landscape | **~25%** | Platform aggregates only; no competitor entity exists |
| 5 | Decision Journey | **Zero** | No module or table touches this |
| 6 | Trends & Risks | **~35%** | Price-only; no assortment, seasonality, or risk register |
| 7 | Strategic Implications | **~30%** | Exists only inside the exported PDF, not in the product |

What is genuinely strong: the scraper (`scraper/`) — 7 sources, tiered by
anti-bot difficulty, exact 2-day cadence, per-source telemetry, staleness
tracking, price history. That is real infrastructure and nothing below
proposes changing its architecture.

### The four gaps that matter

1. **The market is defined too coarsely to be defensible.**
   `mobiles-and-electronics` lumps a phone-case seller in with a laptop
   retailer, then hands both the same "category median." Every downstream
   number — percentiles, price index, recommendations, the report — inherits
   this. It is not a missing feature; it silently corrupts existing output.

2. **We have no concept of a competitor.** `market_platforms` is a venue,
   not a rival. There is no competitor entity, share, assortment overlap, or
   positioning. The thing sellers actually want — *"competitor X carries 40%
   of my SKUs and undercuts me on 60%"* — is not expressible in the current
   schema. Highest-value missing capability.

3. **We scrape supply and speak about demand.** Listings are not sales. We
   cannot honestly produce a TAM from scraped listings. We *can* produce
   tracked-supply share, price-band supply segmentation, and OLX velocity as
   a labelled demand proxy. Anything stronger fails the scrutiny test.

4. **The "so what" is buried in a download.** Block 7 is the point of the
   framework, and ours is one Groq call at export time.

---

## Phase A — Foundation (blocking)

Nothing below Phase A ships credibly until these are done.

- **A1. Real authentication.** ✅ **Done 2026-08-03.** This turned out to be a
  deletion, not a build: Supabase Auth was already fully wired (signup,
  sign-in, password reset, the `013` signup trigger, RLS on `auth.uid()`), and
  `BYPASS_AUTH` was a scaffold left over from a planned Clerk migration that
  never happened. Both flags are now gone from `middleware.ts`,
  `lib/supabase/server.ts`, `seller.ts` and `entitlements.ts`. Moving to Clerk
  later is a separate migration and is no longer blocking anything.
- **A2. Fix the Critical + High findings in `leaks.md`.** Start with the
  unauthenticated `/api/referrals/record` free→paid escalation, then
  server-side password policy and the bypass-flag hardening.
- **A3. Replace regex category matching with a real market-definition
  model.** ✅ **Done 2026-08-03** (`scraper/migrations/020_market_definition_model.sql`,
  `src/lib/market-intel/market-definition.ts`). `category-keywords.ts` is
  deleted. The taxonomy now lives in `market_category_map` as exact
  (platform, category_slug) → (seller category, **segment**) rows, seeded from
  the 20 platform/slug pairs observed live plus every configured Daraz and OLX
  slug. The segment dimension is what the regex could not express and is the
  actual fix for gap #1: one pattern for `mobiles-and-electronics` was pulling
  `priceoye/power-banks` (median ~3.6k) and `shophive/laptops-computers/laptops`
  (median ~364k) into the same "category median". All six consumers
  (`category-pricing`, `market-insights` ×4, `product-matching`, `anomalies`,
  `collect-report-data`) now scope through `getMarketScope()`, which also
  pushes the slug filter into the query with `.in()` instead of pulling whole
  tables into JS — a down payment on A4.
- **A4. Move aggregation into SQL.** ✅ **Done 2026-08-03**
  (`scraper/migrations/021_market_scope_aggregates.sql`). Two functions,
  both `SECURITY INVOKER` so RLS still applies: `market_scope_price_stats()`
  computes the whole price distribution with `percentile_cont` instead of
  pulling every in-scope row into JS and sorting an array, and
  `market_scope_price_trend()` replaces the pattern that selected every
  matching product id and passed the array back as an `.in()` filter over
  `market_price_history` — the fastest-growing table in the schema. FX
  conversion is done in SQL by `market_convert_currency()`, which mirrors
  `fx.ts`'s `convertCurrency()` including its "missing rate → return
  unconverted" behaviour. `getMatchedProductIds` is deleted. Materialised
  views were not needed; indexed joins were enough at this size.
- **A5. CI + lockfile.** ✅ **Done 2026-08-03.** `.github/workflows/ci.yml`
  gates typecheck, lint and a real `next build` for the app, typecheck for the
  scraper, and an advisory `npm audit` on both. The app's `package-lock.json`
  was being ignored by a Horizon UI template default in `.gitignore` — that
  line is removed, **but the lockfile still needs to be committed** for `npm
  ci` in CI to work.

## Phase B — Rebuild the plan tiers around what works on day one

The current map in `entitlements.ts` is backwards under the new positioning:
it gates day-one-working features at premium and the network-dependent
feature at paid.

| Feature | Today | Should be |
|---|---|---|
| `product_matching` | premium | **paid** — core competitor intel |
| `pricing_recommendations` | premium | **paid** — core competitor intel |
| `watchlists` | paid | paid (unchanged) |
| `peer_benchmarks` | paid | **premium**, labelled "as the network grows" |
| `forecasting` | premium | premium (unchanged) |
| `anomaly_detection` | premium | premium (unchanged) |
| `multi_domain` | premium | premium (unchanged) |

Target shape: **free** = own-store analytics + market definition + a teaser
of category pricing. **paid** = the full scraped competitor intelligence
loop. **premium** = forecasting, anomalies, multi-domain, exports, and peer
benchmarks when available.

Peer benchmarks additionally need an honest empty state that explains the
3-seller threshold rather than rendering blank.

## Phase C — Close the framework gaps

Ordered by value, not by block number.

- **C1. Competitor entity model (Block 4).** ✅ **Done 2026-08-03.**
  `market_competitors` (migration `022`) is the durable entity — derived from
  the seller identity Daraz carries on every listing, but persisted rather
  than recomputed, because `first_seen_at` is the one thing a GROUP BY cannot
  give you. "Entered your market three weeks ago" is a finding; "is here now"
  is not. `market_competitor_scorecards()` returns assortment breadth and
  share, median price and price index against the seller's own market median,
  repricing rate over 30 days of `market_price_history`, stock reliability,
  and the platform-reported sold-count proxy — all scoped by the seller's
  market definition (A3), so narrowing the market narrows who counts as a
  competitor. SKU overlap and price win/loss against the seller's own catalog
  are computed in `competitors.ts` with the same token-Jaccard matcher as
  product matching, and are labelled directional in the UI rather than sold as
  a reconciled catalog match. Surfaces at `/dashboard/market/competitors`
  behind the `competitor_intel` (paid) entitlement. The scraper calls
  `market_refresh_competitors()` once at the end of each run.

  Two limits stated in the product, not just here: only true marketplaces can
  populate this (on the six single-retailer sources the platform *is* the
  seller, and D2 will not change that — there is nothing to enrich), and the
  repricing rate is a floor, since a price that moves and reverts between two
  observations two days apart is invisible to us.
- **C2. Market Definition surface (Block 1).** ✅ **Done 2026-08-03.**
  `/dashboard/market/definition` — segments in/out, platform opt-out, price
  band, brands, cities, saved to `seller_market_definitions` through a server
  action that takes the seller id from `requireSeller()` and never from the
  payload. `MarketScopeBanner` echoes it at the top of the Market page:
  *"N listings across M platforms match your definition of X."* It renders an
  honest empty state rather than a blank page, and distinguishes the two
  reasons for emptiness — filters too narrow vs. no scraped source covers this
  category at all. That distinction was not cosmetic when this was written:
  10 of 12 seller categories had zero coverage at the time (see D4). **No
  longer current — see D4's 2026-09-15 update.**
- **C3. Strategic implications in-product (Block 7).** A standing Actions
  surface where each item traces back to the finding that produced it. The
  rule-based rationales in `pricing-recommendation.ts` are the pattern to
  copy — transparent and defensible, unlike an ungrounded LLM summary.
- **C4. Trends, seasonality and risk (Block 6).** Assortment/new-SKU trends;
  seasonality (Ramadan, Eid, 11.11, Black Friday — large effects in PK);
  and a quantified risk register. FX and import-duty exposure on electronics
  is computable today from the existing `fx_rates` table.
- **C5. Moment-of-truth scoring (Block 5).** Scrape ratings, review counts,
  delivery promise and badges; score how a seller's listing looks against
  rivals on the same results page. The search-results page *is* the moment
  of truth in this market.
- **C6. Honest sizing (Block 2).** Tracked-supply share, listing counts by
  platform and price band, with explicit methodology and confidence bounds.
  Never a fabricated TAM.
- **C7. Price-band supply segmentation (Block 3).** Budget/mid/premium bands
  with listing count, platform mix, crowding, and OLX velocity per band.

## Phase D — Data coverage

- **D1. Daraz.** ✅ **Done 2026-08-03** (`scraper/src/sources/daraz.ts`,
  migration `019`). No CloakBrowser or proxy was needed after all: the
  category pages render client-side, but `?ajax=true` returns the page's JSON
  model over plain fetch. It also turned out to carry **seller identity**
  (100% coverage — 58 distinct sellers in `laptops` alone) and a
  platform-reported **sold count**, so it hands C1 its competitor entity and
  gap #3 its demand proxy. Requires migration 019 to be applied.
- **D2. Enrich the existing 7.** Ratings, review counts, delivery terms,
  seller identity — unlocks C1 and C5 without new anti-bot exposure. Note the
  single-retailer sources cannot supply seller identity at all: on those, the
  platform *is* the seller. Only Daraz and any future true marketplace can.
- **D3. ToS/legal review.** ✅ **Done 2026-08-03** — see `SCRAPING.md`. It
  found one live non-compliance (`sapphireonline` calls a Demandware endpoint
  its own robots.txt disallows) with a verified compliant alternative, and it
  is what constrained Daraz to category paths only.
- **D4. Retailer coverage** for the 10 of 12 categories then served by OLX
  alone. **✅ Resolved as of 2026-09-15 — see the update below. The account
  of the OLX failure is kept as-written for the record; read the update
  first, since the urgency language here no longer reflects the live
  database.** **Urgency raised 2026-08-03:** a live read of the database showed
  `market_classified_listings` is *empty* and `scraper_runs` recorded OLX at
  `product_count: 0, error: null` on all three logged runs. Since OLX is the
  only source covering those 10 categories, most of the product has been
  running on no market data at all. The parser is not the problem — every
  selector in `olx.ts` still matches a live fetch from a residential
  connection (33 cards, 24 parsed). The failure was invisible because
  `scrapeOlx` caught every per-category error and returned `[]`, which the
  pipeline could not distinguish from an empty market. Both holes are now
  closed: a total category wipeout throws, and the pipeline records any
  zero-row source as an error in `scraper_runs`. The remaining unknown is the
  root cause on the runner — the next scheduled run's `scraper_runs.error`
  will name it. Until then this source is presumed dead in CI, so D4's real
  retailer coverage is the durable fix, not a second single point of failure.
  **Root cause confirmed 2026-08-03: HTTP 429 on effectively every request**,
  including after adding randomised pacing (4–8s/page, 15–25s/category) and
  exponential backoff on 429 (45s → 90s → 180s, 3 retries/page) —
  `scraper/src/sources/olx.ts`. That rules out "too fast for a soft rate
  limit" and points at a standing IP-level block on GitHub's runner range,
  which no amount of politeness from inside the request fixes. **`scrapeOlx`
  is now disabled** in `CLASSIFIED_SOURCES`
  (`scraper/src/sources/index.ts`) rather than left to retry indefinitely —
  it was burning 20–30+ minutes per run for zero rows and risked the whole
  job (all 7 retailer sources included) being killed by the workflow timeout
  mid-run. The code and `OLX_CATEGORIES` config are untouched otherwise; this
  is a one-line array edit, reversible the moment D4's real fix (a proxy via
  `SCRAPER_PROXY`, or retailer coverage replacing the need for OLX
  altogether) lands.

  **Update, 2026-09-15 — D4 is resolved, and the OLX gap it describes is
  gone.** Measured with `scraper/migrations/_check_coverage.sql` against the
  live database (not the query file's design intent — actually run and the
  output reviewed): **12 of the 12 real seller categories now carry scraped
  rows, every one scraped within the last day.**

  | Category | Products | Platforms |
  |---|---|---|
  | Fashion & Apparel | 25,499 | 14 |
  | Home & Kitchen | 19,442 | 15 |
  | Mobiles & Electronics | 10,315 | 9 |
  | Beauty & Personal Care | 7,572 | 8 |
  | Automotive | 7,526 | 6 |
  | Toys & Baby | 6,669 | 7 |
  | Books & Stationery | 4,696 | 7 |
  | Pet Supplies | 3,270 | 5 |
  | Health & Wellness | 2,749 | 5 |
  | Coffee & Beverages | 2,655 | 4 |
  | Sports & Outdoors | 1,949 | 6 |
  | Grocery & Food | 978 | 2 |

  (A 13th row, `other`, is the taxonomy's catch-all rather than a real
  category and correctly shows zero — not a gap.)

  This was not OLX being fixed — OLX stayed disabled. The gap closed because
  of the volume of work this roadmap already records but had never added up
  in one place: Daraz (D1) plus the Shopify/WooCommerce sources added in two
  batches (2026-08-29, `shopify-source.ts`/`woocommerce-source.ts`) between
  them cover what OLX used to be the only source for. **The 2-of-12 figure
  quoted throughout this document, `README.md`, and
  `docs/SELLER_TRACKED_COMPETITORS.md` is from 2026-08-03 and is now three
  weeks stale — treat every instance of it as historical, not current.**

  What this changes: D4 as "add more retailers to fix empty categories" is
  done. `docs/SELLER_TRACKED_COMPETITORS.md`'s tier 1 is still worth building
  — it targets *precision* (a seller's actual named rivals) and produces
  labelled data no crawl can, neither of which this coverage number touches
  — but its original justification ("routes around the coverage gap") is
  largely moot, since the gap it was routing around is closed. Re-read that
  doc's own "Open questions" before resuming that work.

  What this unblocks: the mobile app's `price-check` route (Phase G) now has
  real data behind it in every category a seller is likely to pick, not just
  two.

  **Query 5 checked, 2026-09-15: zero rows.** Every `(platform,
  category_slug)` pair the scraper has ever written already has a
  `market_category_map` entry — no scraped data is sitting unmapped. Phase D
  is fully closed; there is no cheap taxonomy win left on the table.

## Phase E — Restructure the deliverable

The report *is* the product. Restructure the PDF/PPTX around the seven
blocks so it reads as a consulting deliverable, and make the dashboard the
live version of the same structure. Today the report is a grab-bag of seller
stats plus two competitor tables; the framework gives it a spine.

## Phase F — UI polish

Deliberately last. Deferred until the analysis underneath is correct.

## Phase G — Mobile app

**The backend half of this is already built and live**, `e21a21a`
(2026-09-05) — one commit, ahead of any client work, ahead of this being
written down here. That is the gap this section closes.

**What exists:**

- **8 endpoints** under `/api/mobile/*`, isolated from the 44 desktop routes:
  `pulse` (the whole home screen in one request — a phone on a Pakistani
  mobile connection pays a real latency cost per round trip, so this is one
  fan-out instead of five spinners), `alerts` + `alerts/read` (cursor-paginated,
  not offset — the feed grows from the top as crons write, and an offset
  shows a reader duplicates), `price-check` (the reason the app exists: keyed
  on a title string rather than a product id, because the seller is standing
  at a supplier looking at something they don't own yet — "should I stock
  this, at what price"), `products` (trimmed catalogue, no cost price/SKU),
  `products/[id]/price` (the one write worth having on a phone — a single
  field; full catalogue editing stays desktop, since a half-submitted
  eight-field form over a dropping connection is worse than not offering it),
  `competitors` (3 of the desktop scorecard's 9 columns — what a seller can
  act on from a phone), `devices` (push-token registration).
- **Push notifications, running in production.** `seller_devices`
  (migration 052) + `seller_notifications.pushed_at` (migration 053) +
  a delivery job (`push-notifications-job.ts`) via Expo's push service,
  triggered 3×/day at 08:30/14:30/20:30 PKT
  (`.github/workflows/market-intel-cron.yml`) — those times chosen as waking
  hours in Pakistan specifically, not a generic `*/6`. Already had one real
  production incident (2026-09-13, traced and fixed in `437579e`): a
  PostgREST schema-cache lag was being misreported as a missing migration.
- **No business logic duplicated.** Every mobile route is a thin composition
  over the same `lib/market-intel/*` functions the desktop pages call — the
  explicit goal being that a number on the phone can never disagree with the
  same number on a laptop, which is the usual way a companion app goes wrong.
  Same entitlement gating (`hasFeature`) as desktop, so no feature is
  reachable from a phone but not a browser.
- **Scraping stays desktop-only by design.** Every mobile route reads what
  the cron already wrote; nothing a phone does can queue a scrape. Hold this
  line — a future "pull to refresh the market" feature request should refresh
  the *view*, not trigger a scrape.

**What's missing:**

- **The client itself.** No React Native/Expo project exists anywhere in this
  repo. Everything above is a backend waiting for a frontend.
- **Route-level tests.** Only the push job has one
  (`push-notifications-job.test.ts`); the 8 `/api/mobile/*` handlers don't.
- This section of the roadmap, until now — so the next reader would have had
  to rediscover all of the above from the commit itself.

**Before building the client, re-verify against this roadmap's own D4/coverage
finding**: a mobile app's headline feature is `price-check` — "should I stock
this" — and that answer is only as good as the market data behind it. If a
category has zero scraped rows (see the coverage note above and
`scraper/migrations/_check_coverage.sql`), `price-check` there has nothing to
say. Coverage is a client-app blocker in a way it isn't for the desktop, where
an empty state is merely disappointing rather than the entire value
proposition failing silently.

---

## Sequencing

```
A (all)  →  B  →  C1 + C2  ─┐
                            ├→  C3, C4  →  C5, C6, C7  →  E  →  F
D1 + D3 (parallel from start)┘
D2 feeds C1 and C5
```

Phase A is strictly blocking. D1/D3 can start immediately in parallel since
they are scraper-side and share no code with the app work.

**Progress, 2026-08-03.** **Phase A is complete** (A1–A5), along with B, C1,
C2, D1 and D3. C1 — the highest-value item on this roadmap — is now built;
Daraz unblocked it by carrying seller identity on every listing. Next up is
**C3** (strategic implications) and **C4** (trends, seasonality, risk).

C1 is built but **inert until migrations 019–022 are applied**: no Daraz run
means no seller identity, which means no competitors. Those four migrations
are now on the critical path, not a loose end.

The honest state of the data underneath all of this: only **2 of 12** seller
categories (`mobiles-and-electronics`, `fashion-and-apparel`) have any scraped
rows at all — 5,651 products across 6 retailer platforms. The other ten
depended entirely on OLX, which is returning nothing (D4). Daraz will close
most of that gap on its first run, once migration 019 is applied. Until then
C2's empty state is doing real work: it tells those sellers the truth instead
of showing them zeroes dressed as findings.

UI polish is no longer deferred to Phase F wholesale (decided with the user,
2026-08-03) — each item from here ships with its own UI rather than being
retrofitted later. Phase F remains for the cross-cutting pass.

**Update, later 2026-08-03.** Migrations 018–022 are now applied to the live
database. Confirmed via a manually-triggered scraper run: Daraz scraped
successfully (2,160–3,720 products across runs, `scraper_runs.error: null`),
carrying real seller identity end to end, and `market_competitors` populated
to 1,332 rows via `market_refresh_competitors()` — **C1 is no longer inert**.
A first live run also surfaced Daraz block-page failures on ~half its
categories and OLX's 429s under the hardened retry logic still didn't
resolve (see D4 above); both are addressed — Daraz now runs through
CloakBrowser with retry/backoff, OLX is disabled rather than left retrying
indefinitely. Next up is still **C3** (strategic implications) and **C4**
(trends, seasonality, risk); D4's real retailer-coverage fix for the 10
categories that depended on OLX is now the more urgent gap than before,
since OLX is off entirely rather than intermittently failing.

## Open items

- Mobile client — the `/api/mobile/*` backend (Phase G) has had no consumer
  since 2026-09-05. Until a client exists, the 8 routes and the push job are
  unverified against a real device beyond whatever manual testing produced
  the 2026-09-13 incident.
- Billing provider — no checkout exists; `plan_tier` is set by hand or by
  the referral reward. Needed before Phase B tiers mean anything commercially.
- Fate of `market_accounts` — the dormant JobLo-era buyer-side account type.
  Under the market-intelligence-first decision this looks like a drop, but it
  has not been formally killed.
- Renaming `market_analyst` / `market_accounts`, which predate the
  seller-focused positioning (flagged in `README.md`).
