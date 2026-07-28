export interface CustomerDto {
  id: string;
  externalCustomerId: string | null;
  email: string | null;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  ordersCount: number;
  totalSpent: number;
  createdAt: string;
  updatedAt: string;
}
