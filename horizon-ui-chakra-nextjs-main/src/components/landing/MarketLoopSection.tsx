'use client';

import { useEffect, useState } from 'react';

import { MARKETPLACE_COUNT } from '@/lib/marketplaces';
import { SectionTitle } from '@/components/landing/SectionTitle';
import { Reveal } from 'components/reactbits/Reveal';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';

// The six steps a seller actually runs, drawn as the loop it is rather than
// a list - the point being that it has no end: measuring the result of a
// price change is what tells you whether the market moved under you again.
//
// Every step maps to something real in the product, not aspirational copy:
// Define -> the Market Definition page, Track -> the scraper's own cycle,
// Compare -> Competitors scorecards, Spot -> price/stock alerts, Act -> the
// pricing recommendation, Measure -> price-vs-market on the Overview.
const STEPS = [
  {
    verb: 'Define',
    tail: 'your market',
    detail:
      'Pick the segments, price band and platforms that are genuinely your competition - not a category average that includes products you would never stock.',
  },
  {
    verb: 'Track',
    tail: `${MARKETPLACE_COUNT} marketplaces`,
    detail:
      'Competitor pricing and stock refresh on their own, automatically, and nothing you see is more than 48 hours old.',
  },
  {
    verb: 'Compare',
    tail: 'against rivals',
    detail:
      'Scorecards name who you are really up against, how much they list, and where they price against your market median.',
  },
  {
    verb: 'Spot',
    tail: 'what changed',
    detail:
      'Alerts the moment a watched competitor moves on price or runs out of stock - the window where a decision is still worth making.',
  },
  {
    verb: 'Act',
    tail: 'on price',
    detail:
      'A rule-based recommendation that keeps you inside the competitive band without dropping below your own margin floor.',
  },
  {
    verb: 'Measure',
    tail: 'the result',
    detail:
      'Your price against the market trend over time, so you can tell whether the call worked - and the loop starts again.',
  },
];

const STEP_INTERVAL_MS = 3200;

/** Ring radius as a percentage of the (square) stage. */
const RADIUS = 38;

/** Node centres, walking clockwise from the top of the ring. */
const POSITIONS = STEPS.map((_, i) => {
  const radians = ((-90 + i * (360 / STEPS.length)) * Math.PI) / 180;
  return {
    left: 50 + RADIUS * Math.cos(radians),
    top: 50 + RADIUS * Math.sin(radians),
  };
});

/** Arrowheads sit between nodes, not on them - one per gap. */
const ARROWS = STEPS.map((_, i) => {
  const degrees = -90 + (i + 0.5) * (360 / STEPS.length);
  const radians = (degrees * Math.PI) / 180;
  return {
    x: 50 + RADIUS * Math.cos(radians),
    y: 50 + RADIUS * Math.sin(radians),
    // Tangent to the circle, pointing the way the loop travels.
    rotate: degrees + 90,
  };
});

// Drawn, not rendered - same posture as ShowcaseSection's device frames:
// sharp at any size, correct in both themes, and no asset to keep in sync.
function CentrePiece() {
  return (
    <svg viewBox="0 0 120 110" className="size-full" aria-hidden="true">
      <defs>
        <radialGradient id="loop-sphere-warm" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#FF9A8B" />
          <stop offset="100%" stopColor="#E23B3B" />
        </radialGradient>
        <radialGradient id="loop-sphere-cool" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#AEB6E0" />
        </radialGradient>
      </defs>

      {/* Plinth */}
      <polygon points="60,49 106,72 60,95 14,72" fill="#0B1230" opacity="0.85" />
      <polygon points="60,49 106,72 60,95 14,72" fill="none" stroke="#7B61FF" strokeOpacity="0.35" strokeWidth="0.8" />

      {/* Taller bar - brand indigo */}
      <polygon points="30,34 46,42 46,74 30,66" fill="#4A38D6" />
      <polygon points="46,42 62,34 62,66 46,74" fill="#3A2AB8" />
      <polygon points="46,26 62,34 46,42 30,34" fill="#8B7BFF" />

      {/* Shorter bar - pale */}
      <polygon points="60,52 76,60 76,80 60,72" fill="#D9DDF0" />
      <polygon points="76,60 92,52 92,72 76,80" fill="#B9C0E8" />
      <polygon points="76,44 92,52 76,60 60,52" fill="#FFFFFF" />

      <circle cx="44" cy="20" r="7" fill="url(#loop-sphere-warm)" />
      <circle cx="99" cy="41" r="5" fill="url(#loop-sphere-cool)" />
    </svg>
  );
}

