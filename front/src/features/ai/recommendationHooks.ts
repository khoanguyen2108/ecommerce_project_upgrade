"use client";

import { useCallback, useState } from "react";
import { recommendProducts } from "@/features/ai/recommendationApi";
import type {
  ProductRecommendationRequest,
  ProductRecommendationResponse,
  ProductRecommendationStatus,
} from "@/features/ai/recommendationTypes";
import { ApiClientError } from "@/lib/errors/api-error";

export function useProductRecommendations() {
  const [status, setStatus] = useState<ProductRecommendationStatus>("idle");
  const [result, setResult] = useState<ProductRecommendationResponse>();
  const [error, setError] = useState<string>();
  const [lastRequest, setLastRequest] = useState<ProductRecommendationRequest>();

  const recommend = useCallback(
    async (
      request: ProductRecommendationRequest,
    ): Promise<ProductRecommendationResponse | undefined> => {
      setStatus("loading");
      setError(undefined);
      setLastRequest(request);

      try {
        const response = await recommendProducts(request);
        setResult(response);
        setStatus("success");
        return response;
      } catch (requestError) {
        setError(getRecommendationErrorMessage(requestError));
        setStatus("error");
        return undefined;
      }
    },
    [],
  );

  const retry = useCallback(() => {
    if (lastRequest) {
      void recommend(lastRequest);
    }
  }, [lastRequest, recommend]);

  return {
    error,
    recommend,
    result,
    retry,
    status,
  };
}

function getRecommendationErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "Recommendations are unavailable right now. Please try again.";
}
