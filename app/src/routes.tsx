import { Icon } from '@chakra-ui/react';
import {
  MdBarChart,
  MdHome,
  MdOutlineShoppingCart,
  MdCategory,
  MdGroup,
  MdSettings,
  MdOutlineVisibility,
  MdOutlineTune,
  MdStorefront,
  MdReceiptLong,
  MdOutlineExplore,
} from 'react-icons/md';

import { IRoute } from 'types/navigation';

// Ryvl seller dashboard nav. Routes live directly under
// /dashboard, /apps and /onboarding (no /admin prefix) to match
// middleware.ts's PROTECTED_PREFIXES.
//
// Grouped (not one flat list) so the platform's actual differentiator -
// market intelligence - reads as the primary destination, with the
// generic e-commerce record-keeping (Products/Orders/Customers) clearly
// secondary/supporting. "Data Health" (scrape-reliability ops view) was
// removed from here entirely - it's an internal tool, not seller-facing
// value, and giving it equal billing in this list diluted the product.
// The route itself still exists at /dashboard/scraper-health if needed
// directly, it's just not linked from the seller nav anymore.
const routes: IRoute[] = [
  {
    name: 'Overview',
    layout: '',
    path: '/dashboard/overview',
    icon: <Icon as={MdHome} width="20px" height="20px" color="inherit" />,
  },
  {
    name: 'Market',
    layout: '',
    path: '/dashboard/market',
    section: 'Market Intelligence',
    icon: <Icon as={MdBarChart} width="20px" height="20px" color="inherit" />,
  },
  {
    name: 'Competitors',
    layout: '',
    path: '/dashboard/market/competitors',
    section: 'Market Intelligence',
    icon: <Icon as={MdStorefront} width="20px" height="20px" color="inherit" />,
  },
  {
    name: 'Explore',
    layout: '',
    path: '/dashboard/market/explore',
    section: 'Market Intelligence',
    icon: <Icon as={MdOutlineExplore} width="20px" height="20px" color="inherit" />,
  },
  {
    name: 'Market Definition',
    layout: '',
    path: '/dashboard/market/definition',
    section: 'Market Intelligence',
    icon: <Icon as={MdOutlineTune} width="20px" height="20px" color="inherit" />,
  },
  {
    name: 'Watchlist',
    layout: '',
    path: '/dashboard/watchlist',
    section: 'Market Intelligence',
    icon: <Icon as={MdOutlineVisibility} width="20px" height="20px" color="inherit" />,
  },
  {
    name: 'Products',
    layout: '',
    path: '/apps/products',
    section: 'Store Data',
    icon: (
      <Icon
        as={MdOutlineShoppingCart}
        width="20px"
        height="20px"
        color="inherit"
      />
    ),
  },
  {
    name: 'Categories',
    layout: '',
    path: '/apps/products/categories',
    section: 'Store Data',
    icon: <Icon as={MdCategory} width="20px" height="20px" color="inherit" />,
  },
  {
    name: 'Orders',
    layout: '',
    path: '/apps/orders',
    section: 'Store Data',
    icon: <Icon as={MdReceiptLong} width="20px" height="20px" color="inherit" />,
  },
  {
    name: 'Customers',
    layout: '',
    path: '/apps/customers',
    section: 'Store Data',
    icon: <Icon as={MdGroup} width="20px" height="20px" color="inherit" />,
  },
  {
    name: 'Settings',
    layout: '',
    path: '/apps/settings',
    section: 'Account',
    icon: <Icon as={MdSettings} width="20px" height="20px" color="inherit" />,
  },
];

export default routes;
