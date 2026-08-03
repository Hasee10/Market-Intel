'use client';
// Chakra imports
import { Box, useDisclosure, useColorModeValue } from '@chakra-ui/react';
// Layout components
import Navbar from 'components/navbar/NavbarAdmin';
import Sidebar from 'components/sidebar/Sidebar';
import { SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from 'components/sidebar/sidebarWidth';
import { SidebarContext } from 'contexts/SidebarContext';
import { usePathname } from 'next/navigation';
import { PropsWithChildren, useEffect, useState } from 'react';
import routes from 'routes';
import { getActiveNavbar, getActiveNavbarText, getActiveRoute } from 'utils/navigation';

interface AdminShellProps extends PropsWithChildren {
  [x: string]: any;
}

const COLLAPSE_STORAGE_KEY = 'market-intel-sidebar-collapsed';

// Same chrome as Horizon's stock /admin layout (Sidebar + Navbar), but
// reused directly under /dashboard, /apps and /onboarding so those routes
// match middleware.ts's PROTECTED_PREFIXES without an extra /admin URL
// segment. The template's stock footer is deliberately not rendered - it
// was Horizon/Simmmple boilerplate branding, not ours.
export default function AdminShell(props: AdminShellProps) {
  const { children, ...rest } = props;
  const [fixed] = useState(false);
  const [toggleSidebar, setToggleSidebar] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { onOpen } = useDisclosure();
  const pathname = usePathname();

  useEffect(() => {
    window.document.documentElement.dir = 'ltr';
    const stored = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    if (stored === '1') setIsCollapsed(true);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, isCollapsed ? '1' : '0');
  }, [isCollapsed]);

  const bg = useColorModeValue('secondaryGray.300', 'navy.900');
  const sidebarWidth = isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  return (
    <Box h="100vh" w="100vw" bg={bg}>
      <SidebarContext.Provider
        value={{
          toggleSidebar,
          setToggleSidebar,
          isCollapsed,
          setIsCollapsed,
        }}
      >
        <Sidebar routes={routes} display="none" {...rest} />
        <Box
          float="right"
          minHeight="100vh"
          height="100%"
          overflow="auto"
          position="relative"
          maxHeight="100%"
          w={{ base: '100%', xl: `calc(100% - ${sidebarWidth}px)` }}
          maxWidth={{ base: '100%', xl: `calc(100% - ${sidebarWidth}px)` }}
          transition="all 0.33s cubic-bezier(0.685, 0.0473, 0.346, 1)"
          transitionDuration=".2s, .2s, .35s"
          transitionProperty="top, bottom, width"
          transitionTimingFunction="linear, linear, ease"
        >
          <Navbar
            onOpen={onOpen}
            logoText={'Ryvl'}
            brandText={getActiveRoute(routes, pathname)}
            secondary={getActiveNavbar(routes, pathname)}
            message={getActiveNavbarText(routes, pathname)}
            fixed={fixed}
            sidebarWidth={sidebarWidth}
            {...rest}
          />

          {/* Navbar is `position: sticky` and lives in this same scroll
              container (not portaled to body), so it reserves its own
              space in the flow - no manual top-padding guess needed to
              clear it. */}
          <Box mx="auto" p={{ base: '20px', md: '30px' }} pe="20px" minH="100vh">
            {children}
          </Box>
        </Box>
      </SidebarContext.Provider>
    </Box>
  );
}
