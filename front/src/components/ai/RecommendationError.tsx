import { AlertTriangle, RefreshCw } from "lucide-react";
import styles from "@/components/ai/ProductRecommendations.module.css";

export function RecommendationError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <section className={`${styles.stateCard} ${styles.errorState}`} role="alert">
      <span className={styles.errorIcon} aria-hidden="true">
        <AlertTriangle size={26} strokeWidth={1.5} />
      </span>
      <p className={styles.eyebrow}>The edit was interrupted</p>
      <h2>We couldn&apos;t complete that search.</h2>
      <p>{message}</p>
      <button onClick={onRetry} type="button">
        <RefreshCw aria-hidden="true" size={16} />
        Try again
      </button>
    </section>
  );
}
