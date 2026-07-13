"use client";

import styles from "@/components/ai/StyleAssistant.module.css";
import { useI18n } from "@/features/i18n/useI18n";

export function StyleAssistantSkeleton() {
  const { t } = useI18n();
  return (
    <section aria-label={t("ai.generating")} className={styles.skeletonCard} role="status">
      <div className={styles.skeletonTopline}>
        <span className={`${styles.skeleton} ${styles.skeletonLabel}`} />
        <span className={`${styles.skeleton} ${styles.skeletonDot}`} />
      </div>
      <span className={`${styles.skeleton} ${styles.skeletonTitle}`} />
      <span className={`${styles.skeleton} ${styles.skeletonText}`} />
      <span className={`${styles.skeleton} ${styles.skeletonTextShort}`} />
      <div className={styles.skeletonProducts}>
        {Array.from({ length: 2 }, (_, index) => (
          <div className={styles.skeletonProduct} key={index}>
            <span className={`${styles.skeleton} ${styles.skeletonImage}`} />
            <div>
              <span className={`${styles.skeleton} ${styles.skeletonProductName}`} />
              <span className={`${styles.skeleton} ${styles.skeletonProductMeta}`} />
              <span className={`${styles.skeleton} ${styles.skeletonProductButton}`} />
            </div>
          </div>
        ))}
      </div>
      <span className={styles.loadingCopy}>{t("ai.building")}</span>
    </section>
  );
}
