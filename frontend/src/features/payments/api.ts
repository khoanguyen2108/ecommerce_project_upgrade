import { apiRequest } from "@/lib/api/client";
import { withQuery } from "@/lib/api/query";
import type {
  CreatePayosPaymentRequest,
  PayosDisplayStatusResponse,
  PayosPaymentResponse,
  PayosStatusQuery,
} from "@/features/payments/types";

export function createPayosPayment(
  payload: CreatePayosPaymentRequest,
): Promise<PayosPaymentResponse> {
  return apiRequest<PayosPaymentResponse>("/payments/payos/create", {
    auth: true,
    body: payload,
    credentials: "include",
    method: "POST",
  });
}

export function getPayosReturnStatus(
  query: PayosStatusQuery = {},
): Promise<PayosDisplayStatusResponse> {
  return apiRequest<PayosDisplayStatusResponse>(
    withQuery("/payments/payos/return/status", query),
    {
      auth: true,
      cache: "no-store",
      credentials: "include",
      method: "GET",
    },
  );
}

export function getPayosCancelStatus(
  query: PayosStatusQuery = {},
): Promise<PayosDisplayStatusResponse> {
  return apiRequest<PayosDisplayStatusResponse>(
    withQuery("/payments/payos/cancel/status", query),
    {
      auth: true,
      cache: "no-store",
      credentials: "include",
      method: "GET",
    },
  );
}
