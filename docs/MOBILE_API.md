# Ryvl mobile API

Everything the mobile client needs. You don't need to read anything else in
this repo.

**Base URL:** same host as the web app. All paths below are relative to it.

---

## Quick reference — every endpoint

Every endpoint below is **live**. There are no planned-but-unbuilt
endpoints left in this document.

### Home & alerts

| | Method | Path | What it gives you |
|---|---|---|---|
| L | GET | `/api/mobile/pulse` | The whole Overview screen in one call |
| L | GET | `/api/mobile/kpis` | Revenue, orders, AOV, new customers — the KPI tiles |
| L | GET | `/api/mobile/alerts` | Alert feed (paginated) |
| L | POST | `/api/mobile/alerts/read` | Mark alerts read |

### Market

| | Method | Path | What it gives you |
|---|---|---|---|
| L | GET | `/api/mobile/market` | The whole Market screen: price stats, forecast, position bars |
| L | GET | `/api/mobile/categories` | Categories for the switcher sheet |

### Competitors

| | Method | Path | What it gives you |
|---|---|---|---|
| L | GET | `/api/mobile/competitors` | Who's in this market and how they price |
| L | GET | `/api/mobile/competitors/moves` | Stock-outs + price anomalies |

### Pricing & products

| | Method | Path | What it gives you |
|---|---|---|---|
| L | GET | `/api/mobile/pricing` | Pricing recommendations |
| L | GET | `/api/mobile/products` | The seller's own catalogue |
| L | PATCH | `/api/mobile/products/{id}/price` | Change one price |
| L | GET | `/api/mobile/products/{id}/insight` | One product vs. the market |
| L | GET | `/api/mobile/price-check` | "Should I stock this, at what price?" |

### Search

| | Method | Path | What it gives you |
|---|---|---|---|
| L | GET | `/api/mobile/search` | Search scraped market products |

### Device

| | Method | Path | What it gives you |
|---|---|---|---|
| L | POST | `/api/mobile/devices` | Register for push |
| L | DELETE | `/api/mobile/devices` | Unregister on sign-out |

**Totals:** 15 endpoints, all live.

