"use client";

import { useCallback, useState } from "react";
import { OutfitPreparationDrawer } from "@/components/ai/OutfitPreparationDrawer";
import { SavedOutfitsSection } from "@/components/ai/SavedOutfitsSection";
import { StyleAssistantEmpty } from "@/components/ai/StyleAssistantEmpty";
import { StyleAssistantError } from "@/components/ai/StyleAssistantError";
import { StyleAssistantInput } from "@/components/ai/StyleAssistantInput";
import styles from "@/components/ai/StyleAssistant.module.css";
import { StyleAssistantResult } from "@/components/ai/StyleAssistantResult";
import { StyleAssistantSkeleton } from "@/components/ai/StyleAssistantSkeleton";
import { useStyleAdvice } from "@/features/ai/hooks";
import {
  toCurrentPurchasableOutfit,
  toSavedPurchasableOutfit,
  type PurchasableOutfit,
} from "@/features/ai/outfit-preparation";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { useSavedOutfits } from "@/features/saved-outfits/hooks";
import type { SavedOutfit } from "@/features/saved-outfits/types";

export function StyleAssistant() {
  const [prompt, setPrompt] = useState("");
  const [preparation, setPreparation] = useState<{
    locale: "vi" | "en";
    outfit: PurchasableOutfit;
  }>();
  const {
    currentOutfit,
    error,
    generate,
    lastSuccessfulPrompt,
    loadCurrentOutfit,
    result,
    retry,
    status,
  } = useStyleAdvice();
  const { isAuthenticated, isLoading: isSessionLoading } = useAuthSession();
  const locale = result?.locale === "vi" ? "vi" : "en";
  const {
    clearSavedOutfitFeedback,
    deletingSavedOutfitId,
    isLoadingSavedOutfits,
    isSavingOutfit,
    removeSavedOutfit,
    savedOutfitError,
    savedOutfits,
    saveOutfit,
    saveSuccessFeedback,
  } = useSavedOutfits({
    enabled: !isSessionLoading && isAuthenticated,
    locale,
  });
  const isLoading = status === "loading";
  const isLocked = !isSessionLoading && !isAuthenticated;
  const hasCurrentOutfit = Boolean(currentOutfit);
  const sourcePrompt = lastSuccessfulPrompt || prompt.trim();
  const canSaveCurrentOutfit = Boolean(
    isAuthenticated && currentOutfit?.items.length && sourcePrompt,
  );

  function handleGenerate() {
    clearSavedOutfitFeedback();
    void generate(prompt);
  }

  async function handleSaveCurrentOutfit() {
    if (!currentOutfit?.items.length || !sourcePrompt) {
      return;
    }

    await saveOutfit({
      sourcePrompt,
      locale,
      summary: currentOutfit.summary,
      items: currentOutfit.items.map((item) => ({
        role: item.role,
        productId: item.productId,
        productNameSnapshot: item.productName,
        productSlugSnapshot: item.productSlug,
        ...(item.imageUrl ? { imageUrlSnapshot: item.imageUrl } : {}),
        unitPriceSnapshot: item.price,
        quantity: 1,
      })),
    });
  }

  function handleViewSavedOutfit(savedOutfit: SavedOutfit) {
    clearSavedOutfitFeedback();
    const loadedWarning =
      savedOutfit.locale === "vi"
        ? "Outfit đã lưu được tải lên để chỉnh tiếp. Tồn kho và giá sẽ được kiểm tra lại khi bạn chỉnh outfit."
        : "Saved outfit loaded for editing. Stock and prices will be rechecked when you make changes.";

    loadCurrentOutfit({
      locale: savedOutfit.locale,
      sourcePrompt: savedOutfit.sourcePrompt,
      outfit: {
        summary: savedOutfit.summary,
        totalPrice: savedOutfit.totalPriceSnapshot,
        items: savedOutfit.items.map((item) => ({
          role: item.role,
          productId: item.productId,
          productSlug: item.productSlugSnapshot,
          productName: item.productNameSnapshot,
          ...(item.imageUrlSnapshot
            ? { imageUrl: item.imageUrlSnapshot }
            : {}),
          price: item.unitPriceSnapshot,
        })),
        warnings: [loadedWarning],
      },
    });
  }

  const closePreparation = useCallback(() => {
    setPreparation(undefined);
  }, []);

  function handlePrepareCurrentOutfit() {
    if (!isAuthenticated || !currentOutfit?.items.length) {
      return;
    }

    setPreparation({
      locale,
      outfit: toCurrentPurchasableOutfit(currentOutfit),
    });
  }

  function handlePrepareSavedOutfit(savedOutfit: SavedOutfit) {
    if (!isAuthenticated || savedOutfit.items.length === 0) {
      return;
    }

    setPreparation({
      locale: savedOutfit.locale,
      outfit: toSavedPurchasableOutfit(savedOutfit),
    });
  }

  return (
    <>
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.intro}>
          <div className={styles.introCopy}>
            <h1>Your next look, thoughtfully edited.</h1>
            <p>
              Tell us the mood, the moment, or your budget. Our assistant will
              search Belikeme&apos;s live catalog and shape a considered edit around
              you.
            </p>
          </div>
          <StyleAssistantInput
            isDisabled={isLoading || isSessionLoading || !isAuthenticated}
            isLocked={isLocked}
            isLoading={isLoading}
            onChange={setPrompt}
            onSubmit={handleGenerate}
            value={prompt}
          />
          {status === "success" && hasCurrentOutfit ? (
            <p className={styles.refinementHint}>
              {result?.locale === "vi"
                ? "B\u1ea1n c\u00f3 th\u1ec3 y\u00eau c\u1ea7u: \u201c\u0111\u1ed5i qu\u1ea7n\u201d, \u201c\u0111\u1ed5i gi\u00e0y sang boots\u201d, ho\u1eb7c \u201cb\u1ecf \u00e1o kho\u00e1c\u201d."
                : "You can ask: \u201cchange the pants\u201d, \u201cswitch the shoes to boots\u201d, or \u201cremove the jacket\u201d."}
            </p>
          ) : null}
          <p className={styles.disclaimer}>
            Recommendations use current catalog availability. Confirm live color,
            size, and price on the product page.
          </p>
          </section>

          <aside aria-label="Style assistant result" className={styles.resultColumn}>
          {status === "idle" ? <StyleAssistantEmpty /> : null}
          {status === "loading" ? <StyleAssistantSkeleton /> : null}
          {status === "error" ? (
            <StyleAssistantError
              message={error || "The style assistant is unavailable right now."}
              onRetry={retry}
            />
          ) : null}
          {status === "success" && result ? (
            <StyleAssistantResult
              isSavingOutfit={isSavingOutfit}
              onPrepareOutfit={
                isAuthenticated && currentOutfit?.items.length
                  ? handlePrepareCurrentOutfit
                  : undefined
              }
              onSaveOutfit={
                canSaveCurrentOutfit
                  ? () => void handleSaveCurrentOutfit()
                  : undefined
              }
              result={result}
              saveError={
                savedOutfitError?.action === "save"
                  ? savedOutfitError.message
                  : undefined
              }
              saveSuccess={saveSuccessFeedback}
            />
          ) : null}

          {!isSessionLoading && isAuthenticated ? (
            <SavedOutfitsSection
              deletingSavedOutfitId={deletingSavedOutfitId}
              error={
                savedOutfitError?.action !== "save"
                  ? savedOutfitError?.message
                  : undefined
              }
              isLoading={isLoadingSavedOutfits}
              locale={locale}
              onDelete={removeSavedOutfit}
              onPrepare={handlePrepareSavedOutfit}
              onView={handleViewSavedOutfit}
              savedOutfits={savedOutfits}
            />
          ) : null}
          </aside>
        </div>
      </main>
      <OutfitPreparationDrawer
        isOpen={Boolean(preparation && isAuthenticated)}
        locale={preparation?.locale || locale}
        onClose={closePreparation}
        outfit={preparation?.outfit}
      />
    </>
  );
}
