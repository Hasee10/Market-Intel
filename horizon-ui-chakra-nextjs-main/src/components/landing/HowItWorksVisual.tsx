// Per-step mockups for HowItWorksSection - same posture as ShowcaseSection's
// device frames (see that file's own header comment): drawn as markup, not
// screenshots, so they stay sharp at any size, correct in dark mode, add no
// image weight, and can't go stale the next time the real dashboard changes.

import { AlertRow } from '@/components/landing/mockups/AlertRow';

/** Thin browser chrome - just the three window dots, no address bar. Lighter
    than ShowcaseSection's Desktop() frame since this sits beside body text
    in a 3-column row, not as its own hero shot. */
function MiniFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-1 border-b border-gray-100 px-2 py-1.5 dark:border-gray-800">
        <span className="size-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />
        <span className="size-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />
        <span className="size-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="p-2.5">{children}</div>
    </div>
  );
}

export function CategoryPickerMock() {
  return (
    <MiniFrame>
      <div className="mb-2 flex items-center justify-between rounded-md border border-gray-100 px-2 py-1.5 dark:border-gray-800">
        <span className="text-[7px] text-gray-500 dark:text-gray-400">Category</span>
        <span className="text-[7px] font-bold text-gray-900 dark:text-white">Coffee &amp; Beverages ▾</span>
      </div>
      <div className="rounded-md bg-brand-50 px-2 py-1.5 text-[6.5px] text-brand-700 dark:bg-gray-800 dark:text-brand-400">
        2,651 listings across 4 platforms
      </div>
    </MiniFrame>
  );
}

export function ScorecardRowsMock() {
  const rows = [
    { name: 'Snapcart.pk', price: 'PKR 1,350', stock: '96%' },
    { name: 'SCAFE Coffee Roaster', price: 'PKR 3,000', stock: '69%' },
    { name: 'Coffee Crest', price: 'PKR 1,250', stock: '100%' },
  ];
  return (
    <MiniFrame>
      <p className="mb-2 text-[8px] font-bold text-gray-900 dark:text-white">Scorecards</p>
      {rows.map((r) => (
        <div key={r.name} className="mb-1.5 flex items-center justify-between">
          <span className="truncate pr-1 text-[7px] text-gray-700 dark:text-gray-300">{r.name}</span>
          <span className="shrink-0 text-[7px] font-bold text-gray-900 tabular-nums dark:text-white">
            {r.price}
          </span>
          <span className="ml-1.5 shrink-0 rounded bg-emerald-50 px-1 text-[6.5px] font-bold text-emerald-600 dark:bg-emerald-500/20">
            {r.stock}
          </span>
        </div>
      ))}
    </MiniFrame>
  );
}

export function AlertsMock() {
  const rows = [
    { t: 'Coffee Crest prices -13.2%', d: 'Alert', down: true },
    { t: 'Snapcart.pk restocked', d: 'Alert', down: false },
  ];
  return (
    <MiniFrame>
      <p className="mb-2 text-[8px] font-bold text-gray-900 dark:text-white">Price alerts</p>
      {rows.map((row) => (
        <AlertRow key={row.t} title={row.t} delta={row.d} down={row.down} />
      ))}
      <div className="mt-1.5 rounded-md bg-[#5044E5] px-2 py-1.5 text-center text-[7px] font-semibold text-white">
        View all alerts
      </div>
    </MiniFrame>
  );
}
