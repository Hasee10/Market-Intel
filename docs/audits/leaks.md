# Security Audit — Market-Intel (Ryvl)

**Date:** 2026-08-02
**Scope:** Full repository — `app/` (the deployed Next.js 15 + Supabase app), `scraper/` (standalone Node/TS scraper), `.github/workflows/` (CI cron triggers), and the legacy `web/` scaffold at the repo root.
**Method:** Manual source review (no dynamic/live testing performed against the deployed instance). Every finding below is backed by an exact file/line reference; nothing here is speculative.

**Scope note on `web/`:** The `web/` directory at the repo root is a single-commit, superseded scaffold. Per `README.md`, its `PORTAL_URL` "still points at the old JobLo Vercel deployment" and it has no `package.json`/`next.config.js`/`tsconfig.json` of its own — it is **not part of the deployed application**. Findings from it are marked `[web/ — legacy, not deployed]` and are lower priority than findings in `app/`, which is the real, live app.

---

## Table of Contents

1. [Critical] Unauthenticated referral endpoint allows free plan-tier escalation (reward fraud)
2. [High] `BYPASS_AUTH` / `BYPASS_ENTITLEMENTS` flags collapse to full cross-tenant exposure if ever set in production
3. [High] Password complexity policy is enforced only client-side
4. [Medium] No HTTP security headers configured
5. [Medium] No dependency lockfile for the main app; version ranges span a known Next.js CVE window
6. [Medium] Bulk-import endpoints accept unbounded arrays (resource exhaustion)
7. [Medium] In-memory rate limiter is ineffective on serverless; no rate limiting on real auth endpoints
8. [Low] Referral codes generated with `Math.random()`
9. [Low] Non-constant-time comparison for `CRON_SECRET`
10. [Low] Stale, superseded `web/` app left in the repo with a weaker, separate auth system
11. [Informational] No explicit CSRF defense verification on state-changing JSON APIs
12. [Informational] Raw Supabase/Postgres error messages surfaced directly in API responses
13. [Informational] No CI pipeline for lint/typecheck/dependency-audit gating
14. Executive Summary & Prioritized To-Do List

---

### [Critical] – Unauthenticated referral endpoint allows free plan-tier escalation (reward fraud)

**Security Lapse:**
`app/src/app/api/referrals/record/route.ts` has **no session/authentication check at all**. It accepts a raw `{ referralCode, userId }` JSON body:

```ts
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { referralCode, userId } = body;
  if (!referralCode || !userId) { ...return early... }

  const supabase = createAdminClient();   // service-role client, bypasses RLS
  const { data: seller } = await supabase.from('sellers').select('id').eq('user_id', userId).maybeSingle();
  if (!seller) { ...return early... }

  await recordReferralSignup(referralCode, seller.id);
  ...
}
```

It looks up a `sellers` row by attacker-supplied `user_id` using the **service-role client** (bypasses RLS), and `recordReferralSignup()` (`src/lib/market-intel/referrals.ts:61-90`) inserts a `'joined'` row into `seller_referrals` and, once a referrer accumulates 3 "joined" rows, silently upgrades them from `free` → `paid`:

```ts
if (joinedCount >= REWARD_JOINS_FOR_PAID && referrer.plan_tier === 'free') {
  await supabase.from('sellers').update({ plan_tier: 'paid' }).eq('id', referrer.id);
}
```

`entitlements.ts` gates every premium feature (peer benchmarks, watchlists, product matching, pricing recommendations, forecasting, anomaly detection, multi-domain) purely on `plan_tier`, so this is a direct path to unlocking all of them for free.

Two compounding facts make this concretely exploitable, not just theoretical:

1. `seller_referrals` (`scraper/migrations/015_phase5_6.sql:28-36`) has **no unique constraint** on `joined_seller_id`, nor on `(referrer_seller_id, joined_seller_id)`. The same "join" event can be recorded an unlimited number of times.
2. The only guard is `referrer.id === newSellerId` (blocks literal self-referral by exact ID match). Nothing ties the call to the session that just signed up, and nothing prevents replay of the exact same request.

