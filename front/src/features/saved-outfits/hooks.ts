"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createSavedOutfit,
  deleteSavedOutfit,
  listSavedOutfits,
} from "@/features/saved-outfits/api";
import type {
  CreateSavedOutfitRequest,
  SavedOutfit,
} from "@/features/saved-outfits/types";
import type { Locale } from "@/features/i18n/locale";
import { translate, type TranslationKey } from "@/features/i18n/translations";
import { ApiClientError } from "@/lib/errors/api-error";

type SavedOutfitErrorAction = "list" | "save" | "delete";

interface SavedOutfitError {
  action: SavedOutfitErrorAction;
  message: string;
}

interface UseSavedOutfitsOptions {
  enabled: boolean;
  locale: Locale;
}

const ERROR_KEYS: Record<SavedOutfitErrorAction, TranslationKey> = {
  delete: "ai.saveDeleteError",
  list: "ai.saveListError",
  save: "ai.saveError",
};

export function useSavedOutfits({ enabled, locale }: UseSavedOutfitsOptions) {
  const localeRef = useRef(locale);
  const isSavingRef = useRef(false);
  const deletingIdRef = useRef<string | undefined>(undefined);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [isLoadingSavedOutfits, setIsLoadingSavedOutfits] = useState(false);
  const [isSavingOutfit, setIsSavingOutfit] = useState(false);
  const [deletingSavedOutfitId, setDeletingSavedOutfitId] = useState<string>();
  const [savedOutfitError, setSavedOutfitError] = useState<SavedOutfitError>();
  const [saveSuccessFeedback, setSaveSuccessFeedback] = useState<string>();

  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);

  useEffect(() => {
    if (!enabled) {
      setSavedOutfits([]);
      setIsLoadingSavedOutfits(false);
      setIsSavingOutfit(false);
      setDeletingSavedOutfitId(undefined);
      isSavingRef.current = false;
      deletingIdRef.current = undefined;
      setSavedOutfitError(undefined);
      setSaveSuccessFeedback(undefined);
      return;
    }

    let isActive = true;
    const controller = new AbortController();
    setIsLoadingSavedOutfits(true);
    setSavedOutfitError(undefined);

    void listSavedOutfits({ signal: controller.signal })
      .then(({ savedOutfits: nextSavedOutfits }) => {
        if (isActive) setSavedOutfits(nextSavedOutfits);
      })
      .catch((error: unknown) => {
        if (isActive && !controller.signal.aborted) {
          setSavedOutfitError({
            action: "list",
            message: getSavedOutfitErrorMessage(error, "list", localeRef.current),
          });
        }
      })
      .finally(() => {
        if (isActive) setIsLoadingSavedOutfits(false);
      });

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [enabled]);

  const clearSavedOutfitFeedback = useCallback(() => {
    setSavedOutfitError(undefined);
    setSaveSuccessFeedback(undefined);
  }, []);

  const saveOutfit = useCallback(
    async (request: CreateSavedOutfitRequest) => {
      if (!enabled || isSavingRef.current) return undefined;

      isSavingRef.current = true;
      setIsSavingOutfit(true);
      setSavedOutfitError(undefined);
      setSaveSuccessFeedback(undefined);

      try {
        const { savedOutfit } = await createSavedOutfit(request);
        setSavedOutfits((current) => [
          savedOutfit,
          ...current.filter((item) => item.id !== savedOutfit.id),
        ]);
        setSaveSuccessFeedback(
          translate(localeRef.current, "ai.saveSuccess"),
        );

        try {
          const { savedOutfits: refreshedSavedOutfits } = await listSavedOutfits();
          setSavedOutfits(refreshedSavedOutfits);
        } catch (error) {
          setSavedOutfitError({
            action: "list",
            message: getSavedOutfitErrorMessage(error, "list", localeRef.current),
          });
        }

        return savedOutfit;
      } catch (error) {
        setSavedOutfitError({
          action: "save",
          message: getSavedOutfitErrorMessage(error, "save", localeRef.current),
        });
        return undefined;
      } finally {
        isSavingRef.current = false;
        setIsSavingOutfit(false);
      }
    },
    [enabled],
  );

  const removeSavedOutfit = useCallback(
    async (id: string) => {
      if (!enabled || deletingIdRef.current) return false;

      deletingIdRef.current = id;
      setDeletingSavedOutfitId(id);
      setSavedOutfitError(undefined);
      setSaveSuccessFeedback(undefined);

      try {
        await deleteSavedOutfit(id);
        setSavedOutfits((current) =>
          current.filter((savedOutfit) => savedOutfit.id !== id),
        );
        return true;
      } catch (error) {
        setSavedOutfitError({
          action: "delete",
          message: getSavedOutfitErrorMessage(error, "delete", localeRef.current),
        });
        return false;
      } finally {
        deletingIdRef.current = undefined;
        setDeletingSavedOutfitId(undefined);
      }
    },
    [enabled],
  );

  return {
    clearSavedOutfitFeedback,
    deletingSavedOutfitId,
    isLoadingSavedOutfits,
    isSavingOutfit,
    removeSavedOutfit,
    savedOutfitError,
    savedOutfits,
    saveOutfit,
    saveSuccessFeedback,
  };
}

function getSavedOutfitErrorMessage(
  error: unknown,
  action: SavedOutfitErrorAction,
  locale: Locale,
) {
  if (error instanceof ApiClientError && error.status === 401) {
    return translate(locale, "ai.saveAuthError");
  }
  return translate(locale, ERROR_KEYS[action]);
}
