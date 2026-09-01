'use client';

// Tailwind sidebar, ported from tailadmin-react-dashboard's AppSidebar.
//
// Deliberately reads the SAME `routes.tsx` and the SAME `SidebarContext` as
// the Chakra sidebar it replaces, so nav content and collapse state have
// exactly one source of truth during the migration. Widths stay at the
// project's existing 240/80 rather than TailAdmin's 290 - see
// sidebarWidth.ts's comment for why 290 was already tried and rejected here.

import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { useContext } from 'react';

import { SidebarContext } from 'contexts/SidebarContext';
import { SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from 'components/sidebar/sidebarWidth';
import type { IRoute } from 'types/navigation';

import { PlanCard } from './PlanCard';
import { RyvlWordmark } from './RyvlWordmark';

// Per-destination icon colour, keyed by path. Nav items were previously a
// uniform grey, which made the list read as one undifferentiated block -
// the same "scan by colour before you read" problem StatsGrid's per-metric
// chips fixed on Overview. Full static class strings because Tailwind scans
// source text and can't see an interpolated class name.
const ICON_TINT: Record<string, string> = {
  '/dashboard/overview': 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
  '/dashboard/market': 'bg-blue-light-50 text-blue-light-600 dark:bg-blue-light-500/15 dark:text-blue-light-500',
  '/dashboard/market/competitors': 'bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-500',
  '/dashboard/market/definition': 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
  '/dashboard/watchlist': 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500',
  '/apps/products': 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400',
  '/apps/products/categories': 'bg-blue-light-50 text-blue-light-600 dark:bg-blue-light-500/15 dark:text-blue-light-500',
  '/apps/orders': 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500',
  '/apps/customers': 'bg-orange-50 text-orange-600 dark:bg-orange-500/15 dark:text-orange-500',
  '/apps/settings': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};
const ICON_TINT_FALLBACK = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';

function NavItem({
  route,
  isActive,
  isCollapsed,
}: {
  route: IRoute;
  isActive: boolean;
  isCollapsed: boolean;
}) {
  const tint = ICON_TINT[route.path] ?? ICON_TINT_FALLBACK;

  return (
    <NextLink
      href={route.layout + route.path}
      title={isCollapsed ? route.name : undefined}
      aria-current={isActive ? 'page' : undefined}
      className={[
        'group flex items-center gap-3 rounded-lg text-sm transition-colors',
        isCollapsed ? 'justify-center px-0 py-2' : 'px-2.5 py-2',
        isActive
          ? 'bg-brand-50 font-semibold text-brand-600 dark:bg-gray-800 dark:text-brand-400'
          : 'font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800',
      ].join(' ')}
    >
      {/* Tinted rounded chip per destination. route.icon is a Chakra
          <Icon color="inherit">, so it picks up the chip's text colour. */}
      <span
        className={`flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors ${tint}`}
      >
        {route.icon}
      </span>
      {!isCollapsed && <span className="truncate">{route.name}</span>}
    </NextLink>
  );
}

export function AppSidebar({ routes }: { routes: IRoute[] }) {
  const pathname = usePathname();
  const { isCollapsed = false } = useContext(SidebarContext);

  const width = isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <aside
      style={{ width }}
      className="font-outfit fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-gray-200 bg-white px-3.5 pb-6 pt-4 transition-[width] duration-200 ease-out dark:border-gray-800 dark:bg-gray-900 xl:flex"
    >
      <NextLink
        href="/dashboard/overview"
        className={[
          'mb-5 flex items-center gap-2.5 px-1.5',
          isCollapsed ? 'justify-center px-0' : '',
        ].join(' ')}
      >
        <RyvlWordmark showWord={!isCollapsed} />
      </NextLink>

      <nav className="flex-1 overflow-y-auto">
        {routes.map((route, index) => {
          const isActive = pathname === route.layout + route.path;
          // Section header renders only when this route starts a new group -
          // same rule the Chakra sidebar used (see IRoute.section).
          const startsSection = route.section && route.section !== routes[index - 1]?.section;

          return (
            <div key={route.layout + route.path}>
              {startsSection && !isCollapsed && (
                <p className="mb-2 mt-5 flex items-center gap-2 px-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-gray-400 dark:text-gray-500">
                  {route.section}
                  <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
                </p>
              )}
              {startsSection && isCollapsed && (
                <hr className="my-3 border-gray-200 dark:border-gray-800" />
              )}
              <NavItem route={route} isActive={isActive} isCollapsed={isCollapsed} />
            </div>
          );
        })}
      </nav>

      <PlanCard isCollapsed={isCollapsed} />
    </aside>
  );
}

// Mobile/tablet drawer. The desktop sidebar above is xl-only; below that the
// same nav slides in over the page, driven by SidebarContext.toggleSidebar
// (set by AppHeader's hamburger).
export function AppSidebarMobile({ routes }: { routes: IRoute[] }) {
  const pathname = usePathname();
  const { toggleSidebar = false, setToggleSidebar } = useContext(SidebarContext);

  return (
    <>
      <div
        onClick={() => setToggleSidebar?.(false)}
        aria-hidden="true"
        className={[
          'fixed inset-0 z-40 bg-gray-900/40 transition-opacity xl:hidden',
          toggleSidebar ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      />
      <aside
        style={{ width: SIDEBAR_WIDTH_EXPANDED }}
        className={[
          'font-outfit fixed inset-y-0 left-0 z-50 flex flex-col border-r border-gray-200 bg-white px-3.5 pb-6 pt-4 transition-transform duration-200 ease-out dark:border-gray-800 dark:bg-gray-900 xl:hidden',
          toggleSidebar ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        <div className="mb-5 flex items-center justify-between px-1.5">
          <RyvlWordmark showWord />
          <button
            type="button"
            onClick={() => setToggleSidebar?.(false)}
            aria-label="Close navigation"
            className="flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto" onClick={() => setToggleSidebar?.(false)}>
          {routes.map((route, index) => {
            const isActive = pathname === route.layout + route.path;
            const startsSection = route.section && route.section !== routes[index - 1]?.section;
            return (
              <div key={route.layout + route.path}>
                {startsSection && (
                  <p className="mb-1.5 mt-4 px-2 text-[10.5px] font-medium uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
                    {route.section}
                  </p>
                )}
                <NavItem route={route} isActive={isActive} isCollapsed={false} />
              </div>
            );
          })}
        </nav>

        <PlanCard isCollapsed={false} />
      </aside>
    </>
  );
}
