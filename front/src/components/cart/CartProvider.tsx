"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { CartToast } from "@/components/cart/CartToast";
import { MiniCartDrawer } from "@/components/cart/MiniCartDrawer";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import {
  addCartItem,
  clearCart as clearCartRequest,
  getCart,
  removeCartItem,
  updateCartItem,
} from "@/features/cart/api";
import { getCartErrorMessage, getCartRequestId } from "@/features/cart/errors";
import type { AddCartItemRequest, Cart, CartItem } from "@/features/cart/types";

export const GUEST_CART_STORAGE_KEY = "belikeme_guest_cart";

interface CartToastState {
  id: number;
  kind: "error" | "success";
  message: string;
}

interface CartContextValue {
  cart?: Cart;
  cartCount: number;
  closeCart: () => void;
  clearCart: () => Promise<void>;
  clearGuestCart: () => void;
  error?: string;
  isLoading: boolean;
  isOpen: boolean;
  isSaving: boolean;
  openCart: () => void;
  removeItem: (id: string) => Promise<void>;
  requestId?: string;
  refreshCart: () => Promise<void>;
  getGuestCartItems: () => CartItem[];
  addItemAndOpenDrawer: (
    payload: AddCartItemRequest,
    productName?: string,
  ) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { currentUser, isAuthenticated, isLoading: isAuthLoading } = useAuthSession();
  const [cart, setCart] = useState<Cart>();
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState<CartToastState>();
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const authenticatedUserIdRef = useRef(currentUser?.id);
  const toastTimerRef = useRef<number | undefined>(undefined);
  authenticatedUserIdRef.current = currentUser?.id;

  const clearError = useCallback(() => {
    setError(undefined);
    setRequestId(undefined);
  }, []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const openCart = useCallback(() => setIsOpen(true), []);

  const showToast = useCallback(
    (kind: CartToastState["kind"], message: string) => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      setToast({ id: Date.now(), kind, message });
      toastTimerRef.current = window.setTimeout(
        () => setToast(undefined),
        kind === "success" ? 3200 : 4200,
      );
    },
    [],
  );

