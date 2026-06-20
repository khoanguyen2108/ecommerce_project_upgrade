import { apiRequest } from "@/lib/api/client";
import { withQuery } from "@/lib/api/query";
import type {
  CheckoutSummaryResponse,
  CreateCheckoutOrderResponse,
  CreateCheckoutOrderRequest,
  CreateGuestCheckoutOrderRequest,
  GuestCheckoutSummaryRequest,
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

export function getGuestCheckoutSummary(
  payload: GuestCheckoutSummaryRequest,
): Promise<CheckoutSummaryResponse> {
  return apiRequest<CheckoutSummaryResponse>("/checkout/guest/summary", {
    auth: false,
    body: payload,
    method: "POST",
  });
}

export function createGuestCheckoutOrder(
  payload: CreateGuestCheckoutOrderRequest,
): Promise<CreateCheckoutOrderResponse> {
  return apiRequest<CreateCheckoutOrderResponse>("/checkout/guest/orders", {
    auth: false,
    body: payload,
    method: "POST",
  });
}

export function createCheckoutOrder(
  payload: CreateCheckoutOrderRequest,
): Promise<CreateCheckoutOrderResponse> {
  return apiRequest<CreateCheckoutOrderResponse>("/checkout/orders", {
    auth: true,
    body: payload,
    credentials: "include",
    method: "POST",
  });
}
