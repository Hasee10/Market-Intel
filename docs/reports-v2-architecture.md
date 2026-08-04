# Ryvl report generation v2 — architecture proposal

Status: **proposal only, not implemented.** Written 2026-08-04 per explicit
instruction not to begin coding until this is reviewed and approved.

Reference file: [`docs/report-reference/tt-report (8).pptx`](report-reference/tt-report%20%288%29.pptx)
(copied in from the user-supplied path). **Important finding**: this file is
not an external example — it is the literal demo output of the report
generator that already exists in this codebase
(`horizon-ui-chakra-nextjs-main/src/lib/reports/generate-pptx.ts` against
`assets/ryvl-report-template.pptx`), generated for a seller named "tt". Its
bugs are real, currently-shipping bugs, not reference-file artifacts — see
§1 and the inline callouts below.

---

## 1. Current dashboard and backend data available for reports

### Existing report code (already in the repo, functional but limited)

| File | What it does today |
|---|---|
| `lib/reports/collect-report-data.ts` | `collectReportData(seller)` — fans out `Promise.all` across `seller_orders` (30d + prior-30d), `seller_products`, `getDomainBenchmarks`, `getCategoryPricing`, `getLatestChurnSnapshot`/`getAtRiskCustomers`, `getLatestFxRates`, plus a bespoke `getCompetitorTracking()` that unions `market_products`+`market_classified_listings` and derives ad-hoc "Demand Rising"/"Supply Void" labels from raw price-delta thresholds. Ends by calling the AI insight generator. Returns one flat typed `ReportData` object — the closest thing to a schema that exists today. |
| `lib/reports/generate-pptx.ts` | Uses `pptx-automizer` to clone `assets/ryvl-report-template.pptx` (an **11-slide Google-Slides export**) and inject data into 5 of the 11 slides via shape-name lookup (`Google Shape;NNN;pXX`). Two native OOXML tables get real data (slides 7, 9). The other 6 slides (dividers, methodology, percentile chart, price-trend chart, inventory bullets, roadmap) are **static template content, never touched by data** — see the flattened-image finding below. |
| `lib/reports/generate-pdf.ts` | pdfkit, hand-drawn vector bar charts (no chart primitives in pdfkit). Fully implemented but **disconnected from the UI** — a code comment says PDF is "paused ... only PPTX is offered." Its section set doesn't match the PPTX's 1:1. |
| `lib/reports/design-tokens.ts` | One color palette + formatters, used only by the PDF path. The PPTX path has its own separate hardcoded palette. Two systems, not one. |
| `lib/ai/generate-report-insights.ts` | Groq (`llama-3.1-8b-instant`), narrates pre-computed numbers into `summary`/3×`highlights`/3×`recommendedActions`. Never given raw DB access, never asked to invent numbers — reasonably disciplined — but **nothing validates that its prose doesn't misstate a number already in `ReportData`** before that prose lands on a slide verbatim. |
| `api/reports/generate/route.ts` | `GET ?format=pdf\|pptx`. Auth-only (no plan-tier gate). No date-range or report-type param — 30-day lookback is hardcoded. Streams the buffer straight back; **nothing is ever persisted**. |
| `components/marketintel/DownloadReportButton.tsx` | One button, no options, on `dashboard/overview` only. No reports nav entry exists anywhere in `routes.tsx`. |

### What inspecting the actual reference file confirmed (ground truth, not guesses)

- **Slides 5 and 6 are flattened images**, not native charts: slide 5 has a
  12.17"×4.91" PICTURE exactly where "Category Positioning Percentiles"
  should render as data; slide 6 has a 12.17"×3.93" PICTURE where the price
  trend line should be. **Zero native chart objects exist anywhere in the
  current template** — this directly violates the "native charts where
  supported, never screenshot slides" requirement, today, in production.
- **Slide 6 has hardcoded numbers baked into the template itself**:
  `$24.90` and `$25.40 – $26.20` are literal text in the source file, not
  placeholders — this slide has never been wired to real data at all.
- **Slide 3 ("Executive Snapshot") reproduces exactly the bugs the brief
  warns against**: `PRICE INDEX SCORE 2757.7 / +2657.7% above median` is a
  live example of an unguarded growth calculation blowing up (dividing by a
  near-zero baseline). This is not hypothetical — it's what ships today.
- **Slide 10 ("Win-Back Segment") shows `Identify 0 accounts inactive over
  the last 30 days`** — a live example of the exact "0 accounts" empty-state
  the brief explicitly says never to show.
- **Slides 2, 4, 5, 6, 8, 11 (6 of 11 slides) are never touched by data at
  all** — bullet text, phase names, "140+ active marketplace sellers" —
  all static template prose, not seller-specific.
- Bullet glyphs render as `�` — a font/encoding mismatch in the source
  template (Wingdings-style bullet character with no matching font
  embedded).
- `pptx-automizer` **does** support modifying native chart objects
  (`ModifyChartHelper`, confirmed present in the installed package) — the
  reason slides 5/6 are images isn't a library limitation, it's that the
  Google Slides export never contained real chart objects to modify. A
  rebuilt template authored with real charts would let the existing library
  do this properly.

### Database data actually available (full inventory in the DB audit — summarized)

