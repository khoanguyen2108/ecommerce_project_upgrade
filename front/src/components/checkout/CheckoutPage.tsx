"use client";

import {
  AlertCircle,
  CheckCircle2,
  Info,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { CheckoutSummary } from "@/components/checkout/CheckoutSummary";
import { getSafeCheckoutUrl } from "@/components/payments/PayosPaymentButton";
import { formatCurrency } from "@/components/orders/order-format";
import {
  createCheckoutOrder,
  createGuestCheckoutOrder,
  getCheckoutSummary,
  getGuestCheckoutSummary,
} from "@/features/checkout/api";
import {
  getCheckoutErrorCode,
  getCheckoutErrorMessage,
  getCheckoutRequestId,
} from "@/features/checkout/errors";
import type {
  CheckoutSummary as CheckoutSummaryModel,
  GuestCheckoutItemRequest,
} from "@/features/checkout/types";
import type { Order } from "@/features/orders/types";
import { createPayosPayment } from "@/features/payments/api";
import { listAddresses } from '@/features/addresses/api';
import type { Address, AddressInput } from '@/features/addresses/types';
import { AddressFields, emptyAddressInput, normalizeAddressInput, validateAddress } from '@/components/profile/AddressFields';
import { MapPin } from 'lucide-react';

type CheckoutMode = "AUTHENTICATED" | "GUEST";

export function CheckoutPage() {
  const { clearGuestCart, getGuestCartItems, refreshCart } = useCart();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthSession();
  const [checkoutMode, setCheckoutMode] = useState<CheckoutMode>();
  const [guestItems, setGuestItems] = useState<GuestCheckoutItemRequest[]>([]);
  const [summary, setSummary] = useState<CheckoutSummaryModel>();
  const [createdGuestOrder, setCreatedGuestOrder] = useState<Order>();
  const [paymentRecoveryOrderId, setPaymentRecoveryOrderId] = useState<string>();
  const [voucherInput, setVoucherInput] = useState("");
  const [requestedVoucherCode, setRequestedVoucherCode] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const [errorCode, setErrorCode] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState('new');
  const [shippingInfo, setShippingInfo] = useState<AddressInput>(emptyAddressInput);
  const [guestEmail, setGuestEmail] = useState("");
  const [saveAddress, setSaveAddress] = useState(false);
  const [setDefault, setSetDefault] = useState(false);
  const submissionLockRef = useRef(false);
  const voucherRequestLockRef = useRef(false);

  useEffect(() => {
    if (checkoutMode || isAuthLoading) return;

    if (isAuthenticated) {
      setCheckoutMode("AUTHENTICATED");
      return;
    }

    setGuestItems(
      getGuestCartItems().map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
      })),
    );
    setCheckoutMode("GUEST");
  }, [checkoutMode, getGuestCartItems, isAuthenticated, isAuthLoading]);

  useEffect(() => {
    if (checkoutMode !== "AUTHENTICATED") {
      setAddresses([]);
      setSelectedAddressId('new');
      return;
    }

    let active = true;
    listAddresses()
      .then((response) => {
        if (!active) return;
        setAddresses(response.addresses);
        const preferred = response.addresses.find((address) => address.isDefault) || response.addresses[0];
        if (preferred) setSelectedAddressId(preferred.id);
      })
      .catch(() => { if (active) setSelectedAddressId('new'); });
    return () => { active = false; };
  }, [checkoutMode]);

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      if (!checkoutMode) return;

      setIsLoading(true);
      setError(undefined);
      setErrorCode(undefined);
      setRequestId(undefined);

      try {
        if (checkoutMode === "GUEST" && guestItems.length === 0) {
          if (isMounted) {
            setSummary(undefined);
            setError("Your cart is empty. Add an item before checkout.");
            setErrorCode("CHECKOUT_CART_EMPTY");
            setIsLoading(false);
          }
          return;
        }
        const response = checkoutMode === "AUTHENTICATED"
          ? await getCheckoutSummary(requestedVoucherCode)
          : await getGuestCheckoutSummary({
              items: guestItems,
              ...(requestedVoucherCode
                ? { voucherCode: requestedVoucherCode }
                : {}),
            });

        if (isMounted) {
          setSummary(response.summary);
        }
      } catch (loadError) {
        if (isMounted) {
          setSummary(undefined);
          setError(
            getCheckoutErrorMessage(
              loadError,
              "Checkout summary could not be loaded.",
            ),
          );
          setErrorCode(getCheckoutErrorCode(loadError));
          setRequestId(getCheckoutRequestId(loadError));
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
          voucherRequestLockRef.current = false;
        }
      }
    }

    void loadSummary();

    return () => {
      isMounted = false;
    };
  }, [checkoutMode, guestItems, refreshKey, requestedVoucherCode]);

  function handleApplyVoucher(code = voucherInput) {
    if (voucherRequestLockRef.current) {
      return;
    }

    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      setError("Enter a voucher code before applying it.");
      setErrorCode("CHECKOUT_VOUCHER_CODE_REQUIRED");
      return;
    }

    voucherRequestLockRef.current = true;
    setVoucherInput(normalizedCode);
    if (normalizedCode === requestedVoucherCode) {
      setRefreshKey((current) => current + 1);
    } else {
      setRequestedVoucherCode(normalizedCode);
    }
  }

  function handleRemoveVoucher() {
    if (voucherRequestLockRef.current) {
      return;
    }

    voucherRequestLockRef.current = true;
    setVoucherInput("");
    setRequestedVoucherCode(undefined);
  }

  async function handleCreateOrder() {
    if (submissionLockRef.current || voucherRequestLockRef.current) {
      return;
    }

    if (!checkoutMode) return;

    if (checkoutMode === "GUEST" || selectedAddressId === 'new') {
      const shippingError = validateAddress(shippingInfo);
      if (shippingError) { setError(shippingError); setErrorCode('CHECKOUT_SHIPPING_INVALID'); return; }
    }

    const normalizedGuestEmail = guestEmail.trim().toLowerCase();
    if (checkoutMode === "GUEST" && !isValidGuestEmail(normalizedGuestEmail)) {
      setError("Enter a valid email address for order updates.");
      setErrorCode("CHECKOUT_GUEST_EMAIL_INVALID");
      return;
    }

    submissionLockRef.current = true;
    setIsSubmitting(true);
    setError(undefined);
    setErrorCode(undefined);
    setRequestId(undefined);
    setPaymentRecoveryOrderId(undefined);

    let authenticatedOrderId: string | undefined;

    try {
      const normalizedShipping = normalizeAddressInput(shippingInfo);
      const response = checkoutMode === "AUTHENTICATED"
        ? await createCheckoutOrder({
            ...(requestedVoucherCode ? { voucherCode: requestedVoucherCode } : {}),
            ...(selectedAddressId === 'new'
              ? { shippingInfo: { ...normalizedShipping, saveAddress, setDefault: saveAddress && setDefault } }
              : { addressId: selectedAddressId }),
          })
        : await createGuestCheckoutOrder({
            items: guestItems,
            ...(requestedVoucherCode ? { voucherCode: requestedVoucherCode } : {}),
            shippingInfo: {
              ...normalizedShipping,
              email: normalizedGuestEmail,
            },
          });
      if (checkoutMode === "AUTHENTICATED") {
        authenticatedOrderId = response.order.id;
        void refreshCart().catch(() => undefined);

        const paymentResponse = await createPayosPayment({
          orderId: response.order.id,
        });
        const checkoutUrl = getSafeCheckoutUrl(
          paymentResponse.checkoutUrl || paymentResponse.paymentUrl,
        );

        if (!checkoutUrl) {
          throw new Error("PAYOS_CHECKOUT_URL_MISSING");
        }

        window.location.assign(checkoutUrl);
        return;
      }

      setCreatedGuestOrder(response.order);
      setSummary(undefined);
      clearGuestCart();
    } catch (submitError) {
      const submitErrorCode = getCheckoutErrorCode(submitError);

      if (authenticatedOrderId) {
        setSummary(undefined);
        setPaymentRecoveryOrderId(authenticatedOrderId);
        setError(
          submitErrorCode === "PAYMENT_RECONCILIATION_REQUIRED"
            ? "Payment requires manual review. Please contact support."
            : "Payment link could not be created. Please retry from your order.",
        );
      } else {
        setError(
          getCheckoutErrorMessage(
            submitError,
            checkoutMode === "AUTHENTICATED"
              ? "Checkout could not be started."
              : "Pending order could not be created.",
          ),
        );
      }
      setErrorCode(submitErrorCode);
      setRequestId(getCheckoutRequestId(submitError));
    } finally {
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (createdGuestOrder) {
    return <GuestCheckoutSuccess order={createdGuestOrder} />;
  }

  const isEmpty = !isLoading && errorCode === "CHECKOUT_CART_EMPTY";

  return (
    <main className="customer-page checkout-page">
      <CheckoutIntro
        subtitle={
          checkoutMode === "AUTHENTICATED"
            ? "You will be redirected to payOS to complete your payment."
            : "Review your cart before creating an order that waits for payment confirmation."
        }
        title="Review your order"
      />
      <CheckoutStepper current="review" />

      {error && !isEmpty ? (
        <div className="customer-feedback customer-feedback--error" role="alert">
          <AlertCircle aria-hidden="true" size={19} />
          <span>{error}</span>
          {requestId ? <small>Request {requestId}</small> : null}
          {paymentRecoveryOrderId ? (
            <Link
              className="button button--secondary checkout-retry-button"
              href={`/orders/${encodeURIComponent(paymentRecoveryOrderId)}`}
            >
              View order and retry
            </Link>
          ) : (
            <button
              className="button button--secondary checkout-retry-button"
              disabled={isLoading || isSubmitting}
              onClick={() => setRefreshKey((current) => current + 1)}
              type="button"
            >
              <RefreshCw aria-hidden="true" size={16} />
              Retry
            </button>
          )}
        </div>
      ) : null}

      {isLoading && !summary ? <CheckoutSkeleton /> : null}

      {isEmpty ? (
        <section className="checkout-empty" aria-labelledby="checkout-empty-heading">
          <Info aria-hidden="true" size={34} strokeWidth={1.6} />
          <p className="eyebrow">Checkout</p>
          <h2 id="checkout-empty-heading">Your cart is empty</h2>
          <p>Add an in-stock size and color before returning to checkout.</p>
          <Link className="button button--primary" href="/products">
            Back to products
          </Link>
        </section>
      ) : null}

      {summary ? (
        <CheckoutSummary
          isDirectPay={checkoutMode === "AUTHENTICATED"}
          isLoading={isLoading}
          isSubmitting={isSubmitting}
          onApplyVoucher={handleApplyVoucher}
          onCreateOrder={handleCreateOrder}
          onRemoveVoucher={handleRemoveVoucher}
          summary={summary}
          voucherInput={voucherInput}
          onVoucherInputChange={setVoucherInput}
          shippingSection={
            <CheckoutShipping
              addresses={addresses}
              disabled={isSubmitting}
              guestEmail={guestEmail}
              isGuest={checkoutMode === "GUEST"}
              onAddressChange={setShippingInfo}
              onGuestEmailChange={setGuestEmail}
              onSaveAddressChange={(checked) => { setSaveAddress(checked); if (!checked) setSetDefault(false); }}
              onSelectedAddressChange={setSelectedAddressId}
              onSetDefaultChange={setSetDefault}
              saveAddress={saveAddress}
              selectedAddressId={selectedAddressId}
              setDefault={setDefault}
              shippingInfo={shippingInfo}
            />
          }
        />
      ) : null}
    </main>
  );
}

function CheckoutShipping({ addresses, disabled, guestEmail, isGuest, onAddressChange, onGuestEmailChange, onSaveAddressChange, onSelectedAddressChange, onSetDefaultChange, saveAddress, selectedAddressId, setDefault, shippingInfo }: {
  addresses: Address[];
  disabled: boolean;
  guestEmail: string;
  isGuest: boolean;
  onAddressChange: (value: AddressInput) => void;
  onGuestEmailChange: (value: string) => void;
  onSaveAddressChange: (value: boolean) => void;
  onSelectedAddressChange: (value: string) => void;
  onSetDefaultChange: (value: boolean) => void;
  saveAddress: boolean;
  selectedAddressId: string;
  setDefault: boolean;
  shippingInfo: AddressInput;
}) {
  return (
    <section className="checkout-shipping" aria-labelledby="checkout-shipping-heading">
      <header className="checkout-section-heading"><div><p className="eyebrow">Delivery</p><h2 id="checkout-shipping-heading">Shipping information</h2></div><MapPin aria-hidden="true" size={22} /></header>
      {addresses.length > 0 ? (
        <div className="checkout-address-options">
          {addresses.map((address) => (
            <label className={`checkout-address-option ${selectedAddressId === address.id ? 'is-selected' : ''}`} key={address.id}>
              <input checked={selectedAddressId === address.id} disabled={disabled} name="shipping-source" onChange={() => onSelectedAddressChange(address.id)} type="radio" />
              <span><strong>{address.recipientName}{address.isDefault ? <small>Default</small> : null}</strong><span>{address.phone}</span><span>{[address.addressLine, address.ward, address.district, address.province].join(', ')}</span></span>
            </label>
          ))}
          <label className={`checkout-address-option ${selectedAddressId === 'new' ? 'is-selected' : ''}`}>
            <input checked={selectedAddressId === 'new'} disabled={disabled} name="shipping-source" onChange={() => onSelectedAddressChange('new')} type="radio" /><span><strong>Use a new address</strong><span>Enter delivery details below.</span></span>
          </label>
        </div>
      ) : null}
      {selectedAddressId === 'new' ? (
        <div className="checkout-new-address">
          {isGuest ? (
            <div className="form-field checkout-guest-email">
              <label htmlFor="checkout-guest-email">Email</label>
              <input
                autoComplete="email"
                disabled={disabled}
                id="checkout-guest-email"
                maxLength={320}
                onChange={(event) => onGuestEmailChange(event.target.value)}
                placeholder="guest@example.com"
                required
                type="email"
                value={guestEmail}
              />
              <small>We will use this email only for this order update.</small>
            </div>
          ) : null}
          <AddressFields disabled={disabled} idPrefix="checkout-shipping" onChange={onAddressChange} value={shippingInfo} />
          {!isGuest ? (
          <div className="checkout-address-checks">
            <label className="address-checkbox"><input checked={saveAddress} disabled={disabled} onChange={(event) => onSaveAddressChange(event.target.checked)} type="checkbox" />Save this address</label>
            <label className="address-checkbox"><input checked={setDefault} disabled={disabled || !saveAddress} onChange={(event) => onSetDefaultChange(event.target.checked)} type="checkbox" />Set as default</label>
          </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CheckoutIntro({ subtitle, title }: { subtitle: string; title: string }) {
  return (
    <section className="checkout-intro" aria-labelledby="checkout-heading">
      <p className="eyebrow">Checkout</p>
      <h1 id="checkout-heading">{title}</h1>
      <p>{subtitle}</p>
    </section>
  );
}

function CheckoutStepper({ current }: { current: "review" | "pending" }) {
  const steps = [
    { id: "cart", label: "Cart" },
    { id: "review", label: "Review" },
    { id: "pending", label: "Payment" },
  ] as const;
  const currentIndex = current === "review" ? 1 : 2;

  return (
    <nav className="checkout-stepper" aria-label="Checkout progress">
      <ol>
        {steps.map((step, index) => {
          const isCurrent = step.id === current;
          const isComplete = index < currentIndex;

          return (
            <li
              aria-current={isCurrent ? "step" : undefined}
              className={`${isCurrent ? "is-current" : ""} ${isComplete ? "is-complete" : ""}`}
              key={step.id}
            >
              <span aria-hidden="true">{index + 1}</span>
              <strong>{step.label}</strong>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function GuestCheckoutSuccess({ order }: { order: Order }) {
  return (
    <main className="customer-page checkout-page checkout-page--success">
      <CheckoutIntro
        subtitle="Your order is saved and is now waiting for payment confirmation."
        title="Order created"
      />
      <CheckoutStepper current="pending" />

      <section
        aria-labelledby="checkout-success-heading"
        className="checkout-success-panel"
        role="status"
      >
        <div className="checkout-success-panel__mark">
          <CheckCircle2 aria-hidden="true" size={28} strokeWidth={1.7} />
        </div>
        <div className="checkout-success-panel__heading">
          <p className="eyebrow">Order status</p>
          <h2 id="checkout-success-heading">{order.status}</h2>
        </div>

        <dl className="checkout-success-details">
          <div>
            <dt>Order ID</dt>
            <dd>{order.id}</dd>
          </div>
          <div>
            <dt>Subtotal</dt>
            <dd>{formatCurrency(order.subtotalAmount, order.currency)}</dd>
          </div>
          <div>
            <dt>Discount</dt>
            <dd>{formatCurrency(order.discountAmount, order.currency)}</dd>
          </div>
          {order.voucherCodeSnapshot ? (
            <div>
              <dt>Voucher</dt>
              <dd>{order.voucherCodeSnapshot}</dd>
            </div>
          ) : null}
          <div>
            <dt>Final total</dt>
            <dd>{formatCurrency(order.totalAmount, order.currency)}</dd>
          </div>
        </dl>

        {order.shippingRecipientName ? (
          <div className="checkout-success-shipping">
            <p className="eyebrow">Customer and shipping</p>
            {order.guestEmail ? <span>Email: {order.guestEmail}</span> : null}
            <strong>{order.shippingRecipientName}</strong>
            <span>{order.shippingPhone}</span>
            <span>{[
              order.shippingAddressLine,
              order.shippingWard,
              order.shippingDistrict,
              order.shippingProvince,
            ].filter(Boolean).join(", ")}</span>
            {order.shippingNote ? <span>{order.shippingNote}</span> : null}
          </div>
        ) : null}

        <div className="checkout-pending-note" role="note">
          <Info aria-hidden="true" size={18} />
          <span>
            Guest online payment is deferred because this order has no secure
            guest access token. The order remains pending and is not attached
            to an account.
          </span>
        </div>

        <div className="checkout-success-actions">
          <Link className="button button--secondary" href="/products">
            Continue shopping
          </Link>
        </div>
      </section>
    </main>
  );
}

function CheckoutSkeleton() {
  return (
    <section className="checkout-layout" aria-busy="true" aria-live="polite">
      <div className="checkout-items">
        <div className="checkout-section-heading">
          <span className="customer-skeleton-line customer-skeleton-line--wide" />
          <span className="customer-skeleton-line" />
        </div>
        <div className="checkout-item-list">
          {Array.from({ length: 2 }, (_, index) => (
            <div aria-hidden="true" className="checkout-item" key={index}>
              <span className="checkout-item__image checkout-item__image--skeleton" />
              <span className="checkout-item__body">
                <span className="customer-skeleton-line" />
                <span className="customer-skeleton-line customer-skeleton-line--wide" />
                <span className="customer-skeleton-line" />
              </span>
            </div>
          ))}
        </div>
      </div>
      <aside className="checkout-order-summary checkout-order-summary--skeleton">
        <span className="customer-skeleton-line" />
        <span className="customer-skeleton-line customer-skeleton-line--wide" />
        <span className="customer-skeleton-line" />
      </aside>
    </section>
  );
}

function isValidGuestEmail(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}
