"use client";

import {
  AlertCircle,
  CheckCircle2,
  ImageOff,
  Loader2,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { OutfitVariantSelector } from "@/components/ai/OutfitVariantSelector";
import styles from "@/components/ai/OutfitPreparationDrawer.module.css";
import { useCart } from "@/components/cart/CartProvider";
import type {
  PurchasableOutfit,
  PurchasableOutfitItem,
} from "@/features/ai/outfit-preparation";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { addOutfitItemsToCart } from "@/features/cart/api";
import { getProductById, getProductVariants } from "@/features/catalog/api";
import { formatPrice } from "@/features/catalog/format";
import { localizeProductName } from "@/features/catalog/localization";
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
  submitError?: string;
  variants: ProductVariant[];
  variantsLoadFailed: boolean;
}

interface OutfitCartInvalidItemDetail {
  code: string;
  productId: string;
  variantId: string;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

const PREPARATION_DRAWER_BODY_CLASS = "outfit-preparation-drawer-active";

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

const DRAWER_SUBMIT_COPY = {
  en: {
    notReady: "Complete every available product before adding the outfit.",
    pending: "Adding outfit to cart...",
    submit: "Add outfit to cart",
    submitError: "Could not add the outfit to cart. Try again.",
    unauthorized: "Your session has expired. Sign in again.",
  },
  vi: {
    notReady:
      "Vui l\u00f2ng ho\u00e0n t\u1ea5t t\u1ea5t c\u1ea3 s\u1ea3n ph\u1ea9m kh\u1ea3 d\u1ee5ng tr\u01b0\u1edbc khi th\u00eam outfit.",
    pending: "\u0110ang th\u00eam outfit v\u00e0o gi\u1ecf h\u00e0ng...",
    submit: "Th\u00eam outfit v\u00e0o gi\u1ecf h\u00e0ng",
    submitError:
      "Kh\u00f4ng th\u1ec3 th\u00eam outfit v\u00e0o gi\u1ecf h\u00e0ng. Vui l\u00f2ng th\u1eed l\u1ea1i.",
    unauthorized:
      "Phi\u00ean \u0111\u0103ng nh\u1eadp \u0111\u00e3 h\u1ebft h\u1ea1n. Vui l\u00f2ng \u0111\u0103ng nh\u1eadp l\u1ea1i.",
  },
} as const;

export function OutfitPreparationDrawer({
  isOpen,
  locale,
  onClose,
  outfit,
}: OutfitPreparationDrawerProps) {
  const copy = DRAWER_COPY[locale];
  const submitCopy = DRAWER_SUBMIT_COPY[locale];
  const router = useRouter();
  const { isAuthenticated } = useAuthSession();
  const { applyAuthoritativeCart, isSaving: isCartSaving } = useCart();
  const titleId = useId();
  const descriptionId = useId();
  const submitErrorId = useId();
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const activeSessionRef = useRef(0);
  const submitLockRef = useRef(false);
  const [items, setItems] = useState<PreparationItemState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string>();
  onCloseRef.current = onClose;

  const requestClose = useCallback(() => {
    activeSessionRef.current += 1;
    submitLockRef.current = false;
    setIsSubmitting(false);
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (!isOpen || !outfit) {
      return;
    }

    document.body.classList.add(PREPARATION_DRAWER_BODY_CLASS);

    return () => {
      document.body.classList.remove(PREPARATION_DRAWER_BODY_CLASS);
    };
  }, [isOpen, outfit]);

  useEffect(() => {
    if (!isOpen || !outfit) {
      activeSessionRef.current += 1;
      submitLockRef.current = false;
      setItems([]);
      setIsSubmitting(false);
      setSubmitError(undefined);
      return;
    }

    activeSessionRef.current += 1;
    const controller = new AbortController();
    let isActive = true;
    const initialItems = outfit.items.map(createInitialItemState);
    setItems(initialItems);
    setSubmitError(undefined);

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
  const canSubmit =
    isAuthenticated &&
    isReady &&
    !isSubmitting &&
    !isCartSaving &&
    !submitLockRef.current;
  const submitDisabledReason = !isAuthenticated
    ? submitCopy.unauthorized
    : !isReady
      ? submitCopy.notReady
      : undefined;

  function removeItem(sessionId: string) {
    setItems((current) => current.filter((item) => item.sessionId !== sessionId));
    setSubmitError(undefined);
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
          submitError: undefined,
        };
      }),
    );
    setSubmitError(undefined);
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
          submitError: undefined,
        };
      }),
    );
    setSubmitError(undefined);
  }

  async function handleSubmit() {
    if (submitLockRef.current || isSubmitting || isCartSaving) {
      return;
    }

    const readiness = getReadySubmissionItems(items);

    if (!isAuthenticated) {
      setSubmitError(submitCopy.unauthorized);
      return;
    }

    if (!readiness.isReady) {
      setSubmitError(submitCopy.notReady);
      return;
    }

    const sessionId = activeSessionRef.current;
    submitLockRef.current = true;
    setIsSubmitting(true);
    setSubmitError(undefined);
    setItems((current) =>
      current.map((item) => ({ ...item, submitError: undefined })),
    );

    try {
      const response = await addOutfitItemsToCart({
        items: readiness.items.map((item) => ({
          productId: item.productId,
          quantity: 1,
          variantId: item.variantId,
        })),
      });

      if (activeSessionRef.current !== sessionId) {
        return;
      }

      applyAuthoritativeCart(response.cart);
      requestClose();
      router.push("/checkout");
    } catch (error) {
      if (activeSessionRef.current !== sessionId) {
        return;
      }

      const mapped = mapOutfitCartErrorToItems(error, locale);
      setItems((current) =>
        applySubmitErrors(current, mapped.itemErrors, locale),
      );
      setSubmitError(
        mapped.globalError ||
          (mapped.itemErrors.length === 0
            ? getGlobalSubmitError(error, locale)
            : undefined),
      );
    } finally {
      if (activeSessionRef.current === sessionId) {
        submitLockRef.current = false;
        setIsSubmitting(false);
      }
    }
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
          {submitError ? (
            <p className={styles.submitError} id={submitErrorId} role="alert">
              <AlertCircle aria-hidden="true" size={17} />
              {submitError}
            </p>
          ) : null}
          <div className={styles.footerActions}>
            {isSubmitting ? (
              <p className={styles.submitStatus} role="status">
                <Loader2 aria-hidden="true" className={styles.spinner} size={17} />
                {submitCopy.pending}
              </p>
            ) : null}
            <button className={styles.closeButton} onClick={requestClose} type="button">
              {copy.close}
            </button>
            <button
              aria-busy={isSubmitting}
              aria-describedby={submitError ? submitErrorId : undefined}
              className={styles.submitButton}
              disabled={!canSubmit}
              onClick={() => void handleSubmit()}
              title={submitDisabledReason}
              type="button"
            >
              {isSubmitting ? (
                <Loader2 aria-hidden="true" className={styles.spinner} size={17} />
              ) : (
                <ShoppingBag aria-hidden="true" size={17} />
              )}
              {submitCopy.submit}
            </button>
          </div>
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
  const hasSubmitError = Boolean(item.submitError);
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
  const productName = localizeProductName(
    item.product?.name || item.input.productName,
    locale,
  );
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
        hasLoadError ||
        hasSubmitError ||
        isUnavailable ||
        item.staleSavedSelection ||
        needsSelection
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
        ) : item.submitError ? (
          <p className={styles.itemError} id={errorId} role="alert">
            <AlertCircle aria-hidden="true" size={17} />
            {item.submitError}
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
    !item.product?.isActive ||
    item.submitError
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

function getReadySubmissionItems(
  items: PreparationItemState[],
):
  | { isReady: true; items: Array<{ productId: string; variantId: string }> }
  | { isReady: false } {
  if (items.length === 0) {
    return { isReady: false };
  }

  const readyItems: Array<{ productId: string; variantId: string }> = [];

  for (const item of items) {
    if (!isPreparationItemReady(item) || !item.product) {
      return { isReady: false };
    }

    const selectedVariant = item.variants.find(
      (variant) =>
        variant.id === item.selectedVariantId &&
        variant.productId === item.product?.id &&
        isVariantSelectable(variant),
    );

    if (!selectedVariant) {
      return { isReady: false };
    }

    readyItems.push({
      productId: item.input.productId,
      variantId: selectedVariant.id,
    });
  }

  return { isReady: true, items: readyItems };
}

function mapOutfitCartErrorToItems(error: unknown, locale: "vi" | "en") {
  if (!(error instanceof ApiClientError)) {
    return { globalError: undefined, itemErrors: [] };
  }

  const details = parseInvalidItems(error.details);
  const mappableCodes = new Set([
    "OUTFIT_CART_INSUFFICIENT_STOCK",
    "OUTFIT_CART_PRODUCT_UNAVAILABLE",
    "OUTFIT_CART_QUANTITY_INVALID",
    "OUTFIT_CART_VARIANT_PRODUCT_MISMATCH",
    "OUTFIT_CART_VARIANT_UNAVAILABLE",
  ]);
  const itemErrors = details.filter((item) => mappableCodes.has(item.code));

  return {
    globalError:
      itemErrors.length > 0 && itemErrors.length === details.length
        ? undefined
        : getGlobalSubmitError(error, locale),
    itemErrors,
  };
}

function parseInvalidItems(details: unknown): OutfitCartInvalidItemDetail[] {
  if (!details || typeof details !== "object") {
    return [];
  }

  const invalidItems = (details as { invalidItems?: unknown }).invalidItems;

  if (!Array.isArray(invalidItems)) {
    return [];
  }

  return invalidItems.filter(
    (item): item is OutfitCartInvalidItemDetail =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof (item as { code?: unknown }).code === "string" &&
      typeof (item as { productId?: unknown }).productId === "string" &&
      typeof (item as { variantId?: unknown }).variantId === "string",
  );
}

function applySubmitErrors(
  items: PreparationItemState[],
  itemErrors: OutfitCartInvalidItemDetail[],
  locale: "vi" | "en",
) {
  return items.map((item) => {
    const error = itemErrors.find((invalidItem) =>
      matchesInvalidItem(item, invalidItem),
    );

    if (!error) {
      return item;
    }

    const shouldClearSelection =
      error.code === "OUTFIT_CART_INSUFFICIENT_STOCK" ||
      error.code === "OUTFIT_CART_QUANTITY_INVALID" ||
      error.code === "OUTFIT_CART_VARIANT_PRODUCT_MISMATCH" ||
      error.code === "OUTFIT_CART_VARIANT_UNAVAILABLE";

    return {
      ...item,
      ...(error.code === "OUTFIT_CART_PRODUCT_UNAVAILABLE"
        ? { productUnavailable: true }
        : {}),
      ...(shouldClearSelection
        ? {
            selectedColor: undefined,
            selectedSize: undefined,
            selectedVariantId: undefined,
          }
        : {}),
      submitError: getSubmitItemCopy(error.code, locale),
    };
  });
}

function matchesInvalidItem(
  item: PreparationItemState,
  invalidItem: OutfitCartInvalidItemDetail,
) {
  return (
    item.input.productId === invalidItem.productId ||
    item.selectedVariantId === invalidItem.variantId ||
    item.input.variantId === invalidItem.variantId
  );
}

function getSubmitItemCopy(code: string, locale: "vi" | "en") {
  const messages: Record<string, Record<"vi" | "en", string>> = {
    OUTFIT_CART_INSUFFICIENT_STOCK: {
      en: "There is not enough stock for this product.",
      vi: "S\u1ea3n ph\u1ea9m kh\u00f4ng c\u00f2n \u0111\u1ee7 t\u1ed3n kho.",
    },
    OUTFIT_CART_PRODUCT_UNAVAILABLE: {
      en: "This product is currently unavailable.",
      vi: "S\u1ea3n ph\u1ea9m n\u00e0y hi\u1ec7n kh\u00f4ng kh\u1ea3 d\u1ee5ng.",
    },
    OUTFIT_CART_QUANTITY_INVALID: {
      en: "The cart quantity limit has been reached for this product.",
      vi: "S\u1ed1 l\u01b0\u1ee3ng trong gi\u1ecf \u0111\u00e3 \u0111\u1ea1t gi\u1edbi h\u1ea1n cho s\u1ea3n ph\u1ea9m n\u00e0y.",
    },
    OUTFIT_CART_VARIANT_PRODUCT_MISMATCH: {
      en: "The selected option is invalid for this product. Select again.",
      vi: "L\u1ef1a ch\u1ecdn s\u1ea3n ph\u1ea9m kh\u00f4ng h\u1ee3p l\u1ec7. Vui l\u00f2ng ch\u1ecdn l\u1ea1i.",
    },
    OUTFIT_CART_VARIANT_UNAVAILABLE: {
      en: "This option is no longer available. Select another option.",
      vi: "L\u1ef1a ch\u1ecdn n\u00e0y kh\u00f4ng c\u00f2n kh\u1ea3 d\u1ee5ng. Vui l\u00f2ng ch\u1ecdn l\u1ea1i.",
    },
  };

  return messages[code]?.[locale] || DRAWER_SUBMIT_COPY[locale].submitError;
}

function getGlobalSubmitError(error: unknown, locale: "vi" | "en") {
  if (error instanceof ApiClientError) {
    if (error.status === 401 || error.code === "AUTH_REQUIRED") {
      return DRAWER_SUBMIT_COPY[locale].unauthorized;
    }
  }

  return DRAWER_SUBMIT_COPY[locale].submitError;
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
