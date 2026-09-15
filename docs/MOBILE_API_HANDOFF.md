# Mobile API handoff

**For:** the developer building the Ryvl mobile client, and whoever writes
the mobile routes.
**Companion docs:** [`MOBILE_API.md`](MOBILE_API.md) is the full contract —
every field, every edge case. This file is the *decision record*: what the
mockup needs, where that data already exists, and what is genuinely new.
[`openapi-mobile.yaml`](openapi-mobile.yaml) is the machine-readable version —
import it into Swagger UI or Postman.

**Principle this document was written under:**
> The mobile mockup defines **what** is needed. The existing backend defines
> **how** it works.

No calculation, permission rule, privacy floor or entitlement check is
changed by anything below. Every mobile route is a composition over the same
`lib/market-intel/*` functions the desktop pages call, so a number on the
phone can never disagree with the same number on a laptop.

---

## 1. Screens analyzed

Source: `ryvl-mobile.jsx` — a 639-line visual mockup in a 390×820 phone
frame. Four tabs plus persistent chrome.

| # | Screen | Dynamic data on it | User actions |
|---|---|---|---|
| 1 | **Overview** (home) | Listings + platforms tracked · competitor stock-out count · scrape recency per source · 2×2 stat tiles (sellers in domain, peers visible, benchmarks tracked, products priced) | Tap alert card → alerts |
| 2 | **Market** | Category median · min / P25 / P75 / average · 14-day forecast sparkline + change-per-week · price-position bars (5 buckets) + "75 of 87" headline | Switch category |
| 3 | **Competitors** | Out-of-stock competitor products w/ duration · price anomalies (old → new, % change) · empty state for unmatched products | — (read only) |
| 4 | **Pricing** | Recommendation rows: product, band, direction, current → recommended, rationale | Tap row → (implied) product detail |
| — | **Top bar** | Selected category pill · search · bell with unread dot | Open category sheet · search · open alerts |
| — | **Category sheet** | The seller's own categories | Select one |
| — | **Implied, not drawn** | Alert feed · product detail · price edit · push registration | Mark read · change price |

**Not in the mockup and therefore not designed for:** anything in §7.

---

## 2. Screen → data → API

One screen, one request, wherever possible. A seller on a Pakistani mobile
connection pays real latency per round trip; a home screen that fans out to
five requests shows five spinners.

| Screen | Data needed | Endpoint | Status |
|---|---|---|---|
| Overview — alert card, freshness, counters | stock-out count, low stock, unread, last scrape | `GET /api/mobile/pulse` | **Live** |
| Overview — "N listings across M platforms" | scope coverage | `GET /api/mobile/pulse` *(extended)* | Planned |
| Overview — 2×2 stat tiles | peers, benchmarks, products priced | `GET /api/mobile/pulse` *(extended)* | Planned |
| Overview — revenue / orders / AOV tiles | seller's own sales KPIs | `GET /api/mobile/kpis` | Planned |
| Market — price stats | category pricing | `GET /api/mobile/market` | Planned |
| Market — forecast sparkline | 14-day OLS projection | same call, `forecast` block | Planned |
| Market — position bars | portfolio banding | same call, `pricePosition` block | Planned |
| Competitors — who's in this market | landscape + price index | `GET /api/mobile/competitors` | **Live** |
| Competitors — out of stock | stock-outs + duration | `GET /api/mobile/competitors/moves` | Planned |
| Competitors — price anomalies | IQR outliers, 7d | same call, `anomalies` block | Planned |
| Pricing — recommendation rows | rule-based recommendations | `GET /api/mobile/pricing` | Planned |
| Top bar — category pill + sheet | seller's domains | `GET /api/mobile/categories` | Planned |
| Top bar — search | scraped market products | `GET /api/mobile/search` | Planned |
| Top bar — bell + feed | alerts, mark read | `GET /api/mobile/alerts`, `POST /api/mobile/alerts/read` | **Live** |
| Product detail (implied) | product vs. market | `GET /api/mobile/products/{id}/insight` | Planned |
| Product list + price edit | catalogue, one-field write | `GET /api/mobile/products`, `PATCH /api/mobile/products/{id}/price` | **Live** |
| "Should I stock this?" | title-keyed price check | `GET /api/mobile/price-check` | **Live** |
| Push | device registration | `POST` / `DELETE /api/mobile/devices` | **Live** |

