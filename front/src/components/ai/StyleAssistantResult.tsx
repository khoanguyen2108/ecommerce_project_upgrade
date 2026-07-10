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

type ResultLocale = "vi" | "en";

const RESULT_COPY = {
  en: {
    color: "Color",
    extraTips: "Extra tips",
    handoffAction: "Open Customer Chat",
    handoffBody: "Chat with our stylist.",
    handoffTitle: "Need more personalized advice?",
    match: "match",
    matchingNotes: "Matching notes",
    noProducts:
      "No matching in-stock pieces were returned. Try broadening your style, color, or budget description.",
    optionCount: (count: number) => `${count} option${count === 1 ? "" : "s"}`,
    outfitRecommendations: "Outfit recommendations",
    outOfScopeHeading: "I'm your Belikeme style specialist.",
    outOfScopeLabel: "Let's keep it stylish",
    pieceCount: (count: number) => `${count} piece${count === 1 ? "" : "s"}`,
    recommendedProducts: "Recommended products",
    selectedCount: (count: number, total: string) =>
      `${count} selected${count ? ` - ${total} total` : ""}`,
    size: "Size",
    summary: "Summary",
    total: (value: string) => `${value} total`,
    tryAsking: "Try asking",
    variantChoice: "Choose on product page",
    viewProduct: "View Product",
    viewProductAria: (name: string) => `View ${name}`,
  },
  vi: {
    color: "Màu",
    extraTips: "Gợi ý phối đồ",
    handoffAction: "Mở chat hỗ trợ",
    handoffBody: "Trò chuyện với stylist của Belikeme.",
    handoffTitle: "Bạn cần tư vấn riêng hơn?",
    match: "phù hợp",
    matchingNotes: "Lưu ý",
    noProducts:
      "Chưa có sản phẩm còn hàng phù hợp. Hãy thử mô tả rộng hơn về phong cách, màu sắc hoặc ngân sách.",
    optionCount: (count: number) => `${count} lựa chọn`,
    outfitRecommendations: "Gợi ý outfit",
    outOfScopeHeading: "Mình là trợ lý phối đồ của Belikeme.",
    outOfScopeLabel: "Cùng tìm outfit phù hợp",
    pieceCount: (count: number) => `${count} món`,
    recommendedProducts: "Sản phẩm gợi ý",
    selectedCount: (count: number, total: string) =>
      `${count} sản phẩm${count ? ` - Tổng ${total}` : ""}`,
    size: "Size",
    summary: "Tóm tắt",
    total: (value: string) => `Tổng ${value}`,
    tryAsking: "Bạn có thể hỏi",
    variantChoice: "Chọn trên trang sản phẩm",
    viewProduct: "Xem sản phẩm",
    viewProductAria: (name: string) => `Xem ${name}`,
  },
} as const;

