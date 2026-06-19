"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Product } from "@/features/catalog/types";
import type { WishlistItem } from "@/features/wishlist/types";

// MVP device-only wishlist storage. This is not synced to any account or backend.
const WISHLIST_STORAGE_KEY = "belikeme.localWishlist.v1";
const WISHLIST_CHANGE_EVENT = "belikeme:wishlist-change";

interface WishlistChangeDetail {
  items: WishlistItem[];
}

export function useWishlist() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const refreshItems = useCallback(() => {
    setItems(readWishlistItems());
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    refreshItems();

    function handleStorageChange(event: StorageEvent) {
      if (event.key && event.key !== WISHLIST_STORAGE_KEY) {
        return;
      }

      refreshItems();
    }

    function handleWishlistChange(event: Event) {
      const detail = (event as CustomEvent<WishlistChangeDetail>).detail;

      if (Array.isArray(detail?.items)) {
        setItems(normalizeWishlistItems(detail.items));
        setIsLoaded(true);
        return;
      }

      refreshItems();
    }

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(WISHLIST_CHANGE_EVENT, handleWishlistChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(WISHLIST_CHANGE_EVENT, handleWishlistChange);
    };
  }, [refreshItems]);

  const itemIds = useMemo(
    () => new Set(items.map((item) => item.id)),
    [items],
  );

  const updateItems = useCallback(
    (updater: (currentItems: WishlistItem[]) => WishlistItem[]) => {
      setItems((currentItems) => {
        const sourceItems = isLoaded ? currentItems : readWishlistItems();
        const nextItems = normalizeWishlistItems(updater(sourceItems));

        writeWishlistItems(nextItems);
        emitWishlistChange(nextItems);
        setIsLoaded(true);

        return nextItems;
      });
    },
    [isLoaded],
  );

  const addItem = useCallback(
    (item: WishlistItem) => {
      updateItems((currentItems) => {
        const savedItem = normalizeWishlistItem(item);

        if (!savedItem) {
          return currentItems;
        }

        return [
          savedItem,
          ...currentItems.filter((currentItem) => currentItem.id !== savedItem.id),
        ];
      });
    },
    [updateItems],
  );

  const removeItem = useCallback(
    (id: string) => {
      updateItems((currentItems) =>
        currentItems.filter((currentItem) => currentItem.id !== id),
      );
    },
    [updateItems],
  );

  const toggleItem = useCallback(
    (item: WishlistItem) => {
      updateItems((currentItems) =>
        currentItems.some((currentItem) => currentItem.id === item.id)
          ? currentItems.filter((currentItem) => currentItem.id !== item.id)
          : [item, ...currentItems],
      );
    },
    [updateItems],
  );

  const isSaved = useCallback(
    (id: string) => itemIds.has(id),
    [itemIds],
  );

  return {
    addItem,
    count: items.length,
    isLoaded,
    isSaved,
    items,
    removeItem,
    toggleItem,
  };
}

export function productToWishlistItem(product: Product): WishlistItem {
  return {
    categoryName: product.categories?.[0]?.name || product.category.name,
    id: product.id,
    imageUrl: product.imageUrls[0],
    name: product.name,
    price: product.basePrice,
    slug: product.slug,
  };
}

function readWishlistItems(): WishlistItem[] {
  const storage = getLocalStorage();

  if (!storage) {
    return [];
  }

  try {
    const rawValue = storage.getItem(WISHLIST_STORAGE_KEY);

    if (!rawValue) {
      return [];
    }

    return normalizeWishlistItems(JSON.parse(rawValue) as unknown);
  } catch {
    return [];
  }
}

function writeWishlistItems(items: WishlistItem[]) {
  const storage = getLocalStorage();

  if (!storage) {
    return;
  }

  try {
    if (items.length === 0) {
      storage.removeItem(WISHLIST_STORAGE_KEY);
      return;
    }

    storage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage can be unavailable or full; the UI should remain usable.
  }
}

function emitWishlistChange(items: WishlistItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<WishlistChangeDetail>(WISHLIST_CHANGE_EVENT, {
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

function normalizeWishlistItems(value: unknown): WishlistItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const items = new Map<string, WishlistItem>();

  for (const item of value) {
    const normalizedItem = normalizeWishlistItem(item);

    if (normalizedItem) {
      items.set(normalizedItem.id, normalizedItem);
    }
  }

  return Array.from(items.values());
}

function normalizeWishlistItem(value: unknown): WishlistItem | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const item = value as Partial<Record<keyof WishlistItem, unknown>>;
  const id = readRequiredString(item.id);
  const slug = readRequiredString(item.slug);
  const name = readRequiredString(item.name);
  const price = Number(item.price);

  if (!id || !slug || !name || !Number.isFinite(price)) {
    return undefined;
  }

  return {
    categoryName: readOptionalString(item.categoryName),
    id,
    imageUrl: readOptionalString(item.imageUrl),
    name,
    price,
    slug,
  };
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
