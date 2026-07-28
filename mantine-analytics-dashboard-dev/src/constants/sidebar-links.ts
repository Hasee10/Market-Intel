import {
  IconAffiliate,
  IconBell,
  IconChartBar,
  IconMoodSmile,
  IconPackages,
  IconUserCode,
} from '@tabler/icons-react';

import { PATH_DASHBOARD } from '@/routes';

export const SIDEBAR_LINKS = [
  {
    title: 'Your store',
    links: [
      { label: 'Overview', icon: IconChartBar, link: PATH_DASHBOARD.overview },
      { label: 'Products', icon: IconPackages, link: PATH_DASHBOARD.products },
      { label: 'Customers & churn', icon: IconMoodSmile, link: PATH_DASHBOARD.customers },
      { label: 'Market & peers', icon: IconAffiliate, link: PATH_DASHBOARD.market },
      { label: 'Alerts', icon: IconBell, link: PATH_DASHBOARD.alerts },
      { label: 'Settings', icon: IconUserCode, link: PATH_DASHBOARD.settings },
    ],
  },
];
