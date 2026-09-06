'use client';

// Fills the hero's visual slot, where the template puts a large product
// screenshot. Built as markup rather than an image so it stays sharp at any
// size, themes correctly, weighs nothing, and doesn't go stale the next time
// the dashboard changes.
//
// It mirrors the real Overview page - sidebar, KPI row, revenue area chart,
// order-status donut - so it shows what the product actually is, which the
// removed stock illustration never did.
//
// Now it also runs itself: a synthetic cursor walks the sidebar and the panel
// swaps, the way a product-tour recording would. This is the shell a real
// screen recording drops into later - when there's a video, it replaces the
// panel area and everything around it (frame, chrome, glow, fallbacks) stays.
//
// Deliberately NOT a video today: a recording is single-theme, goes stale on
// every dashboard change, and weighs megabytes. This costs nothing, themes
// itself, and can't drift out of date in the same way.

import { useEffect, useRef, useState } from 'react';

import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

const NAV = ['Overview', 'Market', 'Competitors', 'Watchlist', 'Products', 'Orders'];

/** One beat of the tour: which sidebar item the cursor presses, and the URL
    the chrome bar shows once it lands. Panel content is keyed off the index. */
const STEPS = [
  { nav: 0, url: 'ryvl.app/dashboard/overview' },
  { nav: 1, url: 'ryvl.app/dashboard/market' },
  { nav: 2, url: 'ryvl.app/dashboard/market/competitors' },
  { nav: 3, url: 'ryvl.app/dashboard/watchlist' },
];

/** Beat length. The cursor travel + press below has to fit inside this. */
const STEP_MS = 4200;
const TRAVEL_MS = 850;
const PRESS_MS = 300;

const KPIS = [
  { label: 'Revenue (30d)', value: 'PKR 3.42M', delta: '+12.4%', up: true },
  { label: 'Orders', value: '1,284', delta: '+8.1%', up: true },
  { label: 'Avg. order value', value: 'PKR 2,663', delta: '-3.2%', up: false },
];

// Named "Seller A/B/C", not real storefronts - same choice ShowcaseSection
// already made for its competitor mock. Real Pakistani business names belong
// inside the product, not baked into marketing artwork.
const COMPETITORS = [
  { name: 'Seller A', skus: '2,443', price: 'PKR 1,350', delta: '-6.3%', share: '92%', down: true },
  { name: 'Seller B', skus: '119', price: 'PKR 3,000', delta: '+108%', share: '18%', down: false },
  { name: 'Seller C', skus: '49', price: 'PKR 1,250', delta: '-13.2%', share: '9%', down: true },
  { name: 'Seller D', skus: '40', price: 'PKR 2,410', delta: '+67.4%', share: '7%', down: false },
  { name: 'Seller E', skus: '28', price: 'PKR 1,180', delta: '-18.1%', share: '5%', down: true },
];

const BANDS = [
  { label: 'Coffee & Beverages', lo: '1,250', hi: '3,800', left: 12, width: 48 },
  { label: 'Home & Kitchen', lo: '2,100', hi: '7,400', left: 26, width: 58 },
  { label: 'Beauty', lo: '540', hi: '2,900', left: 6, width: 38 },
  { label: 'Sports & Outdoors', lo: '1,800', hi: '9,200', left: 20, width: 66 },
];

const ALERTS = [
  { title: 'Espresso Machine 15 Bar', delta: '-12%', down: true },
  { title: 'Burr Coffee Grinder', delta: '+4%', down: false },
  { title: 'Pour-over Kettle 1L', delta: '-8%', down: true },
  { title: 'Milk Frother Steel', delta: '-5%', down: true },
  { title: 'Cold Brew Carafe 1.5L', delta: '+2%', down: false },
];

const panelCard =
  'rounded-lg border border-gray-100 p-2 sm:p-3 dark:border-gray-800';
const panelHeading = 'mb-1 text-[9px] font-semibold text-gray-700 dark:text-gray-300';

