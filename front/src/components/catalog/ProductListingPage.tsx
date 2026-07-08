"use client";

import { AlertCircle, RotateCcw, Search } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { ProductCard } from "@/components/catalog/ProductCard";
import { getCategories, getProducts } from "@/features/catalog/api";
import type {
  Category,
  Pagination,
  Product,
  ProductQuery,
} from "@/features/catalog/types";
import { ApiClientError } from "@/lib/errors/api-error";

const PRODUCT_LIMIT = 12;

interface ProductListingPageProps {
  initialQuery: ProductQuery;
}

export function ProductListingPage({ initialQuery }: ProductListingPageProps) {
  const [query, setQuery] = useState<ProductQuery>({
    ...initialQuery,
    limit: PRODUCT_LIMIT,
    page: initialQuery.page || 1,
  });
  const [searchInput, setSearchInput] = useState(initialQuery.search || "");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    limit: PRODUCT_LIMIT,
    page: query.page || 1,
    total: 0,
    totalPages: 1,
  });
  const [categoryError, setCategoryError] = useState<string>();
  const [productError, setProductError] = useState<string>();
  const [isCategoryLoading, setIsCategoryLoading] = useState(true);
  const [isProductLoading, setIsProductLoading] = useState(true);
  const [productRequestKey, setProductRequestKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      try {
        const response = await getCategories();

        if (isMounted) {
          setCategories(response);
          setCategoryError(undefined);
        }
      } catch (error) {
        if (isMounted) {
          setCategoryError(getCatalogErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsCategoryLoading(false);
        }
      }
    }

    void loadCategories();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      setIsProductLoading(true);
      setProductError(undefined);

      try {
        const response = await getProducts(query);

        if (isMounted) {
          setProducts(response.products);
          setPagination(response.pagination);
        }
      } catch (error) {
        if (isMounted) {
          setProducts([]);
          setProductError(getCatalogErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setIsProductLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isMounted = false;
    };
  }, [productRequestKey, query]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setQuery((current) => ({
      ...current,
      page: 1,
      search: searchInput.trim() || undefined,
    }));
  }

  function handleCategoryChange(categorySlug: string) {
    setQuery((current) => ({
      ...current,
      categorySlug: categorySlug || undefined,
      page: 1,
    }));
  }

  function handleSortChange(sort: ProductQuery["sort"] | "") {
    setQuery((current) => ({
      ...current,
      page: 1,
      sort: sort || undefined,
    }));
  }

  function handleReset() {
    setSearchInput("");
    setQuery({
      limit: PRODUCT_LIMIT,
      page: 1,
    });
  }

  function goToPage(page: number) {
    setQuery((current) => ({
      ...current,
      page,
    }));
  }

  const activeCategoryName =
    categories.find((category) => category.slug === query.categorySlug)?.name ||
    query.categorySlug;
  const resultsHeading = activeCategoryName
    ? activeCategoryName
    : query.search
      ? "Search results"
      : "All products";
  const hasActiveFilters = Boolean(
    query.categorySlug || query.search || (query.sort && query.sort !== "newest"),
  );

  return (
    <main className="catalog-page catalog-page--shop">
      <section className="catalog-shell" aria-label="Product catalog">
        <form className="catalog-controls" onSubmit={handleSearchSubmit}>
          <div className="catalog-control catalog-control--search">
            <label htmlFor="product-search">Search</label>
            <div className="catalog-search-row">
              <input
                id="product-search"
                name="search"
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search products"
                type="search"
                value={searchInput}
              />
              <button
                aria-label="Search products"
                className="catalog-search-button"
                type="submit"
              >
                <Search aria-hidden="true" size={18} />
                <span>Search</span>
              </button>
            </div>
          </div>

          <label className="catalog-control">
            <span>Category</span>
            <select
              disabled={isCategoryLoading || Boolean(categoryError)}
              onChange={(event) => handleCategoryChange(event.target.value)}
              value={query.categorySlug || ""}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="catalog-control">
            <span>Sort by</span>
            <select
              onChange={(event) =>
                handleSortChange(event.target.value as ProductQuery["sort"] | "")
              }
              value={query.sort || "newest"}
            >
              <option value="newest">Newest</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </label>

          <button
            className="catalog-reset"
            disabled={!hasActiveFilters || isProductLoading}
            onClick={handleReset}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={16} />
            Reset
          </button>
        </form>

        {categoryError ? (
          <div className="catalog-inline-alert" role="status">
            Categories could not be loaded. Product results are still available.
          </div>
        ) : null}

        <div className="catalog-results-heading">
          <div>
            <p className="eyebrow">Collection</p>
            <h2>{resultsHeading}</h2>
          </div>
        </div>

        {productError ? (
          <div className="catalog-error catalog-error--shop" role="alert">
            <AlertCircle aria-hidden="true" size={20} />
            <div>
              <strong>Products could not be loaded</strong>
              <span>{productError}</span>
            </div>
            <button
              className="button button--secondary"
              onClick={() => setProductRequestKey((current) => current + 1)}
              type="button"
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="product-grid catalog-product-grid">
          {isProductLoading ? <CatalogSkeleton count={PRODUCT_LIMIT} /> : null}
          {!isProductLoading && !productError && products.length === 0 ? (
            <div className="catalog-state catalog-state--shop" role="status">
              <p className="eyebrow">Nothing here yet</p>
              <h2>No products found</h2>
              <p>Try a different search or reset the current filters.</p>
              {hasActiveFilters ? (
                <button
                  className="button button--secondary"
                  onClick={handleReset}
                  type="button"
                >
                  Reset filters
                </button>
              ) : null}
            </div>
          ) : null}
          {!isProductLoading && !productError
            ? products.map((product) => (
                <ProductCard key={product.id} product={product} variant="shop" />
              ))
            : null}
        </div>

        {!productError && pagination.totalPages > 1 ? (
          <div className="catalog-pagination" aria-label="Product pagination">
            <button
              className="button button--secondary"
              disabled={isProductLoading || pagination.page <= 1}
              onClick={() => goToPage(Math.max(1, pagination.page - 1))}
              type="button"
            >
              Previous
            </button>
            <span>
              Page {pagination.page} of {Math.max(1, pagination.totalPages)}
            </span>
            <button
              className="button button--secondary"
              disabled={
                isProductLoading ||
                pagination.page >= Math.max(1, pagination.totalPages)
              }
              onClick={() => goToPage(pagination.page + 1)}
              type="button"
            >
              Next
            </button>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function CatalogSkeleton({ count }: { count: number }) {
  return Array.from({ length: count }, (_, index) => (
    <div aria-hidden="true" className="catalog-skeleton" key={index}>
      <div className="catalog-skeleton__image" />
      <div className="catalog-skeleton__line catalog-skeleton__line--short" />
      <div className="catalog-skeleton__line" />
      <div className="catalog-skeleton__line catalog-skeleton__line--price" />
    </div>
  ));
}

function getCatalogErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "The catalog could not be loaded right now. Please try again soon.";
}