  useEffect(
    () => () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    },
    [],
  );

  const handleError = useCallback(
    (caughtError: unknown, fallback: string) => {
      const message = getCartErrorMessage(caughtError, fallback);
      setError(message);
      setRequestId(getCartRequestId(caughtError));
      showToast("error", message);
    },
    [showToast],
  );

  const setAndPersistGuestCart = useCallback((nextCart: Cart) => {
    window.localStorage.setItem(
      GUEST_CART_STORAGE_KEY,
      JSON.stringify(nextCart.items),
    );
    setCart(nextCart);
  }, []);

  const getGuestCartItems = useCallback(() => readGuestCart().items, []);

  const clearGuestCart = useCallback(() => {
    const emptyGuestCart = createGuestCart([]);
    window.localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify([]));
    if (!isAuthenticated) setCart(emptyGuestCart);
  }, [isAuthenticated]);

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      refreshPromiseRef.current = null;
      setCart(readGuestCart());
      setIsLoading(false);
      clearError();
      return;
    }

    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    const request = (async () => {
      const requestedUserId = currentUser?.id;
      setIsLoading(true);
      clearError();
      try {
        const response = await getCart();
        if (authenticatedUserIdRef.current === requestedUserId) {
          setCart(response.cart);
        }
      } catch (caughtError) {
        handleError(caughtError, "Cart could not be loaded.");
        throw caughtError;
      } finally {
        setIsLoading(false);
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = request;
    return request;
  }, [clearError, currentUser?.id, handleError, isAuthenticated]);

  useEffect(() => {
    if (isAuthLoading) return;
    void refreshCart().catch(() => undefined);
  }, [currentUser?.id, isAuthLoading, refreshCart]);

  const addItemAndOpenDrawer = useCallback(
    async (payload: AddCartItemRequest, productName?: string) => {
      if (isSaving) return;
      setIsSaving(true);
      clearError();

      try {
        if (isAuthenticated) {
          const response = await addCartItem(payload);
          setCart(response.cart);
        } else {
          if (!payload.guestSnapshot) {
            throw new Error("Guest cart item details are missing.");
          }
          const current = readGuestCart();
          const existing = current.items.find(
            (item) => item.variantId === payload.variantId,
          );
          const maxQuantity = Math.max(
            1,
            Math.min(99, payload.guestSnapshot.variant.stock),
          );
          const quantity = Math.min(
            maxQuantity,
            (existing?.quantity ?? 0) + payload.quantity,
          );
          const now = new Date().toISOString();
          const item: CartItem = {
            id: payload.variantId,
            variantId: payload.variantId,
            quantity,
            currentUnitPrice: payload.guestSnapshot.unitPrice,
            currentLineTotal: payload.guestSnapshot.unitPrice * quantity,
            availableStock: payload.guestSnapshot.variant.stock,
            product: payload.guestSnapshot.product,
            variant: payload.guestSnapshot.variant,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
          };
          const items = existing
            ? current.items.map((candidate) =>
                candidate.variantId === payload.variantId ? item : candidate,
              )
            : [...current.items, item];
          setAndPersistGuestCart(createGuestCart(items));
        }

        setIsOpen(true);
        showToast(
          "success",
          productName ? `Added to cart: ${productName}` : "Added to cart",
        );
      } catch (caughtError) {
        handleError(caughtError, "This item could not be added to cart.");
        throw caughtError;
      } finally {
        setIsSaving(false);
      }
    },
    [
      clearError,
      handleError,
      isAuthenticated,
      isSaving,
      setAndPersistGuestCart,
      showToast,
    ],
  );

  const updateQuantity = useCallback(
    async (id: string, quantity: number) => {
      if (isSaving) return;
      setIsSaving(true);
      clearError();
      try {
        if (isAuthenticated) {
          const response = await updateCartItem(id, { quantity });
          setCart(response.cart);
        } else {
          const current = readGuestCart();
          const items = current.items.map((item) => {
            if (item.id !== id) return item;
            const nextQuantity = Math.max(
              1,
              Math.min(99, item.availableStock, Math.trunc(quantity)),
            );
            return {
              ...item,
              quantity: nextQuantity,
              currentLineTotal: item.currentUnitPrice * nextQuantity,
              updatedAt: new Date().toISOString(),
            };
          });
          setAndPersistGuestCart(createGuestCart(items));
        }
      } catch (caughtError) {
        handleError(caughtError, "Cart item could not be updated.");
        throw caughtError;
      } finally {
        setIsSaving(false);
      }
    },
    [clearError, handleError, isAuthenticated, isSaving, setAndPersistGuestCart],
  );

  const removeItem = useCallback(
    async (id: string) => {
      if (isSaving) return;
      setIsSaving(true);
      clearError();
      try {
        if (isAuthenticated) {
          const response = await removeCartItem(id);
          setCart(response.cart);
        } else {
          const items = readGuestCart().items.filter((item) => item.id !== id);
          setAndPersistGuestCart(createGuestCart(items));
        }
      } catch (caughtError) {
        handleError(caughtError, "Cart item could not be removed.");
        throw caughtError;
      } finally {
        setIsSaving(false);
      }
    },
    [clearError, handleError, isAuthenticated, isSaving, setAndPersistGuestCart],
  );

  const clearCart = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    clearError();
    try {
      if (isAuthenticated) {
        const response = await clearCartRequest();
        setCart(response.cart);
      } else {
        setAndPersistGuestCart(createGuestCart([]));
      }
    } catch (caughtError) {
      handleError(caughtError, "Cart could not be cleared.");
      throw caughtError;
    } finally {
      setIsSaving(false);
    }
  }, [clearError, handleError, isAuthenticated, isSaving, setAndPersistGuestCart]);

  const value = useMemo<CartContextValue>(
    () => ({
      addItemAndOpenDrawer,
      cart,
      cartCount: cart?.totalQuantity ?? 0,
      clearCart,
      clearGuestCart,
      closeCart,
      error,
      getGuestCartItems,
      isLoading,
      isOpen,
      isSaving,
      openCart,
      removeItem,
      requestId,
      refreshCart,
      updateQuantity,
    }),
    [
      addItemAndOpenDrawer,
      cart,
      clearCart,
      clearGuestCart,
      closeCart,
      error,
      getGuestCartItems,
      isLoading,
      isOpen,
      isSaving,
      openCart,
      removeItem,
      requestId,
      refreshCart,
      updateQuantity,
    ],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
      <MiniCartDrawer />
      <CartToast
        key={toast?.id}
        kind={toast?.kind}
        message={toast?.message}
        onDismiss={() => setToast(undefined)}
      />
    </CartContext.Provider>
  );
}

function createGuestCart(items: CartItem[]): Cart {
  const now = new Date().toISOString();
  return {
    id: "guest",
    userId: "guest",
    items,
    totalQuantity: items.reduce((total, item) => total + item.quantity, 0),
    estimatedSubtotal: items.reduce(
      (total, item) => total + item.currentLineTotal,
      0,
    ),
    createdAt: now,
    updatedAt: now,
  };
}

function readGuestCart(): Cart {
  try {
    const stored = window.localStorage.getItem(GUEST_CART_STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return createGuestCart([]);

    const items = parsed.filter(isStoredCartItem).map((item) => ({
      ...item,
      currentLineTotal: item.currentUnitPrice * item.quantity,
    }));
    return createGuestCart(items);
  } catch {
    return createGuestCart([]);
  }
}

function isStoredCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<CartItem>;
  return Boolean(
    typeof item.id === "string" &&
      typeof item.variantId === "string" &&
      Number.isInteger(item.quantity) &&
      Number(item.quantity) > 0 &&
      typeof item.currentUnitPrice === "number" &&
      Number.isFinite(item.currentUnitPrice) &&
      item.currentUnitPrice > 0 &&
      item.product &&
      typeof item.product.id === "string" &&
      typeof item.product.name === "string" &&
      typeof item.product.slug === "string" &&
      item.variant &&
      typeof item.variant.size === "string" &&
      typeof item.variant.color === "string" &&
      typeof item.availableStock === "number",
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider.");
  return context;
}
