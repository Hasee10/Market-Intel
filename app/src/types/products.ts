export interface IProductCategory {
  id: string;
  slug: string;
  name: string;
  productCount: number;
}

export interface IProduct {
  id: string;
  sku: string | null;
  title: string;
  categoryId: string | null;
  categoryName: string | null;
  costPrice: number | null;
  sellPrice: number | null;
  currency: string;
  stockQty: number | null;
  isActive: boolean;
  /**
   * Demand index 0-100 (lib/market-intel/market/demand-index.ts) - where the
   * product's best-matched listing sits within its category on sold count,
   * reviews and page position. Absent when the product has no confirmed
   * match, or when the caller didn't compute it.
   */
  demandIndex?: import('@/lib/market-intel/market/demand-index').DemandIndex | null;
  /** Optional seller-supplied image URL. Null falls back to the category tile. */
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// Common currencies for sellers outside the primary PKR market - not an
// exhaustive ISO 4217 list, just the ones this platform's actual markets
// are likely to need.
export const SUPPORTED_CURRENCIES = [
  { code: 'PKR', label: 'PKR - Pakistani Rupee' },
  { code: 'USD', label: 'USD - US Dollar' },
  { code: 'EUR', label: 'EUR - Euro' },
  { code: 'GBP', label: 'GBP - British Pound' },
  { code: 'AED', label: 'AED - UAE Dirham' },
  { code: 'SAR', label: 'SAR - Saudi Riyal' },
  { code: 'INR', label: 'INR - Indian Rupee' },
] as const;
