"use client";

import { Info, Loader2 } from "lucide-react";
import Link from "next/link";
import { PaymentStatusPage } from "@/components/payments/PaymentStatusPage";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import type { PayosStatusQuery } from "@/features/payments/types";

interface PaymentLandingPageProps {
  initialQuery: PayosStatusQuery;
  source: "return" | "cancel";
}

export function PaymentLandingPage({
  initialQuery,
  source,
}: PaymentLandingPageProps) {
  const { isAuthenticated, isLoading } = useAuthSession();

  if (isLoading) {
    return (
      <main className="customer-page payment-page">
        <section className="payment-status-panel" aria-labelledby="payment-heading">
          <Loader2
            aria-hidden="true"
            className="payment-status-panel__icon spin"
            size={34}
          />
          <p className="eyebrow">Payment status</p>
          <h1 id="payment-heading">Checking your session</h1>
          <p>Preparing the safe payment status view.</p>
        </section>
      </main>
    );
  }

  if (isAuthenticated) {
    return <PaymentStatusPage initialQuery={initialQuery} source={source} />;
  }

  return (
    <main className="customer-page payment-page">
      <section className="payment-status-panel" aria-labelledby="payment-heading">
        <Info
          aria-hidden="true"
          className="payment-status-panel__icon"
          size={34}
        />
        <p className="eyebrow">
          {source === "cancel" ? "Payment cancel" : "Payment return"}
        </p>
        <h1 id="payment-heading">Payment verification in progress</h1>
        <p>
          Payment received by payOS is being verified. Please check your email
          or contact support with your order code.
        </p>
        <p>
          This page does not confirm payment and does not expose guest order
          details.
        </p>
        <div className="customer-actions">
          <Link className="button button--primary" href="/products">
            Continue shopping
          </Link>
        </div>
      </section>
    </main>
  );
}
