import { PageSkeleton } from '@/components/marketintel/PageSkeleton';

// Market is the heaviest server-rendered page here (twelve concurrent
// queries, several of them RPCs over the scraped market tables) - the one
// that most needs to show something the instant the link is clicked.
export default function Loading() {
  return <PageSkeleton stats={4} blocks={2} />;
}
