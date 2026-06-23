"use client";

import { Info, Loader2, TicketPercent, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  formatCurrency,
  formatNumber,
} from "@/components/orders/order-format";
import type { CheckoutSummary as CheckoutSummaryModel } from "@/features/checkout/types";

interface CheckoutSummaryProps {
  contactSection: ReactNode;
  isDirectPay: boolean;
  isLoading: boolean;
  isSubmitting: boolean;
  onApplyVoucher: (code?: string) => void;
  onCreateOrder: () => void;
  onRemoveVoucher: () => void;
  onVoucherInputChange: (value: string) => void;
  summary: CheckoutSummaryModel;
  voucherInput: string;
  shippingSection: ReactNode;
}

export function CheckoutSummary({
  contactSection,
  isDirectPay,
  isLoading,
  isSubmitting,
  onApplyVoucher,
  onCreateOrder,
  onRemoveVoucher,
  onVoucherInputChange,
  summary,
  voucherInput,
  shippingSection,
}: CheckoutSummaryProps) {
  return (
    <section className="checkout-layout" aria-label="Checkout review">
      <div className="checkout-main-column">
        {contactSection}
        {shippingSection}

        <section
          className="checkout-items"
          aria-labelledby="checkout-items-heading"
        >
          <header className="checkout-section-heading">
            <div>
              <p className="eyebrow">Order details</p>
              <h2 id="checkout-items-heading">Order items</h2>
            </div>
            <span className="checkout-section-count">
              {formatNumber(summary.totalQuantity)}{" "}
              {summary.totalQuantity === 1 ? "item" : "items"}
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
                      <img
                        alt={item.productName}
                        loading="lazy"
                        src={item.imageUrl}
                      />
                    ) : (
                      <span>No image</span>
                    )}
                  </Link>
                  <div className="checkout-item__body">
                    <p className="cart-item-row__category">
                      {item.categoryName}
                    </p>
                    <h3>
                      <Link href={productHref}>{item.productName}</Link>
                    </h3>
                    <p>
                      Size {item.size} / Color {item.color}
                      {item.sku ? ` / ${item.sku}` : ""}
                    </p>
                    <p>{item.availableStock} available</p>
                  </div>
                  <div className="checkout-item__totals">
                    <span>Qty {formatNumber(item.quantity)}</span>
                    <span>
                      {formatCurrency(item.currentUnitPrice, summary.currency)}{" "}
                      each
                    </span>
                    <strong>
                      <small>Subtotal</small>
                      {formatCurrency(item.currentLineTotal, summary.currency)}
                    </strong>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <aside
        className="checkout-order-summary"
        aria-labelledby="checkout-total-heading"
      >
        <header>
          <p className="eyebrow">Summary</p>
          <h2 id="checkout-total-heading">Order summary</h2>
        </header>

        <section className="checkout-voucher" aria-labelledby="checkout-voucher-heading">
          <div className="checkout-voucher__heading">
            <TicketPercent aria-hidden="true" size={18} />
            <h3 id="checkout-voucher-heading">Voucher</h3>
          </div>

          <form
            className="checkout-voucher__form"
            onSubmit={(event) => {
              event.preventDefault();
              onApplyVoucher();
            }}
          >
            <label htmlFor="checkout-voucher-code">Voucher code</label>
            <div>
              <input
                autoComplete="off"
                disabled={isLoading || isSubmitting}
                id="checkout-voucher-code"
                maxLength={64}
                onChange={(event) =>
                  onVoucherInputChange(event.target.value.toUpperCase())
                }
                placeholder="SAVE10"
                value={voucherInput}
              />
              <button
                className="button button--secondary"
                disabled={isLoading || isSubmitting || !voucherInput.trim()}
                type="submit"
              >
                {isLoading ? "Checking" : "Apply"}
              </button>
            </div>
          </form>

          {summary.voucherError ? (
            <p className="checkout-voucher__error" role="alert">
              {summary.voucherError.message}
            </p>
          ) : null}

          {summary.appliedVoucher ? (
            <div className="checkout-voucher__applied" role="status">
              <div>
                <strong>{summary.appliedVoucher.code}</strong>
                <span>
                  -{formatCurrency(summary.discountAmount, summary.currency)}
                </span>
              </div>
              <button
                aria-label={`Remove voucher ${summary.appliedVoucher.code}`}
                disabled={isLoading || isSubmitting}
                onClick={onRemoveVoucher}
                type="button"
              >
                <X aria-hidden="true" size={15} />
                Remove
              </button>
            </div>
          ) : null}

          {summary.eligibleVouchers.length > 0 ? (
            <div className="checkout-voucher__eligible">
              <span>Eligible vouchers</span>
              <div>
                {summary.eligibleVouchers.map((voucher) => (
                  <button
                    className={
                      summary.appliedVoucher?.code === voucher.code
                        ? "is-applied"
                        : undefined
                    }
                    disabled={isLoading || isSubmitting}
                    key={voucher.code}
                    onClick={() => onApplyVoucher(voucher.code)}
                    type="button"
                  >
                    <strong>{voucher.code}</strong>
                    <small>{formatVoucherValue(voucher, summary.currency)}</small>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <dl className="checkout-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatCurrency(summary.subtotalAmount, summary.currency)}</dd>
          </div>
          <div>
            <dt>Discount</dt>
            <dd>-{formatCurrency(summary.discountAmount, summary.currency)}</dd>
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
          <div>
            {isDirectPay ? (
              <>
                <span>You will be redirected to payOS to complete payment.</span>
                <span>Your order is confirmed only after payment is verified.</span>
                <span>Do not close the page until payOS redirects you back.</span>
              </>
            ) : (
              <span>
                Your order will be created as <strong>PENDING_PAYMENT</strong>.
                Payment is not completed at this step.
              </span>
            )}
          </div>
        </div>

        <button
          className="button button--primary button--full checkout-create-button"
          disabled={
            isLoading ||
            isSubmitting ||
            summary.items.length === 0 ||
            Boolean(summary.voucherError)
          }
          onClick={onCreateOrder}
          type="button"
        >
          {isSubmitting ? (
            <Loader2 aria-hidden="true" className="spin" size={17} />
          ) : null}
          {isSubmitting
            ? isDirectPay
              ? "CREATING PAYMENT..."
              : "Creating order..."
            : isDirectPay
              ? "PAY WITH PAYOS"
              : "Create pending order"}
        </button>
      </aside>
    </section>
  );
}

function formatVoucherValue(
  voucher: CheckoutSummaryModel["eligibleVouchers"][number],
  currency: string,
): string {
  return voucher.discountType === "PERCENT"
    ? `${voucher.discountValue}% off`
    : `${formatCurrency(voucher.discountValue, currency)} off`;
}
