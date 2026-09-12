# Seller-selected competitor tracking — scope

**Status: scoping only. Nothing here is built.** Written 2026-09-12.

Relates to `ROADMAP.md` D4 (retailer coverage) and C1 (competitor entity).
This is an alternative route to the same outcome as D4, not a replacement for
it.

---

## Why this, and why now

Today the model is *crawl whole categories and hope the seller's actual
rivals are inside the crawl*. That works in the two categories with real
coverage and produces an honest empty state everywhere else.

`ROADMAP.md` records the consequence:

> only **2 of 12** seller categories have any scraped rows at all … The other
> ten depended entirely on OLX, which is returning nothing.

OLX is now disabled outright (standing IP-level 429 block on GitHub's runner
range; hardened retries did not fix it). D4's answer is "add more retailers",
which is structurally correct but slow, and each new source adds anti-bot
exposure and another thing to keep compliant.

**This feature inverts the question.** Instead of guessing which rivals matter
by crawling everything, the seller names them. A seller who nominates five
competitors gets value in *any* category on day one, regardless of how broad
our crawl is. It converts a coverage problem into a targeting problem, and
targeting is much cheaper.

Secondary benefit, and not a small one: a seller's nominations are **the
strongest labelled signal we will ever get** about who competes with whom.
Product matching currently bands relevance on cut points that `memory.md`
admits are guesses (0.6 / 0.35, "uncalibrated"). Nominations are ground truth.

### Check this before building

The 2-of-12 figure predates the Daraz rollout, which was expected to "close
most of that gap." **Re-measure current per-category coverage first.** If
Daraz already covers eight categories, the urgency argument here weakens a
lot and D4 may be the better investment. One query against
`market_products` joined to `market_category_map`, grouped by category. Do
not build on the stale number — including the one quoted above.

---

## The constraint that shapes everything: compliance

`SCRAPING.md` is a real compliance posture, not boilerplate. It already
caught one live violation (`sapphireonline` requesting paths its own
robots.txt disallows five times over). Its rules:

> 1. Read `robots.txt` before adding a source, and honour it for `User-agent: *`
> 2. Public listing pages only
> 3. No personal data
> 4. Rate-limit and stay small
> 5. Identify honestly

**A naive "paste any URL" feature breaks rule 1 by construction.** The seller
becomes the one choosing targets, and they have no idea what a robots.txt
is. The first time someone pastes a URL from a site that disallows it, the
project is out of compliance and nobody notices — exactly the Sapphire
failure, but now automated and seller-triggered.

So the feature is deliberately tiered by compliance risk, and **tier 3 is
probably never built.**

---

## Three tiers

### Tier 1 — Nominate a competitor we already scrape *(build this)*

The seller picks a merchant from within a platform already in our crawl —
in practice a Daraz seller, since Daraz is the only true marketplace
(`market_competitors`, migration `022`) and carries merchant identity on
every listing.

- **Zero new compliance surface.** No new URLs, no new robots.txt, no new
  anti-bot exposure. We are already fetching these pages.
- **Mostly a UI and prioritisation feature**, not a scraping one.
- Delivers: "these five merchants are my rivals — show me their assortment,
  their price index against mine, when they undercut me, and alert me when
  they move."

This is the cheapest meaningful version and should ship alone first.

### Tier 2 — Nominate a store we can auto-detect *(build second, gated)*

The seller pastes a storefront URL. We detect whether it is Shopify or
WooCommerce and, if so, instantiate the **existing** factory.

This is the strongest reuse case in the codebase:
`scraper/src/sources/shopify-source.ts` and `woocommerce-source.ts` are
already generic factories driven entirely by `{ platformSlug, baseUrl,
collections }`. Eight sources are already built from them. A seller-nominated
Shopify store is the same shape as `bagallery` — the only difference is
where the config row comes from.

**Non-negotiable gates before any fetch:**
1. Fetch and parse the target's `robots.txt`; confirm `/collections/*/products.json`
   (or the Woo Store API path) is allowed for `User-agent: *`. Refuse
   otherwise, and tell the seller plainly that the site asked not to be
   crawled.
2. Confirm the detected endpoint returns real product JSON.
3. Cap it: a per-seller limit on nominated stores, and the same page caps and
   pacing every other source runs under.
