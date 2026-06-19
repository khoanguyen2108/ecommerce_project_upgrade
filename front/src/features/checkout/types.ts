import type { OrderResponse } from "@/features/orders/types";

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
