import { Box } from '@chakra-ui/react';
import type { Metadata, Viewport } from 'next';
import { Inter, Manrope, Merriweather, Outfit } from 'next/font/google';
import React, { ReactNode } from 'react';
import AppWrappers from './AppWrappers';

// Inter is the app-wide font (replaces DM Sans - see theme/styles.ts).
// Merriweather is scoped to marketing-page headlines only (see the Heading
// elements in components/landing/) - next/font/google self-hosts both at
// build time, so neither depends on the Google Fonts CDN at request time.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['400', '700', '900'],
  variable: '--font-merriweather',
  display: 'swap',
});
// Outfit is TailAdmin's own typeface and a large part of why that template
// reads the way it does. Scoped to the migrated shell/pages via the
// font-outfit utility rather than set app-wide, so Chakra pages that haven't
// been ported yet keep rendering in Inter exactly as they do today.
// Named --font-outfit-src, not --font-outfit, on purpose: Tailwind's @theme
// block in styles/tailwind.css already owns --font-outfit (that's what makes
// the `font-outfit` utility exist) and both land on the same element, so
// reusing the name would have one silently overwrite the other.
const outfit = Outfit({ subsets: ['latin'], variable: '--font-outfit-src', display: 'swap' });
// Manrope is the agency.ai landing template's own typeface, kept because the
// brief was to follow that template strictly. It is scoped to the public
// marketing pages via the font-manrope utility - the authenticated app stays
// on Outfit (TailAdmin's face), so the two surfaces each match the template
// they were built from.
const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope-src', display: 'swap' });

// Real metadata via Next's App Router API - replaces app/head.tsx (deleted:
// that special-file convention was dropped after Next 13.3, so it never
// actually rendered anything in this Next 15 app; its favicon/manifest/theme
// links were dead on arrival, and its apple-touch-icon pointed at a
// logo192.png that didn't even exist in public/).
export const metadata: Metadata = {
  title: 'Ryvl - Seller Market Intelligence',
  description: 'Competitive pricing benchmarks, peer comparisons, and demand signals for online sellers.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon.svg',
    apple: '/ryvl-icon.png',
  },
};

// themeColor moved out of `metadata` per Next 15 - it warns (not errors) if
// left there, but would nag on every build going forward.
export const viewport: Viewport = {
  themeColor: '#4318FF',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${merriweather.variable} ${outfit.variable} ${manrope.variable}`}
    >
      <body id={'root'}>
        <AppWrappers>{children}</AppWrappers>
      </body>
    </html>
  );
}
