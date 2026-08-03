'use client';

import { usePrefersReducedMotion } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';

// Numeric count-up, adapted from React Bits' CountUp (reactbits.dev,
// MIT + Commons Clause).
//
// The original drives the value with framer-motion's useMotionValue/useSpring
// and gates it on useInView. This project is pinned to framer-motion 4.1.17
// by Chakra 2.6.1's peer dependency and none of those APIs exist in v4, so
// this is a requestAnimationFrame + IntersectionObserver implementation
// instead. That is also strictly lighter: no motion values, no subscription,
// no extra bundle, and the tween runs entirely outside React until the final
// frame.
//
// Written against a pre-formatted string (e.g. "PKR 1,234", "68%", "3.2x")
// rather than a raw number, because every caller in this app already formats
// through Intl.NumberFormat with the seller's own reporting currency. Parsing
// the number back out and re-animating the numeric part preserves whatever
// prefix/suffix/locale the caller chose - swapping in the original's own
// separator logic would have quietly reformatted currency values.

type CountUpProps = {
  /** Pre-formatted display value, e.g. "PKR 1,234" or "68%". */
  value: string;
  /** Tween length in ms. */
  duration?: number;
};

// Splits "PKR 1,234.50" into ["PKR ", 1234.5, ""] so only the digits animate.
//
// Deliberately strict. Callers pass genuine labels through this same `value`
// prop - MarketView sends "Mobiles & Electronics", "Not set" and "—" as stat
// values - so a loose "find any number" match would animate the 3 in a string
// like "3D Printing". The shape below only accepts a value that is *mostly* a
// number: an optional currency prefix, the digits, and at most a short unit
// suffix (%, x, k, M). Anything else returns null and renders untouched.
const NUMERIC_VALUE = /^([^\d]{0,5}?)(-?\d[\d,]*(?:\.\d+)?)\s*([%x×]|[KkMmBb]|)$/;

function splitNumeric(value: string): { prefix: string; num: number; suffix: string; decimals: number } | null {
  const match = NUMERIC_VALUE.exec(value.trim());
  if (!match) return null;

  const [, prefix, rawNumber, suffix] = match;
  const num = Number(rawNumber.replace(/,/g, ''));
  if (!Number.isFinite(num)) return null;

  const decimalPart = rawNumber.split('.')[1];
  return { prefix, num, suffix, decimals: decimalPart ? decimalPart.length : 0 };
}

// easeOutExpo - fast start, long settle. Reads as "resolving to a figure"
// rather than a linear ticker.
function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function CountUp({ value, duration = 1100 }: CountUpProps) {
  const parsed = splitNumeric(value);
  const prefersReducedMotion = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);

  // Start on the final value so SSR and the pre-animation client render agree.
  // Starting at 0 here would flash a wrong number and risk a hydration
  // mismatch on a server-rendered dashboard.
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    // A non-numeric value ("—", "N/A") animates nothing.
    if (!parsed || prefersReducedMotion) {
      setDisplay(value);
      return;
    }

    const node = ref.current;
    if (!node) return;

    let frame = 0;
    let cancelled = false;

    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const progress = Math.min((now - start) / duration, 1);
        const current = parsed.num * easeOutExpo(progress);
        setDisplay(
          `${parsed.prefix}${current.toLocaleString('en-US', {
            minimumFractionDigits: parsed.decimals,
            maximumFractionDigits: parsed.decimals,
          })}${parsed.suffix}`,
        );
        if (progress < 1) frame = requestAnimationFrame(tick);
        else setDisplay(value); // Land exactly on the caller's string.
      };
      frame = requestAnimationFrame(tick);
    };

    // Only animate once the tile is actually on screen.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          observer.disconnect();
          setDisplay(`${parsed.prefix}${(0).toFixed(parsed.decimals)}${parsed.suffix}`);
          run();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(node);

    return () => {
      cancelled = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
    // `value` is the real input; parsed is derived from it each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, prefersReducedMotion]);

  return (
    <span ref={ref} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {display}
    </span>
  );
}

export default CountUp;
