"use client";

import { ArrowRight, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import styles from "@/components/ai/StyleAssistant.module.css";
import type {
  SavedOutfit,
  SavedOutfitItemSnapshot,
} from "@/features/saved-outfits/types";
import { formatPrice } from "@/features/catalog/format";

interface SavedOutfitsSectionProps {
  deletingSavedOutfitId?: string;
  error?: string;
  isLoading: boolean;
  locale: "vi" | "en";
  onDelete: (id: string) => Promise<boolean>;
  onPrepare: (savedOutfit: SavedOutfit) => void;
  onView: (savedOutfit: SavedOutfit) => void;
  savedOutfits: SavedOutfit[];
}

const SAVED_COPY = {
  en: {
    created: (value: string) => `Saved ${value}`,
    delete: "Delete",
    deleteAria: (summary: string) => `Delete saved outfit: ${summary}`,
    deleteConfirm: "Delete this saved outfit?",
    deleting: "Deleting",
    empty: "You have not saved any outfits yet.",
    heading: "Saved outfits",
    itemCount: (count: number) => `${count} item${count === 1 ? "" : "s"}`,
    loading: "Loading saved outfits…",
    thumbnailAlt: (name: string) => `${name} in saved outfit`,
    view: "View/Edit",
    viewAria: (summary: string) => `View or edit saved outfit: ${summary}`,
  },
  vi: {
    created: (value: string) => `Đã lưu ${value}`,
    delete: "Xóa",
    deleteAria: (summary: string) => `Xóa outfit đã lưu: ${summary}`,
    deleteConfirm: "Xóa outfit đã lưu này?",
    deleting: "Đang xóa",
    empty: "Bạn chưa lưu outfit nào.",
    heading: "Outfit đã lưu",
    itemCount: (count: number) => `${count} món`,
    loading: "Đang tải outfit đã lưu…",
    thumbnailAlt: (name: string) => `${name} trong outfit đã lưu`,
    view: "Xem/Chỉnh",
    viewAria: (summary: string) => `Xem hoặc chỉnh outfit đã lưu: ${summary}`,
  },
} as const;

export function SavedOutfitsSection({
  deletingSavedOutfitId,
  error,
  isLoading,
  locale,
  onDelete,
  onPrepare,
  onView,
  savedOutfits,
}: SavedOutfitsSectionProps) {
  const copy = SAVED_COPY[locale];

  return (
    <section
      aria-busy={isLoading}
      aria-labelledby="saved-outfits-heading"
      className={styles.savedOutfitsSection}
    >
      <div className={styles.savedOutfitsHeading}>
        <div>
          <h2 id="saved-outfits-heading">{copy.heading}</h2>
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
          {copy.loading}
        </p>
      ) : null}

      {!isLoading && !error && savedOutfits.length === 0 ? (
        <p className={styles.savedOutfitsState}>{copy.empty}</p>
      ) : null}

      {savedOutfits.length > 0 ? (
        <div className={styles.savedOutfitList}>
          {savedOutfits.map((savedOutfit) => {
            const isDeleting = deletingSavedOutfitId === savedOutfit.id;

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
                    <span>{copy.itemCount(savedOutfit.items.length)}</span>
                    <time dateTime={savedOutfit.createdAt}>
                      {copy.created(formatSavedDate(savedOutfit.createdAt, locale))}
                    </time>
                  </div>
                  <div className={styles.savedOutfitActions}>
                    <button
                      aria-label={`${
                        locale === "vi"
                          ? "Tiếp tục với outfit đã lưu"
                          : "Continue with saved outfit"
                      }: ${savedOutfit.summary}`}
                      className={styles.savedOutfitPrepareButton}
                      disabled={isDeleting}
                      onClick={() => onPrepare(savedOutfit)}
                      type="button"
                    >
                      {locale === "vi"
                        ? "Tiếp tục với outfit đã lưu"
                        : "Continue with saved outfit"}
                      <ArrowRight aria-hidden="true" size={15} />
                    </button>
                    <button
                      aria-label={copy.viewAria(savedOutfit.summary)}
                      className={styles.savedOutfitViewButton}
                      disabled={isDeleting}
                      onClick={() => onView(savedOutfit)}
                      type="button"
                    >
                      <Pencil aria-hidden="true" size={15} />
                      {copy.view}
                    </button>
                    <button
                      aria-label={copy.deleteAria(savedOutfit.summary)}
                      className={styles.savedOutfitDeleteButton}
                      disabled={Boolean(deletingSavedOutfitId)}
                      onClick={() => {
                        if (window.confirm(copy.deleteConfirm)) {
                          void onDelete(savedOutfit.id);
                        }
                      }}
                      type="button"
                    >
                      {isDeleting ? (
                        <Loader2
                          aria-hidden="true"
                          className={styles.spinner}
                          size={15}
                        />
                      ) : (
                        <Trash2 aria-hidden="true" size={15} />
                      )}
                      {isDeleting ? copy.deleting : copy.delete}
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

function SavedOutfitThumbnail({
  item,
  locale,
}: {
  item: SavedOutfitItemSnapshot;
  locale: "vi" | "en";
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const copy = SAVED_COPY[locale];

  if (!item.imageUrlSnapshot || imageFailed) {
    return (
      <span
        aria-label={copy.thumbnailAlt(item.productNameSnapshot)}
        className={styles.savedOutfitThumbnailFallback}
        role="img"
      >
        BELIKEME
      </span>
    );
  }

  return (
    <img
      alt={copy.thumbnailAlt(item.productNameSnapshot)}
      className={styles.savedOutfitThumbnail}
      loading="lazy"
      onError={() => setImageFailed(true)}
      src={item.imageUrlSnapshot}
    />
  );
}

function formatSavedDate(value: string, locale: "vi" | "en") {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    dateStyle: "medium",
  }).format(date);
}
