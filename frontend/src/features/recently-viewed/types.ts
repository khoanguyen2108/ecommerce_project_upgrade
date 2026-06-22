export interface RecentlyViewedProduct {
  id: string;
  slug: string;
  name: string;
  price: number;
  imageUrl?: string;
  categoryName?: string;
  viewedAt: string;
}
