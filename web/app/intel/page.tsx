import type { Metadata } from 'next';
import { BarChart3, Bell, Download, LayoutGrid, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { WaitlistForm } from '@/components/market-intel/WaitlistForm';
import config from '@/config';

export const metadata: Metadata = {
  title: `JobLo Market Intel | ${config.title}`,
  description:
    'Pricing, catalog, and positioning intelligence across Pakistan’s e-commerce marketplaces, for marketing research.',
};

const FEATURES = [
  {
    icon: LayoutGrid,
    title: 'Catalog tracking',
    description: 'Structured product data across marketplaces - price, brand, seller, stock status.',
  },
  {
    icon: TrendingUp,
    title: 'Price history & alerts',
    description: 'See trends over time, and get notified when a tracked price moves.',
  },
  {
    icon: Bell,
    title: 'Watchlists',
    description: 'Track a specific brand, seller, or product set instead of the whole catalog.',
  },
  {
    icon: Download,
    title: 'Export & digest',
    description: 'CSV export, or a scheduled email summary of what changed.',
  },
] as const;

export default function MarketIntelLandingPage() {
  return (
    <main className="min-h-[60vh] bg-background">
      <div className="border-b bg-muted/20">
        <div className="container mx-auto px-4 py-16">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BarChart3 aria-hidden="true" className="h-6 w-6" />
            </div>
            <p className="mt-4 font-semibold text-primary text-xs uppercase tracking-wider">
              JobLo Market Intel
            </p>
            <h1 className="mt-2 font-bold text-3xl text-zinc-900 tracking-tight sm:text-4xl dark:text-zinc-50">
              Know what your competitors charge, before your customers tell you.
            </h1>
            <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
              Pricing, catalog, and positioning intelligence across Pakistan&rsquo;s
              e-commerce marketplaces - built for marketing research.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                href="/intel/sign-up"
              >
                Create free account
              </Link>
              <Link
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                href="/intel/sign-in"
              >
                Sign in
              </Link>
            </div>
            <div className="mt-4 flex justify-center">
              <WaitlistForm />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center font-semibold text-xl tracking-tight">
            What you get
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/60" key={title}>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </div>
                <p className="mt-3 font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                  {title}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {description}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-dashed border-zinc-200 p-5 text-center dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                Sources tracked:
              </span>{' '}
              PriceOye.pk and Telemart.pk (more marketplaces coming soon)
            </p>
          </div>

          <div className="mt-10 text-center">
            <WaitlistForm />
            <p className="mt-3 text-sm text-zinc-500">
              We&apos;re building this out - join the list and we&apos;ll email you
              as soon as it&apos;s ready.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
