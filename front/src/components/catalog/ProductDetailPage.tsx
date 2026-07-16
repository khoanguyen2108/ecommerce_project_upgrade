"use client";

import {
  AlertCircle,
  ImageOff,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { getCartErrorMessage, getCartRequestId } from "@/features/cart/errors";
import {
  getProductById,
  getProductBySlug,
  getProductVariants,
  getProductVariantsBySlug,
} from "@/features/catalog/api";
import { formatPrice } from "@/features/catalog/format";
import {
  isImplicitAccessoryOption,
  isNoSize,
  sortSizesByStandardOrder,
} from "@/features/catalog/sizes";
import {
  localizeCategoryName,
  localizeColorName,
  localizeProductDescription,
  localizeProductName,
} from "@/features/catalog/localization";
import type { Product, ProductVariant } from "@/features/catalog/types";
import {
  getOnlySelectableColor,
  getVariantUnitPrice,
  hasSelectableColor,
  hasSelectableCombination,
  isVariantSelectable,
} from "@/features/catalog/variant-selection";
import type { Locale } from "@/features/i18n/locale";
import { translate } from "@/features/i18n/translations";
import { useI18n } from "@/features/i18n/useI18n";
import { ApiClientError } from "@/lib/errors/api-error";

interface ProductDetailPageProps {
  productRef: string;
}

interface ProductDetailState {
  error?: string;
  isLoading: boolean;
  product?: Product;
  variants: ProductVariant[];
}

interface CartFeedback {
  message: string;
  requestId?: string;
}

export function ProductDetailPage({ productRef }: ProductDetailPageProps) {
  const { locale, t } = useI18n();
  const { addItemAndOpenDrawer } = useCart();
  const [state, setState] = useState<ProductDetailState>({
    isLoading: true,
    variants: [],
  });
  const [activeImage, setActiveImage] = useState<string>();
  const [selectedSize, setSelectedSize] = useState<string>();
  const [selectedColor, setSelectedColor] = useState<string>();
  const [quantity, setQuantity] = useState(1);
  const [cartFeedback, setCartFeedback] = useState<CartFeedback>();
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      setState((current) => ({ ...current, error: undefined, isLoading: true }));

      try {
        const isUuidRef = isUuid(productRef);
        const [product, variants] = await Promise.all([
          isUuidRef ? getProductById(productRef) : getProductBySlug(productRef),
          isUuidRef
            ? getProductVariants(productRef)
            : getProductVariantsBySlug(productRef),
        ]);

        if (!isMounted) {
          return;
        }

        const imageUrls = getProductImages(product);
        const initialColor = getOnlySelectableColor(variants);
        setState({ isLoading: false, product, variants });
        setActiveImage(imageUrls[0]);
        setSelectedSize(undefined);
        setSelectedColor(initialColor);
        setQuantity(1);
        setCartFeedback(undefined);
      } catch (error) {
        if (isMounted) {
          setState({
            error: getCatalogErrorMessage(error),
            isLoading: false,
            variants: [],
          });
        }
      }
    }

    void loadProduct();

    return () => {
      isMounted = false;
    };
  }, [productRef]);

  const selectableVariants = useMemo(
    () => state.variants.filter(isVariantSelectable),
    [state.variants],
  );
  const requiresSize = useMemo(
    () => state.variants.some((variant) => !isNoSize(variant.size)),
    [state.variants],
  );
  const sizes = useMemo(
    () =>
      sortSizesByStandardOrder(
        state.variants
          .map((variant) => variant.size)
          .filter((size) => !isNoSize(size)),
      ),
    [state.variants],
  );
  const colors = useMemo(
    () => Array.from(new Set(state.variants.map((variant) => variant.color))),
    [state.variants],
  );
  const isSimpleAccessory =
    state.variants.length === 1 && isImplicitAccessoryOption(state.variants[0]);
  const sizesForSelectedColor = useMemo(
    () =>
      selectedColor
        ? sortSizesByStandardOrder(
            state.variants
              .filter((variant) => variant.color === selectedColor)
              .map((variant) => variant.size),
          )
        : sizes,
    [selectedColor, sizes, state.variants],
  );
  const selectedVariant = useMemo(() => {
    if (!selectedColor) return undefined;

    if (!requiresSize) {
      return (
        state.variants.find(
          (variant) =>
            variant.color === selectedColor && isVariantSelectable(variant),
        ) || state.variants.find((variant) => variant.color === selectedColor)
      );
    }

    return state.variants.find(
      (variant) =>
        variant.size === selectedSize && variant.color === selectedColor,
    );
  }, [requiresSize, selectedColor, selectedSize, state.variants]);
  const totalStock = selectableVariants.reduce(
    (sum, variant) => sum + variant.stock,
    0,
  );
  const selectedMaxQuantity = selectedVariant
    ? Math.max(1, Math.min(99, selectedVariant.stock))
    : 1;

  useEffect(() => {
    if (quantity > selectedMaxQuantity) {
      setQuantity(selectedMaxQuantity);
    }
  }, [quantity, selectedMaxQuantity]);

  function handleSizeSelect(size: string) {
    if (
      !selectedColor ||
      !hasSelectableCombination(state.variants, selectedColor, size)
    ) {
      return;
    }

    setSelectedSize(size);
    setQuantity(1);
    setCartFeedback(undefined);
  }

  function handleColorSelect(color: string) {
    if (!hasSelectableColor(state.variants, color)) {
      return;
    }

    setSelectedColor(color);
    if (
      selectedSize &&
      !hasSelectableCombination(state.variants, color, selectedSize)
    ) {
      setSelectedSize(undefined);
    }
    setQuantity(1);
    setCartFeedback(undefined);
  }

  function handleQuantityChange(value: number) {
    if (!Number.isFinite(value)) {
      setQuantity(1);
      return;
    }

    setQuantity(Math.max(1, Math.min(selectedMaxQuantity, Math.trunc(value))));
  }

  async function handleAddToCart() {
    if (!state.product) {
      return;
    }

    if (!selectedVariant || !isVariantSelectable(selectedVariant)) {
      return;
    }

    setIsAddingToCart(true);
    setCartFeedback(undefined);

    try {
      await addItemAndOpenDrawer(
        { quantity, variantId: selectedVariant.id },
        productName,
      );
    } catch (error) {
      setCartFeedback({
        message: getCartErrorMessage(
          error,
          t("product.addError"),
        ),
        requestId: getCartRequestId(error),
      });
    } finally {
      setIsAddingToCart(false);
    }
  }

  if (state.isLoading) {
    return (
      <main className="product-detail-page">
        <div className="product-detail-shell">
          <div className="product-detail-skeleton" aria-hidden="true" />
          <div className="product-detail-copy" aria-hidden="true">
            <div className="detail-line detail-line--wide" />
            <div className="detail-line" />
            <div className="detail-line detail-line--short" />
          </div>
        </div>
      </main>
    );
  }

  if (state.error || !state.product) {
    return (
      <main className="product-detail-page">
        <div className="catalog-error" role="alert">
          <AlertCircle size={20} />
          <span>
            {state.error ||
              t("product.loadError")}
          </span>
        </div>
        <Link className="button button--secondary" href="/products">
          {t("catalog.backToProducts")}
        </Link>
      </main>
    );
  }

  const product = state.product;
  const imageUrls = getProductImages(product);
  const categories = getProductCategories(product);
  const productName = localizeProductName(product.name, locale);
  const productDescription =
    localizeProductDescription(product.description, locale) ||
    t("product.descriptionPending");
  const displayPrice = selectedVariant
    ? getVariantUnitPrice(product, selectedVariant)
    : product.basePrice;
  const hasValidSelection = Boolean(
    selectedColor &&
      (!requiresSize || selectedSize) &&
      isVariantSelectable(selectedVariant),
  );
  const hasValidQuantity = Boolean(
    selectedVariant &&
      hasValidSelection &&
      Number.isInteger(quantity) &&
      quantity >= 1 &&
      quantity <= selectedVariant.stock,
  );
  const addToCartDisabled =
    isAddingToCart ||
    !hasValidSelection ||
    !hasValidQuantity;
  const selectionMessage = getSelectionMessage({
    requiresSize,
    selectedColor,
    selectedSize,
    totalStock,
    locale,
  });

  return (
    <main className="product-detail-page">
      <section className="product-detail-shell" aria-labelledby="product-heading">
        <div className="product-gallery">
          <div className="product-gallery__main">
            <ProductImage
              alt={productName}
              key={activeImage || "product-fallback"}
              url={activeImage}
            />
          </div>

          {imageUrls.length > 1 ? (
            <div className="product-gallery__thumbs" aria-label={t("product.productImages")}>
              {imageUrls.map((imageUrl, index) => (
                <button
                  aria-label={`${t("product.view")}: ${productName}, ${index + 1}`}
                  aria-pressed={imageUrl === activeImage}
                  className={imageUrl === activeImage ? "is-active" : undefined}
                  key={`${imageUrl}-${index}`}
                  onClick={() => setActiveImage(imageUrl)}
                  type="button"
                >
                  <ProductImage alt="" url={imageUrl} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="product-detail-copy">
          <div className="product-detail-copy__topline">
            <div className="product-detail-copy__categories">
              {categories.map((category) => (
                <Link href={getCategoryProductsHref(category.slug)} key={category.id}>
                  {localizeCategoryName(category.name, locale)}
                </Link>
              ))}
            </div>
          </div>

          <div className="product-detail-copy__heading">
            <h1 id="product-heading">{productName}</h1>
            <p className="product-detail-copy__price">{formatPrice(displayPrice)}</p>
          </div>

          <p className="product-detail-copy__description">
            {productDescription}
          </p>

          {isSimpleAccessory ? null : (
            <section className="variant-panel" aria-labelledby="variants-heading">
            <div className="product-option-heading">
              <h2 id="variants-heading">{t("product.color")}</h2>
            </div>
            <div className="variant-choice-list">
              {colors.map((color) => {
                const isAvailable = hasSelectableColor(state.variants, color);

                return (
                  <button
                    aria-pressed={color === selectedColor}
                    className={color === selectedColor ? "is-selected" : undefined}
                    disabled={!isAvailable}
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    type="button"
                  >
                    {localizeColorName(color, locale)}
                  </button>
                );
              })}
            </div>

            {requiresSize ? (
              <>
                <div className="product-option-heading product-option-heading--secondary">
                  <h2>{t("product.size")}</h2>
                </div>
                <div className="variant-choice-list">
                  {sizesForSelectedColor.map((size) => {
                    const isAvailable = Boolean(
                      selectedColor &&
                        hasSelectableCombination(state.variants, selectedColor, size),
                    );

                    return (
                      <button
                        aria-pressed={size === selectedSize}
                        className={size === selectedSize ? "is-selected" : undefined}
                        disabled={!isAvailable}
                        key={size}
                        onClick={() => handleSizeSelect(size)}
                        type="button"
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="product-selection-hint">{t("product.noSize")}</p>
            )}

            {state.variants.length === 0 ? (
              <p className="product-selection-hint">{t("product.noVariants")}</p>
            ) : (
              <p className="product-selection-hint">{selectionMessage}</p>
            )}
            </section>
          )}

          <section className="quantity-panel" aria-labelledby="quantity-heading">
            <div>
              <h2 id="quantity-heading">{t("product.quantity")}</h2>
              <p>
                {getQuantityAvailabilityMessage({
                  hasValidSelection,
                  isSimpleAccessory,
                  requiresSize,
                  selectedVariant,
                  totalStock,
                  locale,
                })}
              </p>
            </div>
            <div className="quantity-stepper">
              <button
                aria-label={t("product.decreaseQuantity")}
                disabled={!hasValidSelection || quantity <= 1}
                onClick={() => handleQuantityChange(quantity - 1)}
                type="button"
              >
                <Minus aria-hidden="true" size={15} />
              </button>
              <input
                aria-label={t("product.cartQuantity")}
                disabled={!hasValidSelection}
                max={selectedMaxQuantity}
                min={1}
                onChange={(event) => handleQuantityChange(Number(event.target.value))}
                type="number"
                value={quantity}
              />
              <button
                aria-label={t("product.increaseQuantity")}
                disabled={!hasValidSelection || quantity >= selectedMaxQuantity}
                onClick={() => handleQuantityChange(quantity + 1)}
                type="button"
              >
                <Plus aria-hidden="true" size={15} />
              </button>
            </div>
          </section>

          {cartFeedback ? (
            <div className="customer-feedback customer-feedback--error" role="alert">
              <AlertCircle aria-hidden="true" size={19} />
              <span>{cartFeedback.message}</span>
              {cartFeedback.requestId ? (
                <small>Request {cartFeedback.requestId}</small>
              ) : null}
            </div>
          ) : null}

          <div className="product-detail-actions">
            <button
              className="button button--primary button--full"
              disabled={addToCartDisabled}
              onClick={handleAddToCart}
              type="button"
            >
              {isAddingToCart ? (
                <Loader2 aria-hidden="true" className="spin" size={17} />
              ) : (
                <ShoppingBag aria-hidden="true" size={17} />
              )}
              {getAddToCartLabel({
                isAddingToCart,
                requiresSize,
                selectedVariant,
                totalStock,
                locale,
              })}
            </button>
          </div>

        </div>
      </section>
    </main>
  );
}

function ProductImage({ alt, url }: { alt: string; url?: string }) {
  const { t } = useI18n();
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    setHasFailed(false);
  }, [url]);

  if (!url || hasFailed) {
    return (
      <div className="product-image-fallback">
        <ImageOff aria-hidden="true" size={28} strokeWidth={1.4} />
        <span>{t("common.imageUnavailable")}</span>
      </div>
    );
  }

  return <img alt={alt} onError={() => setHasFailed(true)} src={url} />;
}

function getProductImages(product: Product): string[] {
  return Array.from(
    new Set(product.imageUrls.map((imageUrl) => imageUrl.trim()).filter(Boolean)),
  ).slice(0, 4);
}

function getProductCategories(product: Product) {
  return product.categories?.length ? product.categories : [product.category];
}

function getCatalogErrorMessage(error: unknown): string {
  return error instanceof ApiClientError
    ? error.message
    : "";
}

function getCategoryProductsHref(slug: string): string {
  return `/products?categorySlug=${encodeURIComponent(slug)}`;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getQuantityAvailabilityMessage({
  hasValidSelection,
  isSimpleAccessory,
  requiresSize,
  selectedVariant,
  totalStock,
  locale,
}: {
  hasValidSelection: boolean;
  isSimpleAccessory: boolean;
  requiresSize: boolean;
  selectedVariant?: ProductVariant;
  totalStock: number;
  locale: Locale;
}): string {
  if (isSimpleAccessory) {
    if (totalStock === 0) return translate(locale, "product.outOfStock");
    if (totalStock <= 5) {
      return `${totalStock} ${translate(locale, "product.onlyLeft")}`;
    }
    return translate(locale, "product.inStock");
  }

  if (hasValidSelection && selectedVariant) {
    return `${selectedVariant.stock} ${translate(locale, "product.availableForOption")}`;
  }

  return requiresSize
    ? translate(locale, "product.completeSelection")
    : translate(locale, "product.selectColorFirst");
}

function getSelectionMessage({
  requiresSize,
  selectedColor,
  selectedSize,
  totalStock,
  locale,
}: {
  requiresSize: boolean;
  selectedColor?: string;
  selectedSize?: string;
  totalStock: number;
  locale: Locale;
}): string {
  if (totalStock === 0) {
    return translate(locale, "product.currentlyOutOfStock");
  }

  if (!selectedColor) {
    return requiresSize
      ? translate(locale, "product.chooseColorForSizes")
      : translate(locale, "product.chooseColor");
  }

  if (requiresSize && !selectedSize) {
    return translate(locale, "product.chooseSize");
  }

  return requiresSize
    ? translate(locale, "product.colorSizeAvailable")
    : translate(locale, "product.colorAvailable");
}

function getAddToCartLabel({
  isAddingToCart,
  requiresSize,
  selectedVariant,
  totalStock,
  locale,
}: {
  isAddingToCart: boolean;
  requiresSize: boolean;
  selectedVariant?: ProductVariant;
  totalStock: number;
  locale: Locale;
}): string {
  if (isAddingToCart) {
    return translate(locale, "product.adding");
  }

  if (totalStock === 0) {
    return translate(locale, "product.outOfStock");
  }

  if (!isVariantSelectable(selectedVariant)) {
    return requiresSize
      ? translate(locale, "product.selectColorSize")
      : translate(locale, "product.selectColor");
  }

  return translate(locale, "product.addToCart");
}
