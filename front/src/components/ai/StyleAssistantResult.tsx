"use client";

import {
  ArrowRight,
  ArrowUpRight,
  Loader2,
  MessageCircle,
  Save,
} from "lucide-react";
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
import type { Locale } from "@/features/i18n/locale";
import { translate } from "@/features/i18n/translations";
import { useI18n } from "@/features/i18n/useI18n";

interface StyleAssistantResultProps {
  isSavingOutfit?: boolean;
  onPrepareOutfit?: () => void;
  onSaveOutfit?: () => void;
  result: StyleAdviceResponse;
  saveError?: string;
  saveSuccess?: string;
}

export function StyleAssistantResult({
  isSavingOutfit = false,
  onPrepareOutfit,
  onSaveOutfit,
  result,
  saveError,
  saveSuccess,
}: StyleAssistantResultProps) {
  const { locale } = useI18n();

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
      onPrepareOutfit={onPrepareOutfit}
      onSaveOutfit={onSaveOutfit}
      result={result}
      saveError={saveError}
      saveSuccess={saveSuccess}
    />
  );
}

function ClarificationResult({ locale, result }: { locale: Locale; result: StyleAdviceResponse }) {
  const question =
    result.clarificationQuestion ||
    result.message ||
    result.summary ||
    translate(locale, "ai.clarificationFallback");

  return (
    <section aria-live="polite" className={`${styles.stateCard} ${styles.clarificationCard}`}>
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
  onPrepareOutfit,
  onSaveOutfit,
  result,
  saveError,
  saveSuccess,
}: {
  isSavingOutfit: boolean;
  locale: Locale;
  onPrepareOutfit?: () => void;
  onSaveOutfit?: () => void;
  result: StyleAdviceResponse;
  saveError?: string;
  saveSuccess?: string;
}) {
  const outfit = getCurrentStyleAdviceOutfit(result);
  const summary =
    outfit?.summary ||
    result.message ||
    result.summary ||
    translate(locale, "ai.noMatchingProducts");

  return (
    <section aria-live="polite" className={styles.resultCard}>
      <div className={styles.summary}>
        <div>
          <h2>{translate(locale, "ai.summary")}</h2>
          <p>{summary}</p>
        </div>
      </div>

      {outfit ? (
        <CurrentOutfit
          isSavingOutfit={isSavingOutfit}
          locale={locale}
          onPrepareOutfit={onPrepareOutfit}
          onSaveOutfit={onSaveOutfit}
          outfit={outfit}
          saveError={saveError}
          saveSuccess={saveSuccess}
        />
      ) : (
        <div className={styles.outfitsSection}>
          <div className={styles.sectionHeading}>
            <h3>{translate(locale, "ai.currentOutfit")}</h3>
          </div>
          <p className={styles.noProducts}>
            {translate(locale, "ai.noMatchingProducts")}
          </p>
        </div>
      )}

      {!outfit && result.warnings?.length ? (
        <div className={styles.warningSection}>
          <h3>{translate(locale, "ai.matchingNotes")}</h3>
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
  onPrepareOutfit,
  onSaveOutfit,
  outfit,
  saveError,
  saveSuccess,
}: {
  isSavingOutfit: boolean;
  locale: Locale;
  onPrepareOutfit?: () => void;
  onSaveOutfit?: () => void;
  outfit: StyleAdviceCanonicalOutfit;
  saveError?: string;
  saveSuccess?: string;
}) {
  const countLabel = translate(
    locale,
    outfit.items.length === 1 ? "ai.piece" : "ai.pieces",
  );

  return (
    <div className={styles.outfitsSection}>
      <div className={styles.sectionHeading}>
        <h3>{translate(locale, "ai.currentOutfit")}</h3>
        <div className={styles.outfitHeadingActions}>
          {isSavingOutfit ? (
            <span className={styles.savingOutfitStatus} role="status">
              <Loader2 aria-hidden="true" className={styles.spinner} size={16} />
              {translate(locale, "ai.savingOutfit")}
            </span>
          ) : onSaveOutfit ? (
            <button className={styles.saveOutfitButton} onClick={onSaveOutfit} type="button">
              <Save aria-hidden="true" size={16} />
              {translate(locale, "ai.saveOutfit")}
            </button>
          ) : null}
          {onPrepareOutfit && outfit.items.length > 0 ? (
            <button className={styles.prepareOutfitButton} onClick={onPrepareOutfit} type="button">
              {translate(locale, "ai.continueCurrent")}
              <ArrowRight aria-hidden="true" size={16} />
            </button>
          ) : null}
        </div>
      </div>
      {saveError ? (
        <p className={`${styles.savedOutfitFeedback} ${styles.savedOutfitError}`} role="alert">
          {saveError}
        </p>
      ) : null}
      {saveSuccess ? (
        <p className={`${styles.savedOutfitFeedback} ${styles.savedOutfitSuccess}`} role="status">
          {saveSuccess}
        </p>
      ) : null}
      <article className={`${styles.outfitCard} ${styles.currentOutfitCard}`}>
        <div className={styles.outfitMeta}>
          <span>{outfit.items.length} {countLabel}</span>
          <span>{formatPrice(outfit.totalPrice)} {translate(locale, "ai.total")}</span>
        </div>

        <div className={styles.outfitProductGrid}>
          {outfit.items.map((item) => (
            <OutfitProductCard item={item} key={`${item.role}-${item.productId}`} locale={locale} />
          ))}
        </div>

        {outfit.warnings?.length ? <WarningList warnings={outfit.warnings} /> : null}
      </article>
    </div>
  );
}

function OutfitProductCard({ item, locale }: { item: StyleAdviceCanonicalOutfitItem; locale: Locale }) {
  const [imageFailed, setImageFailed] = useState(false);
  const productHref = `/products/${encodeURIComponent(item.productSlug)}`;

  return (
    <article className={styles.outfitProduct}>
      <Link
        aria-label={`${translate(locale, "ai.viewProduct")}: ${item.productName}`}
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
          {translate(locale, "ai.viewProduct")}
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

function OutOfScopeResult({ locale, result }: { locale: Locale; result: StyleAdviceResponse }) {
  const message =
    result.message || result.summary || translate(locale, "ai.outOfScopeHeading");

  return (
    <section aria-live="polite" className={`${styles.stateCard} ${styles.outOfScopeCard}`}>
      <FashionIllustration compact />
      <span className={styles.resultLabel}>{translate(locale, "ai.outOfScopeLabel")}</span>
      <h2>{translate(locale, "ai.outOfScopeHeading")}</h2>
      <p>{message}</p>
      {result.extraTips?.length ? (
        <div className={styles.examples}>
          <h3>{translate(locale, "ai.tryAsking")}</h3>
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

function HandoffCard({ locale }: { locale: Locale }) {
  function openCustomerChat() {
    const launcher = document.querySelector<HTMLButtonElement>(
      ".customer-chat-widget__launcher",
    );
    if (launcher) {
      launcher.click();
      return;
    }
    document.querySelector<HTMLElement>(".customer-chat-panel")?.focus({ preventScroll: false });
  }

  return (
    <div className={styles.handoffCard}>
      <MessageCircle aria-hidden="true" size={22} />
      <div>
        <h3>{translate(locale, "ai.handoffTitle")}</h3>
        <p>{translate(locale, "ai.handoffBody")}</p>
      </div>
      <button className={styles.secondaryButton} onClick={openCustomerChat} type="button">
        {translate(locale, "ai.handoffAction")}
      </button>
    </div>
  );
}

function formatRole(role: StyleAdviceOutfitProductRole, locale: Locale): string {
  const keys = {
    top: "ai.roleTop",
    bottom: "ai.roleBottom",
    shoes: "ai.roleShoes",
    jacket: "ai.roleJacket",
    accessory: "ai.roleAccessory",
    handbag: "ai.roleBag",
  } as const;
  return translate(locale, keys[role]);
}
