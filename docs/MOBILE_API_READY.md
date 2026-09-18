# Ryvl mobile API — endpoints you can call today

**Everything in this file is built, deployed and working.** Every request and
response below was read straight off the route handlers, not designed on
paper. You can start building against all of it now.

**There is no "planned" list any more.** The seven endpoints that used to
sit at the bottom of this file under *Not built yet* have all shipped, and
are documented below like the rest. Field-by-field detail for anything here
is in [`MOBILE_API.md`](MOBILE_API.md); the machine-readable version is
[`openapi-mobile.yaml`](openapi-mobile.yaml).

---

## The 15 endpoints

| Method | Path | What it's for |
|---|---|---|
| GET | [`/api/mobile/pulse`](#1-get-apimobilepulse) | The whole home screen in one call |
| GET | [`/api/mobile/alerts`](#2-get-apimobilealerts) | Alert feed, paginated |
| POST | [`/api/mobile/alerts/read`](#3-post-apimobilealertsread) | Mark alerts read |
| GET | [`/api/mobile/competitors`](#4-get-apimobilecompetitors) | Who's in this market, how they price |
| GET | [`/api/mobile/products`](#5-get-apimobileproducts) | The seller's own catalogue |
| PATCH | [`/api/mobile/products/{id}/price`](#6-patch-apimobileproductsidprice) | Change one price |
| GET | [`/api/mobile/price-check`](#7-get-apimobileprice-check) | "Should I stock this, at what price?" |
| POST/DELETE | [`/api/mobile/devices`](#8-post--delete-apimobiledevices) | Push registration |
| GET | [`/api/mobile/categories`](#9-get-apimobilecategories) | The category switcher sheet |
| GET | [`/api/mobile/kpis`](#10-get-apimobilekpis) | Revenue / orders / AOV / new-customer tiles |
| GET | [`/api/mobile/market`](#11-get-apimobilemarket) | The whole Market tab, in one call |
| GET | [`/api/mobile/competitors/moves`](#12-get-apimobilecompetitorsmoves) | Stock-outs + price anomalies |
| GET | [`/api/mobile/pricing`](#13-get-apimobilepricing) | The Pricing tab, paginated |
| GET | [`/api/mobile/products/{id}/insight`](#14-get-apimobileproductsidinsight) | One product vs. the market |
| GET | [`/api/mobile/search`](#15-get-apimobilesearch) | The search icon in the top bar |

---

## Before your first call — 3 things

**1. Auth.** Every endpoint. No exceptions, no API key.

```
Authorization: Bearer <supabase_access_token>
```

Get the token from the Supabase JS SDK — same one the web app uses:

```js
const { data } = await supabase.auth.getSession();
const token = data.session?.access_token;
```

A valid Supabase user with **no seller account** gets `401`, not an empty
`200`. Treat it as "not signed in".

**2. Every response has the same envelope.**

```jsonc
{
  "succeeded": true,
  "data":      { },    // your payload — null on failure
  "errors":    [],     // technical strings, for you, not the seller
  "message":   "OK"    // short, safe to show the seller
}
```

**Branch on the HTTP status code, not on `succeeded`.** They always agree,
but the status is available before the body parses.

**Never branch on the text of `message` or `errors`** — that's wording, not
API. Branch on status codes and structured fields like `emptyReason`.

**3. A working call.**

```bash
curl https://<host>/api/mobile/pulse \
  -H "Authorization: Bearer $TOKEN"
```

A tiny client wrapper worth writing once:

```js
async function api(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body.message, body.errors);
  return body.data;
}
```

---

## Error codes — the same five everywhere

| Status | Means | What to do |
|---|---|---|
| `400` | Missing param, bad JSON, or bad cursor | Fix the request. Don't retry unchanged. |
| `401` | No/expired token, or no seller account | Refresh the session, else sign out. |
| `403` | Plan doesn't include this feature | Show an upgrade prompt. |
| `404` | Doesn't exist **or** isn't theirs | Treat as not-found — the API won't tell you which. |
| `500` | Server or database failure | Retry with backoff. |

> ⚠️ **"No category selected" arrives two different ways, and you must handle
> both.** `/market`, `/competitors/moves` and `/pricing` return a **`400`**
> with `"No category selected"` when the seller has no category and didn't
> send one. `/competitors` returns a **`200`** with
> `emptyReason: "no_category"` instead — it predates the shared helper and its
> empty-state contract was already documented and in use, so it wasn't changed
> underneath a client. Both mean the same thing: send the seller to onboarding.
> `/pulse` tells you up front — `domain: null`.

> ⚠️ **You will never see a `403` today.** A demo flag unlocks every paid
> feature and billing isn't wired yet. **Handle it anyway.** When billing
> ships these gates go live with no backend change, and a client that has
> never handled `403` breaks everywhere at once.

---

## Pagination — cursors, not page numbers

Three endpoints paginate: `/alerts`, `/products` and `/pricing`.

```
GET /api/mobile/alerts                                    ← first page
GET /api/mobile/alerts?cursor=MjAyNi0wOS0xNVQwODozMDowMFo ← next page
```

- **20 items per page, everywhere.** One number, so you can't get it wrong.
- `nextCursor: null` → you're at the end. Stop.
- Pass the cursor back **exactly as received**. Don't decode or modify it.
- A malformed cursor returns `400` — it does *not* silently reset to page one.

> **Why not page numbers?** The alert feed grows from the top as background
> jobs write new rows. With `?page=2`, one alert arriving between two fetches
> shifts everything down and you render a duplicate.

`/alerts` and `/products` page on a timestamp for exactly that reason.
`/pricing` is an offset behind the same opaque encoding, because its list is
recomputed in full on every call in a fixed order and does not grow from the
top. **You cannot tell the two apart and you don't need to** — one
"keep calling until `nextCursor` is null" loop works for all three.

---

## Money and numbers — read this once

- **All money is a raw number**, never a formatted string. `1105`, not
  `"PKR 1,105"`. You format it.
- **Every response containing money carries a `currency` field.**
- On `/products`, `currency` is **per row** — a catalogue can legitimately
  mix currencies.
- **`null` means "not available", not zero.** A `null` median means we don't
  have the data; a `0` would be a real price. **Render a dash for `null`,
  never a `0`.**
- Percentages against a baseline are **signed fractions**: `-0.08` = 8%
  below. That covers `priceIndex`, `pctVsMedian`, `priceDeltaPct`,
  `assortmentShare` and `vsMatchedMedian`.
- ⚠️ **Two fields break that rule and are signed *percentages* instead:**
  `diffPct` on `/kpis` (`12.4` = up 12.4%) and `pctChange` on
  `/competitors/moves` (`-20` = down 20%). Both predate the convention and
  both already ship, so they stay rather than being silently changed under a
  client that already handles them. **These two are the whole exception
  list** — everywhere else, assume fractions.

---

# 1. `GET /api/mobile/pulse`

**The whole home screen in one request.** No plan gate.

| Param | Required | Notes |
|---|---|---|
| `categorySlug` | no | Which market the dashboard reflects. Falls back to the primary category |

```bash
# the seller's primary category
curl https://<host>/api/mobile/pulse -H "Authorization: Bearer $TOKEN"

# the dashboard, re-scoped to a category the switcher selected
curl "https://<host>/api/mobile/pulse?categorySlug=home-and-kitchen" \
  -H "Authorization: Bearer $TOKEN"
```

```jsonc
{
  "seller": {
    "businessName": "Sana's Store",
    "planTier": "free",              // free | paid | premium
    "currency": "PKR"
  },

  "domain": {                        // the category this response is scoped to
    "categorySlug": "beauty-and-personal-care",   // echoed back — read it to label the screen
    "categoryName": "Beauty & Personal Care"      // null if no category picked yet
  },

  "counts": {                        // bind badges straight to these
    "unreadAlerts": 3,
    "competitorStockOuts": 10,
    "lowStockProducts": 2
  },

  "highlights": [                    // always at least 1
    {
      "tone": "warning",             // good | warning | neutral
      "headline": "3 unread alerts",
      "detail": "A tracked competitor moved on price or stock."
    }
  ],

  "recentAlerts": [ /* max 5, newest first — same shape as /alerts */ ],

  "marketData": {
    "lastScrapedAt": "2026-09-14T11:02:00.000Z",   // null if never scraped
    "platformsTracked": 8
  },

  "domainStats": {                   // null when domain is null
    "listingsTracked": 4210,
    "platformsTracked": 6,
    "productsPriced": 87,            // the seller's own, with a price set
    "sellersInDomain": 41,           // null below the peer floor — never 0
    "peersVisible": 12,
    "benchmarksTracked": 4,
    "peerFloor": 3                   // fewer than this and peer data is withheld
  }
}
```

**What to know**

- **This is the endpoint that changes the dashboard when the seller switches
  category.** Send the `categorySlug` from the top-bar switcher and the whole
  response re-scopes — `counts`, `highlights`, `domainStats`, freshness and
  `domain` all follow it. Omit it and you get the primary category, exactly as
  before. A stale or not-this-seller's slug falls back to primary rather than
  erroring, so the switcher can send whatever it has; read the echoed
  `domain.categorySlug` to label the screen.
- **`domainStats` backs the four stat tiles on the home screen.** Same three
  sources the desktop Market page reads. Folded in here rather than given
  its own endpoint — a second request to fill four tiles beside the
  highlights is a spinner the seller didn't need.
- **`sellersInDomain: null` means "too few peers to say", not zero.** Below
  `peerFloor` we withhold the count rather than publishing a number that
  could identify an individual seller. Render a dash.
- `highlights` is **already sorted by priority** — operational and
  time-sensitive first. Render in the order given. `tone` is data so you can
  colour it; don't re-classify it yourself.
- **`domain: null` → the seller hasn't picked a category.** `highlights`
  collapses to a single "Pick a category to start". Show onboarding, not an
  empty dashboard.
- **Always show `lastScrapedAt`.** A phone user has less context than someone
  at a desktop, so the data's age matters more here, not less.
- Nothing here triggers a scrape. Opening the app can never queue work.

---

# 2. `GET /api/mobile/alerts`

Paginated feed, newest first. No plan gate.

| Param | Required | Notes |
|---|---|---|
| `cursor` | no | From the previous `nextCursor` |

```bash
curl "https://<host>/api/mobile/alerts?cursor=$CURSOR" \
  -H "Authorization: Bearer $TOKEN"
```

```jsonc
{
  "alerts": [
    {
      "id": "3f1c…",
      "type": "price_drop",
      "title": "Competitor dropped price",
      "message": "Al-Fatah cut Dior 100ml by 8%.",
      "isRead": false,
      "createdAt": "2026-09-15T08:30:00.000Z"
    }
  ],
  "nextCursor": "MjAyNi0wOS0xNFQxMTowMDowMFo"   // null when done
}
```

`400` with a bad cursor. See [Pagination](#pagination--cursors-not-page-numbers).

---

# 3. `POST /api/mobile/alerts/read`

Two body shapes. Pick one. No plan gate.

```bash
# specific alerts — max 100 per call
curl -X POST https://<host>/api/mobile/alerts/read \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ids":["3f1c…","9ab2…"]}'
```
→ `{ "markedCount": 2 }`

```bash
# clear the whole feed
curl -X POST https://<host>/api/mobile/alerts/read \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"all":true}'
```
→ `{ "markedAll": true }`

**What to know**

- **Send an array for swipe-to-clear.** One request for five rows instead of
  five requests — on a mobile connection that's the difference between
  instant and laggy.
- **An empty `ids` array returns `400`, not "mark everything".** Deliberate:
  an empty array is what a buggy client sends by accident, and silently
  wiping the feed isn't a failure mode worth allowing.
- More than 100 ids → `400`. Batch them.
- **`markedCount` is the number of ids you sent**, not a count of rows that
  actually changed. Already-read ids are included in it. Don't use it to
  decrement a badge — refetch `/pulse` instead.

---

# 4. `GET /api/mobile/competitors`

**Needs `competitor_intel` (paid tier).**

Who's in this market and how they price. This is the *static* picture — for
what **changed**, see [`/competitors/moves`](#12-get-apimobilecompetitorsmoves).

| Param | Required | Notes |
|---|---|---|
| `categorySlug` | no | Falls back to the seller's primary category |

```bash
curl https://<host>/api/mobile/competitors -H "Authorization: Bearer $TOKEN"
```

```jsonc
{
  "categorySlug": "beauty-and-personal-care", // echoed back — null if no category set
  "categoryName": "Beauty & Personal Care",   // null if no category set
  "marketMedianPrice": 1105,                  // null if unscraped
  "currency": "PKR",

  "competitors": [                            // max 8, ranked
    {
      "name": "Al-Fatah",
      "platformName": "Al-Fatah",
      "skuCount": 412,
      "assortmentShare": 0.18,    // 0–1, share of all listings in this market
      "medianPrice": 980,         // null if unknown
      "priceIndex": -0.08         // negative = they undercut the market
    }
  ],

  "emptyReason": null             // null | "no_category" | "no_named_sellers"
}
```

**What to know**

- **`priceIndex` is the most useful number here.** `-0.08` = they price 8%
  below the market median. Lead with it.
- **Branch on `emptyReason`, never on `competitors.length === 0`.** "You
  haven't set a category" and "this market has no named sellers" are
  different problems with different fixes, and an empty array can't tell them
  apart.
- **`categorySlug` is honoured and echoed back.** A missing, stale or
  not-this-seller's slug falls back to the primary category rather than
  erroring — so the switcher can send whatever it has. Read the echoed value
  to label the screen; don't assume you got the one you sent.
- Desktop shows 9 columns here. Mobile gets the 3 that are actionable. That's
  a decision, not a gap.

---

# 5. `GET /api/mobile/products`

The seller's own catalogue. No plan gate.

| Param | Required | Notes |
|---|---|---|
| `cursor` | no | |
| `q` | no | Case-insensitive substring match on title |

```bash
curl "https://<host>/api/mobile/products?q=galaxy" \
  -H "Authorization: Bearer $TOKEN"
```

```jsonc
{
  "products": [
    {
      "id": "8c4d…",
      "title": "Samsung Galaxy A15",
      "price": 65000,          // null if unpriced
      "currency": "PKR",       // PER ROW — catalogues can mix currencies
      "stockQty": 12,          // null if not tracked
      "isActive": true,
      "imageUrl": null         // null → render a placeholder tile
    }
  ],
  "nextCursor": "MjAyNi0…"
}
```

**What to know**

- `q` searches **the seller's own few hundred products** — a "find the one
  I'm holding" box, not a search engine.
- No cost price, SKU or category — deliberately. Cost price is used
  server-side for margin calculations and is never sent to the phone.
- Includes inactive products (`isActive: false`). Filter client-side if the
  screen shouldn't show them.

---

# 6. `PATCH /api/mobile/products/{id}/price`

Change one product's price. No plan gate.

```bash
curl -X PATCH https://<host>/api/mobile/products/8c4d…/price \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"price":71875}'
```

```jsonc
{ "id": "8c4d…", "title": "Samsung Galaxy A15", "price": 71875, "currency": "PKR" }
```

| Status | When |
|---|---|
| `400` | `price` missing, negative, or not a number |
| `404` | No such product, **or** it isn't this seller's |
| `500` | Write failed |

**What to know**

- **This is the action the whole app builds toward:** a seller sees a
  competitor undercut them in the feed, opens the product, changes the price
  — without going back to a laptop. Make it fast and make it obvious.
- **One field, on purpose.** An eight-field form half-submitted over a
  dropping mobile connection is worse than not offering it at all.
- Ownership is enforced server-side on every call. A seller cannot touch
  another seller's product even with a valid token.

---

# 7. `GET /api/mobile/price-check`

**Needs `competitor_intel` (paid tier).**

The seller is standing at a supplier holding something they don't stock yet.
*"Should I buy this, and what would I sell it for?"*

Keyed on a **title string**, not a product id — they don't own it yet.

| Param | Required | Notes |
|---|---|---|
| `title` | **yes** | Max 200 characters |
| `categorySlug` | no | Falls back to the primary category |
| `intendedPrice` | no | Must be > 0. Anything else is ignored, not rejected |

```bash
curl -G https://<host>/api/mobile/price-check \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "title=Dior Eau Sauvage 100ml" \
  --data-urlencode "intendedPrice=20000"
```

```jsonc
{
  "query": "Dior Eau Sauvage 100ml",       // echoed back, so an async result can't be mislabelled
  "categorySlug": "beauty-and-personal-care",
  "categoryName": "Beauty & Personal Care",
  "currency": "PKR",

  "matchCount": 14,                         // scraped listings matching this title
  "competitorCount": 6,
  "platformCount": 4,

  "matchedPriceBand": {                     // over MATCHED listings. null if nothing matched
    "min": 18500, "median": 21900, "max": 24000
  },

  "categoryPricing": { },                   // the wider category, for context. null if unscraped

  "pricePosition": {                        // only if you sent intendedPrice
    "intendedPrice": 20000,
    "vsMatchedMedian": -0.087,              // signed fraction vs the matched median
    "cheaperThanCount": 11,                 // matched listings they'd undercut
    "verdict": "below market"               // below market | at market | above market
  },

  "hasEnoughData": true
}
```

**What to know**

- ⚠️ **`hasEnoughData: false` is not optional to handle.** Showing
  confident-looking numbers computed from three listings is how a seller gets
  burned. When it's `false`, present the figures as a hint — or don't show
  them.
- **`matchedPriceBand` is the band for *this product*** — that's what the
  seller is deciding against. `categoryPricing` is background context. Don't
  mix them up.
- **Nothing is scraped on demand.** This searches what the last scraper run
  already wrote. `matchCount: 0` means we have no data, **not** "please
  wait" — don't show a spinner and retry.
- `400` if there's no `title`, or if the seller has no category and you
  didn't send one.

---

# 8. `POST` / `DELETE /api/mobile/devices`

Push registration. No plan gate.

**Register:**
```bash
curl -X POST https://<host>/api/mobile/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pushToken":"ExponentPushToken[xxxxx]","platform":"ios","appVersion":"1.2.0"}'
```
→ `{ "registered": true }`

`platform` must be `ios` or `android` (case-insensitive). `appVersion` is
optional and truncated to 32 characters.

**Unregister:**
```bash
curl -X DELETE https://<host>/api/mobile/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pushToken":"ExponentPushToken[xxxxx]"}'
```
→ `{ "removed": true }`

**What to know**

- **Call `POST` on every app launch.** Expo tokens rotate. The write is an
  upsert keyed on the token, so repeat calls don't pile up rows.
- ⚠️ **Call `DELETE` on sign-out. This is not optional.** Without it, a shared
  or resold phone keeps receiving the previous seller's alerts until the
  token happens to rotate.

**How push actually works**

- Delivered through the **Expo push service**, not raw FCM/APNs.
- Sent **three times a day: 08:30, 14:30, 20:30 PKT**. Not real-time.
- Nothing older than **24 hours** is ever sent — a fresh install never gets a
  backlog dumped on it.
- Max 500 per run. Dead tokens are pruned automatically; you don't manage
  cleanup beyond the `DELETE` on sign-out.

The payload mirrors an alert (`title`, `message`, `type`, alert id). On tap,
deep-link into the feed and `POST /alerts/read` with that id so the badge and
the feed agree.

---

# 9. `GET /api/mobile/categories`

The category switcher sheet. No params, no plan gate.

```bash
curl https://<host>/api/mobile/categories -H "Authorization: Bearer $TOKEN"
```

```jsonc
{
  "categories": [
    { "categorySlug": "beauty-and-personal-care", "categoryName": "Beauty & Personal Care", "isPrimary": true },
    { "categorySlug": "home-and-kitchen",         "categoryName": "Home & Kitchen",          "isPrimary": false }
  ],
  "emptyReason": null          // "no_tracked_markets" when categories is []
}
```

**What to know**

- **These are the markets the seller is actually tracked in** — not the
  platform's full taxonomy. Offering all twelve categories would let someone
  pick a market they have no products in and then wonder why every screen
  behind it is empty.
- **Already ordered primary-first.** Render in the order given; pre-select
  the `isPrimary: true` row on first launch.
- **Cache this for the session.** It changes only when the seller edits their
  market definition, which happens on desktop.
- **An empty array is a correct answer, not an error**, and comes with
  `emptyReason: "no_tracked_markets"`. It means the seller has not picked a
  market yet - same state as `domain: null` on `/pulse`. Show "choose a
  market on the web app", not "no data".
- **"Categories" here means tracked markets, not product categories.** An
  account can have products in twenty categories and track zero markets.
  A tracked market is created only by finishing onboarding on the web,
  adding one on the web Settings page, or bulk CSV import. Adding products
  one at a time never creates one. A test account made outside the web
  app's onboarding will return `[]` until someone opens the web app as that
  user once.
- The `categorySlug` is the only category identifier in the whole mobile API.
  Every endpoint that takes a category takes this string.

---

# 10. `GET /api/mobile/kpis`

**The seller's own business numbers** — revenue, orders, AOV, new customers —
each against the prior period of the same length. No plan gate.

| Param | Required | Notes |
|---|---|---|
| `period` | no | `30d` (default) or `90d`. Anything else is a `400` |

```bash
curl "https://<host>/api/mobile/kpis?period=90d" -H "Authorization: Bearer $TOKEN"
```

```jsonc
{
  "currency": "PKR",
  "period": "90d",
  "comparedTo": "prior 90 days",        // ready to render under the tiles
  "kpis": [
    {
      "key": "revenue",                 // revenue | orders | aov | new_customers
      "label": "Revenue",               // ready to render
      "value": 482300.5,
      "format": "money",                // money | count — tells you how to format `value`
      "diffPct": 12.4,                  // PERCENTAGE (12.4 = +12.4%), not a fraction. null if no baseline
      "direction": "up"                 // up | down | flat
    }
  ]
}
```

**What to know**

- ⚠️ **`diffPct` here is a percentage (`12.4` = 12.4%), not a signed
  fraction.** It is the one place in this API that breaks the fractions rule,
  because it is a tile label rather than a computed comparison. Everywhere
  else `-0.08` means 8%.
- **`diffPct: null` is not `0`.** It means there was nothing to compare
  against — a brand-new account. **Hide the change indicator**, don't render
  "0%", which claims flat performance we have no evidence for.
- **Four zeros is a correct answer, not a failure.** These are the seller's
  own imported orders. A seller who has never imported anything gets zeros;
  say "import your orders", don't render four empty tiles.
- **Render the array in the order given** and key off `key`, not position.
- An unsupported `period` is a `400`, not a silent fall back to 30 days. A
  client asking for a window it won't get, and being told it did, surfaces as
  wrong numbers instead of an error.

---

# 11. `GET /api/mobile/market`

**The whole Market tab in one request:** what this category costs, where it's
heading, and where the seller's own prices sit inside it. No plan gate on the
endpoint — the forecast block inside it is premium.

| Param | Required | Notes |
|---|---|---|
| `categorySlug` | no | Falls back to the primary category |

```bash
curl https://<host>/api/mobile/market -H "Authorization: Bearer $TOKEN"
```

```jsonc
{
  "categorySlug": "beauty-and-personal-care",
  "categoryName": "Beauty & Personal Care",
  "currency": "PKR",

  "pricing": {                    // null if the category has nothing scraped
    "count": 4210,                // listings the stats stand on
    "minPrice": 100,
    "p25": 500,                   // null independently, below a 15-row sample floor
    "median": 1105,
    "p75": 1500,
    "maxPrice": 5000,
    "avgPrice": 1180,
    "samplePlatforms": ["Daraz", "Al-Fatah"]
  },

  "forecast": null,               // see below — null is the common case

  "pricePosition": {
    "totalProducts": 87,          // the seller's products IN THIS CATEGORY
    "farFromMedianCount": 75,     // the "75 of 87" headline
    "bands": [                    // always all 5, including empty ones, in order
      { "band": "far-above", "label": "25%+ above", "count": 40 },
      { "band": "above",     "label": "5–25% above", "count": 6 },
      { "band": "at-market", "label": "Within 5%",   "count": 6 },
      { "band": "below",     "label": "5–25% below", "count": 0 },
      { "band": "far-below", "label": "25%+ below",  "count": 35 }
    ],
    "anyPackSizeAdjusted": true   // the comparison is approximate — say so
  }
}
```

**What to know**

- ⚠️ **`forecast: null` means "hide the card", and you cannot tell why.**
  Two causes are deliberately not distinguished: the plan doesn't include
  forecasting, or there weren't enough data points to fit a line. Telling a
  free seller to "upgrade to see a forecast we couldn't compute anyway" is a
  worse experience than no card. **Do not show an upgrade prompt on this.**
- **`bands` is always 5 entries in fixed order, empty ones included.** So the
  bar chart doesn't reflow between categories. `label` is ready to render.
- **`totalProducts` is the in-category count, not the whole catalogue.**
  Everything else on this screen is about one category; mixing in products
  judged against a different median would make the headline mean nothing.
- ⚠️ **`anyPackSizeAdjusted: true` means say so.** Only the seller's side is
  normalised for pack size; the category median is scraped as-is. When this
  is set, the comparison is approximate — hedge the headline rather than
  stating it as fact.
- **`pricing.count` is the sample size.** A median over 12 listings is not
  the same claim as one over 4,000. Temper the wording when it's small.
- `pricing: null` and `pricing.p25: null` are two different "not availables"
  and the client renders a dash for both.

---

# 12. `GET /api/mobile/competitors/moves`

**Needs `anomaly_detection` (premium tier).**

What **changed** in the category — as opposed to `/competitors`, which is the
static picture of who's in it. Two sections of one screen, one request.

| Param | Required | Notes |
|---|---|---|
| `categorySlug` | no | Falls back to the primary category |

```bash
curl https://<host>/api/mobile/competitors/moves -H "Authorization: Bearer $TOKEN"
```

```jsonc
{
  "categorySlug": "beauty-and-personal-care",
  "categoryName": "Beauty & Personal Care",
  "currency": "PKR",

  "stockOuts": [                  // max 10, longest-out first
    {
      "id": "a91f…",
      "title": "Dior Eau Sauvage 100ml",
      "platformName": "Al-Fatah",
      "price": 21900,             // null if unknown
      "url": "https://…",
      "imageUrl": null,
      "lastSeenAt": "2026-09-02T09:11:00.000Z",
      "duration": { "days": 13, "confirmed": false }   // null if unmeasurable
    }
  ],

  "anomalies": [                  // max 50, already ranked
    {
      "productId": "7b2c…",
      "title": "Nivea Soft 200ml",
      "platformName": "Daraz",
      "imageUrl": null,
      "oldPrice": 1200,
      "newPrice": 960,
      "pctChange": -20            // PERCENTAGE, 1dp: -20 = down 20%
    }
  ]
}
```

**What to know**

- ⚠️ **`duration.confirmed: false` means `days` is a floor, not a
  measurement** — we've only seen it out of stock for that long, it may have
  been longer. Render `"Out 13+ days"` when `false`, `"Out 13 days"` when
  `true`. The `+` is the whole point of the field. `duration: null` → say
  "currently out of stock" with no number.
- ⚠️ **`pctChange` is a percentage (`-20` = down 20%), rounded to 1dp — not a
  signed fraction.** Same exception as `diffPct` on `/kpis`. Both predate the
  fractions convention and both already ship, so they stay.
- **Which moves appear is the interesting part, and it isn't a threshold.** A
  move qualifies by clearing an IQR fence computed against *that category's
  own* week-over-week volatility, and it must clear it against **two**
  baselines — so a one-off scrape blip is dropped. A 5% move in a stable
  category can qualify where a 20% move in a wild one doesn't. **Don't
  re-filter by size client-side**; you'd be second-guessing that with a flat
  number.
- The array is then ordered by **absolute** `pctChange`, biggest move first.
  Sorting by the signed value would bury every price cut at the bottom.
- **Stock-outs are the opportunity signal:** a competitor can't fulfil, so
  there's slack demand to pick up. Lead with them.
- Both lists can be empty, and that's the normal state in a quiet week —
  "nothing moved" is a legitimate screen, not an error.
- This is the only **premium**-gated endpoint in the mobile API. Everything
  else is free or paid tier.

---

# 13. `GET /api/mobile/pricing`

**Needs `pricing_recommendations` (paid tier).**

*"What should I charge?"* — the same rules-based recommendation the desktop
Pricing page shows, unchanged. Paginated.

| Param | Required | Notes |
|---|---|---|
| `categorySlug` | no | Scopes **matching only** — read the warning below |
| `cursor` | no | From the previous `nextCursor` |

```bash
curl https://<host>/api/mobile/pricing -H "Authorization: Bearer $TOKEN"
```

```jsonc
{
  "currency": "PKR",
  "matchScopeCategorySlug": "beauty-and-personal-care",  // NOT a filter on the rows
  "totalCount": 64,                                      // across all pages
  "recommendations": [
    {
      "productId": "8c4d…",
      "productTitle": "Samsung Galaxy A15",
      "categorySlug": "electronics",        // THIS row's own category
      "categoryName": "Electronics",        // null if unnamed
      "currentPrice": 65000,
      "recommendedPrice": 71875,
      "direction": "increase",              // increase | decrease | hold
      "competitorLow": 69000,
      "competitorHigh": 74500,
      "marginConstrained": false,
      "matchConfidence": 0.81,              // null when no confident match
      "duplicateEntries": 1,
      "rationale": "Matched listings sit between PKR 69,000 and PKR 74,500."
    }
  ],
  "nextCursor": "b2Zmc2V0OjIw"              // null when done
}
```

**What to know**

- ⚠️ **The result set is the seller's WHOLE catalogue, not the selected
  category.** `categorySlug` scopes only the title-matching pass; every
  product is still priced against **its own** category's band. A Home &
  Kitchen row appearing under a Beauty pill is **correct**. **Do not filter
  client-side by the selected category** — that hides valid advice. This was
  a real bug fix: a seller with beds and phones had both judged against the
  beauty P75.
- Read `matchScopeCategorySlug` as "what the matching ran against". Read each
  row's own `categorySlug` to label the row.
- **Render `rationale` word for word.** It's written for the seller and names
  the actual figure the rule used. Don't paraphrase it into "price too low".
- **`matchConfidence` is not calibrated.** It's title similarity against
  hand-picked cut points. `0.81` is not "81% likely to be the same product" —
  don't present it as a probability. `null` means the band came from category
  percentiles rather than a matched listing, which is weaker evidence.
- **`marginConstrained: true` is a finding, not an error.** The margin floor
  sits above the whole competitor band: the seller can't compete on price
  here without a thin margin. Worth surfacing.
- **`duplicateEntries > 1` is a data problem in their catalogue.** The rows
  are merged here (dearest cost wins, so the floor clears the stock actually
  held), but it's worth telling them.
- **There is no cost price in this response, deliberately.** The margin floor
  is already baked into `recommendedPrice` and named in the `rationale`. Cost
  price is the one number a seller wouldn't want readable over someone's
  shoulder on a bus.
- `nextCursor` is an offset behind the standard opaque encoding — see
  [Pagination](#pagination--cursors-not-page-numbers). A bad cursor is a
  `400`, not a silent restart at page one.

---

# 14. `GET /api/mobile/products/{id}/insight`

**Needs `watchlists` (paid tier).**

One of the seller's own products placed against the market. **This is the
screen behind a tap in the product list, and the screen the price edit
launches from** — read the comparison, change the number, done.

```bash
curl https://<host>/api/mobile/products/8c4d…/insight \
  -H "Authorization: Bearer $TOKEN"
```

```jsonc
{
  "product": {
    "id": "8c4d…",
    "title": "Dior Eau Sauvage 100ml",
    "price": 20000,               // as stored, in ITS OWN currency — matches /products
    "currency": "PKR",
    "imageUrl": null,
    "categorySlug": "beauty-and-personal-care",   // null if unmapped
    "categoryName": "Beauty & Personal Care"
  },

  "vsMarket": {                   // null — three causes, see below
    "currency": "PKR",            // the REPORTING currency, may differ from product.currency
    "comparedPrice": 20000,       // converted, and pack-normalised
    "categoryMedian": 21900,
    "pctVsMedian": -0.0868,       // signed fraction: 8.7% below
    "band": "below",              // far-above | above | at-market | below | far-below
    "bandLabel": "5–25% below",   // ready to render
    "perUnit": false,             // true → comparedPrice was divided by a pack size
    "sampleSize": 4210            // listings behind the median
  },

  "closestCompetitors": [         // max 5, best match first. [] if none
    {
      "title": "Dior Eau Sauvage 100ml EDT",
      "platformName": "Al-Fatah",
      "price": 21900,
      "currency": "PKR",
      "imageUrl": null,
      "url": "https://…",
      "matchConfidence": 0.81,    // NOT calibrated
      "priceDeltaPct": -0.0868    // signed: seller is 8.7% cheaper than this listing
    }
  ],

  "priceHistory": [               // last 30 days, ascending, seller's own price only
    { "date": "2026-09-01", "price": 21000 },
    { "date": "2026-09-12", "price": 20000 }
  ]
}
```

**What to know**

- ⚠️ **`product.currency` and `vsMarket.currency` can differ.** The product
  price is as stored; the market comparison is computed in the seller's
  reporting currency. Two currency fields because they are genuinely two
  numbers — don't collapse them.
- **`vsMarket: null` has three causes, and you handle all three the same:**
  the product has no category mapped, it has no price set, or the category
  has nothing scraped. Say "we couldn't place this product" — and when
  `categorySlug` is null, "map this product to a category". Never render a
  blank comparison.
- **`priceDeltaPct` is precomputed — use it.** It's the whole question this
  screen answers, and leaving the arithmetic to the client is how two clients
  end up rounding it differently.
- **`perUnit: true` means `comparedPrice` is a per-item figure** divided out
  of a pack — "Lip Tint Pack of 3" at 3,000 compares as 1,000. The median is
  *not* normalised the same way, so the comparison is approximate. Say so.
- **"Closest we found", never "the same product".** `matchConfidence` is
  uncalibrated title similarity. Label the section as an approximation.
- **`priceHistory` is the seller's own price only** — no market band. It
  backs a sparkline, not a chart. Points with no price are dropped, so gaps
  are real. An empty array means they've never changed the price; render a
  flat line or nothing, not an error.
- Desktop shows 15 listings across 10 columns here (ratings, sold counts,
  review snippets, match strength). Mobile gets 5 listings and 4 fields. Same
  source function, narrower projection — a row you have to scroll sideways is
  a row nobody reads.
- `404` if the id doesn't exist **or** isn't this seller's. You can't tell
  which, on purpose.

---

# 15. `GET /api/mobile/search`

**Needs `competitor_intel` (paid tier).**

The magnifying glass in the top bar: search **what competitors are selling**.

> ⚠️ **Not the same as `GET /products?q=`**, which searches the seller's
> **own** catalogue. Two searches over two different corpora. **The UI must
> make clear which one the seller is in** — a seller typing a product name
> and getting competitor listings when they expected their own stock is the
> single most confusing thing this API can do.

| Param | Required | Notes |
|---|---|---|
| `q` | no | Under 2 characters (after trimming) returns an empty `200` |
| `categorySlug` | no | Omit to search everything scraped |

```bash
curl -G https://<host>/api/mobile/search \
  -H "Authorization: Bearer $TOKEN" \
  --data-urlencode "q=dior"
```

```jsonc
{
  "query": "dior",                // trimmed, echoed back
  "results": [                    // max 20
    {
      "id": "m1…",
      "title": "Dior Eau Sauvage 100ml",
      "platformName": "Al-Fatah",
      "price": 21900,
      "currency": "PKR",          // PER ROW — as scraped, NOT converted
      "inStock": true,
      "imageUrl": null,
      "url": "https://…"
    }
  ],
  "nextCursor": null              // always null today
}
```

**What to know**

- **A short query is a normal `200`, not a `400`.** You'll call this on every
  keystroke; the first character is a state to pass through, not an error to
  render a failure card for. `results` is `[]` and `message` says so. Nothing
  reaches the database below the floor.
- ⚠️ **`currency` is per row and is NOT converted** to the seller's reporting
  currency. These are scraped prices in whatever the source listed. A
  top-level currency field would be a claim we can't make about a market
  carrying more than one. **Render the row's own currency.**
- **`nextCursor` is always `null` today** — the search caps at 20 with no
  second page. It's present rather than omitted so that when pagination
  lands, your existing "stop when null" loop keeps working untouched.
- **Omitting `categorySlug` is the right default** for "I'm holding a box at
  a supplier and don't know which of my markets it's in".
- **Nothing is scraped on demand.** Empty results mean we have no data, not
  "please wait". Don't spin and retry.
- **Debounce it.** ~300ms. There's no rate limit, but there's no reason to
  fire six queries for one word either.

---

# What you can build right now

**Everything in the mockup.** Every screen has its endpoints live:

| Screen | Endpoints | Complete? |
|---|---|---|
| **Home / Overview** | `GET /pulse`, `GET /kpis` | ✅ Alerts, counters, freshness, stat tiles, KPI tiles |
| **Alert feed** | `GET /alerts`, `POST /alerts/read` | ✅ |
| **Market tab** | `GET /market` | ✅ Price stats, forecast, position bars |
| **Competitors** | `GET /competitors`, `GET /competitors/moves` | ✅ Landscape + stock-outs + anomalies |
| **Pricing tab** | `GET /pricing` | ✅ |
| **Product list + price edit** | `GET /products`, `GET /products/{id}/insight`, `PATCH /products/{id}/price` | ✅ List → detail → edit |
| **Top-bar search** | `GET /search` | ✅ |
| **Category switcher** | `GET /categories` | ✅ |
| **"Should I stock this?"** | `GET /price-check` | ✅ |
| **Push** | `POST` / `DELETE /devices` | ✅ |

**Suggested build order:** auth + the envelope wrapper → `/pulse` (home) →
`/alerts` (the feed + badge) → `/products` + `/products/{id}/insight` + price
edit (the core loop) → `/categories` (the switcher, which every other screen
depends on) → `/market` → `/competitors` + `/competitors/moves` → `/pricing`
→ `/kpis` → `/devices` → `/search` → `/price-check`.

The first four lines get you a genuinely useful app. Everything after
`/categories` is additive and can ship in any order.

> **`price-check` and the price edit aren't in the mockup** — but they're the
> app's most differentiated capability. A seller at a supplier deciding
> whether to buy something is a thing a laptop cannot do. Worth giving a
> screen.

---

# What is deliberately not here

Not an oversight, and not coming: orders and customers CRUD, bulk import,
report generation, watchlist management, revenue forecasting, the full
9-column competitor scorecard, cost price anywhere, and market-definition
editing. Those stay on desktop — they're either multi-field forms that are
hostile on a phone, or data a phone shouldn't carry. Full reasoning in
[`MOBILE_API_HANDOFF.md`](MOBILE_API_HANDOFF.md).

---

# If something looks wrong

| Symptom | Most likely cause |
|---|---|
| `401` on every call | Token expired. Supabase access tokens are short-lived — refresh the session, don't cache the token. |
| `401` right after a successful sign-up | The Supabase user exists but has no seller record yet. Finish onboarding first. |
| Everything returns zeros / nulls | The seller has no category set (`domain: null` on `/pulse`), or nothing has been scraped for their category yet. |
| `400: Invalid cursor` | You modified or re-encoded `nextCursor`. Pass it back byte-for-byte. |
| `/pricing` returns products from other categories | **Working as intended.** It prices the whole catalogue; `categorySlug` scopes matching only. Don't filter them out. |
| A percentage renders 100× too big or too small | `diffPct` on `/kpis` and `pctChange` on `/competitors/moves` are percentages, not fractions. Those two only — everything else is a signed fraction. |
| `/market` never shows a forecast | Either the plan doesn't include it or there's too little history. Not distinguishable, by design — hide the card, don't prompt an upgrade. |
| Numbers differ from the web app | They shouldn't — every mobile route composes the same functions the desktop pages call. **Report it**, don't work around it. |

Field-by-field detail for anything above: [`MOBILE_API.md`](MOBILE_API.md).
