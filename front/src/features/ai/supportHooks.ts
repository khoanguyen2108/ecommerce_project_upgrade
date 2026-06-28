"use client";

import { useCallback, useState } from "react";
import { requestAiSupport } from "@/features/ai/supportApi";
import type {
  SupportRequest,
  SupportRequestStatus,
  SupportResponse,
} from "@/features/ai/supportTypes";

export function useAiSupport() {
  const [status, setStatus] = useState<SupportRequestStatus>("idle");

  const ask = useCallback(
    async (request: SupportRequest): Promise<SupportResponse> => {
      setStatus("loading");

      try {
        const response = await requestAiSupport(request);
        setStatus("success");
        return response;
      } catch (error) {
        setStatus("error");
        throw error;
      }
    },
    [],
  );

  return {
    ask,
    isLoading: status === "loading",
    status,
  };
}
