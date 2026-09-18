'use client';

import { useEffect, useId, useRef, useState } from 'react';

import { MdOutlineHelpOutline } from 'react-icons/md';

// "How we calculate this", one small control beside a metric.
//
// The product notes (2026-09-18) put transparency ahead of everything for
// the new figures: a return rate or a repeat share is only worth showing if
// a seller can see what went into it. A `title=` attribute (what the rest
// of the app uses for hover text) doesn't do that - it's invisible on touch
// and truncates on most desktops. This is a button that opens a short
// popover on click or keyboard, closes on outside click or Escape, and
// keeps `title` as the hover fallback so nothing is lost for mouse users.
//
// No dependency, no portal. The popover is absolutely positioned inside the
// metric's own card, which is always `position: relative` in StatsGrid and
// the Chakra Card, so it never has to escape a stacking context.

type MetricHelpProps = {
  /** One or two plain sentences. Name the inputs and the window. */
  children: string;
  /** Accessible name for the button, e.g. "How Return rate is calculated". */
  label: string;
};

export function MetricHelp({ children, label }: MetricHelpProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        title={children}
        onClick={() => setOpen((v) => !v)}
        className="flex size-5 items-center justify-center rounded-full text-gray-400 transition-colors hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-300 dark:text-gray-500 dark:hover:text-gray-300"
      >
        <MdOutlineHelpOutline className="size-4" aria-hidden="true" />
      </button>

      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-[calc(100%+6px)] z-20 w-64 rounded-lg border border-gray-200 bg-white p-3 text-left text-xs leading-relaxed text-gray-700 shadow-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
        >
          {children}
        </span>
      )}
    </span>
  );
}

export default MetricHelp;
