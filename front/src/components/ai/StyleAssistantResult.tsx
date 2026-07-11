"use client";

import { ArrowUpRight, Loader2, MessageCircle, Save } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { FashionIllustration } from "@/components/ai/StyleAssistantEmpty";
import styles from "@/components/ai/StyleAssistant.module.css";
import { getCurrentStyleAdviceOutfit } from "@/features/ai/normalize";
import type {
  StyleAdviceCanonicalOutfit,
  StyleAdviceCanonicalOutfitItem,
  StyleAdviceOutfitProductRole,
  StyleAdviceResponse,
} from "@/features/ai/types";
import { formatPrice } from "@/features/catalog/format";

interface StyleAssistantResultProps {
  isSavingOutfit?: boolean;
  onSaveOutfit?: () => void;
  result: StyleAdviceResponse;
  saveError?: string;
  saveSuccess?: string;
}

type ResultLocale = "vi" | "en";

const RESULT_COPY = {
  en: {
    currentOutfit: "Current outfit",
    handoffAction: "Open Customer Chat",
    handoffBody: "Chat with our stylist.",
    handoffTitle: "Need more personalized advice?",
    matchingNotes: "Matching notes",
    noProducts:
      "No matching in-stock pieces were returned. Try broadening your style, color, or budget description.",
    outOfScopeHeading: "I'm your Belikeme style specialist.",
    outOfScopeLabel: "Let's keep it stylish",
    pieceCount: (count: number) => `${count} piece${count === 1 ? "" : "s"}`,
    saveOutfit: "Save outfit",
    savingOutfit: "Saving outfit…",
    summary: "Summary",
    total: (value: string) => `${value} total`,
    tryAsking: "Try asking",
    viewProduct: "View Product",
    viewProductAria: (name: string) => `View ${name}`,
  },
  vi: {
    saveOutfit: "Lưu outfit",
    savingOutfit: "Đang lưu outfit…",
    currentOutfit: "Outfit hiện tại",
    handoffAction: "Mở chat hỗ trợ",
    handoffBody: "Trò chuyện với stylist của Belikeme.",
    handoffTitle: "Bạn cần tư vấn riêng hơn?",
    matchingNotes: "Lưu ý",
    noProducts:
      "Chưa có sản phẩm còn hàng phù hợp. Hãy thử mô tả rộng hơn về phong cách, màu sắc hoặc ngân sách.",
    outOfScopeHeading: "Mình là trợ lý phối đồ của Belikeme.",
    outOfScopeLabel: "Cùng tìm outfit phù hợp",
    pieceCount: (count: number) => `${count} món`,
    summary: "Tóm tắt",
    total: (value: string) => `Tổng ${value}`,
    tryAsking: "Bạn có thể hỏi",
    viewProduct: "Xem sản phẩm",
    viewProductAria: (name: string) => `Xem ${name}`,
  },
} as const;

export function StyleAssistantResult({
  isSavingOutfit = false,
  onSaveOutfit,
  result,
  saveError,
  saveSuccess,
}: StyleAssistantResultProps) {
  const locale: ResultLocale = result.locale === "vi" ? "vi" : "en";

  if (result.type === "clarification") {
    return <ClarificationResult locale={locale} result={result} />;
  }

  if (result.type === "out_of_scope") {
    return <OutOfScopeResult locale={locale} result={result} />;
  }

  return (
    <CurrentOutfitResult
      isSavingOutfit={isSavingOutfit}
      locale={locale}
      onSaveOutfit={onSaveOutfit}
      result={result}
      saveError={saveError}
      saveSuccess={saveSuccess}
    />
  );
}

function ClarificationResult({
  locale,
  result,
}: {
  locale: ResultLocale;
  result: StyleAdviceResponse;
}) {
  const question =
    result.clarificationQuestion ||
    result.message ||
    result.summary ||
    (locale === "vi"
      ? "Bạn muốn outfit cho dịp nào, vibe gì và ngân sách khoảng bao nhiêu?"
      : "What occasion, vibe, and budget should I style this outfit for?");

  return (
    <section
      aria-live="polite"
      className={`${styles.stateCard} ${styles.clarificationCard}`}
    >
      <span aria-hidden="true" className={styles.assistantAvatar}>
        <MessageCircle size={20} />
      </span>
      <p className={styles.assistantMessage}>{question}</p>
    </section>
  );
}

