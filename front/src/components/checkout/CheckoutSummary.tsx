"use client";

import { Info, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  formatCurrency,
  formatNumber,
} from "@/components/orders/order-format";
import type { CheckoutSummary as CheckoutSummaryModel } from "@/features/checkout/types";

interface CheckoutSummaryProps {
  isSubmitting: boolean;
  onCreateOrder: () => void;
  summary: CheckoutSummaryModel;
}

export function CheckoutSummary({
  isSubmitting,
  onCreateOrder,
  summary,
}: CheckoutSummaryProps) {
  return (
    <section className="checkout-layout" aria-label="Checkout review">
      <section className="checkout-items" aria-labelledby="checkout-items-heading">
        <header className="checkout-section-heading">
          <div>
            <p className="eyebrow">Order details</p>
            <h2 id="checkout-items-heading">Your items</h2>
          </div>
          <span>
            {formatNumber(summary.totalQuantity)} {summary.totalQuantity === 1 ? "item" : "items"}
          </span>
        </header>

        <div className="checkout-item-list">
          {summary.items.map((item) => {
            const productHref = `/products/${encodeURIComponent(item.productSlug)}`;

            return (
              <article className="checkout-item" key={item.cartItemId}>
                <Link
                  aria-label={`View ${item.productName}`}
                  className="checkout-item__image"
                  href={productHref}
                >
                  {item.imageUrl ? (
                    <img alt={item.productName} loading="lazy" src={item.imageUrl} />
                  ) : (
                    <span>No image</span>
                  )}
                </Link>
                <div className="checkout-item__body">
                  <p className="cart-item-row__category">{item.categoryName}</p>
                  <h3>
                    <Link href={productHref}>{item.productName}</Link>
                  </h3>
                  <p>
                    Size {item.size} · Color {item.color}
                    {item.sku ? ` · ${item.sku}` : ""}
                  </p>
                  <p>{item.availableStock} available</p>
                </div>
                <div className="checkout-item__totals">
                  <span>Quantity {formatNumber(item.quantity)}</span>
                  <span>
                    Unit {formatCurrency(item.currentUnitPrice, summary.currency)}
                  </span>
                  <strong>
                    <small>Line total</small>
                    {formatCurrency(item.currentLineTotal, summary.currency)}
                  </strong>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <aside
        className="checkout-order-summary"
        aria-labelledby="checkout-total-heading"
      >
        <header>
          <p className="eyebrow">Summary</p>
          <h2 id="checkout-total-heading">Order summary</h2>
        </header>

        <dl className="checkout-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatCurrency(summary.subtotalAmount, summary.currency)}</dd>
          </div>
          <div className="checkout-totals__total">
            <dt>Total</dt>
            <dd>{formatCurrency(summary.totalAmount, summary.currency)}</dd>
          </div>
        </dl>
        <p className="checkout-order-summary__currency">
          Total shown in {summary.currency}.
        </p>

        {summary.warnings.length > 0 ? (
          <div className="checkout-warning-list" role="status">
            {summary.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}

        <div className="checkout-pending-note" role="note">
          <Info aria-hidden="true" size={18} />
          <span>
            Your order will be created as <strong>PENDING_PAYMENT</strong>.
            Payment is not completed at this step.
          </span>
        </div>

        <button
          className="button button--primary button--full checkout-create-button"
          disabled={isSubmitting || summary.items.length === 0}
          onClick={onCreateOrder}
          type="button"
        >
          {isSubmitting ? (
            <Loader2 aria-hidden="true" className="spin" size={17} />
          ) : null}
          {isSubmitting ? "Creating order..." : "Create pending order"}
        </button>
      </aside>
    </section>
  );
}
