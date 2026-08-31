import { PageSkeleton } from '@/components/marketintel/PageSkeleton';

// Competitors runs the per-product candidate RPC fan-out, so it is the
// slowest page in the app even after the request-level deduping - the one
// where a frozen previous page was most noticeable.
export default function Loading() {
  return <PageSkeleton stats={4} blocks={1} />;
}
