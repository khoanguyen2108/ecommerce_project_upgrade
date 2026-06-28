"use client";

import { ArrowUpRight, MessageCircle, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FashionIllustration } from "@/components/ai/StyleAssistantEmpty";
import styles from "@/components/ai/StyleAssistant.module.css";
import { formatPrice } from "@/features/catalog/format";
import type {
  StyleAdviceRecommendation,
  StyleAdviceResponse,
} from "@/features/ai/types";

interface StyleAssistantResultProps {
  result: StyleAdviceResponse;
}

export function StyleAssistantResult({ result }: StyleAssistantResultProps) {
  if (result.mode === "out_of_scope") {
    return <OutOfScopeResult result={result} />;
  }

  const totalPrice = result.recommendations.reduce(
    (total, recommendation) => total + recommendation.price,
    0,
  );

  return (
    <section aria-live="polite" className={styles.resultCard}>
      <div className={styles.resultTopline}>
        <div>
          <Sparkles aria-hidden="true" size={17} />
          <span className={styles.resultLabel}>Your Belikeme edit</span>
        </div>
        <span className={styles.resultMode}>
          {result.mode === "ai" ? "AI curated" : "Catalog edit"}
        </span>
      </div>

      <div className={styles.summary}>
        <span className={styles.stepNumber}>02</span>
        <div>
          <h2>Summary</h2>
          <p>{result.summary}</p>
        </div>
      </div>

      <div className={styles.recommendationsSection}>
        <div className={styles.sectionHeading}>
          <h3>Recommended products</h3>
          <span>
            {result.recommendations.length} selected
            {result.recommendations.length ? ` · ${formatPrice(totalPrice)} total` : ""}
          </span>
        </div>
        {result.recommendations.length ? (
          <div className={styles.productList}>
            {result.recommendations.map((recommendation) => (
              <RecommendationCard
                key={recommendation.productId}
                recommendation={recommendation}
              />
            ))}
          </div>
        ) : (
          <p className={styles.noProducts}>
            No matching in-stock pieces were returned. Try broadening your
            style, color, or budget description.
          </p>
        )}
      </div>

      {result.extraTips.length ? (
        <div className={styles.tipsSection}>
          <h3>Extra tips</h3>
          <ul>
            {result.extraTips.map((tip, index) => (
              <li key={`${index}-${tip}`}>{tip}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.handoff?.required ? <HandoffCard /> : null}
    </section>
  );
}

function RecommendationCard({
  recommendation,
}: {
  recommendation: StyleAdviceRecommendation;
}) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article className={styles.productCard}>
      <div className={styles.productImageWrap}>
        {recommendation.imageUrl && !imageFailed ? (
          <img
            alt={recommendation.productName}
            className={styles.productImage}
            loading="lazy"
            onError={() => setImageFailed(true)}
            src={recommendation.imageUrl}
          />
        ) : (
          <span className={styles.productImageFallback}>BELIKEME</span>
        )}
      </div>
      <div className={styles.productContent}>
        <div className={styles.productTitleRow}>
          <h4>{recommendation.productName}</h4>
          <strong>{formatPrice(recommendation.price)}</strong>
        </div>
        <p>{recommendation.reason}</p>
        {recommendation.stylingTip ? (
          <p className={styles.stylingTip}>{recommendation.stylingTip}</p>
        ) : null}
        <dl className={styles.variantMeta}>
          <div>
            <dt>Color</dt>
            <dd>Choose on product page</dd>
          </div>
          <div>
            <dt>Size</dt>
            <dd>Choose on product page</dd>
          </div>
        </dl>
        <Link
          className={styles.productLink}
          href={`/products/${encodeURIComponent(recommendation.productSlug)}`}
        >
          View Product
          <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </article>
  );
}

function OutOfScopeResult({ result }: { result: StyleAdviceResponse }) {
  return (
    <section aria-live="polite" className={`${styles.stateCard} ${styles.outOfScopeCard}`}>
      <FashionIllustration compact />
      <span className={styles.resultLabel}>Let&apos;s keep it stylish</span>
      <h2>I&apos;m your Belikeme style specialist.</h2>
      <p>{result.summary}</p>
      {result.extraTips.length ? (
        <div className={styles.examples}>
          <h3>Try asking</h3>
          <ul>
            {result.extraTips.map((tip, index) => (
              <li key={`${index}-${tip}`}>{tip}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function HandoffCard() {
  function openCustomerChat() {
    const launcher = document.querySelector<HTMLButtonElement>(
      ".customer-chat-widget__launcher",
    );

    if (launcher) {
      launcher.click();
      return;
    }

    document
      .querySelector<HTMLElement>(".customer-chat-panel")
      ?.focus({ preventScroll: false });
  }

  return (
    <div className={styles.handoffCard}>
      <MessageCircle aria-hidden="true" size={22} />
      <div>
        <h3>Need more personalized advice?</h3>
        <p>Chat with our stylist.</p>
      </div>
      <button className={styles.secondaryButton} onClick={openCustomerChat} type="button">
        Open Customer Chat
      </button>
    </div>
  );
}