- **Seller/tenant**: `sellers` (plan_tier, reporting_currency), `seller_products`, `seller_orders`, `seller_customers`, `seller_churn_snapshots`, `seller_market_definitions`, `seller_watchlists`/`items`, `seller_price_alerts`, `seller_categories`.
- **Market/competitor**: `market_products`, `market_price_history`, `market_platforms`, `market_category_map`, `market_competitors`, `market_classified_listings` (OLX, source now removed), `domain_benchmarks`.
- **SQL aggregate functions already built and report-ready**: `market_scope_price_stats`, `market_scope_price_trend`, `market_competitor_scorecards`, `top_market_brands`, `market_convert_currency` — all `security invoker`, all designed for exactly this kind of query. A report generator should call these, not re-aggregate in JS.
- **Currency**: `fx_rates` table + `market_convert_currency()` SQL function + `convertCurrency()`/`getLatestFxRates()` JS mirror. `sellers.reporting_currency` is the seller's configured currency. This part of the system is already solid.
- **Entitlements**: `sellers.plan_tier` (`free`/`paid`/`premium`), checked via `hasFeature()`. The report route currently ignores this entirely.

### Correction after deeper verification: "portfolio contribution" data doesn't actually exist yet

An earlier pass of this document implied product-level revenue attribution
already exists. It doesn't — checked directly. **`seller_orders` has no
line-item table**: there is no `seller_order_items` or equivalent linking
an order to specific products, only an order-level `total_amount`. What
`collect-report-data.ts` currently calls `topProducts`/`portfolioMatrix`/
`revenueSharePct` (lines 214–231) is computed from `sell_price × stock_qty`
— **inventory value, not sales revenue** — then labeled "revenue" in the
UI/deck. The reference deck's "Top 2 product lines generate 96% of revenue"
claim is, today, actually an inventory-value share mislabeled as revenue.
This is a real gap, folded into §2 and §10 below, not just a labeling
nitpick: true SKU-level revenue attribution needs either a new
`seller_order_items` table (real schema/data-collection work, likely
requiring changes to however order data is ingested, not found in this
audit) or the report must honestly rename this section to inventory-value
contribution until that exists.

---

## 2. Missing data required

**Correction**: an earlier pass of this section claimed nothing structural
was missing on the input side. That's wrong for one item (below) — checked
directly against the schema, not assumed. Everything else genuinely is a
report-system-side gap, not a data gap.

