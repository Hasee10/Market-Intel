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

      {/* The sliding panel. pointer-events-none on the shell so it never
          swallows clicks meant for the form underneath during the slide;
          only its own content re-enables them. */}
      <div
        aria-hidden="true"
        style={{ transform: `translateX(${isSignin ? '0%' : '100%'})`, transition }}
        className="pointer-events-none absolute inset-y-0 left-0 hidden w-1/2 lg:block"
      >
        {/* A single quarter of a very large circle, not a lens.

            The circle is 146vh across with its centre 32vh down the viewport,
            so only its lower-right quadrant crosses the screen: the edge
            sweeps from ~62% of the width at the top to ~40% at the bottom.
            Pushing the centre above the middle is what makes it a sweep
            rather than a symmetric bulge.

            It has to stay centred on the panel's own midpoint. The panel
            slides by exactly its own width, so a shape centred anywhere else
            lands off-centre on the far side and the curve stops mirroring -
            it would bulge the wrong way in sign-up mode. Centred, the left
            flank on the right-hand side is the exact mirror of the right
            flank on the left, with no flip to animate. */}
        <div className="absolute top-[-41vh] left-1/2 h-[146vh] w-[146vh] -translate-x-1/2 overflow-hidden rounded-full bg-gradient-to-br from-[#EEF0FF] via-[#E4E0FF] to-[#D9D3FF] dark:from-[#1A1A3C] dark:via-[#221F4E] dark:to-[#2B2660]">
          <div
            style={{
              transform: `rotate(${prefersReducedMotion || isSignin ? 0 : ROLL_DEGREES}deg)`,
              transition: prefersReducedMotion ? undefined : `transform ${SLIDE_MS}ms ${SLIDE_EASING}`,
            }}
            className="absolute inset-0 bg-[radial-gradient(circle,rgba(80,68,229,0.13)_1.5px,transparent_1.6px)] bg-[length:26px_26px]"
          />
        </div>

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
      <svg className="absolute top-[12%] left-[14%] size-24 text-[#4318FF]/15 dark:text-[#A594FF]/20" viewBox="0 0 100 100" fill="none">
        <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="2" />
      </svg>

      <svg className="absolute top-[22%] right-[18%] size-16 text-[#4318FF]/25 dark:text-[#A594FF]/30" viewBox="0 0 60 60" fill="currentColor">
        <circle cx="8" cy="8" r="3.5" />
        <circle cx="30" cy="8" r="3.5" />
        <circle cx="52" cy="8" r="3.5" />
        <circle cx="8" cy="30" r="3.5" />
        <circle cx="30" cy="30" r="3.5" />
        <circle cx="8" cy="52" r="3.5" />
      </svg>

      <svg className="absolute bottom-[10%] left-[8%] size-32 text-[#7592FF]/15 dark:text-[#A594FF]/12" viewBox="0 0 120 120" fill="currentColor">
        <path d="M60 4c26 0 56 16 56 46s-22 66-52 66S4 84 4 54 34 4 60 4Z" />
      </svg>

      <svg className="absolute right-[10%] bottom-[22%] size-10 text-[#FFB547]/45" viewBox="0 0 40 40" fill="currentColor">
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
