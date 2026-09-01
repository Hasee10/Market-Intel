# Ryvl Feature Inventory (2026-09-01)

Complete reference of every feature currently implemented in the app,
built specifically so nothing functional gets silently dropped when the
frontend is replaced with a new design. Extracted by two independent
full-codebase sweeps (frontend pages + backend/API routes) on the same
day, against commit `28d4307`.

**How to use this document:** every capability listed below must have a
home in the new frontend - either the same UI shape, or a deliberately
better one. If something here doesn't make it into the new design, that
should be a conscious decision, not an accident of not knowing it existed.

---

## Part 1 — Navigation & global shell

### Nav structure (`src/routes.tsx`), in order

1. **Overview** (`/dashboard/overview`) - top-level, no section
2. **Market Intelligence** section: Market (`/dashboard/market`), Competitors (`/dashboard/market/competitors`), Market Definition (`/dashboard/market/definition`), Watchlist (`/dashboard/watchlist`)
3. **Store Data** section: Products (`/apps/products`), Categories (`/apps/products/categories`), Orders (`/apps/orders`), Customers (`/apps/customers`)
4. **Account** section: Settings (`/apps/settings`)

**Routable but deliberately not in nav:**
- `/dashboard/scraper-health` - internal scrape-reliability ops view ("internal tool, not seller-facing value")
- `/apps/test-switch` - dev stub, not a real feature

**Auth pages** (no sidebar, `AuthLayout`): `/auth/signin`, `/auth/signup`, `/auth/password-reset`

**Onboarding**: `/onboarding` - mandatory gate for any seller with no primary category set; auto-redirects to `/dashboard/market` once done

**Public marketing site** (outside the authenticated app): `/`, `/pricing`, `/trust`, `/how-it-works` - hero, stats bar, logo sliders, features, comparison, pricing table, trust section, how-it-works, CTA banner, footer, floating `AssistantWidget` chat. Decide deliberately whether the reimplementation keeps this - it's a separate concern from the dashboard.

### Global shell - `AdminShell.tsx`

