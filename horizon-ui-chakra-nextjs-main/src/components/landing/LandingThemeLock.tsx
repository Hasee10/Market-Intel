'use client';

import { LightMode } from '@chakra-ui/react';
import { ReactNode } from 'react';

// The public marketing site is designed light-only. Chakra's color mode is
// a single global value (cookie/localStorage) shared across every route, so
// toggling dark mode inside the dashboard was also flipping `/` and
// `/pricing` into dark styles they were never designed for. <LightMode>
// pins its subtree to light regardless of the global toggle. This has to be
// its own 'use client' file - page.tsx stays a Server Component, and Chakra
// components can't be rendered directly from one.
export function LandingThemeLock({ children }: { children: ReactNode }) {
  return <LightMode>{children}</LightMode>;
}
