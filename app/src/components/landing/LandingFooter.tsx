'use client';

import NextLink from 'next/link';

import { RyvlMark } from 'components/icons/RyvlMark';
import { PATH_AUTH } from '@/lib/paths';

// Only links to pages that actually exist - no placeholder About/Careers/
// Privacy/Terms links to nowhere. Add those columns back once those pages
// are real. "#features" is `/`-prefixed (see LandingHeader's note) so it
// still resolves when this footer renders on /pricing, not just the homepage.
const PRODUCT_LINKS = [
  { label: 'Features', href: '/#features' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Trust', href: '/trust' },
];

const ACCOUNT_LINKS = [
  { label: 'Sign in', href: PATH_AUTH.signin },
  { label: 'Get started', href: PATH_AUTH.signup },
];

function LinkColumn({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <p className="mb-4 text-sm font-bold uppercase tracking-wide text-white/50">{title}</p>
      <div className="flex flex-col gap-2.5">
        {links.map((link) => (
          <NextLink
            key={link.href}
            href={link.href}
            className="text-sm text-white/70 transition-colors hover:text-white"
          >
            {link.label}
          </NextLink>
        ))}
      </div>
    </div>
  );
}

export function LandingFooter() {
  return (
    <footer className="font-manrope relative overflow-hidden bg-[#0B1230] pb-8 pt-16">
      {/* Same quiet ambient glow the other surfaces use, so the footer doesn't
          read as a plain flat bar by comparison. */}
      <div className="pointer-events-none absolute -top-32 left-1/2 h-60 w-[500px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(122,101,255,0.12)_0%,rgba(122,101,255,0)_70%)]" />

      <div className="relative mx-auto max-w-[1200px] px-5 md:px-[30px]">
        <div className="mb-10 grid grid-cols-1 gap-10 md:grid-cols-3">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <RyvlMark size={24} color="#8C7BFF" />
              <span className="text-lg font-bold text-white">Ryvl</span>
            </div>
            <p className="max-w-[280px] text-sm text-white/60">
              Competitive market intelligence for online sellers - pricing benchmarks, competitor
              tracking, and alerts in one dashboard.
            </p>
          </div>

          <LinkColumn title="Product" links={PRODUCT_LINKS} />
          <LinkColumn title="Account" links={ACCOUNT_LINKS} />
        </div>

        <div className="border-t border-white/20 pt-6">
          <p className="text-xs text-white/50">
            &copy; {new Date().getFullYear()} Ryvl. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default LandingFooter;
