"use client";

import styles from "@/components/ai/StyleAssistant.module.css";
import { useI18n } from "@/features/i18n/useI18n";

export function StyleAssistantEmpty() {
  const { t } = useI18n();
  return (
    <section aria-labelledby="style-assistant-empty-title" className={`${styles.stateCard} ${styles.emptyCard}`}>
      <FashionIllustration />
      <div className={styles.emptyCopy}>
        <span className={styles.resultLabel}>{t("ai.resultLabel")}</span>
        <h2 id="style-assistant-empty-title">{t("ai.emptyTitle")}</h2>
        <p>{t("ai.emptyBody")}</p>
      </div>
    </section>
  );
}

export function FashionIllustration({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div aria-hidden="true" className={`${styles.illustration} ${compact ? styles.illustrationCompact : ""}`}>
      <svg fill="none" viewBox="0 0 420 360" xmlns="http://www.w3.org/2000/svg">
        <path d="M52 318H372" stroke="currentColor" strokeWidth="1.5" />
        <path d="M116 318V82H304V318" stroke="currentColor" strokeWidth="1.5" />
        <path d="M152 82V53H268V82" stroke="currentColor" strokeWidth="1.5" />
        <path d="M210 53V31" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="210" cy="25" r="6" stroke="currentColor" strokeWidth="1.5" />
        <path d="M185 119C185 105.193 196.193 94 210 94C223.807 94 235 105.193 235 119V130H185V119Z" fill="currentColor" />
        <path d="M174 135H246L270 245H150L174 135Z" fill="currentColor" opacity=".92" />
        <path d="M174 135L139 190L159 202L188 155" fill="currentColor" opacity=".92" />
        <path d="M246 135L281 190L261 202L232 155" fill="currentColor" opacity=".92" />
        <path d="M171 245L185 318H205L210 252L215 318H235L249 245" fill="currentColor" />
        <path d="M304 112H336V197H304" stroke="currentColor" strokeWidth="1.5" />
        <path d="M84 134H116V218H84Z" fill="currentColor" opacity=".12" />
        <path d="M68 117L84 134V218L68 235V117Z" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="336" cy="226" r="4" fill="currentColor" />
        <circle cx="349" cy="226" r="4" fill="currentColor" opacity=".35" />
        <path d="M324 258H364" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <span className={styles.illustrationTag}>{t("ai.personalEdit")}</span>
    </div>
  );
}
