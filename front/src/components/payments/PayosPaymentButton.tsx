"use client";

import { CreditCard, Loader2 } from "lucide-react";
import { useRef, useState } from "react";
import { createPayosPayment } from "@/features/payments/api";
import { ApiClientError } from "@/lib/errors/api-error";

interface PayosPaymentButtonProps {
  className?: string;
  label?: string;
  orderId: string;
}

const PAYMENT_ERROR_MESSAGES: Record<string, string> = {
  ORDER_ITEMS_MISSING: "This order has no payable items.",
  ORDER_NOT_FOUND: "This order is not available to your account.",
  ORDER_NOT_PENDING_PAYMENT: "This order is no longer awaiting payment.",
  ORDER_TOTAL_INVALID: "This order total cannot be paid.",
  PAYMENT_AMOUNT_MISMATCH: "The saved payment amount no longer matches the order.",
  PAYMENT_NOT_PENDING: "This payment is no longer pending.",
  PAYOS_CONFIGURATION_ERROR: "Online payment is temporarily unavailable.",
  PAYOS_ORDER_EXPIRED: "This order has expired and can no longer be paid.",
  PAYOS_PROVIDER_ERROR: "payOS could not create a checkout link. Please retry.",
  PAYOS_PROVIDER_RESPONSE_INVALID:
    "payOS returned an invalid checkout response. Please retry later.",
};

export function PayosPaymentButton({
  className = "button button--primary",
  label = "Pay securely with payOS",
  orderId,
}: PayosPaymentButtonProps) {
  const requestLockRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();

  async function handlePayment() {
    if (requestLockRef.current) {
      return;
    }

    requestLockRef.current = true;
    setIsLoading(true);
    setError(undefined);
    setRequestId(undefined);

    try {
      const response = await createPayosPayment({ orderId });
      const checkoutUrl = getSafeCheckoutUrl(
        response.checkoutUrl || response.paymentUrl,
      );

      if (!checkoutUrl) {
        throw new Error("PAYOS_CHECKOUT_URL_MISSING");
      }

      window.location.assign(checkoutUrl);
    } catch (paymentError) {
      if (paymentError instanceof ApiClientError) {
        setError(
          PAYMENT_ERROR_MESSAGES[paymentError.code] ||
            paymentError.message ||
            "Online payment could not be started.",
        );
        setRequestId(paymentError.requestId);
      } else {
        setError("Online payment could not be started.");
      }
      requestLockRef.current = false;
      setIsLoading(false);
    }
  }

  return (
    <div className="payos-payment-action">
      <button
        className={className}
        disabled={isLoading}
        onClick={() => void handlePayment()}
        type="button"
      >
        {isLoading ? (
          <Loader2 aria-hidden="true" className="spin" size={17} />
        ) : (
          <CreditCard aria-hidden="true" size={17} />
        )}
        {isLoading ? "Opening payOS..." : label}
      </button>
      {error ? (
        <small className="payos-payment-action__error" role="alert">
          {error}
          {requestId ? ` Request ${requestId}.` : ""}
        </small>
      ) : null}
    </div>
  );
}

function getSafeCheckoutUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const localHttpAllowed =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1");

    return url.protocol === "https:" || localHttpAllowed ? url.toString() : null;
  } catch {
    return null;
  }
}
