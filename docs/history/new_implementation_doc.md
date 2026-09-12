# Market Intel — Implementation Roadmap

Status as of 2026-07-28. This document is the working plan for feature build-out,
derived from a research pass over the existing schema, scraper, and dashboard.
It supersedes ad-hoc feature requests as the source of truth for what to build
next — update it as scope changes rather than tracking decisions only in chat.

Frontend note: the seller dashboard is being rebuilt on the Horizon UI
(Chakra + Next.js) template (`horizon-ui-chakra-nextjs-main/`), replacing the
Mantine template (`mantine-analytics-dashboard-dev/`). Dashboard first, then
landing/marketing pages once the dashboard is 100% wired and verified.

## Current state (grounding — don't re-build any of this)

- **Seller core**: `sellers`, `seller_products`, `seller_customers`,
  `seller_orders`, `seller_categories`, `seller_domains`,
  `seller_churn_snapshots`, `seller_public_profile` (+
  `seller_public_profiles_view`) — all RLS-scoped to the authenticated seller.
- **Peer benchmarking**: `domain_benchmarks` schema exists; read path
  (`getDomainBenchmarks`/`getDomainPeers` in `lib/market-intel/benchmarks.ts`)
  exists; **the aggregation job that writes to `domain_benchmarks` does not
  exist yet** — this is why benchmarks currently show empty.
- **Scraper**: 7 sources (PriceOye, Telemart, ShopHive, iShopping, Goto,
  SapphireOnline, OLX), covering mobiles/electronics + fashion only, every 2
  days via GitHub Actions. Tables: `market_products`, `market_platforms`,
  `market_price_history`, `market_product_matches` (mobiles-only),
  `market_classified_listings`/`market_classified_price_history` (OLX).
- **Category pricing bridge**: `lib/market-intel/category-pricing.ts` —
  keyword-matches seller category to scraped `market_products`.
- **Dormant/schema-only**: `market_watchlists`, `market_watchlist_items`,
  `market_alerts_sent` (no UI, no writer, no notification pipeline at all).
- **Auth**: Supabase Auth + RLS, `BYPASS_AUTH` dev escape hatch, Clerk
  integration still pending (do not build features that assume Clerk).
- **Monetization**: `plan_tier` column exists on `sellers`; nothing gates on
  it yet.

## Phase 0 — Frontend rebuild (in progress)

1. Port framework-agnostic backend code as-is into the new template:
   `lib/supabase/*`, `lib/market-intel/*`, all `app/api/**/route.ts`,
   `middleware.ts`, env vars.
2. Rebuild every existing page in Chakra: Overview, Market (benchmarks +
   category pricing), Products, Categories, Customers, Settings, Auth
   (signin/signup/password-reset), Onboarding.
3. Wire sidebar nav + header identity (avatar/session) to real seller data.
4. Verify build + delete the old Mantine app once parity is confirmed.
5. Only after the dashboard is 100% solid: redesign landing/marketing pages
   on the new stack.

## Phase 1 — Close the loops that already have schema

Cheapest, highest-leverage next work since the data model already exists:

- **Domain benchmarks aggregation job** — a scheduled job (cron or GH Action)
  that computes `domain_benchmarks` percentiles per category from opted-in
  seller data. Nothing on the Market page's peer side works until this runs.
- **Watchlist + price-alert pipeline** — UI to watch a competitor
  product/category (writes to `market_watchlists`/`market_watchlist_items`),
  a job that diffs `market_price_history` and writes `market_alerts_sent`,
  and a delivery channel (start with in-app, add email next).
- **Notification pipeline (shared infra)** — one system (email + in-app) to
  back price alerts, low-stock alerts, and churn-risk flags, instead of
  building each as a one-off.

## Phase 2 — Deepen market intelligence

- Product matching (`market_product_matches`) extended beyond mobiles to
  fashion and other categories (fuzzy/embedding match on title+brand+price).
- Price history trend charts per category/product (data already collected,
  nothing surfaces it yet).
- Stock-out signal ("competitor is out of stock on X") using `in_stock`.
- Category coverage expansion: home & kitchen, beauty, groceries currently
  have zero scraper coverage despite being in `seller_categories`.
- OLX classifieds as a demand/velocity signal, distinct from pricing.
- Data-freshness indicator on the Market page (last scrape timestamp).

## Phase 3 — Seller operations (core SaaS gaps)

- **Orders page** — `seller_orders` has no dashboard page or CRUD API today,
  only aggregate stats derive from it.
- **Low-stock alerts** on `seller_products.stock_qty` (feeds Phase 1
  notification pipeline).
- **Churn/RFM actions** — `seller_churn_snapshots` computes metrics; nothing
  acts on them yet (surface "at-risk customers" list, export).
- **Bulk import** (CSV first, marketplace connectors later — Daraz/Shopify/
  WooCommerce) for products/customers/orders, replacing manual drawer entry.
- **Multi-domain UI** — `seller_domains` already supports multiple category
  links per seller; only "primary" is surfaced today.

## Phase 4 — Analytics & forecasting

- Pricing recommendation using seller's own margin data
  (`cost_price`/`sell_price`) plus scraped competitor pricing.
- Price/demand trend forecasting from accumulated `market_price_history`.
- Anomaly detection (competitor price shocks, seller's own order/conversion
  anomalies).

## Phase 5 — Monetization & growth

- Gate features by `plan_tier` (free = own-store analytics only; paid =
  peer benchmarks + watchlists; premium = product matching, forecasting,
  multi-domain).
- Decide the fate of `market_accounts` (dormant "market analyst" account
  type from the original JobLo-era plan) — drop or resurrect as a separate
  paid buyer-side product.
- Referral/invite mechanic tied to the opt-in benchmarking pool — benchmark
  data quality and growth are the same lever here, worth designing together.

## Phase 6 — Trust & compliance

- Scraper health dashboard (internal) — iShopping/Goto already have
  Cloudflare/TLS friction; monitor failure rate per source as coverage grows.
- Legal/ToS review of the 7 scraped sources before expanding further.

## Open decisions (need a call before building, not blocking research)

- Whether `market_accounts` / a buyer-side "market analyst" product is still
  in scope, or should be formally dropped (see Phase 5).
- Plan tier boundaries (Phase 5) — affects which Phase 1-4 features are
  free vs. paid from day one.
