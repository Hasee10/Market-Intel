export interface OrderDto {
  id: string;
  customerId: string | null;
  customerLabel: string | null;
  externalOrderId: string | null;
  orderDate: string;
  totalAmount: number;
  currency: string;
  status: string | null;
  createdAt: string;
}
