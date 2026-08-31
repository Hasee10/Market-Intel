# Ryvl Roadmap: Robustness & New Features

Grounded in a full-stack production-readiness audit (auth/RLS, rate limiting,
error tracking, caching, CI/CD, security, availability) plus a review of the
current feature set. Split into hardening existing features vs. extending
the platform, each prioritized.

## Part 1 — Make the current platform more robust

### P0 — silent-failure and security-relevant gaps

1. **Rate limiting is effectively fake in production.**
   `horizon-ui-chakra-nextjs-main/src/lib/rate-limit.ts` is an in-memory Map,
   and the code's own comment already admits it: Vercel runs many serverless
   instances that don't share memory, so the limiter resets per cold
   start/instance. Right now it's giving false confidence on `api/assistant`
   and `api/assistant/seller` - the two AI-cost-bearing routes, which is
   exactly where you don't want it silently not working. Fix: Upstash Redis
   or Vercel KV, sliding-window, ~1-2 hours of work.

2. **Zero error tracking.** No Sentry, no structured logging - just 6 files
   with scattered `console.error`. If something breaks for a real seller
   right now, you find out only if they email you. Sentry's free tier is a
   same-day integration and the highest signal-per-hour item on this whole
   list.

3. **No timeout or retry on the Groq AI calls.**
   `horizon-ui-chakra-nextjs-main/src/lib/ai/groq-client.ts` does a plain
   `fetch()` with no `AbortController`. If Groq hangs instead of erroring,
   the request hangs with it. Add a 10-15s timeout + one retry.

4. **`DEMO_ALL_FEATURES_UNLOCKED = true`** in
   `horizon-ui-chakra-nextjs-main/src/lib/market-intel/entitlements.ts`
   bypasses all 3 tiers / 8 gated features. Fine for now if this is
   intentionally pre-launch, but it's a landmine if forgotten - flagging so
   it's a deliberate decision, not a surprise later.

5. **No schema validation on API routes.** POST bodies (`api/customers`,
   bulk-import routes, `api/assistant*`) get manual `typeof` checks instead
   of a real schema (zod). Low urgency for security since Supabase
   parameterizes queries, but it's the difference between a clear 400 error
   and a confusing 500 the moment a malformed CSV row or client bug slips
   through.

### P1 — real, but not urgent

6. **No caching on expensive repeated queries**
   (`market_scope_price_baseline`, category benchmarks) - every dashboard
   load recomputes from scratch. A short-TTL cache would cut load time and
   DB cost as seller count grows.

7. **No retry on Supabase calls** - a transient network blip currently
   surfaces straight to the user as an error instead of retrying once.

8. **CSP is deliberately deferred** (documented in `next.config.js` -
   Chakra/Emotion need `unsafe-inline`, and a weak CSP was judged worse than
   none). This is the right call already made; a nonce-based CSP is a real
   but separate project if wanted later.

9. ~~Verify the watchlist price-alert cron is actually scheduled.~~
   **Resolved 2026-08-30 - this was a false alarm on my part.** The cron is
   scheduled, just not where I first looked: `.github/workflows/market-intel-cron.yml`
   POSTs to `/api/cron/price-alerts` every 6 hours, alongside daily
   benchmarks, low-stock, churn/RFM and FX-rate jobs. I had searched for a
   `vercel.json` and concluded absence rather than checking every workflow.
   Reviews are likewise scheduled, via `.github/workflows/review-scraper.yml`
   (daily, PriceOye).

## Part 2 — Features worth building

Ranked by how much they leverage what's already built vs. requiring new
infrastructure.

### Near-zero new infrastructure - finishing what's half-built

1. **Real email delivery for alerts.** `sendEmailStub` in
   `horizon-ui-chakra-nextjs-main/src/lib/notifications/notify.ts` is a
   deliberate no-op. The entire alert pipeline (price alerts, stock flips,
   anomaly detection) already works end-to-end except the last mile - the
   seller never actually gets notified outside the app. Wiring Resend or
   similar is probably the single highest-value item here: a small
   integration that unlocks value from everything already shipped.

2. **Scheduled report digests.** The PDF/PPTX report pipeline
   (`horizon-ui-chakra-nextjs-main/src/lib/reports/`) already exists and
   works - it's currently click-to-download only. A weekly auto-generated +
   emailed digest needs zero new report logic, just a cron + the email
   integration from #1.

3. **Anomaly-triggered pricing suggestions.**
   `horizon-ui-chakra-nextjs-main/src/lib/market-intel/pricing-recommendation.ts`
   is rule-based and separate from the anomaly detectors in `anomalies.ts`.
   Wiring a confirmed competitor-price anomaly to auto-surface a pricing
   suggestion closes the loop from "something changed" to "here's what to do
   about it" - the seller currently has to notice and act manually.

### Moderate new work, high relevance to the target audience (non-technical retailers)

4. **WhatsApp as an alert channel**, not just email - for Pakistan-based
   retail sellers this is likely more reliable reach than email. Same
   pipeline as #1, different delivery adapter (e.g. Twilio/WhatsApp Business
   API).

5. **Mobile responsiveness audit / lightweight PWA.** Given the target
   audience checks in on the go, this may matter more than desktop-only
   polish. Worth a dedicated pass rather than assuming Chakra's responsive
   defaults are sufficient.

### Bigger, monetization-shaped

6. **Actual billing (Stripe).** The entitlements model (3 tiers, 8 gated
   features) is fully built but has nothing behind it - no checkout, no
   webhook to flip a seller's plan. This is the biggest single missing piece
   if the goal is to actually charge sellers rather than stay in demo mode.

7. **Multi-user / staff logins per seller account** - larger sellers likely
   want employees with limited access rather than sharing one login.

## Suggested sequencing

P0 robustness items 1-3 first (each under a day, each closes a real gap),
then feature #1 (real email) since it's the cheapest way to make everything
else in this platform actually reach a seller, then billing once ready to
charge. Everything else can wait.
