'use client';

import { useColorMode } from '@chakra-ui/react';
import { useEffect } from 'react';

// Mirrors Chakra's colour mode onto <html class="dark"> so Tailwind's
// `dark:` variants agree with it.
//
// This MUST be mounted app-wide, not per-layout. It originally lived inside
// AdminShell, which meant it never ran on the public marketing pages: Chakra
// still switched those to a dark background (it themes <body>), while every
// Tailwind `dark:` class stayed inactive - so the landing page rendered dark
// grey text on a dark navy ground and outline buttons vanished entirely.
export function ColorModeBridge(): null {
  const { colorMode } = useColorMode();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', colorMode === 'dark');
  }, [colorMode]);

  return null;
}

export default ColorModeBridge;