export function StyleAssistantResult({ result }: StyleAssistantResultProps) {
  const locale: ResultLocale = result.locale === "vi" ? "vi" : "en";
  const copy = RESULT_COPY[locale];

  if (result.mode === "out_of_scope") {
    return <OutOfScopeResult locale={locale} result={result} />;
  }

  const outfits = result.outfits ?? [];

  return (
    <section aria-live="polite" className={styles.resultCard}>
      <div className={styles.summary}>
        <span className={styles.stepNumber}>02</span>
        <div>
          <h2>{copy.summary}</h2>
          <p>{result.summary}</p>
        </div>
      </div>

      {outfits.length ? (
        <OutfitResults locale={locale} outfits={outfits} />
      ) : (
        <LegacyRecommendationResults
          locale={locale}
          recommendations={result.recommendations}
        />
      )}

      {result.warnings?.length ? (
        <div className={styles.warningSection}>
          <h3>{copy.matchingNotes}</h3>
          <ul>
            {result.warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.extraTips.length ? (
        <div className={styles.tipsSection}>
          <h3>{copy.extraTips}</h3>
          <ul>
            {result.extraTips.map((tip, index) => (
              <li key={`${index}-${tip}`}>{tip}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.handoff?.required ? <HandoffCard locale={locale} /> : null}
    </section>
  );
}

function OutfitResults({
  locale,
  outfits,
}: {
  locale: ResultLocale;
  outfits: StyleAdviceOutfit[];
}) {
  const displayedOutfits = outfits.slice(0, 2);
  const copy = RESULT_COPY[locale];

  return (
    <div className={styles.outfitsSection}>
      <div className={styles.sectionHeading}>
        <h3>{copy.outfitRecommendations}</h3>
        <span>{copy.optionCount(displayedOutfits.length)}</span>
      </div>
      <div className={styles.outfitList}>
        {displayedOutfits.map((outfit, index) => (
          <OutfitCard
            key={`${outfit.title}-${index}-${outfit.products.map((product) => product.productId).join("-")}`}
            locale={locale}
            outfit={outfit}
          />
        ))}
      </div>
    </div>
  );
}

function OutfitCard({
  locale,
  outfit,
}: {
  locale: ResultLocale;
  outfit: StyleAdviceOutfit;
}) {
  const copy = RESULT_COPY[locale];
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
          <small>{copy.match}</small>
        </div>
      </div>

      <div className={styles.outfitMeta}>
        <span>{copy.pieceCount(outfit.products.length)}</span>
        <span>{copy.total(formatPrice(totalPrice))}</span>
      </div>

      <div className={styles.outfitProductGrid}>
        {outfit.products.map((product) => (
          <OutfitProductCard
            key={`${product.role}-${product.productId}`}
            locale={locale}
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

function OutfitProductCard({
  locale,
  product,
}: {
  locale: ResultLocale;
  product: StyleAdviceOutfitProduct;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const copy = RESULT_COPY[locale];

  return (
    <article className={styles.outfitProduct}>
      <Link
        aria-label={copy.viewProductAria(product.productName)}
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
        <span className={styles.roleBadge}>{formatRole(product.role, locale)}</span>
        <h5>{product.productName}</h5>
        <strong>{formatPrice(product.price)}</strong>
        <Link
          className={styles.productLink}
          href={`/products/${encodeURIComponent(product.productSlug)}`}
        >
          {copy.viewProduct}
          <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </article>
  );
}

function LegacyRecommendationResults({
  locale,
  recommendations,
}: {
  locale: ResultLocale;
  recommendations: StyleAdviceRecommendation[];
}) {
  const copy = RESULT_COPY[locale];
  const totalPrice = recommendations.reduce(
    (total, recommendation) => total + recommendation.price,
    0,
  );

  return (
    <div className={styles.recommendationsSection}>
      <div className={styles.sectionHeading}>
        <h3>{copy.recommendedProducts}</h3>
        <span>{copy.selectedCount(recommendations.length, formatPrice(totalPrice))}</span>
      </div>
      {recommendations.length ? (
        <div className={styles.productList}>
          {recommendations.map((recommendation) => (
            <RecommendationCard
              key={recommendation.productId}
              locale={locale}
              recommendation={recommendation}
            />
          ))}
        </div>
      ) : (
        <p className={styles.noProducts}>{copy.noProducts}</p>
      )}
    </div>
  );
}

function RecommendationCard({
  locale,
  recommendation,
}: {
  locale: ResultLocale;
  recommendation: StyleAdviceRecommendation;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const copy = RESULT_COPY[locale];

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
            <dt>{copy.color}</dt>
            <dd>{copy.variantChoice}</dd>
          </div>
          <div>
            <dt>{copy.size}</dt>
            <dd>{copy.variantChoice}</dd>
          </div>
        </dl>
        <Link
          className={styles.productLink}
          href={`/products/${encodeURIComponent(recommendation.productSlug)}`}
        >
          {copy.viewProduct}
          <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </article>
  );
}

function OutOfScopeResult({
  locale,
  result,
}: {
  locale: ResultLocale;
  result: StyleAdviceResponse;
}) {
  const copy = RESULT_COPY[locale];

  return (
    <section aria-live="polite" className={`${styles.stateCard} ${styles.outOfScopeCard}`}>
      <FashionIllustration compact />
      <span className={styles.resultLabel}>{copy.outOfScopeLabel}</span>
      <h2>{copy.outOfScopeHeading}</h2>
      <p>{result.summary}</p>
      {result.extraTips.length ? (
        <div className={styles.examples}>
          <h3>{copy.tryAsking}</h3>
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

function HandoffCard({ locale }: { locale: ResultLocale }) {
  const copy = RESULT_COPY[locale];

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
        <h3>{copy.handoffTitle}</h3>
        <p>{copy.handoffBody}</p>
      </div>
      <button className={styles.secondaryButton} onClick={openCustomerChat} type="button">
        {copy.handoffAction}
      </button>
    </div>
  );
}

function formatRole(
  role: StyleAdviceOutfitProductRole,
  locale: ResultLocale,
): string {
  const labels: Record<
    StyleAdviceOutfitProductRole,
    Record<ResultLocale, string>
  > = {
    top: { en: "Top", vi: "Áo" },
    bottom: { en: "Bottom", vi: "Quần" },
    shoes: { en: "Shoes", vi: "Giày" },
    jacket: { en: "Jacket", vi: "Áo khoác" },
    handbag: { en: "Bag", vi: "Túi" },
    accessory: { en: "Accessory", vi: "Phụ kiện" },
  };

  return labels[role][locale];
}
