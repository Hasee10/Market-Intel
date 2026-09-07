import { ErrorAlert } from '@/components/marketintel/ErrorAlert';
import { getSellerOrders } from '@/lib/market-intel/seller/orders';
import { getCurrentSeller } from '@/lib/market-intel/seller/seller';

import OrdersView from './OrdersView';

// Server Component - same move as apps/products/page.tsx and
// apps/customers/page.tsx: the client-side useFetch('/api/orders') waterfall
// (auth round trip + query) is now one server-side fetch before render.
export default async function OrdersPage() {
  const seller = await getCurrentSeller();
  if (!seller) {
    return <ErrorAlert title="Error loading orders" message="Not authenticated" />;
  }

  try {
    const orders = await getSellerOrders(seller.id);
    return <OrdersView orders={orders} />;
  } catch (err) {
    return (
      <ErrorAlert
        title="Error loading orders"
        message={err instanceof Error ? err.message : 'Failed to fetch orders'}
      />
    );
  }
}
