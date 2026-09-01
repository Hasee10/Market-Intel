'use client';

// Fills the hero's visual slot, where the template puts a large product
// screenshot. Built as markup rather than an image so it stays sharp at any
// size, themes correctly, weighs nothing, and doesn't go stale the next time
// the dashboard changes.
//
// It mirrors the real Overview page - sidebar, KPI row, revenue area chart,
// order-status donut - so it shows what the product actually is, which the
// removed stock illustration never did.

const NAV = ['Overview', 'Market', 'Competitors', 'Watchlist', 'Products', 'Orders'];

const KPIS = [
  { label: 'Revenue (30d)', value: 'PKR 3.42M', delta: '+12.4%', up: true },
  { label: 'Orders', value: '1,284', delta: '+8.1%', up: true },
  { label: 'Avg. order value', value: 'PKR 2,663', delta: '-3.2%', up: false },
];

export function HeroPreview() {
  return (
    <div className="relative mx-auto mt-14 w-full max-w-5xl">
      {/* Soft glow under the frame so it lifts off the page the way the
          template's screenshot does. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-8 -bottom-6 h-24 rounded-full bg-[#5044E5]/25 blur-3xl"
      />

      <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-300/50 dark:border-gray-700 dark:bg-gray-900 dark:shadow-black/40">
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <span className="size-2.5 rounded-full bg-gray-200 dark:bg-gray-700" />
          <span className="size-2.5 rounded-full bg-gray-200 dark:bg-gray-700" />
          <span className="size-2.5 rounded-full bg-gray-200 dark:bg-gray-700" />
          <span className="ml-3 hidden rounded-md bg-gray-100 px-3 py-1 text-[10px] text-gray-400 sm:block dark:bg-gray-800">
            ryvl.app/dashboard/overview
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
                className={`mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] ${
                  i === 0
                    ? 'bg-[#EEF0FF] font-semibold text-[#5044E5] dark:bg-gray-800 dark:text-[#A594FF]'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    i === 0 ? 'bg-[#5044E5]' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                />
                {item}
              </div>
            ))}
          </div>

          {/* content */}
          <div className="p-3 sm:p-4">
            <div className="mb-3 grid grid-cols-3 gap-2 sm:gap-3">
              {KPIS.map((kpi) => (
                <div
                  key={kpi.label}
                  className="rounded-lg border border-gray-100 p-2 sm:p-3 dark:border-gray-800"
                >
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
              <div className="col-span-2 rounded-lg border border-gray-100 p-2 sm:p-3 dark:border-gray-800">
                <p className="mb-1 text-[9px] font-semibold text-gray-700 dark:text-gray-300">
                  Revenue trend
                </p>
                <svg viewBox="0 0 320 90" className="h-[70px] w-full sm:h-[96px]" role="img" aria-label="Revenue trending upward over the last 30 days">
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

              <div className="rounded-lg border border-gray-100 p-2 sm:p-3 dark:border-gray-800">
                <p className="mb-1 text-[9px] font-semibold text-gray-700 dark:text-gray-300">
                  Order status
                </p>
                <svg viewBox="0 0 100 100" className="mx-auto h-[70px] sm:h-[96px]" role="img" aria-label="Order status split across delivered, shipped and pending">
                  <circle cx="50" cy="50" r="34" fill="none" stroke="#10B981" strokeWidth="12" strokeDasharray="135 214" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="34" fill="none" stroke="#5044E5" strokeWidth="12" strokeDasharray="44 214" strokeDashoffset="-135" transform="rotate(-90 50 50)" />
                  <circle cx="50" cy="50" r="34" fill="none" stroke="#F59E0B" strokeWidth="12" strokeDasharray="23 214" strokeDashoffset="-179" transform="rotate(-90 50 50)" />
                  <text x="50" y="54" textAnchor="middle" className="fill-gray-900 dark:fill-white" fontSize="15" fontWeight="700">
                    1,284
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default HeroPreview;