export function MarketLoopSection() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    // The rotation is what carries the "this never stops" idea, so it is the
    // first thing to go when the OS asks for less motion - the steps are all
    // still readable, and hover/focus still selects one.
    if (prefersReducedMotion || paused) return;
    const timer = setInterval(() => setActive((i) => (i + 1) % STEPS.length), STEP_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [prefersReducedMotion, paused]);

  return (
    <section className="font-manrope flex w-full flex-col items-center gap-7 px-4 pt-24 text-gray-700 sm:px-12 lg:px-24 xl:px-40 dark:text-white">
      <SectionTitle
        title="The loop you are already running"
        desc="Market intelligence is not a report you read once. It is a cycle - and Ryvl runs every step of it with you."
      />

      <Reveal>
        <div className="w-full max-w-[860px] overflow-hidden rounded-[28px] bg-[#111C4E] p-6 ring-1 ring-white/10 md:p-10 dark:bg-[#151E4A]">
          {/* Desktop: the actual ring. */}
          <div
            className="relative mx-auto hidden aspect-square w-full max-w-[620px] md:block"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <svg viewBox="0 0 100 100" className="absolute inset-0 size-full" aria-hidden="true">
              <defs>
                <linearGradient id="loop-sweep" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#7B61FF" stopOpacity="0" />
                  <stop offset="100%" stopColor="#A594FF" stopOpacity="0.9" />
                </linearGradient>
              </defs>

              <circle cx="50" cy="50" r={RADIUS} fill="none" stroke="#ffffff" strokeOpacity="0.13" strokeWidth="0.4" />

              {/* The revolving part: one bright arc travelling the ring for
                  ever. Rotated as a group so the gradient sweeps with it. */}
              {!prefersReducedMotion && (
                <g
                  className="animate-[loop-spin_14s_linear_infinite]"
                  style={{ transformBox: 'view-box', transformOrigin: '50px 50px' }}
                >
                  <circle
                    cx="50"
                    cy="50"
                    r={RADIUS}
                    fill="none"
                    stroke="url(#loop-sweep)"
                    strokeWidth="0.9"
                    strokeLinecap="round"
                    strokeDasharray="34 205"
                  />
                  <circle cx="50" cy={50 - RADIUS} r="1.5" fill="#C4B8FF" />
                </g>
              )}

              {!prefersReducedMotion && (
                <g
                  className="animate-[loop-spin_22s_linear_infinite_reverse]"
                  style={{ transformBox: 'view-box', transformOrigin: '50px 50px' }}
                >
                  <circle cx={50 + RADIUS} cy="50" r="1" fill="#ffffff" fillOpacity="0.5" />
                </g>
              )}

              {ARROWS.map((arrow, i) => (
                <polygon
                  key={i}
                  points="0,-1.7 3,0 0,1.7"
                  fill="#ffffff"
                  fillOpacity="0.35"
                  transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.rotate})`}
                />
              ))}
            </svg>

            <div className="absolute left-1/2 top-1/2 size-[30%] -translate-x-1/2 -translate-y-1/2">
              <CentrePiece />
            </div>

            {STEPS.map((step, i) => {
              const isActive = i === active;
              return (
                <button
                  key={step.verb}
                  type="button"
                  onFocus={() => setActive(i)}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => setActive(i)}
                  aria-current={isActive}
                  style={{ left: `${POSITIONS[i].left}%`, top: `${POSITIONS[i].top}%` }}
                  className={`absolute w-[136px] -translate-x-1/2 -translate-y-1/2 rounded-2xl px-4 py-3 text-center ring-1 backdrop-blur-sm transition-all duration-300 lg:w-[152px] ${
                    isActive
                      ? 'bg-white/[0.14] shadow-[0_0_34px_rgba(123,97,255,0.4)] ring-[#7B61FF]/70'
                      : 'bg-white/[0.06] ring-white/10 hover:bg-white/[0.1]'
                  }`}
                >
                  <span className="block text-[15px] font-semibold text-white lg:text-base">
                    {step.verb}
                  </span>
                  <span className="block text-[11px] text-white/55">{step.tail}</span>
                </button>
              );
            })}
          </div>

          {/* The detail for whichever step is currently up. Fixed height so
              the card never resizes as the loop turns. */}
          <p className="mx-auto mt-2 hidden min-h-[68px] max-w-lg text-center text-sm leading-relaxed text-white/70 md:block">
            {STEPS[active].detail}
          </p>

          {/* Mobile: the same six steps as a chain. A 6-node ring at 360px
              wide is unreadable, and shrinking the text to force it would be
              worse than showing the sequence plainly. */}
          <ol className="flex flex-col gap-3 md:hidden">
            {STEPS.map((step, i) => (
              <li key={step.verb} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#5044E5] text-[11px] font-bold text-white">
                    {i + 1}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className="chain-line-y mt-1 w-px flex-1 text-white/25" />
                  )}
                </div>
                <div className="pb-1">
                  <p className="text-[15px] font-semibold text-white">
                    {step.verb} <span className="font-normal text-white/55">{step.tail}</span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-white/70">{step.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Reveal>
    </section>
  );
}

export default MarketLoopSection;
