/* eslint-disable */

// chakra imports
import { Box, Collapse, Flex, HStack, Icon, Text, Tooltip, useColorModeValue } from '@chakra-ui/react';
import { MdExpandMore } from 'react-icons/md';
import Link from 'next/link';
import { IRoute } from 'types/navigation';
import { usePathname } from 'next/navigation';
import { useCallback, useState } from 'react';

interface SidebarLinksProps {
  routes: IRoute[];
  isCollapsed?: boolean;
}

// A leading run of routes with no `section` (just "Overview" today) stays
// flat at the top; everything after that is grouped by section into its
// own collapsible group, in the order sections first appear in `routes`.
function groupRoutes(routes: IRoute[]) {
  const ungrouped: IRoute[] = [];
  const sections: { name: string; routes: IRoute[] }[] = [];

  // Every real route here uses layout: '' (see routes.tsx) - this filter
  // is inherited from the original Horizon UI template's multi-layout
  // support (/admin, /auth, /rtl) and is a no-op today, kept defensively
  // in case this component is ever reused with mixed-layout routes.
  const validLayouts = new Set(['/admin', '/auth', '/rtl', '']);

  for (const route of routes) {
    if (!validLayouts.has(route.layout)) continue;
    if (!route.section) {
      ungrouped.push(route);
      continue;
    }
    const existing = sections.find((s) => s.name === route.section);
    if (existing) {
      existing.routes.push(route);
    } else {
      sections.push({ name: route.section, routes: [route] });
    }
  }

  return { ungrouped, sections };
}

export function SidebarLinks(props: SidebarLinksProps) {
  const { routes, isCollapsed } = props;

  //   Chakra color mode
  const pathname = usePathname();

  let activeColor = useColorModeValue('gray.700', 'white');
  let inactiveColor = useColorModeValue(
    'secondaryGray.600',
    'secondaryGray.600',
  );
  let activeIcon = useColorModeValue('brand.500', 'white');
  let textColor = useColorModeValue('secondaryGray.500', 'white');
  // Filled pill behind the active item (Linear/Vercel-style sidebar), not
  // just a thin accent bar - reads as a clear "you are here" state instead
  // of a subtle color change easy to miss at a glance.
  let activePillBg = useColorModeValue('brand.100', 'whiteAlpha.100');
  let hoverPillBg = useColorModeValue('gray.50', 'whiteAlpha.50');
  let sectionHeaderColor = useColorModeValue('secondaryGray.500', 'secondaryGray.500');

  // Every section starts open - collapsing is something a seller opts into
  // per section, not a default state that hides half the nav on first load.
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const isSectionOpen = (name: string) => openSections[name] ?? true;
  const toggleSection = (name: string) =>
    setOpenSections((prev) => ({ ...prev, [name]: !isSectionOpen(name) }));

  // verifies if routeName is the one active (in browser input) - exact
  // match, not substring: pathname.includes('/apps/products') was also
  // true on /apps/products/categories, highlighting both links at once.
  const activeRoute = useCallback(
    (routeName: string) => {
      return pathname === routeName;
    },
    [pathname],
  );

  const renderRouteItem = (route: IRoute, key: string | number) => {
    const isActive = activeRoute(route.path.toLowerCase());

    if (isCollapsed && route.icon) {
      return (
        <Tooltip key={key} label={route.name} placement="right" hasArrow>
          <Link href={route.layout + route.path}>
            <Flex justify="center" py="12px">
              <Box color={isActive ? activeIcon : textColor}>{route.icon}</Box>
            </Flex>
          </Link>
        </Tooltip>
      );
    }

    return (
      <Link key={key} href={route.layout + route.path}>
        <Box px="2px" py="2px">
          <HStack
            spacing="14px"
            py="9px"
            ps="12px"
            pe="10px"
            borderRadius="12px"
            bg={isActive ? activePillBg : 'transparent'}
            transition="background 0.15s ease"
            _hover={isActive ? undefined : { bg: hoverPillBg }}
          >
            {route.icon && <Box color={isActive ? activeIcon : textColor}>{route.icon}</Box>}
            <Text
              me="auto"
              fontSize="sm"
              color={isActive ? activeColor : route.icon ? textColor : inactiveColor}
              fontWeight={isActive ? '700' : '500'}
            >
              {route.name}
            </Text>
          </HStack>
        </Box>
      </Link>
    );
  };

  const renderSection = (section: { name: string; routes: IRoute[] }) => {
    if (isCollapsed) {
      // No room for a header/toggle in icon-only mode - every route just
      // renders as its own icon, same as the ungrouped ones.
      return section.routes.map((route) => renderRouteItem(route, route.path));
    }

    const isOpen = isSectionOpen(section.name);

    return (
      <Box key={section.name} mt="18px">
        <Flex
          as="button"
          type="button"
          onClick={() => toggleSection(section.name)}
          align="center"
          justify="space-between"
          w="100%"
          ps="10px"
          pe="4px"
          pb="4px"
          cursor="pointer"
          aria-expanded={isOpen}
        >
          <Text
            fontSize="xs"
            fontWeight="700"
            color={sectionHeaderColor}
            textTransform="uppercase"
            letterSpacing="0.04em"
          >
            {section.name}
          </Text>
          <Icon
            as={MdExpandMore}
            boxSize="16px"
            color={sectionHeaderColor}
            transform={isOpen ? 'rotate(0deg)' : 'rotate(-90deg)'}
            transition="transform 0.15s ease"
          />
        </Flex>
        <Collapse in={isOpen} animateOpacity>
          {section.routes.map((route) => renderRouteItem(route, route.path))}
        </Collapse>
      </Box>
    );
  };

  const { ungrouped, sections } = groupRoutes(routes);

  return (
    <>
      {ungrouped.map((route) => renderRouteItem(route, route.path))}
      {sections.map((section) => renderSection(section))}
    </>
  );
}

export default SidebarLinks;