Things the platform has that mobile deliberately won't get are listed in
[Not on mobile](#not-on-mobile).

---

## Start here — 5 minutes

**1. Send a bearer token on every request.**

```
Authorization: Bearer <supabase_access_token>
```

Get it from the Supabase JS SDK: `supabase.auth.getSession()` →
`session.access_token`. Same token the web app uses. No separate mobile
credential, no API key.

**2. Every response looks the same.**

```jsonc
{
  "succeeded": true,
  "data":      { },      // your payload, or null on failure
  "errors":    [],       // strings, only on failure
  "message":   "OK"      // short summary
}
```

Branch on the **HTTP status code**, not on `succeeded`. They always agree,
but the status is available before the body parses.

**3. Example call.**

```bash
curl https://<host>/api/mobile/pulse \
  -H "Authorization: Bearer $TOKEN"
```

**4. That's it.** Pick your screen in the [quick reference](#quick-reference--every-endpoint),
jump to its section.

---

## Contents

- [Quick reference](#quick-reference--every-endpoint)
- [Start here](#start-here--5-minutes)
- **Rules that apply everywhere**
  - [Errors](#errors)
  - [Pagination](#pagination)
  - [Plans and paywalls](#plans-and-paywalls)
  - [Categories](#categories)
  - [Money and numbers](#money-and-numbers)
- **Endpoints**
  - [Home & alerts](#home--alerts)
  - [Market](#market)
  - [Competitors](#competitors)
  - [Pricing & products](#pricing--products)
  - [Search](#search)
  - [Device & push](#device--push)
- [Screen-to-endpoint map](#screen-to-endpoint-map)
- [Not on mobile](#not-on-mobile)
- [Decide before building](#decide-before-building)
- [Where things live](#where-things-live)

---

# Rules that apply everywhere

## Errors

| Status | Means | Do this |
|---|---|---|
| `400` | Bad request — missing param, bad JSON, bad cursor | Fix it. Don't retry unchanged. |
| `401` | No/expired token, or no seller account | Refresh session, else sign out. |
| `403` | Plan doesn't include this feature | Show upgrade prompt. |
| `404` | Doesn't exist, or isn't yours | Treat as not-found. |
| `500` | Server or database failure | Retry with backoff. |

**Show `message` to the seller. `errors` is for you, not them** — it's often
too technical.

**Never branch on the text of `message` or `errors`.** They're wording, not
API. Branch on status codes and structured fields like `emptyReason`.

`404` is returned both when a product doesn't exist and when it belongs to
someone else. Don't try to tell them apart — the API won't.

**"No category selected" arrives two different ways.** `/market`,
`/competitors/moves` and `/pricing` return a `400` when the seller has no
category and didn't send one. `/competitors` answers `200` with
`emptyReason: "no_category"` instead — it predates the shared
`requireMobileCategory` helper, and its empty-state contract was already
documented and in client use, so it wasn't changed underneath anyone. Handle
both; they mean the same thing. `/pulse` says it up front with
`domain: null`.

## Pagination

Lists use a **cursor**, never page numbers.

```
GET /api/mobile/alerts                                   ← first page
GET /api/mobile/alerts?cursor=MjAyNi0wOS0xNVQwODozMDowMFo ← next page
```

```jsonc
{ "alerts": [ ... ], "nextCursor": "MjAyNi0wOS0xNFQxMTowMDowMFo" }
```

- `nextCursor: null` → you're at the end. Stop.
- Pass the value back **exactly as received**. Don't decode or modify it.
- A broken cursor returns `400`, not page one.
- **20 items per page**, every endpoint. One number so you can't get it
  wrong.

> **Why cursors?** The alert feed grows from the top as background jobs
> write new rows. With page numbers, a new alert arriving between two
> fetches shifts everything down one and you'd render a duplicate.

## Plans and paywalls

Tiers, lowest to highest: **`free` → `paid` → `premium`**

| Feature | Needs | Endpoints |
|---|---|---|
| `competitor_intel` | `paid` | `/competitors`, `/price-check`, `/search` |
| `pricing_recommendations` | `paid` | `/pricing` |
| `watchlists` | `paid` | `/products/{id}/insight` |
| `anomaly_detection` | `premium` | `/competitors/moves` |
| `forecasting` | `premium` | the `forecast` block inside `/market` |
| `peer_benchmarks` | `premium` | the peer tiles inside `/pulse` |

A blocked call returns `403`:

```jsonc
{
  "succeeded": false,
  "data": null,
  "errors": ["Your plan does not include competitor intel."],
  "message": "Upgrade required"
}
```

> ⚠️ **You will never see a 403 today.** A demo flag unlocks every feature
> and there's no billing yet. **Build the upgrade path anyway.** When
> billing ships, these go live with no backend change — and a client that
> has never handled `403` will break everywhere at once.

## Categories

A seller can sell in several categories ("domains"). One is primary.

Every market endpoint takes an **optional** `?categorySlug=`:

1. If you send one, it's used.
2. If not, the seller's primary category is used.
3. If neither exists → `400`, telling the seller to pick a category.

**Keep the selected category in local state and send it every time.** The
server does not remember your selection.

Responses carry both `categorySlug` (the id) and `categoryName` (for
display). **Never show a slug to a seller.**

## Money and numbers

- **All money is a raw number**, never a formatted string. `1105`, not
  `"PKR 1,105"`. Format it yourself.
- **Every response that contains money carries a `currency` field.** Use it.
- On `/products`, `currency` is **per row** — a catalogue can legitimately
  mix currencies.
- **`null` means "not available", not zero.** A `null` median is "we don't
  have enough data"; a `0` median would be a real price. Render a dash for
  `null`, never a `0`.
- Percentages that compare against a baseline are **signed fractions**:
  `-0.08` = 8% below. That covers `priceIndex`, `pctVsMedian`,
  `priceDeltaPct`, `assortmentShare` and `vsMatchedMedian`.
- **Exactly two fields break that rule** and are signed **percentages**:
  `pctChange` on `/competitors/moves` (`-5.5` = down 5.5%) and `diffPct` on
  `/kpis` (`12.4` = up 12.4%). Inconsistent, and we're keeping it — both
  already ship, and changing them under a client that already handles them
  would be the worse failure. Assume fractions everywhere else.

---

# Home & alerts

## `GET /api/mobile/pulse`

**Live** · no plan gate

The entire Overview screen in one request.

| Param | Required | Notes |
|---|---|---|
| `categorySlug` | no | Which market the dashboard reflects. Falls back to the primary category |

**This is the endpoint that re-scopes the dashboard when the seller switches
category.** Send the `categorySlug` from the top-bar switcher and `counts`,
`highlights`, `domainStats`, `marketData` freshness and `domain` all follow
it. Omit it for the primary category. A stale or not-this-seller's slug falls
back to primary rather than erroring; read the echoed `domain.categorySlug`
to label the screen.

```jsonc
{
  "seller": {
    "businessName": "Sana's Store",
    "planTier": "free",
    "currency": "PKR"
  },

  "domain": {                       // the category this response is scoped to; null if none set
    "categorySlug": "beauty-and-personal-care",
    "categoryName": "Beauty & Personal Care"
  },

  "counts": {                       // bind badges straight to these
    "unreadAlerts": 3,
    "competitorStockOuts": 10,
    "lowStockProducts": 2
  },

  "highlights": [                   // always ≥ 1 entry
    {
      "tone": "good",               // good | warning | neutral
      "headline": "10 competitor products are out of stock",
      "detail": "That's demand nobody is filling right now."
    }
  ],

  "recentAlerts": [                 // max 5, newest first
    {
      "id": "uuid",
      "type": "price_drop",
      "title": "Competitor dropped price",
      "message": "Al-Fatah cut Dior 100ml by 8%.",
      "isRead": false,
      "createdAt": "2026-09-15T08:30:00.000Z"
    }
  ],

  "marketData": {
    "lastScrapedAt": "2026-09-14T11:02:00.000Z",   // null if never scraped
    "platformsTracked": 8
  }
}
```

**Client notes**

- `highlights` is **already sorted by priority** — urgent first. Render in
  the order given. `tone` is data so you can colour it; don't re-classify.
- `domain: null` → the seller hasn't picked a category. `highlights`
  collapses to a single "Pick a category to start". Show onboarding, not an
  empty dashboard.
- **Always show `lastScrapedAt`.** A phone user has less context than
  someone at a desktop, so the data's age matters more here, not less.

### The stat tiles

```jsonc
{
  "domainStats": {
    "listingsTracked": 5726,
    "platformsTracked": 8,
    "productsPriced": 87,
    "sellersInDomain": null,    // null = below the privacy floor
    "peersVisible": 0,
    "benchmarksTracked": 0,
    "peerFloor": 3
  }
}
```

**The privacy floor is a hard rule, not a loading state.** Peer numbers
need at least 3 opted-in sellers before anything is computed. Below that,
`sellersInDomain` is `null` and the rest are `0`.

> ⚠️ **Design warning.** On first launch these render as `— / 0 / 0`. Three
> zeros reads as "broken", not "not enough sellers yet". Consider
> collapsing the three peer tiles into one card that states the rule once.
> The API supports either layout — this is your call.

---

## `GET /api/mobile/kpis`

**Live** · no plan gate

| Param | Type | Required | Notes |
|---|---|---|---|
| `period` | `30d` \| `90d` | no | Defaults to `30d`. Anything else is a `400` |

The seller's own business KPIs — revenue, orders, average order value, new
customers — each with a change against the prior period.

```jsonc
{
  "currency": "PKR",
  "period": "30d",
  "comparedTo": "prior 30 days",
  "kpis": [
    {
      "key": "revenue",              // revenue | orders | aov | new_customers
      "label": "Revenue",
      "value": 482300,               // raw number, always
      "format": "money",             // money | count
      "diffPct": 12.4,               // null when there's no prior period
      "direction": "up"              // up | down | flat
    },
    {
      "key": "orders",
      "label": "Orders",
      "value": 214,
      "format": "count",
      "diffPct": -3.1,
      "direction": "down"
    },
    { "key": "aov",           "label": "Average order value", "value": 2253, "format": "money", "diffPct": 16.0, "direction": "up" },
    { "key": "new_customers", "label": "New customers",       "value": 38,   "format": "count", "diffPct": null, "direction": "flat" }
  ]
}
```

**Client notes**

- **These are the seller's own sales figures, not market data.** They come
  from orders the seller imported. A seller who hasn't imported orders gets
  all zeros — that is correct, not a bug. Show an "import your orders"
  empty state rather than four zeros.
- `diffPct: null` means there's no prior period to compare against (a new
  account). Hide the change indicator; don't render "0%".
- **`format` tells you how to render `value`**, so you never have to guess
  whether `2253` is money or a count.

- **An unsupported `period` is a `400`, not a silent fallback to `30d`.**
  A client that asks for a window it won't get, and is told it did, shows
  wrong numbers instead of an error anyone can report.

> **Where the numbers come from.** Desktop's `getEcommerceStats` returns
> pre-formatted strings like `"$482,300.00"` with icon and colour names
> baked in — unusable on a phone. The raw computation was split out into
> `getSellerKpiTotals`, and both clients now format on top of it. Same
> source figures, different presentation layer, so the two can never
> disagree on the number itself.

---

## `GET /api/mobile/alerts`

**Live** · no plan gate

| Param | Type | Required |
|---|---|---|
| `cursor` | string | no |

```jsonc
{
  "alerts": [
    {
      "id": "uuid",
      "type": "price_drop",
      "title": "Competitor dropped price",
      "message": "Al-Fatah cut Dior 100ml by 8%.",
      "isRead": false,
      "createdAt": "2026-09-15T08:30:00.000Z"
    }
  ],
  "nextCursor": "base64url-string"     // null when done
}
```

Newest first, 20 per page. See [Pagination](#pagination).

---

## `POST /api/mobile/alerts/read`

**Live** · no plan gate

Two body shapes. Pick one:

```jsonc
{ "ids": ["uuid", "uuid"] }    // specific alerts — max 100 per call
```
```jsonc
{ "all": true }                // clear the entire feed
```

Returns `{ "markedCount": 2 }` or `{ "markedAll": true }`.

**An empty `ids` array returns `400`, not "mark everything."** That's
deliberate — an empty array is what a buggy client sends by accident, and
silently wiping the feed isn't a failure mode worth allowing.

**Send an array for swipe-to-clear.** One request for five rows instead of
five requests — on a phone connection that's the difference between instant
and laggy.

---

# Market

## `GET /api/mobile/market`

**Live** · `forecast` block needs `forecasting` (`premium`); the rest is free

| Param | Type | Required |
|---|---|---|
| `categorySlug` | string | no |

The entire Market screen in one call.

```jsonc
{
  "categorySlug": "beauty-and-personal-care",
  "categoryName": "Beauty & Personal Care",
  "currency": "PKR",

  "pricing": {                    // null when the category has no scraped data
    "count": 7572,                // listings behind these numbers
    "minPrice": 25,
    "p25": 640,                   // null below a 15-listing sample floor
    "median": 1105,
    "p75": 2799,                  // same floor
    "maxPrice": 480000,
    "avgPrice": 2403,
    "samplePlatforms": ["Al-Fatah", "Bagallery"]
  },

  "forecast": {                   // null if premium-gated OR too little history
    "trendDirection": "down",     // up | down | flat
    "changePerWeek": -77,
    "points": [
      { "date": "2026-08-16", "value": 1180, "isProjected": false },
      { "date": "2026-09-16", "value": 1102, "isProjected": true }
    ]
  },

  "pricePosition": {              // the seller's own products, bucketed
    "totalProducts": 87,
    "farFromMedianCount": 75,     // the "75 of 87" headline
    "bands": [                    // always 5, always this order
      { "band": "far-above", "label": "25%+ above",  "count": 49 },
      { "band": "above",     "label": "5–25% above", "count": 4  },
      { "band": "at-market", "label": "Within 5%",   "count": 3  },
      { "band": "below",     "label": "5–25% below", "count": 5  },
      { "band": "far-below", "label": "25%+ below",  "count": 26 }
    ],
    "anyPackSizeAdjusted": true
  }
}
```

**Client notes**

- `p25` / `p75` are `null` below a 15-listing sample floor. A percentile
  from a handful of rows is a guess wearing a suit. **Render a dash.**
- `forecast.points` mixes history and projection in one array — split on
  `isProjected`. Solid line for `false`, dashed for `true`.
- `forecast: null` → hide the card entirely. Either the seller isn't on
  `premium`, or there's too little history (under 5 data points) for a
  trend line to mean anything.
- Bands arrive worst-first. Render in order.
- **`pricePosition` covers this category only.** The underlying computation
  runs over the seller's whole catalogue; it is narrowed here, because
  everything else in this response is about one category and a product
  judged against a different median would make the headline meaningless.
  `totalProducts` is therefore the count *in this category*, not the
  catalogue size.

> ⚠️ **`anyPackSizeAdjusted: true` means the comparison is approximate.**
> The seller's own price is adjusted for pack size; the market median isn't.
> In a category full of multipacks this inflates the "far from median"
> count. When `true`, say the comparison is approximate rather than stating
> the headline as fact.

---

## `GET /api/mobile/categories`

**Live** · no plan gate · no params

Fills the category switcher sheet. Returns the **markets the seller
tracks** (`seller_domains`) - not the categories their products are in,
and not the full 12-category taxonomy.

These are different things. A seller can have products in twenty
categories and track zero markets. A tracked market is created only by
finishing onboarding on the web, adding one on the web Settings page, or
bulk CSV import (which auto-assigns the first one; further ones need the
Premium `multi_domain` plan). Adding products one at a time never creates
one.

**An empty list is a correct answer, not an error.** It means the account
has not picked a market yet. On a test account created outside the web
app's onboarding flow, expect exactly this until someone opens the web
app as that user once and completes onboarding.

```jsonc
{
  "categories": [
    {
      "categorySlug": "beauty-and-personal-care",
      "categoryName": "Beauty & Personal Care",
      "isPrimary": true
    }
  ],
  "emptyReason": null   // "no_tracked_markets" when categories is [] - see above
}
```

**One category → hide the switcher.** Don't show a sheet with a single
option.

---

# Competitors

## `GET /api/mobile/competitors`

**Live** · needs `competitor_intel` (`paid`)

| Param | Type | Required | Notes |
|---|---|---|---|
| `categorySlug` | string | no | Falls back to the primary category |

Who's in this market and how they price.

```jsonc
{
  "categoryName": "Beauty & Personal Care",   // null if no category set
  "marketMedianPrice": 1105,                  // null if unscraped
  "currency": "PKR",

  "competitors": [                            // max 8, ranked
    {
      "name": "Al-Fatah",
      "platformName": "Al-Fatah",
      "skuCount": 412,
      "assortmentShare": 0.18,     // 0–1 — share of all listings in this market
      "medianPrice": 980,          // null if unknown
      "priceIndex": -0.08          // negative = they undercut the market
    }
  ],

  "emptyReason": null              // null | "no_category" | "no_named_sellers"
}
```

**Client notes**

- **`priceIndex` is the most useful number here.** `-0.08` = prices 8%
  below the market median. Lead with it.
- `categorySlug` is echoed back so you can tell which market the numbers
  describe — a stale or not-yours slug silently falls back to the primary,
  and this is how you notice.
- **Branch on `emptyReason`, never on `competitors.length === 0`.**
  "You haven't set a category" and "this market has no named sellers" are
  different problems with different fixes, and an empty list can't tell
  them apart.

Desktop shows 9 columns here (brand count, in-stock rate, sold units,
ratings, repricing rate, tenure). Those stay on desktop — see
[Not on mobile](#not-on-mobile).

---

## `GET /api/mobile/competitors/moves`

**Live** · needs `anomaly_detection` (`premium`)

| Param | Type | Required |
|---|---|---|
| `categorySlug` | string | no |

What *changed*. Distinct from `/competitors`, which is the static picture.

```jsonc
{
  "categorySlug": "beauty-and-personal-care",
  "categoryName": "Beauty & Personal Care",
  "currency": "PKR",

  "stockOuts": [                          // max 10, longest out first
    {
      "id": "uuid",
      "title": "Dior Eau Sauvage Lotion Apres-Rasage 100ml",
      "platformName": "Al-Fatah",
      "price": 21900,                       // null if unpriced
      "imageUrl": null,                     // null → render a placeholder tile
      "url": "https://...",
      "lastSeenAt": "2026-09-02T00:00:00.000Z",
      "duration": {                         // null if we have no history
        "days": 13,
        "confirmed": false
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
      "pctChange": -5.5                     // signed percentage, not a fraction
    }
  ]
}
```

**Client notes**

- **`duration.confirmed` changes your wording.**
  `true` → "Out 13d" (measured from a real in-stock sighting).
  `false` → "Out 13+d" (we've never seen it in stock, so 13 days is a
  floor). The mockup's `13+d` is right for `false`.
- Anomalies cover **the last 7 days**. Label the section with the window.
- Anomalies are capped at 50; stock-outs at 10. Both are already ranked
  (anomalies by how unusual, stock-outs by how long they've been out), so
  the caps take the top of a ranking rather than an arbitrary slice.
  **Don't re-sort anomalies by raw percentage** — that undoes the ranking
  described below.

> **Why some 5% moves outrank 20% moves.** Anomalies use IQR outlier
> detection over week-over-week changes, not a fixed threshold — so what
> counts as "unusual" adapts to how volatile that category actually is. A
> 5% move in a stable category can be more anomalous than a 20% move in
> electronics during a sale. A price must also be an outlier across **two**
> baselines before it surfaces, so one bad scrape can't produce an alert.

---

# Pricing & products

## `GET /api/mobile/pricing`

**Live** · needs `pricing_recommendations` (`paid`)

| Param | Type | Required |
|---|---|---|
| `categorySlug` | string | no |
| `cursor` | string | no |

```jsonc
{
  "currency": "PKR",
  "matchScopeCategorySlug": "beauty-and-personal-care",  // NOT a filter — see below
  "totalCount": 87,                // rows in the whole set, not on this page
  "recommendations": [
    {
      "productId": "uuid",
      "productTitle": "Samsung Galaxy A15",
      "categorySlug": "mobiles-and-electronics",
      "categoryName": "Mobiles & Electronics",

      "currentPrice": 65000,
      "recommendedPrice": 71875,
      "direction": "increase",         // increase | decrease | hold

      "competitorLow": 68000,
      "competitorHigh": 75000,
      "marginConstrained": false,
      "matchConfidence": 0.72,         // null when no confident title match
      "duplicateEntries": 1,

      "rationale": "Room to raise price while staying inside the competitor band."
    }
  ],
  "nextCursor": null
}
```

**Client notes**

- **Render `rationale` word for word.** It's written for the seller. Don't
  summarise or rewrite it.
- **The method is rules, not AI, and saying so builds trust.** The
  recommendation is the competitor band (±5% off a matched competitor, or
  the category P25–P75 when there's no match), floored at cost × 1.15. The
  mockup's "Rule-based · Competitor band + your margin floor" subheading is
  correct — keep it.
- `marginConstrained: true` → the margin floor sits above the whole
  competitor band. The seller can't compete on price here without a thin
  margin. **That's a real finding, surface it.**
- `duplicateEntries > 1` → the seller has duplicate rows for one product.
  The backend merges them (keeping the highest cost, so the margin floor
  clears the dearest stock actually held), but the data problem is still
  there. Worth a quiet note.

- **`cursor` here is an offset, not a timestamp.** Every other paginated
  endpoint pages on a timestamp because its feed grows from the top as
  crons write. This list doesn't: it is recomputed in full from the
  seller's own catalogue each call, in a fixed order (largest price gap
  first). Still opaque — pass `nextCursor` back untouched. An unreadable
  cursor is a `400`, not a silent restart at page one.
- **No cost price is returned.** It's the one number a seller wouldn't want
  read over their shoulder on a bus, and nothing here needs it — the margin
  floor is already inside `recommendedPrice` and named in `rationale`.

> ⚠️ **`categorySlug` on each row is the category that row was judged
> against — always the product's own, never the one on screen.** The
> `categorySlug` you *send* becomes `matchScopeCategorySlug` in the
> response: it scopes the competitor title-matching pass and **nothing
> else**. Every product in the catalogue still comes back, each priced
> against its own category's band. This is why the mockup can show a Home &
> Kitchen recommendation under a Beauty pill. If you filter client-side by
> selected category, you'll hide valid advice. See
> [Decide before building](#decide-before-building) #1.

---

## `GET /api/mobile/products`

**Live** · no plan gate

| Param | Type | Required | Notes |
|---|---|---|---|
| `cursor` | string | no | |
| `q` | string | no | Case-insensitive substring match on title |

```jsonc
{
  "products": [
    {
      "id": "uuid",
      "title": "Samsung Galaxy A15",
      "price": 65000,              // null if unpriced
      "currency": "PKR",           // per row — catalogues can mix currencies
      "stockQty": 12,              // null if not tracked
      "isActive": true,
      "imageUrl": null             // null → placeholder tile
    }
  ],
  "nextCursor": "base64url-string"
}
```

`q` is a substring match over the seller's own few hundred products — a
"find the one I'm holding" box, not a search engine. For searching the
*market*, use [`/api/mobile/search`](#get-apimobilesearch).

No cost price, SKU, or category — deliberately. See
[Not on mobile](#not-on-mobile).

---

## `PATCH /api/mobile/products/{id}/price`

**Live** · no plan gate

```jsonc
{ "price": 71875 }     // required, non-negative number
```

Returns:
```jsonc
{ "id": "uuid", "title": "Samsung Galaxy A15", "price": 71875, "currency": "PKR" }
```

`400` bad price · `404` not found or not yours · `500` write failed.

**This is the action the whole app builds toward:** a seller sees a
competitor undercut them in the feed, opens the product, changes the price
— without going back to a laptop.

**One field, on purpose.** An eight-field form half-submitted over a
dropping mobile connection is worse than not offering it.

---

## `GET /api/mobile/products/{id}/insight`

**Live** · needs `watchlists` (`paid`)

What a seller sees after tapping one of their own products: how this
specific product sits against the market.

```jsonc
{
  "product": {
    "id": "uuid",
    "title": "Samsung Galaxy A15",
    "price": 65000,                 // as stored, in the product's own currency
    "currency": "PKR",
    "imageUrl": null,
    "categorySlug": "mobiles-and-electronics",   // null if unmapped
    "categoryName": "Mobiles & Electronics"
  },

  "vsMarket": {                     // null if we can't place this product
    "currency": "PKR",              // reporting currency — not product.currency
    "comparedPrice": 65000,         // converted, and per-item where we could tell
    "categoryMedian": 68500,
    "pctVsMedian": -0.051,          // signed fraction: -0.051 = 5.1% below
    "band": "below",                // far-above | above | at-market | below | far-below
    "bandLabel": "5–25% below",
    "perUnit": false,               // true = comparedPrice was pack-adjusted
    "sampleSize": 7572              // listings behind categoryMedian
  },

  "closestCompetitors": [           // max 5, best match first
    {
      "title": "Samsung Galaxy A15 128GB",
      "platformName": "Daraz",
      "price": 68999,
      "currency": "PKR",
      "imageUrl": null,
      "matchConfidence": 0.81,      // 0–1
      "priceDeltaPct": -0.058,      // signed: seller is 5.8% cheaper than this
      "url": "https://..."
    }
  ],

  "priceHistory": [                 // last 30 days of the seller's own price
    { "date": "2026-09-01", "price": 65000 }
  ]
}
```

**Client notes**

- **`matchConfidence` bands are not calibrated.** They're based on title
  similarity with hand-picked cut points. Show matches as "closest we
  found", never as "the same product". The mockup's dashed empty-state
  card gets this tone right.
- `vsMarket: null` → we couldn't place this product. Say so plainly rather
  than showing a blank comparison. It happens for three reasons, all
  normal: the product has no category mapped, it has no price set, or the
  category has nothing scraped yet. A `200` with nulls, never an error —
  and `product` and `priceHistory` are still populated, so the screen has
  something to render. When `product.categorySlug` is `null`, the fix is
  the seller's: map the product to a category.
- **`priceDeltaPct` is precomputed.** It is the whole question the screen
  answers, and leaving the arithmetic to the client is how two clients end
  up rounding it differently.
- **`perUnit: true` means the comparison is approximate.** Only the
  seller's side is pack-normalised; the category median is scraped as-is.
  Same caveat as `/market`'s `anyPackSizeAdjusted`.
- `priceHistory` is the **seller's own** price, ascending by date, last 30
  days, points with no price dropped. No market band — the aligned
  price-vs-market series needs a wide chart and stays on desktop. This
  backs a sparkline.
- A product id that isn't this seller's is a `404`, never a `200` with an
  empty body.

---

## `GET /api/mobile/price-check`

**Live** · needs `competitor_intel` (`paid`)

**The quick action the app exists for:** the seller is standing at a
supplier holding something they don't stock yet. "Should I buy this, and
what would I sell it for?"

Keyed on a **title string**, not a product id — they don't own it yet.

| Param | Type | Required | Notes |
|---|---|---|---|
| `title` | string | **yes** | Max 200 characters |
| `categorySlug` | string | no | Falls back to primary category |
| `intendedPrice` | number | no | An unparseable value is ignored, not rejected |

```jsonc
{
  "query": "Dior Eau Sauvage 100ml",
  "categorySlug": "beauty-and-personal-care",
  "categoryName": "Beauty & Personal Care",
  "currency": "PKR",

  "matchCount": 14,              // scraped listings matching this title
  "competitorCount": 6,
  "platformCount": 4,

  "matchedPriceBand": {          // over MATCHED listings — null if nothing matched
    "min": 18500, "median": 21900, "max": 24000
  },

  "categoryPricing": { },        // the wider category, for context. null if unscraped

  "pricePosition": {             // present only if you sent intendedPrice
    "intendedPrice": 20000,
    "vsMatchedMedian": -0.087,
    "cheaperThanCount": 11,
    "verdict": "below market"    // below market | at market | above market
  },

  "hasEnoughData": true
}
```

**Client notes**

- ⚠️ **`hasEnoughData: false` is not optional to handle.** Showing
  confident-looking numbers computed from three listings is how a seller
  gets burned. When it's `false`, present the figures as a hint — or don't
  show them.
- `matchedPriceBand` is the band **for this product** — that's what the
  seller is deciding against. `categoryPricing` is background context.
  Don't mix them up.
- **Nothing is scraped on demand.** This searches what the last scraper run
  already wrote. `matchCount: 0` means we have no data, not "please wait".

---

# Search

## `GET /api/mobile/search`

**Live** · needs `competitor_intel` (`paid`)

Backs the search icon in the top bar. Searches **scraped market products** —
what competitors are selling — not the seller's own catalogue.

| Param | Type | Required | Notes |
|---|---|---|---|
| `q` | string | **yes** | Minimum 2 characters. Trimmed before the check |
| `categorySlug` | string | no | Narrows to one market. Omit to search everything scraped. |

```jsonc
{
  "query": "dior",
  "results": [
    {
      "id": "uuid",
      "title": "Dior Eau Sauvage Lotion Apres-Rasage 100ml",
      "platformName": "Al-Fatah",
      "price": 21900,            // null if unpriced
      "currency": "PKR",         // per row, AS SCRAPED — see below
      "inStock": false,
      "imageUrl": null,
      "url": "https://..."
    }
  ],
  "nextCursor": null             // always null today — see below
}
```

**Client notes**

- Under 2 characters returns an **empty list with `succeeded: true`**, not
  an error, and never touches the database. Don't show a failure state —
  just wait for more typing. `message` says what the floor is.
- ⚠️ **`currency` is per row and is the scraped currency — prices here are
  NOT converted to the seller's reporting currency.** That's why there is
  no top-level `currency` field: one would be a claim we can't make about a
  market carrying more than one. Render each row in its own.
- **`nextCursor` is always `null` today.** The underlying search caps at 20
  results with no offset, so there is no second page to hand out. The field
  is present rather than omitted so your "keep calling until `nextCursor`
  is null" loop works here unchanged — and so the day pagination lands,
  null simply becomes a cursor and nothing on your side breaks.
- **Two searches exist and they're different things.** Make it obvious
  which one the seller is in:
  - `/api/mobile/search` → the market (competitors' products)
  - `/api/mobile/products?q=` → the seller's own catalogue
- Tapping a result should lead to
  [`/price-check`](#get-apimobileprice-check) with that title — that's the
  natural next question ("what would I sell this for?").

---

# Device & push

## `POST` / `DELETE /api/mobile/devices`

**Live** · no plan gate

**Register** (`POST`):
```jsonc
{
  "pushToken": "ExponentPushToken[...]",   // required
  "platform": "ios",                       // required: ios | android
  "appVersion": "1.2.0"                    // optional
}
```
→ `{ "registered": true }`

**Unregister** (`DELETE`):
```jsonc
{ "pushToken": "ExponentPushToken[...]" }
```
→ `{ "removed": true }`

**Call `POST` on every app launch.** Expo tokens rotate. The write is an
upsert keyed on the token, so repeat calls don't pile up rows.

⚠️ **Call `DELETE` on sign-out. This is not optional.** Without it, a shared
or resold phone keeps receiving the previous seller's alerts until the
token happens to rotate.

### How push works

- Delivered through the **Expo push service**, not raw FCM/APNs.
- Sent **three times a day: 08:30, 14:30, 20:30 PKT.**
- Notifications older than **24 hours are never sent** — a new install
  doesn't get a backlog dumped on it.
- Max **500 per run**.
- Dead tokens are pruned automatically. You don't manage cleanup beyond
  the `DELETE` on sign-out.

The payload mirrors an alert (`title`, `message`, `type`, alert id). On
tap, deep-link into the alert feed and call `POST /alerts/read` with that
id so the badge and the feed agree.

---

# Screen-to-endpoint map

| Screen / element | Endpoint | |
|---|---|---|
| **Overview** — alert card, freshness, counters | `GET /pulse` | L |
| **Overview** — stat tiles | `GET /pulse` (`domainStats`) | L |
| **Overview** — revenue / orders / AOV KPIs | `GET /kpis` | L |
| **Market** — median, min/P75/average | `GET /market` | L |
| **Market** — forecast sparkline | `GET /market` | L |
| **Market** — price-position bars | `GET /market` | L |
| **Competitors** — who's in this market | `GET /competitors` | L |
| **Competitors** — out of stock | `GET /competitors/moves` | L |
| **Competitors** — price anomalies | `GET /competitors/moves` | L |
| **Pricing** — recommendations | `GET /pricing` | L |
| Top bar — category pill | `GET /categories` | L |
| Top bar — search icon | `GET /search` | L |
| Top bar — bell + feed | `GET /alerts`, `POST /alerts/read` | L |
| Product list + price edit | `GET /products`, `PATCH /products/{id}/price` | L |
| Product detail | `GET /products/{id}/insight` | L |
| "Should I stock this?" | `GET /price-check` | L |
| Push setup | `POST` / `DELETE /devices` | L |

**Built, but not in the design yet:** `price-check` and the price edit.
These are the app's most differentiated capability — a seller at a supplier
deciding whether to buy something. **Worth giving a screen.**

---

# Not on mobile

The web app has 56 routes. Mobile has 15. These are the deliberate
omissions — say so when asked, rather than treating them as gaps.

| Not exposed | Why |
|---|---|
| Orders & customers CRUD, bulk import | Back-office work. Belongs on a desktop with a spreadsheet open. |
| Report generation (PDF/PPTX) | Nobody reads a generated PDF on a phone. |
| Watchlist management | Creating and organising lists is desktop work; the *alerts* they produce come through push. |
| Revenue forecasting, churn, at-risk customers | Analysis screens. Too dense to compress honestly. |
| Full competitor scorecard (9 columns) | 9 columns on a 390px screen helps nobody. Mobile gets the 3 that are actionable. |
| Full product record (cost price, SKU, category) | Cost price is used to compute the margin floor but is **never sent to the phone**. |
| Market-definition editing | A destructive setting. Changing it re-scopes every number the seller sees. |
| Marketing-site AI assistant | Public route for the landing page. No seller identity involved. |
| Anything that triggers a scrape | **No mobile endpoint queues work of any kind.** Opening the app can never cause load. |

**Also, by design:**

- **No server-side session state.** No "currently selected category" on the
  server — the client sends `categorySlug` every time.
- **No loosened paywalls.** Anything gated on desktop is gated identically
  here. A feature reachable from a phone but not a browser would be a hole,
  not a feature.

---

# Decide before building

Four questions. **#1 is answered** — the backend settles it. #2–#4 are UI
calls that are still yours.

**1. Does `/pricing` show the selected category, or the whole catalogue?
→ The whole catalogue. Settled.**
`getPricingRecommendations` selects **every** active product that has both a
cost and a sell price, and prices each against **its own** category's band.
The `categorySlug` argument only scopes the title-matching pass; it does not
filter the result set. That was a deliberate fix — the function used to judge
a seller's beds against the beauty P75, and the advice was simply wrong.

So the mockup showing a Home & Kitchen row under a Beauty pill is **correct**.
Two consequences: **don't filter client-side by the selected category** (you'd
hide valid advice), and **hide the category pill on the Pricing tab** (it
implies a filter that isn't applied).

**2. Is "75 of 87 products sit 25%+ away" the right headline?**
That flags 86% of the catalogue, and the pack-size caveat inflates it
further. It will be red-alert on almost every account, every time.
Consider leading with the smallest band instead.

**3. Where do the two searches live in the UI?**
One magnifying glass, two different searches (market vs. own catalogue).
Decide whether that's a toggle, two entry points, or one combined screen —
it changes whether `/search` needs to return both shapes.

**4. Is the sparkline informational or decorative?**
`forecast.points` carries real dated values. If the curve stays axis-less,
say so and we keep the payload small. If it gets labels, the client needs
the dates — which it already has.

---

# Where things live

| Thing | Path |
|---|---|
| Shared plumbing (envelope, auth, cursors) | `app/src/lib/mobile/respond.ts` |
| Route handlers | `app/src/app/api/mobile/**` |
| The logic routes compose | `app/src/lib/market-intel/**` |
| Plan tiers | `app/src/lib/market-intel/core/entitlements.ts` |
| Push job | `app/src/lib/market-intel/jobs/push-notifications-job.ts` |
| Cron schedule | `.github/workflows/market-intel-cron.yml` |
| Device table | `scraper/migrations/052_*.sql` |
| Whole-product feature list | `FEATURES.md` Part 10 |
| What's next | `ROADMAP.md` Phase G |

**Known gap:** the 8 routes that shipped first (`pulse`, `alerts`,
`alerts/read`, `competitors`, `products`, `products/{id}/price`,
`price-check`, `devices`) have **no automated tests** — only the push job
does. The 7 added later (`categories`, `kpis`, `market`,
`competitors/moves`, `pricing`, `products/{id}/insight`, `search`) carry 45
tests between them. Tracked in `ROADMAP.md` Phase G.
