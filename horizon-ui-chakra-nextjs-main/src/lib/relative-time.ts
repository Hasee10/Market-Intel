// Every relative-time formatter in the app, in one place.
//
// This existed three times over before: NotificationsMenu had a
// minute-granular copy, MarketView and ScraperHealthView an hour-granular
// one that was byte-identical between them. Both granularities survive as
// named exports below because the wording difference is user-visible and
// each surface wants a different one - but there is now one definition of
// each rather than three copies between them.
//
// Deliberately not Intl.RelativeTimeFormat: it renders "1 day ago" style
// prose, where every surface using this wants the compact "3d ago" form that
// fits in a table cell.
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;

  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

// The same shape, one notch coarser, for scrape freshness - the Market page's
// "scraped {x}" badges and the Data Health table behind them.
//
// Those two want the blunt "less than an hour ago" where relativeTime would
// say "12m ago": scrapes run on a daily cron, so a minute-level age claims a
// precision the pipeline does not have, and the only question the badge
// answers is whether the data is fresh, stale, or a day gone.
export function coarseRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const hours = Math.round((Date.now() - then) / (60 * 60 * 1000));
  if (hours < 1) return 'less than an hour ago';
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

// Colour per notification type, shared by the shell's bell menu and the
// Watchlist's alert feed so one alert never reads as two different things
// depending on where you saw it.
//
// The distinction is load-bearing on the Watchlist: low_stock is about the
// seller's OWN product, price_alert about a competitor's, and the two land
// in the same feed with nothing else to tell them apart.
export const NOTIFICATION_TYPE_DOT: Record<string, string> = {
  price_alert: 'bg-brand-500',
  low_stock: 'bg-orange-500',
  churn_risk: 'bg-error-500',
};

export const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  price_alert: 'Competitor price',
  low_stock: 'Your stock',
  churn_risk: 'Churn risk',
};
