"use client";

import { useCallback, useState } from "react";
import { getStyleAdvice } from "@/features/ai/api";
import { getCurrentStyleAdviceOutfit } from "@/features/ai/normalize";
import type {
  StyleAdviceCanonicalOutfit,
  StyleAdviceIntent,
  StyleAdviceRequest,
  StyleAdviceResponse,
  StyleAdviceStatus,
} from "@/features/ai/types";
import { ApiClientError } from "@/lib/errors/api-error";

export function useStyleAdvice() {
  const [status, setStatus] = useState<StyleAdviceStatus>("idle");
  const [result, setResult] = useState<StyleAdviceResponse>();
  const [currentOutfitContext, setCurrentOutfitContext] =
    useState<CurrentOutfitContext>();
  const [error, setError] = useState<string>();
  const [lastPrompt, setLastPrompt] = useState("");
  const [lastSuccessfulPrompt, setLastSuccessfulPrompt] = useState("");

  const generate = useCallback(
    async (prompt: string) => {
      const notes = prompt.trim();

      if (!notes) {
        return;
      }

      setStatus("loading");
      setError(undefined);
      setLastPrompt(notes);

      try {
        const response = await getStyleAdvice(
          buildStyleAdviceRequest(notes, currentOutfitContext),
        );

        setResult(response);
        const currentOutfit = getCurrentStyleAdviceOutfit(response);

        if (currentOutfit?.items.length) {
          setCurrentOutfitContext({
            outfit: currentOutfit,
            ...(response.intent ? { intent: response.intent } : {}),
            ...(response.budget !== undefined
              ? { budget: response.budget }
              : {}),
            ...(response.locale ? { locale: response.locale } : {}),
          });
          setLastSuccessfulPrompt(notes);
        }
        setStatus("success");
      } catch (requestError) {
        setError(getStyleAdviceErrorMessage(requestError));
        setStatus("error");
      }
    },
    [currentOutfitContext],
  );

  const loadCurrentOutfit = useCallback(
    ({ locale, outfit, sourcePrompt }: LoadCurrentOutfitInput) => {
      setResult({
        type: "outfit",
        locale,
        message: outfit.summary,
        outfit,
      });
      setCurrentOutfitContext({ outfit, locale });
      setLastPrompt(sourcePrompt);
      setLastSuccessfulPrompt(sourcePrompt);
      setError(undefined);
      setStatus("success");
    },
    [],
  );

  const retry = useCallback(() => {
    if (lastPrompt) {
      void generate(lastPrompt);
    }
  }, [generate, lastPrompt]);

  return {
    currentOutfit: result ? getCurrentStyleAdviceOutfit(result) : undefined,
    error,
    generate,
    lastSuccessfulPrompt,
    loadCurrentOutfit,
    result,
    retry,
    status,
  };
}

interface LoadCurrentOutfitInput {
  locale: "vi" | "en";
  outfit: StyleAdviceCanonicalOutfit;
  sourcePrompt: string;
}

interface CurrentOutfitContext {
  outfit: StyleAdviceCanonicalOutfit;
  intent?: StyleAdviceIntent;
  budget?: number;
  locale?: "vi" | "en";
}

function buildStyleAdviceRequest(
  message: string,
  currentContext: CurrentOutfitContext | undefined,
): StyleAdviceRequest {
  if (!currentContext) {
    return { message };
  }

  return {
    message,
    currentOutfit: {
      items: currentContext.outfit.items.slice(0, 6).map((item) => ({
        role: item.role,
        productId: item.productId,
      })),
      ...(currentContext.intent
        ? { intent: toSafeIntent(currentContext.intent) }
        : {}),
      ...(currentContext.budget !== undefined
        ? { budget: currentContext.budget }
        : {}),
      ...(currentContext.locale ? { locale: currentContext.locale } : {}),
    },
  };
}

function toSafeIntent(intent: StyleAdviceIntent): StyleAdviceIntent {
  return {
    categories: intent.categories.slice(0, 12),
    colors: intent.colors.slice(0, 12),
    styles: intent.styles.slice(0, 12),
    occasions: intent.occasions.slice(0, 12),
    fits: intent.fits.slice(0, 12),
    negativeConstraints: intent.negativeConstraints.slice(0, 12),
  };
}

function getStyleAdviceErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "The style assistant is unavailable right now. Please try again.";
}
