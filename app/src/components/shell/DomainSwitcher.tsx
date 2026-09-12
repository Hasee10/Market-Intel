'use client';

// Lets a seller with more than one tracked domain (category) pick which
// one most of the dashboard shows. Distinct from the Competitors page's
// "All My Products" aggregate tab - this is "switch which single domain
// I'm looking at" for the pages listed in DOMAIN_AWARE_PATHS below.
//
// Selection is a query param (?domain=<categorySlug>) on the current path,
// not a DB write - it doesn't touch seller_domains.is_primary, so
// Settings' "Primary" badge stays the single source of truth for that.
// Session-only by design: shareable/bookmarkable like the Explore page's
// own param, and simpler than persisting a cross-navigation preference.

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { MdKeyboardArrowDown } from 'react-icons/md';

import type { SellerDomainRow } from '@/lib/market-intel/seller/seller';
import { PATH_DASHBOARD } from '@/lib/paths';

// Only the pages that actually resolve ?domain= (server-side, via
// resolveSelectedDomain). Mounted in AppHeader, which renders on every
// authenticated route, so without this the control appears on Products,
// Orders and Settings and silently does nothing when used - worse than
// not offering it. Explore is deliberately absent too: it has its own
// category picker covering every category, tracked or not, and two
// competing category controls in one header would be ambiguous.
const DOMAIN_AWARE_PATHS: string[] = [
  PATH_DASHBOARD.market,
  PATH_DASHBOARD.competitors,
  PATH_DASHBOARD.marketDefinition,
  PATH_DASHBOARD.watchlist,
];

// Domains arrive as a prop from the layout's server-side fetch - this used
// to GET /api/domains itself on every navigation, since the shell wraps every
// route. See lib/market-intel/seller/shell.ts.
export function DomainSwitcher({ domains }: { domains: SellerDomainRow[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  // Single-domain sellers (the common case today) see no change at all.
  if (domains.length <= 1) return null;
  if (!DOMAIN_AWARE_PATHS.includes(pathname)) return null;

  const selectedSlug = searchParams.get('domain');
  const primary = domains.find((d) => d.isPrimary) ?? domains[0];
  const current = domains.find((d) => d.categorySlug === selectedSlug) ?? primary;

  const handleSelect = (domain: SellerDomainRow) => {
    setOpen(false);
    const params = new URLSearchParams(searchParams.toString());
    if (domain.isPrimary) {
      // Primary is the default resolution on the receiving page, so a
      // clean URL (no param) is preferable to one that's always present.
      params.delete('domain');
    } else {
      params.set('domain', domain.categorySlug);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
      >
        <span className="max-w-[140px] truncate">{current?.categoryName ?? 'Select domain'}</span>
        <MdKeyboardArrowDown className="size-4 shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] z-40 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900"
        >
          {domains.map((domain) => (
            <button
              key={domain.id}
              type="button"
              role="menuitem"
              onClick={() => handleSelect(domain)}
              className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${
                domain.categorySlug === current?.categorySlug
                  ? 'font-semibold text-brand-600 dark:text-brand-400'
                  : 'text-gray-700 dark:text-gray-200'
              }`}
            >
              <span className="truncate">{domain.categoryName}</span>
              {domain.isPrimary && (
                <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-gray-800 dark:text-brand-400">
                  Primary
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default DomainSwitcher;
