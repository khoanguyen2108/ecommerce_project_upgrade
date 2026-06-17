import { apiRequest } from "@/lib/api/client";
import type {
  CheckoutSummaryResponse,
  CreateCheckoutOrderResponse,
} from "@/features/checkout/types";

export function getCheckoutSummary(): Promise<CheckoutSummaryResponse> {
  return apiRequest<CheckoutSummaryResponse>("/checkout/summary", {
    auth: true,
    credentials: "include",
    method: "GET",
  });
}

export function createCheckoutOrder(): Promise<CreateCheckoutOrderResponse> {
  return apiRequest<CreateCheckoutOrderResponse>("/checkout/orders", {
    auth: true,
    credentials: "include",
    method: "POST",
  });
}
