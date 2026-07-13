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
import { useI18n } from "@/features/i18n/useI18n";
import { ApiClientError } from "@/lib/errors/api-error";

interface LandingCatalogState {
  featuredCategories: FeaturedCategory[];
  products: Product[];
  error?: string;
  isLoading: boolean;
}

const LANDING_HERO_VIDEO_SRC = "/images/landing/landing-hero.mp4";
const LANDING_EDITORIAL_IMAGE_SRC = "/images/landing/landing-editorial.jpg";
export function LandingPage() {
  const { t } = useI18n();
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
          <p className="eyebrow">{t("landing.heroEyebrow")}</p>
          <h1 id="hero-heading">{t("landing.heroTitle")}</h1>
          <p>{t("landing.heroSubtitle")}</p>
          <div className="hero-section__actions">
            <Link className="button button--primary" href="#new-arrivals">
              {t("landing.exploreProducts")} <ArrowRight size={18} />
            </Link>
            <Link className="button button--secondary button--on-image" href="#categories">
              {t("landing.browseCategories")}
            </Link>
          </div>
        </div>
      </section>

      <section className="section section--categories" id="categories">
        <div className="section-heading section-heading--center">
          <h2>{t("landing.featuredCategories")}</h2>
        </div>
        <div className="category-grid">
          {catalog.isLoading ? <CatalogSkeleton count={3} /> : null}
          {!catalog.isLoading && catalog.error ? (
            <CatalogStateMessage message={catalog.error} />
          ) : null}
          {!catalog.isLoading && !catalog.error && catalog.featuredCategories.length === 0 ? (
            <CatalogStateMessage message={t("landing.noFeaturedCategories")} />
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
            <p className="eyebrow">{t("landing.justLanded")}</p>
            <h2>{t("landing.newArrivals")}</h2>
          </div>
          <Link className="text-link" href="/products">
            {t("landing.viewAll")}
          </Link>
        </div>
        <div className="product-grid">
          {catalog.isLoading ? <CatalogSkeleton count={4} /> : null}
          {!catalog.isLoading && catalog.error ? (
            <CatalogStateMessage message={catalog.error} />
          ) : null}
          {!catalog.isLoading && !catalog.error && catalog.products.length === 0 ? (
            <CatalogStateMessage message={t("landing.noProducts")} />
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
          <h2>{t("landing.campaignTitle")}</h2>
          <p>{t("landing.campaignBody")}</p>
          <Link className="button button--light" href="/products">
            {t("landing.shopEdit")}
          </Link>
        </div>
        <div className="campaign-band__image-wrap">
          <img
            alt={t("landing.editorialAlt")}
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
            alt={t("landing.aboutAlt")}
            className="landing-about__image"
            loading="lazy"
            src="/images/landing/aboutus.jpg"
          />
        </div>
        <div className="landing-about__content">
          <h2 id="about-heading">{t("landing.aboutTitle")}</h2>
          <p>{t("landing.aboutP1")}</p>
          <p>{t("landing.aboutP2")}</p>
          <p>{t("landing.aboutP3")}</p>
          <p>{t("landing.aboutP4")}</p>
          <p className="landing-about__closing">
            {t("landing.aboutClosing")}
          </p>
          <Link className="button button--primary" href="/products">
            {t("landing.shopBelikeme")}
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
  const { t } = useI18n();

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
        <p>{category.description || t("landing.categoryFallback")}</p>
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
