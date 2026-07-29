import { Icon } from '@chakra-ui/react';
import {
  MdBarChart,
  MdHome,
  MdOutlineShoppingCart,
  MdCategory,
  MdGroup,
  MdSettings,
  MdOutlineVisibility,
  MdReceiptLong,
} from 'react-icons/md';

import { IRoute } from 'types/navigation';

// Market Intel seller dashboard nav. Routes live directly under
// /dashboard, /apps and /onboarding (no /admin prefix) to match
// middleware.ts's PROTECTED_PREFIXES.
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
    icon: <Icon as={MdBarChart} width="20px" height="20px" color="inherit" />,
  },
  {
    name: 'Watchlist',
    layout: '',
    path: '/dashboard/watchlist',
    icon: <Icon as={MdOutlineVisibility} width="20px" height="20px" color="inherit" />,
  },
  {
    name: 'Products',
    layout: '',
    path: '/apps/products',
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
    icon: <Icon as={MdCategory} width="20px" height="20px" color="inherit" />,
  },
  {
    name: 'Orders',
    layout: '',
    path: '/apps/orders',
    icon: <Icon as={MdReceiptLong} width="20px" height="20px" color="inherit" />,
  },
  {
    name: 'Customers',
    layout: '',
    path: '/apps/customers',
    icon: <Icon as={MdGroup} width="20px" height="20px" color="inherit" />,
  },
  {
    name: 'Settings',
    layout: '',
    path: '/apps/settings',
    icon: <Icon as={MdSettings} width="20px" height="20px" color="inherit" />,
  },
];

export default routes;
