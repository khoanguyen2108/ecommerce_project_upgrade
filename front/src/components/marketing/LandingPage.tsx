"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/catalog/ProductCard";
import { LandingInspirationGallery } from "@/components/landing/LandingInspirationGallery";
import { getProducts } from "@/features/catalog/api";
import type { Product } from "@/features/catalog/types";
import { getFeaturedCategories } from "@/features/landing/api";
import type { FeaturedCategory } from "@/features/landing/types";
import { ApiClientError } from "@/lib/errors/api-error";

interface LandingCatalogState {
  featuredCategories: FeaturedCategory[];
  products: Product[];
  error?: string;
  isLoading: boolean;
}

const LANDING_HERO_VIDEO_SRC = "/images/landing/landing-hero.mp4";
const LANDING_EDITORIAL_IMAGE_SRC = "/images/landing/landing-editorial.jpg";
const LANDING_HERO_COPY = {
  heroEyebrow: "New season essentials",
  heroTitle: "Elevate your everyday",
  heroSubtitle:
    "Pieces made for real days, quiet confidence, and the little moments that let your personality show",
};

export function LandingPage() {
  const [catalog, setCatalog] = useState<LandingCatalogState>({
    featuredCategories: [],
    products: [],
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadCatalog() {
      try {
        const [featuredCategories, productsResponse] = await Promise.all([
          getFeaturedCategories(),
          getProducts({ limit: 8, sort: "newest" }),
        ]);

        if (!isMounted) {
          return;
        }

        setCatalog({
          featuredCategories,
          products: productsResponse.products,
          isLoading: false,
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setCatalog({
          featuredCategories: [],
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
        <video
          aria-hidden="true"
          autoPlay
          className="hero-section__image"
          loop
          muted
          playsInline
        >
          <source src={LANDING_HERO_VIDEO_SRC} type="video/mp4" />
        </video>
        <div className="hero-section__shade" />
        <div className="hero-section__content">
          <p className="eyebrow">{LANDING_HERO_COPY.heroEyebrow}</p>
          <h1 id="hero-heading">{LANDING_HERO_COPY.heroTitle}</h1>
          <p>{LANDING_HERO_COPY.heroSubtitle}</p>
          <div className="hero-section__actions">
            <Link className="button button--primary" href="#new-arrivals">
              Explore Products <ArrowRight size={18} />
            </Link>
            <Link className="button button--secondary button--on-image" href="#categories">
              Browse Categories
            </Link>
          </div>
        </div>
      </section>

      <section className="section section--categories" id="categories">
        <div className="section-heading section-heading--center">
          <h2>Featured Categories</h2>
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
            <h2>New Arrivals</h2>
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

      <section className="campaign-band" id="delivery">
        <div className="campaign-band__copy">
          <h2>Made for the days you become yourself</h2>
          <p>
            Clean pieces, easy layers, and small details that move with your
            real life, from first plans to late-night walks.
          </p>
          <Link className="button button--light" href="/products">
            Shop the edit
          </Link>
        </div>
        <div className="campaign-band__image-wrap">
          <img
            alt="Belikeme editorial collage with monochrome youth styling"
            className="campaign-band__image"
            loading="lazy"
            src={LANDING_EDITORIAL_IMAGE_SRC}
          />
        </div>
      </section>

      <LandingInspirationGallery />

      <section className="landing-about" id="about" aria-labelledby="about-heading">
        <div className="landing-about__image-wrap">
          <img
            alt="Belikeme brand story in motion"
            className="landing-about__image"
            loading="lazy"
            src="/images/landing/aboutus.jpg"
          />
        </div>
        <div className="landing-about__content">
          <h2 id="about-heading">Be bold. Be real. Be like me.</h2>
          <p>
            Belikeme was created from the spirit of youth: the courage to try,
            to stand apart, and to live fully for what you believe in.
          </p>
          <p>
            We believe every young person carries their own color. Some shine
            through confidence, some through passion, and some through the quiet
            effort of becoming better every day.
          </p>
          <p>
            Belikeme is more than a fashion brand. It is a reminder that you do
            not have to look like anyone else to be seen.
          </p>
          <p>
            You only need to stay true to yourself, follow what you love, and
            proudly say: this is me.
          </p>
          <p className="landing-about__closing">
            We do not chase trends. We help you create your own mark.
          </p>
          <Link className="button button--primary" href="/products">
            SHOP BELIKEME
          </Link>
        </div>
      </section>
    </main>
  );
}

function CategoryTile({
  category,
}: {
  category: FeaturedCategory;
}) {
  return (
    <Link className="category-tile" href={getCategoryProductsHref(category.slug)}>
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

function getCategoryProductsHref(slug: string): string {
  return `/products?categorySlug=${encodeURIComponent(slug)}`;
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
