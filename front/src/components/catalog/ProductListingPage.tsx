"use client";

import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
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
  const [areFiltersVisible, setAreFiltersVisible] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

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

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 820px)");

    function syncViewport(event?: MediaQueryListEvent) {
      const isMobile = event ? event.matches : mediaQuery.matches;

      setIsMobileViewport(isMobile);

      if (!isMobile) {
        setIsFilterDrawerOpen(false);
      }
    }

    syncViewport();
    if (!mediaQuery.matches) {
      setAreFiltersVisible(true);
    }

    mediaQuery.addEventListener("change", syncViewport);

    return () => {
      mediaQuery.removeEventListener("change", syncViewport);
    };
  }, []);

  useEffect(() => {
    if (!isFilterDrawerOpen) {
      return;
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFilterDrawerOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);

    return () => {
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isFilterDrawerOpen]);

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

    if (isMobileViewport) {
      setIsFilterDrawerOpen(false);
    }
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

    if (isMobileViewport) {
      setIsFilterDrawerOpen(false);
    }
  }

  function goToPage(page: number) {
    setQuery((current) => ({
      ...current,
      page,
    }));
  }

  function handleFilterToggle() {
    if (isMobileViewport) {
      setIsFilterDrawerOpen((current) => !current);
      return;
    }

    setAreFiltersVisible((current) => !current);
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
  const totalPages = Math.max(1, pagination.totalPages);
  const filtersToggleLabel =
    isMobileViewport
      ? isFilterDrawerOpen
        ? "Hide Filters"
        : "Show Filters"
      : areFiltersVisible
        ? "Hide Filters"
        : "Show Filters";
  const filterPanelIsVisible = isMobileViewport
    ? isFilterDrawerOpen
    : areFiltersVisible;

  return (
    <main className="catalog-page catalog-page--shop">
      <section
        className="catalog-shell catalog-shell--shop"
        aria-label="Product catalog"
      >
        <div className="catalog-listing-header">
          <div className="catalog-listing-heading">
            <h1>
              {resultsHeading}
              {!isProductLoading ? (
                <span className="catalog-heading-count">
                  ({pagination.total.toLocaleString()})
                </span>
              ) : null}
            </h1>
          </div>

          <div className="catalog-listing-actions">
            <form className="catalog-listing-search" onSubmit={handleSearchSubmit}>
              <div className="catalog-compact-search">
                <button
                  aria-label="Search products"
                  className="catalog-compact-search__button"
                  type="submit"
                >
                  <Search aria-hidden="true" size={19} strokeWidth={2} />
                </button>
                <input
                  aria-label="Search products"
                  id="product-search"
                  name="search"
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search"
                  type="search"
                  value={searchInput}
                />
              </div>
            </form>

            <button
              aria-expanded={filterPanelIsVisible}
              className="catalog-filter-toggle"
              onClick={handleFilterToggle}
              type="button"
            >
              <span>{filtersToggleLabel}</span>
              <SlidersHorizontal aria-hidden="true" size={20} strokeWidth={1.8} />
            </button>

            <label className="catalog-sort-control">
              <span>Sort By</span>
              <select
                aria-label="Sort products"
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
          </div>
        </div>

        {categoryError ? (
          <div className="catalog-inline-alert" role="status">
            Categories could not be loaded. Product results are still available.
          </div>
        ) : null}

        {isFilterDrawerOpen ? (
          <button
            aria-label="Close filters"
            className="catalog-filter-backdrop"
            onClick={() => setIsFilterDrawerOpen(false)}
            type="button"
          />
        ) : null}

        <div
          className={`catalog-shop-layout ${
            areFiltersVisible ? "catalog-shop-layout--filters-visible" : ""
          }`}
        >
          <aside
            aria-hidden={!filterPanelIsVisible}
            aria-label="Product filters"
            className={`catalog-filter-sidebar ${
              !filterPanelIsVisible ? "catalog-filter-sidebar--hidden" : ""
            } ${isFilterDrawerOpen ? "catalog-filter-sidebar--open" : ""}`}
          >
            <div className="catalog-filter-sidebar__header">
              <h2>Filters</h2>
              <button
                aria-label="Close filters"
                className="catalog-filter-sidebar__close"
                onClick={() => setIsFilterDrawerOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={20} strokeWidth={1.9} />
              </button>
            </div>

            <div className="catalog-filter-section">
              <div className="catalog-filter-section__heading">
                <h3>Categories</h3>
              </div>

              <div className="catalog-category-list">
                <button
                  aria-pressed={!query.categorySlug}
                  className={!query.categorySlug ? "is-active" : undefined}
                  onClick={() => handleCategoryChange("")}
                  type="button"
                >
                  All products
                </button>
                {isCategoryLoading ? (
                  <p className="catalog-filter-note">Loading categories...</p>
                ) : null}
                {!isCategoryLoading && !categoryError
                  ? categories.map((category) => (
                      <button
                        aria-pressed={query.categorySlug === category.slug}
                        className={
                          query.categorySlug === category.slug
                            ? "is-active"
                            : undefined
                        }
                        key={category.id}
                        onClick={() => handleCategoryChange(category.slug)}
                        type="button"
                      >
                        {category.name}
                      </button>
                    ))
                  : null}
                {categoryError ? (
                  <p className="catalog-filter-note">
                    Categories are unavailable right now.
                  </p>
                ) : null}
              </div>
            </div>
          </aside>

          <div className="catalog-products-panel">
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
              <nav
                className="catalog-pagination"
                aria-label={`Product pagination, page ${pagination.page} of ${totalPages}`}
              >
                <button
                  aria-label="Previous page"
                  className="catalog-pagination__button"
                  disabled={isProductLoading || pagination.page <= 1}
                  onClick={() => goToPage(Math.max(1, pagination.page - 1))}
                  title="Previous page"
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" size={28} strokeWidth={2.2} />
                </button>
                <button
                  aria-label="Next page"
                  className="catalog-pagination__button"
                  disabled={isProductLoading || pagination.page >= totalPages}
                  onClick={() => goToPage(pagination.page + 1)}
                  title="Next page"
                  type="button"
                >
                  <ChevronRight aria-hidden="true" size={28} strokeWidth={2.2} />
                </button>
              </nav>
            ) : null}
          </div>
        </div>
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
