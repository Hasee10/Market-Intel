import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { Card } from '@/components/ui/Card';
import { ProductsTable } from '@/components/marketintel/ProductsTable';

// Products is now a Server Component (see page.tsx's header comment) -
// without this, there is nothing for Next to show between the click and the
// fetch resolving. See dashboard/overview/loading.tsx for why that dead
// interval is most of what "the app feels slow" means.
//
// stats={0}: this page has no KPI row. blocks={0}: PageSkeleton's block
// shape is a chart card, and the real content here is a table - reusing
// ProductsTable's own `loading` skeleton (the exact rows it rendered while
// this page fetched client-side, before this change) is a closer match than
// forcing a chart-shaped placeholder to stand in for a table.
export default function Loading() {
  return (
    <>
      <PageSkeleton stats={0} blocks={0} />
      <Card>
        <ProductsTable data={[]} loading />
      </Card>
    </>
  );
}
