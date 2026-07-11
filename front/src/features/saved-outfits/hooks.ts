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
import { ApiClientError } from "@/lib/errors/api-error";

type SavedOutfitErrorAction = "list" | "save" | "delete";

interface SavedOutfitError {
  action: SavedOutfitErrorAction;
  message: string;
}

interface UseSavedOutfitsOptions {
  enabled: boolean;
  locale: "vi" | "en";
}

const ERROR_COPY = {
  en: {
    auth: "Please sign in again to manage saved outfits.",
    delete: "Could not delete this outfit.",
    list: "Could not load saved outfits.",
    save: "Could not save this outfit. Some products may be unavailable.",
    saved: "Outfit saved.",
  },
  vi: {
    auth: "Vui lòng đăng nhập lại để quản lý outfit đã lưu.",
    delete: "Không thể xóa outfit này.",
    list: "Không thể tải outfit đã lưu.",
    save: "Không thể lưu outfit này. Một số sản phẩm có thể đã hết hàng.",
    saved: "Đã lưu outfit.",
  },
} as const;

export function useSavedOutfits({ enabled, locale }: UseSavedOutfitsOptions) {
  const localeRef = useRef(locale);
  const isSavingRef = useRef(false);
  const deletingIdRef = useRef<string | undefined>(undefined);
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [isLoadingSavedOutfits, setIsLoadingSavedOutfits] = useState(false);
  const [isSavingOutfit, setIsSavingOutfit] = useState(false);
  const [deletingSavedOutfitId, setDeletingSavedOutfitId] =
    useState<string>();
  const [savedOutfitError, setSavedOutfitError] =
    useState<SavedOutfitError>();
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
        if (isActive) {
          setSavedOutfits(nextSavedOutfits);
        }
      })
      .catch((error: unknown) => {
        if (isActive && !controller.signal.aborted) {
          setSavedOutfitError({
            action: "list",
            message: getSavedOutfitErrorMessage(
              error,
              "list",
              localeRef.current,
            ),
          });
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoadingSavedOutfits(false);
        }
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
      if (!enabled || isSavingRef.current) {
        return undefined;
      }

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
        setSaveSuccessFeedback(ERROR_COPY[request.locale].saved);

        try {
          const { savedOutfits: refreshedSavedOutfits } =
            await listSavedOutfits();
          setSavedOutfits(refreshedSavedOutfits);
        } catch (error) {
          setSavedOutfitError({
            action: "list",
            message: getSavedOutfitErrorMessage(error, "list", request.locale),
          });
        }

        return savedOutfit;
      } catch (error) {
        setSavedOutfitError({
          action: "save",
          message: getSavedOutfitErrorMessage(error, "save", request.locale),
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
      if (!enabled || deletingIdRef.current) {
        return false;
      }

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
          message: getSavedOutfitErrorMessage(
            error,
            "delete",
            localeRef.current,
          ),
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
  locale: "vi" | "en",
) {
  if (error instanceof ApiClientError && error.status === 401) {
    return ERROR_COPY[locale].auth;
  }

  return ERROR_COPY[locale][action];
}
