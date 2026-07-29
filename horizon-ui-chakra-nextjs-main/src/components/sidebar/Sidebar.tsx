import React, { useContext } from 'react';

// chakra imports
import {
  Box,
  Flex,
  Drawer,
  DrawerBody,
  Icon,
  IconButton,
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
import { MdChevronLeft, MdChevronRight } from 'react-icons/md';
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

  let shadow = useColorModeValue(
    '14px 17px 40px 4px rgba(112, 144, 176, 0.08)',
    'unset',
  );
  // Chakra Color Mode
  let sidebarBg = useColorModeValue('white', 'navy.800');
  let toggleBg = useColorModeValue('white', 'navy.700');
  let toggleBorder = useColorModeValue('gray.200', 'whiteAlpha.200');
  let sidebarMargins = '0px';
  const width = isCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  // SIDEBAR
  return (
    <Box display={{ sm: 'none', xl: 'block' }} position="fixed" minH="100%">
      <Box
        bg={sidebarBg}
        transition="width 0.2s ease, box-shadow 0.2s ease"
        w={`${width}px`}
        h="100vh"
        m={sidebarMargins}
        minH="100%"
        overflowX="hidden"
        boxShadow={shadow}
        position="relative"
      >
        {/* Sits fully inside the sidebar's own box now - it previously used
            a negative right offset that put half the button outside the
            sidebar's edge, overlapping the page content next to it. */}
        <IconButton
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          icon={<Icon as={isCollapsed ? MdChevronRight : MdChevronLeft} boxSize="18px" />}
          size="sm"
          borderRadius="full"
          bg={toggleBg}
          border="1px solid"
          borderColor={toggleBorder}
          boxShadow="0px 2px 8px rgba(0, 0, 0, 0.08)"
          position="absolute"
          top="18px"
          right="12px"
          zIndex="10"
          onClick={() => setIsCollapsed?.((prev) => !prev)}
          _hover={{ bg: 'brand.500', color: 'white', borderColor: 'brand.500' }}
        />
        <Scrollbars universal={true}>
          <Content routes={routes} isCollapsed={!!isCollapsed} />
        </Scrollbars>
      </Box>
    </Box>
  );
}

// FUNCTIONS

export function SidebarResponsive(props: SidebarResponsiveProps) {
  let sidebarBackgroundColor = useColorModeValue('white', 'navy.800');
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
        <DrawerContent w="285px" maxW="285px" bg={sidebarBackgroundColor}>
          <DrawerCloseButton
            zIndex="3"
            onClick={onClose}
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
      </Drawer>
    </Flex>
  );
}
// PROPS

export default Sidebar;
