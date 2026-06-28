import { Sparkles } from "lucide-react";
import { RecommendationCard } from "@/components/ai/RecommendationCard";
import {
  RecommendationNoResults,
  RecommendationOutOfScope,
} from "@/components/ai/RecommendationEmpty";
import styles from "@/components/ai/ProductRecommendations.module.css";
import { formatPrice } from "@/features/catalog/format";
import type { ProductRecommendationResponse } from "@/features/ai/recommendationTypes";

export function RecommendationGrid({
  onRetry,
  result,
}: {
  onRetry: () => void;
  result: ProductRecommendationResponse;
}) {
  if (result.mode === "out_of_scope") {
    return (
      <RecommendationOutOfScope
        examples={result.noMatchSuggestions}
        message={result.summary}
      />
    );
  }

  if (!result.recommendations.length) {
    return (
      <RecommendationNoResults
        onRetry={onRetry}
        suggestions={result.noMatchSuggestions}
      />
    );
  }

  const filterLabels = getFilterLabels(result);

  return (
    <section className={styles.resultsPanel} aria-live="polite">
      <div className={styles.resultsTopline}>
        <div>
          <Sparkles aria-hidden="true" size={16} />
          <span>{result.mode === "ai" ? "AI selected" : "Catalog selected"}</span>
        </div>
        <span>{result.recommendations.length} recommendations</span>
      </div>

      <div className={styles.summary}>
        <p className={styles.eyebrow}>Your Belikeme edit</p>
        <h2>Made to match your request.</h2>
        <p>{result.summary}</p>
      </div>

      <div className={styles.appliedFilters}>
        <span>Applied filters</span>
        <div>
          {filterLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
      </div>

      <div className={styles.resultsHeading}>
        <h3>Recommended products</h3>
        <span>Current in-stock catalog</span>
      </div>
      <div className={styles.productGrid}>
        {result.recommendations.map((recommendation) => (
          <RecommendationCard
            key={recommendation.productId}
            recommendation={recommendation}
          />
        ))}
      </div>
    </section>
  );
}

function getFilterLabels(result: ProductRecommendationResponse): string[] {
  const { appliedFilters } = result;
  const labels: string[] = [];

  if (appliedFilters.minBudget !== undefined || appliedFilters.maxBudget !== undefined) {
    const minimum = appliedFilters.minBudget !== undefined
      ? formatPrice(appliedFilters.minBudget)
      : "Any";
    const maximum = appliedFilters.maxBudget !== undefined
      ? formatPrice(appliedFilters.maxBudget)
      : "No limit";
    labels.push(`${minimum} - ${maximum}`);
  }

  labels.push(...appliedFilters.categorySlugs);
  labels.push(...appliedFilters.colors);
  labels.push(...appliedFilters.sizes);
  labels.push("In stock");

  return Array.from(new Set(labels));
}
