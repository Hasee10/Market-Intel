'use client';

import { useState } from 'react';

// Shared by MarketplaceLogoSlider and CompanyLogoSlider. Every tile always
// shows the name; the logo mark above it is a real logo.dev image when a
// domain is given and loads successfully, or an initials avatar when it
// isn't (no domain on file, no logo.dev coverage, dead domain, token
// missing) - so one bad entry degrades to a placeholder mark instead of
// blanking out a slot in either slider.
export function LogoTile({ name, domain }: { name: string; domain?: string }) {
  const [failed, setFailed] = useState(false);
  const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN;
  const showLogo = !!domain && !failed && !!token;

  return (
    <div className="font-manrope group flex w-[88px] shrink-0 flex-col items-center gap-2">
      {showLogo ? (
        // A real brand's own logo - its colours, contrast and art style are
        // whatever that brand chose, not something this component controls.
        // Sitting fifteen of those side by side (a bold navy square next to
        // a thin grey wordmark next to a bright icon) reads as visual noise,
        // not a row. Grayscale + a fixed white card normalises every tile to
        // the same weight regardless of source colour - full colour returns
        // on hover, and the white backing keeps a transparent-background
        // logo legible even in dark mode, where the page behind it isn't.
        <div className="flex size-10 items-center justify-center rounded-lg bg-white p-1.5 shadow-sm ring-1 ring-gray-100 dark:ring-white/10">
          {/* eslint-disable-next-line @next/next/no-img-element -- external, dynamic per-domain source; next/image can't optimize a third-party logo CDN URL here. */}
          <img
            src={`https://img.logo.dev/${domain}?token=${token}&size=72&format=png`}
            alt={name}
            width={40}
            height={40}
            onError={() => setFailed(true)}
            loading="lazy"
            className="size-full object-contain grayscale opacity-70 transition-all duration-200 group-hover:opacity-100 group-hover:grayscale-0"
          />
        </div>
      ) : (
        <div className="flex size-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-white/10">
          <span className="text-sm font-bold text-gray-500 dark:text-white/60">
            {name.trim().charAt(0).toUpperCase() || '?'}
          </span>
        </div>
      )}
      <span className="w-full truncate text-center text-xs font-semibold text-gray-700 dark:text-white/80">
        {name}
      </span>
    </div>
  );
}

export default LogoTile;
