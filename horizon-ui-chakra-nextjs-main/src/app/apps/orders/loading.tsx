import { Card } from '@/components/ui/Card';
import { OrdersTable } from '@/components/marketintel/OrdersTable';

// See dashboard/overview/loading.tsx for why a Server Component route needs
// one of these.
export default function Loading() {
  return (
    <Card>
      <OrdersTable data={[]} loading />
    </Card>
  );
}
