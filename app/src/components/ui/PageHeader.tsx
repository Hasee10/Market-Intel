'use client';

// Tailwind PageHeader. Same props and same call sites as the Chakra one it
// replaces, so no page needed editing beyond its import.
//
// The Merriweather serif is deliberately NOT carried over. It was added to
// give dashboard titles "a considered product" feel, but a dense analytics
// page is scanned for numbers, not read - and the earlier revamp already
// identified the serif/sans mix as reading editorial in the wrong place.
// Titles now use Outfit, the same face as the rest of the migrated chrome.

import Link from 'next/link';
import { ReactNode } from 'react';

export type BreadcrumbItemDef = {
  title: string;
  href: string;
};

type PageHeaderProps = {
  title: string;
  breadcrumbItems?: BreadcrumbItemDef[];
  actionButton?: ReactNode;
};

export function PageHeader({ title, breadcrumbItems, actionButton }: PageHeaderProps) {
  return (
    <div className="font-outfit mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-center">
      <div className="flex flex-col">
        {breadcrumbItems && breadcrumbItems.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1 flex flex-wrap items-center gap-1.5 text-sm">
            {breadcrumbItems.map((item, index) => (
              <span key={item.href} className="flex items-center gap-1.5">
                {index > 0 && <span className="text-gray-300 dark:text-gray-600">/</span>}
                <Link
                  href={item.href}
                  className="text-gray-500 transition-colors hover:text-brand-500 dark:text-gray-400"
                >
                  {item.title}
                </Link>
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-semibold -tracking-[0.02em] text-gray-900 dark:text-white">
          {title}
        </h1>
      </div>
      {actionButton && <div className="flex shrink-0">{actionButton}</div>}
    </div>
  );
}

export default PageHeader;
