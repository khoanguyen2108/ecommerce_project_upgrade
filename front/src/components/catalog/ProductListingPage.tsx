"use client";

import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ProductCard } from "@/components/catalog/ProductCard";
import { getCategories, getProducts } from "@/features/catalog/api";
import type {
  Category,
  Pagination,
  Product,
  ProductQuery,
} from "@/features/catalog/types";
import type { TranslationKey } from "@/features/i18n/translations";
import { useI18n } from "@/features/i18n/useI18n";
import { ApiClientError } from "@/lib/errors/api-error";

const PRODUCT_LIMIT = 12;

const SORT_OPTIONS: Array<{
  labelKey: TranslationKey;
  value: NonNullable<ProductQuery["sort"]>;
}> = [
  { labelKey: "catalog.newest", value: "newest" },
  { labelKey: "catalog.priceLowHigh", value: "price_asc" },
  { labelKey: "catalog.priceHighLow", value: "price_desc" },
];

interface ProductListingPageProps {
  initialQuery: ProductQuery;
}

export function ProductListingPage({ initialQuery }: ProductListingPageProps) {
  const { t } = useI18n();
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
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortControlRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!isSortOpen) {
      return;
    }

    function closeSortMenu(event: MouseEvent) {
      if (
        sortControlRef.current &&
        event.target instanceof Node &&
        !sortControlRef.current.contains(event.target)
      ) {
        setIsSortOpen(false);
      }
    }

    function closeSortOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsSortOpen(false);
      }
    }

    document.addEventListener("mousedown", closeSortMenu);
    document.addEventListener("keydown", closeSortOnEscape);

    return () => {
      document.removeEventListener("mousedown", closeSortMenu);
      document.removeEventListener("keydown", closeSortOnEscape);
    };
  }, [isSortOpen]);

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
    setIsSortOpen(false);
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
      ? t("catalog.searchResults")
      : t("catalog.allProducts");
  const hasActiveFilters = Boolean(
    query.categorySlug || query.search || (query.sort && query.sort !== "newest"),
  );
  const totalPages = Math.max(1, pagination.totalPages);
  const activeSort = query.sort || "newest";
  const activeSortLabel =
    t(
      SORT_OPTIONS.find((option) => option.value === activeSort)?.labelKey ||
        "catalog.newest",
    );
  const filtersToggleLabel =
    isMobileViewport
      ? isFilterDrawerOpen
        ? t("catalog.hideFilters")
        : t("catalog.showFilters")
      : areFiltersVisible
        ? t("catalog.hideFilters")
        : t("catalog.showFilters");
  const filterPanelIsVisible = isMobileViewport
    ? isFilterDrawerOpen
    : areFiltersVisible;

  return (
    <main className="catalog-page catalog-page--shop">
      <section
        className="catalog-shell catalog-shell--shop"
        aria-label={t("catalog.productCatalog")}
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
                  aria-label={t("catalog.searchProducts")}
                  className="catalog-compact-search__button"
                  type="submit"
                >
                  <Search aria-hidden="true" size={19} strokeWidth={2} />
                </button>
                <input
                  aria-label={t("catalog.searchProducts")}
                  id="product-search"
                  name="search"
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={t("catalog.search")}
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

            <div className="catalog-sort-control" ref={sortControlRef}>
              <span>{t("catalog.sortBy")}</span>
              <button
                aria-expanded={isSortOpen}
                aria-haspopup="listbox"
                className="catalog-sort-trigger"
                onClick={() => setIsSortOpen((current) => !current)}
                type="button"
              >
                <span>{activeSortLabel}</span>
                <ChevronDown
                  aria-hidden="true"
                  className={isSortOpen ? "is-open" : undefined}
                  size={18}
                  strokeWidth={2}
                />
              </button>
              {isSortOpen ? (
                <div className="catalog-sort-menu" role="listbox">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      aria-selected={activeSort === option.value}
                      className={
                        activeSort === option.value ? "is-selected" : undefined
                      }
                      key={option.value}
                      onClick={() => handleSortChange(option.value)}
                      role="option"
                      type="button"
                    >
                      {t(option.labelKey)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {categoryError ? (
          <div className="catalog-inline-alert" role="status">
            {t("catalog.categoriesPartialError")}
          </div>
        ) : null}

        {isFilterDrawerOpen ? (
          <button
            aria-label={t("catalog.closeFilters")}
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
            aria-label={t("catalog.productFilters")}
            className={`catalog-filter-sidebar ${
              !filterPanelIsVisible ? "catalog-filter-sidebar--hidden" : ""
            } ${isFilterDrawerOpen ? "catalog-filter-sidebar--open" : ""}`}
          >
            <div className="catalog-filter-sidebar__header">
              <h2>{t("catalog.filters")}</h2>
              <button
                aria-label={t("catalog.closeFilters")}
                className="catalog-filter-sidebar__close"
                onClick={() => setIsFilterDrawerOpen(false)}
                type="button"
              >
                <X aria-hidden="true" size={20} strokeWidth={1.9} />
              </button>
            </div>

            <div className="catalog-filter-section">
              <div className="catalog-filter-section__heading">
                <h3>{t("nav.categories")}</h3>
              </div>

              <div className="catalog-category-list">
                <button
                  aria-pressed={!query.categorySlug}
                  className={!query.categorySlug ? "is-active" : undefined}
                  onClick={() => handleCategoryChange("")}
                  type="button"
                >
                  {t("catalog.allProducts")}
                </button>
                {isCategoryLoading ? (
                  <p className="catalog-filter-note">
                    {t("catalog.loadingCategories")}
                  </p>
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
                    {t("catalog.categoriesUnavailable")}
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
                  <strong>{t("catalog.productsLoadError")}</strong>
                  <span>{productError}</span>
                </div>
                <button
                  className="button button--secondary"
                  onClick={() => setProductRequestKey((current) => current + 1)}
                  type="button"
                >
                  {t("common.retry")}
                </button>
              </div>
            ) : null}

            <div className="product-grid catalog-product-grid">
              {isProductLoading ? <CatalogSkeleton count={PRODUCT_LIMIT} /> : null}
              {!isProductLoading && !productError && products.length === 0 ? (
                <div className="catalog-state catalog-state--shop" role="status">
                  <p className="eyebrow">{t("catalog.nothingHere")}</p>
                  <h2>{t("catalog.noProductsFound")}</h2>
                  <p>{t("catalog.emptyHint")}</p>
                  {hasActiveFilters ? (
                    <button
                      className="button button--secondary"
                      onClick={handleReset}
                      type="button"
                    >
                      {t("catalog.resetFilters")}
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
                aria-label={`${t("catalog.pagination")}, ${t("catalog.page")} ${pagination.page} ${t("catalog.of")} ${totalPages}`}
              >
                <button
                  aria-label={t("catalog.previousPage")}
                  className="catalog-pagination__button"
                  disabled={isProductLoading || pagination.page <= 1}
                  onClick={() => goToPage(Math.max(1, pagination.page - 1))}
                  title={t("catalog.previousPage")}
                  type="button"
                >
                  <ChevronLeft aria-hidden="true" size={28} strokeWidth={2.2} />
                </button>
                <button
                  aria-label={t("catalog.nextPage")}
                  className="catalog-pagination__button"
                  disabled={isProductLoading || pagination.page >= totalPages}
                  onClick={() => goToPage(pagination.page + 1)}
                  title={t("catalog.nextPage")}
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
