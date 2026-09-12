# Ryvl (Market Intel) — Project Context Prompt

You are working on **Ryvl** (internally "Market Intel"), a production B2B SaaS
web application. Read this brief fully before proposing or writing anything.

---

## 1. What the product is

Ryvl sells **competitive market intelligence to Pakistani e-commerce sellers.**

A fleet of scrapers continuously collects product listings (title, brand, price,
seller, rating, stock status, image, URL) from 56 Pakistani e-commerce sites.
That scraped competitive market is turned into pricing benchmarks, competitor
scorecards, price-change alerts, and a consulting-style report the seller can
act on.

**The single most important positioning decision — do not re-litigate it:**

> **We are selling market intelligence, not store management.**

The scraped competitive market IS the product. A seller's own data (their
products, orders, customers, cost prices) exists only to *personalise* that
analysis — it is an input layer, never the destination. Concretely:

- A brand-new seller must get real value on day one, from scraped data alone,
  with **zero other customers on the platform**. Any feature that only works
  once a peer network exists cannot be a headline feature.
- Seller-ops features (order management, marketplace write-back connectors,
  deeper CRM) are deliberately deprioritised. Bulk CSV import stays, because
  it feeds the analysis.
- Peer benchmarking (comparing a seller against other opted-in sellers) needs
  3+ sellers sharing a category before it renders anything. It is therefore a
  premium feature that "lights up as the network grows" — never a day-one promise.

**Target user:** an online seller in Pakistan (marketplace or own storefront)
who wants to know how their pricing and catalog compare to the competition, and
what to do about it. Not a "market analyst", not an enterprise research team.
Framing, copy, and feature priority should reflect that.

---

## 2. Data sources — 56 active

Registered in `scraper/src/sources/index.ts`, which is the authoritative list.
53 plain-HTTP sources + 3 browser-automation sources + 0 classifieds.

**The most important structural fact: most sources are factory-generated, not
hand-written.** Two factories cover the majority:

- `createShopifySource({ platformSlug, baseUrl, getCollections })` — reads
  Shopify's `/collections/<x>/products.json` endpoint
- `createWooCommerceSource({ platformSlug, baseUrl, getCategories })` — reads
  the WooCommerce Store API

Adding a Shopify or WooCommerce store is therefore ~6 lines in `index.ts` plus
a category list in `config.ts` and a migration row — **not** a new source file.
Only the original bespoke sources have their own files: `priceoye`, `telemart`,
`shophive`, `sapphireonline`, `mega`, `naheed`, `vmart`, `shopperspk`,
`petshub`, `ishopping`, `goto`, `daraz`.

**Browser-automation sources (CloakBrowser/playwright-core), 3:** `ishopping`
(Cloudflare challenge), `goto` (expired TLS cert, needs `ignoreHTTPSErrors`),
`daraz` (runs last — slowest, ~22 categories, paginated, rate-limited).

**Source notes that matter:**

- **Daraz is the single most valuable source.** It is the only one that names
  the *seller* behind each listing, plus a platform-reported sold count. That
  seller identity is what makes a "competitor" entity possible at all. It was
  prioritised despite being the hardest site to scrape — accept that cost.
- **Single-retailer sources cannot supply seller identity.** On those, the
  platform *is* the seller. No amount of enrichment changes this; only true
  marketplaces can populate competitor scorecards.
- **OLX was removed entirely** (not merely disabled). Every request from CI
  runner IPs returned HTTP 429 for weeks, including after pacing and
  exponential backoff — a standing IP-level block that politeness cannot fix.
  Do not reintroduce it without solving the blocking first (e.g. a residential
  proxy). The classifieds *plumbing* (`RawClassifiedListing`,
  `saveClassifiedListings()`, `market_classified_*` tables,
  the empty `CLASSIFIED_SOURCES` array) is deliberately left in place for any
  future classifieds source.
- Sources were added in batches targeting specific category gaps: fashion,
  furniture/home, pet supplies, sports & outdoors, books & stationery,
  automotive, coffee & beverages, health & wellness. Candidate stores that were
  evaluated and **rejected** are documented in `config.ts` with the reason
  (parked domains, client-rendered SPAs with no server-rendered product data,
  or robots.txt disallowing the entire catalog). Read those notes before
  proposing a source that was already ruled out.

**Cadence:** GitHub Actions cron fires daily at 03:30 UTC, but a "Determine
cadence" step gates the actual run to every other day via
`days_since_epoch % 2`. `workflow_dispatch` always runs.

---

## 3. Architecture

Two independent packages in one repository, sharing **one Supabase Postgres
project** but no code.

