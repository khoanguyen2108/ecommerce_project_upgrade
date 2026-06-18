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
import {
  getCartErrorMessage,
  getCartRequestId,
} from "@/features/cart/errors";
import type { AddCartItemRequest, Cart } from "@/features/cart/types";

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
  error?: string;
  isLoading: boolean;
  isOpen: boolean;
  isSaving: boolean;
  openCart: () => void;
  removeItem: (id: string) => Promise<void>;
  requestId?: string;
  refreshCart: () => Promise<void>;
  addItemAndOpenDrawer: (
    payload: AddCartItemRequest,
    productName?: string,
  ) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const {
    currentUser,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuthSession();
  const [cart, setCart] = useState<Cart>();
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [toast, setToast] = useState<CartToastState>();
  const refreshPromiseRef = useRef<Promise<void> | null>(null);
  const toastTimerRef = useRef<number | undefined>(undefined);

  const clearError = useCallback(() => {
    setError(undefined);
    setRequestId(undefined);
  }, []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const openCart = useCallback(() => setIsOpen(true), []);

  const showToast = useCallback(
    (kind: CartToastState["kind"], message: string) => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }

      setToast({ id: Date.now(), kind, message });
      toastTimerRef.current = window.setTimeout(() => {
        setToast(undefined);
      }, kind === "success" ? 3200 : 4200);
    },
    [],
  );

  useEffect(
    () => () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
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

  const refreshCart = useCallback(async () => {
    if (!isAuthenticated) {
      setCart(undefined);
      setIsLoading(false);
      return;
    }

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const request = (async () => {
      setIsLoading(true);
      clearError();

      try {
        const response = await getCart();
        setCart(response.cart);
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
  }, [clearError, handleError, isAuthenticated]);

  useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!isAuthenticated) {
      setCart(undefined);
      setIsLoading(false);
      setIsOpen(false);
      clearError();
      return;
    }

    void refreshCart().catch(() => undefined);
  }, [clearError, currentUser?.id, isAuthenticated, isAuthLoading, refreshCart]);

  const addItemAndOpenDrawer = useCallback(
    async (payload: AddCartItemRequest, productName?: string) => {
      if (isSaving) {
        return;
      }

      setIsSaving(true);
      clearError();

      try {
        const response = await addCartItem(payload);
        setCart(response.cart);
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
    [clearError, handleError, isSaving, showToast],
  );

  const updateQuantity = useCallback(
    async (id: string, quantity: number) => {
      if (isSaving) {
        return;
      }

      setIsSaving(true);
      clearError();

      try {
        const response = await updateCartItem(id, { quantity });
        setCart(response.cart);
      } catch (caughtError) {
        handleError(caughtError, "Cart item could not be updated.");
        throw caughtError;
      } finally {
        setIsSaving(false);
      }
    },
    [clearError, handleError, isSaving],
  );

  const removeItem = useCallback(
    async (id: string) => {
      if (isSaving) {
        return;
      }

      setIsSaving(true);
      clearError();

      try {
        const response = await removeCartItem(id);
        setCart(response.cart);
      } catch (caughtError) {
        handleError(caughtError, "Cart item could not be removed.");
        throw caughtError;
      } finally {
        setIsSaving(false);
      }
    },
    [clearError, handleError, isSaving],
  );

  const clearCart = useCallback(async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    clearError();

    try {
      const response = await clearCartRequest();
      setCart(response.cart);
    } catch (caughtError) {
      handleError(caughtError, "Cart could not be cleared.");
      throw caughtError;
    } finally {
      setIsSaving(false);
    }
  }, [clearError, handleError, isSaving]);

  const value = useMemo<CartContextValue>(
    () => ({
      addItemAndOpenDrawer,
      cart,
      cartCount: cart?.totalQuantity ?? 0,
      clearCart,
      closeCart,
      error,
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
      closeCart,
      error,
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

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used within CartProvider.");
  }

  return context;
}