function OverviewPanel() {
  return (
    <>
      <div className="mb-3 grid grid-cols-3 gap-2 sm:gap-3">
        {KPIS.map((kpi) => (
          <div key={kpi.label} className={panelCard}>
            <p className="truncate text-[9px] text-gray-400">{kpi.label}</p>
            <p className="mt-1 text-[11px] font-bold text-gray-900 sm:text-sm dark:text-white">
              {kpi.value}
            </p>
            <span
              className={`mt-1 inline-block rounded-full px-1.5 text-[8px] font-semibold ${
                kpi.up
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15'
                  : 'bg-red-50 text-red-600 dark:bg-red-500/15'
              }`}
            >
              {kpi.delta}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className={`col-span-2 ${panelCard}`}>
          <p className={panelHeading}>Revenue trend</p>
          <svg
            viewBox="0 0 320 90"
            className="h-[70px] w-full sm:h-[96px]"
            role="img"
            aria-label="Revenue trending upward over the last 30 days"
          >
            <defs>
              <linearGradient id="heroRev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#5044E5" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#5044E5" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 74 L40 66 L80 70 L120 50 L160 57 L200 34 L240 41 L280 20 L320 10 L320 90 L0 90 Z"
              fill="url(#heroRev)"
            />
            <path
              d="M0 74 L40 66 L80 70 L120 50 L160 57 L200 34 L240 41 L280 20 L320 10"
              fill="none"
              stroke="#5044E5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="320" cy="10" r="3.5" fill="#5044E5" />
          </svg>
        </div>

        <div className={panelCard}>
          <p className={panelHeading}>Order status</p>
          <svg
            viewBox="0 0 100 100"
            className="mx-auto h-[70px] sm:h-[96px]"
            role="img"
            aria-label="Order status split across delivered, shipped and pending"
          >
            <circle cx="50" cy="50" r="34" fill="none" stroke="#10B981" strokeWidth="12" strokeDasharray="135 214" transform="rotate(-90 50 50)" />
            <circle cx="50" cy="50" r="34" fill="none" stroke="#5044E5" strokeWidth="12" strokeDasharray="44 214" strokeDashoffset="-135" transform="rotate(-90 50 50)" />
            <circle cx="50" cy="50" r="34" fill="none" stroke="#F59E0B" strokeWidth="12" strokeDasharray="23 214" strokeDashoffset="-179" transform="rotate(-90 50 50)" />
            <text x="50" y="54" textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="15" fontWeight="700">
              1,284
            </text>
          </svg>
        </div>
      </div>
    </>
  );
}

function MarketPanel() {
  return (
    <>
      <div className="mb-3 grid grid-cols-3 gap-2 sm:gap-3">
        {[
          { label: 'Market median', value: 'PKR 1,440' },
          { label: 'Listings in scope', value: '2,651' },
          { label: 'Platforms', value: '4' },
        ].map((stat) => (
          <div key={stat.label} className={panelCard}>
            <p className="truncate text-[9px] text-gray-400">{stat.label}</p>
            <p className="mt-1 text-[11px] font-bold text-gray-900 sm:text-sm dark:text-white">
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      <div className={panelCard}>
        <p className={panelHeading}>Price bands by category</p>
        <div className="flex flex-col gap-2 pt-1">
          {BANDS.map((band) => (
            <div key={band.label}>
              <div className="mb-1 flex items-baseline justify-between">
                <span className="text-[8px] text-gray-500 dark:text-gray-400">{band.label}</span>
                <span className="text-[8px] tabular-nums text-gray-400">
                  {band.lo} – {band.hi}
                </span>
              </div>
              <span className="block h-1.5 w-full rounded bg-gray-100 dark:bg-gray-800">
                <span
                  className="block h-full rounded bg-[#5044E5]/70"
                  style={{ marginLeft: `${band.left}%`, width: `${band.width}%` }}
                />
              </span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function CompetitorsPanel() {
  return (
    <div className={panelCard}>
      <p className={panelHeading}>Competitor scorecards</p>
      <div className="flex flex-col gap-1.5 pt-1">
        {COMPETITORS.map((c) => (
          <div key={c.name} className="flex items-center gap-2">
            <span className="w-[52px] shrink-0 truncate text-[8px] font-medium text-gray-700 dark:text-gray-300">
              {c.name}
            </span>
            <span className="hidden h-1.5 flex-1 rounded bg-gray-100 sm:block dark:bg-gray-800">
              <span className="block h-full rounded bg-[#5044E5]" style={{ width: c.share }} />
            </span>
            <span className="w-[34px] shrink-0 text-right text-[8px] tabular-nums text-gray-400">
              {c.skus}
            </span>
            <span className="w-[52px] shrink-0 text-right text-[8px] font-semibold tabular-nums text-gray-900 dark:text-white">
              {c.price}
            </span>
            <span
              className={`w-[38px] shrink-0 rounded-full px-1 text-center text-[8px] font-semibold ${
                c.down
                  ? 'bg-red-50 text-red-600 dark:bg-red-500/15'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15'
              }`}
            >
              {c.delta}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 border-t border-gray-100 pt-2 text-[8px] text-gray-400 dark:border-gray-800">
        Ranked by assortment inside your market definition
      </p>
    </div>
  );
}

function WatchlistPanel() {
  return (
    <div className={panelCard}>
      <p className={panelHeading}>Price alerts</p>
      <div className="flex flex-col gap-1.5 pt-1">
        {ALERTS.map((alert) => (
          <div
            key={alert.title}
            className="flex items-center justify-between gap-2 rounded-md border border-gray-100 px-2 py-1.5 dark:border-gray-800"
          >
            <span className="truncate text-[8px] text-gray-700 dark:text-gray-300">{alert.title}</span>
            <span
              className={`shrink-0 rounded px-1 text-[8px] font-bold ${
                alert.down
                  ? 'bg-red-50 text-red-600 dark:bg-red-500/15'
                  : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15'
              }`}
            >
              {alert.delta}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 rounded-md bg-[#5044E5] px-2 py-1.5 text-center text-[8px] font-semibold text-white">
        View all 12 alerts
      </div>
    </div>
  );
}

const PANELS = [OverviewPanel, MarketPanel, CompetitorsPanel, WatchlistPanel];

export function HeroPreview() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [step, setStep] = useState(0);
  // `landed` trails `step`: the cursor travels first, then the click lands and
  // the panel swaps. Without the two being separate the panel would change
  // before the cursor arrived, which is the tell that gives away a fake tour.
  const [landed, setLanded] = useState(0);
  const [pressing, setPressing] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);

  const frameRef = useRef<HTMLDivElement | null>(null);
  const navRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [inView, setInView] = useState(false);

  // Only animate while the hero is actually on screen - no reason to run a
  // timer and repaint a frame nobody is looking at.
  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.2,
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const running = inView && !prefersReducedMotion;

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS);
    return () => clearInterval(timer);
  }, [running]);

  // Move the cursor to the step's nav item, then press, then swap the panel.
  useEffect(() => {
    if (!running) return;

    const target = navRefs.current[STEPS[step].nav];
    const frame = frameRef.current;
    if (target && frame) {
      const t = target.getBoundingClientRect();
      const f = frame.getBoundingClientRect();
      setCursor({ x: t.left - f.left + t.width * 0.55, y: t.top - f.top + t.height / 2 });
    }

    const press = setTimeout(() => {
      setPressing(true);
      setLanded(step);
    }, TRAVEL_MS);
    const release = setTimeout(() => setPressing(false), TRAVEL_MS + PRESS_MS);

    return () => {
      clearTimeout(press);
      clearTimeout(release);
    };
  }, [step, running]);

  const activeNav = STEPS[landed].nav;

  return (
    <div className="relative mx-auto mt-14 w-full max-w-5xl">
      {/* Soft glow under the frame so it lifts off the page the way the
          template's screenshot does. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 -bottom-6 h-24 rounded-full bg-[#5044E5]/25 blur-3xl"
      />

      <div
        ref={frameRef}
        className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-300/50 dark:border-gray-700 dark:bg-gray-900 dark:shadow-black/40"
      >
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <span className="size-2.5 rounded-full bg-gray-200 dark:bg-gray-700" />
          <span className="size-2.5 rounded-full bg-gray-200 dark:bg-gray-700" />
          <span className="size-2.5 rounded-full bg-gray-200 dark:bg-gray-700" />
          <span className="ml-3 hidden rounded-md bg-gray-100 px-3 py-1 text-[10px] text-gray-400 transition-colors sm:block dark:bg-gray-800">
            {STEPS[landed].url}
          </span>
        </div>

        <div className="grid grid-cols-[132px_1fr] text-left sm:grid-cols-[168px_1fr]">
          {/* sidebar */}
          <div className="border-r border-gray-100 p-3 dark:border-gray-800">
            <div className="mb-4 flex items-center gap-2 px-1">
              <span className="flex size-5 items-center justify-center rounded bg-[#5044E5] text-[9px] font-bold text-white">
                R
              </span>
              <span className="text-xs font-semibold text-gray-900 dark:text-white">Ryvl</span>
            </div>
            {NAV.map((item, i) => (
              <div
                key={item}
                ref={(el) => {
                  navRefs.current[i] = el;
                }}
                className={`mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] transition-colors duration-300 ${
                  i === activeNav
                    ? 'bg-[#EEF0FF] font-semibold text-[#5044E5] dark:bg-gray-800 dark:text-[#A594FF]'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full transition-colors duration-300 ${
                    i === activeNav ? 'bg-[#5044E5]' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
                {item}
              </div>
            ))}
          </div>

          {/* Content. Every panel stays mounted and they all share one grid
              cell, so the frame is always as tall as the tallest panel and
              never changes height between beats. Measured before this: the
              Overview panel is 25px taller than the other three, so swapping
              them in and out resized the frame - and the whole page below it -
              every time the loop came back around. Stacking also means no
              magic min-height to keep in sync if a panel's content changes. */}
          <div className="grid p-3 sm:p-4">
            {PANELS.map((PanelComponent, i) => (
              <div
                key={i}
                aria-hidden={i !== landed}
                className={`[grid-area:1/1] transition-all duration-300 ease-out ${
                  i === landed
                    ? 'translate-y-0 opacity-100'
                    : 'pointer-events-none translate-y-1 opacity-0'
                }`}
              >
                <PanelComponent />
              </div>
            ))}
          </div>
        </div>

        {/* The synthetic cursor. Decorative: the panels above already carry the
            real content, so this is aria-hidden and never focusable. */}
        {running && cursor && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-0 top-0 z-10 transition-transform duration-[850ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{ transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)` }}
          >
            {/* Press ripple, fired when the cursor lands on a nav item. */}
            <span
              className={`absolute -left-2.5 -top-2.5 size-6 rounded-full bg-[#5044E5]/30 transition-all duration-300 ${
                pressing ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
              }`}
            />
            <svg viewBox="0 0 24 24" className={`relative size-4 transition-transform duration-150 ${pressing ? 'scale-90' : 'scale-100'}`}>
              <path
                d="M5 2.5l13.5 7.8-5.9 1.4-2.6 5.6L5 2.5z"
                fill="#ffffff"
                stroke="#111C4E"
                strokeWidth="1.3"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

export default HeroPreview;