0. **No order-line-item table — the one genuine structural data gap.**
   `seller_orders` has no `seller_order_items` or equivalent; orders are
   order-level totals only, with no link to which specific products were
   sold. True SKU-level revenue attribution (needed for an honest "SKU
   performance" and "product portfolio contribution" section) cannot be
   computed from what exists today. The current code approximates it with
   `sell_price × stock_qty` (inventory value) and calls it revenue share —
   see the correction note in §1. Two ways forward, need a decision: (a)
   add real order-line-item tracking — a genuine data-model/ingestion
   change, likely the largest single piece of net-new work in this whole
   proposal, or (b) ship the report honestly labeled as inventory-value
   contribution instead of revenue contribution until line items exist.
   Folded into §3's schema via an explicit `basis` field so the report
   itself can never silently claim revenue data it doesn't have.

What's missing beyond that is entirely on the **report system's own side**:

1. **No persistence.** No `report_snapshots` table. Every report is
   regenerated live and thrown away. There is no way to reproduce "the
   report a seller downloaded on date X," which the brief's flow requires
   (step 2: "creates a report snapshot").
2. **No approval/review workflow or role.** No `report_approvals`/`reviews`
   table, no status field, no reviewer concept anywhere in the schema or
   app. Notably, **the reference deck's own slide 4 describes this
   workflow in marketing prose** ("Researcher Insights Review — Internal
   analysts review model findings...Data Validation & Approval Gate") —
   the product has been *claiming* this happens without it existing.
3. **No "researcher" identity.** There is no internal-staff/admin role
   anywhere in this app — only `sellers` (tenant users). The brief's step 5
   ("Researcher reviews and edits the report") needs a new actor concept
   that doesn't exist today. This is flagged as an open question in §10,
   not assumed.
4. **No date-range or report-type parameterization.** Hardcoded 30-day
   lookback; no report "type" concept (quarterly vs. monthly vs.
   competitor-only) exists.
5. **No audit log / export history.** No record of who generated, viewed,
   or downloaded a report, in what format, when.
6. **No entitlement gating on the report route itself.**
7. **RFM/at-risk-customer scoring is computed in JS**
   (`getAtRiskCustomers()`), the one place in the codebase that violates
   the "aggregation lives in SQL" convention established since migration
   021. Needs a decision: port to SQL for consistency, or explicitly
   document it as an intentional exception (rank-based quintile scoring is
   awkward in plain SQL without window functions across the whole table,
   which is itself a performance question worth deciding deliberately).
8. **No richer stockout-risk model.** Today "stockout risk" is just
   `stock_qty` vs. a static threshold constant. The brief asks for
   "inventory and stockout risks," which implies velocity/lead-time framing
   — that data (sell-through rate) is derivable from `seller_orders` +
   `seller_products` but isn't computed anywhere yet.
9. **No formal "market signals" concept.** The existing
   `getCompetitorTracking()` heuristics (±5%/±1%/±0.5% thresholds labeled
   "Demand Rising"/"Supply Void") are a reasonable starting point but are
   undocumented ad hoc rules embedded in a data-fetching function, not a
   named, versioned rule set — the brief's "insight rules generate draft
   findings" (step 4) implies these should be an explicit, testable,
   documented module.
10. **No stored methodology/source metadata.** Nothing today records which
    platforms, category scope, or date range actually backed a given
    report — needed for the "Methodology, privacy and data sources"
    section and for the "distinguish real/public/anonymized data" rule.
11. **No PDF↔PPTX parity decision.** The two renderers already diverge in
    section coverage and chart approach; the brief requires them to come
    from the same structured data, which they technically could today, but
    "same data" and "consistent visual output" are different guarantees —
    see §6 for the actual tradeoff.
12. **No storage/export-history mechanism.** Reports stream directly to the
    browser and vanish; nothing is written to Supabase Storage.

---

## 3. Proposed report JSON schema

Single discriminated, versioned root type. Every numeric/comparative field
carries its own source tag and null-safety — no field is ever silently
`0`, `NaN`, or a divide-by-near-zero artifact; absent data means the field
is `null` and the consuming section is hidden (see §5).

```ts
type DataSource = 'seller_private' | 'public_marketplace' | 'anonymized_cohort' | 'system_computed';

interface Sourced<T> {
  value: T;
  source: DataSource;
  asOf: string; // ISO date the underlying figure was captured/computed
}

interface GrowthMetric {
  current: number;
  previous: number | null;      // null if no prior-period baseline exists
  changePct: number | null;     // null if previous is null OR previous is ~0
                                 // (never compute a % against a near-zero base —
                                 // this is the exact bug seen in the reference deck)
  changeAbs: number | null;
  direction: 'up' | 'down' | 'flat' | 'unknown';
}

interface ReportSnapshot {
  schemaVersion: 1;

  metadata: {
    reportId: string;           // uuid, == report_snapshots.id
    reportType: 'standard' | 'competitor_focus' | 'quarterly' | 'custom';
    generatedAt: string;
    period: { start: string; end: string; label: string }; // e.g. "Jul 6 – Aug 4, 2026"
    comparisonPeriod: { start: string; end: string } | null;
    status: 'draft' | 'in_review' | 'approved' | 'rejected' | 'archived';
    mode: 'internal' | 'client_safe'; // controls which fields render (see §4/PRIVACY)
    version: number;            // increments per regeneration for the same period
  };

  workspace: {
    sellerId: string;
    businessName: string;
    reportingCurrency: string;
    categories: { slug: string; name: string }[];
    planTier: 'free' | 'paid' | 'premium';
  };

  revenue: {
    revenue: GrowthMetric;
    orders: GrowthMetric;
    avgOrderValue: GrowthMetric;
    weeklySeries: { label: string; value: number }[] | null; // null, not [], if <2 data points
  } | null; // whole section omitted if seller has zero orders in period

  productPerformance: {
    activeProductCount: number;
    contributionBasis: 'revenue' | 'inventory_value'; // 'revenue' only once
      // seller_order_items (or equivalent) exists — see §2 item 0. Until then
      // this is always 'inventory_value', and every render layer must show
      // that basis label next to the figures, never present it as revenue.
    topProducts: { title: string; sku: string; contributionShare: number | null }[];
    categoryBreakdown: { category: string; value: number; share: number }[];
  } | null;

  marketplacePerformance: {
    scope: { categorySlugs: string[]; platformIds: string[] }; // what defined "the market" for this report
    priceIndex: Sourced<number> | null; // seller median vs market median, guarded against near-zero denominators
    perPlatform: { platformName: string; skuOverlap: number; medianPriceGap: number | null }[];
  } | null;

  competitorBenchmarks: {
    scorecards: {
      competitorName: string;
      platformName: string;
      skuCount: number;
      medianPrice: Sourced<number>;
      inStockRate: number;
      repricingRate: number | null; // explicit floor caveat carried into methodology, per mind.md's C1 notes
    }[];
    marketDefinitionSummary: string; // human-readable "what counts as your market"
  } | null; // omitted entirely if source platform has no named-seller data (only Daraz names sellers today)

  pricePositioning: {
    yourMedianPrice: Sourced<number>;
    marketMedian: Sourced<number>;
    percentile: number | null;
    recommendedBand: { low: number; high: number } | null; // only if enough sample size to justify a band
    trend: { date: string; medianPrice: number }[] | null;
  } | null;

  inventoryRisk: {
    lowStockSkuCount: number;
    stockoutRiskSkus: { title: string; sku: string; daysOfCoverEstimate: number | null }[];
    supplyVoidOpportunities: { competitorName: string; platformName: string; category: string }[] | null;
  } | null; // omitted if lowStockSkuCount === 0 AND no supply-void signal — never render "0 SKUs" as a finding

  customerHealth: {
    retentionRate: GrowthMetric | null;
    repeatPurchaseRate: number | null;
    avgClv: Sourced<number> | null;
    atRiskCount: number | null;
    atRiskCohorts: { label: string; count: number; recoveryTargetPct: number | null }[]; // never fabricate a numeric target if count is 0
  } | null; // entire section omitted below MIN_CUSTOMERS_FOR_RFM threshold, not shown with 0s

  marketSignals: {
    signalId: string;
    kind: 'demand_rising' | 'supply_void' | 'price_war' | 'new_entrant';
    ruleVersion: string;         // which named/versioned rule fired (see §4)
    description: string;         // template-filled, not free-generated
    evidence: Sourced<unknown>;  // the underlying number(s) that triggered it, for audit
  }[];

  recommendations: {
    id: string;
    priority: 'high' | 'medium' | 'low';
    text: string;
    basedOn: string[];           // ids of marketSignals / metrics this cites — traceability
    aiGenerated: boolean;        // true only for narration; numeric claims must trace to basedOn
  }[];

  strategicRoadmap: { phase: number; title: string; description: string }[] | null;

  methodology: {
    dataSources: { name: string; type: DataSource; description: string }[];
    scrapeCoverage: { platformName: string; lastRunAt: string }[];
    limitations: string[];       // e.g. "repricing rate is a floor, not exhaustive" per mind.md
  };

  privacy: {
    mode: 'internal' | 'client_safe';
    internalNotes: string[] | null; // stripped entirely (not just hidden) when mode === 'client_safe'
    approval: {
      status: 'draft' | 'in_review' | 'approved' | 'rejected';
      reviewedBy: string | null;
      reviewedAt: string | null;
    };
  };

  appendix: Record<string, unknown> | null;
}
```

Design choices worth flagging explicitly:
- `GrowthMetric.changePct` is `null`, never `Infinity`/absurd, when the
  baseline is missing or near-zero — this alone fixes the "2657.7%" bug.
- Every section is `| null` at the top level, and a `null` section means
  "omit," not "render empty" — enforced at the render layer, not
  per-component (see §5).
- `Sourced<T>` forces every cross-tenant-sensitive figure (competitor
  prices, cohort benchmarks) to carry its provenance, which both satisfies
  the "clearly distinguish real/public/anonymized data" rule and gives the
  PPTX/PDF renderers a place to hang a small provenance label without
  guessing.

---

## 4. Report-generation architecture

```
Seller/staff request (period, type, mode)
        │
        ▼
┌───────────────────────┐
│ 1. Collectors          │  one module per domain (revenue, inventory,
│  (typed, pure-ish,     │  competitors, customers...), each calling the
│   parallel fan-out)    │  existing SQL aggregate functions where they
│                        │  exist (market_scope_price_stats etc.) rather
│                        │  than re-aggregating in JS
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ 2. Metric calculator   │  pure functions: GrowthMetric construction,
│    (no I/O)            │  percentile/index math, all with explicit
│                        │  guard rails (near-zero denominators → null)
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ 3. Insight rule engine │  named, versioned rules (ruleVersion field) —
│    (deterministic)     │  NOT the LLM. Threshold-based signal detection,
│                        │  same idea as today's getCompetitorTracking()
│                        │  heuristics but promoted to a documented,
│                        │  testable module with unit tests per rule
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ 4. AI narration layer  │  Groq, same discipline as today: only
│    (bounded)           │  paraphrases numbers already in the snapshot.
│                        │  NEW: a post-generation numeric-consistency
│                        │  check extracts any number/% from AI text and
│                        │  verifies it appears in the snapshot before
│                        │  accepting it — reject and fall back to
│                        │  templated text otherwise
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ 5. Validation gate     │  the QUALITY CHECKS list from the brief, run
│    (blocking)          │  as one function returning pass/fail + reasons.
│                        │  A failing report can be saved as 'draft' but
│                        │  CANNOT transition to 'approved'
└───────────┬───────────┘
            ▼
┌───────────────────────┐
│ 6. Snapshot persist    │  INSERT into report_snapshots (full JSON +
│                        │  hash + status='draft')
└───────────┬───────────┘
            ▼
      (researcher review — see §7, status → in_review → approved)
            │
            ▼
┌───────────────────────┐
│ 7. Section planner     │  pure function: ReportSnapshot → ordered list
│                        │  of "sections to render," applying §5's
│                        │  inclusion rules + pagination math (how many
│                        │  continuation slides/pages a table needs)
└───────────┬───────────┘
            ▼
      ┌─────┴─────┐
      ▼           ▼
┌──────────┐ ┌──────────┐
│ PPTX      │ │ PDF       │   both consume the identical section plan +
│ renderer  │ │ renderer  │   snapshot — never touch collectors/metrics/
└─────┬────┘ └─────┬────┘   AI directly (enforces the brief's "keep
      ▼             ▼        calculations separate from rendering")
   export buffer  export buffer
      │             │
      └──────┬──────┘
             ▼
┌───────────────────────┐
│ 8. Export storage       │  upload to Supabase Storage, row in
│                          │  report_exports (snapshot_id, format,
│                          │  storage_path, generated_at)
└───────────────────────┘
```

Key separation-of-concerns rule (directly from the brief, enforced by
directory structure, not just convention): `lib/reports/collectors/*`,
`lib/reports/metrics/*`, and `lib/reports/rules/*` may never import from
`lib/reports/render/*`, and vice versa. The section planner (step 7) is the
only thing both sides depend on.

---

## 5. Section inclusion rules

| # | Section | Included when | Omitted/collapsed when |
|---|---|---|---|
| 1 | Cover & metadata | Always | Never omitted |
| 2 | Executive snapshot | `revenue \|\| productPerformance` present | Both null → section skipped, not shown empty |
| 3 | Market position & percentiles | `marketplacePerformance` present AND ≥1 platform has coverage for seller's category | No market-definition coverage → replaced with an explicit "no market coverage for this category yet" notice, not hidden silently (per mind.md's existing honest-empty-state pattern for 10/12 categories) |
| 4 | Pricing intelligence | `pricePositioning` present | Sample size too small for a recommended band → band field `null`, card omitted but section stays if trend data exists |
| 5 | Marketplace & competitor tracking | `competitorBenchmarks` present (i.e. seller's category has a named-seller source — currently Daraz only) | Omitted entirely for categories with zero named-seller coverage — explicitly flagged in methodology, not faked |
| 6 | SKU performance | `productPerformance.topProducts.length > 0` | Zero active products → omitted |
| 7 | Inventory & demand risk | `inventoryRisk.lowStockSkuCount > 0 OR supplyVoidOpportunities.length > 0` | Exactly the fix for the "0 SKUs ... On track" bug — a genuinely healthy inventory state gets a one-line reassurance in the executive snapshot, not its own section |
| 8 | Product portfolio contribution | `productPerformance.categoryBreakdown.length ≥ 2` | Single-category sellers don't get a "portfolio" framing that implies diversification they don't have. Section title/subtitle must render `contributionBasis` explicitly ("by inventory value" vs. "by revenue") — never labeled as revenue while `basis === 'inventory_value'`, per §2 item 0 |
| 9 | Customer health & retention | `customerHealth !== null` (gated upstream at `MIN_CUSTOMERS_FOR_RFM`) | Below threshold → omitted, never rendered with a 0-count "Win-Back Segment" |
| 10 | Prioritised recommendations | `recommendations.length > 0` | Always attempt at least 1 if any prior section rendered; if truly nothing actionable, omit rather than force generic filler |
| 11 | Strategic roadmap | `recommendations.length ≥ 2` (roadmap needs multiple recs to sequence into phases) | Otherwise omitted — no generic "Phase 01/02/03/04" boilerplate unconnected to real findings |
| 12 | Methodology & privacy | Always | Never omitted — this is the section that makes every other section's honesty auditable |
| 13 | Appendix | Only in `mode: 'internal'` and only if `appendix` non-empty | Never shown in `client_safe` mode |

**Pagination rule**: any native table section computes `rowsPerSlide` from
the template's fixed table geometry (already established today at 5 data
rows per table in the current template); if `rows.length > rowsPerSlide`,
the section planner emits N continuation slides/pages with a repeated
header and a "(continued)" label, rather than truncating data silently.

### Total slide/page count is a function of data, not a fixed template length

This is the one place the current system is architecturally wrong in a way
worth calling out plainly: the existing template is a fixed 11-slide deck,
and `generate-pptx.ts` always emits all 11 regardless of what data actually
exists for a given seller (§1 already showed 6 of those 11 are static
content today). The rebuilt system must not repeat that shape with a
different fixed number — 13 sections is the *catalogue* of possible
sections, not a promise that every report has 13 slides.

Total output length for a given report = 
`always-present slides (cover, executive snapshot if any data exists,
methodology)` + `one slide per §5 section that actually passed its
inclusion rule` + `continuation slides emitted by the pagination rule
above, per table/chart section that overflows its row/point budget`.

Concretely, `section-plan.ts` (§4 step 7) must enforce both ends of this,
not just the "don't show empty sections" floor already covered by §5:

- **Floor** — a report is never padded to look more substantial than the
  data supports. A seller with only revenue and product data (e.g. brand
  new, in a category with no market coverage) gets a short report — cover,
  executive snapshot, SKU performance, methodology, done. No filler
  section, no "coming soon" slide, no forced roadmap built from one
  recommendation.
- **Ceiling** — a section with unusually large data (e.g. 40 tracked
  competitors, or a seller with 30 low-stock SKUs) does not sprawl into a
  dozen continuation slides. Cap continuation slides per section at a
  fixed `MAX_CONTINUATION_SLIDES` (proposed: 2, i.e. up to 3 slides total
  for one table section = 15 rows at 5/slide); beyond the cap, the last
  continuation slide ends with an explicit "+N more — full list in your
  Ryvl dashboard" line rather than silently truncating or growing without
  bound. This keeps the executive-readable promise in the brief's DESIGN
  section ("less unused space... better executive storytelling") from
  being violated in the other direction by an oversized report nobody
  will actually read end to end.
- Both bounds are asserted directly in the validation gate (§4 step 5) and
  covered by the "section visibility"/"overflow" tests called for in the
  brief — a report that comes out at 3 slides for a thin seller and 22
  slides for a data-rich enterprise seller in the same test suite is the
  correct, expected behavior, not a bug to converge toward a fixed number.

---

## 6. PPTX/PDF generation approach

### PPTX — keep `pptx-automizer`, rebuild the template

The library is not the problem — it already supports native chart
modification (`ModifyChartHelper`, confirmed installed). The problem is the
current template is a raw Google Slides export with zero real chart objects
and fragile auto-generated shape names. Proposed:

1. **Re-author the 11-slide template** (or however many the new section set
   needs) in PowerPoint or Google Slides, this time:
   - Using **real native chart objects** (bar/line) for every
     data-driven visual — no more baked PNGs for percentile/trend charts.
   - Giving every editable shape a **deliberate, stable name**
     (`kpi.revenue.value`, `chart.priceTrend`, `table.competitors`) instead
     of relying on Google's auto-generated `Google Shape;NNN;pXX` — this
     is a one-time authoring cost that removes the single biggest fragility
     found in the current system.
   - Embedding a real font for bullet glyphs (fixes the `�` rendering bug).
2. Extend `generate-pptx.ts` into a **section-driven renderer**: given the
   section plan from §4 step 7, iterate sections and call one render
   function per section type (`renderKpiSection`, `renderTableSection`,
   `renderChartSection`...), each a small reusable module — matching the
   brief's "reusable components" requirement directly, and replacing the
   current single 387-line function keyed on hardcoded slide indices.
3. Continuation slides (§5) are handled by cloning a "table continuation"
   layout slide N times, not by a special case in the main renderer.

### PDF — DECIDED: Option A (extend the existing pdfkit path)

Confirmed 2026-08-04. The current deploy is all-serverless Vercel with no
evidence anywhere in the repo of dedicated worker/container infra, and the
brief explicitly says to reuse the existing stack rather than add
unnecessary libraries — Option B would mean standing up new infrastructure
just for PDF conversion, which isn't justified today. Revisit Option B
later only if exact pixel-parity between PDF and PPTX becomes a hard
requirement (kept below for that future reference).

**Option A — extend the existing pdfkit path (decided).**
Native vector PDF, zero new dependencies, runs anywhere including Vercel's
existing serverless functions (today's actual deploy target). Restructure
it the same way as PPTX: a section-driven renderer consuming the identical
`ReportSnapshot` + section plan, with a small internal chart-primitives
module (bar/line via pdfkit's vector drawing, replacing today's ad hoc
rect-drawing). **Tradeoff**: PDF and PPTX remain two hand-maintained
renderers sharing data but not rendering code — acceptable, since the
brief only requires *data* parity ("both formats must come from the same
structured report data"), not pixel parity.

**Option B — LibreOffice headless conversion of the generated PPTX (not
chosen, kept for reference).** `soffice --headless --convert-to pdf` on the
actual PPTX output guarantees the PDF is visually identical to the
editable deck, with zero duplicate layout code. **Tradeoff**: requires a
`soffice` binary in the runtime, which Vercel's standard serverless
functions do not provide — this would need a separate worker (a small
container on Fly.io/Render, or a Supabase Edge Function with a custom
Docker image), a real infrastructure addition, not just a library.

---

## 7. Researcher review and approval workflow

**DECIDED 2026-08-04**: "researcher" = internal Ryvl staff reviewing a
report before it's marked client-safe, not the seller reviewing their own
report. This matches what the reference deck's own marketing copy already
claims happens ("Internal analysts review model findings...Data Validation
& Approval Gate," "Client-Safe Export Guarantee") — the product is already
selling this workflow to customers, so building it as internal-staff
review is the consistent reading, not a guess. The workflow below proceeds
on that basis.

Context for why this needed deciding rather than assuming: there is no
internal-staff/admin role anywhere in this codebase today, only `sellers`
— this workflow introduces the first actor of that kind, matching an
agency/consulting delivery model (Ryvl staff review before client
delivery) rather than a self-serve SaaS flow.

Proposed:

1. Report generates as `status: 'draft'` after passing validation (§4 step
   5) — drafts are always internal-mode, never directly downloadable by
   the seller.
2. A minimal internal review surface — **phased**, not built all at once:
   - **Phase 1 (ships with the rest of this system)**: no dedicated UI.
     Review happens via a service-role-authenticated internal API
     (`PATCH /api/internal/reports/:id`) that accepts edits to specific
     snapshot fields (recommendations text, AI narration) and a status
     transition, callable via a simple internal tool/script or directly
     against Supabase. Every edit writes an append-only row to
     `report_reviews` (who, what changed, when) — never overwrites
     silently.
   - **Phase 2 (later, if this becomes frequent enough to need real UI)**:
     a proper `/internal/reports` dashboard page, gated by a small
     staff-allowlist table, with inline diff view.
3. `status: 'in_review'` while a reviewer has claimed it; `approved`
   unlocks client-mode export; `rejected` requires regeneration, not a
   silent overwrite of the same row (new snapshot version instead, per the
   append-only convention already established by `scraper_runs`).
4. The export endpoint refuses to generate a `client_safe` PPTX/PDF for
   any snapshot not in `approved` status — this is the literal enforcement
   of "do not generate a client-facing report when critical validation
   fails," extended to also gate on human approval, not just automated
   checks.

---

## 8. Files and database tables that need changes

### New database tables (migration 025+)

```sql
-- one row per generated report; append-only in spirit (new version = new row,
-- not an overwrite), mirrors the scraper_runs/market_price_history idiom
create table report_snapshots (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references sellers(id) on delete cascade,
  report_type text not null,
  period_start date not null,
  period_end date not null,
  version integer not null default 1,
  status text not null default 'draft', -- draft|in_review|approved|rejected|archived
  mode text not null default 'internal', -- internal|client_safe
  data jsonb not null,        -- the full ReportSnapshot
  data_hash text not null,    -- for export-integrity checks
  generated_by text not null, -- 'seller_request'|'scheduled'|'internal_staff'
  created_at timestamptz not null default now()
);

-- append-only audit trail of review actions
create table report_reviews (
  id uuid primary key default gen_random_uuid(),
  report_snapshot_id uuid not null references report_snapshots(id) on delete cascade,
  reviewer_identifier text not null, -- email or internal user id; no staff table exists yet, see §7
  action text not null, -- comment|edit|approve|reject
  notes text,
  field_changes jsonb,
  created_at timestamptz not null default now()
);

-- one row per exported file (a snapshot can be exported multiple times/formats)
-- NOTE: storage_path points into a Supabase Storage bucket that does not
-- exist yet - checked directly, this app has never used Supabase Storage
-- anywhere (grepped `.storage.from(` across src/, zero matches). Creating
-- and configuring a bucket + its own access policy is greenfield work,
-- not reuse of an existing integration - budget for it explicitly in
-- Phase 5/6 of §9, don't assume it's a five-minute add.
create table report_exports (
  id uuid primary key default gen_random_uuid(),
  report_snapshot_id uuid not null references report_snapshots(id) on delete cascade,
  format text not null, -- pptx|pdf
  storage_path text not null,
  exported_at timestamptz not null default now()
);
```
All three: owner-only RLS via `seller_id in (select id from sellers where
user_id = auth.uid())` for seller-side read access to their own reports;
write access restricted to service-role (matches `seller_price_alerts`'s
existing pattern of seller-read/service-write).

### New/restructured application files

```
lib/reports/
  schema.ts                      # the ReportSnapshot types from §3
  collectors/
    revenue.ts  products.ts  marketplace.ts  competitors.ts
    pricing.ts  inventory.ts  customers.ts
  metrics/
    growth.ts                    # GrowthMetric construction, guard rails
    percentile.ts
  rules/
    market-signals.ts            # promoted, versioned, tested version of
                                  # today's getCompetitorTracking() heuristics
  ai/
    narrate.ts                   # replaces generate-report-insights.ts,
                                  # adds numeric-consistency check
  validate.ts                    # the QUALITY CHECKS gate
  section-plan.ts                # §5 inclusion rules + pagination
  render/
    pptx/  (per-section renderers + shared component helpers)
    pdf/   (mirrors pptx/ structure, per §6 Option A)
  persist.ts                     # snapshot CRUD against report_snapshots
  assets/ryvl-report-template.pptx   # rebuilt per §6

app/api/reports/
  route.ts                       # POST: create snapshot (seller-triggered)
  [id]/route.ts                  # GET status, PATCH (internal review, §7)
  [id]/export/route.ts           # GET ?format=pptx|pdf, gated on status

app/dashboard/reports/           # NEW — currently doesn't exist at all
  page.tsx                       # list of a seller's report snapshots
  [id]/page.tsx                  # single-report status/preview/download

components/marketintel/
  DownloadReportButton.tsx       # extend: report-type + period picker,
                                  # replaces the current single-click button
```

---

## 9. Implementation phases

Sized to ship incrementally and stay reviewable — not one giant PR.

**Status as of 2026-08-04: Phases 0-4 and 7 are implemented and merged.
Phases 5 and 6 are not.** Details below; verify against the live repo
before trusting this line in a future session.

**Phase 0 — schema & persistence — DONE.**
Migration `025_report_snapshots.sql` (`report_snapshots`, `report_reviews`,
`report_exports`, owner-only RLS, service-role write) written but **not
yet applied** in Supabase — same "written vs. applied" gap this repo has
hit before (see mind.md). `lib/reports/schema.ts` (the full `ReportSnapshot`
type) and `lib/reports/persist.ts` (save/get/list/transitionStatus/
recordExport, admin-client writes) are both implemented.

**Phase 1 — collectors, metrics, validation — DONE.**
`lib/reports/collectors/{revenue-and-products,marketplace-and-pricing,
competitors,customers}.ts` replace the old monolithic
`collect-report-data.ts` (deleted). `metrics/growth.ts` provides
`buildGrowthMetric`/`safeRatio` with a near-zero-baseline guard — this is
the actual fix for the "+2657.7%" bug, covered by a unit test that
reproduces the failure mode and asserts it can't happen. `validate.ts`
implements the QUALITY CHECKS gate.

**Phase 2 — market-signals rules + AI narration hardening — DONE.**
`rules/market-signals.ts` promotes the old ad hoc price-delta thresholds
into four named, versioned (`ruleVersion: 'v1'`) rule functions.
`ai/narrate.ts` replaces `generate-report-insights.ts` (deleted): same
"only paraphrase pre-computed numbers" discipline as before, plus the
numeric-consistency check that was missing - every number/percentage the
model states is extracted and checked against the snapshot's own values;
an ungrounded claim rejects the whole narration in favor of the static
fallback rather than risking one bad slide.

**Phase 3 — section plan + PPTX renderer — DONE, but via a better approach
than originally scoped here.** Instead of hand-authoring a new PowerPoint
template file with real chart objects (this section's original plan),
the renderer was switched to **`pptxgenjs`, generating the entire deck
from code with zero template file** - `pptxgenjs` was already an installed,
unused dependency and supports native charts/tables/text/shapes built
programmatically. This eliminates the template-authoring bottleneck
entirely (no PowerPoint design work was a blocking dependency) and the
Google-Slides-shape-name fragility documented in §1. `pptx-automizer` and
the old `ryvl-report-template.pptx` asset were removed - nothing depends
on them anymore. `section-plan.ts` implements §5's inclusion rules and the
dynamic slide-count floor/ceiling exactly as specified (`ROWS_PER_TABLE_PAGE
= 5`, `MAX_CONTINUATION_PAGES = 2`), covered by tests for both ends (a
2-slide floor case and a 40-row table hitting the truncation ceiling).
`render/pptx/components.ts` holds the reusable component library (KPI
cards, native tables, native bar/line charts, insight callouts,
recommendation cards, section dividers, confidentiality labels) and
`render/pptx/build-deck.ts` composes them per section.

**Phase 4 — PDF renderer parity — DONE.**
`render/pdf/build-pdf.ts` mirrors `build-deck.ts` section-for-section
against the same `ReportSnapshot` and `section-plan.ts` output, using
pdfkit (Option A from §6, as decided) with native vector shapes/text/bars
- no rasterized charts. The old orphaned `generate-pdf.ts` is deleted;
`DownloadReportButton.tsx` now offers both formats via a menu (PDF was
previously disabled in the UI pending exactly this rework).

**Phase 5 — review/approval workflow — NOT DONE.**
`persist.ts`'s `transitionStatus()` exists (the primitive an internal API
would call), but there is no `/api/internal/reports/:id` route and no
enforcement yet that a `client_safe` export requires `status: 'approved'`.
The current `/api/reports/generate` route only ever produces `mode:
'internal'` self-view downloads for the seller's own dashboard (see the
route's own comment on why that's a deliberately different, lower-risk
path than the formal client-safe delivery flow in §7).

**Phase 6 — seller-facing UI — NOT DONE.**
No `dashboard/reports/` list/detail pages exist yet. `DownloadReportButton`
was extended with a format picker but not a period/report-type picker.
No entitlement/plan-tier gating was added to the report route.

**Phase 7 — hardening — DONE (for what's implemented so far).**
Confirmed: this app had zero test infrastructure before this work (no
`test` script, no config). Added `vitest` (bumped to `^3.2.7` specifically
- earlier 2.x/early-3.x resolve a vulnerable transitive `esbuild`, `npm
audit` was rerun clean after pinning), `vitest.config.ts`, and 25 tests
across `metrics/growth.test.ts`, `section-plan.test.ts`, `validate.test.ts`,
and `render/render.test.ts` (PPTX/PDF generation smoke tests against both
a floor-case and a data-rich, paginated fixture). `npm run test` wired into
`.github/workflows/ci.yml` alongside typecheck/lint/build. Two real bugs
were caught and fixed by writing these tests: `section-plan.ts`'s
`inventory_risk` inclusion check was testing object-existence instead of
the actual SKU count (would have shown a 0-count section despite the
explicit rule against it), and the growth-guard test itself was
miscalibrated against the exact boundary value. Not yet covered: tenant
isolation (needs Supabase test doubles/integration setup, not just pure-
function tests) and overflow at the PDF-page level specifically (the PDF
renderer reuses the same section plan as PPTX, so it inherits the same
pagination tests indirectly, but has no PDF-specific overflow test yet).

---

## 10. Risks and assumptions

- **Migration 025 is written but not applied** — same "written vs. applied"
  gap this repo has hit repeatedly before (mind.md tracks this pattern).
  Until it's run in the Supabase SQL Editor, `saveSnapshot()`/`persist.ts`
  will fail against a missing table, and `/api/reports/generate` currently
  swallows that failure (logs it, still returns the generated file) rather
  than blocking the seller's download - by design, since a self-view
  download shouldn't fail just because persistence isn't set up yet, but it
  does mean report history/versioning is silently inert until this runs.
- **Biggest risk, added after deeper verification**: real SKU-level revenue
  attribution needs an order-line-item table that doesn't exist (§2 item
  0). If you want "product portfolio contribution"/"SKU performance" to
  show actual revenue (matching what the reference deck implies), that's a
  data-ingestion change, not a report-layer change, and isn't sized into
  the phases in §9 above — it would need its own scoping pass. If
  inventory-value-based framing is acceptable for now (honestly labeled,
  per the `contributionBasis` field in §3), no schema change is needed and
  Phase 1 covers it as-is.
- **Supabase Storage is unused anywhere in this app today** — the
  `report_exports` design in §8 requires standing up a bucket and its
  access policy from scratch, not wiring into an existing integration.
- **No test runner exists in this app today** — Phase 7 in §9 has to stand
  one up before it can add the tests the brief requires; this isn't
  optional prep work, it's a real first step with its own small setup
  surface (config, CI wiring in `.github/workflows/ci.yml`).
- ~~Researcher-identity assumption~~ and ~~PDF generation approach~~ —
  **both decided 2026-08-04** (§7, §6). No longer open; the workflow and
  render approach below are written against those decisions, not
  hypotheticals. If either turns out wrong once staff/reviewer needs
  become concrete, §7's Phase 2 (a real internal UI, not yet built) is the
  natural point to revisit — it's deferred specifically so this decision
  doesn't need to be perfect on the first pass.
- **Template rebuild is real design work**, not just code — someone needs
  to author a new PPTX template with real chart objects and a stable
  naming convention. This is the single biggest non-engineering dependency
  in the plan (Phase 3) and could be the critical path.
- **RFM/at-risk scoring stays in JS** (not ported to SQL) unless you'd
  rather it move — flagged in §2 item 7 as a deliberate exception to the
  "aggregation in SQL" convention, since quintile ranking across a full
  customer table is awkward to express and tune in plain SQL. Worth a
  conscious yes/no rather than silent inconsistency.
- **Entitlement gating**: report generation is currently ungated by plan
  tier. Given this brief frames reports as the platform's flagship
  enterprise feature, Phase 6 proposes gating it — confirm whether that's
  wanted, and at which tier (`paid` or `premium`).
- **`market_price_history` growth**: already flagged in mind.md as the
  fastest-growing table with no retention/pruning policy; a reporting
  system that queries trend data more heavily will lean on this table more
  — worth keeping an eye on, not blocking, for this phase.
- **Stray worktrees**: `.claude/worktrees/` currently has 4 leftover
  branches from prior sessions (`agent-a5d6626a37a3208d5`,
  `crazy-greider-97ae48`, `elated-shamir-a5e752`,
  `reverent-goldstine-4e34f8`) — checked, none touch migrations 025+, so no
  numbering collision, but worth cleaning up separately since their status
  is unclear (not this project's scope to resolve, flagging for
  awareness).
- **No migration/table currently distinguishes "internal Ryvl staff" from
  "seller users"** — §7's Phase 1 API needs *some* authorization boundary
  beyond Supabase RLS-as-designed (which is entirely seller-scoped today).
  A service-role-only internal API sidesteps this for Phase 1 but isn't a
  long-term access-control story if a real internal UI (Phase 2 of §7)
  gets built later.