**Totals: 15 endpoints — 8 live, 7 planned.** No endpoint exists that no
screen consumes.

---

## 3. Proposed endpoints

Full request/response bodies are in [`MOBILE_API.md`](MOBILE_API.md) and
[`openapi-mobile.yaml`](openapi-mobile.yaml). This is the index.

**Auth on every single endpoint:** `Authorization: Bearer <supabase_access_token>`
→ resolved to a `sellers` row by `getSellerFromRequest`. A valid Supabase
user with no seller row is `401`, not `200` with empty data.

**Envelope on every single response:**
`{ succeeded, data, errors[], message }`. Branch on HTTP status, not
`succeeded`.

| Method | Path | Request | Returns | Gate |
|---|---|---|---|---|
| GET | `/api/mobile/pulse` | — | seller, domain, counts, highlights, recentAlerts, marketData, *domainStats* | none (peer block: `peer_benchmarks`) |
| GET | `/api/mobile/kpis` | `?period=30d\|90d` | `kpis[]` — key, label, raw value, format, diffPct, direction | none |
| GET | `/api/mobile/alerts` | `?cursor` | `alerts[]`, `nextCursor` | none |
| POST | `/api/mobile/alerts/read` | `{ids[]}` **or** `{all:true}` | `markedCount` / `markedAll` | none |
| GET | `/api/mobile/market` | `?categorySlug` | `pricing`, `forecast`, `pricePosition` | `forecasting` for `forecast` only |
| GET | `/api/mobile/categories` | — | `categories[]` w/ `isPrimary` | none |
| GET | `/api/mobile/competitors` | `?categorySlug` | `competitors[]` (max 8), `emptyReason` | `competitor_intel` |
| GET | `/api/mobile/competitors/moves` | `?categorySlug` | `stockOuts[]`, `anomalies[]` | `anomaly_detection` |
| GET | `/api/mobile/pricing` | `?categorySlug`, `?cursor` | `recommendations[]` | `pricing_recommendations` |
| GET | `/api/mobile/products` | `?cursor`, `?q` | `products[]`, `nextCursor` | none |
| PATCH | `/api/mobile/products/{id}/price` | `{price}` | updated product | none |
| GET | `/api/mobile/products/{id}/insight` | — | `product`, `vsMarket`, `closestCompetitors[]`, `priceHistory[]` | `watchlists` |
| GET | `/api/mobile/price-check` | `?title` **(req)**, `?categorySlug`, `?intendedPrice` | bands, counts, `hasEnoughData` | `competitor_intel` |
| GET | `/api/mobile/search` | `?q` **(req, ≥2 chars)**, `?categorySlug`, `?cursor` | `results[]`, `nextCursor` | `competitor_intel` |
| POST / DELETE | `/api/mobile/devices` | `{pushToken, platform, appVersion?}` | `registered` / `removed` | none |

---

## 4. Reuse: which endpoint composes which existing function

**This is the core of the review.** Nothing below re-implements analysis.
Every figure traces to the function the desktop already uses.

