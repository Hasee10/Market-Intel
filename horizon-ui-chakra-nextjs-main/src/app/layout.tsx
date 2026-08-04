import { Box } from '@chakra-ui/react';
import type { Metadata, Viewport } from 'next';
import { Inter, Merriweather } from 'next/font/google';
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
    <html lang="en" className={`${inter.variable} ${merriweather.variable}`}>
      <body id={'root'}>
        <AppWrappers>{children}</AppWrappers>
      </body>
    </html>
  );
}
