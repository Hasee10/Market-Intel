'use client';

// Notifications bell for the Tailwind shell.
//
// NOTE: this is NOT a like-for-like port. The Chakra navbar's bell rendered
// hardcoded Horizon template content ("Horizon UI Dashboard PRO", "Horizon
// Design System Free") and was never wired to anything - while a real
// notifications feature already existed behind it: GET /api/notifications
// (latest 50, see lib/notifications/list.ts) fed by the low-stock and
// price-alert crons, plus POST /api/notifications/[id]/read. This renders
// that real data instead of carrying the placeholder forward.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useFetch } from '@/lib/hooks/useApi';
import type { IApiResponse } from '@/types/api-response';

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
};

const TYPE_DOT: Record<string, string> = {
  price_alert: 'bg-brand-500',
  low_stock: 'bg-orange-500',
  churn_risk: 'bg-error-500',
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function NotificationsMenu({ buttonClassName }: { buttonClassName: string }) {
  const { data } = useFetch<IApiResponse<Notification[]>>('/api/notifications');
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  const notifications = data?.data ?? [];
  const unread = notifications.filter((n) => !n.isRead && !readIds.has(n.id));

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

  // Optimistic locally, then POST - a failed mark-read is not worth blocking
  // the UI on, and the next fetch reconciles it either way.
  const markRead = useCallback(async (id: string) => {
    setReadIds((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    } catch {
      /* reconciled on next load */
    }
  }, []);

  const markAllRead = useCallback(() => {
    unread.forEach((n) => void markRead(n.id));
  }, [unread, markRead]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread.length ? `Notifications, ${unread.length} unread` : 'Notifications'}
        className={buttonClassName}
      >
        {unread.length > 0 && (
          <span className="absolute right-2 top-2 size-[7px] rounded-full border-[1.5px] border-white bg-error-500 dark:border-gray-900" />
        )}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className="size-[17px]">
          <path d="M18 8.5a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14.5 18 8.5Z" />
          <path d="M13.7 19.5a2 2 0 0 1-3.4 0" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] w-[330px] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900 sm:w-[380px]"
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">Notifications</p>
            {unread.length > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[340px] overflow-y-auto">
            {notifications.length === 0 ? (
              // Empty states are never a bare "no data" in this app - see
              // FEATURES.md's cross-cutting UX patterns.
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-gray-900 dark:text-white">You&apos;re all caught up</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Price alerts and low-stock warnings will show up here.
                </p>
              </div>
            ) : (
              notifications.map((n) => {
                const isRead = n.isRead || readIds.has(n.id);
                return (
                  <button
                    key={n.id}
                    type="button"
                    role="menuitem"
                    onClick={() => !isRead && markRead(n.id)}
                    className="flex w-full gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800"
                  >
                    <span
                      className={`mt-1.5 size-2 shrink-0 rounded-full ${
                        isRead ? 'bg-gray-300 dark:bg-gray-700' : TYPE_DOT[n.type] ?? 'bg-brand-500'
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block truncate text-sm ${
                          isRead
                            ? 'font-normal text-gray-600 dark:text-gray-400'
                            : 'font-medium text-gray-900 dark:text-white'
                        }`}
                      >
                        {n.title}
                      </span>
                      <span className="mt-0.5 block text-xs leading-snug text-gray-500 dark:text-gray-400">
                        {n.message}
                      </span>
                      <span className="mt-1 block text-[11px] text-gray-400 dark:text-gray-500">
                        {relativeTime(n.createdAt)}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
