'use client';

import { useColorMode } from '@chakra-ui/react';
import { usePathname } from 'next/navigation';
import { PropsWithChildren, useEffect, useState } from 'react';

import { SellerAssistantWidget } from 'components/marketintel/SellerAssistantWidget';
import { AppHeader } from 'components/shell/AppHeader';
import { AppSidebar, AppSidebarMobile } from 'components/shell/AppSidebar';
import { SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from 'components/sidebar/sidebarWidth';
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
  const { colorMode } = useColorMode();

  useEffect(() => {
    window.document.documentElement.dir = 'ltr';
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (stored === '1') setIsCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, isCollapsed ? '1' : '0');
  }, [isCollapsed]);

  // Chakra owns the colour mode; Tailwind's `dark:` variant keys off a class
  // (see the @custom-variant in styles/tailwind.css). Mirroring one onto the
  // other here is what stops the migrated chrome and the not-yet-migrated
  // page bodies from ever disagreeing about which theme is active.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', colorMode === 'dark');
  }, [colorMode]);

  const sidebarWidth = isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <SidebarContext.Provider
      value={{ toggleSidebar, setToggleSidebar, isCollapsed, setIsCollapsed }}
    >
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <AppSidebar routes={routes} />
        <AppSidebarMobile routes={routes} />

        {/* Margin (not float) so the header can be sticky within normal flow.
            Only applies at xl, matching AppSidebar's own xl:flex. */}
        <div
          style={{ ['--sidebar-w' as string]: `${sidebarWidth}px` }}
          className="transition-[margin] duration-200 ease-out xl:ml-[var(--sidebar-w)]"
        >
          <AppHeader breadcrumb={getActiveRoute(routes, pathname)} />
          <main className="p-5 md:p-7">{children}</main>
        </div>

        <SellerAssistantWidget />
      </div>
    </SidebarContext.Provider>
  );
}
