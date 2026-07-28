import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { MarketIntelSignInForm } from '@/components/auth/MarketIntelSignInForm';
import config from '@/config';

export const metadata: Metadata = {
  title: `Market Intel Sign In | ${config.title}`,
  description: 'Sign in to your Market Intel dashboard.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function MarketIntelSignInPage() {
  return (
    <main className="min-h-[60vh] bg-background py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-8 max-w-md text-center">
          <h1 className="font-bold text-2xl">Market Intel sign in</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Access your dashboard to track prices and catalogs across Pakistan&rsquo;s marketplaces.
          </p>
        </div>
        <Suspense fallback={null}>
          <MarketIntelSignInForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Don&apos;t have an account?{' '}
          <Link className="underline hover:no-underline" href="/intel/sign-up">
            Sign up free
          </Link>
        </p>
      </div>
    </main>
  );
}
