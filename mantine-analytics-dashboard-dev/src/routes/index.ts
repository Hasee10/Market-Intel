function path(root: string, sublink: string) {
  return `${root}${sublink}`;
}

const ROOTS_DASHBOARD = '/dashboard';
const ROOT_APPS = '/apps';
const ROOTS_PRODUCTS = '/products';
const ROOTS_AUTH = '/auth';

export const PATH_ONBOARDING = '/onboarding';

export const PATH_DASHBOARD = {
  root: ROOTS_DASHBOARD,
  // 'default' is kept as an alias for 'overview' so existing breadcrumb
  // links (PATH_DASHBOARD.default) across reused /apps pages keep working.
  default: path(ROOTS_DASHBOARD, '/overview'),
  overview: path(ROOTS_DASHBOARD, '/overview'),
  products: path(ROOTS_DASHBOARD, '/products'),
  customers: path(ROOTS_DASHBOARD, '/customers'),
  market: path(ROOTS_DASHBOARD, '/market'),
  settings: path(ROOTS_DASHBOARD, '/settings'),
};

export const PATH_APPS = {
  root: ROOT_APPS,
  customers: path(ROOT_APPS, '/customers'),
  settings: path(ROOT_APPS, '/settings'),
  products: {
    root: path(ROOT_APPS, ROOTS_PRODUCTS),
    categories: path(ROOT_APPS, ROOTS_PRODUCTS + '/categories'),
  },
};

export const PATH_AUTH = {
  root: ROOTS_AUTH,
  signin: path(ROOTS_AUTH, '/signin'),
  signup: path(ROOTS_AUTH, '/signup'),
  passwordReset: path(ROOTS_AUTH, '/password-reset'),
};
