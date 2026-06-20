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
import type { CheckoutSummary as CheckoutSummaryModel } from "@/features/checkout/types";
import type { Order } from "@/features/orders/types";
import { listAddresses } from '@/features/addresses/api';
import type { Address, AddressInput } from '@/features/addresses/types';
import { AddressFields, emptyAddressInput, normalizeAddressInput, validateAddress } from '@/components/profile/AddressFields';
import { MapPin } from 'lucide-react';

export function CheckoutPage() {
  const { cart, clearCart, refreshCart } = useCart();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthSession();
  const [summary, setSummary] = useState<CheckoutSummaryModel>();
  const [createdOrder, setCreatedOrder] = useState<Order>();
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
    if (isAuthLoading || !isAuthenticated) {
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
  }, [isAuthenticated, isAuthLoading]);

  useEffect(() => {
    let isMounted = true;

    async function loadSummary() {
      if (isAuthLoading || (!isAuthenticated && !cart)) return;

      setIsLoading(true);
      setError(undefined);
      setErrorCode(undefined);
      setRequestId(undefined);

      try {
        const guestItems = cart?.items.map((item) => ({
          variantId: item.variantId,
          quantity: item.quantity,
        })) ?? [];
        if (!isAuthenticated && guestItems.length === 0) {
          if (isMounted) {
            setSummary(undefined);
            setError("Your cart is empty. Add an item before checkout.");
            setErrorCode("CHECKOUT_CART_EMPTY");
            setIsLoading(false);
          }
          return;
        }
        const response = isAuthenticated
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
  }, [cart, isAuthenticated, isAuthLoading, refreshKey, requestedVoucherCode]);

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

    if (selectedAddressId === 'new') {
      const shippingError = validateAddress(shippingInfo);
      if (shippingError) { setError(shippingError); setErrorCode('CHECKOUT_SHIPPING_INVALID'); return; }
    }

    submissionLockRef.current = true;
    setIsSubmitting(true);
    setError(undefined);
    setErrorCode(undefined);
    setRequestId(undefined);

    try {
      const normalizedShipping = normalizeAddressInput(shippingInfo);
      const response = isAuthenticated
        ? await createCheckoutOrder({
            ...(requestedVoucherCode ? { voucherCode: requestedVoucherCode } : {}),
            ...(selectedAddressId === 'new'
              ? { shippingInfo: { ...normalizedShipping, saveAddress, setDefault: saveAddress && setDefault } }
              : { addressId: selectedAddressId }),
          })
        : await createGuestCheckoutOrder({
            items: cart?.items.map((item) => ({
              variantId: item.variantId,
              quantity: item.quantity,
            })) ?? [],
            ...(requestedVoucherCode ? { voucherCode: requestedVoucherCode } : {}),
            shippingInfo: {
              ...normalizedShipping,
              ...(guestEmail.trim() ? { email: guestEmail.trim() } : {}),
            },
          });
      setCreatedOrder(response.order);
      setSummary(undefined);
      if (isAuthenticated) {
        void refreshCart().catch(() => undefined);
      } else {
        await clearCart();
      }
    } catch (submitError) {
      setError(
        getCheckoutErrorMessage(
          submitError,
          "Pending order could not be created.",
        ),
      );
      setErrorCode(getCheckoutErrorCode(submitError));
      setRequestId(getCheckoutRequestId(submitError));
    } finally {
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  if (createdOrder) {
    return <CheckoutSuccess isGuest={!isAuthenticated} order={createdOrder} />;
  }

  const isEmpty = !isLoading && errorCode === "CHECKOUT_CART_EMPTY";

  return (
    <main className="customer-page checkout-page">
      <CheckoutIntro
        subtitle="Review your cart before creating an order that waits for payment confirmation."
        title="Review your order"
      />
      <CheckoutStepper current="review" />

      {error && !isEmpty ? (
        <div className="customer-feedback customer-feedback--error" role="alert">
          <AlertCircle aria-hidden="true" size={19} />
          <span>{error}</span>
          {requestId ? <small>Request {requestId}</small> : null}
          <button
            className="button button--secondary checkout-retry-button"
            disabled={isLoading || isSubmitting}
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={16} />
            Retry
          </button>
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
              isGuest={!isAuthenticated}
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
          <AddressFields disabled={disabled} idPrefix="checkout-shipping" onChange={onAddressChange} value={shippingInfo} />
          {isGuest ? (
            <div className="form-field checkout-guest-email">
              <label htmlFor="checkout-guest-email">Email (optional)</label>
              <input
                autoComplete="email"
                disabled={disabled}
                id="checkout-guest-email"
                maxLength={320}
                onChange={(event) => onGuestEmailChange(event.target.value)}
                placeholder="guest@example.com"
                type="email"
                value={guestEmail}
              />
              <small><Link href="/login?next=%2Fcheckout">Sign in</Link> to save this address for next time.</small>
            </div>
          ) : (
          <div className="checkout-address-checks">
            <label className="address-checkbox"><input checked={saveAddress} disabled={disabled} onChange={(event) => onSaveAddressChange(event.target.checked)} type="checkbox" />Save this address</label>
            <label className="address-checkbox"><input checked={setDefault} disabled={disabled || !saveAddress} onChange={(event) => onSetDefaultChange(event.target.checked)} type="checkbox" />Set as default</label>
          </div>
          )}
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
    { id: "pending", label: "Pending payment" },
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

function CheckoutSuccess({ isGuest, order }: { isGuest: boolean; order: Order }) {
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
            <p className="eyebrow">Shipping to</p>
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
            Payment has not been completed yet. Your order is waiting for payment
            confirmation.
          </span>
        </div>

        <div className="checkout-success-actions">
          {!isGuest ? (
            <Link
              className="button button--primary"
              href={`/orders/${encodeURIComponent(order.id)}`}
            >
              View order
            </Link>
          ) : null}
          <Link className="button button--secondary" href="/products">
            Continue shopping
          </Link>
          {!isGuest ? <Link className="button button--secondary" href="/orders">View orders</Link> : null}
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
