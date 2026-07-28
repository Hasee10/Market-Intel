import { ArrowRight, BarChart3 } from 'lucide-react';
import Link from 'next/link';

export function MarketIntelBanner() {
  return (
    <div className="border-t bg-primary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <BarChart3 aria-hidden="true" className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-50">
                Also tracking Pakistan&rsquo;s e-commerce market?
              </p>
              <p className="mt-0.5 text-muted-foreground text-sm">
                Meet JobLo Market Intel - pricing and catalog tracking across marketplaces.
              </p>
            </div>
          </div>
          <Link
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-primary/30 px-4 py-2 font-medium text-primary text-sm transition-colors hover:bg-primary/10"
            href="/intel"
          >
            Explore Market Intel
            <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