Wraps every page under `/dashboard`, `/apps`, `/onboarding`. Each area's `layout.tsx` does a server-side `requireOnboardedSeller()`/`requireSeller()` redirect guard before rendering. Provides:
- Collapsible sidebar (collapse state persisted to `localStorage`)
- Navbar showing active-route breadcrumb text
- Floating **SellerAssistantWidget** chat bubble (bottom-right) on every authenticated page - greeting + 3 starter-question quick replies, free-text input, hits `/api/assistant/seller` (session-authenticated, grounded in the seller's own data)

### Shared components used across multiple pages

| Component | Purpose | Used on |
|---|---|---|
| `PageHeader` | Title + breadcrumb + action button slot | Every dashboard/apps page |
| `StatsGrid` | KPI card row: icon, per-metric color, value, %-diff arrow, period label, loading skeleton | Overview, Market, RetentionPanel |
| `InsightStrip`/`InsightBanner` | Rule-based "instant insight" banner: tone-colored headline + detail + optional CTA, computed from real page data, never LLM | Overview, Market, Watchlist, Products, Orders, Competitors, RetentionPanel |
| `UpgradeGate` | Soft paywall: renders children if entitled, else a locked upsell card linking to Settings | Market (5 sections), Competitors |
| `MarketScopeBanner` | Echoes the seller's current market-definition scope, edit link, warning state on zero matches | Market, Competitors, Market Definition |
| `PageSkeleton` | Generic loading skeleton for page bodies | Market, Competitors, Market Definition, Watchlist, Scraper Health |
| `ErrorAlert` | Left-accent red alert box | Overview, Products, Categories, Orders, Customers, Settings |
| `BulkImportDrawer` | CSV import: file picker → auto-mapped columns → preview (first 5 rows) → import with row-cap enforcement → result summary | Products, Orders, Customers |
| `ProductsTable`/`OrdersTable`/`CustomersTable` | Shared data-table renderers with skeleton rows, edit actions | Products, Orders, Customers |
| `DownloadReportButton` | Dropdown: PPTX / PDF, both from the same server-side snapshot, streams as a file download | Overview |
| `OnboardingChecklist` | 4-step progress card, auto-hides once complete | Overview |
| `RetentionPanel` | Full self-contained retention/churn block | Customers |
| `DomainsManager` | Tracked-domain list, make-primary/remove, add-category | Settings |
| `ReferralCard` | Referral link + copy button + join counts | Settings |
| `AuthCard` | Two-column auth shell (illustration + form) | Sign in, Sign up, Password reset |
| `PasswordInput` / `PasswordRequirements` | Show/hide toggle; live password-rule checklist | Sign up (+ sign in for the input) |

### Cross-cutting UX patterns to preserve

- **Instant-insight strips**: every analytics-heavy page leads with one rule-based, priority-ordered plain-English headline from real data - never a separate/inconsistent calculation, tone-colored, often with a CTA.
- **UpgradeGate soft-paywall**: Premium/Paid-gated sections render a locked card in place - no working checkout exists, links to Settings.
- **Currency-safe formatting** everywhere via `Intl.NumberFormat`, always the correct per-entity or seller reporting currency (multiple historical bugs fixed here - a real correctness requirement, not cosmetic).
- **Loading skeletons**, never blank/flash, on every data-fetching card/table/page.
- **Empty states** are never bare "no data" - icon + explanation + one next-action CTA, always.
- **CSV bulk import** is one shared column-mapping-drawer pattern across Products/Orders/Customers.
- **Grid/List view toggle** on Products and Customers (not Orders).

---

## Part 2 — Page-by-page feature inventory

### 1. Overview (`/dashboard/overview`)
Home dashboard - revenue/order/inventory snapshot + top actionable insight.
- Header: "Overview" + **Download report** button (PPTX/PDF menu)
- `OnboardingChecklist`, disappears once complete
- `InsightBanner`, priority: revenue anomaly → low-stock count → ≥5% MoM revenue swing → Premium forecast trend → calm fallback
- Primary `StatsGrid` (4): Revenue (30d), Orders, AOV, New Customers, each with %-diff
- **Revenue & fulfillment section**: revenue trend chart (area/line, 30d, or +14-day forecast with dashed projected segment + trend badge), annotated with a "Best day: X" peak label; order-status donut (center = total); both with empty-state CTAs
- **Products & inventory section** (header row shows compact Active Products / Low Stock counts, orange when >0): category-inventory donut (top 5 + "Other" rollup); top-products-by-inventory-value table (Title, Category badge, Sell price, Stock, Inventory value, top 5 + "View all" link); both with empty-state CTAs

### 2. Market (`/dashboard/market`)
Category-wide market intelligence.
- Header: "Market" + **Competitors** and **Market definition** buttons
- `MarketScopeBanner`
- `InsightStrip`: competitor stock-outs → ≥3% 30-day category price swing → calm fallback
- Per-platform "scraped Xh/d ago" freshness badges
- Info alert ("peer benchmarking, not surveillance"); warning alert + CTA if no domain set
- `StatsGrid` (4): Your domain, Sellers in domain, Peers visible, Benchmarks tracked
- Domain benchmarks table *(Premium, `UpgradeGate`)*: Metric/P25/Median/P75/Sample size, with an anonymity-floor explainer instead of a blank table
- Category pricing table: Min/P25/Median/P75/Max/Average/Listings tracked
- Price trend + 14-day forecast chart (or 30-day trend), dashed projection, trend badge
- Demand signal (OLX) card: active listings, new listings 7d vs prior 7d
- Competitor stock-outs table: Product (external link), Platform, Last price
- Closest competitor match table *(Paid)*: Your product/price, Match/their price, Confidence %
- Pricing recommendations table *(Paid)*: Product, Current, Recommended, Direction badge, Why
- Competitor price anomalies table *(Premium)*: Product, Platform, Was, Now, Change % badge
- Peers in your domain table *(Premium)*: Seller, Shares rating/price/category-rank
- Bottom explainer cards: "Opt in to be visible to peers", "Where this data comes from"

### 3. Competitors (`/dashboard/market/competitors`)
Named-competitor scorecards, gated *(Paid)*.
- Header: "Competitors" + **Adjust market definition** button
- Tabs: "All My Products" vs "Primary Domain"
- `CompetitorScorecardsPanel`: empty-state explainer; `InsightStrip` (steepest undercutter → new entrant → dominant seller → calm fallback); 3 stat cards (Named competitors, Listings with named seller, Your market median); scorecards table with 2 CSV export buttons, columns: Competitor (name/platform/brand-count/new-entrant tag), Assortment (count + bar + %), Median price, vs market (index), Repricing (% + SKUs), In stock %, Units sold*, Overlap/cheaper, Your tracked matches; "how to read this" footnote card

### 4. Market Definition (`/dashboard/market/definition`)
Editor for the seller's market-scope filters - everything else reads from this.
- Header + **Save definition** button (disabled unless dirty + ≥1 segment)
- `MarketScopeBanner`; error/warning alerts; empty-state for zero-coverage categories
- "What you sell" (segment checklist), "Where you compete" (platform opt-out checklist), "Price band" (min/max inputs), Brands/Cities chip inputs (free-text tags)
- "Currently in scope" live counts card

### 5. Watchlist (`/dashboard/watchlist`)
Track specific competitor products for price/stock alerts.
- Header: "Watchlist"
- `InsightStrip`: unread price-change alerts → any unread alert → "not tracking anything" → calm fallback
- "Recent alerts" list, unread highlighted, "Mark read" button
- "New watchlist" name input + create button
- Per-watchlist card: name + delete; live debounced product search (min 2 chars) with **Track** button to add; tracked-items table (Product link, Platform, Price, Stock badge, remove button)

### 6. Products (`/apps/products`)
Product catalog CRUD with competitor comparison.
- Header + grid/list toggle, **Import CSV**, **New Product**
- `InsightStrip`: low-stock active products → missing cost price → calm fallback
- Category filter tag (from Categories page nav), removable
- Grid: `ProductCard` tiles (title, status badge, category badge, SKU, price+margin%, stock flagged, Competitors/Edit buttons); Table view alternative
- New/Edit Product drawers: Title, Sell price+Currency, Cost price, Stock qty, SKU, Category select with **AI suggest** button + background debounced auto-suggest; Edit adds Active switch + Delete
- Competitors drawer: matched listings table (Listing link, Platform, Price, Rating, Sold, expandable Reviews)
- Bulk Import CSV drawer

### 7. Categories (`/apps/products/categories`)
Browse categories, jump to filtered product list.
- Summary line (X of Y categories have products)
- "Categories with products": `CategoryCard` grid (icon, name, count, share-of-max bar, gradient tint), links into filtered Products
- "Not started yet": compact empty-category chips, same link behavior

### 8. Orders (`/apps/orders`)
Order-record CRUD.
- Header + **Import CSV**, **New Order**
- `InsightStrip`: pending-order count → calm fallback with resolved count
- Table: Order, Customer, Date, Amount, Status badge (completed/pending/cancelled/refunded), Edit
- New/Edit Order drawers: Customer select (or Guest), External order ID, Date, Total+Currency, Status select; Edit adds Delete
- Bulk Import CSV drawer

### 9. Customers (`/apps/customers`)
Customer-record CRUD + retention/churn analytics.
- Header + grid/list toggle, **Import CSV**, **New Customer**
- `RetentionPanel` (always above the list): `InsightStrip` (at-risk count → "not enough history" → calm fallback); `StatsGrid` (Retention rate, Churn rate, Repeat purchase rate, Avg customer value); "At-risk customers" card with CSV export + table (Customer, Days since last order, Orders, Total spent, RFM badge)
- `CustomerCard` grid tiles / `CustomersTable` alternative
- New/Edit Customer drawers: Email (validated), External ID, Orders count, Total spent+Currency; Edit adds Delete
- Bulk Import CSV drawer

### 10. Settings (`/apps/settings`)
Business profile, currency/country, privacy, showcase, domains, referrals.
- "Business information" card: name, email (read-only), reporting currency select, country select (drives required fields like SKU), plan-tier badge
- "Public profile" card: master public toggle + display name + 3 sub-toggles (show price position/rating/category rank), all disabled unless public
- "Marketing site showcase" card: website input + logo-on-homepage toggle (needs a website first) - distinct from peer-visibility privacy
- `DomainsManager` card
- `ReferralCard`
- **Save changes** button (full-form save)

### 11. Scraper Health (`/dashboard/scraper-health`) - not in nav
Internal scrape-reliability view.
- Table: Source, Last run, Items last run, Failure rate over last 20 runs (color-thresholded badge), Last error (truncated)
- Empty state

### 12. Onboarding (`/onboarding`)
Mandatory one-step gate.
- Country select + Domain/category select + **Continue** (server action), error alert on invalid/failed save

### 13. Auth pages (`/auth/…`)
- **Sign in**: email+password, remember-me checkbox, forgot-password link, special alert distinguishing wrong-password/no-account with a "Create an account instead" CTA (avoids email enumeration), supports `?callbackUrl=`
- **Sign up**: business name, email, password + live requirements checklist, confirm password, supports `?ref=CODE` referral carry-through, "check your email" success state if confirmation required
- **Password reset**: email input, deliberately non-revealing success message regardless of whether the account exists

---

## Part 3 — Backend capabilities (`src/app/api/`)

### Products
- `GET/POST /api/products` - list (category filter)/create (title required; AI category fallback if omitted)
- `PUT/DELETE /api/products/[id]`
- `POST /api/products/bulk-import` - CSV upsert on `(seller_id, sku)` or slugified-title key if SKU not required for the seller's country; batched AI auto-categorization (25/batch, 4 concurrent, cap 1000 rows); auto-adds new tracked domains
- `POST /api/products/suggest-category` - on-demand single-title AI suggestion
- `GET /api/products/[id]/competitors` - matched competitor listings (free, not entitlement-gated)
- `GET /api/products/[id]/price-history` - seller's own price-over-time (no competitor comparison yet - flagged gap)
- `GET /api/product-categories` - taxonomy + per-category counts

### Orders
- `GET/POST /api/orders`, `PUT/DELETE /api/orders/[id]`, `POST /api/orders/bulk-import`

### Customers
- `GET/POST /api/customers`, `PUT/DELETE /api/customers/[id]`, `POST /api/customers/bulk-import`
- `GET /api/customers/at-risk` - latest churn snapshot + at-risk list

### Overview dashboard widgets
- `GET /api/ecommerce/stats` - 6 stat cards with period-over-period diffs (near-zero-baseline guarded)
- `GET /api/ecommerce/revenue-trend` - 30-day daily series, currency-converted
- `GET /api/ecommerce/products` - top products by inventory value
- `GET /api/ecommerce/orders` - counts/value by status
- `GET /api/ecommerce/categories` - inventory value by category

### Forecasting & anomalies (premium)
- `GET /api/forecast/revenue` - linear-regression forecast, gated `forecasting`
- `GET /api/anomalies/revenue` - z-score revenue anomaly detection (2-cycle confirmation), gated `anomaly_detection`

### Market intelligence
- `GET /api/market-products/search` - scraped-product search for watchlist add flow
- `GET/POST /api/domains` - list/add tracked category domains; 2nd+ requires `multi_domain` (Premium)
- `PATCH/DELETE /api/domains/[id]` - set primary / remove (auto-promotes on delete)

### Watchlists
- `GET/POST /api/watchlists`, `DELETE /api/watchlists/[id]`
- `POST /api/watchlists/[id]/items`, `DELETE /api/watchlists/[id]/items/[itemId]`

### Notifications
- `GET /api/notifications` - latest 50
- `POST /api/notifications/[id]/read`

### Onboarding
- `GET /api/onboarding-status` - 5 booleans driving the Overview checklist

### Settings/Profile
- `GET/PUT /api/profile` - business name, reporting currency, country, public-profile sub-object (isPublic, displayName, showPricePosition/Rating/CategoryRank, website, showOnMarketingSite)

### Referrals
- `GET /api/referrals` - code + stats; 3 joins auto-upgrades to paid

### Reports
- `GET /api/reports/generate?format=pptx|pdf` - builds+streams a full report, persists a snapshot

### AI Assistants
- `POST /api/assistant` - public marketing chat, unauthenticated, IP rate-limited 12/min, canned fallback on any Groq error
- `POST /api/assistant/seller` - authenticated seller-grounded chat, rate-limited 20/min per seller

### Cron jobs (bearer-token gated, scheduled)
- `/api/cron/benchmarks` - recomputes peer percentile stats
- `/api/cron/churn` - recomputes daily churn/retention/RFM snapshots
- `/api/cron/fx-rates` - refreshes FX conversion rates
- `/api/cron/low-stock` - fires `low_stock` notifications (deduped 24h)
- `/api/cron/price-alerts` - diffs watched products, fires `price_alert` notifications

---

## Part 4 — AI features (`src/lib/ai/`, `src/lib/reports/ai/`)

All four go through a shared Groq wrapper (`groq-client.ts`, model `openai/gpt-oss-20b`, 15s timeout + 1 retry on 429/5xx/network):

1. **Marketing assistant** - public FAQ chatbot, grounded in a static knowledge prompt, no retrieval. `POST /api/assistant` → `AssistantWidget` on marketing pages.
2. **Seller assistant** - authenticated, advisory-only (explicitly forbidden from claiming to have taken any action - no tool-calling wired up), context built fresh per request from the seller's own data. `POST /api/assistant/seller` → `SellerAssistantWidget` in the dashboard.
3. **Category auto-suggest** - single-title and batched-multi-title classification into the fixed taxonomy, `{categorySlug, confidence}`. Used in product create, on-type suggestion, and bulk import.
4. **Report narration** - writes the report's executive summary + 3 highlights + 3 recommended actions. Self-validates every stated number against the real data (regex-extract + tolerance check); rejects the *entire* narration in favor of a static fallback if anything is unverifiable - fails closed, never lands a hallucinated figure.

---

## Part 5 — Reports (`src/lib/reports/`)

PPTX (`pptxgenjs`) and PDF, both from one shared pipeline (`collect-snapshot.ts`):
revenue/products → marketplace/pricing → competitor benchmarks → customer health → rule-based market signals → AI narration → numeric validation → persisted snapshot.

Sections are dynamically included/omitted based on real data availability (`section-plan.ts`) - never padded. Candidate sections: cover, TOC (≥5 sections), executive snapshot, market position, pricing intelligence, competitor tracking (paginated, truncation note not "(continued)" slides), SKU performance (paginated), portfolio contribution (≥2 categories), inventory risk (only if low-stock exists), customer health, recommendations, roadmap (≥2 recommendations), methodology, appendix (internal mode). TOC always shows every candidate marked included/omitted/not-enough-data.

**Not yet built**: a client-safe export/approval flow - `report_reviews`/`report_exports` tables exist with no route/UI calling them yet. Self-view downloads always use `mode: 'internal'`.

---

## Part 6 — Entitlements / plan tiers (`src/lib/market-intel/entitlements.ts`)

Three tiers, `free(0) < paid(1) < premium(2)`:

| Feature | Min tier |
|---|---|
| Watchlists | paid |
| Product matching | paid |
| Pricing recommendations | paid |
| Competitor intel (scorecards) | paid |
| Forecasting | premium |
| Anomaly detection | premium |
| Multi-domain tracking | premium |
| Peer benchmarks (needs ≥3 opted-in peers) | premium |

**`DEMO_ALL_FEATURES_UNLOCKED = true`** currently bypasses all gating so every screen is walkable in demo/dev. The real per-tier logic is intact underneath. **No billing provider is wired up** - plan changes happen by editing `sellers.plan_tier` directly, or via the referral reward.

Gated via `<UpgradeGate>` on: Market (5 sections), Competitors, plus server-side 403/null-data on `POST /api/domains` (2nd domain), `/api/anomalies/revenue`, `/api/forecast/revenue`.

---

## Part 7 — Onboarding logic (`src/lib/market-intel/onboarding-status.ts`)

5 booleans (each a bounded existence check, not a count): `hasDomain`, `hasProduct`, `hasOrder`, `hasWatchlistItem`, `hasPublicProfile`. Drives the Overview "Getting Started" checklist.

---

## Part 8 — Notifications (`src/lib/notifications/`)

Triggers, all through `createNotification()` (inserts `seller_notifications`, calls a currently no-op `sendEmailStub`):
- `price_alert` - watched product moved ≥5% or stock flipped (cron)
- `low_stock` - active product under 10 units, deduped 24h (cron)
- `churn_risk` - type exists, no job currently writes it (churn data is surfaced via `/api/customers/at-risk` instead)

---

## Part 9 — Market intelligence core logic (`src/lib/market-intel/`)

- **Market definition/scope** - seller-controlled filter over a fixed platform/category taxonomy; feeds every other market-intel feature
- **Competitor tracking** - scorecards (assortment, price stats, in-stock rate, repricing rate) restricted to platforms with a named seller (Daraz today); overlap/win-loss via title-similarity matching
- **Price benchmarking** - live market-wide competitor stats + nightly cross-seller `domain_benchmarks` (≥3-seller anonymity floor)
- **Watchlists** - named lists of tracked competitor products, diffed nightly for alerts
- **Anomaly detection** - z-score revenue anomalies (2-cycle confirmation) + IQR competitor price anomalies
- **Pricing recommendations** - rule-based (deliberately not ML): competitor band ±5%, 15% minimum margin floor
- **Forecasting** - OLS linear regression (deliberately not ARIMA/LSTM) on category price trend and seller revenue
- **RFM/retention** - nightly churn/retention/RFM snapshots, at-risk customer list
- **Product matching** - trigram-indexed candidate search + Jaccard title similarity, free tier
- **Scraper health** - per-platform run status/error, rolling failure rate over last 20 runs
- **FX rates** - nightly-refreshed multi-currency conversion used throughout
- **Referrals** - crypto-random codes, 3 joins → auto-upgrade to paid
- **Public showcase** - opt-in peer visibility (price position/rating/category rank) + separate opt-in marketing-homepage logo showcase
