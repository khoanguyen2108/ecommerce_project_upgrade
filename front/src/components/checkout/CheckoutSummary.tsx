"use client";

import Link from "next/link";
import {
  formatCurrency,
  formatNumber,
} from "@/components/orders/order-format";
import type { CheckoutSummary as CheckoutSummaryModel } from "@/features/checkout/types";

interface CheckoutSummaryProps {
  summary: CheckoutSummaryModel;
}

export function CheckoutSummary({ summary }: CheckoutSummaryProps) {
  return (
    <section className="checkout-summary-grid" aria-label="Checkout summary">
      <div className="checkout-items">
        <div className="customer-section__header">
          <div>
            <p className="eyebrow">Summary</p>
            <h2>Items</h2>
          </div>
          <span>{formatNumber(summary.totalQuantity)} total quantity</span>
        </div>

        <div className="checkout-item-list">
          {summary.items.map((item) => (
            <article className="checkout-item" key={item.cartItemId}>
              <Link
                aria-label={`View ${item.productName}`}
                className="checkout-item__image"
                href={`/products/${encodeURIComponent(item.productSlug)}`}
              >
                {item.imageUrl ? (
                  <img alt={item.productName} loading="lazy" src={item.imageUrl} />
                ) : (
                  <span>No image available</span>
                )}
              </Link>
              <div className="checkout-item__body">
                <p className="cart-item-row__category">{item.categoryName}</p>
                <h3>
                  <Link href={`/products/${encodeURIComponent(item.productSlug)}`}>
                    {item.productName}
                  </Link>
                </h3>
                <p>
                  {item.size} / {item.color}
                  {item.sku ? ` / ${item.sku}` : ""}
                </p>
                <p>{item.availableStock} in stock</p>
              </div>
              <div className="checkout-item__totals">
                <span>Qty {item.quantity}</span>
                <strong>
                  {formatCurrency(item.currentLineTotal, summary.currency)}
                </strong>
              </div>
            </article>
          ))}
        </div>
      </div>

      <aside className="cart-summary-panel" aria-labelledby="checkout-total-heading">
        <p className="eyebrow">Total</p>
        <h2 id="checkout-total-heading">
          {formatCurrency(summary.totalAmount, summary.currency)}
        </h2>
        <dl className="order-summary-list">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatCurrency(summary.subtotalAmount, summary.currency)}</dd>
          </div>
          <div>
            <dt>Total</dt>
            <dd>{formatCurrency(summary.totalAmount, summary.currency)}</dd>
          </div>
          <div>
            <dt>Currency</dt>
            <dd>{summary.currency}</dd>
          </div>
        </dl>
        {summary.warnings.length > 0 ? (
          <div className="checkout-warning-list" role="status">
            {summary.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ) : null}
      </aside>
    </section>
  );
}
