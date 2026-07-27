"use client";

import { ArrowRight, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import styles from "@/components/ai/StyleAssistant.module.css";
import { formatPrice } from "@/features/catalog/format";
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

  return (
    <section
      aria-busy={isLoading}
      aria-labelledby="saved-outfits-heading"
      className={styles.savedOutfitsSection}
    >
      <div className={styles.savedOutfitsHeading}>
        <div>
          <h2 id="saved-outfits-heading">{"Saved outfits"}</h2>
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
          {"Loading saved outfits..."}
        </p>
      ) : null}

      {!isLoading && !error && savedOutfits.length === 0 ? (
        <p className={styles.savedOutfitsState}>{"You have not saved any outfits yet."}</p>
      ) : null}

      {savedOutfits.length > 0 ? (
        <div className={styles.savedOutfitList}>
          {savedOutfits.map((savedOutfit) => {
            const isDeleting = deletingSavedOutfitId === savedOutfit.id;
            const itemLabel = savedOutfit.items.length === 1 ? "item" : "items";

            return (
              <article className={styles.savedOutfitCard} key={savedOutfit.id}>
                <div className={styles.savedOutfitThumbnails}>
                  {savedOutfit.items.slice(0, 4).map((item) => (
                    <SavedOutfitThumbnail
                      item={item}
                      key={`${item.role}-${item.productId}`}
                    />
                  ))}
                </div>
                <div className={styles.savedOutfitBody}>
                  <h3>{savedOutfit.summary}</h3>
                  <div className={styles.savedOutfitMeta}>
                    <strong>{formatPrice(savedOutfit.totalPriceSnapshot)}</strong>
                    <span>{savedOutfit.items.length} {itemLabel}</span>
                    <time dateTime={savedOutfit.createdAt}>
                      {"Saved"} {formatSavedDate(savedOutfit.createdAt)}
                    </time>
                  </div>
                  <div className={styles.savedOutfitActions}>
                    <button
                      aria-label={`${"Continue with saved outfit"}: ${savedOutfit.summary}`}
                      className={styles.savedOutfitPrepareButton}
                      disabled={isDeleting}
                      onClick={() => onPrepare(savedOutfit)}
                      type="button"
                    >
                      {"Continue with saved outfit"}
                      <ArrowRight aria-hidden="true" size={15} />
                    </button>
                    <button
                      aria-label={`${"View/Edit"}: ${savedOutfit.summary}`}
                      className={styles.savedOutfitViewButton}
                      disabled={isDeleting}
                      onClick={() => onView(savedOutfit)}
                      type="button"
                    >
                      <Pencil aria-hidden="true" size={15} />
                      {"View/Edit"}
                    </button>
                    <button
                      aria-label={`${"Delete"}: ${savedOutfit.summary}`}
                      className={styles.savedOutfitDeleteButton}
                      disabled={Boolean(deletingSavedOutfitId)}
                      onClick={() => {
                        if (window.confirm("Delete this saved outfit?")) {
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
                      {isDeleting ? "Deleting" : "Delete"}
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

function SavedOutfitThumbnail({ item }: { item: SavedOutfitItemSnapshot; }) {
  const [imageFailed, setImageFailed] = useState(false);
  const productName = (item.productNameSnapshot ?? "");
  const alt = `${productName} · ${"Saved outfits"}`;

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

function formatSavedDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}
