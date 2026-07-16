"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getCategories } from "@/features/catalog/api";
import {
  localizeCategoryDescription,
  localizeCategoryName,
} from "@/features/catalog/localization";
import type { Category } from "@/features/catalog/types";
import { useI18n } from "@/features/i18n/useI18n";
import { ApiClientError } from "@/lib/errors/api-error";

interface CategoriesState {
  categories: Category[];
  error?: string;
  isLoading: boolean;
}

export function CategoriesPage() {
  const { t } = useI18n();
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<CategoriesState>({
    categories: [],
    isLoading: true,
  });

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      setState((current) => ({
        ...current,
        error: undefined,
        isLoading: true,
      }));

      try {
        const categories = await getCategories();

        if (isMounted) {
          setState({ categories, isLoading: false });
        }
      } catch (error) {
        if (isMounted) {
          setState({
            categories: [],
            error: getCategoriesErrorMessage(error),
            isLoading: false,
          });
        }
      }
    }

    void loadCategories();

    return () => {
      isMounted = false;
    };
  }, [requestKey]);

  const categories = useMemo(
    () => [...state.categories].sort(compareCategories),
    [state.categories],
  );

  return (
    <main className="categories-page">
      <section aria-label={t("catalog.allCategories")}>
        {state.isLoading ? (
          <div
            aria-busy="true"
            aria-label={t("catalog.loadingAllCategories")}
            className="categories-grid"
          >
            <CategoriesSkeleton count={8} />
          </div>
        ) : null}

        {!state.isLoading && state.error ? (
          <div className="categories-state categories-state--error" role="alert">
            <AlertCircle aria-hidden="true" size={22} strokeWidth={1.7} />
            <div>
              <p className="eyebrow">{t("catalog.unableCategories")}</p>
              <h2>{t("catalog.interrupted")}</h2>
              <p>{state.error}</p>
            </div>
            <button
              className="button button--secondary"
              onClick={() => setRequestKey((current) => current + 1)}
              type="button"
            >
              {t("common.retry")}
            </button>
          </div>
        ) : null}

        {!state.isLoading && !state.error && categories.length === 0 ? (
          <div className="categories-state" role="status">
            <p className="eyebrow">{t("nav.categories")}</p>
            <h2>{t("catalog.noCategories")}</h2>
            <p>{t("catalog.noCategoriesBody")}</p>
          </div>
        ) : null}

        {!state.isLoading && !state.error && categories.length > 0 ? (
          <div className="categories-grid">
            {categories.map((category) => (
              <CategoryCard category={category} key={category.id} />
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}

function CategoryCard({ category }: { category: Category }) {
  const { locale, t } = useI18n();
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(category.imageUrl) && !imageFailed;
  const categoryName = localizeCategoryName(category.name, locale);
  const categoryDescription = localizeCategoryDescription(
    category.description,
    locale,
  );

  return (
    <article className="categories-card">
      <Link href={getCategoryProductsHref(category.slug)}>
        <div className="categories-card__media">
          {showImage ? (
            <img
              alt={`${categoryName} · ${t("catalog.category")}`}
              className="categories-card__image"
              loading="lazy"
              onError={() => setImageFailed(true)}
              src={category.imageUrl || undefined}
            />
          ) : (
            <div className="categories-card__fallback" aria-hidden="true">
              <span>{categoryName}</span>
            </div>
          )}
          {category.isFeatured ? (
            <span className="categories-card__badge">{t("common.featured")}</span>
          ) : null}
        </div>

        <div className="categories-card__body">
          <h2>{categoryName}</h2>
          {categoryDescription ? <p>{categoryDescription}</p> : null}
        </div>
      </Link>
    </article>
  );
}
function getCategoryProductsHref(slug: string): string {
  return `/products?categorySlug=${encodeURIComponent(slug)}`;
}

function CategoriesSkeleton({ count }: { count: number }) {
  return Array.from({ length: count }, (_, index) => (
    <div aria-hidden="true" className="categories-skeleton" key={index}>
      <div className="categories-skeleton__image" />
      <div className="categories-skeleton__line categories-skeleton__line--title" />
      <div className="categories-skeleton__line" />
      <div className="categories-skeleton__line categories-skeleton__line--action" />
    </div>
  ));
}

function compareCategories(first: Category, second: Category): number {
  if (first.isFeatured !== second.isFeatured) {
    return first.isFeatured ? -1 : 1;
  }

  if (first.isFeatured && second.isFeatured) {
    const firstOrder = first.featuredOrder ?? Number.MAX_SAFE_INTEGER;
    const secondOrder = second.featuredOrder ?? Number.MAX_SAFE_INTEGER;

    if (firstOrder !== secondOrder) {
      return firstOrder - secondOrder;
    }
  }

  return first.name.localeCompare(second.name);
}

function getCategoriesErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "The categories could not be loaded right now. Please try again soon.";
}