| Endpoint | Existing logic it composes | Verdict |
|---|---|---|
| `/pulse` | `listNotifications`, `getStockOuts`, `getDataFreshness`, `getPrimaryDomain` | Pure reuse — **already shipped** |
| `/pulse` *listings tile* | `getMarketScopeCoverage(scope)` → `listingCount`, `platformNames` | Pure reuse |
| `/pulse` *peer tiles* | `getDomainPeers`, `getDomainBenchmarks` | Pure reuse — the ≥3-seller anonymity floor holds unchanged |
| `/alerts`, `/alerts/read` | `listNotifications` + notification writes | Pure reuse — **already shipped** |
| `/market` *pricing* | `getCategoryPricing(slug, currency)` | Pure reuse — the 15-row P25/P75 sample floor holds |
| `/market` *forecast* | `getCategoryPriceForecast` (→ `getPriceTrend`) | Pure reuse — 5-point minimum holds |
| `/market` *position* | `getPortfolioPricePositions` + `summarisePortfolioBands` | Pure reuse |
| `/categories` | `listSellerDomains(sellerId)` → already exactly `{categorySlug, categoryName, isPrimary}` | Pure reuse, near-zero work |
| `/competitors` | `getCompetitorLandscape` | Pure reuse — **already shipped** |
| `/competitors/moves` | `getStockOuts` + `computeStockOutDuration`; `detectCompetitorPriceAnomalies` | Pure reuse — IQR method, 2-cycle confirmation, 50 cap all unchanged |
| `/pricing` | `getPricingRecommendations(sellerId, categorySlug, currency)` | Pure reuse |
| `/products`, `/products/{id}/price` | `getSellerProducts`, scoped update | Pure reuse — **already shipped** |
| `/products/{id}/insight` | `findCompetitorsForProduct`, `getCategoryPricing`, `classifyPricePosition`, `getSellerPriceHistory` | Pure reuse, composed |
| `/price-check` | `getPreLaunchInsight` | Pure reuse — **already shipped** |
| `/search` | `searchMarketProducts(query, categorySlug?)` | Reuse + one small change (§6) |
| `/devices` | `seller_devices` upsert (migration 052) | Pure reuse — **already shipped** |

---

## 5. Which need a mobile adapter (shape only, not logic)

An *adapter* here means: call the existing function, then reshape its return
value for a phone. No recalculation, no different numbers.

| Endpoint | Why an adapter | What it does |
|---|---|---|
| `/kpis` | `getEcommerceStats` returns **pre-formatted display strings** — `"$482,300.00"` — with `icon: 'currency-dollar'` and `color: 'blue'` baked in | Emit raw numbers + a `format` discriminator. A phone can't re-parse a formatted string, can't localise it, and must not inherit desktop's icon vocabulary. **See §6 — this one needs a backend change, not just a route-level adapter.** |
| `/competitors` | Desktop's landscape carries 9 columns | Project to the 3 actionable ones (`skuCount`, `medianPrice`, `priceIndex`) + `assortmentShare`. Dropping fields, never adding |
| `/market` | Three separate desktop fetches | One response, three blocks. `forecast: null` when gated or under-sampled — the client hides the card rather than branching on tier |
| `/competitors/moves` | Stock-outs and anomalies are two desktop widgets | One response. `duration.confirmed:false` is preserved so the client can render `13+d` rather than a false-precision `13d` |
| `/products/{id}/insight` | No single desktop equivalent | Composes four existing calls into one product-detail payload |
| `/pricing` | Desktop returns the full list | Cursor-paginate at 20. **Do not filter by selected category** — see §8 #1 |

---

## 6. Genuinely new backend work

Short list, deliberately. Two items.

**6.1 — Split raw computation out of `getEcommerceStats`** *(required for `/kpis`)*

`seller/overview.ts:76` computes revenue, orders, AOV and new-customer
counts, then immediately formats them for display. Mobile needs the numbers
before that step.

The change: extract the computation into a function returning raw values
(`{revenue, orders, aov, newCustomers, diffPct}`), and have the existing
`getEcommerceStats` format on top of it. **Desktop output is byte-identical
afterwards** — it keeps calling the same exported function, which keeps
returning the same strings. No desktop behaviour changes. That constraint is
what makes this safe.

**6.2 — Pagination for `searchMarketProducts`** *(required for `/search?cursor=`)*

`seller/watchlists.ts:186` hard-codes `limit 20` with no offset. Two options,
pick one before building:

- **Add an offset/keyset parameter** (defaulting to today's behaviour, so the
  existing desktop watchlist search is unaffected) — then `/search` paginates
  like every other mobile list.
- **Ship `/search` unpaginated**, always returning `nextCursor: null` — 20
  market results is arguably enough for a phone search box that leads into
  `/price-check`.

*Recommendation: the second, initially.* It is zero backend change, and the
contract already allows `nextCursor` to become non-null later without a
breaking change for the client.