**Concrete exploit path:**
- Attacker has (or creates for free) a second seller account — call it Seller B — and their own referral code, `MYCODE`, attached to Seller A.
- Attacker signs up Seller B normally with `?ref=MYCODE`. The signup page fires:
  ```ts
  fetch('/api/referrals/record', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referralCode, userId: data.user.id }),
  }).catch(() => {});
  ```
- Attacker simply **replays this exact fetch call 2 more times** (from devtools console, curl, Postman — anything). Each call inserts another `'joined'` row for the same `(MYCODE, SellerB.id)` pair, since there's no uniqueness check.
- After the 3rd replay, `joinedCount >= 3` and Seller A is silently upgraded to `paid` — with exactly one real signup instead of three.
- No authentication, no rate limiting, and no anomaly detection would catch this today.

**Fix:**
1. Require the request to correspond to the caller's *own, just-created* session rather than trusting a client-supplied `userId`:
   ```ts
   const supabase = await createClient(); // cookie-bound client, not admin
   const { data: { user } } = await supabase.auth.getUser();
   if (!user || user.id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
   ```
   (Handle the "email confirmation pending, no session yet" case explicitly rather than skipping auth entirely — e.g. verify a short-lived signed token minted at signup time instead.)
2. Add a real idempotency guard at the database layer — this is the more important fix, since it closes the hole even if the auth check above is ever bypassed or misconfigured again later:
   ```sql
   alter table seller_referrals
     add constraint seller_referrals_unique_join unique (referral_code, joined_seller_id);
   ```
   ```ts
   const { error } = await supabase.from('seller_referrals').insert({...});
   if (error?.code === '23505') return; // already recorded — don't re-count, don't error
   ```