**`app/`** — the seller-facing web app
- Next.js 15, React 19 RC, TypeScript 4.9
- Chakra UI 2.6 on the Horizon UI template
- **framer-motion is pinned at 4.x by Chakra's peer dependency.** Do not
  upgrade it casually — modern motion APIs (`useInView`, `useMotionValue`,
  current spring APIs) do not exist in v4, and bumping it risks Chakra's own
  animations app-wide. Custom animation primitives here are deliberately
  pure CSS/Emotion + IntersectionObserver/rAF with zero new dependencies.
- Supabase Auth (email/password), RLS enforced on `auth.uid()`
- pptxgenjs 4.x for report generation; vitest for tests
- Deployed on Vercel

**`scraper/`** — standalone Node/TypeScript scraper
- `cheerio` + `got-scraping` for HTTP sources; `cloakbrowser` /
  `playwright-core` for browser sources
- One file per bespoke source (or a factory call) under `src/sources/`, a
  shared `db.ts` writer, `pipeline.ts` orchestrating, `config.ts` holding
  per-source category lists
- Per-source telemetry written to a `scraper_runs` table

**Database conventions (non-negotiable):**

- `market_*` = scraped market data. `sellers` / `seller_*` = tenant data.
- **RLS everywhere.** Every SQL function is `SECURITY INVOKER`, never
  `SECURITY DEFINER` — DEFINER would bypass RLS. There are exactly two narrow,
  deliberate view exceptions, both documented in place.
- **Aggregation lives in SQL, not JavaScript.** Never pull
  `market_price_history` rows into JS to sort or aggregate — it is the
  fastest-growing table in the schema (one row per product per scrape run,
  forever). Use the existing `market_scope_price_stats()` /
  `market_scope_price_trend()` SQL functions.
- **Migrations do not self-apply.** Every `scraper/migrations/0NN_*.sql` must
  be run manually, in order, via the Supabase SQL editor or `psql`. Nothing in
  CI or the app applies them. Forgetting this has silently broken the pipeline
  before — `db.ts` throws `Unknown platform slug` and writes nothing for any
  platform whose migration row is missing. **Current tip: 039.** Always grep
  `scraper/migrations/` for the highest number and verify against the live DB
  rather than trusting this figure.

---

## 4. Feature surface that currently exists

**Public marketing site:** landing page (`/`), `/how-it-works`, `/trust`,
`/pricing`, plus an AI assistant widget answering product questions from a
curated fact sheet (never invented claims).

**Auth & onboarding:** `/auth/signup`, `/auth/signin`, `/auth/password-reset`,
and `/onboarding` where a seller picks their category (read from the
`seller_categories` table) and declares their market.

**Dashboard:**
- `/dashboard/overview` — the seller's own store analytics
- `/dashboard/market` — category pricing distribution, price index, market
  scope banner
- `/dashboard/market/definition` — the seller defines their own market:
  segments in/out, platform opt-out, price band, brands, cities
- `/dashboard/market/competitors` — competitor scorecards: assortment breadth
  and share, median price and price index, repricing rate, stock reliability,
  SKU overlap and price win/loss against the seller's own catalog
- `/dashboard/watchlist` — track competitor products, get price alerts
- `/dashboard/scraper-health` — per-source freshness and telemetry

**Seller data (`/apps/*`):** products, product categories, orders, customers,
settings — all with CSV bulk import.

**Cron jobs (`/api/cron/*`):** `price-alerts`, `low-stock`, `churn`,
`fx-rates`, `benchmarks`.

**Reports:** dynamically generated PPTX and PDF decks rendered from one typed
`ReportSnapshot`. No fixed slide count, no template file, no flattened chart
images — `pptxgenjs` builds the deck from code with native charts and tables.
Read `docs/reports-v2-architecture.md` before touching `lib/reports/`. Note
there is **no seller-facing reports list UI yet** — generation exists, the
browse/download surface does not.

---

## 5. Seller categories

13 rows in `seller_categories`: Mobiles & Electronics, Fashion & Apparel,
Beauty & Personal Care, Coffee & Beverages, Grocery & Food, Home & Kitchen,
Books & Stationery, Toys & Baby, Sports & Outdoors, Automotive,
Health & Wellness, Pet Supplies, and Other.

Pet Supplies was formalized late (migration 039); the others date from
migration 011. Scraped platform categories are mapped onto these via
`market_category_map`, which stores exact `(platform, category_slug)` →
`(seller category, segment)` rows. The **segment** dimension exists because a
single category is too coarse to be defensible on its own — without it,
`mobiles-and-electronics` lumped power banks (median ~3.6k) and laptops
(median ~364k) into one "category median", silently corrupting every
downstream percentile, price index, and recommendation.

---

## 6. Plan tiers

Three tiers — `free`, `paid`, `premium` — in
`src/lib/market-intel/entitlements.ts`.