4. Record who nominated it and when — an audit trail, because the seller
   chose the target.

Anything failing (1) is rejected permanently, not queued for review.

### Tier 3 — Arbitrary URL on an unknown platform *(do not build)*

Bespoke parsers per seller-pasted site. Unbounded maintenance, unbounded
compliance surface, and every one is a new anti-bot relationship. If a
seller needs this, it is a signal to evaluate that retailer as a *first-class
source* under D4 — a product decision, not a self-serve one.

---

## What already exists (reuse, do not rebuild)

| Need | Already there |
|---|---|
| Competitor entity, tenure, scorecards | `market_competitors` + `market_competitor_scorecards()` (migration `022`) |
| Per-seller tracking of specific listings | `seller_watchlists` (migration `014`) — closest existing pattern; read `watchlists.ts` before designing the new table |
| Shopify / WooCommerce ingestion | `createShopifySource`, `createWooCommerceSource` — generic factories, 8 sources built on them |
| Rate limiting, backoff, circuit breaker | `scraper/src/sources/polite.ts` |
| Match a competitor listing to a seller product | `product-matching.ts` (Jaccard gate + IDF cosine ranking) |
| Price history and change detection | `market_price_history`, `seller_product_price_history` |
| Alerting on a tracked thing | the price-alert cron (note: no UI today) |
| Per-seller scoping and ownership checks | `resolveSelectedDomain`, `requireSeller()` |

The honest summary: **tier 1 is mostly wiring existing pieces together.**

---

## Data model sketch

One new table for tier 1:

```
seller_tracked_competitors
  id, seller_id, competitor_id -> market_competitors(id),
  category_id,            -- which domain this nomination belongs to
  nominated_at, note
  unique (seller_id, competitor_id, category_id)
```

Tier 2 adds a second, deliberately separate because its lifecycle and risk
are different (it is a scrape target, not a reference to an existing row):

```
seller_nominated_sources
  id, seller_id, base_url, detected_platform ('shopify'|'woocommerce'),
  robots_checked_at, robots_allowed bool, status, platform_id -> market_platforms(id),
  nominated_at, last_scraped_at, last_error
```

Both are seller-scoped: RLS policy **and** an explicit seller filter in app
code, per the standing convention in `CLAUDE.md` ("one dropped policy
shouldn't mean cross-tenant access").

---

## Build order

**Phase 1 — tier 1, read-only.** Table, "track this competitor" action on the
existing Competitors page, a filter to show only tracked ones. No new
scraping. Ships in isolation and is fully demoable.

**Phase 2 — tier 1 alerting.** Reuse the price-alert cron path so a tracked
competitor's price or stock change reaches the seller. Note the existing
alerts have no UI — that gap surfaces here.

**Phase 3 — tier 2, ingestion.** robots.txt gate first, in its own module,
with its own tests, *before* any fetching code. The gate is the feature; the
scraping is the easy part.

**Phase 4 — feedback loop.** Record accept/reject on suggested matches for
tracked competitors. This is what calibrates the uncalibrated bands.

Phases 1 and 2 are worth doing even if 3 never happens.

---

## Explicitly not in scope

- Automatic repricing off a tracked competitor (`ROADMAP.md` later-stage;
  needs approval controls, limits, rollback).
- Scraping anything behind a login, cart, or paywall — rule 2, non-negotiable.
- Collecting individual persons' identities. Merchant/shop names are business
  identities and in scope; classifieds posters are not (rule 3).
- Letting a nomination bypass rate limits because the seller wants it fresher.
  Targeted refresh frequency is a separate, later decision.

---

## Open questions

1. **Does Daraz coverage make tier 1 useful in more than 2 categories?**
   Decides whether this or D4 goes first. Measure before building.
2. **Entitlement tier?** Competitor intel is `paid` today. Tracked
   competitors is arguably the most valuable paid feature — but demo mode
   unlocks everything, so this is theoretical until billing exists.
3. **Nomination limit per tier?** Needs a number, not a principle.
4. **What happens when a tracked competitor leaves the market?** Tenure is
   already modelled (`first_seen_at`); the disappearance case is not.
