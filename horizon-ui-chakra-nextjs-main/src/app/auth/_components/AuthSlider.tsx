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
        {/* Oversized ellipse: wider than the half it sits in, so its flank
            bulges into the other column as a curve while the outer side is
            clipped away by the container. That curve is the whole shape -
            a straight-edged panel reads as a split screen, not a slide. */}
        <div className="absolute -top-1/4 -left-1/4 h-[150%] w-[150%] overflow-hidden rounded-[50%] bg-gradient-to-br from-[#EEF0FF] via-[#E4E0FF] to-[#D9D3FF] dark:from-[#1A1A3C] dark:via-[#221F4E] dark:to-[#2B2660]">
          <div
            style={{
              transform: `rotate(${prefersReducedMotion || isSignin ? 0 : ROLL_DEGREES}deg)`,
              transition: prefersReducedMotion ? undefined : `transform ${SLIDE_MS}ms ${SLIDE_EASING}`,
            }}
            className="absolute inset-0 bg-[radial-gradient(circle,rgba(80,68,229,0.13)_1.5px,transparent_1.6px)] bg-[length:26px_26px]"
          />
        </div>

        <div className="pointer-events-auto relative flex h-full flex-col items-center justify-center gap-6 px-12 text-center">
          {/* Both illustrations stay mounted and cross-fade, so switching
              never shows the gap of a fresh image decode. */}
          <div className="relative h-[38vh] max-h-[340px] w-full max-w-[300px]">
            {(['signin', 'signup'] as const).map((key) => (
              <Image
                key={key}
                src={PANEL[key].illustration}
                alt=""
                fill
                priority
                sizes="(max-width: 1024px) 0px, 300px"
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
