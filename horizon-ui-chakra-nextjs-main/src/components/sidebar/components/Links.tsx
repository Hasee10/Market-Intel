/* eslint-disable */

// chakra imports
import { Box, Flex, HStack, Text, Tooltip, useColorModeValue } from '@chakra-ui/react';
import Link from 'next/link';
import { IRoute } from 'types/navigation';
import { usePathname } from 'next/navigation';
import { useCallback } from 'react';

interface SidebarLinksProps {
  routes: IRoute[];
  isCollapsed?: boolean;
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

  // verifies if routeName is the one active (in browser input) - exact
  // match, not substring: pathname.includes('/apps/products') was also
  // true on /apps/products/categories, highlighting both links at once.
  const activeRoute = useCallback(
    (routeName: string) => {
      return pathname === routeName;
    },
    [pathname],
  );

  // this function creates the links from the secondary accordions (for example auth -> sign-in -> default)
  const createLinks = (routes: IRoute[]) => {
    return routes.map((route, index: number) => {
      if (
        route.layout === '/admin' ||
        route.layout === '/auth' ||
        route.layout === '/rtl' ||
        route.layout === ''
      ) {
        const isActive = activeRoute(route.path.toLowerCase());
        const previousSection = index > 0 ? routes[index - 1].section : undefined;
        const sectionHeader =
          !isCollapsed && route.section && route.section !== previousSection ? (
            <Text
              key={`section-${route.section}`}
              fontSize="xs"
              fontWeight="700"
              color="secondaryGray.500"
              textTransform="uppercase"
              letterSpacing="0.04em"
              ps="10px"
              pt={index === 0 ? '0px' : '18px'}
              pb="4px"
            >
              {route.section}
            </Text>
          ) : null;

        if (isCollapsed && route.icon) {
          return (
            <Tooltip key={index} label={route.name} placement="right" hasArrow>
              <Link href={route.layout + route.path}>
                <Flex justify="center" py="12px">
                  <Box color={isActive ? activeIcon : textColor}>{route.icon}</Box>
                </Flex>
              </Link>
            </Tooltip>
          );
        }

        return (
          <Box key={index}>
            {sectionHeader}
            <Link href={route.layout + route.path}>
            {route.icon ? (
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
                  <Box color={isActive ? activeIcon : textColor}>{route.icon}</Box>
                  <Text
                    me="auto"
                    fontSize="sm"
                    color={isActive ? activeColor : textColor}
                    fontWeight={isActive ? '700' : '500'}
                  >
                    {route.name}
                  </Text>
                </HStack>
              </Box>
            ) : (
              <Box px="2px" py="2px">
                <HStack
                  spacing="14px"
                  py="9px"
                  ps="12px"
                  pe="10px"
                  borderRadius="12px"
                  bg={isActive ? activePillBg : 'transparent'}
                >
                  <Text
                    me="auto"
                    fontSize="sm"
                    color={isActive ? activeColor : inactiveColor}
                    fontWeight={isActive ? '700' : '500'}
                  >
                    {route.name}
                  </Text>
                </HStack>
              </Box>
            )}
            </Link>
          </Box>
        );
      }
    });
  };
  //  BRAND
  return <>{createLinks(routes)}</>;
}

export default SidebarLinks;
