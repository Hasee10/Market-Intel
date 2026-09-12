# agency.ai-landing-page-master — Audit & Remap Plan (2026-09-01)

**Documentation only, per instruction. Nothing in this template or the
rest of the repo was modified while producing this document.** A new
Claude session will do the actual implementation - read this file,
`MIGRATION_PLAN.md`, `FEATURES.md`, and `ASSETS.md` first, in that order.

## What this template actually is

Confirmed by reading every file in `agency.ai-landing-page-master/src/`:
**Vite + React 19 + Tailwind CSS 4 + Framer Motion**, a single-page
**agency/freelancer marketing site** template - Navbar, Hero, TrustedBy
(logo strip), Services (4 cards), OurWork (portfolio grid), Teams (staff
grid), ContactUs (form), Footer. No routing library, no dashboard
primitives (no sidebar, no data table, no drawer, no auth pages, no
charts). This is **not** a dashboard template - see `MIGRATION_PLAN.md`
for how the actual dashboard rebuild is a separate, not-yet-started
question the user is sourcing separately.

**User's direction for this specific template**: adopt its UI/visual
design and motion language, replace its content with Ryvl's real
positioning (from `FEATURES.md`/the current marketing site), and strip
what's unnecessary. Goal stated explicitly: "the enterprise and
professional website."

## Must remove — not a style opinion, a real problem

These aren't generic-content issues, they're things that would be actively
wrong to ship as-is:

1. **`Teams.jsx` + `assets.js`'s `teamData`**: 8 entries with **real
   people's actual names and real photo URLs** (GitHub avatars, a LinkedIn
   CDN photo, `randomuser.me` portraits) - "MD Amdad Islam" (matches the
   template's own footer credit "Developed By Amdad Islam" - this is the
   template author's real info, not placeholder data), "Zahidul Islam
   Mahim," "LITAN MOLLA," and others. **Shipping this as Ryvl's team page
   would misrepresent real strangers as Ryvl employees.** Remove the
   section entirely or replace every entry with Ryvl's actual team -
   never keep these names/photos.
2. **`TrustedBy.jsx` + `assets.js`'s `company_logos`**: Microsoft, Zoom,
   Rakuten, Coinbase, Airbnb, Google logos, captioned "Trusted by Leading
   Companies." **These are not Ryvl customers.** Using real, recognizable
   brand logos to imply endorsement Ryvl doesn't have is a false-claim
   risk, not just an inaccuracy. Remove until there are real, permission-
   cleared logos to show, or replace with a different kind of social proof
   Ryvl actually has (e.g. the real marketplace-coverage count, or
   nothing at all for now).
3. **`ContactUs.jsx` has a hardcoded third-party API key**:
   `formData.append("access_key", "2738e7c3-8bc9-46d4-acac-071c74d03fa6")`
   posting to `https://api.web3forms.com/submit` - this is the original
   template author's own Web3Forms account. Any submission through this
   form today would go to a stranger's inbox, not Ryvl's. Must be replaced
   with Ryvl's own form-handling endpoint (or removed if contact isn't a
   marketing-site feature Ryvl wants) before this ever goes live.
4. **Footer credit**: `"Developed By Amdad Islam"` linking to
   `amdadislam.netlify.app`, plus `"Copyright 2025 © agency.ai"`. Remove
   both.
5. **Dead commented-out code** at the bottom of `Footer.jsx` (lines
   106-134) - an entire alternate footer version left as a JSX comment,
   referencing "PrebuiltUI" and Lorem Ipsum text. Delete, don't carry
   forward - it's not a "keep for reference" case, it's leftover noise
   from whatever template *this* template was itself built from.
6. **Generic social icons** (Facebook/Twitter/Instagram/LinkedIn in the
   footer) pointing nowhere real - either wire to Ryvl's actual accounts
   or remove.

## Generic filler content — needs Ryvl's real copy, not a style fix

Every service/work card uses the *same* templated sentence with only the
tail truncated differently: "We turn bold ideas into powerful digital
solutions that connect, engage..." repeated near-verbatim across all 7
service/work cards. This is placeholder copy, not written content -
replace per the remap below, don't try to lightly edit it.

## Extra/structural things worth a deliberate decision, not a default keep

- **Custom cursor** (`App.jsx`'s ring+dot that follows the mouse,
  `cursor: none` set globally in `index.css`): a creative-agency/portfolio
  flourish. Consider dropping for the "enterprise, professional" goal -
  custom cursors read as trendy/playful, which cuts against that
  positioning. Flag for a decision, don't assume either way.
- **Font**: Manrope (weights 200-800, loaded via Google Fonts `@import`
  URL, not self-hosted). Ryvl's real fonts are Inter (app-wide) and
  Merriweather (marketing headlines only) - self-hosted via
  `next/font/google`, see `ASSETS.md` Section 4. Decide whether to bring
  Manrope along as a fresh choice or switch to Ryvl's existing fonts for
  consistency with the dashboard (which is staying as-is for now per
  `MIGRATION_PLAN.md`).
