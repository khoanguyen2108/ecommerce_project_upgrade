"use client";

import { AlertCircle, CheckCircle2, ImageOff, Loader2, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { OutfitVariantSelector } from "@/components/ai/OutfitVariantSelector";
import styles from "@/components/ai/OutfitPreparationDrawer.module.css";
import type {
  PurchasableOutfit,
  PurchasableOutfitItem,
} from "@/features/ai/outfit-preparation";
import { getProductById, getProductVariants } from "@/features/catalog/api";
import { formatPrice } from "@/features/catalog/format";
import type { Product, ProductVariant } from "@/features/catalog/types";
import {
  getImplicitSelectableVariant,
  getVariantUnitPrice,
  hasSelectableCombination,
  isVariantSelectable,
  productRequiresSize,
  resolveSelectedVariant,
} from "@/features/catalog/variant-selection";
import { ApiClientError } from "@/lib/errors/api-error";

interface OutfitPreparationDrawerProps {
  isOpen: boolean;
  locale: "vi" | "en";
  onClose: () => void;
  outfit?: PurchasableOutfit;
}

interface PreparationItemState {
  input: PurchasableOutfitItem;
  isLoadingProduct: boolean;
  isLoadingVariants: boolean;
  product?: Product;
  productLoadFailed: boolean;
  productUnavailable: boolean;
  selectedColor?: string;
  selectedSize?: string;
  selectedVariantId?: string;
  sessionId: string;
  staleSavedSelection: boolean;
  variants: ProductVariant[];
  variantsLoadFailed: boolean;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const DRAWER_COPY = {
  en: {
    basePrice: "Base price",
    close: "Close",
    closeAria: "Close outfit preparation",
    empty: "No products remain in this outfit.",
    loadError: "Could not load options for this product.",
    loading: "Loading product options",
    outOfStock: "This product has no in-stock options.",
    prepare: "Prepare outfit",
    priceChanged: "The current price has changed from the saved outfit.",
    productUnavailable: "This product is currently unavailable.",
    remove: "Remove item",
    removeAria: (name: string) => `Remove ${name} from this preparation`,
    ready: "The outfit is ready to be added to cart.",
    select: "Select a color and size.",
    stale: "The saved selection is no longer available. Select another option.",
    unitPrice: "Current price",
  },
  vi: {
    basePrice: "Giá cơ bản",
    close: "Đóng",
    closeAria: "Đóng phần chuẩn bị outfit",
    empty: "Outfit không còn sản phẩm nào để tiếp tục.",
    loadError: "Không thể tải lựa chọn cho sản phẩm này.",
    loading: "Đang tải lựa chọn sản phẩm",
    outOfStock: "Sản phẩm này hiện không còn tùy chọn nào còn hàng.",
    prepare: "Chuẩn bị outfit",
    priceChanged: "Giá hiện tại đã thay đổi so với outfit đã lưu.",
    productUnavailable: "Sản phẩm này hiện không khả dụng.",
    remove: "Bỏ sản phẩm",
    removeAria: (name: string) => `Bỏ ${name} khỏi phần chuẩn bị outfit`,
    ready: "Outfit đã sẵn sàng để thêm vào giỏ hàng.",
    select: "Vui lòng chọn màu và kích thước.",
    stale: "Lựa chọn đã lưu không còn khả dụng. Vui lòng chọn lại.",
    unitPrice: "Giá hiện tại",
  },
} as const;

export function OutfitPreparationDrawer({
  isOpen,
  locale,
  onClose,
  outfit,
}: OutfitPreparationDrawerProps) {
  const copy = DRAWER_COPY[locale];
  const titleId = useId();
  const descriptionId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const [items, setItems] = useState<PreparationItemState[]>([]);
  onCloseRef.current = onClose;

  const requestClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (!isOpen || !outfit) {
      setItems([]);
      return;
    }

    const controller = new AbortController();
    let isActive = true;
    const initialItems = outfit.items.map(createInitialItemState);
    setItems(initialItems);

    const requests = new Map<
      string,
      Promise<
        [PromiseSettledResult<Product>, PromiseSettledResult<ProductVariant[]>]
      >
    >();

    for (const input of outfit.items) {
      if (!requests.has(input.productId)) {
        requests.set(
          input.productId,
          Promise.allSettled([
            getProductById(input.productId, { signal: controller.signal }),
            getProductVariants(input.productId, { signal: controller.signal }),
          ]),
        );
      }
    }

    for (const [productId, request] of requests) {
      void request.then(([productResult, variantsResult]) => {
        if (!isActive) {
          return;
        }

        setItems((current) =>
          current.map((item) =>
            item.input.productId === productId
              ? applyCatalogResult(item, productResult, variantsResult)
              : item,
          ),
        );
      });
    }

    return () => {
      isActive = false;
      controller.abort();
    };
  }, [isOpen, outfit]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) {
        return;
      }

      const focusable = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );

      if (focusable.length === 0) {
        event.preventDefault();
        drawerRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, requestClose]);

  if (!isOpen || !outfit) {
    return null;
  }

  const isReady =
    items.length > 0 && items.every((item) => isPreparationItemReady(item));

  function removeItem(sessionId: string) {
    setItems((current) => current.filter((item) => item.sessionId !== sessionId));
  }

  function selectColor(sessionId: string, color: string) {
    setItems((current) =>
      current.map((item) => {
        if (item.sessionId !== sessionId) {
          return item;
        }

        const keepSize = Boolean(
          item.selectedSize &&
            hasSelectableCombination(item.variants, color, item.selectedSize),
        );
        const selectedSize = keepSize ? item.selectedSize : undefined;
        const selectedVariant = resolveSelectedVariant({
          color,
          size: selectedSize,
          variants: item.variants,
        });

        return {
          ...item,
          selectedColor: color,
          selectedSize,
          selectedVariantId: selectedVariant?.id,
          staleSavedSelection: false,
        };
      }),
    );
  }

  function selectSize(sessionId: string, size: string) {
    setItems((current) =>
      current.map((item) => {
        if (item.sessionId !== sessionId || !item.selectedColor) {
          return item;
        }

        const selectedVariant = resolveSelectedVariant({
          color: item.selectedColor,
          size,
          variants: item.variants,
        });

        return {
          ...item,
          selectedSize: size,
          selectedVariantId: selectedVariant?.id,
          staleSavedSelection: false,
        };
      }),
    );
  }

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <aside
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={styles.drawer}
        ref={drawerRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div>
            <h2 id={titleId}>{copy.prepare}</h2>
            <p id={descriptionId}>{outfit.summary}</p>
          </div>
          <button
            aria-label={copy.closeAria}
            className={styles.iconButton}
            onClick={requestClose}
            ref={closeButtonRef}
            type="button"
          >
            <X aria-hidden="true" size={21} />
          </button>
        </header>

        <div className={styles.body}>
          {items.length === 0 ? (
            <div className={styles.emptyState} role="status">
              <ImageOff aria-hidden="true" size={30} />
              <p>{copy.empty}</p>
            </div>
          ) : (
            <div className={styles.itemList}>
              {items.map((item) => (
                <PreparationItem
                  item={item}
                  isSavedOutfit={outfit.source === "saved"}
                  key={item.sessionId}
                  locale={locale}
                  onColorChange={(color) => selectColor(item.sessionId, color)}
                  onRemove={() => removeItem(item.sessionId)}
                  onSizeChange={(size) => selectSize(item.sessionId, size)}
                />
              ))}
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          {isReady ? (
            <p className={styles.readyStatus} role="status">
              <CheckCircle2 aria-hidden="true" size={19} />
              {copy.ready}
            </p>
          ) : null}
          <button className={styles.closeButton} onClick={requestClose} type="button">
            {copy.close}
          </button>
        </footer>
      </aside>
    </div>
  );
}

function PreparationItem({
  item,
  isSavedOutfit,
  locale,
  onColorChange,
  onRemove,
  onSizeChange,
}: {
  item: PreparationItemState;
  isSavedOutfit: boolean;
  locale: "vi" | "en";
  onColorChange: (color: string) => void;
  onRemove: () => void;
  onSizeChange: (size: string) => void;
}) {
  const copy = DRAWER_COPY[locale];
  const errorId = `${item.sessionId.replace(/[^a-zA-Z0-9_-]/g, "-")}-error`;
  const isLoading = item.isLoadingProduct || item.isLoadingVariants;
  const hasLoadError = item.productLoadFailed || item.variantsLoadFailed;
  const selectableVariants = item.variants.filter(isVariantSelectable);
  const isUnavailable = Boolean(
    !isLoading &&
      (hasLoadError ||
        item.productUnavailable ||
        !item.product?.isActive ||
        selectableVariants.length === 0),
  );
  const selectedVariant = item.variants.find(
    (variant) =>
      variant.id === item.selectedVariantId &&
      variant.productId === item.input.productId &&
      isVariantSelectable(variant),
  );
  const productName = item.product?.name || item.input.productName;
  const liveImage = item.product ? getFirstProductImage(item.product) : undefined;
  const imageUrl = item.product ? liveImage : item.input.imageUrl;
  const currentPrice = item.product
    ? selectedVariant
      ? getVariantUnitPrice(item.product, selectedVariant)
      : item.product.basePrice
    : item.input.snapshotPrice;
  const priceChanged = Boolean(
    isSavedOutfit &&
      selectedVariant &&
      item.input.snapshotPrice !== undefined &&
      currentPrice !== item.input.snapshotPrice,
  );
  const needsSelection =
    !isLoading && !isUnavailable && !isVariantSelectable(selectedVariant);

  return (
    <article
      aria-describedby={
        hasLoadError || isUnavailable || item.staleSavedSelection || needsSelection
          ? errorId
          : undefined
      }
      className={styles.item}
    >
      <PreparationImage name={productName} url={imageUrl} />
      <div className={styles.itemBody}>
        <div className={styles.itemHeading}>
          <div>
            <span className={styles.roleBadge}>{formatRole(item.input.role, locale)}</span>
            <h3>{productName}</h3>
          </div>
          <button
            aria-label={copy.removeAria(productName)}
            className={styles.removeButton}
            onClick={onRemove}
            type="button"
          >
            <Trash2 aria-hidden="true" size={15} />
            {copy.remove}
          </button>
        </div>

        {currentPrice !== undefined ? (
          <p className={styles.price}>
            <span>{selectedVariant ? copy.unitPrice : copy.basePrice}</span>
            <strong>{formatPrice(currentPrice)}</strong>
          </p>
        ) : null}

        {isLoading ? (
          <p className={styles.loadingStatus} role="status">
            <Loader2 aria-hidden="true" className={styles.spinner} size={17} />
            {copy.loading}
          </p>
        ) : null}

        {!isLoading && !isUnavailable ? (
          <OutfitVariantSelector
            locale={locale}
            onColorChange={onColorChange}
            onSizeChange={onSizeChange}
            productName={productName}
            selectedColor={item.selectedColor}
            selectedSize={item.selectedSize}
            selectedVariantId={item.selectedVariantId}
            variants={item.variants}
          />
        ) : null}

        {hasLoadError ? (
          <p className={styles.itemError} id={errorId} role="alert">
            <AlertCircle aria-hidden="true" size={17} />
            {copy.loadError}
          </p>
        ) : !isLoading && isUnavailable ? (
          <p className={styles.itemError} id={errorId} role="alert">
            <AlertCircle aria-hidden="true" size={17} />
            {selectableVariants.length === 0 && item.product
              ? copy.outOfStock
              : copy.productUnavailable}
          </p>
        ) : item.staleSavedSelection ? (
          <p className={styles.itemWarning} id={errorId} role="alert">
            {copy.stale}
          </p>
        ) : needsSelection ? (
          <p className={styles.itemHint} id={errorId}>
            {copy.select}
          </p>
        ) : null}

        {priceChanged ? (
          <p className={styles.priceNotice} role="status">
            {copy.priceChanged}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function PreparationImage({ name, url }: { name: string; url?: string }) {
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    setHasFailed(false);
  }, [url]);

  if (!url || hasFailed) {
    return (
      <div aria-label={`${name}: image unavailable`} className={styles.imageFallback} role="img">
        <ImageOff aria-hidden="true" size={25} />
        <span>BELIKEME</span>
      </div>
    );
  }

  return <img alt={name} className={styles.image} onError={() => setHasFailed(true)} src={url} />;
}

function createInitialItemState(
  input: PurchasableOutfitItem,
  index: number,
): PreparationItemState {
  return {
    input,
    isLoadingProduct: true,
    isLoadingVariants: true,
    productLoadFailed: false,
    productUnavailable: false,
    sessionId: `${input.role}-${input.productId}-${index}`,
    staleSavedSelection: false,
    variants: [],
    variantsLoadFailed: false,
  };
}

function applyCatalogResult(
  item: PreparationItemState,
  productResult: PromiseSettledResult<Product>,
  variantsResult: PromiseSettledResult<ProductVariant[]>,
): PreparationItemState {
  const product =
    productResult.status === "fulfilled" &&
    productResult.value.id === item.input.productId &&
    productResult.value.isActive
      ? productResult.value
      : undefined;
  const productUnavailable =
    (productResult.status === "fulfilled" && !product) ||
    (productResult.status === "rejected" &&
      productResult.reason instanceof ApiClientError &&
      productResult.reason.status === 404);
  const variants =
    variantsResult.status === "fulfilled" &&
    Array.isArray(variantsResult.value)
      ? variantsResult.value.filter(
          (variant) => variant.productId === item.input.productId,
        )
      : [];
  const savedVariant = item.input.variantId
    ? variants.find(
        (variant) =>
          variant.id === item.input.variantId && isVariantSelectable(variant),
      )
    : undefined;
  const implicitVariant = savedVariant
    ? undefined
    : getImplicitSelectableVariant(variants);
  const selectedVariant = savedVariant || implicitVariant;

  return {
    ...item,
    isLoadingProduct: false,
    isLoadingVariants: false,
    product,
    productLoadFailed: !product && !productUnavailable,
    productUnavailable,
    selectedColor: selectedVariant?.color,
    selectedSize:
      selectedVariant && productRequiresSize(variants)
        ? selectedVariant.size
        : undefined,
    selectedVariantId: selectedVariant?.id,
    staleSavedSelection: Boolean(item.input.variantId && !savedVariant),
    variants,
    variantsLoadFailed:
      (variantsResult.status === "rejected" ||
        !Array.isArray(variantsResult.value)) &&
      !productUnavailable,
  };
}

function isPreparationItemReady(item: PreparationItemState): boolean {
  if (
    item.isLoadingProduct ||
    item.isLoadingVariants ||
    item.productLoadFailed ||
    item.productUnavailable ||
    item.variantsLoadFailed ||
    !item.product?.isActive
  ) {
    return false;
  }

  return Boolean(
    item.variants.some(
      (variant) =>
        variant.id === item.selectedVariantId &&
        variant.productId === item.product?.id &&
        isVariantSelectable(variant),
    ),
  );
}

function getFirstProductImage(product: Product): string | undefined {
  return product.imageUrls.find((imageUrl) => imageUrl.trim())?.trim();
}

function formatRole(
  role: PurchasableOutfitItem["role"],
  locale: "vi" | "en",
): string {
  const labels: Record<
    PurchasableOutfitItem["role"],
    Record<"vi" | "en", string>
  > = {
    accessory: { en: "Accessory", vi: "Phụ kiện" },
    bottom: { en: "Bottom", vi: "Quần" },
    handbag: { en: "Bag", vi: "Túi" },
    jacket: { en: "Jacket", vi: "Áo khoác" },
    shoes: { en: "Shoes", vi: "Giày" },
    top: { en: "Top", vi: "Áo" },
  };

  return labels[role][locale];
}
