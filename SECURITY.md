# Security remediation status

Tracks what has been fixed against the audit in [`leaks.md`](leaks.md)
(2026-08-02). `leaks.md` is left unedited as the original audit record; this
file is the living remediation status.

Last updated: 2026-08-04.

---

## ⚠️ Required deploy steps

**Three things must happen or the fixes below are incomplete.**

### 1. Apply migrations (required, keep this list current)

```
scraper/migrations/018_referral_integrity.sql
scraper/migrations/019_add_daraz_platform.sql
scraper/migrations/020_market_definition_model.sql
scraper/migrations/021_market_scope_aggregates.sql
scraper/migrations/022_competitor_entity.sql
scraper/migrations/023_add_retailer_platforms.sql
scraper/migrations/024_seller_marketing_showcase.sql
scraper/migrations/025_report_snapshots.sql
```

**018–025 confirmed applied as of 2026-08-04**, verified directly against
the live DB (see `mind.md`'s "How to check what's actually live"). Run any
new migration once, in order, via the Supabase SQL Editor (or `psql`
against the pooler connection string in `CREDENTIALS.txt` if the Supabase
MCP tools are connected to the wrong account, which they have been more
than once - see `mind.md`), same convention as 001–017, and update this
list when you do. Without 019 the Daraz source throws `Unknown platform
slug "daraz"` on every run, and 020's seed skips its Daraz rows (it joins
on `market_platforms`). Without 020 every market analysis surface returns
empty — `market_category_map` is the only thing mapping a seller's
category to scraped rows. 021 adds the aggregate functions those surfaces
call; without it category pricing and the price trend return nothing. 022
adds `market_competitors` and the scorecard function behind
`/dashboard/market/competitors`; it depends on 021's
`market_convert_currency`. 023 registers 4 new retailer platforms (mega,
naheed, vmart, shopperspk) — code was already wired into `HTTP_SOURCES`
before this ran. 024 adds an opt-in seller marketing showcase
(`seller_public_profile.show_on_marketing_site`, the
`seller_marketing_showcase` view, `top_market_brands()`) for the public
homepage's company slider; the view reuses migration 012's existing
view-owner pattern (see `seller_public_profiles_view`), not a new exception.
025 adds `report_snapshots`/`report_reviews`/`report_exports` (owner-only
RLS, service-role write) backing the rebuilt report generation system -
see `docs/reports-v2-architecture.md`.

Referral signups depend on 018's trigger (the HTTP endpoint that used to
record them was deleted). This fails safe if not applied (no referral, no
reward, no vulnerability), but is no longer a live concern — 018 is applied.

### 2. Set the Supabase Auth password policy (required) — **done 2026-09-18**

> Set in Authentication → Sign In / Providers → Email: minimum length 8, lowercase + uppercase + digits + symbols. Verified needed the same day: a six-digit numeric password had been accepted before this was set.

Cannot be fixed in application code. The signup page calls
`supabase.auth.signUp()` directly from the browser, so an attacker can
bypass any client-side check by calling the same endpoint themselves with a
weak password. `src/lib/password.ts` still runs, but it is UX, not
enforcement.

In **Supabase Dashboard → Authentication → Policies → Password
Requirements**, set:

- Minimum length: **8**
- Required characters: **lowercase, uppercase, digits, symbols**

That mirrors `PASSWORD_RULES` in `src/lib/password.ts`. Keep the two in sync.

### 3. Confirm production env (required)

`CRON_SECRET` must be set in Vercel, or every `/api/cron/*` route rejects and
the benchmark/alert jobs silently stop running.

`BYPASS_AUTH` and `BYPASS_ENTITLEMENTS` no longer do anything — the code that
read them is gone. Delete them from any environment they are still set in,
so nobody later mistakes them for a working switch.

---

