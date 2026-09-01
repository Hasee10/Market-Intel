'use client';

// Ryvl's equivalent of the template's "Our latest work": three device-framed
// product shots with a caption under each.
//
// The frames and their contents are drawn as markup, not screenshots. That
// keeps them sharp at any size, correct in dark mode, weightless, and unable
// to go stale the next time a page changes. Swapping in real captures later
// only means replacing each frame's inner content with an <img>.

import { Reveal } from 'components/reactbits/Reveal';
import { SectionTitle } from '@/components/landing/SectionTitle';

const bar = 'rounded bg-gray-200 dark:bg-gray-700';

/** Phone chassis - notch, bezel, rounded corners. */
function Phone({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-[132px] rounded-[20px] border-[5px] border-gray-800 bg-white shadow-xl dark:border-gray-600 dark:bg-gray-900">
      <div className="relative h-[248px] overflow-hidden rounded-[15px]">
        <span className="absolute left-1/2 top-1 z-10 h-1 w-9 -translate-x-1/2 rounded-full bg-gray-800 dark:bg-gray-600" />
        {children}
      </div>
    </div>
  );
}

function PhoneWatchlist() {
  return (
    <div className="h-full bg-gray-50 p-2.5 pt-4 dark:bg-gray-950">
      <p className="mb-2 text-[8px] font-bold text-gray-900 dark:text-white">Price alerts</p>
      {[
        { t: 'Zellbury Lawn 3pc', d: '-12%', down: true },
        { t: 'Bonanza Kurta', d: '+4%', down: false },
        { t: 'Nishat Dupatta', d: '-8%', down: true },
        { t: 'Beechtree Shirt', d: '+2%', down: false },
      ].map((row) => (
        <div
          key={row.t}
          className="mb-1.5 flex items-center justify-between rounded-md border border-gray-100 bg-white px-1.5 py-1.5 dark:border-gray-800 dark:bg-gray-900"
        >
          <span className="truncate pr-1 text-[7px] text-gray-700 dark:text-gray-300">{row.t}</span>
          <span
            className={`shrink-0 rounded px-1 text-[6.5px] font-bold ${
              row.down
                ? 'bg-red-50 text-red-600 dark:bg-red-500/20'
                : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/20'
            }`}
          >
            {row.d}
          </span>
        </div>
      ))}
      <div className="mt-2 rounded-md bg-[#5044E5] px-2 py-1.5 text-center text-[7px] font-semibold text-white">
        View all 12 alerts
      </div>
    </div>
  );
}

function PhoneCompetitors() {
  return (
    <div className="h-full bg-gray-50 p-2.5 pt-4 dark:bg-gray-950">
      <p className="mb-2 text-[8px] font-bold text-gray-900 dark:text-white">Competitors</p>
      {[
        { n: 'Daraz Seller A', w: '82%' },
        { n: 'Daraz Seller B', w: '61%' },
        { n: 'Daraz Seller C', w: '44%' },
        { n: 'Daraz Seller D', w: '27%' },
      ].map((c) => (
        <div key={c.n} className="mb-2">
          <div className="mb-1 flex justify-between">
            <span className="text-[7px] text-gray-700 dark:text-gray-300">{c.n}</span>
            <span className="text-[7px] font-bold text-gray-900 dark:text-white">{c.w}</span>
          </div>
          <span className="block h-1 w-full rounded bg-gray-200 dark:bg-gray-800">
            <span className="block h-full rounded bg-[#5044E5]" style={{ width: c.w }} />
          </span>
        </div>
      ))}
      <div className="mt-3 rounded-md border border-gray-200 bg-white p-1.5 dark:border-gray-800 dark:bg-gray-900">
        <p className="text-[6.5px] text-gray-500">Market median</p>
        <p className="text-[9px] font-bold text-gray-900 dark:text-white">PKR 4,250</p>
      </div>
    </div>
  );
}

/** Wide browser chassis for the desktop shot. */
function Desktop() {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-1 border-b border-gray-100 px-2 py-1.5 dark:border-gray-800">
        <span className="size-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />
        <span className="size-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />
        <span className="size-1.5 rounded-full bg-gray-200 dark:bg-gray-700" />
      </div>
      <div className="grid grid-cols-[40px_1fr] bg-gray-50 dark:bg-gray-950">
        <div className="border-r border-gray-100 p-1.5 dark:border-gray-800">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className={`mb-1.5 block h-1.5 rounded ${i === 0 ? 'bg-[#5044E5]' : bar}`}
            />
          ))}
        </div>
        <div className="p-2">
          <div className="mb-2 grid grid-cols-3 gap-1.5">
            {['PKR 3.4M', '1,284', '2,663'].map((v) => (
              <div
                key={v}
                className="rounded border border-gray-100 bg-white p-1 dark:border-gray-800 dark:bg-gray-900"
              >
                <span className={`mb-1 block h-1 w-2/3 ${bar}`} />
                <p className="text-[7px] font-bold text-gray-900 dark:text-white">{v}</p>
              </div>
            ))}
          </div>
          <div className="rounded border border-gray-100 bg-white p-1.5 dark:border-gray-800 dark:bg-gray-900">
            <svg viewBox="0 0 200 44" className="h-[52px] w-full" aria-hidden="true">
              <defs>
                <linearGradient id="showcaseRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5044E5" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#5044E5" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d="M0 36 L28 30 L56 33 L84 22 L112 26 L140 14 L168 18 L200 6 L200 44 L0 44 Z" fill="url(#showcaseRev)" />
              <path d="M0 36 L28 30 L56 33 L84 22 L112 26 L140 14 L168 18 L200 6" fill="none" stroke="#5044E5" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

const ITEMS = [
  {
    title: 'Price alerts on your phone',
    description:
      'Get told the moment a competitor moves on price or runs out of stock, wherever you are.',
    frame: (
      <Phone>
        <PhoneWatchlist />
      </Phone>
    ),
  },
  {
    title: 'The full market dashboard',
    description:
      'Category pricing bands, competitor scorecards and your own revenue in one place.',
    frame: <Desktop />,
  },
  {
    title: 'Competitor scorecards',
    description:
      'See who you are really up against, how much they list, and where they price against the market.',
    frame: (
      <Phone>
        <PhoneCompetitors />
      </Phone>
    ),
  },
];

export function ShowcaseSection() {
  return (
    <section className="font-manrope flex w-full flex-col items-center gap-7 px-4 pt-24 text-gray-700 sm:px-12 lg:px-24 xl:px-40 dark:text-white">
      <SectionTitle
        title="See it in action"
        desc="The market context most sellers never get to see - on your desk and in your pocket."
      />

      <div className="grid w-full max-w-5xl grid-cols-1 gap-8 pt-4 md:grid-cols-3">
        {ITEMS.map((item, i) => (
          <Reveal key={item.title} delay={i * 120}>
            <div className="flex h-full flex-col">
              <div className="flex flex-1 items-center justify-center rounded-2xl bg-gradient-to-br from-[#EEF0FF] to-[#F7F5FF] p-6 dark:from-gray-800 dark:to-gray-900">
                {item.frame}
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                {item.title}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-white/70">{item.description}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export default ShowcaseSection;
