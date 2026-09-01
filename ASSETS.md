# Ryvl Design Assets Inventory (2026-09-01)

Companion to `FEATURES.md`. `FEATURES.md` covers *behavior*; this covers
everything visual - images, icons, fonts - so none of it gets lost when
the frontend is rebuilt. All paths relative to
`horizon-ui-chakra-nextjs-main/`.

Verified against the actual codebase, not assumed: every asset below was
confirmed either genuinely used (grepped for real import/reference sites)
or genuinely dead (confirmed unreachable from any real route) before
being listed as one or the other.

---

## 1. Real, in-use image assets

| File | Used in | Purpose |
|---|---|---|
| `public/assets/ryvl-hero-illustration-vector.svg` (+ `.png` variant, `-vector.png`) | Marketing hero (`src/components/landing/LandingHero.tsx`) | Homepage hero illustration |
| `public/assets/ryvl-dashboard-illustration.png` | Marketing site (dashboard preview graphic) | Product-preview illustration |
| `public/assets/ryvl-signin-illustration.png` | `AuthCard`/sign-in page | Sign-in side-panel illustration |
| `public/assets/ryvl-signup-illustration.png` | `AuthCard`/sign-up page | Sign-up side-panel illustration |
| `public/ryvl-icon.png` | `app/layout.tsx` metadata (`apple` touch icon) | iOS home-screen icon |
| `public/ryvl-logo-horizontal.png` | **Not imported anywhere in code** - the only hit is a comment in `RyvlMark.tsx` referencing a `ryvl-logo-horizontal.svg` "at the repo root" that doesn't actually exist. Likely a reference/source file kept for design purposes, not a live asset. Verify with the user before assuming it's dead or discarding it - don't delete on this document's say-so alone. | Horizontal logo lockup (unclear current usage) |
| `src/app/icon.svg` | Next.js App Router special-file convention (auto-served at `/icon.svg`) - **not in `public/`, easy to miss** | Browser tab favicon |
| `public/favicon.ico` | Legacy favicon fallback | Favicon |
| `public/manifest.json` | `app/layout.tsx` metadata (`manifest: '/manifest.json'`) | PWA manifest |

**The real brand mark is code, not a static file**: `src/components/icons/RyvlMark.tsx` - an inline SVG (two overlapping right-facing chevrons, the second with a foot reading as an "R", `viewBox="0 0 240 240"`, comment says "exactly as approved"). Preserve the exact path data (`M35 38 L103 106 L35 174` / `M113 38 L181 106 L131 156 L185 210`, `strokeWidth="34"`) if reimplementing - it's a designed mark, not a placeholder shape. **Note: its default `color` prop is hardcoded to `#4318FF`** (the old stock-purple brand color) rather than reading from a theme token - worth deciding deliberately, not carrying forward silently, if the palette ever changes again. Used in: `LandingFooter.tsx`, `LandingHeader.tsx`, `AuthCard.tsx`, `sidebar/components/Brand.tsx` (the dashboard sidebar logo).

## 2. Dead assets - confirmed unreachable, do not carry forward

`public/img/` (30 files: `auth/`, `avatars/`, `dashboards/`, `layout/`, `nfts/`, `profile/`) is leftover Horizon UI template scaffolding. Verified dead by tracing every reference: the handful that *are* still referenced (`dashboards/Debit.png`, `dashboards/usa.png`, `nfts/Nft*.png`, `profile/Project*.png`) are only used by `src/views/admin/**` and `src/components/card/Mastercard.tsx` - a whole parallel component tree from the original admin template that **is never imported from any real route under `src/app/`** (confirmed by grep - zero hits). None of `public/img/` needs to survive a frontend rebuild.

## 3. Fonts (`src/app/layout.tsx`)

Both self-hosted at build time via `next/font/google` (no runtime Google Fonts CDN dependency):
- **Inter** - app-wide default (body + headings everywhere except marketing headlines), CSS var `--font-inter`, `display: swap`.
- **Merriweather** - weights 400/700/900, CSS var `--font-merriweather`, `display: swap`, scoped *only* to marketing-page headline `<Heading>` elements in `src/components/landing/*` (this was extended to dashboard `PageHeader` during the now-reverted revamp attempt, then reverted back to marketing-only - see `memory.md`'s "UI/UX revamp attempt" entry for that history).

Both declared in `theme/styles.ts`'s `bodyFont = "var(--font-inter), sans-serif"` as the Chakra theme default; Merriweather is applied ad hoc via `fontFamily="var(--font-merriweather), serif"` at specific call sites, not a theme-level token.

## 4. Icon system

- **`react-icons/md`** (Material icons) - the overwhelming majority of icons app-wide, imported directly per-component (e.g. `MdOutlineShoppingCart`), no central icon registry.
- **`@chakra-ui/icons`** - a handful of Chakra's own built-in icons, used alongside react-icons in some places.
- **`src/components/icons/Icons.tsx`** - a small set of hand-coded custom icon components (check current contents before assuming react-icons covers everything).
- **`src/components/icons/IconBox.tsx`** - the shared rounded-square icon-chip wrapper used by `StatsGrid` and elsewhere (the colored icon backgrounds seen throughout the dashboard).
- **`RyvlMark.tsx`** - see Section 1, the one genuinely custom brand-specific icon.

## 5. Copy/text content

Not re-catalogued separately here - `FEATURES.md`'s page-by-page breakdown already captures real button labels, headings, empty-state text, and insight-strip messages verbatim as found in the code (not paraphrased), since accurate UI copy was part of that sweep's brief. Refer to `FEATURES.md` for dashboard copy.

**Marketing/landing page copy (`src/components/landing/*`: hero, stats bar, features, comparison, pricing table, trust section, how-it-works, CTA banner, footer) was not transcribed verbatim in either document** - `FEATURES.md` explicitly flagged the marketing site as a separate scope decision. If the marketing site's copy needs to survive a rebuild too, say so explicitly and that's a fast follow-up sweep, not assumed here.
