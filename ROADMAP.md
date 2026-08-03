# Ryvl / Market Intel — Roadmap

**Status as of 2026-08-03.** This document is the single source of truth for
what we build next.

**It supersedes** `new_implementation_doc.md` and `implementation_status.txt`,
both of which describe Phases 1–5 as future work that has since largely been
built, and both of which assume a seller-ops-first product we have now
decided against. Keep `overview.md` and `research.md` as historical product
context only. Do not plan against the superseded docs.

---

## The decision that drives everything below

**We are selling market intelligence, not store management.**

The scraped competitive market is the product. The seller's own CRM data
(products, orders, customers, cost prices) exists to *personalise* that
analysis — it is an input layer, not a destination. A seller should be able
to get value on day one, with zero other customers on the platform, from
scraped data alone.

Three consequences, decided 2026-08-03:

1. **Seller-ops build-out is deprioritised.** The Orders page, marketplace
   write-back connectors, and deeper CRM features are no longer near-term
   priorities. Bulk import stays, because it feeds the analysis.
2. **Peer benchmarks stop being a headline feature.** They cannot render
   until 3+ opted-in sellers share a category (`MIN_SAMPLE_SIZE` in
   `benchmarks-job.ts`), so they become a network feature that lights up as
   we grow — not something we charge for on day one.
3. **Daraz gets scraped.** It is where our target sellers actually compete.
   The ToS/legal review runs alongside it, not after.

---

## Honest assessment of where we stand

Measured against the seven-block market analysis framework:

| # | Block | State | Notes |
|---|---|---|---|
| 1 | Market Definition | **Absent** | Implicit in a hardcoded regex; invisible to the seller |
| 2 | Market Sizing | **Zero** | We compute price distributions, not market size |
| 3 | Customer Segmentation | **Wrong axis** | RFM on own customers ≠ market segmentation |
| 4 | Competitive Landscape | **~25%** | Platform aggregates only; no competitor entity exists |
| 5 | Decision Journey | **Zero** | No module or table touches this |
| 6 | Trends & Risks | **~35%** | Price-only; no assortment, seasonality, or risk register |
| 7 | Strategic Implications | **~30%** | Exists only inside the exported PDF, not in the product |

What is genuinely strong: the scraper (`scraper/`) — 7 sources, tiered by
anti-bot difficulty, exact 2-day cadence, per-source telemetry, staleness
tracking, price history. That is real infrastructure and nothing below
proposes changing its architecture.

### The four gaps that matter

1. **The market is defined too coarsely to be defensible.**
   `mobiles-and-electronics` lumps a phone-case seller in with a laptop
   retailer, then hands both the same "category median." Every downstream
   number — percentiles, price index, recommendations, the report — inherits
   this. It is not a missing feature; it silently corrupts existing output.

2. **We have no concept of a competitor.** `market_platforms` is a venue,
   not a rival. There is no competitor entity, share, assortment overlap, or
   positioning. The thing sellers actually want — *"competitor X carries 40%
   of my SKUs and undercuts me on 60%"* — is not expressible in the current
   schema. Highest-value missing capability.

3. **We scrape supply and speak about demand.** Listings are not sales. We
   cannot honestly produce a TAM from scraped listings. We *can* produce
   tracked-supply share, price-band supply segmentation, and OLX velocity as
   a labelled demand proxy. Anything stronger fails the scrutiny test.

4. **The "so what" is buried in a download.** Block 7 is the point of the
   framework, and ours is one Groq call at export time.

---

## Phase A — Foundation (blocking)

Nothing below Phase A ships credibly until these are done.

- **A1. Real authentication.** ✅ **Done 2026-08-03.** This turned out to be a
  deletion, not a build: Supabase Auth was already fully wired (signup,
  sign-in, password reset, the `013` signup trigger, RLS on `auth.uid()`), and
  `BYPASS_AUTH` was a scaffold left over from a planned Clerk migration that
  never happened. Both flags are now gone from `middleware.ts`,
  `lib/supabase/server.ts`, `seller.ts` and `entitlements.ts`. Moving to Clerk
  later is a separate migration and is no longer blocking anything.