- **Primary color** `--color-primary: #5044E5` (Tailwind `@theme` token,
  `index.css`) - a purple/indigo already reasonably close to Ryvl's real
  brand indigo `#4318FF` (see `ASSETS.md` Section 0), but not identical.
  Reconcile deliberately rather than keeping either value by accident.
- **"Teams" and "OurWork" sections structurally** - even once cleaned of
  the real-people/fake-portfolio content, ask whether Ryvl's marketing
  site wants a team-showcase section and a portfolio-grid section at all.
  Ryvl's current site doesn't have either (see its actual section list
  below) - these may be sections to drop structurally, not just re-fill
  with Ryvl content.

## Section-by-section remap, grounded in Ryvl's real, already-written copy

Ryvl's current marketing site (`horizon-ui-chakra-nextjs-main/src/components/landing/`)
already has: `AnnouncementBar`, `LandingHeader`, `LandingHero`,
`CompanyLogoSlider`, `MarketplaceLogoSlider`, `StatsBar`,
`FeaturesSection`, `ComparisonSection`, `TrustSection`,
`HowItWorksSection`, `PricingSection`, `CTABanner`, `LandingFooter`,
`AssistantWidget`. Use this as the real content source, not invented
copy - the point of adopting a new template is a visual upgrade, not a
rewrite of positioning that's already been decided.

| Template section | Ryvl replacement | Real content to use |
|---|---|---|
| `Navbar` | Same slot, Ryvl nav | Ryvl logo (`RyvlMark.tsx`/`ASSETS.md`), real nav items (Features/Pricing/How it works, or mirror `routes.tsx`'s public pages), real CTA ("Start free" → sign-up, matching `LandingHero.tsx`'s actual button) |
| `Hero` | Same slot | Confirmed real headline already in code: **"See your market. Not just your store."** + subhead: *"Ryvl tracks competitor pricing across {N} marketplaces, benchmarks you against anonymized peers in your category, and tells you when to act — pricing recommendations, stock-out signals, and price alerts included."* Badge: "For online sellers." Buttons: "Start free" / "See how it works." (`LandingHero.tsx:85-108`) - use verbatim, don't rewrite. |
| `TrustedBy` | `CompanyLogoSlider`/`MarketplaceLogoSlider`'s real content | Real tracked-marketplace logos (the actual scraped platforms - Daraz etc., not fake Microsoft/Google), not fabricated client logos |
| `Services` (4 cards - template has 4, Ryvl's real list has 6, see note) | Core capabilities, not agency services | **`FeaturesSection.tsx` (`horizon-ui-chakra-nextjs-main/src/components/landing/FeaturesSection.tsx:28-64`) already has exactly this content, verbatim, 6 entries: "Live competitor tracking" / "Peer benchmarking" / "Watchlists & price alerts" / "Churn & retention insights" / "Orders, products, customers" / "Pricing recommendations", each with a real one-line description already written (e.g. "A rule-based recommendation that keeps you inside the competitive band without dropping below your own margin floor"). Use these verbatim - do not paraphrase or invent new copy. The template's grid is 4 cards; either expand `ServicesCard`'s grid to fit 6, or pick the 4 most representative and note the other 2 need a different home (e.g. folded into `HowItWorksSection`'s remap, or the section becomes a 6-item grid instead of 4). This is a layout decision for the implementing session, not a content one - the content itself is already decided.** |
| `OurWork` | Either drop, or repurpose as a **product-screenshot/how-it-works section** | If kept: real dashboard screenshots (once the actual dashboard UI exists) or `HowItWorksSection.tsx`'s real steps - not fake "mobile app marketing" portfolio pieces |
| `Teams` | Drop, or replace with real Ryvl people if/when the user wants a team section | Do not fill with placeholder or found-online photos under any circumstance (see "must remove" above) |
| `ContactUs` | Keep the form pattern, real backend | Needs Ryvl's own form-submission endpoint (or drop the section if Ryvl's real site doesn't have a contact form - check `LandingFooter.tsx`/existing pages for whether one already exists) |
| `Footer` | `LandingFooter.tsx`'s real content | Real nav links, real copyright, no fake developer credit, real (or no) social links |

## What was NOT done, per explicit instruction

Nothing was implemented - no file in `agency.ai-landing-page-master/` or
anywhere else was modified while producing this document. The actual
port (stripping the must-remove items, writing the remap, deciding the
open questions flagged above) is deferred to the next session, done
"then on only" per the user's own words.

## Open questions for the user before implementation starts

1. Custom cursor: keep, or drop for the enterprise-professional goal?
2. Manrope vs. Ryvl's existing Inter/Merriweather?
3. Exact primary color: `#5044E5` (template default), `#4318FF` (real
   Ryvl brand indigo), or `#422AFB` (the live app's drifted theme token)?
4. Keep `Teams`/`OurWork` as sections at all (restructured with real
   content), or drop them structurally since Ryvl's current site doesn't
   have equivalents?
5. Does Ryvl want a contact form on the marketing site at all, and if so,
   what should it submit to?
6. Confirmed separately in `MIGRATION_PLAN.md`: is this template only for
   the public marketing site, or will the (separately-sourced) dashboard
   template also need to match this visual language? User said they'll
   clarify once the dashboard template is gathered.
