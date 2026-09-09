import { IRoute } from "types/navigation";

// NextJS Requirement
export const isWindowAvailable = () => typeof window !== "undefined";

// Exact match, not substring - `window.location.href.indexOf(route.path)`
// previously matched "/apps/products" against "/apps/products/categories"
// (and every other route sharing a path prefix), so the wrong sidebar link
// showed active and the navbar title showed the wrong page whenever one
// route's path was a prefix of another's. Every route in routes.tsx is a
// distinct leaf page, so exact-match is the correct rule here (no nested
// parent/child routes that would want a prefix match).
//
// Takes pathname explicitly (from next/navigation's usePathname()) rather
// than reading window.location directly - that read only happened whenever
// the caller's component happened to re-render, not reactively on
// navigation, which is how the previous version went stale.
export const findCurrentRoute = (routes: IRoute[], pathname: string | null): IRoute | undefined => {
  if (!pathname) return undefined;
  return routes.find((route) => pathname === route.layout + route.path);
};

export const getActiveRoute = (routes: IRoute[], pathname: string | null): string => {
  const route = findCurrentRoute(routes, pathname);
  return route?.name || "Default Brand Text";
};

export const getActiveNavbar = (routes: IRoute[], pathname: string | null): boolean => {
  const route = findCurrentRoute(routes, pathname);
  // IRoute.secondary is optional, and no route currently sets it - so both
  // "no matching route" and "route without the flag" mean the same thing
  // here, which is what the declared boolean return already implied.
  return route?.secondary ?? false;
};

export const getActiveNavbarText = (routes: IRoute[], pathname: string | null): string | boolean => {
  return getActiveRoute(routes, pathname) || false;
};
