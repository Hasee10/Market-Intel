import { PageSkeleton } from '@/components/ui/PageSkeleton';

// Overview fetches seven data sets server-side before returning any HTML
// (see page.tsx) - without this, Next has nothing to show between the link
// being clicked and that Promise.all resolving, and the browser sits on the
// previous page looking interactive but not responding. Every other
// server-rendered dashboard page already has this sibling; Overview was the
// one built as a client-fetching page and never got one.
//
// stats={4} matches primaryStats' fixed count. blocks={2} mirrors the first
// content row (revenue trend + order status, 2:1 split) - same
// approximation Market and Watchlist's own loading.tsx use, not a literal
// mirror of every section below it.
export default function Loading() {
  return <PageSkeleton stats={4} blocks={2} />;
}
