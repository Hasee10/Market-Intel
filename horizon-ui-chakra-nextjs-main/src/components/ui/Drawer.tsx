'use client';

// Right-hand slide-over, replacing Chakra's Drawer across the product,
// order, customer and bulk-import flows.
//
// Behaviour Chakra was giving for free and that would be a real regression
// to drop, so it is reimplemented rather than skipped: Escape closes,
// clicking the overlay closes, body scroll locks while open, and focus moves
// into the panel on open. Focus is NOT trapped - that needs a full tab-cycle
// implementation, and a half-done trap is worse than none; noted here so it
// is a known gap rather than an oversight.

import { useEffect, useRef, type ReactNode } from 'react';
import { MdClose } from 'react-icons/md';

export function Drawer({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg' | 'xl';
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const width = { md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' }[size];

  return (
    <div className="font-outfit fixed inset-0 z-[60] flex justify-end">
      <div
        onClick={onClose}
        aria-hidden="true"
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-[2px]"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative flex h-full w-full ${width} flex-col bg-white shadow-2xl outline-none dark:bg-gray-900`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <MdClose className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && (
          <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4 dark:border-gray-800">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export default Drawer;
