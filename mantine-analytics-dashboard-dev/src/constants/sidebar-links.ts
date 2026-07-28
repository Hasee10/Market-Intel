import {
  IconAffiliate,
  IconBell,
  IconBook2,
  IconBriefcase,
  IconCalendar,
  IconChartBar,
  IconExclamationCircle,
  IconFileInvoice,
  IconFiles,
  IconLayersSubtract,
  IconLifebuoy,
  IconList,
  IconListDetails,
  IconLogin2,
  IconMessages,
  IconMoodSmile,
  IconPackages,
  IconReceipt2,
  IconRotateRectangle,
  IconUserCircle,
  IconUserCode,
  IconUserPlus,
} from '@tabler/icons-react';

import { PATH_ABOUT, PATH_APPS, PATH_AUTH, PATH_DASHBOARD, PATH_DOCS, PATH_PAGES } from '@/routes';

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
  {
    title: 'Apps',
    links: [
      { label: 'Profile', icon: IconUserCircle, link: PATH_APPS.profile },
      { label: 'Chat', icon: IconMessages, link: PATH_APPS.chat },
      { label: 'Projects', icon: IconBriefcase, link: PATH_APPS.projects },
      { label: 'Orders', icon: IconListDetails, link: PATH_APPS.orders },
      {
        label: 'Invoices',
        icon: IconFileInvoice,
        links: [
          {
            label: 'List',
            link: PATH_APPS.invoices.root,
          },
          {
            label: 'Details',
            link: PATH_APPS.invoices.sample,
          },
        ],
      },
      { label: 'Tasks', icon: IconListDetails, link: PATH_APPS.tasks },
      { label: 'Calendar', icon: IconCalendar, link: PATH_APPS.calendar },
      {
        label: 'File Manager',
        icon: IconFiles,
        link: PATH_APPS.fileManager.root,
      },
    ],
  },
  {
    title: 'Auth',
    links: [
      { label: 'Sign In', icon: IconLogin2, link: PATH_AUTH.signin },
      { label: 'Sign Up', icon: IconUserPlus, link: PATH_AUTH.signup },
      {
        label: 'Reset Password',
        icon: IconRotateRectangle,
        link: PATH_AUTH.passwordReset,
      },
    ],
  },
  {
    title: 'Pages',
    links: [
      { label: 'Pricing', icon: IconReceipt2, link: PATH_PAGES.pricing },
      { label: 'Blank Page', icon: IconLayersSubtract, link: PATH_PAGES.blank },
    ],
  },
  {
    title: 'Documentation',
    links: [
      {
        label: 'About',
        icon: IconExclamationCircle,
        link: PATH_ABOUT.root,
      },
      {
        label: 'Getting started',
        icon: IconLifebuoy,
        link: PATH_DOCS.root,
      },
      {
        label: 'Documentation',
        icon: IconBook2,
        link: PATH_DOCS.root,
      },
      { label: 'Changelog', icon: IconList },
    ],
  },
];
