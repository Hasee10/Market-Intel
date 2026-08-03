# Security remediation status

Tracks what has been fixed against the audit in [`leaks.md`](leaks.md)
(2026-08-02). `leaks.md` is left unedited as the original audit record; this
file is the living remediation status.

Last updated: 2026-08-03.

---

## ⚠️ Required deploy steps

**Three things must happen or the fixes below are incomplete.**

### 1. Apply migrations 018 – 022 (required)

```
scraper/migrations/018_referral_integrity.sql
scraper/migrations/019_add_daraz_platform.sql
scraper/migrations/020_market_definition_model.sql
scraper/migrations/021_market_scope_aggregates.sql
scraper/migrations/022_competitor_entity.sql
```

Run once each, in order, via the Supabase SQL Editor, same convention as
001–017. Without 019 the Daraz source throws `Unknown platform slug "daraz"`
on every run, and 020's seed skips its Daraz rows (it joins on
`market_platforms`). Without 020 every market analysis surface returns empty —
`market_category_map` is now the only thing mapping a seller's category to
scraped rows. 021 adds the aggregate functions those surfaces call; without it
category pricing and the price trend return nothing. 022 adds
`market_competitors` and the scorecard function behind
`/dashboard/market/competitors`; it depends on 021's
`market_convert_currency`, and until it runs the scraper logs one failed
`market_refresh_competitors` call per run and the page renders its empty
state.

Until it is applied, referral signups are **silently not recorded** — the
HTTP endpoint that used to record them has been deleted, and the trigger
that replaces it lives in this migration. This fails safe (no referral, no
reward, no vulnerability) but the referral feature is inert until it runs.

### 2. Set the Supabase Auth password policy (required)

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
| — | High | `npm audit` flagged `postcss <=8.5.17` (source-map path traversal/XSS) and `sharp <0.35.0` (libvips CVEs), both pinned exactly by `next@15.5.x` itself — `npm audit fix --force` wanted to downgrade to `next@9.3.3`, a non-fix. Forced to safe patched versions via `"overrides"` in `package.json` (`postcss` 8.5.25, `sharp` 0.35.3) instead of downgrading Next. `brace-expansion <1.1.17` (from eslint's `minimatch`, DoS) fixed in-range by `npm audit fix`. Re-check this override after every Next major/minor bump — a future Next release may ship its own fix and make it redundant. |

Finding **3** (client-only password policy) is fixed by deploy step 2 above,
not by code.

---

## Still open

| # | Severity | Finding | Note |
|---|---|---|---|
| 7 | Medium | In-memory rate limiter ineffective on serverless; no rate limiting on auth endpoints | Needs a shared store (Upstash/Redis) or Supabase Auth's built-in limits. |
| 10 | Low | Stale `web/` app with a separate, weaker auth system | Not deployed (no `package.json`). Should be deleted outright once nothing is being salvaged from it. |
| 11 | Info | No explicit CSRF verification on state-changing JSON APIs | Partially mitigated: routes require a bearer/cookie session and JSON content-type. Worth verifying deliberately. |
| 12 | Info | Raw Postgres error messages returned in API responses | Leaks schema detail. Wrap in generic messages, log the detail server-side. |

### Deliberately not done yet

**Content-Security-Policy.** Chakra/Emotion inject styles at runtime and
would require `'unsafe-inline'` for `style-src`, which would make the policy
weak enough to give false assurance while still risking breakage. It needs a
nonce-based setup done properly rather than being bolted onto the header
block. Tracked as its own item.

---

## Note on `CREDENTIALS.txt`

The repo-root `CREDENTIALS.txt` holds live Supabase service-role and Groq
keys. It **is** in `.gitignore` and is **not** tracked by git — verified, it
has not leaked into history. It remains plaintext on disk. Rotating these
keys and moving them to a secret manager is worth doing before the team
grows beyond one person.
