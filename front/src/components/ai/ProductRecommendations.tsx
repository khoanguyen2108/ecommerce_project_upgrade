"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RecommendationEmpty } from "@/components/ai/RecommendationEmpty";
import { RecommendationError } from "@/components/ai/RecommendationError";
import { RecommendationGrid } from "@/components/ai/RecommendationGrid";
import { RecommendationSearch } from "@/components/ai/RecommendationSearch";
import { RecommendationSkeleton } from "@/components/ai/RecommendationSkeleton";
import styles from "@/components/ai/ProductRecommendations.module.css";
import { getCategories, getProducts } from "@/features/catalog/api";
import { sortSizesByStandardOrder } from "@/features/catalog/sizes";
import type { Category } from "@/features/catalog/types";
import { useProductRecommendations } from "@/features/ai/recommendationHooks";
import {
  EMPTY_RECOMMENDATION_FILTERS,
  type ProductRecommendationRequest,
  type RecommendationFilterState,
} from "@/features/ai/recommendationTypes";

const FILTER_STORAGE_KEY = "belikeme_ai_recommendation_filters";
const MAX_VND_AMOUNT = 2_000_000_000;

export function ProductRecommendations() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<RecommendationFilterState>(
    EMPTY_RECOMMENDATION_FILTERS,
  );
  const [formError, setFormError] = useState<string>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [colorOptions, setColorOptions] = useState<string[]>([]);
  const [sizeOptions, setSizeOptions] = useState<string[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string>();
  const resultRef = useRef<HTMLElement>(null);
  const { error, recommend, result, retry, status } = useProductRecommendations();
  const isLoading = status === "loading";

  useEffect(() => {
    const storedFilters = readStoredFilters();
    if (storedFilters) setFilters(storedFilters);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadFilterOptions() {
      try {
        const [categoryResponse, productResponse] = await Promise.all([
          getCategories(),
          getProducts({ limit: 50, page: 1 }),
        ]);
        if (!isMounted) return;

        const variants = productResponse.products.flatMap((product) =>
          product.variants.filter((variant) => variant.isActive && variant.stock > 0),
        );
        setCategories(categoryResponse.filter((category) => category.isActive));
        setColorOptions(
          Array.from(new Set(variants.map((variant) => variant.color).filter(Boolean))).sort(
            (left, right) => left.localeCompare(right),
          ),
        );
        setSizeOptions(
          sortSizesByStandardOrder(
            variants.map((variant) => variant.size).filter(Boolean),
          ),
        );
      } catch {
        if (isMounted) {
          setOptionsError(
            "Catalog filter options could not be refreshed. You can still search by description.",
          );
        }
      } finally {
        if (isMounted) setIsLoadingOptions(false);
      }
    }

    void loadFilterOptions();
    return () => {
      isMounted = false;
    };
  }, []);

  const filtersWithValidOptions = useMemo(
    () => ({
      ...filters,
      colors: filters.colors.filter((color) =>
        colorOptions.length ? colorOptions.includes(color) : true,
      ),
    }),
    [colorOptions, filters],
  );

  async function handleSubmit() {
    const requestResult = buildRequest(query, filtersWithValidOptions);
    if (typeof requestResult === "string") {
      setFormError(requestResult);
      return;
    }

    setFormError(undefined);
    const response = await recommend(requestResult);
    if (response) writeStoredFilters(filtersWithValidOptions);
    window.setTimeout(
      () => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  }

  function handleRetry() {
    retry();
    window.setTimeout(
      () => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <RecommendationSearch
          categories={categories}
          colors={colorOptions}
          filters={filtersWithValidOptions}
          formError={formError}
          isLoading={isLoading}
          isLoadingOptions={isLoadingOptions}
          onFiltersChange={setFilters}
          onQueryChange={(value) => {
            setQuery(value);
            setFormError(undefined);
          }}
          onResetFilters={() => setFilters(EMPTY_RECOMMENDATION_FILTERS)}
          onSubmit={() => void handleSubmit()}
          optionsError={optionsError}
          query={query}
          sizes={sizeOptions}
        />

        <aside
          aria-label="AI product recommendations"
          className={styles.resultsColumn}
          ref={resultRef}
        >
          {status === "idle" ? <RecommendationEmpty /> : null}
          {status === "loading" ? <RecommendationSkeleton /> : null}
          {status === "error" ? (
            <RecommendationError
              message={error || "Recommendations are unavailable right now."}
              onRetry={handleRetry}
            />
          ) : null}
          {status === "success" && result ? (
            <RecommendationGrid onRetry={handleRetry} result={result} />
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function buildRequest(
  query: string,
  filters: RecommendationFilterState,
): ProductRecommendationRequest | string {
  const normalizedQuery = query.trim();
  const styleContext = filters.styles.length
    ? ` Style preferences: ${filters.styles.join(", ")}.`
    : "";
  const fullQuery = `${normalizedQuery}${styleContext}`;

  if (normalizedQuery.length < 3) return "Describe what you need in at least 3 characters.";
  if (fullQuery.length > 500) {
    return "Shorten your description or remove a style preference (500 characters maximum).";
  }

  const minBudget = parseBudget(filters.minBudget);
  const maxBudget = parseBudget(filters.maxBudget);
  if (minBudget === null || maxBudget === null) {
    return "Budget values must be whole numbers between 0 and 2,000,000,000 VND.";
  }
  if (minBudget !== undefined && maxBudget !== undefined && minBudget > maxBudget) {
    return "Minimum price cannot be higher than maximum price.";
  }

  return {
    query: fullQuery,
    ...(minBudget !== undefined ? { minBudget } : {}),
    ...(maxBudget !== undefined ? { maxBudget } : {}),
    ...(filters.categorySlug ? { categorySlugs: [filters.categorySlug] } : {}),
    ...(filters.colors.length ? { colors: filters.colors } : {}),
    ...(filters.size ? { sizes: [filters.size] } : {}),
    limit: 6,
  };
}

function parseBudget(value: string): number | undefined | null {
  if (!value.trim()) return undefined;
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 0 || amount > MAX_VND_AMOUNT) return null;
  return amount;
}

function readStoredFilters(): RecommendationFilterState | undefined {
  try {
    const stored = window.localStorage.getItem(FILTER_STORAGE_KEY);
    if (!stored) return undefined;
    const parsed = JSON.parse(stored) as Partial<RecommendationFilterState>;
    return {
      minBudget: typeof parsed.minBudget === "string" ? parsed.minBudget : "",
      maxBudget: typeof parsed.maxBudget === "string" ? parsed.maxBudget : "",
      categorySlug: typeof parsed.categorySlug === "string" ? parsed.categorySlug : "",
      colors: Array.isArray(parsed.colors)
        ? parsed.colors.filter((value): value is string => typeof value === "string").slice(0, 5)
        : [],
      size: typeof parsed.size === "string" ? parsed.size : "",
      styles: Array.isArray(parsed.styles)
        ? parsed.styles.filter((value): value is string => typeof value === "string")
        : [],
    };
  } catch {
    return undefined;
  }
}

function writeStoredFilters(filters: RecommendationFilterState) {
  try {
    window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch {
    // Remembering filters is a convenience; search remains functional without storage.
  }
}
