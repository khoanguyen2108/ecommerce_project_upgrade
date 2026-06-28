import type {
  StyleAdviceRequest,
  StyleAdviceResponse,
} from "@/features/ai/types";
import { apiRequest } from "@/lib/api/client";

export function getStyleAdvice(
  request: StyleAdviceRequest,
): Promise<StyleAdviceResponse> {
  return apiRequest<StyleAdviceResponse>("/ai/style-advice", {
    auth: true,
    body: request,
    method: "POST",
  });
}
