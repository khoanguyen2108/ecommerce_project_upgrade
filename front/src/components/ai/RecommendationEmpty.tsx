import { ArrowRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import styles from "@/components/ai/ProductRecommendations.module.css";

export function RecommendationEmpty() {
  return (
    <section className={`${styles.stateCard} ${styles.emptyState}`}>
      <RecommendationIllustration />
      <p className={styles.eyebrow}>Your edit starts here</p>
      <h2>Find your next favorite outfit.</h2>
      <p>
        Describe a piece, an occasion, a color, or a budget. Your most relevant
        in-stock Belikeme products will appear here.
      </p>
      <div className={styles.emptyDetails}>
        <span>Natural language</span>
        <span>Live availability</span>
        <span>Up to 8 matches</span>
      </div>
    </section>
  );
}

export function RecommendationNoResults({
  onRetry,
  suggestions,
}: {
  onRetry: () => void;
  suggestions: string[];
}) {
  const visibleSuggestions = suggestions.length
    ? suggestions
    : ["Increase your budget.", "Try another color.", "Remove the size filter."];

  return (
    <section className={`${styles.stateCard} ${styles.noResults}`} role="status">
      <span aria-hidden="true" className={styles.stateNumber}>00</span>
      <p className={styles.eyebrow}>No match in the current edit</p>
      <h2>No matching products found.</h2>
      <p>Small changes can open up more of the available catalog.</p>
      <ul>
        {visibleSuggestions.map((suggestion, index) => (
          <li key={`${index}-${suggestion}`}>{suggestion}</li>
        ))}
      </ul>
      <div className={styles.stateActions}>
        <button onClick={onRetry} type="button">
          <RotateCcw aria-hidden="true" size={16} />
          Retry search
        </button>
        <Link href="/products">
          Browse all products
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </section>
  );
}

export function RecommendationOutOfScope({
  message,
  examples,
}: {
  message: string;
  examples: string[];
}) {
  const visibleExamples = examples.length
    ? examples
    : ["Find me a black oversized top.", "Show me a casual outfit under 800k."];

  return (
    <section className={`${styles.stateCard} ${styles.outOfScope}`} role="status">
      <RecommendationIllustration compact />
      <p className={styles.eyebrow}>Let&apos;s keep it fashion-focused</p>
      <h2>I&apos;m here to find Belikeme products.</h2>
      <p>{message}</p>
      <div className={styles.exampleQuestions}>
        <h3>Try a shopping question</h3>
        <ul>
          {visibleExamples.map((example, index) => (
            <li key={`${index}-${example}`}>{example}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function RecommendationIllustration({ compact = false }: { compact?: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={`${styles.illustration} ${compact ? styles.compactIllustration : ""}`}
    >
      <svg fill="none" viewBox="0 0 520 320" xmlns="http://www.w3.org/2000/svg">
        <path d="M42 278H478" stroke="currentColor" strokeWidth="1.5" />
        <path d="M104 278V62H416V278" stroke="currentColor" strokeWidth="1.5" />
        <path d="M128 90H392" stroke="currentColor" strokeWidth="1.5" />
        <path d="M198 90C198 72 214 58 232 58C250 58 266 72 266 90" stroke="currentColor" strokeWidth="1.5" />
        <path d="M151 115L195 96L229 122L263 96L307 115L287 164L270 154V252H188V154L171 164L151 115Z" fill="currentColor" />
        <path d="M328 105L366 120V236H318V120L328 105Z" fill="currentColor" opacity=".16" />
        <path d="M318 120L342 144L366 120" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="82" cy="120" r="5" fill="currentColor" />
        <circle cx="82" cy="120" r="15" stroke="currentColor" opacity=".25" />
        <path d="M428 122L434 136L448 142L434 148L428 162L422 148L408 142L422 136L428 122Z" fill="currentColor" />
        <path d="M74 228H130" stroke="currentColor" strokeWidth="1.5" />
        <path d="M390 232H452" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span>BELIKEME / PRODUCT EDIT</span>
    </div>
  );
}