## Fixed

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | **Critical** | Unauthenticated referral endpoint allowed free→paid escalation | Deleted `/api/referrals/record` entirely. The referral code now travels in `auth.signUp()` metadata and is recorded by the signup trigger (`018_referral_integrity.sql`), so submitting one requires actually creating an auth user. Added a unique index on `seller_referrals.joined_seller_id` so a seller can only ever be counted once. |
| 4 | Medium | No HTTP security headers | `headers()` added in `next.config.js`: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`. |
| 6 | Medium | Bulk-import endpoints accepted unbounded arrays | `MAX_IMPORT_ROWS` (5000) enforced in all three `/api/*/bulk-import` routes, returning 413. Mirrored client-side in `BulkImportDrawer` to avoid a wasted upload. |
| 8 | Low | Referral codes from `Math.random()` | `crypto.randomInt` over a 32-char unambiguous alphabet, 8 chars (~40 bits). |
| 9 | Low | Non-constant-time `CRON_SECRET` comparison | `crypto.timingSafeEqual`, with a separate length check (which only reveals secret length). |
| 2 | **High** | `BYPASS_AUTH` / `BYPASS_ENTITLEMENTS` collapsed to cross-tenant exposure | Both flags **deleted** from every code path (ROADMAP.md A1) — `middleware.ts`, `lib/supabase/server.ts`, `lib/market-intel/seller.ts`, `entitlements.ts`. There is no longer any environment variable that can turn off auth or entitlements. `createAdminClient()` survives, but only cron routes call it and each one is behind `isAuthorizedCronRequest`. |
| 5 | Medium | No dependency lockfile; version ranges span a Next.js CVE window | `package-lock.json` un-ignored for the app (it was a Horizon UI template default). CI runs `npm ci`, which fails if the lockfile and `package.json` drift. |
| 13 | Info | No CI gating lint/typecheck/audit | `.github/workflows/ci.yml` — typecheck, lint and a real `next build` for the app, typecheck for the scraper, and an advisory `npm audit --audit-level=high` on both. |
| 12 | Info | Raw Postgres error messages returned in API responses | `apiError()` in `lib/api-error.ts` — logs the real error via `reportError()` and returns only the handler's own summary (45 sites, 33 routes, `ae9a28f`). **Deliberate exception: `/api/cron/*` uses `cronError()` and does return the real message.** Those six routes are reachable only with `CRON_SECRET`, their sole caller is our own GitHub Actions workflow, and the run log is where an operator looks when a scheduled job fails — hiding the cause there protects no one and cost real diagnosability on the first failure after `ae9a28f`. Do not "fix" the cron routes back to `apiError()`; `lib/api-error.test.ts` pins both behaviours. |
| 11 | Info | No explicit CSRF verification on state-changing JSON APIs | `lib/csrf.ts`, called from `middleware.ts` for every mutation under `/api/*`. Uses the browser's Fetch Metadata (`Sec-Fetch-Site`) - which page script cannot set - and falls back to an `Origin`-vs-host check for older browsers; cross-site → 403. Applies only to cookie-authenticated requests: anything carrying `Authorization: Bearer` (mobile, cron) is exempt, as is a client that sends neither header (server-to-server). Previously this rested on the session cookie's `SameSite=Lax` default, which was real but incidental. 8 tests. |
| 10 | Low | Stale `web/` app with a separate, weaker auth system | **Deleted** (23 tracked files). Verified first that nothing imported it, no CI workflow built it, and it had no `package.json` - it was unreachable from every deployed surface. Recoverable from git history if ever needed. |
| — | High | `npm audit` flagged `postcss <=8.5.17` (source-map path traversal/XSS) and `sharp <0.35.0` (libvips CVEs), both pinned exactly by `next@15.5.x` itself — `npm audit fix --force` wanted to downgrade to `next@9.3.3`, a non-fix. Forced to safe patched versions via `"overrides"` in `package.json` (`postcss` 8.5.25, `sharp` 0.35.4 — was 0.35.3 until that version itself became the vulnerable one, GHSA-rgj7-g3m4-5g8c, bumped in `ecdfd5f` alongside `next` 15.5.25 for two critical RCEs) instead of downgrading Next. `brace-expansion <1.1.17` (from eslint's `minimatch`, DoS) fixed in-range by `npm audit fix`. Re-check this override after every Next major/minor bump — a future Next release may ship its own fix and make it redundant. |
| — | Medium | No rate limiting on `/api/assistant` (public Groq-backed landing-page chatbot, added 2026-08-04) | `src/lib/rate-limit.ts` — in-memory fixed-window limiter, 12 requests/minute per IP, returns 429 past that. Deliberately not the fix for finding #7 below (a shared store is still needed for auth endpoints); this is a much smaller bar for a single non-auth route and resets on cold start / differs per instance on Vercel. Good enough to stop casual scripted abuse, not a hard guarantee under a real distributed attack. |

Finding **3** (client-only password policy) is fixed by deploy step 2 above,
not by code.

---

## Still open

Open findings are tracked in a **private repository** —
[Hasee10/Market-Intel-security](https://github.com/Hasee10/Market-Intel-security)
— since this repo became public on 2026-09-18. A public list of unfixed
weaknesses in a live app is a map; the deploy steps and fixed findings
above are safe to keep here, the open ones are not.

When one is fixed, its row moves to the *Fixed* table above with the commit
that closed it.
