# Mobile API handoff

**For:** the developer building the Ryvl mobile client.

**Status: all 15 endpoints are built, tested and live.** This document was
written as a design review *before* implementation and has been brought
current afterwards — where a decision was reconsidered during the build, §6
says so rather than quietly rewriting history.

**Companion docs:** [`MOBILE_API.md`](MOBILE_API.md) is the full contract —
every field, every edge case. [`MOBILE_API_READY.md`](MOBILE_API_READY.md) is
the practical guide: one runnable `curl` per endpoint. This file is the
*decision record*: what the mockup needs, where that data already exists, and
what was genuinely new. [`openapi-mobile.yaml`](openapi-mobile.yaml) is the
machine-readable version — import it into Swagger UI or Postman.

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
| Overview — "N listings across M platforms" | scope coverage | `GET /api/mobile/pulse` *(extended — shipped)* | **Live** |
| Overview — 2×2 stat tiles | peers, benchmarks, products priced | `GET /api/mobile/pulse` *(extended — shipped)* | **Live** |
| Overview — revenue / orders / AOV tiles | seller's own sales KPIs | `GET /api/mobile/kpis` | **Live** |
| Market — price stats | category pricing | `GET /api/mobile/market` | **Live** |
| Market — forecast sparkline | 14-day OLS projection | same call, `forecast` block | **Live** |
| Market — position bars | portfolio banding | same call, `pricePosition` block | **Live** |
| Competitors — who's in this market | landscape + price index | `GET /api/mobile/competitors` | **Live** |
| Competitors — out of stock | stock-outs + duration | `GET /api/mobile/competitors/moves` | **Live** |
| Competitors — price anomalies | IQR outliers, 7d | same call, `anomalies` block | **Live** |
| Pricing — recommendation rows | rule-based recommendations | `GET /api/mobile/pricing` | **Live** |
| Top bar — category pill + sheet | seller's domains | `GET /api/mobile/categories` | **Live** |
| Top bar — search | scraped market products | `GET /api/mobile/search` | **Live** |
| Top bar — bell + feed | alerts, mark read | `GET /api/mobile/alerts`, `POST /api/mobile/alerts/read` | **Live** |
| Product detail (implied) | product vs. market | `GET /api/mobile/products/{id}/insight` | **Live** |
| Product list + price edit | catalogue, one-field write | `GET /api/mobile/products`, `PATCH /api/mobile/products/{id}/price` | **Live** |
| "Should I stock this?" | title-keyed price check | `GET /api/mobile/price-check` | **Live** |
| Push | device registration | `POST` / `DELETE /api/mobile/devices` | **Live** |

**Totals: 15 endpoints, all live.** No endpoint exists that no screen
consumes. The seven that were planned when this document was first written
have since been built, tested and verified against the bar in §9.

---

## 3. The endpoints, as shipped

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
| GET | `/api/mobile/pulse` | — | seller, domain, counts, highlights, recentAlerts, marketData, `domainStats` | none — the peer floor is a null count, not a 403 |
| GET | `/api/mobile/kpis` | `?period=30d\|90d` | `kpis[]` — key, label, raw value, format, diffPct, direction | none |
| GET | `/api/mobile/alerts` | `?cursor` | `alerts[]`, `nextCursor` | none |
| POST | `/api/mobile/alerts/read` | `{ids[]}` **or** `{all:true}` | `markedCount` / `markedAll` | none |
| GET | `/api/mobile/market` | `?categorySlug` | `pricing`, `forecast`, `pricePosition` | `forecasting` for `forecast` only |
| GET | `/api/mobile/categories` | — | `categories[]` w/ `isPrimary` | none |
| GET | `/api/mobile/competitors` | `?categorySlug` | `competitors[]` (max 8), `emptyReason` | `competitor_intel` |
| GET | `/api/mobile/competitors/moves` | `?categorySlug` | `stockOuts[]`, `anomalies[]` | `anomaly_detection` |
| GET | `/api/mobile/pricing` | `?categorySlug`, `?cursor` | `matchScopeCategorySlug`, `totalCount`, `recommendations[]`, `nextCursor` | `pricing_recommendations` |
| GET | `/api/mobile/products` | `?cursor`, `?q` | `products[]`, `nextCursor` | none |
| PATCH | `/api/mobile/products/{id}/price` | `{price}` | updated product | none |
| GET | `/api/mobile/products/{id}/insight` | — | `product`, `vsMarket`, `closestCompetitors[]`, `priceHistory[]` | `watchlists` |
| GET | `/api/mobile/price-check` | `?title` **(req)**, `?categorySlug`, `?intendedPrice` | bands, counts, `hasEnoughData` | `competitor_intel` |
| GET | `/api/mobile/search` | `?q` (under 2 chars → empty `200`), `?categorySlug` | `results[]`, `nextCursor` (always null) | `competitor_intel` |
| POST / DELETE | `/api/mobile/devices` | `{pushToken, platform, appVersion?}` | `registered` / `removed` | none |

---

## 4. Reuse: which endpoint composes which existing function

**This is the core of the review.** Nothing below re-implements analysis.
Every figure traces to the function the desktop already uses.

| Endpoint | Existing logic it composes | Verdict |
|---|---|---|
| `/pulse` | `listNotifications`, `getStockOuts`, `getDataFreshness`, `getPrimaryDomain` | Pure reuse — **already shipped** |
| `/pulse` *listings tile* | `getMarketScope` → `getMarketScopeCoverage` → `listingCount`, `platformNames` | Pure reuse |
| `/pulse` *peer tiles* | `getDomainPeers`, `getDomainBenchmarks` | Pure reuse — the ≥3-seller anonymity floor holds unchanged, expressed as `sellersInDomain: null` rather than `0` |
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
| `/search` | `searchMarketProducts(query, categorySlug?)` | Pure reuse — shipped unpaginated, so §6.2 turned out to need no backend change at all |
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
| `/pricing` | Desktop returns the full list | Paginate at 20. The cursor is an **offset** behind the standard opaque encoding, not a timestamp — this list is recomputed in full on every call in a fixed order and does not grow from the top the way the feeds do. **Do not filter by selected category** — see §8 #1. `costPrice` is dropped at the boundary |

