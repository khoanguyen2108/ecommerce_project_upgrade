"use client";

import { ArrowRight, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import styles from "@/components/ai/StyleAssistant.module.css";
import { formatPrice } from "@/features/catalog/format";
import type { Locale } from "@/features/i18n/locale";
import { translate } from "@/features/i18n/translations";
import { useI18n } from "@/features/i18n/useI18n";
import type {
  SavedOutfit,
  SavedOutfitItemSnapshot,
} from "@/features/saved-outfits/types";

interface SavedOutfitsSectionProps {
  deletingSavedOutfitId?: string;
  error?: string;
  isLoading: boolean;
  onDelete: (id: string) => Promise<boolean>;
  onPrepare: (savedOutfit: SavedOutfit) => void;
  onView: (savedOutfit: SavedOutfit) => void;
  savedOutfits: SavedOutfit[];
}

export function SavedOutfitsSection({
  deletingSavedOutfitId,
  error,
  isLoading,
  onDelete,
  onPrepare,
  onView,
  savedOutfits,
}: SavedOutfitsSectionProps) {
  const { locale, t } = useI18n();

  return (
    <section
      aria-busy={isLoading}
      aria-labelledby="saved-outfits-heading"
      className={styles.savedOutfitsSection}
    >
      <div className={styles.savedOutfitsHeading}>
        <div>
          <h2 id="saved-outfits-heading">{t("ai.savedOutfits")}</h2>
        </div>
        {isLoading && savedOutfits.length > 0 ? (
          <Loader2 aria-hidden="true" className={styles.spinner} size={18} />
        ) : null}
      </div>

      {error ? (
        <p className={`${styles.savedOutfitFeedback} ${styles.savedOutfitError}`} role="alert">
          {error}
        </p>
      ) : null}

      {isLoading && savedOutfits.length === 0 ? (
        <p className={styles.savedOutfitsState} role="status">
          <Loader2 aria-hidden="true" className={styles.spinner} size={18} />
          {t("ai.loadingSavedOutfits")}
        </p>
      ) : null}

      {!isLoading && !error && savedOutfits.length === 0 ? (
        <p className={styles.savedOutfitsState}>{t("ai.noSavedOutfits")}</p>
      ) : null}

      {savedOutfits.length > 0 ? (
        <div className={styles.savedOutfitList}>
          {savedOutfits.map((savedOutfit) => {
            const isDeleting = deletingSavedOutfitId === savedOutfit.id;
            const itemLabel = t(
              savedOutfit.items.length === 1 ? "ai.item" : "ai.items",
            );

            return (
              <article className={styles.savedOutfitCard} key={savedOutfit.id}>
                <div className={styles.savedOutfitThumbnails}>
                  {savedOutfit.items.slice(0, 4).map((item) => (
                    <SavedOutfitThumbnail
                      item={item}
                      key={`${item.role}-${item.productId}`}
                      locale={locale}
                    />
                  ))}
                </div>
                <div className={styles.savedOutfitBody}>
                  <h3>{savedOutfit.summary}</h3>
                  <div className={styles.savedOutfitMeta}>
                    <strong>{formatPrice(savedOutfit.totalPriceSnapshot)}</strong>
                    <span>{savedOutfit.items.length} {itemLabel}</span>
                    <time dateTime={savedOutfit.createdAt}>
                      {t("ai.saved")} {formatSavedDate(savedOutfit.createdAt, locale)}
                    </time>
                  </div>
                  <div className={styles.savedOutfitActions}>
                    <button
                      aria-label={`${t("ai.continueSaved")}: ${savedOutfit.summary}`}
                      className={styles.savedOutfitPrepareButton}
                      disabled={isDeleting}
                      onClick={() => onPrepare(savedOutfit)}
                      type="button"
                    >
                      {t("ai.continueSaved")}
                      <ArrowRight aria-hidden="true" size={15} />
                    </button>
                    <button
                      aria-label={`${t("ai.viewEdit")}: ${savedOutfit.summary}`}
                      className={styles.savedOutfitViewButton}
                      disabled={isDeleting}
                      onClick={() => onView(savedOutfit)}
                      type="button"
                    >
                      <Pencil aria-hidden="true" size={15} />
                      {t("ai.viewEdit")}
                    </button>
                    <button
                      aria-label={`${t("ai.delete")}: ${savedOutfit.summary}`}
                      className={styles.savedOutfitDeleteButton}
                      disabled={Boolean(deletingSavedOutfitId)}
                      onClick={() => {
                        if (window.confirm(t("ai.deleteConfirm"))) {
                          void onDelete(savedOutfit.id);
                        }
                      }}
                      type="button"
                    >
                      {isDeleting ? (
                        <Loader2 aria-hidden="true" className={styles.spinner} size={15} />
                      ) : (
                        <Trash2 aria-hidden="true" size={15} />
                      )}
                      {isDeleting ? t("ai.deleting") : t("ai.delete")}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function SavedOutfitThumbnail({ item, locale }: { item: SavedOutfitItemSnapshot; locale: Locale }) {
  const [imageFailed, setImageFailed] = useState(false);
  const alt = `${item.productNameSnapshot} · ${translate(locale, "ai.savedOutfits")}`;

  if (!item.imageUrlSnapshot || imageFailed) {
    return (
      <span aria-label={alt} className={styles.savedOutfitThumbnailFallback} role="img">
        BELIKEME
      </span>
    );
  }

  return (
    <img
      alt={alt}
      className={styles.savedOutfitThumbnail}
      loading="lazy"
      onError={() => setImageFailed(true)}
      src={item.imageUrlSnapshot}
    />
  );
}

function formatSavedDate(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}
