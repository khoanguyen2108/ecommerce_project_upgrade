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

export interface CheckoutSummary {
  items: CheckoutSummaryItem[];
  totalQuantity: number;
  subtotalAmount: number;
  totalAmount: number;
  currency: string;
  warnings: string[];
}

export interface CheckoutSummaryResponse {
  summary: CheckoutSummary;
}

export type CreateCheckoutOrderResponse = OrderResponse;
