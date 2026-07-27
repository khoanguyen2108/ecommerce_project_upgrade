"use client";

import { AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "@/components/catalog/ProductCard";
import { getCategoryBySlug, getProducts } from "@/features/catalog/api";
import type {
  Category,
  Pagination,
  Product,
} from "@/features/catalog/types";
import { ApiClientError } from "@/lib/errors/api-error";

const CATEGORY_PRODUCT_LIMIT = 12;

interface CategoryDetailPageProps {
  slug: string;
}

interface CategoryDetailState {
  category?: Category;
  error?: string;
  isLoading: boolean;
  isNotFound: boolean;
  pagination: Pagination;
  products: Product[];
}

export function CategoryDetailPage({ slug }: CategoryDetailPageProps) {
  const [page, setPage] = useState(1);
  const [state, setState] = useState<CategoryDetailState>({
    isLoading: true,
    isNotFound: false,
    pagination: getDefaultPagination(1),
    products: [],
  });

  useEffect(() => {
    setPage(1);
  }, [slug]);

  useEffect(() => {
    let isMounted = true;

    async function loadCategoryDetail() {
      setState((current) => ({
        ...current,
        error: undefined,
        isLoading: true,
        isNotFound: false,
      }));

      const [categoryResult, productsResult] = await Promise.allSettled([
        getCategoryBySlug(slug),
        getProducts({
          categorySlug: slug,
          limit: CATEGORY_PRODUCT_LIMIT,
          page,
          sort: "newest",
        }),
      ]);

      if (!isMounted) {
        return;
      }

      if (categoryResult.status === "rejected") {
        setState({
          error: getCatalogErrorMessage(categoryResult.reason),
          isLoading: false,
          isNotFound: isCategoryNotFound(categoryResult.reason),
          pagination: getDefaultPagination(page),
          products: [],
        });
        return;
      }

      if (productsResult.status === "rejected") {
        setState({
          category: categoryResult.value,
          error: getCatalogErrorMessage(productsResult.reason),
          isLoading: false,
          isNotFound: false,
          pagination: getDefaultPagination(page),
          products: [],
        });
        return;
      }

      setState({
        category: categoryResult.value,
        isLoading: false,
        isNotFound: false,
        pagination: productsResult.value.pagination,
        products: productsResult.value.products,
      });
    }

    void loadCategoryDetail();

    return () => {
      isMounted = false;
    };
  }, [page, slug]);

  const productCountLabel = useMemo(() => {
    const total = state.pagination.total;

    if (total === 1) {
      return `1 ${"product"}`;
    }

    return `${total} ${"products"}`;
  }, [state.pagination.total]);

  if (state.isLoading) {
    return (
      <main className="catalog-page">
        <section className="catalog-hero">
          <p className="eyebrow">{"Category"}</p>
          <h1>{"Loading category..."}</h1>
          <p>{"Finding the latest pieces in this Belikeme edit."}</p>
        </section>

        <section className="catalog-shell" aria-busy="true" aria-live="polite">
          <div className="product-grid">
            <CatalogSkeleton count={CATEGORY_PRODUCT_LIMIT} />
          </div>
        </section>
      </main>
    );
  }

  if (state.isNotFound) {
    return (
      <main className="catalog-page">
        <section className="catalog-hero">
          <p className="eyebrow">{"Category not found"}</p>
          <h1>{"This edit is not available"}</h1>
          <p>{"The category may have been renamed or hidden. The full product catalog is still ready to browse."}</p>
        </section>

        <Link className="button button--secondary" href="/products">
          <ArrowLeft size={18} />
          {"Back to products"}
        </Link>
      </main>
    );
  }

  if (!state.category) {
    return (
      <main className="catalog-page">
        <section className="catalog-hero">
          <p className="eyebrow">{"Category"}</p>
          <h1>{"We could not load this category"}</h1>
          <p>{"Please try again from the product catalog."}</p>
        </section>

        <div className="catalog-error" role="alert">
          <AlertCircle size={20} />
          <span>
            {state.error ||
              "Please try again from the product catalog."}
          </span>
        </div>

        <Link className="button button--secondary" href="/products">
          <ArrowLeft size={18} />
          {"Back to products"}
        </Link>
      </main>
    );
  }

  const totalPages = Math.max(1, state.pagination.totalPages);
  const categoryName = (state.category.name ?? "");
  const categoryDescription = (state.category.description ?? null);

  return (
    <main className="catalog-page catalog-page--category-detail">
      <section
        className="catalog-shell catalog-shell--category-detail"
        aria-labelledby="category-products-heading"
      >
        <header className="category-detail-header">
          <div className="category-detail-header__copy">
            <div className="category-detail-header__meta">
              <p className="eyebrow">{"Category"}</p>
              <span>{productCountLabel}</span>
            </div>
            <h1 id="category-products-heading">{categoryName}</h1>
            {categoryDescription ? (
              <p className="category-detail-header__description">
                {categoryDescription}
              </p>
            ) : null}
          </div>

          <Link
            className="button button--secondary category-detail-header__action"
            href={`/products?categorySlug=${encodeURIComponent(state.category.slug)}`}
          >
            {"Filter catalog"}
            <ArrowRight size={18} />
          </Link>
        </header>

        {state.error ? (
          <div className="catalog-error" role="alert">
            <AlertCircle size={20} />
            <span>{state.error}</span>
          </div>
        ) : null}

        {!state.error ? (
          <div className="product-grid">
            {state.products.length === 0 ? (
              <div className="catalog-state" role="status">
                {"No active products are available in this category yet."}
              </div>
            ) : (
              state.products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))
            )}
          </div>
        ) : null}

        {!state.error && totalPages > 1 ? (
          <div className="catalog-pagination" aria-label={"Product pagination"}>
            <button
              className="button button--secondary"
              disabled={page <= 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              type="button"
            >
              {"Previous"}
            </button>
            <span>
              {"Page"} {state.pagination.page} {"of"} {totalPages}
            </span>
            <button
              className="button button--secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
              type="button"
            >
              {"Next"}
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function CatalogSkeleton({ count }: { count: number }) {
  return Array.from({ length: count }, (_, index) => (
    <div aria-hidden="true" className="catalog-skeleton" key={index} />
  ));
}

function getDefaultPagination(page: number): Pagination {
  return {
    limit: CATEGORY_PRODUCT_LIMIT,
    page,
    total: 0,
    totalPages: 1,
  };
}

function getCatalogErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "The catalog could not be loaded right now. Please try again soon.";
}

function isCategoryNotFound(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    (error.code === "CATEGORY_NOT_FOUND" || error.status === 404)
  );
}
