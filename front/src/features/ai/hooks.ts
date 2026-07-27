"use client";

import { useCallback, useEffect, useState } from "react";
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

const STYLE_ADVICE_SESSION_KEY = "belikeme:style-advice:last-outfit:v1";

export function useStyleAdvice() {
  const [storedAdvice] = useState(readStoredStyleAdvice);
  const [status, setStatus] = useState<StyleAdviceStatus>(
    storedAdvice ? "success" : "idle",
  );
  const [result, setResult] = useState<StyleAdviceResponse | undefined>(
    storedAdvice?.result,
  );
  const [currentOutfitContext, setCurrentOutfitContext] = useState<
    CurrentOutfitContext | undefined
  >(storedAdvice?.currentOutfitContext);
  const [error, setError] = useState<string>();
  const [lastPrompt, setLastPrompt] = useState(storedAdvice?.lastPrompt ?? "");
  const [lastSuccessfulPrompt, setLastSuccessfulPrompt] = useState(
    storedAdvice?.lastSuccessfulPrompt ?? "",
  );

  useEffect(() => {
    if (status !== "success" || !result || !currentOutfitContext) {
      return;
    }

    writeStoredStyleAdvice({
      currentOutfitContext,
      lastPrompt,
      lastSuccessfulPrompt,
      result,
    });
  }, [currentOutfitContext, lastPrompt, lastSuccessfulPrompt, result, status]);

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
    ({ outfit, sourcePrompt }: LoadCurrentOutfitInput) => {
      setResult({
        type: "outfit",
        message: outfit.summary,
        outfit,
      });
      setCurrentOutfitContext({ outfit });
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
  outfit: StyleAdviceCanonicalOutfit;
  sourcePrompt: string;
}

interface CurrentOutfitContext {
  outfit: StyleAdviceCanonicalOutfit;
  intent?: StyleAdviceIntent;
  budget?: number;
}

interface StoredStyleAdvice {
  currentOutfitContext: CurrentOutfitContext;
  lastPrompt: string;
  lastSuccessfulPrompt: string;
  result: StyleAdviceResponse;
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

function readStoredStyleAdvice(): StoredStyleAdvice | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const rawValue = window.sessionStorage.getItem(STYLE_ADVICE_SESSION_KEY);
    if (!rawValue) {
      return undefined;
    }

    const parsed = JSON.parse(rawValue) as Partial<StoredStyleAdvice>;
    const outfit = parsed.currentOutfitContext?.outfit;

    if (
      !parsed.result ||
      !outfit ||
      !Array.isArray(outfit.items) ||
      outfit.items.length === 0
    ) {
      return undefined;
    }

    return {
      currentOutfitContext: parsed.currentOutfitContext,
      lastPrompt: typeof parsed.lastPrompt === "string" ? parsed.lastPrompt : "",
      lastSuccessfulPrompt:
        typeof parsed.lastSuccessfulPrompt === "string"
          ? parsed.lastSuccessfulPrompt
          : "",
      result: parsed.result,
    } as StoredStyleAdvice;
  } catch {
    window.sessionStorage.removeItem(STYLE_ADVICE_SESSION_KEY);
    return undefined;
  }
}

function writeStoredStyleAdvice(value: StoredStyleAdvice) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      STYLE_ADVICE_SESSION_KEY,
      JSON.stringify(value),
    );
  } catch {
    // Best-effort only; in-memory state remains the source of truth.
  }
}
