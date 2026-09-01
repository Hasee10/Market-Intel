'use client';

import { useColorMode } from '@chakra-ui/react';
import { MdDarkMode, MdLightMode } from 'react-icons/md';

// One-click light/dark toggle, matching the template's ThemeToggleBtn.
//
// Replaces the three-option Light/Dark/System dropdown on the marketing
// pages: a visitor toggling the theme of a landing page wants the other one
// immediately, not a menu. The full menu stays in the dashboard header,
// where "follow my system" is a setting worth keeping.
export function ThemeToggleButton() {
  const { colorMode, toggleColorMode } = useColorMode();
  const isDark = colorMode === 'dark';

  return (
    <button
      type="button"
      onClick={toggleColorMode}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="flex size-9 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      {isDark ? <MdLightMode className="size-5" /> : <MdDarkMode className="size-5" />}
    </button>
  );
}

export default ThemeToggleButton;