3. Rate-limit this endpoint (see Finding #7) and add logging/alerting on repeated calls with the same `userId`.
4. Add a regression test: calling `/api/referrals/record` twice with an identical payload must only ever count once toward `joinedCount`.

**Improvement (Top-competitor approach):**
Mature referral systems (Stripe's own partner/referral APIs, Dropbox's classic referral engine) treat "reward granted" as a ledger event with a strict idempotency key (referrer + referee pair) enforced at the database layer — never solely in application logic — and gate the reward behind a **verified** conversion event (first paid invoice, email-confirmed signup webhook) rather than a client-fired `fetch()` the browser can trivially replay. Given `013_seller_signup_trigger.sql` already uses a Postgres trigger (`SECURITY DEFINER`) for seller provisioning, the more robust long-term fix is moving referral crediting into a trigger fired from a verified event (e.g., `auth.users` email-confirmed transition) so there is no HTTP-reachable code path that can credit a referral at all.

---

### [High] – `BYPASS_AUTH` / `BYPASS_ENTITLEMENTS` flags collapse to full cross-tenant exposure if ever set in production

**Security Lapse:**
`src/middleware.ts:29-34`:
```ts
const AUTH_BYPASSED = process.env.BYPASS_AUTH === '1';
export default function middleware(request: NextRequest) {
  if (AUTH_BYPASSED) {
    return NextResponse.next();   // skips the sign-in redirect gate entirely
  }
  ...
}
```

`src/lib/supabase/server.ts:11-58`:
```ts
const AUTH_BYPASSED = process.env.BYPASS_AUTH === '1';

export async function isBypassedNoSession(): Promise<boolean> {
  if (!AUTH_BYPASSED) return false;
  const cookieStore = await cookies();
  return !cookieStore.getAll().some((c) => SUPABASE_AUTH_COOKIE.test(c.name));
}

export async function createClient() {
  if (await isBypassedNoSession()) {
    return createServiceRoleClient();   // bypasses RLS entirely
  }
  ...
}
```

`src/lib/market-intel/seller.ts:26-51`:
```ts
export async function getCurrentSeller(): Promise<Seller | null> {
  const supabase = await createClient();
  if (await isBypassedNoSession()) {
    const { data } = await supabase
      .from('sellers')
      .select('id, user_id, business_name, email, plan_tier, onboarded_at, reporting_currency')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    // ...treats the FIRST ROW IN THE ENTIRE sellers TABLE as "the current user"
  }
  ...
}
```

When `BYPASS_AUTH=1`:
- The middleware redirect gate is skipped entirely — protected routes render for anyone.
- `createClient()` returns a **service-role client**, which bypasses every RLS policy in the database.
- `getCurrentSeller()` resolves to **the single most-recently-created row in the `sellers` table**, and every route/page in `dashboard/`, `apps/`, and `onboarding/` (customers, orders, products, revenue, churn, referrals, reports, settings — everything) is served for that seller to **any anonymous visitor**, with zero session required.

`entitlements.ts:43` has the identical pattern for `BYPASS_ENTITLEMENTS=1`:
```ts
if (process.env.BYPASS_ENTITLEMENTS === '1') return true;  // unlocks every paid/premium feature
```

This is explicitly documented in code comments as a temporary, intentional dev-only escape hatch while real auth (Clerk) isn't wired up yet — which is a reasonable engineering decision *during active local development*. The risk is entirely about **production misconfiguration**: there is no code-level guard preventing this flag from being honored if it's ever accidentally set (or left set from a debugging session) in the deployed Vercel environment. A single environment-variable flip away from a full, silent, unauthenticated data breach across every seller's business data is the kind of incident that has taken down real companies (this is structurally identical to several public "debug flag left on in prod" breach post-mortems).

**Fix:**
1. Hard-fail the bypass outside local development, don't just document it:
   ```ts
   const AUTH_BYPASSED =
     process.env.BYPASS_AUTH === '1' && process.env.VERCEL_ENV !== 'production';
   ```
   Apply the identical guard to `BYPASS_ENTITLEMENTS`.
2. Add a deploy-time / CI check that fails the build if `BYPASS_AUTH` or `BYPASS_ENTITLEMENTS` are present at all in the production Vercel project's environment variables (not just checking their value — their mere presence in prod config is a smell).
3. Once real auth (Clerk, per the code comments) is wired up, delete this code path entirely rather than leaving it dormant. Escape hatches like this have a tendency to get re-enabled by accident months later by someone who doesn't have the original context.

**Improvement (Top-competitor approach):**
Feature flags with security implications (as used internally at Vercel, GitHub) are gated through a typed config layer that refuses to resolve "bypass enabled" when the deployment environment is production, usually enforced by a startup assertion that crashes the process immediately rather than degrading silently into an open door. Some teams go further and require the flag to be paired with a second, separately-stored "I am not production" attestation (e.g., a value only present in `.env.local`, never settable via the hosting provider's dashboard) so it structurally cannot be set the same way in prod as in dev.

---

### [High] – Password complexity policy is enforced only client-side

**Security Lapse:**
`src/lib/password.ts` defines real complexity rules:
```ts
export const PASSWORD_RULES: PasswordRule[] = [
  { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'uppercase', label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { key: 'lowercase', label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { key: 'number', label: 'One number', test: (p) => /[0-9]/.test(p) },
  { key: 'special', label: 'One special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];
```

This is only ever invoked from the `'use client'` form in `src/app/auth/signup/page.tsx:64` (`validatePassword(password)`). Account creation itself calls `supabase.auth.signUp()` **directly from the browser** against Supabase's public REST API using the anon key. There is no server-side re-validation anywhere in this codebase.

Anyone bypassing the React form — curl, a script, browser devtools, an automated credential-stuffing tool creating throwaway accounts — can register with a password meeting only Supabase's own default floor (6 characters, e.g. `"111111"`), fully defeating the intended policy. The code comment even acknowledges the prior state (`password.length < 6` letting `"111111"` through) as the exact bug this was meant to fix, but the fix only reaches the UI layer.

**Fix:**
1. Configure Supabase Auth's own password strength/length settings (Supabase Dashboard → Authentication → Policies) to match the app's intended minimum — this is the actual, non-bypassable enforcement boundary for anything calling the Supabase Auth API directly.
2. Additionally/alternatively, front `signUp()` with a server action or a route handler that runs `validatePassword()` server-side before ever calling Supabase, so the app doesn't depend solely on IdP-side configuration.

**Improvement (Top-competitor approach):**
Auth0, Clerk, and Supabase's own hosted password policies all enforce complexity at the identity-provider layer (server-side, non-bypassable), with the client-side widget purely as UX guidance/live feedback. Given the code comments indicate Clerk is the intended long-term auth provider, this will likely resolve itself in that migration — until then, the Supabase project-level policy setting is the one lever that actually matters.

---

### [Medium] – No HTTP security headers configured

**Security Lapse:**
`app/next.config.js` defines no `headers()` function at all:
```js
const nextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH,
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH,
  serverExternalPackages: ['pdfkit'],
  outputFileTracingIncludes: { ... },
  images: { domains: [...], unoptimized: true },
};
module.exports = nextConfig;
```

A repo-wide search found zero references to `Content-Security-Policy`, `Strict-Transport-Security`, or `X-Frame-Options` anywhere in the codebase. Vercel does not inject these by default. This leaves the app more exposed to:
- **Clickjacking** — no `X-Frame-Options`/`frame-ancestors`, so the login/dashboard could be framed by a malicious site.
- **MIME-sniffing attacks** — no `X-Content-Type-Options: nosniff`.
- No defense-in-depth CSP layer against any future XSS/injection bug.

**Fix:**
```js
// next.config.js
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'Content-Security-Policy', value: "default-src 'self'; img-src 'self' https: data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co https://api.groq.com" },
    ],
  }];
},
```
Roll the CSP out in `Content-Security-Policy-Report-Only` mode first against the Chakra/emotion inline-style usage before enforcing, to avoid breaking styling.

**Improvement (Top-competitor approach):**
Vercel's own security-headers guidance, and most production Next.js apps at scale, ship a strict CSP with per-request nonces for inline scripts rather than `'unsafe-inline'`. Consider `next-safe` or a nonce-based middleware once the header baseline above is in place and verified not to break the UI.

---

### [Medium] – No dependency lockfile for the main app; version ranges span a known Next.js CVE window

**Security Lapse:**
`app/.gitignore` explicitly ignores lockfiles:
```
package-lock.json
yarn.lock
```
Confirmed via `git ls-files` and a filesystem check: **no lockfile exists anywhere for this app**, on disk or in git history. This is the only app in the repo without one — `scraper/package-lock.json` is committed correctly.

Combined with wide-open caret ranges in `package.json`:
```json
"next": "^15.1.4",
"react": "^19.0.0-rc.1",
"react-dom": "^19.0.0-rc.1",
```
every fresh `npm install` can silently resolve a different dependency tree, with no record of which versions actually shipped to production. `^15.1.4` spans versions both before and after the fix for **CVE-2025-29927** (Next.js middleware authorization-bypass via a crafted `x-middleware-subrequest` header, fixed in 15.2.3+) — meaning a deployment could pick up a vulnerable Next.js version depending purely on install timing, with zero way to audit after the fact which one it was.

Impact of that specific CVE is meaningfully reduced here by the app's own defense-in-depth: `middleware.ts` is explicitly documented in its own comments as "a redirect-UX gate, not a security boundary," with real authorization enforced downstream via `getCurrentSeller()` + Postgres RLS. So this CVE would at most let an attacker skip the sign-in redirect UX, not bypass RLS/`seller_id` scoping. It's still a real gap worth closing on its own merits, and the missing lockfile is a broader supply-chain/reproducibility problem independent of this one CVE.

**Fix:**
1. Remove `package-lock.json`/`yarn.lock` from `.gitignore`, run `npm install`, and commit the resulting lockfile.
2. Pin `next` to an exact, patched version (`"next": "15.2.3"` or later at time of fixing — check for the current latest 15.x patch).
3. Move off the React 19 release-candidate tag (`19.0.0-rc.1`) to a stable release before shipping further; RCs don't receive the same patch/security cadence as stable releases.
4. Run `npm audit` as part of the fix and address anything flagged.

**Improvement (Top-competitor approach):**
Standard practice at any serious Next.js shop (including Vercel's own guidance): commit the lockfile, run Dependabot or Renovate for automated version-bump PRs, and gate merges on `npm audit --audit-level=high` in CI. None of that tooling exists in this repo's `.github/workflows/` today — only the two cron-trigger workflows are present (see Finding #13).

---

### [Medium] – Bulk-import endpoints accept unbounded arrays (resource exhaustion)

**Security Lapse:**
`src/app/api/products/bulk-import/route.ts`, `src/app/api/customers/bulk-import/route.ts`, and `src/app/api/orders/bulk-import/route.ts` all do:
```ts
const body = await request.json();
const rows: ImportRow[] = Array.isArray(body.rows) ? body.rows : [];
```
with **no cap on array length**, then pass the entire array straight into a single Supabase `.upsert(...)` call:
```ts
const { error } = await supabase.from('seller_products').upsert(
  valid.map((r) => ({ seller_id: seller.id, sku: r.sku, ... })),
  { onConflict: 'seller_id,sku' },
);
```

Any authenticated seller — even on the free tier, no special privilege needed — can submit an arbitrarily large JSON body (hundreds of thousands of synthetic rows) in a single request. This causes one very large upsert against Postgres in one call, potentially exhausting the serverless function's memory/execution time or the database's resources — a low-cost, authenticated denial-of-service / cost-amplification vector. Notably, `scraper/src/db.ts` already implements exactly the right pattern (`chunk()` + `UPSERT_BATCH_SIZE = 200`) elsewhere in this same repo — this fix pattern just wasn't applied to the user-facing bulk-import routes.

**Fix:**
```ts
const MAX_ROWS = 5000;
if (rows.length > MAX_ROWS) {
  return NextResponse.json(
    { succeeded: false, errors: [`Max ${MAX_ROWS} rows per import`] },
    { status: 400 },
  );
}
```
Also chunk the upsert itself (mirroring `scraper/src/db.ts`'s `UPSERT_BATCH_SIZE` pattern) rather than sending one massive array to Supabase in a single call, and consider setting an explicit request body size limit via Next.js route segment config.

**Improvement (Top-competitor approach):**
Shopify/QuickBooks-style bulk-import APIs cap request size (typically 1,000–10,000 rows per call) and route larger imports to an async job/queue with per-tenant throttling, rather than accepting unbounded synchronous payloads in a single HTTP request.

---

### [Medium] – In-memory rate limiter is ineffective on serverless; no rate limiting on real auth endpoints

**Security Lapse:**
`[web/ — legacy, not deployed]` `web/lib/utils/rate-limit.ts` (used only by the dead `web/app/api/market-intel/signup|waitlist` routes) implements `createRateLimiter()` as an in-process counter. On Vercel's serverless model, each invocation can land on a different, cold-started instance with its own memory — an in-process limiter provides little real protection against distributed brute-force/spam even where it is wired up.

More importantly, in the **live** app, actual signup/signin (`src/app/auth/signup/page.tsx`, presumably `src/app/auth/signin/page.tsx`) call `supabase.auth.signUp()` / `signInWithPassword()` **directly from the client**, with no app-level rate limiting or CAPTCHA layered on top anywhere in this codebase. The only protection today is whatever Supabase's own project-level auth rate limits provide by default.

**Fix:**
1. Confirm and tighten Supabase Auth's built-in rate limits (Supabase Dashboard → Authentication → Rate Limits) for sign-in, sign-up, and password-reset specifically.
2. For any endpoint that must rate-limit at the application layer (e.g. `/api/referrals/record` per Finding #1), use a shared store (Upstash Redis, Vercel KV) instead of in-process memory, so limits actually hold across serverless instances.
3. Consider adding a CAPTCHA (hCaptcha or Cloudflare Turnstile — both natively supported as a Supabase Auth option) on the signup and password-reset forms.

**Improvement (Top-competitor approach):**
Auth0/Clerk/Supabase all recommend edge-distributed rate limiting (Upstash Ratelimit is the common choice in the Vercel ecosystem) for anything that can't rely purely on the identity provider's own throttling, precisely because in-memory counters don't survive across serverless invocations.

---

### [Low] – Referral codes generated with `Math.random()`

**Security Lapse:**
`src/lib/market-intel/referrals.ts:5-7`:
```ts
function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
```
`Math.random()` is not cryptographically secure and is, in principle, seed-predictable. Referral codes aren't a secret in the traditional sense (they're meant to be shared for growth purposes), so direct impact is limited — but combined with the reward-fraud path in Finding #1, weak/predictable code generation lowers the bar for an attacker to target a specific high-value referrer's code without it being shared with them directly.

**Fix:**
```ts
import { randomBytes } from 'crypto';
function generateCode(): string {
  return randomBytes(6).toString('base64url').replace(/[^A-Z0-9]/gi, '').slice(0, 6).toUpperCase();
}
```

**Improvement (Top-competitor approach):**
Growth-engineering teams (e.g., Dropbox's referral system) generate codes with a CSPRNG and treat the code space as unguessable even though the codes are meant to be shared — precisely so the referral ledger can't be gamed via enumeration once any monetary or plan-tier reward is attached to it.

---

### [Low] – Non-constant-time comparison for `CRON_SECRET`

**Security Lapse:**
`src/lib/supabase/server.ts:43-48`:
```ts
export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization');
  return header === `Bearer ${secret}`;   // plain string equality
}
```
`[web/ — legacy, not deployed]` `web/app/api/cron/market-alerts/route.ts:57` has the identical pattern. Plain `===` comparison of secrets is a theoretical timing side-channel — a sufficiently precise, sustained network timing attack could in principle narrow down the secret character-by-character faster than brute force. Real-world exploitability is low given ordinary network jitter, but it is a one-line fix and standard practice for any shared-secret comparison.

**Fix:**
```ts
import { timingSafeEqual } from 'crypto';

function safeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function isAuthorizedCronRequest(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  return safeCompare(header, `Bearer ${secret}`);
}
```

**Improvement (Top-competitor approach):**
Webhook/shared-secret verification at Stripe, GitHub, etc. uses constant-time comparison (`crypto.timingSafeEqual`) or full HMAC-based request signatures rather than direct string equality, specifically to close this class of side channel.

---

### [Low] – Stale, superseded `web/` app left in the repository with a weaker, separate auth system

**Security Lapse:**
`[web/ — legacy, not deployed]` The root-level `web/` directory (`web/lib/auth/market-accounts.ts`) is a single-commit scaffold (`git log --oneline -- web/` shows exactly one commit: "Initial commit"), documented in `README.md` as pointing at an old, unrelated deployment, and is not part of the deployed app's build (no `package.json`/`next.config.js`/`tsconfig.json` ties it into anything). It implements its own **separate, custom bcrypt-based auth system**:
```ts
const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR); // BCRYPT_COST_FACTOR = 12
```
against a `market_accounts` table that has **no RLS enabled** — `scraper/migrations/002_redesign_market_accounts.sql` defines no `enable row level security` for it, unlike every table touched in `012_enable_seller_rls_policies.sql`.

Since `market_accounts` is only ever queried today with the service-role key (via `getAdminClient()`), practical current risk is low. But it's dead code that:
1. Increases audit/maintenance surface for anyone reviewing this repo going forward.
2. Could be accidentally revived or redeployed by a future contributor unaware it's stale (its API routes, forms, and auth logic all still fully compile and would function if pointed at the same Supabase project).
3. Stores password hashes in a table with no RLS as a safety net, should its access pattern ever change (e.g. if a future client-side query is ever added against it).

**Fix:**
- Delete the `web/` directory (or move it to a clearly-labeled `archive/` location outside the deployable tree) given the README's own note that it's superseded.
- If any part of its logic is still genuinely needed, migrate it onto the same Supabase Auth + RLS pattern the live app (`app`) already uses, rather than maintaining a second, parallel, weaker auth system indefinitely.

**Improvement (Top-competitor approach):**
Standard hygiene is to delete superseded scaffolding rather than leaving it in the main branch's working tree. If historical reference has value, a git tag or a separate archived branch preserves it without it being live in `main`, where it can be mistaken for current, in-use code by a new contributor or an automated security scanner.

---

### [Informational] – No explicit CSRF defense verification on state-changing JSON APIs

**Security Lapse:**
POST/PUT/DELETE route handlers (`watchlists/*`, `products/*`, `orders/*`, `customers/*`, `profile`, etc.) rely on the Supabase auth cookie set by `@supabase/ssr`. This is likely mitigated in practice by the default `SameSite=Lax` (or stricter) cookie attribute that Supabase's SSR helper sets, combined with the fact that these are JSON APIs requiring `Content-Type: application/json` — something a simple cross-site HTML `<form>` cannot set without triggering a CORS preflight that a same-origin-only API would reject. However, no explicit CSRF token or `Origin`/`Referer` check exists anywhere in the codebase, so this protection is currently implicit and unverified rather than deliberately tested.

**Fix:**
Add an explicit `Origin` header check on state-changing routes as defense-in-depth, and confirm (rather than assume) the actual `SameSite` value of the Supabase session cookie in the deployed environment:
```ts
const origin = request.headers.get('origin');
if (origin && new URL(origin).host !== request.nextUrl.host) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

**Improvement (Top-competitor approach):**
Most modern SPA/JSON-API stacks (including Supabase's own guidance) lean on `SameSite=Lax`/`Strict` cookies plus custom-header/content-type requirements as sufficient CSRF defense, instead of classic synchronizer tokens. This app already follows that pattern implicitly — the improvement here is making the assumption explicit and covered by a test, rather than incidental.

---

### [Informational] – Raw Supabase/Postgres error messages surfaced directly in API responses

**Security Lapse:**
Many routes (e.g. `customers/[id]/route.ts:56`, `orders/[id]/route.ts:54`) return `error.message` from the Supabase client directly to the caller:
```ts
if (error) {
  return NextResponse.json(
    { succeeded: false, data: null, errors: [error.message], message: 'Failed to update customer' },
    { status: 400 },
  );
}
```
Postgres/PostgREST error text can occasionally include internal detail (constraint names, column names, table structure hints) that aids an attacker's reconnaissance, though no secrets or data are exposed this way.

**Fix:**
Log the detailed error server-side (`console.error(...)`) and return a generic message to the client; only include the raw message in non-production environments, e.g.:
```ts
console.error('[api/customers/:id PUT]', error);
return NextResponse.json(
  { succeeded: false, errors: [process.env.NODE_ENV === 'production' ? 'Update failed' : error.message] },
  { status: 400 },
);
```

**Improvement (Top-competitor approach):**
Structured error handling (Sentry/Datadog capturing the full error server-side, generic client-facing messages) is standard in production SaaS APIs. Several routes in this same codebase already do this correctly (`api/market-intel/signup`, `api/market-intel/waitlist` in the legacy `web/` app both log then return a generic message) — the pattern just isn't applied consistently across the live app's routes.

---

### [Informational] – No CI pipeline for lint/typecheck/dependency-audit gating

**Security Lapse:**
`.github/workflows/` contains exactly two workflows, both purely cron triggers that `curl` the deployed app's `/api/cron/*` endpoints (`market-intel-cron.yml`, `market-scraper.yml`). There is no CI workflow that runs `npm run lint`, `tsc --noEmit`, `npm audit`, or a build check on pull requests. This isn't a vulnerability in itself, but it means nothing currently gates a PR that introduces a regression (including any of the findings above, if reintroduced) before it merges.

**Fix:**
Add a basic CI workflow:
```yaml
name: CI
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: app
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v6
        with: { node-version: "20" }
      - run: npm install
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm audit --audit-level=high
```

**Improvement (Top-competitor approach):**
Any team running Next.js in production at scale (Vercel's own guidance included) gates merges on lint + typecheck + `npm audit` at minimum, often with Dependabot/Renovate feeding automated dependency-update PRs through the same gate.

---

## Executive Summary

**Overall risk rating: Medium-High.** This is driven primarily by one concretely exploitable business-logic flaw (Finding #1) and one high-impact-if-misconfigured environment flag (Finding #2). Outside of those two, the codebase shows genuinely good security hygiene for its stage: consistent `seller_id`-scoped queries layered on top of real Postgres Row-Level Security (defense in depth, not RLS-or-nothing), no secrets committed to git anywhere in the repo, fully parameterized Supabase queries (no SQL injection found in either the web app or the scraper), CI secrets handled correctly via GitHub Actions secrets (never hardcoded), and thoughtful, well-commented handling of a genuinely tricky in-progress auth migration (Supabase Auth today, Clerk planned).

No secrets-in-code, SQL injection, XSS (React's default escaping holds throughout — no `dangerouslySetInnerHTML` or `eval` usage found anywhere in the repo), or SSRF issues were found during this review.

### Prioritized To-Do List

Work through these in order — the first two are the only findings with realistic, low-effort exploitation paths against real user/business data today:

- [ ] **1. Fix `/api/referrals/record`** (Critical) — add real session verification instead of trusting the client-supplied `userId`, and add a `unique (referral_code, joined_seller_id)` constraint on `seller_referrals` so the same join can never be counted twice. This is exploitable today with nothing more than a browser devtools console.
- [ ] **2. Guard `BYPASS_AUTH` / `BYPASS_ENTITLEMENTS`** (High) — make both flags refuse to activate when `VERCEL_ENV === 'production'`, and add a deploy-time check that these variables are simply absent from the production environment config. Until Clerk is wired up, treat this as the single highest-blast-radius risk in the app.
- [ ] **3. Move password complexity enforcement server-side** (High) — set Supabase Auth's project-level password policy to match `src/lib/password.ts`'s rules; the client-side check alone does nothing against direct API calls.
- [ ] **4. Add HTTP security headers** (Medium) — CSP (start in report-only mode), HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, via `next.config.js`.
- [ ] **5. Commit a lockfile for `app`** (Medium) — remove `package-lock.json`/`yarn.lock` from its `.gitignore`, commit the generated lockfile, and pin `next` to a version ≥ 15.2.3 (past CVE-2025-29927). Move off the React 19 RC to a stable release.
- [ ] **6. Cap row counts on bulk-import endpoints** (Medium) — products, customers, and orders bulk-import routes; mirror the chunking pattern `scraper/src/db.ts` already uses.
- [ ] **7. Move rate limiting to a shared store** (Medium) — Upstash Redis or Vercel KV instead of in-process memory; add CAPTCHA to signup/password-reset.
- [ ] **8. Swap `Math.random()` for `crypto.randomBytes()`** in referral code generation (Low).
- [ ] **9. Use `crypto.timingSafeEqual`** for the `CRON_SECRET` comparison (Low).
- [ ] **10. Delete (or clearly archive) the legacy `web/` directory** (Low) — it duplicates auth logic with weaker guarantees (no RLS on `market_accounts`) and isn't part of the deployed app.
- [ ] **11. Add an explicit `Origin` header check** on state-changing routes as CSRF defense-in-depth (Informational).
- [ ] **12. Stop returning raw Supabase error messages** to clients in production (Informational).
- [ ] **13. Add a CI workflow** for lint/typecheck/`npm audit` gating on pull requests (Informational).

---

*This document was generated by a manual source-code security review. No dynamic/live penetration testing was performed against the deployed application. Treat every finding above as requiring a fix-and-verify cycle (patch → write/run a regression test → confirm the specific exploit path described is closed) rather than a fix-and-assume cycle.*
