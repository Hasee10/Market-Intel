/* eslint-disable */
// Chakra Imports
import {
  Box,
  Flex,
  useColorModeValue
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import AdminNavbarLinks from 'components/navbar/NavbarLinksAdmin'
import { SIDEBAR_WIDTH_EXPANDED } from 'components/sidebar/sidebarWidth'
import { isWindowAvailable } from 'utils/navigation'

export default function AdminNavbar (props: {
  secondary: boolean
  message: string | boolean
  brandText: string
  logoText: string
  fixed: boolean
  sidebarWidth?: number
  onOpen: (...args: any[]) => any
}) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    if (isWindowAvailable()) {
      // You now have access to `window`
      window.addEventListener('scroll', changeNavbar)

      return () => {
        window.removeEventListener('scroll', changeNavbar)
      }
    }
  })

  const { secondary, sidebarWidth = SIDEBAR_WIDTH_EXPANDED } = props

  // Here are all the props that may change depending on navbar's type or state.(secondary, variant, scrolled)
  let navbarPosition = 'fixed' as const
  let navbarFilter = 'none'
  let navbarBackdrop = 'blur(20px)'
  // Was translucent (0.2/0.5 alpha) at all times with an unused `scrolled`
  // state - page content behind the navbar showed straight through it
  // whether scrolled or not. Solid at all times fixes that; the extra
  // shadow on scroll is what signals "you've scrolled" instead.
  let navbarBg = useColorModeValue('white', 'navy.800')
  let navbarShadow = scrolled
    ? '0px 7px 23px rgba(0, 0, 0, 0.05)'
    : 'none'
  let navbarBorder = useColorModeValue('gray.200', 'whiteAlpha.100')
  let secondaryMargin = '0px'
  let paddingX = '15px'
  let gap = '0px'
  const changeNavbar = () => {
    if (isWindowAvailable() && window.scrollY > 1) {
      setScrolled(true)
    } else {
      setScrolled(false)
    }
  }

  return (
    <Box
      position={navbarPosition}
      boxShadow={navbarShadow}
      bg={navbarBg}
      borderColor={navbarBorder}
      filter={navbarFilter}
      backdropFilter={navbarBackdrop}
      backgroundPosition='center'
      backgroundSize='cover'
      borderRadius='16px'
      borderWidth='1.5px'
      borderStyle='solid'
      transitionDelay='0s, 0s, 0s, 0s'
      transitionDuration=' 0.25s, 0.25s, 0.25s, 0s'
      transition-property='box-shadow, background-color, filter, border'
      transitionTimingFunction='linear, linear, linear, linear'
      alignItems={{ xl: 'center' }}
      display={secondary ? 'block' : 'flex'}
      minH='75px'
      justifyContent={{ xl: 'center' }}
      lineHeight='25.6px'
      mx='auto'
      mt={secondaryMargin}
      pb='8px'
      right={{ base: '12px', md: '30px', lg: '30px', xl: '30px' }}
      px={{
        sm: paddingX,
        md: '10px'
      }}
      ps={{
        xl: '12px'
      }}
      pt='8px'
      top={{ base: '12px', md: '16px', xl: '18px' }}
      w={{
        base: 'calc(100vw - 6%)',
        md: 'calc(100vw - 8%)',
        lg: 'calc(100vw - 6%)',
        xl: `calc(100vw - ${sidebarWidth + 60}px)`,
        '2xl': `calc(100vw - ${sidebarWidth + 75}px)`
      }}
    >
      <Flex
        w='100%'
        flexDirection={{
          sm: 'column',
          md: 'row'
        }}
        alignItems={{ xl: 'center' }}
        justifyContent='flex-end'
        mb={gap}
      >
        <Box ms='auto' w={{ sm: '100%', md: 'unset' }}>
          <AdminNavbarLinks
            onOpen={props.onOpen}
            secondary={props.secondary}
            fixed={props.fixed}
          />
        </Box>
      </Flex>
    </Box>
  )
}
