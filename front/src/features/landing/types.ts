export interface FeaturedCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  featuredOrder: number | null;
}