**Not new work, though it might look like it:** the "N listings across M
platforms" figure (`getMarketScopeCoverage`), the peer privacy floor
(`getDomainPeers`), stock-out duration (`computeStockOutDuration`) and the
category list (`listSellerDomains`) all already exist and return usable
shapes.

---

## 7. Desktop features intentionally excluded

The web app has 56 routes. Mobile has 15. These omissions are decisions, not
backlog.

| Excluded | Reason |
|---|---|
| Orders & customers CRUD, bulk import | Back-office work; belongs on a desktop with a spreadsheet open |
| Report generation (PDF/PPTX) | Nobody reads a generated deck on a phone |
| Watchlist management | Creating and organising lists is desktop work. The *alerts* watchlists produce still arrive, via push |
| Revenue forecasting, churn, at-risk customers | Dense analysis screens. Can't be compressed to 390px honestly |
| Full competitor scorecard (9 columns) | Mobile gets the 3 that are actionable |
| Cost price, SKU, product category | Cost price is used server-side for the margin floor and is **never sent to the phone** |
| Market-definition editing | Destructive setting — changing it re-scopes every number the seller sees |
| Marketing-site AI assistant | Public landing-page route; no seller identity involved |
| **Anything that queues a scrape** | **No mobile endpoint triggers work of any kind.** Opening the app can never cause load |

**Also held constant, by design:**

- **No server-side session state.** No "currently selected category" on the
  server — the client sends `categorySlug` on every call.
- **No loosened paywalls.** Every feature gated on desktop is gated
  identically here. A capability reachable from a phone but not a browser
  would be a hole, not a feature.
- **Ownership still checked in app code, not only in RLS.** Seller-scoped
  queries state the rule explicitly so one dropped policy can't mean
  cross-tenant access.
- ⚠️ **`DEMO_ALL_FEATURES_UNLOCKED = true` today**, so no `403` is currently
  reachable. **Build the upgrade path anyway** — when billing ships these
  gates go live with no backend change, and a client that has never handled
  `403` breaks everywhere at once.

---

## 8. Open before coding

**#1 is now answered by the backend. #2–#4 are UI calls.**

**1. Does `/pricing` scope to the selected category? — No. Settled.**
Reading `getPricingRecommendations` (`pricing-recommendation.ts:106`)
closes this: the `categorySlug` argument only scopes the *title-matching*
pass. The function selects **every active product with a cost and a sell
price**, and prices each one against **its own category's band** — a fix made
deliberately, because it previously judged a seller's beds against the beauty
P75 and the advice was simply wrong.

So the endpoint returns the whole catalogue, each row carrying the
`categorySlug` it was judged against. The mockup showing a Home & Kitchen row
under a Beauty pill is **correct**. Two consequences:

- **Do not filter `/pricing` client-side by the selected category** — you'd
  hide valid advice.
- **Hide the category pill on the Pricing tab**, or the screen implies a
  filter that isn't applied.

**2. Is "75 of 87 products sit 25%+ away" the right headline?** It flags 86%
of the catalogue and will be red-alert on nearly every account. It is also
inflated by a known caveat: the seller's own price is pack-size normalised,
the scraped market median is not (`anyPackSizeAdjusted: true` flags this per
response). Consider leading with a smaller band.

**3. Where do the two searches live?** One magnifying glass, two different
searches: `/search` = the market, `/products?q=` = the seller's own
catalogue. Toggle, two entry points, or one combined screen — this changes
whether `/search` must return both shapes.

**4. Is the sparkline informational or decorative?** `forecast.points` carries
real dated values with an `isProjected` flag. Axis-less curve → we keep the
payload small. Labelled → the client already has the dates.

---

## 9. Verification bar for the implementation

Standing project rule, not relaxed for mobile: **typecheck, lint, tests, and
a real `next build`** — all four, before anything is called done.

The build is the non-optional one: it is the only step that catches
Server/Client component boundary errors, and it has caught them in this repo
while tsc, lint and 390 tests all passed.

**Known gap:** the 8 live mobile routes have **no automated tests** — only
the push job is covered. The 7 new routes should not repeat that.
