'use client';

import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { LogoTile } from '@/components/landing/LogoTile';
import { Reveal } from 'components/reactbits/Reveal';

// Shared marquee shell for MarketplaceLogoSlider and CompanyLogoSlider -
// same edge-fade/pause-on-hover/reduced-motion behaviour, different label
// and item source. Kept as one component rather than two copies so a future
// tweak to the animation only has to happen once.
//
// The keyframes now live in styles/tailwind.css (@keyframes logo-marquee)
// instead of an Emotion keyframes object. Duration and direction stay as
// inline style because both are derived from the item count at runtime,
// which no static utility class can express.

export type LogoMarqueeItem = { key: string; name: string; domain?: string };

// Rough pitch (tile width + gap) per item, used only to derive a scroll
// duration - see speedPxPerSecond below.
const ESTIMATED_ITEM_PITCH_PX = 136;
const MIN_DURATION_SECONDS = 22;

export function LogoMarquee({
  label,
  items,
  speedPxPerSecond = 36,
  direction = 'left',
}: {
  label: string;
  items: LogoMarqueeItem[];
  /**
   * Constant scroll speed rather than a fixed duration - a fixed duration
   * made longer item lists (more sellers/brands over time) scroll faster
   * and less readable, since the same duration then has to cover more
   * pixels. Tying speed to distance instead keeps every row equally easy
   * to read regardless of how many logos are in it.
   */
  speedPxPerSecond?: number;
  /** Which way the track scrolls - 'right' just plays the same keyframes in reverse. */
  direction?: 'left' | 'right';
}) {
  const prefersReducedMotion = usePrefersReducedMotion();

  if (items.length === 0) return null;

  const durationSeconds = Math.max(
    MIN_DURATION_SECONDS,
    (items.length * ESTIMATED_ITEM_PITCH_PX) / speedPxPerSecond,
  );

  // Duplicated once so the track can loop seamlessly at -50% instead of
  // snapping back to start; skipped entirely under reduced motion, where a
  // static wrapped row reads better than a slider that never moves.
  const track = prefersReducedMotion ? items : [...items, ...items];

  return (
    // No hardcoded bg - same fix as ComparisonSection.tsx and
    // HowItWorksSection.tsx: this strip inherits the page ground instead of
    // forcing its own white/gray-950, which cut a hard seam against the
    // sections above and below it. The border-y hairline still marks it out
    // as its own row without needing a different fill colour to do that.
    <div className="font-manrope border-y border-gray-100 py-10 md:py-14 dark:border-white/10">
      <div className="mx-auto max-w-[1200px] px-5 md:px-[30px]">
        <Reveal>
          <p className="mb-7 text-center text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-white/50">
            {label}
          </p>
        </Reveal>

        <div className="relative overflow-hidden">
          {/* Edge fade so tiles dissolve at both ends rather than being cut
              off mid-logo. Two overlays because the gradient's end colour has
              to match whichever surface is behind it - now the page's actual
              body token (theme/styles.ts: secondaryGray.300 / navy.900), not
              an approximation, since this strip no longer paints its own bg. */}
          <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(90deg,#F4F7FE_0%,transparent_15%,transparent_85%,#F4F7FE_100%)] dark:hidden" />
          <div className="pointer-events-none absolute inset-0 z-10 hidden bg-[linear-gradient(90deg,#0b1437_0%,transparent_15%,transparent_85%,#0b1437_100%)] dark:block" />

          <div
            style={
              prefersReducedMotion
                ? undefined
                : {
                    animation: `logo-marquee ${durationSeconds}s linear infinite${
                      direction === 'right' ? ' reverse' : ''
                    }`,
                  }
            }
            className={
              prefersReducedMotion
                ? 'flex w-full flex-wrap items-center justify-center gap-12'
                : 'flex w-max flex-nowrap items-center gap-12 hover:[animation-play-state:paused]'
            }
          >
            {track.map((item, i) => (
              <LogoTile key={`${item.key}-${i}`} name={item.name} domain={item.domain} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default LogoMarquee;
