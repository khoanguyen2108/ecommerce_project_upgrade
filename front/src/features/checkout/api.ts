import { apiRequest } from "@/lib/api/client";
import { withQuery } from "@/lib/api/query";
import type {
  CheckoutSummaryResponse,
  CreateCheckoutOrderResponse,
} from "@/features/checkout/types";

export function getCheckoutSummary(
  voucherCode?: string,
): Promise<CheckoutSummaryResponse> {
  return apiRequest<CheckoutSummaryResponse>(
    withQuery("/checkout/summary", { voucherCode }),
    {
      auth: true,
      credentials: "include",
      method: "GET",
    },
  );
}

export function createCheckoutOrder(
  voucherCode?: string,
): Promise<CreateCheckoutOrderResponse> {
  return apiRequest<CreateCheckoutOrderResponse>("/checkout/orders", {
    auth: true,
    body: voucherCode ? { voucherCode } : {},
    credentials: "include",
    method: "POST",
  });
}
