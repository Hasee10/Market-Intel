'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import NextLink from 'next/link';

import { RyvlMark } from 'components/icons/RyvlMark';
import { usePrefersReducedMotion } from '@/lib/hooks/usePrefersReducedMotion';
import { PATH_AUTH } from '@/lib/paths';
import { SignInForm } from '@/app/auth/_components/SignInForm';
import { SignUpForm } from '@/app/auth/_components/SignUpForm';

export type AuthMode = 'signin' | 'signup';

// Sign in and sign up as one surface, with a panel that slides between the
// two halves instead of a page navigation.
//
// WHY NO ROUTER NAVIGATION: /auth/signin and /auth/signup stay real,
// separately-addressable routes - referral links (/auth/signup?ref=CODE) are
// shared externally and three server-side redirect('/auth/signin') calls
// point at the other. But routing between them would unmount the page and
// there'd be nothing left to animate. So both routes render this component
// with a different initialMode, switching is local state, and the address
// bar is updated with history.pushState - which Next 15 supports for URL
// updates that shouldn't trigger a navigation. Back/forward still work via
// the popstate listener below.
//
// LAYOUT: the two forms sit in a fixed 2-column grid - sign-up always in the
// left cell, sign-in always in the right. The panel is absolutely positioned
// over one half and slides between them, so it physically covers whichever
// form is inactive. That's why the forms themselves never move.

const PANEL = {
  signin: {
    // Shown while signing IN, so it advertises the other door.
    heading: 'New to Ryvl?',
    body: 'See where your prices sit against 56 marketplaces - without exposing a single number from your own store.',
    cta: 'Create an account',
    illustration: '/assets/ryvl-signup-illustration.png',
    alt: '',
  },
  signup: {
    heading: 'Already selling with Ryvl?',
    body: 'Sign back in to pick up your dashboard, watchlists, and price alerts where you left them.',
    cta: 'Sign in instead',
    illustration: '/assets/ryvl-signin-illustration.png',
    alt: '',
  },
} as const;

const SLIDE_MS = 900;
const SLIDE_EASING = 'cubic-bezier(0.65, 0.05, 0.36, 1)';

// A solid shape rotating looks identical to one standing still, so the
// "roll" only reads because of the dot texture riding on the panel. Rotation
// is a fixed angle rather than distance/radius: the exact physical value
// needs a measured radius and a resize listener, and at this size the
// difference isn't visible.
const ROLL_DEGREES = 140;

// How far the shape's centre travels to land mirrored: viewport width minus
// twice its offset (cx = -6.7vw), i.e. 100 - 2*(-6.7). Derived, not tuned by
// eye - if cx above changes, this has to change with it or the curve stops
// being a mirror on the far side.
const SLIDE_VW = 113.4;