function CurrentOutfitResult({
  isSavingOutfit,
  locale,
  onSaveOutfit,
  result,
  saveError,
  saveSuccess,
}: {
  isSavingOutfit: boolean;
  locale: ResultLocale;
  onSaveOutfit?: () => void;
  result: StyleAdviceResponse;
  saveError?: string;
  saveSuccess?: string;
}) {
  const copy = RESULT_COPY[locale];
  const outfit = getCurrentStyleAdviceOutfit(result);
  const summary = outfit?.summary || result.message || result.summary || copy.noProducts;

  return (
    <section aria-live="polite" className={styles.resultCard}>
      <div className={styles.summary}>
        <span className={styles.stepNumber}>02</span>
        <div>
          <h2>{copy.summary}</h2>
          <p>{summary}</p>
        </div>
      </div>

      {outfit ? (
        <CurrentOutfit
          isSavingOutfit={isSavingOutfit}
          locale={locale}
          onSaveOutfit={onSaveOutfit}
          outfit={outfit}
          saveError={saveError}
          saveSuccess={saveSuccess}
        />
      ) : (
        <div className={styles.outfitsSection}>
          <div className={styles.sectionHeading}>
            <h3>{copy.currentOutfit}</h3>
          </div>
          <p className={styles.noProducts}>{copy.noProducts}</p>
        </div>
      )}

      {!outfit && result.warnings?.length ? (
        <div className={styles.warningSection}>
          <h3>{copy.matchingNotes}</h3>
          <WarningList warnings={result.warnings} />
        </div>
      ) : null}

      {result.handoff?.required ? <HandoffCard locale={locale} /> : null}
    </section>
  );
}

function CurrentOutfit({
  isSavingOutfit,
  locale,
  onSaveOutfit,
  outfit,
  saveError,
  saveSuccess,
}: {
  isSavingOutfit: boolean;
  locale: ResultLocale;
  onSaveOutfit?: () => void;
  outfit: StyleAdviceCanonicalOutfit;
  saveError?: string;
  saveSuccess?: string;
}) {
  const copy = RESULT_COPY[locale];

  return (
    <div className={styles.outfitsSection}>
      <div className={styles.sectionHeading}>
        <h3>{copy.currentOutfit}</h3>
        {isSavingOutfit ? (
          <span className={styles.savingOutfitStatus} role="status">
            <Loader2 aria-hidden="true" className={styles.spinner} size={16} />
            {copy.savingOutfit}
          </span>
        ) : onSaveOutfit ? (
          <button
            className={styles.saveOutfitButton}
            onClick={onSaveOutfit}
            type="button"
          >
            <Save aria-hidden="true" size={16} />
            {copy.saveOutfit}
          </button>
        ) : null}
      </div>
      {saveError ? (
        <p
          className={`${styles.savedOutfitFeedback} ${styles.savedOutfitError}`}
          role="alert"
        >
          {saveError}
        </p>
      ) : null}
      {saveSuccess ? (
        <p
          className={`${styles.savedOutfitFeedback} ${styles.savedOutfitSuccess}`}
          role="status"
        >
          {saveSuccess}
        </p>
      ) : null}
      <article className={`${styles.outfitCard} ${styles.currentOutfitCard}`}>
        <div className={styles.outfitMeta}>
          <span>{copy.pieceCount(outfit.items.length)}</span>
          <span>{copy.total(formatPrice(outfit.totalPrice))}</span>
        </div>

        <div className={styles.outfitProductGrid}>
          {outfit.items.map((item) => (
            <OutfitProductCard
              item={item}
              key={`${item.role}-${item.productId}`}
              locale={locale}
            />
          ))}
        </div>

        {outfit.warnings?.length ? (
          <WarningList warnings={outfit.warnings} />
        ) : null}
      </article>
    </div>
  );
}

function OutfitProductCard({
  item,
  locale,
}: {
  item: StyleAdviceCanonicalOutfitItem;
  locale: ResultLocale;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const copy = RESULT_COPY[locale];
  const productHref = `/products/${encodeURIComponent(item.productSlug)}`;

  return (
    <article className={styles.outfitProduct}>
      <Link
        aria-label={copy.viewProductAria(item.productName)}
        className={styles.outfitProductImageLink}
        href={productHref}
      >
        {item.imageUrl && !imageFailed ? (
          <img
            alt={item.productName}
            className={styles.outfitProductImage}
            loading="lazy"
            onError={() => setImageFailed(true)}
            src={item.imageUrl}
          />
        ) : (
          <span className={styles.productImageFallback}>BELIKEME</span>
        )}
      </Link>
      <div className={styles.outfitProductBody}>
        <span className={styles.roleBadge}>{formatRole(item.role, locale)}</span>
        <h5>{item.productName}</h5>
        <strong>{formatPrice(item.price)}</strong>
        <Link className={styles.productLink} href={productHref}>
          {copy.viewProduct}
          <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
      </div>
    </article>
  );
}

function WarningList({ warnings }: { warnings: string[] }) {
  return (
    <ul className={styles.outfitWarnings}>
      {warnings.map((warning, index) => (
        <li key={`${index}-${warning}`}>{warning}</li>
      ))}
    </ul>
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
  const message = result.message || result.summary || copy.outOfScopeHeading;

  return (
    <section
      aria-live="polite"
      className={`${styles.stateCard} ${styles.outOfScopeCard}`}
    >
      <FashionIllustration compact />
      <span className={styles.resultLabel}>{copy.outOfScopeLabel}</span>
      <h2>{copy.outOfScopeHeading}</h2>
      <p>{message}</p>
      {result.extraTips?.length ? (
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
      <button
        className={styles.secondaryButton}
        onClick={openCustomerChat}
        type="button"
      >
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
    accessory: { en: "Accessory", vi: "Phụ kiện" },
    handbag: { en: "Bag", vi: "Túi" },
  };

  return labels[role][locale];
}
