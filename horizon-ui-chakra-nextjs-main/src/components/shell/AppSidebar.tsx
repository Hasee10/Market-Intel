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
import { useContext, useState } from 'react';

import { SidebarContext } from 'contexts/SidebarContext';
import { SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from 'components/shell/sidebarWidth';
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

// Groups routes into TailAdmin's collapsible dropdown structure: top-level
// items render on their own, and each `section` becomes an expandable parent
// with its routes as children.
//
// The group holding the current route starts expanded, so the sidebar never
// hides where you are - and expanding is per-group, not accordion, because
// closing one section to open another is annoying on a nav this small.
function NavTree({
  routes,
  pathname,
  isCollapsed,
  onNavigate,
}: {
  routes: IRoute[];
  pathname: string | null;
  isCollapsed: boolean;
  onNavigate?: () => void;
}) {
  const groups: { section: string | null; routes: IRoute[] }[] = [];
  for (const route of routes) {
    const section = route.section ?? null;
    const last = groups[groups.length - 1];
    if (last && last.section === section) last.routes.push(route);
    else groups.push({ section, routes: [route] });
  }

  const activeSection =
    routes.find((r) => pathname === r.layout + r.path)?.section ?? null;

  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      groups
        .filter((g) => g.section)
        .map((g) => [g.section as string, g.section === activeSection]),
    ),
  );

  return (
    <>
      {groups.map((group) => {
        // Ungrouped routes (Overview) stay as plain top-level items.
        if (!group.section) {
          return group.routes.map((route) => (
            <div key={route.layout + route.path} onClick={onNavigate}>
              <NavItem
                route={route}
                isActive={pathname === route.layout + route.path}
                isCollapsed={isCollapsed}
              />
            </div>
          ));
        }

        // Collapsed rail has no room for a disclosure, so children render
        // flat behind a divider - the icon chips still identify them.
        if (isCollapsed) {
          return (
            <div key={group.section}>
              <hr className="my-3 border-gray-200 dark:border-gray-800" />
              {group.routes.map((route) => (
                <NavItem
                  key={route.layout + route.path}
                  route={route}
                  isActive={pathname === route.layout + route.path}
                  isCollapsed
                />
              ))}
            </div>
          );
        }

        const isOpen = open[group.section] ?? false;
        const hasActive = group.routes.some((r) => pathname === r.layout + r.path);

        return (
          <div key={group.section} className="mt-4">
            <button
              type="button"
              onClick={() => setOpen((prev) => ({ ...prev, [group.section!]: !isOpen }))}
              aria-expanded={isOpen}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] transition-colors ${
                hasActive
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300'
              }`}
            >
              {group.section}
              <span className="h-px flex-1 bg-gray-200 dark:bg-gray-800" />
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                aria-hidden="true"
                className={`size-3 shrink-0 transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>

            {/* Grid-rows trick animates to auto height, which max-height
                guesses can't do without clipping or lag. */}
            <div
              className={`grid transition-all duration-200 ease-out ${
                isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="pt-1">
                  {group.routes.map((route) => (
                    <div key={route.layout + route.path} onClick={onNavigate}>
                      <NavItem
                        route={route}
                        isActive={pathname === route.layout + route.path}
                        isCollapsed={false}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </>
  );
}

export function AppSidebar({ routes, planTier }: { routes: IRoute[]; planTier: string }) {
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
        <NavTree routes={routes} pathname={pathname} isCollapsed={isCollapsed} />
      </nav>

      <PlanCard isCollapsed={isCollapsed} planTier={planTier} />
    </aside>
  );
}

// Mobile/tablet drawer. The desktop sidebar above is xl-only; below that the
// same nav slides in over the page, driven by SidebarContext.toggleSidebar
// (set by AppHeader's hamburger).
export function AppSidebarMobile({ routes, planTier }: { routes: IRoute[]; planTier: string }) {
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

        <nav className="flex-1 overflow-y-auto">
          <NavTree
            routes={routes}
            pathname={pathname}
            isCollapsed={false}
            onNavigate={() => setToggleSidebar?.(false)}
          />
        </nav>

        <PlanCard isCollapsed={false} planTier={planTier} />
      </aside>
    </>
  );
}