export function AuthSlider({ initialMode }: { initialMode: AuthMode }) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const prefersReducedMotion = usePrefersReducedMotion();
  const isSignin = mode === 'signin';

  const switchTo = useCallback((next: AuthMode) => {
    setMode(next);
    // Keep the query string: ?ref= on signup and ?callbackUrl= on signin are
    // both load-bearing, and dropping them here would silently break a
    // referral or send someone to the wrong page after login.
    const path = next === 'signin' ? PATH_AUTH.signin : PATH_AUTH.signup;
    window.history.pushState(null, '', `${path}${window.location.search}`);
  }, []);

  // pushState bypasses the router, so the browser's back button would
  // otherwise change the URL while leaving this component showing the old
  // mode.
  useEffect(() => {
    const onPop = () => {
      setMode(window.location.pathname.endsWith('/signup') ? 'signup' : 'signin');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const panel = PANEL[mode];
  const transition = prefersReducedMotion ? undefined : `transform ${SLIDE_MS}ms ${SLIDE_EASING}`;

  return (
    <div className="font-outfit relative min-h-screen overflow-hidden bg-white dark:bg-gray-950">
      <NextLink
        href="/"
        className="absolute top-6 left-6 z-30 flex items-center gap-2 lg:top-8 lg:left-8"
      >
        <RyvlMark size={26} />
        <span className="text-xl font-bold text-[#111C4E] dark:text-white">Ryvl</span>
      </NextLink>

      <div className="grid min-h-screen lg:grid-cols-2">
        <FormCell active={!isSignin} title="Welcome!" subtitle="Create your seller account to continue">
          <SignUpForm onSwitch={() => switchTo('signin')} />
        </FormCell>

        <FormCell active={isSignin} title="Welcome back!" subtitle="Sign in to your account to continue">
          <SignInForm onSwitch={() => switchTo('signup')} />
        </FormCell>
      </div>

      {/* THE SHAPE. One quadrant of a circle far larger than the viewport:
          209vh across, centred on the viewport's top edge and a little off
          the left of it. Only the lower-right quarter crosses the screen, so
          the edge sweeps from 52% of the width at the top to 10% at the
          bottom - a corner turning, where the previous smaller circle only
          managed 62% to 40% and read as a gentle lean. The bottom-left
          corner sits 100.7vh from the centre against a 104.3vh radius, which
          is what keeps the fill reaching it.

          It moves by translating its centre to the mirrored x. A circle is
          symmetric about its own centre, so putting the centre at (viewport
          width - cx) IS the mirror image - no flip has to be animated, and
          nothing collapses through zero mid-travel the way scaleX(-1) would.
          That is also what frees the shape from being centred on a
          half-width panel, which is the constraint that was flattening it. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden overflow-hidden lg:block">
        <div
          style={{ transform: `translateX(${isSignin ? '0vw' : `${SLIDE_VW}vw`})`, transition }}
          className="absolute top-[-104vh] left-[calc(-6.7vw-104vh)] size-[209vh] overflow-hidden rounded-full bg-gradient-to-br from-[#E9E5FF] via-[#DAD3FF] to-[#C7BEFF] dark:from-[#1A1A3C] dark:via-[#241F52] dark:to-[#2E2768]"
        >
          <div
            style={{
              transform: `rotate(${prefersReducedMotion || isSignin ? 0 : ROLL_DEGREES}deg)`,
              transition: prefersReducedMotion ? undefined : `transform ${SLIDE_MS}ms ${SLIDE_EASING}`,
            }}
            className="absolute inset-0 bg-[radial-gradient(circle,rgba(80,68,229,0.13)_1.5px,transparent_1.6px)] bg-[length:26px_26px]"
          />
        </div>
      </div>

      {/* THE CONTENT, on its own layer. It travels half a viewport - left
          half to right half - while the shape travels 113vw, because the two
          are solving different problems: the shape has to land mirrored, the
          content only has to land centred in the other half.

          Deliberately NOT aria-hidden. The switch button below is the only
          way to change mode on desktop, so hiding this from assistive tech
          would strand keyboard and screen-reader users on whichever side
          they opened. */}
      <div
        style={{ transform: `translateX(${isSignin ? '0vw' : '50vw'})`, transition }}
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/2 lg:block"
      >
        <PanelDecor />

        <div className="pointer-events-auto relative flex h-full flex-col items-center justify-center gap-6 px-12 text-center">
          {/* Both illustrations stay mounted and cross-fade, so switching
              never shows the gap of a fresh image decode. Sized off the
              viewport height so the art grows with the panel rather than
              sitting in a fixed box in the middle of a large arc. */}
          <div className="relative h-[46vh] max-h-[440px] w-full max-w-[400px]">
            {(['signin', 'signup'] as const).map((key) => (
              <Image
                key={key}
                src={PANEL[key].illustration}
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 0px, 400px"
                style={{ objectFit: 'contain' }}
                className={`transition-opacity duration-500 ${mode === key ? 'opacity-100' : 'opacity-0'}`}
              />
            ))}
          </div>

          <div className="max-w-sm">
            <h2 className="text-2xl font-bold text-[#111C4E] dark:text-white">{panel.heading}</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-white/70">
              {panel.body}
            </p>
          </div>

          <button
            type="button"
            onClick={() => switchTo(isSignin ? 'signup' : 'signin')}
            className="rounded-full border-2 border-[#4318FF] px-8 py-2.5 text-sm font-semibold text-[#4318FF] transition-colors hover:bg-[#4318FF] hover:text-white dark:border-[#A594FF] dark:text-[#A594FF] dark:hover:bg-[#A594FF] dark:hover:text-[#1A1A3C]"
          >
            {panel.cta}
          </button>
        </div>
      </div>
    </div>
  );
}

// Decoration for the panel: a thin ring, a dot cluster and a soft blob, all
// drawn rather than imported so they inherit the brand indigo and cost
// nothing to load. Deliberately sparse and low-contrast - this sits behind a
// figure and a call to action, so anything louder competes with both.
//
// Positioned in the upper and lower thirds, away from the arc's edge and
// away from the illustration's own bounding box, so nothing collides at the
// sizes the panel actually takes.
function PanelDecor() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Dashed orbit, deliberately echoing the dashed connectors on the
          trust page rather than inventing a second decorative language. */}
      <svg className="absolute top-[9%] left-[10%] size-32 text-[#4318FF]/20 dark:text-[#A594FF]/25" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="47" stroke="currentColor" strokeWidth="1.5" strokeDasharray="5 7" />
        <circle cx="50" cy="3" r="3.5" fill="currentColor" />
      </svg>

      {/* Dot grid, aligned to the same 26px rhythm as the panel texture so it
          reads as part of the surface instead of a sticker on top of it. */}
      <svg className="absolute top-[17%] right-[12%] size-20 text-[#4318FF]/25 dark:text-[#A594FF]/30" viewBox="0 0 70 70" fill="currentColor">
        {[0, 1, 2].map((r) =>
          [0, 1, 2].map((c) => <circle key={`${r}-${c}`} cx={9 + c * 26} cy={9 + r * 26} r="3.2" />),
        )}
      </svg>

      {/* Concentric arcs - a quarter turn, the same motif as the panel edge
          itself, so the decoration restates the shape rather than fighting it. */}
      <svg className="absolute bottom-[14%] left-[6%] size-36 text-[#5044E5]/18 dark:text-[#A594FF]/20" viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 116A112 112 0 0 1 116 4" />
        <path d="M30 116A86 86 0 0 1 116 30" />
        <path d="M56 116A60 60 0 0 1 116 56" />
      </svg>

      <svg className="absolute right-[14%] bottom-[26%] size-9 text-[#FFB547]/55" viewBox="0 0 40 40" fill="currentColor">
        <path d="M20 0c1.6 9.8 8.6 16.8 18.4 18.4C28.6 20 21.6 27 20 36.8 18.4 27 11.4 20 1.6 18.4 11.4 16.8 18.4 9.8 20 0Z" />
      </svg>
    </div>
  );
}