- **A2. Fix the Critical + High findings in `leaks.md`.** Start with the
  unauthenticated `/api/referrals/record` free→paid escalation, then
  server-side password policy and the bypass-flag hardening.
- **A3. Replace regex category matching with a real market-definition
  model.** A DB-owned mapping (seller category ↔ scraped taxonomy) with
  price band, brand set, and geography as explicit dimensions. This is the
  prerequisite for Phase B1 and the fix for gap #1.
- **A4. Move aggregation into SQL.** `getMatchedProductIds`,
  `getCategoryPricing`, and the `market-insights` functions currently pull
  whole tables and filter in JS. Materialised views or indexed joins before
  price history accumulates further.
- **A5. CI + lockfile.** ✅ **Done 2026-08-03.** `.github/workflows/ci.yml`
  gates typecheck, lint and a real `next build` for the app, typecheck for the
  scraper, and an advisory `npm audit` on both. The app's `package-lock.json`
  was being ignored by a Horizon UI template default in `.gitignore` — that
  line is removed, **but the lockfile still needs to be committed** for `npm
  ci` in CI to work.

## Phase B — Rebuild the plan tiers around what works on day one

The current map in `entitlements.ts` is backwards under the new positioning:
it gates day-one-working features at premium and the network-dependent
feature at paid.

| Feature | Today | Should be |
|---|---|---|
| `product_matching` | premium | **paid** — core competitor intel |
| `pricing_recommendations` | premium | **paid** — core competitor intel |
| `watchlists` | paid | paid (unchanged) |
| `peer_benchmarks` | paid | **premium**, labelled "as the network grows" |
| `forecasting` | premium | premium (unchanged) |
| `anomaly_detection` | premium | premium (unchanged) |
| `multi_domain` | premium | premium (unchanged) |

Target shape: **free** = own-store analytics + market definition + a teaser
of category pricing. **paid** = the full scraped competitor intelligence
loop. **premium** = forecasting, anomalies, multi-domain, exports, and peer
benchmarks when available.

Peer benchmarks additionally need an honest empty state that explains the
3-seller threshold rather than rendering blank.

## Phase C — Close the framework gaps

Ordered by value, not by block number.

- **C1. Competitor entity model (Block 4).** Extract seller identity from
  listings; build per-competitor scorecards — assortment breadth, SKU
  overlap with the seller, price win/loss rate, repricing aggressiveness,
  stock reliability. The single highest-value item on this roadmap.
- **C2. Market Definition surface (Block 1).** Seller-editable scope:
  offerings in/out, price band, geography, brands. Echo it back on every
  analysis page — *"N listings across M platforms match your definition."*
- **C3. Strategic implications in-product (Block 7).** A standing Actions
  surface where each item traces back to the finding that produced it. The
  rule-based rationales in `pricing-recommendation.ts` are the pattern to
  copy — transparent and defensible, unlike an ungrounded LLM summary.
- **C4. Trends, seasonality and risk (Block 6).** Assortment/new-SKU trends;
  seasonality (Ramadan, Eid, 11.11, Black Friday — large effects in PK);
  and a quantified risk register. FX and import-duty exposure on electronics
  is computable today from the existing `fx_rates` table.
- **C5. Moment-of-truth scoring (Block 5).** Scrape ratings, review counts,
  delivery promise and badges; score how a seller's listing looks against
  rivals on the same results page. The search-results page *is* the moment
  of truth in this market.
- **C6. Honest sizing (Block 2).** Tracked-supply share, listing counts by
  platform and price band, with explicit methodology and confidence bounds.
  Never a fabricated TAM.
