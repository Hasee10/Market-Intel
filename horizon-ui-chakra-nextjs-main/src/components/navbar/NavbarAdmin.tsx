/* eslint-disable */
// Chakra Imports
import {
  Box,
  Flex,
  useColorModeValue
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'
import AdminNavbarLinks from 'components/navbar/NavbarLinksAdmin'
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

  const { secondary } = props

  // Sticky-in-flow, full width of the content column, instead of the old
  // `position: fixed` floating rounded card with top/side gaps - those gaps
  // let scrolled page content show through around the card's edges no
  // matter how opaque the card itself was. A sticky bar has no gaps to
  // leak through, so real glassmorphism (translucent + blur) is safe here.
  let navbarPosition = 'sticky' as const
  let navbarFilter = 'none'
  let navbarBackdrop = 'blur(20px) saturate(180%)'
  let navbarBg = useColorModeValue('rgba(255, 255, 255, 0.72)', 'rgba(17, 28, 68, 0.72)')
  let navbarShadow = scrolled
    ? '0px 7px 23px rgba(0, 0, 0, 0.06)'
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
      borderRadius='0px'
      borderBottomWidth='1.5px'
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
      zIndex='100'
      px={{
        sm: paddingX,
        md: '20px'
      }}
      pt='8px'
      top='0px'
      w='100%'
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
