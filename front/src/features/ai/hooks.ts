"use client";

import { useCallback, useState } from "react";
import { getStyleAdvice } from "@/features/ai/api";
import type {
  StyleAdviceRequest,
  StyleAdviceResponse,
  StyleAdviceStatus,
} from "@/features/ai/types";
import { ApiClientError } from "@/lib/errors/api-error";

export function useStyleAdvice() {
  const [status, setStatus] = useState<StyleAdviceStatus>("idle");
  const [result, setResult] = useState<StyleAdviceResponse>();
  const [contextResult, setContextResult] = useState<StyleAdviceResponse>();
  const [error, setError] = useState<string>();
  const [lastPrompt, setLastPrompt] = useState("");

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
          buildStyleAdviceRequest(notes, contextResult),
        );

        setResult(response);
        if ((response.outfits?.length ?? 0) > 0) {
          setContextResult(response);
        }
        setStatus("success");
      } catch (requestError) {
        setError(getStyleAdviceErrorMessage(requestError));
        setStatus("error");
      }
    },
    [contextResult],
  );

  const retry = useCallback(() => {
    if (lastPrompt) {
      void generate(lastPrompt);
    }
  }, [generate, lastPrompt]);

  return {
    error,
    generate,
    result,
    retry,
    status,
  };
}

function buildStyleAdviceRequest(
  notes: string,
  previousResult: StyleAdviceResponse | undefined,
): StyleAdviceRequest {
  const outfits = previousResult?.outfits?.slice(0, 2) ?? [];

  if (outfits.length === 0) {
    return { notes };
  }

  return {
    notes,
    previousOutfits: outfits.map((outfit, index) => ({
      optionIndex: index + 1,
      title: outfit.title,
      totalPrice: outfit.products.reduce(
        (total, product) => total + product.price,
        0,
      ),
      ...(previousResult?.locale ? { locale: previousResult.locale } : {}),
      products: outfit.products.slice(0, 6).map((product) => ({
        role: product.role,
        productId: product.productId,
        productSlug: product.productSlug,
        productName: product.productName,
        price: product.price,
      })),
    })),
    ...(previousResult?.intent
      ? { previousIntent: previousResult.intent }
      : {}),
    ...(previousResult?.budget !== undefined
      ? { previousBudget: previousResult.budget }
      : {}),
  };
}

function getStyleAdviceErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "The style assistant is unavailable right now. Please try again.";
}
