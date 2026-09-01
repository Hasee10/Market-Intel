# Ryvl Frontend Migration Plan (2026-09-01)

**Status as of this writing: the new template has NOT been attached to
the repo yet.** This document is preparation for when it arrives, written
so a fresh Claude session with zero prior context can pick this up
correctly. Read this, `FEATURES.md`, and `ASSETS.md` before touching
anything once the template lands.

## The goal, stated precisely

Adopt the new template's **visual design/UI** while keeping Ryvl's real
**features** (cataloged in `FEATURES.md`) and real **brand assets**
(cataloged in `ASSETS.md`). Strip whatever the new template brings that
Ryvl doesn't need - its own demo content, placeholder data, unrelated
boilerplate pages. This is a UI/component-layer swap grafted onto real
functionality, not a from-scratch rebuild and not a pure reskin either.

**The user has explicitly said**: "we won't touch the backend." Read that
as scoping intent, not a literal technical constraint - see the framework
question below, since if the new template turns out to be a genuinely
different stack (not Next.js), "not touching the backend" may still
require *moving* it, just not *redesigning* it.

## The open question that must be answered first: what is "React" here?

The user said "new template is in react so we might have a major
rehaul." This repo's current app (`horizon-ui-chakra-nextjs-main`) is
also React - it's Next.js 15 App Router, which is React underneath. So
"the new template is in React" most likely means it is **not** Next.js -
otherwise there'd be nothing notable to flag. Do not assume which,
**check the new template's own `package.json` and folder structure the
moment it's provided**, before deciding an approach:

- **If it's Vite + React (or CRA, or similar client-only React)**: no
  server components, no file-based API routes, no built-in SSR. This is
  the "major overhaul" case the user is anticipating. The 41 API routes,
  5 cron jobs, and every `'server-only'` lib module in `FEATURES.md` Part
  3/9 have no direct home in a client-only React app - they'd need to
  either (a) stay exactly where they are in the current Next.js app,
  repurposed as a pure backend/API service the new client-only frontend
  calls over HTTP, or (b) be ported into whatever backend the new
  template expects (Express? none at all - static hosting?). **(a) is
  almost certainly the right call** - the backend is proven, tested (196
  passing tests), and the user's own words ("we won't touch the backend")
  point this direction. Don't rebuild working server logic to fit a
  template's assumptions; adapt the template to call the existing API
  instead.
- **If it's another Next.js app** (a different template built on Next.js,
  just not Chakra): this is the easier case - closer to a true UI-layer
  swap. The existing `src/app/api/**` routes, `src/lib/**` server logic,
  and Supabase auth/session handling can likely stay closer to as-is;
  the work is mostly porting page/component markup and swapping the
  component library (Chakra out, whatever the new template uses in).
- **If it's Remix, or something else entirely**: stop and ask the user
  before proceeding - the two cases above cover the likely options, a
  third framework changes this plan's assumptions enough to need a fresh
  pass, not a guess.

**First real action once the template is provided, before writing any
code**: read its `package.json`, its routing setup, and its top-level
folder structure, and use that to determine which of the above cases
applies. State the conclusion back to the user before starting the port -
this is a large enough architectural fork that it shouldn't be assumed
silently.

## Process, once the framework question is settled

1. **Inventory the new template itself** the same way `FEATURES.md` and
   `ASSETS.md` inventoried the current app: every page/route it ships,
   every component, its own design tokens (colors/type/spacing), its own
   asset folder, its dependencies. Don't start porting before knowing
   what's actually there.

2. **Strip the template's own unnecessary content first**, mirroring the
   dead-asset-detection method used in `ASSETS.md` (grep for real
   reachability, don't assume from folder names) - most templates ship
   demo pages, sample data, and placeholder marketing copy that has
   nothing to do with Ryvl. Confirm each removal doesn't break the
   template's own build before moving on.

3. **Map every item in `FEATURES.md` to a page/route in the new
   template.** For each of the 13 dashboard pages + auth pages +
   onboarding: does the new template have an equivalent page shape to
   adapt, or does one need to be composed from its component library?
   Treat `FEATURES.md`'s page-by-page breakdown as the acceptance
   checklist - every bullet under a page needs a home in the rebuilt
   version, not just "the page exists."

4. **Port real assets from `ASSETS.md`**: the 6 branded illustrations
   (source vector files are in `ryvl-hero-assets/` and `Page_Assets/` at
   repo root - use those, not the flattened `public/` copies, if the new
   template needs different sizes or any edits), the `RyvlMark.tsx` brand
   SVG (exact path data), Inter + Merriweather fonts, and reconcile the
   brand-indigo drift noted in `ASSETS.md` Section 0
   (`#422AFB` theme token vs. the real `#4318FF`) - pick one deliberately
   for the new template rather than carrying the inconsistency forward.

5. **Wire real data into the new template's UI.** Once a page's markup/
   components exist in the new template, connect them to the real API
   routes (`FEATURES.md` Part 3) instead of any sample/mock data the
   template shipped with. This is where "we won't touch the backend"
   pays off - the API contracts are already documented and already
   tested.

6. **Verify page-by-page against `FEATURES.md`**, not just visually.
   Every button, table column, drawer, empty state, and gated section
   listed there needs to actually be present and working, not just
   "looks similar to the screenshot." This project's own established
   discipline (confirmed repeatedly in `memory.md`) is: one page at a
   time, `tsc`/tests/lint clean, commit, push, then the next page - keep
   that rhythm for this migration too, don't attempt it as one giant
   commit.

## What NOT to do

- Don't guess at the framework question above and start porting before
  confirming it - it's the single decision every subsequent step depends
  on.
- Don't silently drop a feature from `FEATURES.md` because the new
  template's default component library doesn't have an obvious
  equivalent - flag it and ask, don't decide alone that it wasn't
  important.
- Don't touch `src/lib/reports/**` (PDF/PPTX export) - explicitly
  off-limits per earlier instruction this session, still applies.
- Don't restart the incremental Chakra-theme-token revamp approach from
  earlier this session (see `memory.md`'s "UI/UX revamp attempt" entry) -
  that whole direction was superseded by "adopt the new template's UI,"
  not paused.

## Reference documents, read in this order

1. `MIGRATION_PLAN.md` (this file) - the strategy
2. `FEATURES.md` - the complete behavior checklist
3. `ASSETS.md` - the complete visual-asset checklist (brand palette,
   source design files, fonts, icons, and confirmed-dead template cruft
   from the *current* app - the *new* template will need its own dead-asset
   pass, per step 2 above)
4. `memory.md` - full session history; read at least the top status
   pointer and the "UI/UX revamp attempt" + "FEATURES.md verification"
   entries before starting
