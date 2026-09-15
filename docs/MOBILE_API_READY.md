# Ryvl mobile API — endpoints you can call today

**Everything in this file is built, deployed and working.** Every request and
response below was read straight off the route handlers, not designed on
paper. You can start building against all of it now.

Seven more endpoints are designed but **not built yet** — they're listed at
the [bottom](#not-built-yet) so you don't accidentally code against them.
Their full specs are in [`MOBILE_API.md`](MOBILE_API.md).

---

## The 8 endpoints

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

> ⚠️ **You will never see a `403` today.** A demo flag unlocks every paid
> feature and billing isn't wired yet. **Handle it anyway.** When billing
> ships these gates go live with no backend change, and a client that has
> never handled `403` breaks everywhere at once.

---

## Pagination — cursors, not page numbers

Three endpoints paginate: `/alerts`, `/products`, and (later) `/pricing`.

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
  below.

---

# 1. `GET /api/mobile/pulse`

**The whole home screen in one request.** No params, no plan gate.

```bash
curl https://<host>/api/mobile/pulse -H "Authorization: Bearer $TOKEN"
```

```jsonc
{
  "seller": {
    "businessName": "Sana's Store",
    "planTier": "free",              // free | paid | premium
    "currency": "PKR"
  },

  "domain": {                        // null if no category picked yet
    "categorySlug": "beauty-and-personal-care",
    "categoryName": "Beauty & Personal Care"
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
  }
}
```

**What to know**

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

Who's in this market and how they price. This is the *static* picture.

```bash
curl https://<host>/api/mobile/competitors -H "Authorization: Bearer $TOKEN"
```

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
- ⚠️ **This endpoint always uses the seller's primary category today.** It
  ignores `?categorySlug`. If the seller switches categories in the top bar,
  this screen won't follow — that param is on the planned list.
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

# What you can build right now

| Screen | Endpoints | Complete? |
|---|---|---|
| **Home / Overview** | `GET /pulse` | ✅ Alert card, counters, freshness. Stat tiles need `/pulse` extended |
| **Alert feed** | `GET /alerts`, `POST /alerts/read` | ✅ Fully |
| **Competitors** | `GET /competitors` | ⚠️ The "who's in this market" list only. Stock-outs and price anomalies need `/competitors/moves` |
| **Product list + price edit** | `GET /products`, `PATCH /products/{id}/price` | ✅ Fully |
| **"Should I stock this?"** | `GET /price-check` | ✅ Fully |
| **Push** | `POST` / `DELETE /devices` | ✅ Fully |
| **Market tab** | — | ❌ Nothing live yet |
| **Pricing tab** | — | ❌ Nothing live yet |

**Suggested build order:** auth + the envelope wrapper → `/pulse` (home) →
`/alerts` (the feed + badge) → `/products` + price edit (the core action) →
`/devices` → `/price-check` → `/competitors`. That gets you a genuinely
useful app before any of the planned endpoints land.

> **`price-check` and the price edit aren't in the mockup yet** — but they're
> the app's most differentiated capability. A seller at a supplier deciding
> whether to buy something is a thing a laptop cannot do. Worth giving a
> screen.

---

# Not built yet

**Don't code against these — they'll 404.** Specs are in
[`MOBILE_API.md`](MOBILE_API.md) and [`openapi-mobile.yaml`](openapi-mobile.yaml)
so you can design screens around them, but they return nothing today.

| Method | Path | Backs |
|---|---|---|
| GET | `/api/mobile/kpis` | Revenue / orders / AOV / new-customer tiles |
| GET | `/api/mobile/market` | The whole Market tab — price stats, forecast, position bars |
| GET | `/api/mobile/categories` | The category switcher sheet |
| GET | `/api/mobile/competitors/moves` | Stock-outs + price anomalies |
| GET | `/api/mobile/pricing` | The Pricing tab |
| GET | `/api/mobile/products/{id}/insight` | Product detail vs. the market |
| GET | `/api/mobile/search` | The search icon in the top bar |

Also not coming, deliberately: orders and customers CRUD, bulk import, report
generation, watchlist management, revenue forecasting, the full 9-column
competitor scorecard, cost price, and market-definition editing. Those stay on
desktop. Full reasoning in
[`MOBILE_API_HANDOFF.md`](MOBILE_API_HANDOFF.md).

---

# If something looks wrong

| Symptom | Most likely cause |
|---|---|
| `401` on every call | Token expired. Supabase access tokens are short-lived — refresh the session, don't cache the token. |
| `401` right after a successful sign-up | The Supabase user exists but has no seller record yet. Finish onboarding first. |
| Everything returns zeros / nulls | The seller has no category set (`domain: null` on `/pulse`), or nothing has been scraped for their category yet. |
| `400: Invalid cursor` | You modified or re-encoded `nextCursor`. Pass it back byte-for-byte. |
| Numbers differ from the web app | They shouldn't — every mobile route composes the same functions the desktop pages call. **Report it**, don't work around it. |

Field-by-field detail for anything above: [`MOBILE_API.md`](MOBILE_API.md).
