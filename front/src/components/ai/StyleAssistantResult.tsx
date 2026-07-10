"use client";

import { ArrowUpRight, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FashionIllustration } from "@/components/ai/StyleAssistantEmpty";
import styles from "@/components/ai/StyleAssistant.module.css";
import type {
  StyleAdviceOutfit,
  StyleAdviceOutfitProduct,
  StyleAdviceOutfitProductRole,
  StyleAdviceRecommendation,
  StyleAdviceResponse,
} from "@/features/ai/types";
import { formatPrice } from "@/features/catalog/format";

interface StyleAssistantResultProps {
  result: StyleAdviceResponse;
}

export function StyleAssistantResult({ result }: StyleAssistantResultProps) {
  if (result.mode === "out_of_scope") {
    return <OutOfScopeResult result={result} />;
  }

  const outfits = result.outfits ?? [];

  return (
    <section aria-live="polite" className={styles.resultCard}>
      <div className={styles.summary}>
        <span className={styles.stepNumber}>02</span>
        <div>
          <h2>Summary</h2>
          <p>{result.summary}</p>
        </div>
      </div>

      {outfits.length ? (
        <OutfitResults outfits={outfits} />
      ) : (
        <LegacyRecommendationResults recommendations={result.recommendations} />
      )}

      {result.warnings?.length ? (
        <div className={styles.warningSection}>
          <h3>Matching notes</h3>
          <ul>
            {result.warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

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

function OutfitResults({ outfits }: { outfits: StyleAdviceOutfit[] }) {
  const displayedOutfits = outfits.slice(0, 2);

  return (
    <div className={styles.outfitsSection}>
      <div className={styles.sectionHeading}>
        <h3>Outfit recommendations</h3>
        <span>
          {displayedOutfits.length} option{displayedOutfits.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className={styles.outfitList}>
        {displayedOutfits.map((outfit, index) => (
          <OutfitCard
            key={`${outfit.title}-${index}-${outfit.products.map((product) => product.productId).join("-")}`}
            outfit={outfit}
          />
        ))}
      </div>
    </div>
  );
}

function OutfitCard({ outfit }: { outfit: StyleAdviceOutfit }) {
  const totalPrice = outfit.products.reduce(
    (total, product) => total + product.price,
    0,
  );

  return (
    <article className={styles.outfitCard}>
      <div className={styles.outfitHeader}>
        <div>
          <h4>{outfit.title}</h4>
          <p>{outfit.reason}</p>
        </div>
        <div className={styles.outfitScore}>
          <span>{outfit.score}</span>
          <small>match</small>
        </div>
      </div>

      <div className={styles.outfitMeta}>
        <span>{outfit.products.length} pieces</span>
        <span>{formatPrice(totalPrice)} total</span>
      </div>

      <div className={styles.outfitProductGrid}>
        {outfit.products.map((product) => (
          <OutfitProductCard
            key={`${product.role}-${product.productId}`}
            product={product}
          />
        ))}
      </div>

      {outfit.warnings.length ? (
        <ul className={styles.outfitWarnings}>
          {outfit.warnings.map((warning, index) => (
            <li key={`${index}-${warning}`}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function OutfitProductCard({ product }: { product: StyleAdviceOutfitProduct }) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article className={styles.outfitProduct}>
      <Link
        aria-label={`View ${product.productName}`}
        className={styles.outfitProductImageLink}
        href={`/products/${encodeURIComponent(product.productSlug)}`}
      >
        {product.imageUrl && !imageFailed ? (
          <img
            alt={product.productName}
            className={styles.outfitProductImage}
            loading="lazy"
            onError={() => setImageFailed(true)}
            src={product.imageUrl}
          />
        ) : (
          <span className={styles.productImageFallback}>BELIKEME</span>
        )}
      </Link>
      <div className={styles.outfitProductBody}>
        <span className={styles.roleBadge}>{formatRole(product.role)}</span>
        <h5>{product.productName}</h5>
        <strong>{formatPrice(product.price)}</strong>
        <Link
          className={styles.productLink}
          href={`/products/${encodeURIComponent(product.productSlug)}`}
        >
          View Product
          <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </article>
  );
}

function LegacyRecommendationResults({
  recommendations,
}: {
  recommendations: StyleAdviceRecommendation[];
}) {
  const totalPrice = recommendations.reduce(
    (total, recommendation) => total + recommendation.price,
    0,
  );

  return (
    <div className={styles.recommendationsSection}>
      <div className={styles.sectionHeading}>
        <h3>Recommended products</h3>
        <span>
          {recommendations.length} selected
          {recommendations.length ? ` - ${formatPrice(totalPrice)} total` : ""}
        </span>
      </div>
      {recommendations.length ? (
        <div className={styles.productList}>
          {recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.productId}
              recommendation={recommendation}
            />
          ))}
        </div>
      ) : (
        <p className={styles.noProducts}>
          No matching in-stock pieces were returned. Try broadening your style,
          color, or budget description.
        </p>
      )}
    </div>
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
      <span className={styles.resultLabel}>Let's keep it stylish</span>
      <h2>I'm your Belikeme style specialist.</h2>
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

function formatRole(role: StyleAdviceOutfitProductRole): string {
  const labels: Record<StyleAdviceOutfitProductRole, string> = {
    top: "Top",
    bottom: "Bottom",
    shoes: "Shoes",
    jacket: "Jacket",
    handbag: "Bag",
    accessory: "Accessory",
  };

  return labels[role];
}