| Feature | Min tier |
|---|---|
| `watchlists`, `product_matching`, `pricing_recommendations`, `competitor_intel` | **paid** |
| `forecasting`, `anomaly_detection`, `multi_domain`, `peer_benchmarks` | **premium** |

- **free** — own-store analytics, market definition, a teaser of category pricing
- **paid** — the full scraped competitor intelligence loop
- **premium** — forecasting, anomalies, multi-domain, exports, and peer
  benchmarks once the network is dense enough

Ordering principle: **a tier may only charge for things that actually render
for a brand-new seller with no other sellers on the platform.** This is why
`peer_benchmarks` sits at premium rather than paid — it cannot populate until
3+ sellers share a category, so selling the cheapest upgrade on it would mean
charging for a screen that renders empty.

**Two caveats:**

1. **No billing provider is wired up.** No checkout exists. `plan_tier` is set
   by hand in the database or granted by the referral reward.
2. **Entitlements are currently globally unlocked for a demo.** The flag
   `DEMO_ALL_FEATURES_UNLOCKED = true` makes `hasFeature()` always return true.
   The real tier logic is intact and tested under `tierMeetsRequirement()`.
   Flip the flag to `false` to restore gating — do this before any real
   paying customer exists.

---

## 7. Current build state

Roadmap phases A–F, tracked in `ROADMAP.md`.

**Done:** Phase A (real auth, security fixes, market-definition model, SQL
aggregation, CI), Phase B (tier restructure), C1 (competitor entity model),
C2 (market definition surface), D1 (Daraz), D3 (ToS/legal review), report
generation v2, and substantial UI polish.

**Not built:** C3 (strategic implications as a standing in-product Actions
surface), C4 (trends, seasonality, risk register — Ramadan/Eid/11.11 effects
are large in this market), C5 (moment-of-truth scoring on the search-results
page), C6 (honest market sizing), C7 (price-band supply segmentation). Also
missing: the reports list UI and an internal review API.

**Scraper resilience is deliberately uneven.** Factory-generated sources and
the newer bespoke ones share `polite.ts` (randomised delays, bounded retry with
exponential backoff and jitter, `Retry-After` respect, a per-platform circuit
breaker). The six original sources keep their own inline pacing. That is an
established convention — *don't rewrite a working scraper without a functional
need*. The trigger to retrofit one is a real 429 pattern in `scraper_runs`,
not tidiness.

---

## 8. Standing rules — how to work on this codebase

**Intellectual honesty about data is the core product value.** This matters
more than any other rule here:

- **We scrape supply, not demand.** Listings are not sales. Never produce a TAM
  or market-size figure from scraped listings. What we *can* honestly produce:
  tracked-supply share, listing counts by platform and price band, and
  explicitly-labelled demand proxies (e.g. Daraz's platform-reported sold
  count). Anything stronger fails scrutiny.
- **Empty states must tell the truth.** If a seller's category has no scraped
  coverage, say so and explain why — never render zeroes dressed as findings.
  Distinguish "your filters are too narrow" from "no source covers this
  category at all."
- **Label directional results as directional.** SKU overlap and price
  win/loss use a token-Jaccard matcher, not a reconciled catalog match. The
  repricing rate is a *floor* — a price that moves and reverts between two
  observations two days apart is invisible to us. Say so in the UI.
- **Don't claim traction that doesn't exist.** There is no public user base to
  cite yet. Marketing copy says "who we track", never "who trusts us", and
  cites no fake customer counts or logos.

**Robots.txt compliance is load-bearing, not advisory.** It has already
constrained the design: Daraz is restricted to category paths only — no
keyword/search mode (`/catalog/` is disallowed) and no following sellers to
their shop pages (`/shop/*.htm` is disallowed). Every source file documents its
own compliance position in a header comment. Read it before modifying that
file. Sources have been rejected outright on robots.txt grounds.

**Prefer transparent rule-based logic over ungrounded LLM output** for anything
a seller acts on. The rationale strings in `pricing-recommendation.ts` are the
pattern: every recommendation traces back to the finding that produced it.

**Verify against reality before asserting.** A roadmap "✅ done" means code was
written and tested locally — not that a migration was applied or that a scraper
is producing rows in production. Check the live database and `scraper_runs`
before claiming anything works. Equally: `mind.md` and `ROADMAP.md` are dated
snapshots. When they disagree with the code, **the code wins** — grep it.

**Don't break what works.** Match surrounding style and conventions. Keep
existing tests and public component props working. CI gates typecheck, lint, a
real `next build`, the vitest suite, and a dependency audit for both packages —
all must pass.

---

## 9. Your task

[STATE YOUR SPECIFIC REQUEST HERE]