// Inactive cells keep their DOM (so a half-typed email survives a switch)
// but are hidden from pointer, tab order and assistive tech. On narrow
// screens there's no panel to cover them, so the inactive one is display:
// none outright - which also preserves React state.
//
// Display is picked in one place rather than stacked: putting `flex` and
// `hidden` on the same element leaves the winner to stylesheet order instead
// of to intent, and which one lands is then a coin toss.
function FormCell({
  active,
  title,
  subtitle,
  children,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      aria-hidden={!active}
      className={`${active ? 'flex' : 'hidden pointer-events-none opacity-0 lg:flex'} items-center justify-center px-6 py-24 transition-opacity duration-500`}
    >
      <div className="w-full max-w-[420px]">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-[#111C4E] dark:text-white">{title}</h1>
          <p className="mt-1.5 text-sm text-gray-500 dark:text-white/60">{subtitle}</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-[0_18px_40px_rgba(112,144,176,0.12)] dark:bg-gray-900 dark:shadow-black/30">
          {children}
        </div>

        <div className="mt-8 text-center">
          <NextLink
            href="/"
            className="text-sm text-gray-500 transition-colors hover:text-[#4318FF] dark:text-white/50 dark:hover:text-[#A594FF]"
          >
            &larr; Back to home
          </NextLink>
        </div>
      </div>
    </div>
  );
}

export default AuthSlider;
