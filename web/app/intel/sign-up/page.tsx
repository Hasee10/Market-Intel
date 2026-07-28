import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { MarketIntelSignUpForm } from '@/components/auth/MarketIntelSignUpForm';
import config from '@/config';

export const metadata: Metadata = {
  title: `Market Intel Sign Up | ${config.title}`,
  description: 'Create a Market Intel account to track pricing and catalogs across Pakistan’s marketplaces.',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function MarketIntelSignUpPage() {
  return (
    <main className="min-h-[60vh] bg-background py-16">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-8 max-w-md text-center">
          <h1 className="font-bold text-2xl">Create a Market Intel account</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Track pricing, catalog, and stock changes across Pakistan&rsquo;s e-commerce marketplaces.
          </p>
        </div>
        <Suspense fallback={null}>
          <MarketIntelSignUpForm />
        </Suspense>
        <p className="mt-6 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{' '}
          <Link className="underline hover:no-underline" href="/intel/sign-in">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
