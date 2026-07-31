import { ReactComponentElement } from "react";

export interface IRoute {
  name: string;
  layout: string;
  icon: ReactComponentElement | string;
  secondary?: boolean;
  path: string;
  // Renders a small section header above this route when it differs from
  // the previous route's section - lets the sidebar group related pages
  // (e.g. "Market Intelligence" vs "Store Data") instead of one flat list.
  section?: string;
}
