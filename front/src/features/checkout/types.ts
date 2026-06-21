import type { OrderResponse } from "@/features/orders/types";
import type { PayosPaymentResponse } from "@/features/payments/types";
import type { AddressInput } from '@/features/addresses/types';

export interface CheckoutSummaryItem {
  cartItemId: string;
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  imageUrl: string | null;
  imageUrls: string[];
  categoryName: string;
  categorySlug: string;
  sku: string | null;
  size: string;
  color: string;
  quantity: number;
  availableStock: number;
  currentUnitPrice: number;
  currentLineTotal: number;
}

export type VoucherDiscountType = "PERCENT" | "FIXED";

export interface CheckoutVoucher {
  code: string;
  name: string;
  discountType: VoucherDiscountType;
  discountValue: number;
  maxDiscount: number | null;
  minSubtotal: number;
}

export interface CheckoutVoucherError {
  code: string;
  message: string;
}

export interface CheckoutSummary {
  items: CheckoutSummaryItem[];
  totalQuantity: number;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  appliedVoucher: CheckoutVoucher | null;
  voucherError: CheckoutVoucherError | null;
  eligibleVouchers: CheckoutVoucher[];
  currency: string;
  warnings: string[];
}

export interface CheckoutSummaryResponse {
  summary: CheckoutSummary;
}

export type CreateCheckoutOrderResponse = OrderResponse;

export interface CheckoutShippingInfo extends AddressInput {
  saveAddress?: boolean;
  setDefault?: boolean;
  email?: string;
}

export interface CreateCheckoutOrderRequest {
  voucherCode?: string;
  addressId?: string;
  shippingInfo?: CheckoutShippingInfo;
}

export interface GuestCheckoutItemRequest {
  variantId: string;
  quantity: number;
}

export interface GuestCheckoutSummaryRequest {
  items: GuestCheckoutItemRequest[];
  voucherCode?: string;
}

export interface GuestCheckoutShippingInfo extends AddressInput {
  email: string;
}

export interface CreateGuestCheckoutOrderRequest
  extends GuestCheckoutSummaryRequest {
  shippingInfo: GuestCheckoutShippingInfo;
}

export interface GuestCheckoutPaymentResponse extends PayosPaymentResponse {
  order: OrderResponse["order"];
}
