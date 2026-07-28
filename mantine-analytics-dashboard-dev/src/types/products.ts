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
  stockQty: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
