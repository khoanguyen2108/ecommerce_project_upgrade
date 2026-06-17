export interface CartProductCategory {
  id: string;
  name: string;
  slug: string;
}

export interface CartProductSnapshot {
  id: string;
  name: string;
  slug: string;
  imageUrls: string[];
  firstImageUrl: string | null;
  category: CartProductCategory;
}

export interface CartVariantDisplay {
  sku: string | null;
  size: string;
  color: string;
  priceOverride: number | null;
  stock: number;
}

export interface CartItem {
  id: string;
  variantId: string;
  quantity: number;
  currentUnitPrice: number;
  currentLineTotal: number;
  availableStock: number;
  product: CartProductSnapshot;
  variant: CartVariantDisplay;
  createdAt: string;
  updatedAt: string;
}

export interface Cart {
  id: string;
  userId: string;
  items: CartItem[];
  totalQuantity: number;
  estimatedSubtotal: number;
  createdAt: string;
  updatedAt: string;
}

export interface CartResponse {
  cart: Cart;
}

export interface AddCartItemRequest {
  variantId: string;
  quantity: number;
}

export interface UpdateCartItemRequest {
  quantity: number;
}
