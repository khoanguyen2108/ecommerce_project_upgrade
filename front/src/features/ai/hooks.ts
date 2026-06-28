"use client";

import { useCallback, useState } from "react";
import { getStyleAdvice } from "@/features/ai/api";
import type {
  StyleAdviceResponse,
  StyleAdviceStatus,
} from "@/features/ai/types";
import { ApiClientError } from "@/lib/errors/api-error";

export function useStyleAdvice() {
  const [status, setStatus] = useState<StyleAdviceStatus>("idle");
  const [result, setResult] = useState<StyleAdviceResponse>();
  const [error, setError] = useState<string>();
  const [lastPrompt, setLastPrompt] = useState("");

  const generate = useCallback(async (prompt: string) => {
    const notes = prompt.trim();

    if (!notes) {
      return;
    }

    setStatus("loading");
    setError(undefined);
    setLastPrompt(notes);

    try {
      const response = await getStyleAdvice({ notes });

      setResult(response);
      setStatus("success");
    } catch (requestError) {
      setError(getStyleAdviceErrorMessage(requestError));
      setStatus("error");
    }
  }, []);

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

function getStyleAdviceErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "The style assistant is unavailable right now. Please try again.";
}
