"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Product } from "@/features/catalog/types";
import type { RecentlyViewedProduct } from "@/features/recently-viewed/types";

// MVP device-only recently viewed storage. This is not synced to any account or backend.
const RECENTLY_VIEWED_STORAGE_KEY = "belikeme.recentlyViewed.v1";
const RECENTLY_VIEWED_CHANGE_EVENT = "belikeme:recently-viewed-change";
const MAX_RECENTLY_VIEWED_ITEMS = 8;

interface RecentlyViewedChangeDetail {
  items: RecentlyViewedProduct[];
}

export function useRecentlyViewed() {
  const [items, setItems] = useState<RecentlyViewedProduct[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const itemsRef = useRef<RecentlyViewedProduct[]>([]);
  const isLoadedRef = useRef(false);

  const setLoadedItems = useCallback((nextItems: RecentlyViewedProduct[]) => {
    itemsRef.current = nextItems;
    isLoadedRef.current = true;
    setItems(nextItems);
    setIsLoaded(true);
  }, []);

  const refreshItems = useCallback(() => {
    setLoadedItems(readRecentlyViewedProducts());
  }, [setLoadedItems]);

  useEffect(() => {
    refreshItems();

    function handleStorageChange(event: StorageEvent) {
      if (event.key && event.key !== RECENTLY_VIEWED_STORAGE_KEY) {
        return;
      }

      refreshItems();
    }

    function handleRecentlyViewedChange(event: Event) {
      const detail = (event as CustomEvent<RecentlyViewedChangeDetail>).detail;

      if (Array.isArray(detail?.items)) {
        const nextItems = normalizeRecentlyViewedProducts(detail.items);

        setLoadedItems(nextItems);
        return;
      }

      refreshItems();
    }

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      RECENTLY_VIEWED_CHANGE_EVENT,
      handleRecentlyViewedChange,
    );

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        RECENTLY_VIEWED_CHANGE_EVENT,
        handleRecentlyViewedChange,
      );
    };
  }, [refreshItems, setLoadedItems]);

  const updateItems = useCallback(
    (
      updater: (
        currentItems: RecentlyViewedProduct[],
      ) => RecentlyViewedProduct[],
    ) => {
      const sourceItems = isLoadedRef.current
        ? itemsRef.current
        : readRecentlyViewedProducts();
      const nextItems = normalizeRecentlyViewedProducts(updater(sourceItems));

      setLoadedItems(nextItems);
      writeRecentlyViewedProducts(nextItems);
      emitRecentlyViewedChange(nextItems);
    },
    [setLoadedItems],
  );

  const addProduct = useCallback(
    (product: RecentlyViewedProduct) => {
      updateItems((currentItems) => {
        const viewedProduct = normalizeRecentlyViewedProduct({
          ...product,
          viewedAt: new Date().toISOString(),
        });

        if (!viewedProduct) {
          return currentItems;
        }

        return [
          viewedProduct,
          ...currentItems.filter((currentItem) => currentItem.id !== viewedProduct.id),
        ].slice(0, MAX_RECENTLY_VIEWED_ITEMS);
      });
    },
    [updateItems],
  );

  const clear = useCallback(() => {
    updateItems(() => []);
  }, [updateItems]);

  const productIds = useMemo(
    () => new Set(items.map((item) => item.id)),
    [items],
  );

  const hasProduct = useCallback(
    (id: string) => productIds.has(id),
    [productIds],
  );

  return {
    addProduct,
    clear,
    count: items.length,
    hasProduct,
    isLoaded,
    items,
  };
}

export function productToRecentlyViewedProduct(
  product: Product,
): RecentlyViewedProduct {
  return {
    categoryName: product.category.name,
    id: product.id,
    imageUrl: product.imageUrls[0],
    name: product.name,
    price: product.basePrice,
    slug: product.slug,
    viewedAt: new Date().toISOString(),
  };
}

function readRecentlyViewedProducts(): RecentlyViewedProduct[] {
  const storage = getLocalStorage();

  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(RECENTLY_VIEWED_STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    return normalizeRecentlyViewedProducts(JSON.parse(rawValue) as unknown);
  } catch {
    return [];
  }
}

function writeRecentlyViewedProducts(items: RecentlyViewedProduct[]) {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    if (items.length === 0) {
      storage.removeItem(RECENTLY_VIEWED_STORAGE_KEY);
      return;
    }

    storage.setItem(RECENTLY_VIEWED_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage can be unavailable or full; browsing should keep working.
  }
}

function emitRecentlyViewedChange(items: RecentlyViewedProduct[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<RecentlyViewedChangeDetail>(RECENTLY_VIEWED_CHANGE_EVENT, {
      detail: { items },
    }),
  );
}

function getLocalStorage(): Storage | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function normalizeRecentlyViewedProducts(value: unknown): RecentlyViewedProduct[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const products = new Map<string, RecentlyViewedProduct>();

  for (const product of value) {
    const normalizedProduct = normalizeRecentlyViewedProduct(product);

    if (normalizedProduct) {
      products.set(normalizedProduct.id, normalizedProduct);
    }
  }

  return Array.from(products.values())
    .sort(
      (firstProduct, secondProduct) =>
        Date.parse(secondProduct.viewedAt) - Date.parse(firstProduct.viewedAt),
    )
    .slice(0, MAX_RECENTLY_VIEWED_ITEMS);
}

function normalizeRecentlyViewedProduct(
  value: unknown,
): RecentlyViewedProduct | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const product = value as Partial<Record<keyof RecentlyViewedProduct, unknown>>;
  const id = readRequiredString(product.id);
  const slug = readRequiredString(product.slug);
  const name = readRequiredString(product.name);
  const price = Number(product.price);
  const viewedAt = readDateString(product.viewedAt);

  if (!id || !slug || !name || !Number.isFinite(price) || !viewedAt) {
    return undefined;
  }

  return {
    categoryName: readOptionalString(product.categoryName),
    id,
    imageUrl: readOptionalString(product.imageUrl),
    name,
    price,
    slug,
    viewedAt,
  };
}

function readDateString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return undefined;
  }

  return new Date(timestamp).toISOString();
}

function readRequiredString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  return trimmed || undefined;
}

function readOptionalString(value: unknown): string | undefined {
  return readRequiredString(value);
}
