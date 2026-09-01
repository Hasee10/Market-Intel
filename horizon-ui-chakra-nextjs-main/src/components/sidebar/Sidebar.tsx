import React, { useContext } from 'react';

// chakra imports
import {
  Box,
  ColorModeProvider,
  Flex,
  Drawer,
  DrawerBody,
  Icon,
  useColorModeValue,
  DrawerOverlay,
  useDisclosure,
  DrawerContent,
  DrawerCloseButton,
} from '@chakra-ui/react';
import Content from 'components/sidebar/components/Content';
import { SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_WIDTH_EXPANDED } from 'components/sidebar/sidebarWidth';
import { SidebarContext } from 'contexts/SidebarContext';
import {
  renderThumb,
  renderTrack,
  renderView,
} from 'components/scrollbar/Scrollbar';
import dynamic from 'next/dynamic';

const Scrollbars = dynamic(
  () => import('react-custom-scrollbars-2').then((mod) => mod.Scrollbars),
  { ssr: true },
);

// Assets
import { IoMenuOutline } from 'react-icons/io5';
import { IRoute } from 'types/navigation';
import { isWindowAvailable } from 'utils/navigation';

interface SidebarResponsiveProps {
  routes: IRoute[];
}

interface SidebarProps extends SidebarResponsiveProps {
  [x: string]: any;
}

function Sidebar(props: SidebarProps) {
  const { routes } = props;
  const { isCollapsed, setIsCollapsed } = useContext(SidebarContext);

  // 2026-09-01 revamp: the sidebar is now permanently dark (like GitHub's,
  // Vercel's, or Linear's left nav) regardless of the app's own light/dark
  // toggle - a persistent dark sidebar against a light content area is the
  // single most legible "this is a serious tool" signal a dashboard can
  // give, and the previous plain-white sidebar was indistinguishable from
  // the template default no matter what the page content looked like.
  // ColorModeProvider scopes Chakra's color mode to just this subtree, so
  // every existing useColorModeValue() call inside Content/Links/Brand
  // (which already has correct light-text-on-dark-background values
  // defined for dark mode) resolves to its dark variant here for free -
  // zero changes needed in those files, and the actual app-wide light/dark
  // toggle is completely unaffected outside this subtree.
  let sidebarBg = '#0F172A';
  let sidebarMargins = '0px';
  const width = isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  // SIDEBAR
  return (
    <Box display={{ sm: 'none', xl: 'block' }} position="fixed" minH="100%">
      <ColorModeProvider value="dark">
        <Box
          bg={sidebarBg}
          transition="width 0.2s ease"
          w={`${width}px`}
          h="100vh"
          m={sidebarMargins}
          minH="100%"
          overflowX="hidden"
          borderRight="1px solid"
          borderColor="whiteAlpha.100"
          position="relative"
        >
          {/* The collapse toggle now lives inline with the logo in Brand.tsx,
              not as a separately absolute-positioned button here - that
              floated disconnected above everything and needed a large top
              margin elsewhere just to stay clear of it. */}
          <Scrollbars universal={true}>
            <Content
              routes={routes}
              isCollapsed={!!isCollapsed}
              onToggleCollapse={() => setIsCollapsed?.((prev) => !prev)}
            />
          </Scrollbars>
        </Box>
      </ColorModeProvider>
    </Box>
  );
}

// FUNCTIONS

export function SidebarResponsive(props: SidebarResponsiveProps) {
  // Same permanently-dark treatment as the desktop sidebar above, for the
  // same reason - see that component's comment.
  let sidebarBackgroundColor = '#0F172A';
  let menuColor = useColorModeValue('gray.400', 'white');
  // // SIDEBAR
  const { isOpen, onOpen, onClose } = useDisclosure();
  const btnRef = React.useRef();

  const { routes } = props;
  // let isWindows = navigator.platform.startsWith("Win");
  //  BRAND

  return (
    <Flex display={{ sm: 'flex', xl: 'none' }} alignItems="center">
      <Flex ref={btnRef} w="max-content" h="max-content" onClick={onOpen}>
        <Icon
          as={IoMenuOutline}
          color={menuColor}
          my="auto"
          w="20px"
          h="20px"
          me="10px"
          _hover={{ cursor: 'pointer' }}
        />
      </Flex>
      <Drawer
        isOpen={isOpen}
        onClose={onClose}
        placement={
          isWindowAvailable() && window.document.documentElement.dir === 'rtl'
            ? 'right'
            : 'left'
        }
        finalFocusRef={btnRef}
      >
        <DrawerOverlay />
        <ColorModeProvider value="dark">
          <DrawerContent w="285px" maxW="285px" bg={sidebarBackgroundColor}>
            <DrawerCloseButton
              zIndex="3"
              onClick={onClose}
              color="white"
              _focus={{ boxShadow: 'none' }}
              _hover={{ boxShadow: 'none' }}
            />
            <DrawerBody maxW="285px" px="0rem" pb="0">
              <Scrollbars
                autoHide
                renderTrackVertical={renderTrack}
                renderThumbVertical={renderThumb}
                renderView={renderView}
                universal={true}
              >
                <Content routes={routes} />
              </Scrollbars>
            </DrawerBody>
          </DrawerContent>
        </ColorModeProvider>
      </Drawer>
    </Flex>
  );
}
// PROPS

export default Sidebar;
