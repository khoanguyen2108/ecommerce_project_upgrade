import styles from "@/components/ai/ProductRecommendations.module.css";

export function RecommendationSkeleton() {
  return (
    <section className={styles.skeletonPanel} role="status" aria-label="Finding matching products">
      <div className={styles.skeletonHeader}>
        <span className={`${styles.skeleton} ${styles.skeletonLabel}`} />
        <span className={`${styles.skeleton} ${styles.skeletonCount}`} />
      </div>
      <span className={`${styles.skeleton} ${styles.skeletonTitle}`} />
      <span className={`${styles.skeleton} ${styles.skeletonText}`} />
      <span className={`${styles.skeleton} ${styles.skeletonTextShort}`} />
      <div className={styles.skeletonGrid}>
        {Array.from({ length: 4 }, (_, index) => (
          <div className={styles.skeletonCard} key={index}>
            <span className={`${styles.skeleton} ${styles.skeletonImage}`} />
            <div>
              <span className={`${styles.skeleton} ${styles.skeletonProductTitle}`} />
              <span className={`${styles.skeleton} ${styles.skeletonProductText}`} />
              <span className={`${styles.skeleton} ${styles.skeletonProductAction}`} />
            </div>
          </div>
        ))}
      </div>
      <p>Searching Belikeme&apos;s available catalog...</p>
    </section>
  );
}
