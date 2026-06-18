"use client";

import {
  Headphones,
  RotateCcw,
  ShieldCheck,
  Truck,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ProductCard } from "@/components/catalog/ProductCard";
import { getProducts } from "@/features/catalog/api";
import type { Product } from "@/features/catalog/types";
import { getLandingPage } from "@/features/landing/api";
import type {
  FeaturedCategory,
  LandingHero,
} from "@/features/landing/types";
import { ApiClientError } from "@/lib/errors/api-error";

interface LandingCatalogState {
  featuredCategories: FeaturedCategory[];
  hero: LandingHero;
  products: Product[];
  error?: string;
  isLoading: boolean;
}

const FALLBACK_HERO_IMAGE =
  "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1800&q=85";

const FALLBACK_HERO: LandingHero = {
  heroImageUrl: null,
  heroEyebrow: "New season essentials",
  heroTitle: "Elevate your everyday wardrobe",
  heroSubtitle:
    "Crisp cotton, soft tailoring, and easy layers selected for real days, repeat wear, and clean silhouettes.",
};

export function LandingPage() {
  const [catalog, setCatalog] = useState<LandingCatalogState>({
    featuredCategories: [],
    hero: FALLBACK_HERO,
    products: [],
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      try {
        const [landingPage, productsResponse] = await Promise.all([
          getLandingPage(),
          getProducts({ limit: 8, sort: "newest" }),
        ]);

        if (!isMounted) {
          return;
        }

        setCatalog({
          featuredCategories: landingPage.featuredCategories,
          hero: landingPage.hero,
          products: productsResponse.products,
          isLoading: false,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setCatalog({
          featuredCategories: [],
          hero: FALLBACK_HERO,
          products: [],
          error: getCatalogErrorMessage(error),
          isLoading: false,
        });
      }
    }

    void loadCatalog();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main>
      <section className="hero-section" aria-labelledby="hero-heading">
        <img
          alt="Models wearing minimalist neutral clothing in a fashion campaign"
          className="hero-section__image"
          src={catalog.hero.heroImageUrl || FALLBACK_HERO_IMAGE}
        />
        <div className="hero-section__shade" />
        <div className="hero-section__content">
          <p className="eyebrow">{catalog.hero.heroEyebrow}</p>
          <h1 id="hero-heading">{catalog.hero.heroTitle}</h1>
          <p>{catalog.hero.heroSubtitle}</p>
          <div className="hero-section__actions">
            <Link className="button button--primary" href="#new-arrivals">
              Explore products <ArrowRight size={18} />
            </Link>
            <Link className="button button--secondary button--on-image" href="#categories">
              Browse categories
            </Link>
          </div>
        </div>
      </section>

      <section className="section section--categories" id="categories">
        <div className="section-heading section-heading--center">
          <p className="eyebrow">Shop by edit</p>
          <h2>Featured categories</h2>
        </div>
        <div className="category-grid">
          {catalog.isLoading ? <CatalogSkeleton count={3} /> : null}
          {!catalog.isLoading && catalog.error ? (
            <CatalogStateMessage message={catalog.error} />
          ) : null}
          {!catalog.isLoading && !catalog.error && catalog.featuredCategories.length === 0 ? (
            <CatalogStateMessage message="No featured categories are available yet." />
          ) : null}
          {!catalog.isLoading && !catalog.error
            ? catalog.featuredCategories.slice(0, 3).map((category) => (
                <CategoryTile category={category} key={category.id} />
              ))
            : null}
        </div>
      </section>

      <section className="section section--muted" id="new-arrivals">
        <div className="section-heading section-heading--split">
          <div>
            <p className="eyebrow">Just landed</p>
            <h2>New arrivals</h2>
          </div>
          <Link className="text-link" href="/products">
            View all
          </Link>
        </div>
        <div className="product-grid">
          {catalog.isLoading ? <CatalogSkeleton count={4} /> : null}
          {!catalog.isLoading && catalog.error ? (
            <CatalogStateMessage message={catalog.error} />
          ) : null}
          {!catalog.isLoading && !catalog.error && catalog.products.length === 0 ? (
            <CatalogStateMessage message="No products are available yet." />
          ) : null}
          {!catalog.isLoading && !catalog.error
            ? catalog.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))
            : null}
        </div>
      </section>

      <section className="section trust-section" id="trust">
        <div className="trust-grid">
          <TrustItem
            icon={<Truck size={24} />}
            title="Fast delivery"
            text="Packed within one business day for in-stock items."
          />
          <TrustItem
            icon={<RotateCcw size={24} />}
            title="Easy returns"
            text="Seven-day return window for unworn items with tags."
          />
          <TrustItem
            icon={<ShieldCheck size={24} />}
            title="Checkout coming soon"
            text="Cart and payment will open after the backend APIs are ready."
          />
          <TrustItem
            icon={<Headphones size={24} />}
            title="Support"
            text="Human help for sizing, delivery, and account questions."
          />
        </div>
      </section>

      <section className="campaign-band" id="delivery">
        <div>
          <p className="eyebrow">Weekend edit</p>
          <h2>Soft structure for long city days</h2>
          <p>
            Layer quiet textures, neutral tones, and reliable cuts without
            making the outfit feel overworked.
          </p>
        </div>
        <Link className="button button--light" href="/products">
          Shop the edit
        </Link>
      </section>
    </main>
  );
}

interface TrustItemProps {
  icon: ReactNode;
  title: string;
  text: string;
}

function TrustItem({ icon, title, text }: TrustItemProps) {
  return (
    <article className="trust-item">
      <div className="trust-item__icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
    </article>
  );
}

function CategoryTile({
  category,
}: {
  category: FeaturedCategory;
}) {
  return (
    <Link className="category-tile" href={`/categories/${category.slug}`}>
      {category.imageUrl ? (
        <img
          alt={`${category.name} category`}
          className="category-tile__image"
          loading="lazy"
          src={category.imageUrl}
        />
      ) : (
        <div className="category-tile__fallback" aria-hidden="true" />
      )}
      <div className="category-tile__label">
        <h3>{category.name}</h3>
        <p>{category.description || "Explore this Belikeme category."}</p>
      </div>
    </Link>
  );
}

function CatalogSkeleton({ count }: { count: number }) {
  return Array.from({ length: count }, (_, index) => (
    <div aria-hidden="true" className="catalog-skeleton" key={index} />
  ));
}

function CatalogStateMessage({ message }: { message: string }) {
  return (
    <div className="catalog-state" role="status">
      {message}
    </div>
  );
}

function getCatalogErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "The catalog could not be loaded right now. Please try again soon.";
}