---

## 6. Genuinely new backend work

Short list, deliberately. Two items were identified. **One was done; the
other turned out not to be needed.**

**6.1 — Split raw computation out of `getEcommerceStats`** *(required for
`/kpis`)* — **done.**

`seller/overview.ts` computed revenue, orders, AOV and new-customer counts,
then immediately formatted them for display. Mobile needed the numbers before
that step.

Shipped as `getSellerKpiTotals(sellerId, currency, periodDays)`, returning
raw values plus their prior-period counterparts
(`{revenue, priorRevenue, orders, priorOrders, aov, priorAov, newCustomers,
priorNewCustomers}`). `getEcommerceStats` now formats on top of it.
**Desktop output is byte-identical** — it calls the same exported function,
which returns the same strings. No desktop behaviour changed. That constraint
is what made this safe, and it is why `/kpis` and the desktop Overview tiles
can never disagree on a number.

The route derives `diffPct` and `direction` from the raw pairs rather than
having the lib hand them over, so "what counts as flat" is one decision in
one place. `diffPct` is `null`, never `0`, when the prior period is empty.

**6.2 — Pagination for `searchMarketProducts`** *(considered for
`/search?cursor=`)* — **not done, deliberately.**

`seller/watchlists.ts` hard-codes `limit 20` with no offset. Two options were
weighed: add an offset/keyset parameter, or ship `/search` unpaginated. The
second was taken.

It is zero backend change, 20 market results is enough for a phone search box
that leads into `/price-check`, and the contract already allows `nextCursor`
to become non-null later without breaking a client. `/search` therefore
returns `nextCursor: null` **always** — the field is present rather than
omitted precisely so that widening it later is additive.

**Net: exactly one function was added to the backend for the entire mobile
API.** Everything else composes what desktop already calls.

**Not new work, though it might look like it:** the "N listings across M
platforms" figure (`getMarketScopeCoverage`), the peer privacy floor
(`getDomainPeers`), stock-out duration (`computeStockOutDuration`) and the
category list (`listSellerDomains`) all already existed and returned usable
shapes.

**Two unplanned fixes shipped alongside**, both the same bug: an endpoint
hard-coded the primary domain and ignored `?categorySlug`, so switching
category in the top bar left that screen behind — which reads as stale data,
not as an unsupported param.

- `/api/mobile/competitors` — the static competitor landscape.
- `/api/mobile/pulse` — the home dashboard itself. Its `counts`,
  `highlights`, `domainStats`, freshness and `domain` now all re-scope to the
  selected category. It uses `resolveSelectedDomain` directly rather than
  `requireMobileCategory`, because the home screen must still render for a
  seller with no category at all (`domain: null`) — a `400` there would break
  the first screen a new seller sees.

Both now use `resolveSelectedDomain`, the same helper the domain-scoped
desktop pages use. Behaviour for a missing or unrecognised slug is unchanged —
it falls back to the primary, so the no-param default is identical to before.

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

## 8. Open questions

**#1 was answered by the backend and is settled. #2–#4 are UI calls and are
still open** — they do not block the API, which behaves the same whichever
way they land.

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

## 9. Verification bar — what was actually run

Standing project rule, not relaxed for mobile: **typecheck, lint, tests, and
a real `next build`** — all four, before anything is called done.

The build is the non-optional one: it is the only step that catches
Server/Client component boundary errors, and it has caught them in this repo
while tsc, lint and hundreds of tests all passed.

All four passed on the shipped implementation:

| Step | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `npm run lint` | clean, except the one pre-existing `<img>` warning in `ProductThumb.tsx` |
| `npm run test` | **464 tests across 58 files**, all passing (up from 390) |
| `next build` | succeeded; the route table lists all 15 `/api/mobile/*` routes as dynamic (`ƒ`) |

**What the new tests pin**, since the value is in the specifics rather than
the count — 45 tests across the five routes with non-trivial decisions:

- `/kpis` — the `400` on an unsupported period fires *without* calling the
  lib; `diffPct` is `null` and not `0` when the prior period is empty; money
  is rounded at the boundary.
- `/pricing` — rows from other categories **survive** the response (the
  whole-catalogue contract, asserted rather than assumed); there is no
  `costPrice` property; a 25-row cursor round-trip returns 20 then 5 with a
  null second cursor; a bad cursor is a `400`.
- `/market` — the forecast is **never computed** when the plan doesn't cover
  it, while the endpoint still returns `200` with free-tier pricing; bands are
  narrowed to the category on screen.
- `/search` — `''`, `'d'` and `'  '` all return an empty `200` **without
  touching the database**.
- `/products/{id}/insight` — the lookup is scoped by id *and* seller, and
  someone else's id is a `404`; a "Pack of 3" at 3,000 compares as 1,000.

The `403` cases are asserted by mocking `hasFeature` to return `false`, so
they test a real gate rather than passing vacuously under
`DEMO_ALL_FEATURES_UNLOCKED`.

**Remaining gap, stated rather than left implicit:** the 8 mobile routes that
were already live when this document was written still have **no automated
tests** — only the push job and the 7 new routes are covered. That is
pre-existing debt, not something the mobile work introduced, but it is real.
