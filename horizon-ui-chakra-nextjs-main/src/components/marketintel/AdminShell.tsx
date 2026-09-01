'use client';

import { usePathname } from 'next/navigation';
import { PropsWithChildren, useEffect, useState } from 'react';

import { SellerAssistantWidget } from 'components/marketintel/SellerAssistantWidget';
import { AppHeader } from 'components/shell/AppHeader';
import { AppSidebar, AppSidebarMobile } from 'components/shell/AppSidebar';
import { SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from 'components/shell/sidebarWidth';
import { SidebarContext } from 'contexts/SidebarContext';
import routes from 'routes';
import { getActiveRoute } from 'utils/navigation';

interface AdminShellProps extends PropsWithChildren {
  [x: string]: any;
}

const COLLAPSE_STORAGE_KEY = 'market-intel-sidebar-collapsed';

// Shell for every page under /dashboard, /apps and /onboarding (no /admin URL
// segment, so these match middleware.ts's PROTECTED_PREFIXES).
//
// Migrated 2026-09-01 from Horizon's stock Chakra Sidebar/Navbar to the
// Tailwind AppSidebar/AppHeader ported from TailAdmin. Only the frame
// changed: `routes.tsx`, `SidebarContext`, the localStorage collapse key and
// the sidebar widths are all the same values as before, so page bodies -
// still Chakra - render exactly as they did.
export default function AdminShell({ children }: AdminShellProps) {
  const [toggleSidebar, setToggleSidebar] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    window.document.documentElement.dir = 'ltr';
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (stored === '1') setIsCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, isCollapsed ? '1' : '0');
  }, [isCollapsed]);

  const sidebarWidth = isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <SidebarContext.Provider
      value={{ toggleSidebar, setToggleSidebar, isCollapsed, setIsCollapsed }}
    >
      {/* font-outfit belongs on the shell, not just on individual components:
          without it here, anything rendered inside a page body that doesn't
          set the family itself inherits Chakra's Inter and the dashboard
          quietly renders in two typefaces. */}
      <div className="font-outfit min-h-screen bg-gray-50 dark:bg-gray-950">
        <AppSidebar routes={routes} />
        <AppSidebarMobile routes={routes} />

        {/* Margin (not float) so the header can be sticky within normal flow.
            Only applies at xl, matching AppSidebar's own xl:flex. */}
        <div
          style={{ ['--sidebar-w' as string]: `${sidebarWidth}px` }}
          className="transition-[margin] duration-200 ease-out xl:ml-[var(--sidebar-w)]"
        >
          <AppHeader breadcrumb={getActiveRoute(routes, pathname)} />
          {/* Matches TailAdmin's AppLayout content box exactly: centred, capped
              at their 2xl breakpoint, p-4 stepping to p-6.

              @container here is load-bearing, not decoration. Page grids size
              their columns with container variants (@md:grid-cols-2,
              @3xl:grid-cols-12, ...) to avoid measuring the viewport when what
              they actually sit in is this box, narrowed by the sidebar. Those
              variants resolve against the nearest ANCESTOR container - an
              element is never its own query container - so without this they
              matched nothing and every grid on every page silently collapsed
              to its grid-cols-1 base. Removing this puts the whole dashboard
              back to one full-width column. */}
          <main className="@container mx-auto max-w-[1536px] p-4 md:p-6">{children}</main>
        </div>

        <SellerAssistantWidget />
      </div>
    </SidebarContext.Provider>
  );
}
