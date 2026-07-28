# Market Intel — archived out of JobLo

This is a snapshot of everything built for Market Intel (Pakistani e-commerce
price/catalog tracking), extracted out of the `job-portal` repo on 2026-07-27
so it can become its own product instead of a feature bolted onto JobLo.

**Who it's for**: e-commerce sellers, not generic "market analysts" — the
whole point of scraping priceoye/telemart/shophive/ishopping/goto/
sapphireonline/OLX was to give sellers competitive pricing/catalog
intelligence on what else is out there. This should drive framing, copy, and
feature priority in the eventual standalone build (e.g. price-position
alerts and competitor tracking matter more than generic market reporting).
The existing account/role naming (`market_analyst`, `market_accounts`) predates
this clarification and doesn't reflect it — worth renaming when this becomes
a real standalone app rather than carrying it forward as-is.

**This does not run as-is.** It's an archive of source files, not a scaffolded
standalone app — see "What's missing to run standalone" below.

## What's here

- `scraper/` — the entire scraper package, unchanged, fully self-contained
  (own `package.json`, own Supabase tables `market_*`/`market_accounts`, own
  migrations `migrations/001-010`, own GitHub Actions workflow). This part
  already ran independently of the job-portal app even before the extraction.
- `web/app/intel/` — Next.js pages: landing (`page.tsx`), dashboard, sign-in,
  sign-up, product detail (`products/[id]/page.tsx`).
- `web/app/api/market-intel/` — waitlist, signup, watchlist API routes.
- `web/app/api/cron/market-alerts/` — price-alert cron endpoint.
- `web/components/market-intel/` — dashboard table, price history chart,
  watch button, similar-items rail, cross-platform matches, product gallery,
  waitlist form.
- `web/components/auth/MarketIntelSignInForm.tsx`,
  `MarketIntelSignUpForm.tsx` — account forms.
- `web/components/home/MarketIntelBanner.tsx` — homepage cross-promo banner
  (was rendered on JobLo's homepage; not relevant if Market Intel has its own
  homepage instead).
- `web/lib/market-intel/` — `products.ts` (listing/detail/history/similar/
  cross-platform-match queries), `watchlist.ts`, `waitlist-actions.ts`.
- `web/lib/auth/market-accounts.ts` — market analyst account creation/login
  (bcrypt, own `market_accounts` Supabase table).
- `workflows/market-scraper.yml`, `workflows/market-alerts-cron.yml` — the
  two GitHub Actions workflows that ran this feature on a schedule. Paths
  inside them were updated to `market-intel/scraper` to match this archive's
  layout, but they are **not active** — GitHub only runs workflows physically
  located at `.github/workflows/` of a repo, and `market-alerts-cron.yml`'s
  `PORTAL_URL` still points at the old JobLo Vercel deployment, which no
  longer serves `/api/cron/market-alerts`.
- `overview.md`, `research.md` — the original product/build planning docs
  (unedited).

## What's missing to run standalone

None of this shares code with JobLo anymore (that link has been fully
severed on the JobLo side — see below), but it still assumes JobLo's runtime
scaffolding was there to lean on. To actually deploy this as its own app,
you'd need to supply:

- A NextAuth (or equivalent) setup — the account/session logic that used to
  live in JobLo's `auth.ts` (Credentials provider branch for
  `market_analyst`, JWT/session role wiring) was removed from JobLo, not
  copied here as a working auth.ts. `web/lib/auth/market-accounts.ts` (the
  credential verification logic) is here, but the NextAuth config that called
  it is not.
- Its own `package.json`, `next.config`, Tailwind/`globals.css`, and shared
  UI primitives (buttons, layout shell, nav) — this archive only has the
  feature-specific route/component/lib files, not a scaffolded app around
  them.
- Its own Supabase client bootstrap per file (each lib file here defines its
  own `getAdminClient()` reading `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` —
  no shared client file was pulled in, none was needed).
- Decisions flagged as still open in `overview.md` (product naming/branding,
  whether it's a JobLo sub-brand or fully separate identity, its own landing
  page vs. a chooser flow).

## Database

Still lives in the **same Supabase project** as JobLo, in tables prefixed
`market_` plus `market_accounts` — these were always isolated by naming, not
by a separate database, and moving them wasn't part of this extraction. If
Market Intel becomes a genuinely separate deployment, decide then whether it
needs its own Supabase project or can keep sharing this one.

## What changed on the JobLo side

All of the above was deleted from `bordful-main/`, along with every
reference to it: the `market_analyst` role branch in `auth.ts` and
`types/next-auth.d.ts`, the nav/footer links in `config/config.example.ts`,
the homepage banner render in `app/page.tsx`, the account-menu redirect in
`AuthNavStatus.tsx`, and the two-tier product chooser in `JoinChooser.tsx`
(collapsed back to a single-step job-seeker/recruiter/employer chooser, since
there's only one product left). `bordful-main` type-checks clean with none of
this present.
