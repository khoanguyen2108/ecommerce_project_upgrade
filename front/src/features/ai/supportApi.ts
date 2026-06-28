import { apiRequest } from "@/lib/api/client";
import type {
  SupportRequest,
  SupportResponse,
} from "@/features/ai/supportTypes";

export function requestAiSupport(
  request: SupportRequest,
): Promise<SupportResponse> {
  return apiRequest<SupportResponse>("/ai/support", {
    auth: true,
    body: request,
    credentials: "include",
    method: "POST",
  });
}
