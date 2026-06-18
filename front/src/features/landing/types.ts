export interface LandingHero {
  heroImageUrl: string | null;
  heroEyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
}

export interface FeaturedCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  featuredOrder: number | null;
}

export interface LandingPageData {
  hero: LandingHero;
  featuredCategories: FeaturedCategory[];
}
