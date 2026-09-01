'use client';

import NextLink from 'next/link';
import { useState } from 'react';

import { RyvlMark } from 'components/icons/RyvlMark';
import { ThemeToggleButton } from '@/components/landing/ThemeToggleButton';
import { PATH_AUTH } from '@/lib/paths';

// "#features" is prefixed with `/` so it still resolves correctly from pages
// other than the homepage. How it works, trust, and pricing are all real
// separate routes now, not anchors.
const NAV_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Trust', href: '/trust' },
  { label: 'Pricing', href: '/pricing' },
];

export function LandingHeader() {
  const [open, setOpen] = useState(false);

  return (
    // Glass, not just translucency. Three things together make it read as
    // frosted rather than as a faded bar:
    //   - a low background alpha, so what scrolls under is genuinely visible
    //   - saturate on the backdrop, because blurring alone washes colour out
    //     and the result looks grey and dead against a coloured hero
    //   - a light hairline along the bottom edge, which is what gives glass
    //     its thickness; without it the bar just dissolves into the page
    <header className="font-manrope sticky top-0 z-20 border-b border-white/40 bg-white/30 font-medium backdrop-blur-2xl backdrop-saturate-150 dark:border-white/10 dark:bg-gray-950/30">
      {/* 3-column grid (not space-between) so the nav centres on the header's
          true midpoint regardless of how wide the logo or button group are.
          Padding follows the template's own scale. */}
      <div className="grid grid-cols-[1fr_auto] items-center px-4 py-4 sm:px-12 md:grid-cols-[1fr_auto_1fr] lg:px-24 xl:px-40">
        <NextLink href="/" className="flex items-center gap-2 justify-self-start">
          <RyvlMark size={26} />
          <span className="text-xl font-bold text-[#111C4E] dark:text-white">Ryvl</span>
        </NextLink>

        <nav className="hidden justify-self-center md:flex md:gap-8">
          {NAV_LINKS.map((link) => (
            <NextLink
              key={link.href}
              href={link.href}
              // Underline grows left-to-right on hover, same effect the Chakra
              // version built with a ::after pseudo-element.
              className="group relative text-sm font-medium text-gray-600 transition-colors hover:text-[#5044E5] dark:text-gray-400 dark:hover:text-[#A594FF]"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-0.5 w-0 rounded-full bg-[#5044E5] transition-all duration-200 group-hover:w-full dark:bg-[#A594FF]" />
            </NextLink>
          ))}
        </nav>

        <div className="flex items-center gap-3 justify-self-end">
          <ThemeToggleButton />
          <NextLink
            href={PATH_AUTH.signin}
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800 sm:inline-flex"
          >
            Sign in
          </NextLink>
          <NextLink
            href={PATH_AUTH.signup}
            className="rounded-full bg-[#5044E5] px-6 py-2 text-sm text-white transition-transform hover:scale-105"
          >
            Get started free
          </NextLink>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="flex size-9 items-center justify-center rounded-lg text-gray-600 md:hidden dark:text-gray-300"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-5">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav className="border-t border-gray-100 px-5 py-3 md:hidden dark:border-gray-800">
          {NAV_LINKS.map((link) => (
            <NextLink
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {link.label}
            </NextLink>
          ))}
        </nav>
      )}
    </header>
  );
}

export default LandingHeader;
