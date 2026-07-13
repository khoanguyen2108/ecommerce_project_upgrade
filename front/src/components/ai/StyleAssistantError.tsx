"use client";

import { RefreshCw } from "lucide-react";
import styles from "@/components/ai/StyleAssistant.module.css";
import { useI18n } from "@/features/i18n/useI18n";

interface StyleAssistantErrorProps {
  message: string;
  onRetry: () => void;
}

export function StyleAssistantError({ message, onRetry }: StyleAssistantErrorProps) {
  const { t } = useI18n();
  return (
    <section className={`${styles.stateCard} ${styles.errorCard}`} role="alert">
      <span aria-hidden="true" className={styles.errorMark}>!</span>
      <span className={styles.resultLabel}>{t("ai.interrupted")}</span>
      <h2>{t("ai.tryAgainTitle")}</h2>
      <p>{message}</p>
      <button className={styles.secondaryButton} onClick={onRetry} type="button">
        <RefreshCw aria-hidden="true" size={17} />
        {t("common.retry")}
      </button>
    </section>
  );
}
