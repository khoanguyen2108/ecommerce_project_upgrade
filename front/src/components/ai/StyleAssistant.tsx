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
import { useI18n } from "@/features/i18n/useI18n";
import { useSavedOutfits } from "@/features/saved-outfits/hooks";
import type { SavedOutfit } from "@/features/saved-outfits/types";

export function StyleAssistant() {
  const { locale: uiLocale, t } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [preparation, setPreparation] = useState<PurchasableOutfit>();
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
  const aiLocale = result?.locale === "vi" ? "vi" : "en";
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
    locale: uiLocale,
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
    if (!currentOutfit?.items.length || !sourcePrompt) return;

    await saveOutfit({
      sourcePrompt,
      locale: aiLocale,
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
          ...(item.imageUrlSnapshot ? { imageUrl: item.imageUrlSnapshot } : {}),
          price: item.unitPriceSnapshot,
        })),
        warnings: [t("ai.loadedWarning")],
      },
    });
  }

  const closePreparation = useCallback(() => setPreparation(undefined), []);

  function handlePrepareCurrentOutfit() {
    if (isAuthenticated && currentOutfit?.items.length) {
      setPreparation(toCurrentPurchasableOutfit(currentOutfit));
    }
  }

  function handlePrepareSavedOutfit(savedOutfit: SavedOutfit) {
    if (isAuthenticated && savedOutfit.items.length > 0) {
      setPreparation(toSavedPurchasableOutfit(savedOutfit));
    }
  }

  return (
    <>
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.intro}>
            <div className={styles.introCopy}>
              <h1>{t("ai.heroTitle")}</h1>
              <p>{t("ai.heroBody")}</p>
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
              <p className={styles.refinementHint}>{t("ai.refinementHint")}</p>
            ) : null}
          </section>

          <aside aria-label={t("ai.resultColumn")} className={styles.resultColumn}>
            {status === "idle" ? <StyleAssistantEmpty /> : null}
            {status === "loading" ? <StyleAssistantSkeleton /> : null}
            {status === "error" ? (
              <StyleAssistantError
                message={error || t("ai.unavailable")}
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
        locale={uiLocale}
        onClose={closePreparation}
        outfit={preparation}
      />
    </>
  );
}
