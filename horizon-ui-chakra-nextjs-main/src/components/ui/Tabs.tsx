'use client';

// Minimal tab set in TailAdmin's styling, replacing Chakra's Tabs on the
// Competitors page. Kept as a controlled list of {label, content} rather
// than the compound Tab/TabList/TabPanel API - there is exactly one tabbed
// surface in this app, and the compound version's flexibility buys nothing
// while costing four extra exports.
//
// Roles and keyboard handling are wired properly (arrow keys move between
// tabs, tabIndex follows selection) because Chakra was giving that for free
// and dropping it would be a real regression, not a styling difference.

import { useId, useRef, useState, type ReactNode } from 'react';

export type TabItem = {
  label: string;
  content: ReactNode;
};

export function Tabs({ items }: { items: TabItem[] }) {
  const [active, setActive] = useState(0);
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next =
      e.key === 'ArrowRight'
        ? (active + 1) % items.length
        : (active - 1 + items.length) % items.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="font-outfit">
      <div
        role="tablist"
        onKeyDown={onKeyDown}
        className="flex gap-1 border-b border-gray-200 dark:border-gray-800"
      >
        {items.map((item, i) => {
          const selected = i === active;
          return (
            <button
              key={item.label}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              type="button"
              id={`${baseId}-tab-${i}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${i}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                selected
                  ? 'border-brand-500 text-brand-500 dark:border-brand-400 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${active}`}
        aria-labelledby={`${baseId}-tab-${active}`}
        className="pt-5"
      >
        {items[active]?.content}
      </div>
    </div>
  );
}

export default Tabs;
