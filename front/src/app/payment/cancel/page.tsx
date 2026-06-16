import type { Metadata } from "next";
import { AuthenticatedRouteGuard } from "@/components/auth/AuthenticatedRouteGuard";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PaymentStatusPage } from "@/components/payments/PaymentStatusPage";
import type { PayosStatusQuery } from "@/features/payments/types";

export const metadata: Metadata = {
  title: "Payment cancel",
};

interface PaymentCancelRouteProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PaymentCancelRoute({
  searchParams,
}: PaymentCancelRouteProps) {
  const params = searchParams ? await searchParams : {};
  const initialQuery = parsePaymentQuery(params);

  return (
    <>
      <SiteHeader active="orders" />
      <AuthenticatedRouteGuard
        areaLabel="Belikeme payment"
        returnPath={buildPaymentReturnPath("/payment/cancel", params)}
        signInMessage="Sign in to read the backend payment cancel status."
        signInTitle="Payment sign-in required"
      >
        <PaymentStatusPage initialQuery={initialQuery} source="cancel" />
      </AuthenticatedRouteGuard>
      <SiteFooter />
    </>
  );
}

function parsePaymentQuery(
  params: Record<string, string | string[] | undefined>,
): PayosStatusQuery {
  return {
    orderCode: parsePositiveInteger(getFirst(params.orderCode)),
    orderId: getNonEmptyString(getFirst(params.orderId)),
  };
}

function buildPaymentReturnPath(
  path: string,
  params: Record<string, string | string[] | undefined>,
): string {
  const query = new URLSearchParams();
  const orderId = getNonEmptyString(getFirst(params.orderId));
  const orderCode = getNonEmptyString(getFirst(params.orderCode));

  if (orderId) {
    query.set("orderId", orderId);
  }

  if (orderCode) {
    query.set("orderCode", orderCode);
  }

  const queryString = query.toString();

  return queryString ? `${path}?${queryString}` : path;
}

function getFirst(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function getNonEmptyString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();

  return trimmed ? trimmed : undefined;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}
