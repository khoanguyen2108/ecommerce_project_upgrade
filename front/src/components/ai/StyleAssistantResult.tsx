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

  if (result.type === "clarification") {
    return <ClarificationResult result={result} />;
  }

  if (result.type === "out_of_scope") {
    return <OutOfScopeResult result={result} />;
  }

  return (
    <CurrentOutfitResult
      isSavingOutfit={isSavingOutfit}
      onPrepareOutfit={onPrepareOutfit}
      onSaveOutfit={onSaveOutfit}
      result={result}
      saveError={saveError}
      saveSuccess={saveSuccess}
    />
  );
}

function ClarificationResult({ result }: { result: StyleAdviceResponse }) {
  const question =
    result.clarificationQuestion ||
    result.message ||
    result.summary ||
    "What occasion, vibe, and budget should I style this outfit for?";

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
  onPrepareOutfit,
  onSaveOutfit,
  result,
  saveError,
  saveSuccess,
}: {
  isSavingOutfit: boolean;
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
    "No matching in-stock pieces were returned. Try broadening your style, color, or budget description.";

  return (
    <section aria-live="polite" className={styles.resultCard}>
      <div className={styles.summary}>
        <div>
          <h2>{"Summary"}</h2>
          <p>{summary}</p>
        </div>
      </div>

      {outfit ? (
        <CurrentOutfit
          isSavingOutfit={isSavingOutfit}
          onPrepareOutfit={onPrepareOutfit}
          onSaveOutfit={onSaveOutfit}
          outfit={outfit}
          saveError={saveError}
          saveSuccess={saveSuccess}
        />
      ) : (
        <div className={styles.outfitsSection}>
          <div className={styles.sectionHeading}>
            <h3>{"Current outfit"}</h3>
          </div>
          <p className={styles.noProducts}>
            {"No matching in-stock pieces were returned. Try broadening your style, color, or budget description."}
          </p>
        </div>
      )}

      {!outfit && result.warnings?.length ? (
        <div className={styles.warningSection}>
          <h3>{"Matching notes"}</h3>
          <WarningList warnings={result.warnings} />
        </div>
      ) : null}

      {result.handoff?.required ? <HandoffCard /> : null}
    </section>
  );
}

function CurrentOutfit({
  isSavingOutfit,
  onPrepareOutfit,
  onSaveOutfit,
  outfit,
  saveError,
  saveSuccess,
}: {
  isSavingOutfit: boolean;
  onPrepareOutfit?: () => void;
  onSaveOutfit?: () => void;
  outfit: StyleAdviceCanonicalOutfit;
  saveError?: string;
  saveSuccess?: string;
}) {
  return (
    <div className={styles.outfitsSection}>
      <div className={styles.sectionHeading}>
        <h3>{"Current outfit"}</h3>
        <div className={styles.outfitHeadingActions}>
          {isSavingOutfit ? (
            <span className={styles.savingOutfitStatus} role="status">
              <Loader2 aria-hidden="true" className={styles.spinner} size={16} />
              {"Saving outfit..."}
            </span>
          ) : onSaveOutfit ? (
            <button className={styles.saveOutfitButton} onClick={onSaveOutfit} type="button">
              <Save aria-hidden="true" size={16} />
              {"Save outfit"}
            </button>
          ) : null}
          {onPrepareOutfit && outfit.items.length > 0 ? (
            <button className={styles.prepareOutfitButton} onClick={onPrepareOutfit} type="button">
              {"Continue with this outfit"}
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
        <div className={styles.outfitProductGrid}>
          {outfit.items.map((item) => (
            <OutfitProductCard item={item} key={`${item.role}-${item.productId}`} />
          ))}
        </div>

        {outfit.warnings?.length ? <WarningList warnings={outfit.warnings} /> : null}
      </article>
    </div>
  );
}

function OutfitProductCard({ item }: { item: StyleAdviceCanonicalOutfitItem; }) {
  const [imageFailed, setImageFailed] = useState(false);
  const productHref = `/products/${encodeURIComponent(item.productSlug)}`;
  const productName = (item.productName ?? "");

  return (
    <article className={styles.outfitProduct}>
      <Link
        aria-label={`${"View product"}: ${productName}`}
        className={styles.outfitProductImageLink}
        href={productHref}
      >
        {item.imageUrl && !imageFailed ? (
          <img
            alt={productName}
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
        <span className={styles.roleBadge}>{formatRole(item.role)}</span>
        <h5>{productName}</h5>
        <strong>{formatPrice(item.price)}</strong>
        <Link className={styles.productLink} href={productHref}>
          {"View product"}
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

function OutOfScopeResult({ result }: { result: StyleAdviceResponse }) {
  const message =
    result.message || result.summary || "I'm your Belikeme style specialist.";

  return (
    <section aria-live="polite" className={`${styles.stateCard} ${styles.outOfScopeCard}`}>
      <FashionIllustration compact />
      <span className={styles.resultLabel}>{"Let's keep it stylish"}</span>
      <h2>{"I'm your Belikeme style specialist."}</h2>
      <p>{message}</p>
      {result.extraTips?.length ? (
        <div className={styles.examples}>
          <h3>{"Try asking"}</h3>
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

function HandoffCard({  }: { }) {
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
        <h3>{"Need more personalized advice?"}</h3>
        <p>{"Chat with our stylist."}</p>
      </div>
      <button className={styles.secondaryButton} onClick={openCustomerChat} type="button">
        {"Open Customer Chat"}
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
    accessory: "Accessory",
    handbag: "Bag",
  };
  return labels[role];
}
