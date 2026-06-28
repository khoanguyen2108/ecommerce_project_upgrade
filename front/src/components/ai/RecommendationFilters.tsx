"use client";

import { RotateCcw } from "lucide-react";
import type { Category } from "@/features/catalog/types";
import type { RecommendationFilterState } from "@/features/ai/recommendationTypes";
import styles from "@/components/ai/ProductRecommendations.module.css";

const STYLE_OPTIONS = [
  "Streetwear",
  "Minimal",
  "Oversized",
  "Vintage",
  "Sport",
  "Casual",
] as const;

interface RecommendationFiltersProps {
  categories: Category[];
  colors: string[];
  disabled: boolean;
  filters: RecommendationFilterState;
  isLoadingOptions: boolean;
  onChange: (filters: RecommendationFilterState) => void;
  onReset: () => void;
  optionsError?: string;
  sizes: string[];
}

export function RecommendationFilters({
  categories,
  colors,
  disabled,
  filters,
  isLoadingOptions,
  onChange,
  onReset,
  optionsError,
  sizes,
}: RecommendationFiltersProps) {
  function update<Key extends keyof RecommendationFilterState>(
    key: Key,
    value: RecommendationFilterState[Key],
  ) {
    onChange({ ...filters, [key]: value });
  }

  function toggleColor(color: string) {
    const isSelected = filters.colors.includes(color);
    const nextColors = isSelected
      ? filters.colors.filter((item) => item !== color)
      : [...filters.colors, color].slice(0, 5);
    update("colors", nextColors);
  }

  function toggleStyle(style: string) {
    const nextStyles = filters.styles.includes(style)
      ? filters.styles.filter((item) => item !== style)
      : [...filters.styles, style];
    update("styles", nextStyles);
  }

  const hasSavedCategory = Boolean(
    filters.categorySlug &&
      !categories.some((category) => category.slug === filters.categorySlug),
  );

  return (
    <section className={styles.filters} aria-labelledby="recommendation-filters-title">
      <div className={styles.filterHeading}>
        <div>
          <span className={styles.step}>02</span>
          <h2 id="recommendation-filters-title">Refine the edit</h2>
        </div>
        <button disabled={disabled} onClick={onReset} type="button">
          <RotateCcw aria-hidden="true" size={14} />
          Clear
        </button>
      </div>

      <div className={styles.budgetGrid}>
        <label>
          <span>Min price</span>
          <div className={styles.moneyInput}>
            <input
              disabled={disabled}
              inputMode="numeric"
              max={2_000_000_000}
              min={0}
              onChange={(event) => update("minBudget", event.target.value)}
              placeholder="0"
              step={10_000}
              type="number"
              value={filters.minBudget}
            />
            <span>VND</span>
          </div>
        </label>
        <label>
          <span>Max price</span>
          <div className={styles.moneyInput}>
            <input
              disabled={disabled}
              inputMode="numeric"
              max={2_000_000_000}
              min={0}
              onChange={(event) => update("maxBudget", event.target.value)}
              placeholder="No limit"
              step={10_000}
              type="number"
              value={filters.maxBudget}
            />
            <span>VND</span>
          </div>
        </label>
      </div>

      <div className={styles.selectGrid}>
        <label>
          <span>Category</span>
          <select
            disabled={disabled || isLoadingOptions}
            onChange={(event) => update("categorySlug", event.target.value)}
            value={filters.categorySlug}
          >
            <option value="">All categories</option>
            {hasSavedCategory ? (
              <option value={filters.categorySlug}>{filters.categorySlug}</option>
            ) : null}
            {categories.map((category) => (
              <option key={category.id} value={category.slug}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Size</span>
          <select
            disabled={disabled || isLoadingOptions}
            onChange={(event) => update("size", event.target.value)}
            value={filters.size}
          >
            <option value="">Any size</option>
            {filters.size && !sizes.includes(filters.size) ? (
              <option value={filters.size}>{filters.size}</option>
            ) : null}
            {sizes.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className={styles.filterGroup} disabled={disabled || isLoadingOptions}>
        <legend>
          Color <span>Choose up to 5</span>
        </legend>
        <div className={styles.optionChips}>
          {isLoadingOptions ? <span className={styles.mutedCopy}>Loading colors...</span> : null}
          {!isLoadingOptions && colors.length === 0 ? (
            <span className={styles.mutedCopy}>No catalog colors available.</span>
          ) : null}
          {colors.map((color) => {
            const isSelected = filters.colors.includes(color);
            return (
              <button
                aria-pressed={isSelected}
                className={isSelected ? styles.selectedChip : undefined}
                disabled={!isSelected && filters.colors.length >= 5}
                key={color}
                onClick={() => toggleColor(color)}
                type="button"
              >
                {color}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className={styles.filterGroup} disabled={disabled}>
        <legend>Style</legend>
        <div className={styles.optionChips}>
          {STYLE_OPTIONS.map((style) => {
            const isSelected = filters.styles.includes(style);
            return (
              <button
                aria-pressed={isSelected}
                className={isSelected ? styles.selectedChip : undefined}
                key={style}
                onClick={() => toggleStyle(style)}
                type="button"
              >
                {style}
              </button>
            );
          })}
        </div>
      </fieldset>

      {optionsError ? <p className={styles.optionsNotice}>{optionsError}</p> : null}
    </section>
  );
}