- **C7. Price-band supply segmentation (Block 3).** Budget/mid/premium bands
  with listing count, platform mix, crowding, and OLX velocity per band.

## Phase D — Data coverage

- **D1. Daraz.** ✅ **Done 2026-08-03** (`scraper/src/sources/daraz.ts`,
  migration `019`). No CloakBrowser or proxy was needed after all: the
  category pages render client-side, but `?ajax=true` returns the page's JSON
  model over plain fetch. It also turned out to carry **seller identity**
  (100% coverage — 58 distinct sellers in `laptops` alone) and a
  platform-reported **sold count**, so it hands C1 its competitor entity and
  gap #3 its demand proxy. Requires migration 019 to be applied.
- **D2. Enrich the existing 7.** Ratings, review counts, delivery terms,
  seller identity — unlocks C1 and C5 without new anti-bot exposure. Note the
  single-retailer sources cannot supply seller identity at all: on those, the
  platform *is* the seller. Only Daraz and any future true marketplace can.
- **D3. ToS/legal review.** ✅ **Done 2026-08-03** — see `SCRAPING.md`. It
  found one live non-compliance (`sapphireonline` calls a Demandware endpoint
  its own robots.txt disallows) with a verified compliant alternative, and it
  is what constrained Daraz to category paths only.
- **D4. Retailer coverage** for the 10 of 12 categories currently served by
  OLX alone. **Urgency raised 2026-08-03:** a live read of the database showed
  `market_classified_listings` is *empty* and `scraper_runs` recorded OLX at
  `product_count: 0, error: null` on all three logged runs. Since OLX is the
  only source covering those 10 categories, most of the product has been
  running on no market data at all. The parser is not the problem — every
  selector in `olx.ts` still matches a live fetch from a residential
  connection (33 cards, 24 parsed). The failure was invisible because
  `scrapeOlx` caught every per-category error and returned `[]`, which the
  pipeline could not distinguish from an empty market. Both holes are now
  closed: a total category wipeout throws, and the pipeline records any
  zero-row source as an error in `scraper_runs`. The remaining unknown is the
  root cause on the runner — the next scheduled run's `scraper_runs.error`
  will name it. Until then this source is presumed dead in CI, so D4's real
  retailer coverage is the durable fix, not a second single point of failure.

## Phase E — Restructure the deliverable

The report *is* the product. Restructure the PDF/PPTX around the seven
blocks so it reads as a consulting deliverable, and make the dashboard the
live version of the same structure. Today the report is a grab-bag of seller
stats plus two competitor tables; the framework gives it a spine.

## Phase F — UI polish

Deliberately last. Deferred until the analysis underneath is correct.

---

## Sequencing

```
A (all)  →  B  →  C1 + C2  ─┐
                            ├→  C3, C4  →  C5, C6, C7  →  E  →  F
D1 + D3 (parallel from start)┘
D2 feeds C1 and C5
```

Phase A is strictly blocking. D1/D3 can start immediately in parallel since
they are scraper-side and share no code with the app work.

**Progress, 2026-08-03.** A1, A2, A5, B, D1 and D3 are done. Phase A's
remaining blockers are **A3** (market-definition model) and **A4** (push
aggregation into SQL). A3 is also the prerequisite for C2, so those two are
now the natural next pair: A3 is the model, C2 is the surface for it.

UI polish is no longer deferred to Phase F wholesale (decided with the user,
2026-08-03) — each item from here ships with its own UI rather than being
retrofitted later. Phase F remains for the cross-cutting pass.

## Open items

- Billing provider — no checkout exists; `plan_tier` is set by hand or by
  the referral reward. Needed before Phase B tiers mean anything commercially.
- Fate of `market_accounts` — the dormant JobLo-era buyer-side account type.
  Under the market-intelligence-first decision this looks like a drop, but it
  has not been formally killed.
- Renaming `market_analyst` / `market_accounts`, which predate the
  seller-focused positioning (flagged in `README.md`).
