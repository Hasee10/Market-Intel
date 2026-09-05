# Architecture

How `src/lib/market-intel` is layered, why, and what is enforced rather
than merely intended.

Written when the directory was regrouped (2026-09-05). Before that it was
29 modules in one flat folder, which told a reader nothing about which of
them touch the database, which run with elevated privilege, and which are
pure. **The regroup moved files and rewrote imports. No implementation
changed** — `git` records all 40 moves as 100%-similarity renames, and the
test count was 244 before and 244 after.

---

## The layers

```
src/lib/market-intel/
├── core/     pure logic, no I/O          — similarity, countries, entitlements
├── market/   analysis over scraped data  — competitors, pricing, matching, …
├── seller/   the seller's own account    — seller, watchlists, referrals, rfm, …
├── jobs/     cron writers, service-role  — benchmarks, churn, fx, low-stock, price-alerts
└── fx.ts     cross-cutting infrastructure
```

### `core/` — pure

No database, no framework, no other market-intel module. Token
similarity, country product config, plan-tier entitlements.

This is the layer worth protecting most, because purity is what makes it
testable without mocking anything, and purity erodes one convenient
import at a time. **Enforced** by `no-restricted-imports` in
`.eslintrc.json`: a `core/` module importing `@/lib/supabase/*`,
`next/*`, or another market-intel layer fails lint.

### `market/` — the scraped market

Everything derived from what the scraper collected: competitor
scorecards, market definition and scope, category pricing, candidate
search, product matching, pre-launch insight, anomalies, forecasting,
scraper health, the public showcase.

This is the product. Per `ROADMAP.md`, Ryvl sells market intelligence;
the seller's own data exists to personalise it.

### `seller/` — the seller's own data

Account and store: the seller record and domains, watchlists,
referrals, RFM, onboarding status, peer benchmarks, pricing
recommendations.

The split between this and `market/` is the same one the product is
built on — scraped market versus the seller's own store — not an
arbitrary bisection of a long list.

### `jobs/` — privileged background work

The five cron-triggered jobs. These run with the service-role key and
**bypass RLS by design**, because the tables they write
(`domain_benchmarks`, `seller_notifications`, `seller_price_alerts`) are
never written by an authenticated seller.

That privilege is the reason this layer is visible in the directory tree
rather than mixed into the other 24 modules. **Enforced**: `market/` and
`seller/` may not import from `jobs/`. Only `/api/cron/*` route handlers
should, and each of those is already gated by
`isAuthorizedCronRequest()`.

### `fx.ts` — deliberately at the root

Currency conversion is used by every layer and belongs to none of them.
Filing it under one would imply an ownership that isn't real.

---

## What is *not* here, on purpose

**No barrel files.** An `index.ts` per folder would let the same symbol
be imported two ways, and the ambiguity costs more than the shorter path
saves. Import the module directly.

**No `data/` layer.** An earlier sketch split on "touches the database".
Almost everything does, so the split carried no information — where a
module sits should tell you what it is *about*, not restate that it
queries Postgres.

---

## Clients

Two, sharing one core.

| | Desktop | Mobile |
|---|---|---|
| Auth | session cookie, `createClient()` | `Authorization: Bearer`, `createBearerClient()` |
| Seller | `getCurrentSeller()` | `getSellerFromRequest()` |
| Routes | the 44 existing `/api/*` handlers | `/api/mobile/*` |

The mobile namespace holds **no business logic**. Every endpoint is a
thin composition over the same `market/` and `seller/` functions the
desktop pages call, which is what guarantees a figure on a phone cannot
disagree with the same figure on a laptop.

The two auth helpers are separate functions rather than one with a
branch. The desktop path is the thing that must not change behaviour,
and not touching it is the only way to be certain of that.

**Scraping is desktop-side only.** The scraper is a GitHub Actions cron
writing to `market_*` tables. Nothing in `/api/mobile/*` can trigger a
scrape; those routes only read what the last run already wrote.

---

## Verifying a structural change

A refactor that claims to change no behaviour should be able to show it:

```bash
npx tsc --noEmit          # resolves every moved import
npx eslint src --ext .ts,.tsx   # includes the layer boundaries above
npx vitest run            # test count must be unchanged, not merely green
git diff --stat -M        # moves should read as renames, not delete+add
```

The test *count* matters as much as the pass state. A move that silently
stopped a suite from being discovered still shows green.
