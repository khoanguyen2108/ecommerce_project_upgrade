"use client";

import { ArrowUpRight, Loader2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import { RecommendationFilters } from "@/components/ai/RecommendationFilters";
import styles from "@/components/ai/ProductRecommendations.module.css";
import type { Category } from "@/features/catalog/types";
import type { RecommendationFilterState } from "@/features/ai/recommendationTypes";

const EXAMPLE_PROMPTS = [
  "I need an oversized black hoodie.",
  "I need an outfit under 800k.",
  "I need clothes for travelling.",
  "I need a minimalist outfit.",
] as const;

interface RecommendationSearchProps {
  categories: Category[];
  colors: string[];
  filters: RecommendationFilterState;
  formError?: string;
  isLoading: boolean;
  isLoadingOptions: boolean;
  onFiltersChange: (filters: RecommendationFilterState) => void;
  onQueryChange: (query: string) => void;
  onResetFilters: () => void;
  onSubmit: () => void;
  optionsError?: string;
  query: string;
  sizes: string[];
}

export function RecommendationSearch({
  categories,
  colors,
  filters,
  formError,
  isLoading,
  isLoadingOptions,
  onFiltersChange,
  onQueryChange,
  onResetFilters,
  onSubmit,
  optionsError,
  query,
  sizes,
}: RecommendationSearchProps) {
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    if (query.trim().length >= 3 && !isLoading) onSubmit();
  }

  return (
    <form
      className={styles.searchPanel}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className={styles.searchTopline}>
        <span>AI product finder</span>
        <span>Belikeme live catalog</span>
      </div>

      <div className={styles.searchIntro}>
        <p className={styles.eyebrow}>Describe it. We&apos;ll find it.</p>
        <h1>Shop by intention, not endless scrolling.</h1>
        <p>
          Tell us what you need in your own words. Add a few filters when the
          details matter, and we&apos;ll return a focused edit from available pieces.
        </p>
      </div>

      <section className={styles.promptSection} aria-labelledby="recommendation-prompt-title">
        <div className={styles.sectionHeading}>
          <div>
            <span className={styles.step}>01</span>
            <h2 id="recommendation-prompt-title">What are you looking for?</h2>
          </div>
          <span>{query.length}/500</span>
        </div>
        <label className={styles.visuallyHidden} htmlFor="recommendation-query">
          Describe what you are looking for
        </label>
        <textarea
          aria-describedby="recommendation-query-help"
          disabled={isLoading}
          id="recommendation-query"
          maxLength={500}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe what you're looking for..."
          rows={5}
          value={query}
        />
        <p className={styles.keyboardHint} id="recommendation-query-help">
          Enter to search. Shift+Enter for a new line.
        </p>
        <div className={styles.promptExamples} aria-label="Example shopping requests">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              disabled={isLoading}
              key={prompt}
              onClick={() => onQueryChange(prompt)}
              type="button"
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>

      <RecommendationFilters
        categories={categories}
        colors={colors}
        disabled={isLoading}
        filters={filters}
        isLoadingOptions={isLoadingOptions}
        onChange={onFiltersChange}
        onReset={onResetFilters}
        optionsError={optionsError}
        sizes={sizes}
      />

      {formError ? <p className={styles.formError} role="alert">{formError}</p> : null}

      <button
        className={styles.submitButton}
        disabled={query.trim().length < 3 || isLoading}
        type="submit"
      >
        {isLoading ? (
          <>
            <Loader2 aria-hidden="true" className={styles.spinner} size={18} />
            Finding your edit
          </>
        ) : (
          <>
            Recommend Products
            <ArrowUpRight aria-hidden="true" size={18} />
          </>
        )}
      </button>
      <p className={styles.disclaimer}>
        Availability and effective prices come from Belikeme. Confirm your exact
        variant on the product page before adding it to cart.
      </p>
    </form>
  );
}
