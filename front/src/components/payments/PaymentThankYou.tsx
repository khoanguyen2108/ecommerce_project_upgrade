"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import {
  FulfillmentStatusBadge,
  PaymentStatusBadge,
} from "@/components/orders/OrdersPage";
import { OrderItemImage } from "@/components/orders/OrderItemImage";
import {
  formatCurrency,
  formatDateTime,
  formatOrderCode,
  formatOrderDisplayId,
} from "@/components/orders/order-format";
import type { PayosDisplayStatusResponse } from "@/features/payments/types";
import {
  isImplicitAccessoryOption,
  isNoSize,
} from "@/features/catalog/sizes";

interface PaymentThankYouProps {
  status: PayosDisplayStatusResponse;
}

export function PaymentThankYou({ status }: PaymentThankYouProps) {
  const paidAt = status.paidAt || status.payment.paidAt || status.order.paidAt;
  const orderItems = status.order.items ?? [];
  const publicOrderIdentifier = status.order.orderCode || status.order.id;
  const orderHref = `/orders/${encodeURIComponent(publicOrderIdentifier)}`;

  return (
    <main className="customer-page payment-page payment-thank-you-page">
      <section
        className="payment-thank-you"
        aria-labelledby="payment-thank-you-heading"
      >
        <div className="payment-thank-you__mark" aria-hidden="true">
          <Check size={34} strokeWidth={1.8} />
        </div>

        <p className="eyebrow">Payment confirmed</p>
        <h1 id="payment-thank-you-heading">Thank you for your order</h1>
        <p className="payment-thank-you__intro">
          Your payment has been verified. We are preparing your order and will
          keep you updated as it moves through fulfillment.
        </p>

        <div
          className="payment-thank-you__badges"
          aria-label="Confirmed payment states"
        >
          <PaymentStatusBadge status={status.payment.status} />
          <FulfillmentStatusBadge status={status.order.fulfillmentStatus} />
        </div>

        <article
          className="payment-thank-you__summary"
          aria-labelledby="thank-you-summary-heading"
        >
          <header className="payment-thank-you__summary-header">
            <div>
              <p className="eyebrow">Order summary</p>
              <h2 id="thank-you-summary-heading">
                Order {formatOrderDisplayId(publicOrderIdentifier)}
              </h2>
            </div>
            <span className="payment-thank-you__paid-label">Paid</span>
          </header>

          {orderItems.length > 0 ? (
            <div className="payment-thank-you__items">
              <h3>Purchased products</h3>
              <ul>
                {orderItems.map((item) => {
                  const productName = (item.productName ?? "");
                  const optionLabel = formatOrderItemOptions(item.size, item.color);

                  return (
                    <li key={item.id}>
                      <OrderItemImage
                        alt={productName}
                        imageUrl={item.imageUrl}
                        size="compact"
                      />
                      <div>
                        <strong>{productName}</strong>
                        {optionLabel ? <span>{optionLabel}</span> : null}
                      </div>
                      <span>x{item.quantity}</span>
                      <strong>{formatCurrency(item.lineTotal, status.currency)}</strong>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}

          <dl className="payment-thank-you__details">
            <div>
              <dt>payOS order code</dt>
              <dd>{formatOrderCode(status.providerOrderCode)}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>{formatCurrency(status.amount, status.currency)}</dd>
            </div>
            <div>
              <dt>Payment provider</dt>
              <dd>{status.payment.provider}</dd>
            </div>
            <div>
              <dt>Fulfillment</dt>
              <dd>
                <FulfillmentStatusBadge status={status.order.fulfillmentStatus} />
              </dd>
            </div>
            {paidAt ? (
              <div>
                <dt>Paid at</dt>
                <dd>{formatDateTime(paidAt)}</dd>
              </div>
            ) : null}
          </dl>
        </article>

        <div className="payment-thank-you__actions">
          <Link className="button button--primary" href={orderHref}>
            View order
          </Link>
          <Link className="button button--secondary" href="/products">
            Continue shopping
          </Link>
        </div>

        <p className="payment-thank-you__footnote">
          A confirmation email has been sent to your inbox.
        </p>
      </section>
    </main>
  );
}

function formatOrderItemOptions(
  size: string,
  color: string,
): string | undefined {
  if (isImplicitAccessoryOption({ color, size })) return undefined;

  const sizeLabel = isNoSize(size) ? "One size" : size;

  return `${sizeLabel} / ${(color ?? "")}`;
}
