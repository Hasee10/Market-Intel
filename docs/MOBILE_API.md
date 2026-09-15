# Mobile API guide

The contract between the Ryvl mobile client and the Next.js backend.

**Audience:** the developer building the React Native / Expo client. You do
not need to read the rest of this repo to use this document — everything
the client needs is here.

**Base URL:** the same deployment that serves the web app.
All paths below are relative to it, e.g. `https://<host>/api/mobile/pulse`.

**Status legend used throughout:**

- **Live** — deployed and callable today.
- **Planned** — contract agreed, not yet implemented. Shape may shift
  slightly during implementation; anything that does will be noted here
  before it ships.

---

## Contents

1. [Design rules](#1-design-rules)
2. [Authentication](#2-authentication)
3. [Response envelope](#3-response-envelope)
4. [Errors](#4-errors)
5. [Pagination](#5-pagination)
6. [Entitlements](#6-entitlements)
7. [Category scoping](#7-category-scoping)
8. [Endpoint reference — live](#8-endpoint-reference--live)
9. [Endpoint reference — planned](#9-endpoint-reference--planned)
10. [Push notifications](#10-push-notifications)
11. [Screen-to-endpoint map](#11-screen-to-endpoint-map)
12. [What the mobile API deliberately does not do](#12-what-the-mobile-api-deliberately-does-not-do)

---

## 1. Design rules

Five rules the whole namespace follows. Knowing them means you can predict
the shape of an endpoint you have not read yet.

**One screen, one request.** `pulse` returns the entire home screen —
alerts, counters, stock-outs and freshness — in a single response rather
than across five endpoints. A seller on a Pakistani mobile connection pays
a real latency cost per round trip, and a home screen that fans out to five
requests shows five separate spinners. Follow this when adding endpoints:
the unit of an endpoint is a screen, not a widget.

**No duplicated business logic.** Every mobile route is a thin composition
over the same `lib/market-intel/*` functions the desktop pages call. A
number on the phone must never disagree with the same number on a laptop,
and the only reliable way to guarantee that is for both to come from one
function.

**Fewer fields than desktop, on purpose.** `/api/mobile/products` omits
cost price, SKU and category joins. `/api/mobile/competitors` returns 3 of
the desktop scorecard's 9 columns. This is curation, not an oversight — the
full record is one tap away on the desktop, and a 9-column table on a 390px
screen helps nobody. **Do not ask for fields to be added back without a
screen that needs them.**

**Reads never trigger work.** No mobile endpoint queues a scrape, starts a
job, or writes to a queue. Every figure you receive was computed by a cron
that already ran. Opening the app can never cause load.

**One write, deliberately.** The only mutation on a seller's catalogue is
`PATCH /api/mobile/products/[id]/price`, and it takes one field. Full
catalogue editing stays on desktop: an eight-field form half-submitted over
a dropping mobile connection is a worse outcome than not offering it.

---

## 2. Authentication

Every endpoint requires a Supabase session access token as a bearer token:

```
Authorization: Bearer <supabase_access_token>
```

Obtain it client-side from the Supabase JS SDK
(`supabase.auth.getSession()` → `session.access_token`). It is the same
token the web app uses — there is no separate mobile credential, no API
key, and no refresh endpoint on this namespace. Refresh through the
Supabase SDK as normal.

The backend resolves the token to a `sellers` row. A valid Supabase user
with no `sellers` row is treated as unauthenticated (401), not as an empty
account.

**Missing or invalid token** → `401`:

```json
{
  "succeeded": false,
  "data": null,
  "errors": ["Send the Supabase session access token as: Authorization: Bearer <token>"],
  "message": "Not authenticated"
}
```

**Row-level security.** Every query runs under the caller's own token, so
Postgres RLS scopes it. Seller-scoped queries *also* carry an explicit
`seller_id` filter in application code. That redundancy is deliberate —
one dropped policy should not mean cross-tenant access. Do not treat it as
a reason to skip either layer if you add an endpoint.

---

## 3. Response envelope

Every response — success or failure, every endpoint — uses one shape:

```ts
type MobileResponse<T> = {
  succeeded: boolean;
  data: T | null;
  errors: string[];
  message: string;
};
```

| Field | On success | On failure |
|---|---|---|
| `succeeded` | `true` | `false` |
| `data` | the payload | `null` |
| `errors` | `[]` | one or more human-readable strings |
| `message` | `"OK"` or a short confirmation | a short summary |

This matches the rest of the app rather than inventing a leaner
mobile-only shape. A single response contract across every endpoint is
worth more to you than the handful of bytes a bespoke one would save.

**Client guidance:** branch on the HTTP status code, not on `succeeded` —
they always agree, but the status is available before the body parses.
Surface `message` in UI; `errors` is developer-facing detail and is often
too specific to show a seller.

---

## 4. Errors

| Status | Meaning | What the client should do |
|---|---|---|
| `400` | Malformed request — bad JSON, missing required param, invalid cursor, out-of-range value | Fix the request. Do not retry unchanged. |
| `401` | No token, expired token, or no seller record | Refresh the session; if that fails, sign out. |
| `403` | Authenticated, but the plan tier does not include this feature | Show an upgrade prompt. See [Entitlements](#6-entitlements). |
| `404` | The resource does not exist, or is not this seller's | Treat as not-found; do not distinguish the two in UI. |
| `500` | Server or database failure | Retry with backoff. Show a generic failure. |

**On `404` specifically:** `PATCH /products/[id]/price` returns 404 both
when a product id does not exist and when it belongs to another seller.
This is intentional — distinguishing them would confirm the existence of
another seller's product id.

**Never parse `message` or `errors` strings to branch logic.** They are
wording, not an API. Branch on status codes and on structured fields like
`emptyReason`.

---

## 5. Pagination

List endpoints are **cursor-paginated**, never offset-paginated.

```
GET /api/mobile/alerts?cursor=MjAyNi0wOS0xNVQwODozMDowMFo
```

Response carries `nextCursor`:

```json
{ "alerts": [ ... ], "nextCursor": "MjAyNi0wOS0xNFQxMTowMDowMFo" }
```

- `nextCursor: null` means you have reached the end. Stop requesting.
- Pass the value back **unmodified**. It is an opaque base64url token over
  a timestamp; do not decode, construct, or arithmetic on it.
- A cursor that does not decode to a valid timestamp returns `400`, not a
  silent reset to page one. That is deliberate: silently returning the
  whole list from the beginning reads as a pagination bug.

**Page size is 20** on every paginated endpoint
(`MOBILE_PAGE_SIZE` in `lib/mobile/respond.ts`). One number across the
whole namespace, because a client that has to remember a different limit
per endpoint will get one of them wrong.

**Why cursors.** A phone list appends as you scroll, and the alert feed
grows from the top as cron jobs write new rows. With offsets, an alert
arriving between two page fetches shifts every subsequent row down by one
and the reader sees a duplicate. A `created_at` cursor is stable under
insertion.

---

## 6. Entitlements

Plan tiers, in ascending order: `free` → `paid` → `premium`.

Feature-gated endpoints return `403` when the seller's tier is too low:

```json
{
  "succeeded": false,
  "data": null,
  "errors": ["Your plan does not include competitor intel."],
  "message": "Upgrade required"
}
```

| Feature key | Minimum tier | Mobile endpoints gated on it |
|---|---|---|
| `competitor_intel` | `paid` | `/competitors`, `/price-check` |
| `pricing_recommendations` | `paid` | `/pricing` *(planned)* |
| `anomaly_detection` | `premium` | `/competitors/moves` *(planned)* |
| `peer_benchmarks` | `premium` | *(none yet — see `pulse` stat grid, planned)* |

**Two things to know:**

1. **Gating mirrors desktop exactly.** A feature reachable from a phone but
   not a browser would be a paywall hole, not a mobile feature. The check
   lives in shared plumbing (`requireMobileSeller`), not per handler.

2. **Gating is currently inert.** `DEMO_ALL_FEATURES_UNLOCKED = true` in
   `entitlements.ts` bypasses every check, and no billing provider is
   wired. **You will never see a 403 today.** Build the upgrade-prompt
   path anyway — when billing lands, these become live without any backend
   change, and a client that has never handled 403 will fail all at once.

---

## 7. Category scoping

A seller can carry several categories ("domains"). One is primary.

**Today:** every market-facing endpoint silently uses the primary domain.
There is no way to ask for a different one except `price-check`, which
accepts `?categorySlug=`.

**Planned, required by the mockup's category switcher:** `?categorySlug=`
becomes a standard optional param on `/competitors`, `/market`,
`/pricing` and `/competitors/moves`, with the same fallback convention
`price-check` already uses:

1. If `?categorySlug=` is supplied, use it.
2. Otherwise fall back to the seller's primary domain.
3. If neither exists, return `400` with a message telling the seller to
   set a category — not an empty success.

**Client guidance:** persist the selected category locally and send it on
every request. Do not rely on the server remembering a selection; it does
not hold mobile session state.

**Slugs are identifiers, names are for display.** Responses carry both
(`categorySlug` and `categoryName`). Never render a slug to a seller.

---

## 8. Endpoint reference — live

### 8.1 `GET /api/mobile/pulse` — home screen

**Status:** Live. **Auth:** required. **Gate:** none. **Params:** none.

The entire Overview screen in one request.

```jsonc
{
  "seller": {
    "businessName": "string",
    "planTier": "free | paid | premium",
    "currency": "PKR"
  },
  "domain": {                          // null if no category set
    "categorySlug": "beauty-and-personal-care",
    "categoryName": "Beauty & Personal Care"
  },
  "counts": {
    "unreadAlerts": 3,
    "competitorStockOuts": 10,
    "lowStockProducts": 2
  },
  "highlights": [                      // always at least one entry
    {
      "tone": "good | warning | neutral",
      "headline": "10 competitor products are out of stock",
      "detail": "That's demand nobody is filling right now."
    }
  ],
  "recentAlerts": [                    // max 5, newest first
    {
      "id": "uuid",
      "type": "string",
      "title": "string",
      "message": "string",
      "isRead": false,
      "createdAt": "2026-09-15T08:30:00.000Z"
    }
  ],
  "marketData": {
    "lastScrapedAt": "2026-09-14T11:02:00.000Z",  // null if never scraped
    "platformsTracked": 8
  }
}
```

**Notes for the client:**

- `highlights` is ordered by priority — operational and time-sensitive
  first, informative second. **Render in the order given.** The tone is
  data so you can colour it without re-deriving the rule; do not
  re-classify client-side.
- When `domain` is `null`, `highlights` collapses to a single
  "Pick a category to start" entry and every market figure is empty.
  Render the onboarding path, not an empty dashboard.
- `counts` is flat rather than nested so you can bind badges straight to
  it.
- `lastScrapedAt` is the freshest scrape across the seller's platforms.
  **Show it.** A phone user has less context than someone sitting at a
  dashboard, so stating the data's age matters more here, not less.

---

### 8.2 `GET /api/mobile/alerts` — alert feed

**Status:** Live. **Auth:** required. **Gate:** none.

| Param | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string | no | Opaque. From a previous `nextCursor`. |

```jsonc
{
  "alerts": [
    {
      "id": "uuid",
      "type": "string",
      "title": "string",
      "message": "string",
      "isRead": false,
      "createdAt": "2026-09-15T08:30:00.000Z"
    }
  ],
  "nextCursor": "base64url-string"     // null when exhausted
}
```

Newest first. 20 per page. See [Pagination](#5-pagination).

---

### 8.3 `POST /api/mobile/alerts/read` — mark alerts read

**Status:** Live. **Auth:** required. **Gate:** none.

Two mutually exclusive body shapes:

```jsonc
{ "ids": ["uuid", "uuid"] }   // mark specific alerts — max 100 per call
```
```jsonc
{ "all": true }               // clear the whole feed
```

Success:
```jsonc
{ "markedCount": 2 }          // for the ids form
{ "markedAll": true }         // for the all form
```

**Why an array:** a swipe-to-clear gesture over several rows costs one
request instead of one per row, which on a phone connection is the
difference between instant and visibly laggy.

**Why `{ all: true }` is a separate flag and not an empty array:** an
empty array is what a buggy client sends by accident, and having that
silently clear the entire feed is not a failure mode worth allowing. An
empty `ids` array returns `400`.

---

### 8.4 `GET /api/mobile/products` — seller's catalogue

**Status:** Live. **Auth:** required. **Gate:** none.

| Param | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string | no | Opaque. |
| `q` | string | no | Case-insensitive substring match on title. |

```jsonc
{
  "products": [
    {
      "id": "uuid",
      "title": "string",
      "price": 1999,              // null if unpriced
      "currency": "PKR",
      "stockQty": 12,             // null if not tracked
      "isActive": true,
      "imageUrl": "https://..."   // null — render a placeholder tile
    }
  ],
  "nextCursor": "base64url-string"
}
```

**Notes:**

- `currency` is carried **per row**, not assumed from the seller record. A
  catalogue can legitimately mix currencies and a client that assumes one
  will mislabel the others.
- `q` is a substring match (`ilike`), not full-text search. It is a
  "find the one I'm holding" box over a seller's own few hundred products,
  not a search engine.
- No cost price, SKU or category. See [Design rules](#1-design-rules).

---

### 8.5 `PATCH /api/mobile/products/[id]/price` — update one price

**Status:** Live. **Auth:** required. **Gate:** none.

```jsonc
{ "price": 1999 }     // non-negative number, required
```

Success (`200`):
```jsonc
{ "id": "uuid", "title": "string", "price": 1999, "currency": "PKR" }
```

Failures: `400` invalid price · `404` not found or not yours · `500` write
failed.

This is the action the rest of the app builds toward: a seller sees a
competitor undercut them in the alert feed, opens the product, and changes
the price without going back to a laptop.

**Implementation note worth knowing:** the update filters on `seller_id` as
well as relying on RLS, and re-selects the row afterwards, so a write that
matched nothing returns `404` rather than a cheerful `200` having changed
nothing.

---

### 8.6 `GET /api/mobile/competitors` — competitor snapshot

**Status:** Live. **Auth:** required. **Gate:** `competitor_intel`.

Currently scoped to the primary domain. `?categorySlug=` is
[planned](#7-category-scoping).

```jsonc
{
  "categoryName": "Beauty & Personal Care",   // null if no domain
  "marketMedianPrice": 1105,                  // null if unscraped
  "currency": "PKR",
  "competitors": [                            // max 8, ranked
    {
      "name": "Al-Fatah",
      "platformName": "Al-Fatah",
      "skuCount": 412,
      "assortmentShare": 0.18,     // 0–1, share of in-scope SKUs
      "medianPrice": 980,          // null if unknown
      "priceIndex": -0.08          // negative = undercuts market median
    }
  ],
  "emptyReason": null              // or "no_category" | "no_named_sellers"
}
```

**`priceIndex` is the single most useful number on this screen.** `-0.08`
means this competitor prices 8% below the market median. Lead with it.

**`emptyReason` is structured on purpose.** "You have not set a category"
and "this market has no named sellers" are different problems with
different fixes, and a bare empty list cannot tell them apart. Branch on
this field, never on `competitors.length === 0` alone.

Desktop's scorecard carries 9 columns (brand count, in-stock rate, sold
units, ratings, repricing rate, tenure). Those are a laptop view.

---

### 8.7 `GET /api/mobile/price-check` — "should I stock this?"

**Status:** Live. **Auth:** required. **Gate:** `competitor_intel`.

The quick action the mobile app exists for. Keyed on a **title string**,
not a product id, because the seller is standing at a supplier looking at
something they do not own yet.

| Param | Type | Required | Notes |
|---|---|---|---|
| `title` | string | **yes** | Max 200 chars. |
| `categorySlug` | string | no | Falls back to primary domain. |
| `intendedPrice` | number | no | Unparseable values are dropped, not rejected. |

```jsonc
{
  "query": "Dior Eau Sauvage 100ml",
  "categorySlug": "beauty-and-personal-care",
  "categoryName": "Beauty & Personal Care",
  "currency": "PKR",

  "matchCount": 14,           // scraped listings matching the title
  "competitorCount": 6,
  "platformCount": 4,

  "matchedPriceBand": {       // over MATCHED listings — null if nothing matched
    "min": 18500, "median": 21900, "max": 24000
  },

  "categoryPricing": { ... },  // wider category context; null if unscraped

  "pricePosition": {           // present only if intendedPrice was supplied
    "intendedPrice": 20000,
    "vsMatchedMedian": -0.087,        // signed fraction
    "cheaperThanCount": 11,
    "verdict": "below market | at market | above market"
  },

  "hasEnoughData": true
}
```

**`hasEnoughData` is not optional to handle.** A thin market is itself
worth knowing about, and showing confident-looking numbers computed over
three listings is how a seller gets burned. When it is `false`, present
the figures as a hint, not a finding — or withhold them.

`matchedPriceBand` is the band *for this product*, which is what the
seller is actually deciding against. `categoryPricing` is the wider
category, for context only. Do not conflate them.

**No scrape is triggered.** This searches what the last scraper run already
wrote. A product nobody has scraped returns `matchCount: 0`, not a queued
job.

---

### 8.8 `POST` / `DELETE /api/mobile/devices` — push registration

**Status:** Live. **Auth:** required. **Gate:** none.
**Requires migration 052 applied.**

**Register (`POST`):**
```jsonc
{
  "pushToken": "ExponentPushToken[...]",   // required
  "platform": "ios" | "android",           // required
  "appVersion": "1.2.0"                    // optional, truncated to 32 chars
}
```
→ `{ "registered": true }`

**De-register (`DELETE`):**
```jsonc
{ "pushToken": "ExponentPushToken[...]" }
```
→ `{ "removed": true }`

**Call `POST` on every app launch.** Expo tokens rotate. The write is an
upsert keyed on the token, so re-registering does not accumulate a row per
launch.

**Call `DELETE` on sign-out. This is not optional.** Without it, a shared
or resold handset keeps receiving another seller's alerts until the token
happens to rotate.

---

## 9. Endpoint reference — planned

Four additions, derived directly from the mobile mockup. Each maps to
existing `lib/market-intel/*` functions — **no new analysis logic is
required for any of them**, only composition.

### 9.1 `GET /api/mobile/market` — Market tab

**Status:** Planned. **Gate:** none (category pricing is free-tier on
desktop; the forecast is a `forecasting`-gated feature there and the gate
should be mirrored — see open question 3).

| Param | Type | Required |
|---|---|---|
| `categorySlug` | string | no — falls back to primary domain |

```jsonc
{
  "categorySlug": "beauty-and-personal-care",
  "categoryName": "Beauty & Personal Care",
  "currency": "PKR",

  "pricing": {                    // null when the category is unscraped
    "count": 7572,                // listings behind these figures
    "minPrice": 25,
    "p25": 640,                   // null below a 15-row sample floor
    "median": 1105,
    "p75": 2799,                  // null below the same floor
    "maxPrice": 480000,
    "avgPrice": 2403,
    "samplePlatforms": ["Al-Fatah", "Bagallery"]
  },

  "forecast": {                   // null when under 5 trend points
    "trendDirection": "up | down | flat",
    "changePerWeek": -77,         // in reporting currency
    "points": [
      { "date": "2026-08-16", "value": 1180, "isProjected": false },
      { "date": "2026-09-16", "value": 1102, "isProjected": true }
    ]
  },

  "pricePosition": {              // the seller's own catalogue, bucketed
    "totalProducts": 87,
    "farFromMedianCount": 75,     // the "75 of 87" headline
    "bands": [                    // always 5, always in this order
      { "band": "far-above",  "label": "25%+ above",   "count": 49 },
      { "band": "above",      "label": "5–25% above",  "count": 4  },
      { "band": "at-market",  "label": "Within 5%",    "count": 3  },
      { "band": "below",      "label": "5–25% below",  "count": 5  },
      { "band": "far-below",  "label": "25%+ below",   "count": 26 }
    ],
    "anyPackSizeAdjusted": true   // see caveat below
  }
}
```

**Backed by:** `getCategoryPricing`, `getCategoryPriceForecast`,
`getPortfolioPricePositions` + `summarisePortfolioBands`.

**Client notes:**

- `p25`/`p75` are `null` below a 15-observation sample floor. A percentile
  computed from a handful of rows is a guess dressed up as precision.
  Render a dash, not a zero.
- `forecast.points` carries historical and projected points in one array,
  discriminated by `isProjected`. Draw the historical run solid and the
  projected run dashed — the mockup already does this correctly.
- `forecast` is `null` when there is too little history. A trend line
  through 2–3 points is misleading, not useful. Hide the card.
- Bands arrive in display order, worst-for-the-seller first. Render in the
  order given.
- **`anyPackSizeAdjusted` carries an honest limit.** Only the seller's own
  price is normalised for pack size; the category median is scraped as-is.
  In a category with many multipacks this inflates the "far from median"
  count. When `true`, the UI should say the comparison is approximate
  rather than present the headline as fact.

---

### 9.2 `GET /api/mobile/pricing` — Pricing tab

**Status:** Planned. **Gate:** `pricing_recommendations` (`paid`).

| Param | Type | Required |
|---|---|---|
| `categorySlug` | string | no — falls back to primary domain |
| `cursor` | string | no |

```jsonc
{
  "currency": "PKR",
  "recommendations": [
    {
      "productId": "uuid",
      "productTitle": "Samsung Galaxy A15",
      "categorySlug": "mobiles-and-electronics",
      "categoryName": "Mobiles & Electronics",
      "currentPrice": 65000,
      "recommendedPrice": 71875,
      "direction": "increase | decrease | hold",
      "competitorLow": 68000,
      "competitorHigh": 75000,
      "marginConstrained": false,
      "matchConfidence": 0.72,      // null when no confident title match
      "duplicateEntries": 1,
      "rationale": "Room to raise price while staying inside the competitor band."
    }
  ],
  "nextCursor": null
}
```

**Backed by:** `getPricingRecommendations`.

**Client notes:**

- **The method is rule-based, not ML, and saying so matters.** The
  recommendation is the competitor band (±5% off a matched competitor, or
  the category P25–P75 when there is no confident match), floored at cost
  × 1.15. The mockup's "Rule-based · Competitor band + your margin floor"
  subheading is correct and should stay.
- `rationale` is server-authored, seller-facing prose. **Render it
  verbatim.** Do not summarise or rewrite it client-side.
- `marginConstrained: true` means the margin floor sits above the
  competitor band entirely — the seller cannot be price-competitive here
  without a thin margin. That is a real signal, not a bug. Surface it.
- **`categorySlug` on each row is the category that row was judged
  against — always the product's own, never the one on screen.** This is
  why the mockup can legitimately show a Home & Kitchen recommendation
  while the pill says Beauty. If you filter by the selected category
  client-side, you will hide valid advice. Decide deliberately (see open
  question 1).
- `duplicateEntries > 1` means the seller has duplicate catalogue rows for
  one item. The backend collapses them (keeping the highest cost, so the
  margin floor clears the dearest copy actually held) but the underlying
  data problem remains. Worth a quiet note in the UI.

---

### 9.3 `GET /api/mobile/competitors/moves` — Competitors tab

**Status:** Planned. **Gate:** `anomaly_detection` (`premium`).

Stock-outs and price anomalies, the two things that *changed*. Distinct
from `/competitors`, which is the static landscape.

| Param | Type | Required |
|---|---|---|
| `categorySlug` | string | no — falls back to primary domain |

```jsonc
{
  "categoryName": "Beauty & Personal Care",
  "currency": "PKR",

  "stockOuts": [
    {
      "id": "uuid",
      "title": "Dior Eau Sauvage Lotion Apres-Rasage 100ml",
      "platformName": "Al-Fatah",
      "price": 21900,               // null if unpriced
      "imageUrl": "https://...",    // null — fall back to a tile
      "url": "https://...",
      "lastSeenAt": "2026-09-02T00:00:00.000Z",
      "duration": {                 // null if history unavailable
        "days": 13,
        "confirmed": false          // false = a floor, not a measurement
      }
    }
  ],

  "anomalies": [
    {
      "productId": "uuid",
      "title": "Vcare Natural — Lip Cheek Tint Peach 15ml",
      "platformName": "Bagallery",
      "imageUrl": null,
      "oldPrice": 1125,
      "newPrice": 1063,
      "pctChange": -5.5
    }
  ]
}
```

**Backed by:** `getStockOuts` (+ `computeStockOutDuration`),
`detectCompetitorPriceAnomalies`.

**Client notes:**

- **`duration.confirmed` changes the wording.** `true` means the days are
  measured from an observed in-stock moment. `false` means it is a floor —
  the product has never been seen in stock in our history, so "13 days" is
  really "at least 13 days". The mockup's "Out 13+d" pill is the correct
  rendering for `false`; drop the `+` when `confirmed` is `true`.
- Anomalies use **IQR outlier detection over week-over-week price
  changes**, not a fixed percentage threshold — so what counts as unusual
  adapts to how volatile that specific category is. A 5% move in a stable
  category can outrank a 20% move in electronics during a sale.
- Anomalies must clear a **two-cycle confirmation gate** before surfacing,
  so a single bad scrape does not produce an alert. Capped at 50.
- Anomalies cover the **last 7 days**. Label the section with the window;
  the mockup already does.

---

### 9.4 `GET /api/mobile/categories` — category switcher

**Status:** Planned. **Gate:** none.

Populates the bottom-sheet switcher. Returns only the seller's own
domains, not the full 12-category taxonomy.

```jsonc
{
  "categories": [
    {
      "categorySlug": "beauty-and-personal-care",
      "categoryName": "Beauty & Personal Care",
      "isPrimary": true
    }
  ]
}
```

A seller with one domain gets one row — **hide the switcher rather than
showing a single-option sheet.**

---

### 9.5 Extension to `pulse` — Overview stat grid

**Status:** Planned. Adds to the existing response; breaks nothing.

```jsonc
{
  "domainStats": {
    "listingsTracked": 5726,
    "platformsTracked": 8,
    "productsPriced": 87,
    "sellersInDomain": null,       // null = below the anonymity floor
    "peersVisible": 0,
    "benchmarksTracked": 0,
    "peerFloor": 3
  }
}
```

**The anonymity floor is a hard rule, not a loading state.** Peer
benchmarks require at least 3 opted-in sellers before any peer figure is
computed; below that, `sellersInDomain` is `null` and the others are `0`.

**Design warning, raised for the client developer to resolve:** on first
launch these render as `— / 0 / 0`. Three zeroed tiles reads as "broken",
not as "not enough sellers yet". Consider collapsing the three peer tiles
into one card that states the rule once, and promoting a populated figure
into the freed space. This is a UI decision, not an API constraint — the
data supports either.

---

## 10. Push notifications

**Status:** Live in production.

Delivered via the **Expo push service**, not raw FCM/APNs. Register with
`POST /api/mobile/devices` ([8.8](#88-post--delete-apimobiledevices--push-registration)).

**Schedule:** a cron fires three times daily at **08:30, 14:30 and 20:30
PKT**, sending any unpushed seller notification.

**Two caps worth knowing, because they shape what a seller sees:**

- Notifications older than **24 hours** are never pushed. A seller who
  installs the app does not get a backlog dumped on them.
- At most **500 notifications per run**.

Dead tokens are detected from the Expo response and pruned automatically —
you do not need to manage token cleanup beyond calling `DELETE` on
sign-out.

**The notification payload mirrors the alert record** (`title`, `message`,
`type`, alert id). Deep-link into the alert feed on tap, and call
`POST /api/mobile/alerts/read` with that id so the badge count and the
feed agree.

---

## 11. Screen-to-endpoint map

| Mockup screen | Endpoint(s) | Status |
|---|---|---|
| Overview — alert card, freshness, counters | `GET /pulse` | Live |
| Overview — stat grid (sellers, peers, benchmarks, priced) | `GET /pulse` (extended) | Planned |
| Market — median, min/P75/average | `GET /market` | Planned |
| Market — 14-day forecast sparkline | `GET /market` | Planned |
| Market — price-position bars | `GET /market` | Planned |
| Competitors — out of stock | `GET /competitors/moves` | Planned |
| Competitors — price anomalies | `GET /competitors/moves` | Planned |
| Competitors — who's in this market | `GET /competitors` | Live |
| Pricing — recommendations | `GET /pricing` | Planned |
| Top bar — bell / alert feed | `GET /alerts`, `POST /alerts/read` | Live |
| Category switcher sheet | `GET /categories` | Planned |
| Product search + price edit | `GET /products`, `PATCH /products/[id]/price` | Live |
| "Should I stock this?" | `GET /price-check` | Live |
| Push registration | `POST` / `DELETE /devices` | Live |

**Not in the mockup, already built:** `price-check`, `products`, and the
price edit. These are the app's most differentiated capability — a seller
at a supplier checking whether to buy something. Worth a screen.

---

## 12. What the mobile API deliberately does not do

State these to anyone who asks for them, rather than treating them as gaps:

- **Trigger a scrape.** The scraper is a cron concern. No mobile request
  queues work of any kind.
- **Full catalogue CRUD.** One field, one write. See
  [Design rules](#1-design-rules).
- **Return the desktop's full scorecard, full product record, or
  per-product competitor drawer.** Curated down on purpose.
- **Expose cost price.** It is in the database and used to compute the
  margin floor, but it is never returned to the phone.
- **Hold session state.** No server-side "currently selected category".
  The client sends `categorySlug` on every request.
- **Loosen a desktop paywall.** Any feature gated on desktop is gated
  identically here.

---

## Open questions — decide before building

1. **Does `/pricing` scope to the selected category or return the whole
   catalogue?** The mockup shows Home & Kitchen recommendations under a
   Beauty pill, which implies whole-catalogue. If so, the category pill
   should be hidden on that tab. **This is a UI decision that fixes the
   API shape** — resolve it first.

2. **Is the price-position headline the right one?** "75 of 87 products
   sit 25%+ away" flags 86% of the catalogue, and the pack-size caveat
   inflates it further. Consider leading with the smallest band instead.

3. **Should `/market` gate the forecast on `forecasting` (`premium`)?**
   Category pricing is free-tier on desktop; the forecast is not. Either
   split the response so pricing returns and `forecast` comes back `null`
   for free sellers, or gate the whole endpoint. Splitting is preferred —
   it keeps the screen useful at every tier.

4. **Is the sparkline informational or ornamental?** `forecast.points`
   carries real dated values. If the curve stays axis-less, say so and
   keep the payload small; if not, the client needs date labels.

---

## Reference

| Thing | Where |
|---|---|
| Shared plumbing (envelope, auth, cursors) | `app/src/lib/mobile/respond.ts` |
| Route handlers | `app/src/app/api/mobile/**` |
| Business logic the routes compose | `app/src/lib/market-intel/**` |
| Entitlement tiers | `app/src/lib/market-intel/core/entitlements.ts` |
| Push job | `app/src/lib/market-intel/jobs/push-notifications-job.ts` |
| Cron schedule | `.github/workflows/market-intel-cron.yml` |
| Device table | `scraper/migrations/052_*.sql` |
| What exists across the whole product | `FEATURES.md` Part 10 |
| What gets built next | `ROADMAP.md` Phase G |

**Known gap:** the eight live routes have **no automated tests**. Only the
push job is covered. Adding route tests is tracked in `ROADMAP.md` Phase G.
