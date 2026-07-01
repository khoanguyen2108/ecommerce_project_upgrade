"use client";

import { PaymentStatusPage } from "@/components/payments/PaymentStatusPage";
import type { PayosStatusQuery } from "@/features/payments/types";

interface PaymentLandingPageProps {
  initialQuery: PayosStatusQuery;
  source: "return" | "cancel";
}

export function PaymentLandingPage({
  initialQuery,
  source,
}: PaymentLandingPageProps) {
  return <PaymentStatusPage initialQuery={initialQuery} source={source} />;
}
