import { Box } from '@chakra-ui/react';
import type { Metadata } from 'next';
import React, { ReactNode } from 'react';
import AppWrappers from './AppWrappers';

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
  themeColor: '#4318FF',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body id={'root'}>
        <AppWrappers>{children}</AppWrappers>
      </body>
    </html>
  );
}
