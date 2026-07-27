"use client";

import { RefreshCw } from "lucide-react";
import styles from "@/components/ai/StyleAssistant.module.css";

interface StyleAssistantErrorProps {
  message: string;
  onRetry: () => void;
}

export function StyleAssistantError({ message, onRetry }: StyleAssistantErrorProps) {
  return (
    <section className={`${styles.stateCard} ${styles.errorCard}`} role="alert">
      <span aria-hidden="true" className={styles.errorMark}>!</span>
      <span className={styles.resultLabel}>{"Something interrupted the edit"}</span>
      <h2>{"Let's try that again."}</h2>
      <p>{message}</p>
      <button className={styles.secondaryButton} onClick={onRetry} type="button">
        <RefreshCw aria-hidden="true" size={17} />
        {"Retry"}
      </button>
    </section>
  );
}
