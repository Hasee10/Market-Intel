'use client';

// Tailwind header, ported from vendor/tailadmin-dashboard's AppHeader.
//
// Keeps every capability the Chakra NavbarAdmin/NavbarLinksAdmin pair had -
// sidebar toggle, active-route breadcrumb, search with Ctrl-K, light/dark
// toggle, notifications, and the user menu with its exact sign-out
// behaviour (signOut -> push('/') -> refresh, see NavbarLinksAdmin's own
// comment for why it lands on '/' and not the sign-in form).
//
// Light/dark still goes through Chakra's useColorMode so there is one
// source of truth; AdminShell mirrors that onto <html class="dark"> for
// Tailwind's dark: variant.

import { useColorMode } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';
import { useContext, useEffect, useRef, useState } from 'react';

import { SidebarContext } from 'contexts/SidebarContext';
import { createClient } from '@/lib/supabase/client';
import { useSellerSession } from '@/lib/supabase/useSellerSession';
import type { SellerDomainRow } from '@/lib/market-intel/seller/seller';
import type { Notification } from '@/lib/notifications/list';

import { DomainSwitcher } from './DomainSwitcher';
import { NotificationsMenu } from './NotificationsMenu';

const iconButton =
  'flex size-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800';

// domains/notifications arrive as props from the layout's single server-side
// fetch (lib/market-intel/seller/shell.ts) - the two widgets below used to
// fetch them for themselves on every navigation.
export function AppHeader({
  breadcrumb,
  domains,
  notifications,
}: {
  breadcrumb: string;
  domains: SellerDomainRow[];
  notifications: Notification[];
}) {
  const router = useRouter();
  const { colorMode, toggleColorMode } = useColorMode();
  const { isCollapsed = false, setIsCollapsed, setToggleSidebar } = useContext(SidebarContext);
  const { email, businessName } = useSellerSession();

  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Ctrl/Cmd-K focuses search, same affordance the header advertises.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close the user menu on an outside click or Escape - without this it can
  // only be dismissed by re-clicking the avatar, which reads as stuck.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [menuOpen]);

  const handleToggle = () => {
    // Below xl there is no persistent sidebar to collapse - the same control
    // opens the drawer instead.
    if (window.innerWidth >= 1280) setIsCollapsed?.((prev) => !prev);
    else setToggleSidebar?.((prev) => !prev);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  const initial = (businessName ?? email ?? '?').charAt(0).toUpperCase();

  return (
    <header className="font-outfit sticky top-0 z-30 flex h-[66px] items-center gap-3.5 border-b border-gray-200 bg-white px-4 dark:border-gray-800 dark:bg-gray-900 sm:px-5">
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={iconButton}
      >
        <svg viewBox="0 0 16 12" fill="currentColor" aria-hidden="true" className="size-4">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M.58 1c0-.41.34-.75.75-.75h13.34a.75.75 0 0 1 0 1.5H1.33A.75.75 0 0 1 .58 1Zm0 10c0-.41.34-.75.75-.75h13.34a.75.75 0 0 1 0 1.5H1.33a.75.75 0 0 1-.75-.75ZM1.33 5.25a.75.75 0 0 0 0 1.5H8a.75.75 0 0 0 0-1.5H1.33Z"
          />
        </svg>
      </button>

      <p className="hidden text-sm text-gray-400 dark:text-gray-500 sm:block">
        Home / <span className="font-medium text-gray-900 dark:text-white">{breadcrumb}</span>
      </p>

      <div className="relative ml-auto hidden max-w-[320px] flex-1 md:ml-5 md:mr-auto md:block">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          ref={searchRef}
          type="search"
          placeholder="Search..."
          aria-label="Search"
          className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-14 text-sm text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-gray-800 dark:bg-gray-950 dark:text-white dark:focus:ring-gray-800"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[10px] text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 lg:block">
          Ctrl K
        </kbd>
      </div>

      <div className="ml-auto flex items-center gap-2.5 md:ml-0">
        <DomainSwitcher domains={domains} />

        <button
          type="button"
          onClick={toggleColorMode}
          aria-label={colorMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          className={iconButton}
        >
          {colorMode === 'dark' ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className="size-[17px]">
              <circle cx="12" cy="12" r="4.2" />
              <path d="M12 2.5v2M12 19.5v2M21.5 12h-2M4.5 12h-2M18.7 5.3l-1.4 1.4M6.7 17.3l-1.4 1.4M18.7 18.7l-1.4-1.4M6.7 6.7L5.3 5.3" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className="size-[17px]">
              <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z" />
            </svg>
          )}
        </button>

        <NotificationsMenu buttonClassName={`relative ${iconButton}`} notifications={notifications} />

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-lg pl-1 pr-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-brand-500 text-xs font-semibold text-white">
              {initial}
            </span>
            <span className="hidden max-w-[120px] truncate sm:block">
              {businessName ?? email ?? 'Account'}
            </span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-[calc(100%+8px)] w-56 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900"
            >
              <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-800">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                  {businessName ?? 'Your account'}
                </p>
                {email && (
                  <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{email}</p>
                )}
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 px-4 py-3 text-left text-sm text-error-600 transition-colors hover:bg-error-50 dark:text-error-500 dark:hover:bg-gray-800"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className="size-4">
                  <path d="M9 21H5.5A1.5 1.5 0 0 1 4 19.5v-15A1.5 1.5 0 0 1 5.5 3H9" />
                  <path d="M16 17l5-5-5-5M21 12H9" />
                </svg>
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
