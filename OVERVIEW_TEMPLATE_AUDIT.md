# TailAdmin React → Overview page — Audit & Mapping (2026-09-01)

**Documentation only, per instruction. Nothing was implemented - the
template was fetched into the repo and read, but no application code
(Ryvl's or the template's) was modified.** Read `FEATURES.md`'s Overview
section, `ASSETS.md`, and `MIGRATION_PLAN.md` alongside this file before
implementing.

Scope, per explicit clarification this session: **this covers the
Overview/home dashboard page only.** The other 12 dashboard pages (Market,
Competitors, Products, Orders, etc.) are a separate, later effort - see
`MIGRATION_PLAN.md`.

## What was fetched

`tailadmin-react-dashboard/` (repo root, committed in full, `.git`
stripped) - [TailAdmin React](https://github.com/TailAdmin/free-react-tailwind-admin-dashboard),
MIT licensed. Confirmed stack: **React 19 + Vite + Tailwind CSS 4 +
TypeScript + `apexcharts`/`react-apexcharts`** - the same charting library
Ryvl's current Overview page already uses, which meaningfully lowers the
porting cost for chart configs specifically (tooltip/color/series logic
carries over conceptually even though the wrapper component differs).

The exact Overview-equivalent page: **`src/pages/Dashboard/Home.tsx`**,
composing 6 components from `src/components/ecommerce/`.

## Layout shape (`Home.tsx`)

A 12-column CSS grid:
```
[ EcommerceMetrics (7 cols) ]     [ MonthlyTarget (5 cols) ]
[ MonthlySalesChart (7 cols) ]
[ StatisticsChart (12 cols, full width) ]
[ DemographicCard (5 cols) ]      [ RecentOrders (7 cols) ]
```

## Component-by-component mapping to Ryvl's real Overview

Ryvl's actual Overview content is documented in `FEATURES.md` Part 2,
Section 1. Cross-referencing each template component against it:

| Template component | What it is | Ryvl replacement | Real data source |
|---|---|---|---|
| `EcommerceMetrics.tsx` | 2 stat cards (Customers, Orders), icon + value + up/down % badge | Ryvl's `StatsGrid` already does this, better - 4 cards (Revenue/Orders/AOV/New Customers), per-metric icon+color, not just 2 metrics. **Port the template's card visual style into `StatsGrid`, don't port its narrower 2-metric structure.** | `GET /api/ecommerce/stats` (already wired) |
| `MonthlySalesChart.tsx` | Bar chart, 12 fixed months, hardcoded dummy data, dropdown menu (View More/Delete - both no-ops) | Not a direct match - Ryvl's revenue chart is a 30-day *trend* (line/area with real dates), not monthly bars. Either keep Ryvl's existing chart shape and just apply this template's visual styling (card chrome, colors, dropdown affordance), or decide deliberately if a monthly view is also wanted. **This is a content-shape decision, not just a style port - flag for the user rather than guessing.** | `GET /api/ecommerce/revenue-trend` (already wired) |
| `MonthlyTarget.tsx` | Radial/gauge chart showing "75.55%" progress toward a hardcoded "$20K" target, plus Target/Revenue/Today mini-stats | **No real Ryvl equivalent exists today** - there's no concept of a seller-set revenue target anywhere in `FEATURES.md`. Either (a) drop this component/slot entirely, (b) repurpose the radial-gauge *shape* for something Ryvl actually has (e.g. "% of active products with a cost price set," a real data-completeness metric from `computeProductsInsight` in `FEATURES.md`), or (c) treat it as a genuinely new feature request (a real seller-defined revenue goal) - that's a scope decision, not a porting task. **Flag for the user.** | None currently - see above |
| `StatisticsChart.tsx` | Full-width area/line chart, "Sales" + "Revenue" 2-series comparison, date-range picker (flatpickr), tab control (`ChartTab`, unread contents not yet checked) | Closest match to Ryvl's existing revenue+forecast chart (`LineChart` with an actual/projected dashed series). The 2-series pattern (solid + comparison line) maps well onto Ryvl's real forecast rendering (actual vs. projected). The date-range picker is new functionality Ryvl's Overview doesn't have today - worth considering, not required. | `GET /api/ecommerce/revenue-trend` + `GET /api/forecast/revenue` (already wired) |
| `DemographicCard.tsx` | World map (customers by country) + per-country progress bars | **No real Ryvl equivalent** - Ryvl doesn't track seller countries at the *customer* level anywhere in `FEATURES.md` (country config in `countries.ts` is about the *seller's own* market, not their customers' locations - see `ASSETS.md`/`FEATURES.md`'s countries.ts note). Drop this slot, or repurpose the progress-bar pattern for something real: e.g. the category-inventory-value breakdown (currently a donut on Ryvl's Overview) could reuse this bar-list visual instead of a donut. **Flag for the user - don't silently keep a demographic feature Ryvl has no data for.** | None currently |
| `RecentOrders.tsx` | **Misleadingly named in the template itself** - despite the title "Recent Orders," it actually renders a *product* table (columns: Products/Category/Price/Status, interface literally named `Product`), 5 hardcoded electronics items (MacBook Pro, Apple Watch, etc.), status badges Delivered/Pending/Canceled | Two real Ryvl candidates, pick one deliberately: (a) Ryvl's actual "Top products by inventory value" table (Title/Category/Sell price/Stock/Inventory value, real data) is the closer structural match to what this component *renders*; (b) if the "Orders" framing is wanted instead, Ryvl's real order-status donut + a real recent-orders list would need different columns (Order/Customer/Date/Amount/Status per `FEATURES.md`'s Orders page) - this table's status badge pattern (Delivered/Pending/Canceled → Ryvl's real completed/pending/cancelled/refunded) transfers either way. | `GET /api/ecommerce/products` or Overview's existing top-products data (already wired) |

## What's genuinely reusable as-is (visual/structural patterns, not content)

- The 12-column responsive grid shape itself - directly portable, no content dependency.
- Card chrome: `rounded-2xl border border-gray-200 bg-white ... dark:bg-white/[0.03]` - a clean, real dark-mode pattern worth adopting regardless of which components get ported.
- The `Badge` component (`color="success"/"error"/"warning"`) - maps cleanly onto Ryvl's existing tone-color system already used in `InsightStrip` (good/warning/critical/neutral) - likely worth aligning the two rather than running two separate badge-color systems.
- The `Dropdown`/`DropdownItem` "View More / Delete" affordance pattern on cards - currently non-functional placeholder in the template itself (no onClick logic beyond closing the menu) - would need real actions wired if kept, or dropped if not needed.
- ApexCharts config patterns (gradient fills, radial bars, tooltip formatting) - directly reference-able since Ryvl already uses the same charting library.

## Dummy data - confirmed generic, not the real-person/real-brand kind

Unlike the landing template's `Teams.jsx` (real people) and `TrustedBy.jsx`
(real company logos), **this dashboard template's dummy data is entirely
generic placeholder** - fake numbers ("3,782" customers, "$3287 today"),
fixed Jan-Dec month data, generic Apple-product names in the table. No
real-person or real-brand misrepresentation risk here. Still all needs
replacing with real Ryvl data before use, just not for the same
ethical-concern reason as the landing template.

## Brand color - a third data point for the same open decision

`ASSETS.md` Section 0 already flagged 3 competing brand-color values
(template's `#5044E5`, real Ryvl brand `#4318FF`, live app's drifted
`#422AFB`). **This template adds a 4th**: `--color-brand-500: #465FFF`
(`tailadmin-react-dashboard/src/index.css:50`, a full proper 11-step
Tailwind scale from `-25` to `-950`, not just one flat value). Since this
is a real, complete color scale rather than a single hardcoded hex, it may
be the more practical *scale to structurally reuse* even while swapping
in Ryvl's actual approved hue (`#4318FF`) as the 500 value - i.e. keep the
scale's shape, replace its anchor color. Still a decision for the user,
not decided here.

## Open questions for the implementing session

1. `MonthlyTarget` and `DemographicCard` have no real Ryvl data behind
   them at all - drop, repurpose, or treat as genuinely new feature asks?
2. `MonthlySalesChart` (monthly bars) vs. Ryvl's existing 30-day trend -
   keep Ryvl's real chart shape with the template's visual styling, or
   also want a monthly view?
3. `RecentOrders`'s real identity - products table or actual orders list?
   The template's own naming is inconsistent, don't copy that confusion
   forward.
4. Brand color scale: adopt TailAdmin's structural `brand-25`...`brand-950`
   scale with Ryvl's real `#4318FF` swapped in as the anchor, or a
   different scale entirely?
5. Card action dropdowns ("View More"/"Delete") - wire to real actions,
   or remove since they're non-functional in the template as-is?
