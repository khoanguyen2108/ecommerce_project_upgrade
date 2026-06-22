import type { Metadata } from "next";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PaymentLandingPage } from "@/components/payments/PaymentLandingPage";
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
      <PaymentLandingPage initialQuery={initialQuery} source="cancel" />
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
