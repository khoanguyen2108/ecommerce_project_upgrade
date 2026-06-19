"use client";

import {
  AlertCircle,
  Check,
  ImageOff,
  Loader2,
  Minus,
  Plus,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { RecentlyViewedProducts } from "@/components/recently-viewed/RecentlyViewedProducts";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { getCartErrorMessage, getCartRequestId } from "@/features/cart/errors";
import {
  getProductById,
  getProductBySlug,
  getProductVariants,
  getProductVariantsBySlug,
} from "@/features/catalog/api";
import { formatPrice } from "@/features/catalog/format";
import type { Product, ProductVariant } from "@/features/catalog/types";
import {
  productToRecentlyViewedProduct,
  useRecentlyViewed,
} from "@/features/recently-viewed/useRecentlyViewed";
import { productToWishlistItem } from "@/features/wishlist/useWishlist";
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
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthSession();
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
  const { addProduct: addRecentlyViewedProduct } = useRecentlyViewed();

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
        setState({ isLoading: false, product, variants });
        setActiveImage(imageUrls[0]);
        setSelectedSize(undefined);
        setSelectedColor(undefined);
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

  useEffect(() => {
    if (state.product) {
      addRecentlyViewedProduct(productToRecentlyViewedProduct(state.product));
    }
  }, [addRecentlyViewedProduct, state.product]);

  const selectableVariants = useMemo(
    () => state.variants.filter(isVariantSelectable),
    [state.variants],
  );
  const sizes = useMemo(
    () => Array.from(new Set(state.variants.map((variant) => variant.size))),
    [state.variants],
  );
  const colors = useMemo(
    () => Array.from(new Set(state.variants.map((variant) => variant.color))),
    [state.variants],
  );
  const selectedVariant = useMemo(
    () =>
      state.variants.find(
        (variant) =>
          variant.size === selectedSize && variant.color === selectedColor,
      ),
    [selectedColor, selectedSize, state.variants],
  );
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
    if (!hasSelectableSize(state.variants, size)) {
      return;
    }

    setSelectedSize(size);
    if (!hasSelectableCombination(state.variants, size, selectedColor)) {
      setSelectedColor(undefined);
    }
    setQuantity(1);
    setCartFeedback(undefined);
  }

  function handleColorSelect(color: string) {
    if (!selectedSize || !hasSelectableCombination(state.variants, selectedSize, color)) {
      return;
    }

    setSelectedColor(color);
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

    if (!isAuthenticated) {
      router.push(
        `/login?next=${encodeURIComponent(getProductReturnPath(state.product))}`,
      );
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
        state.product.name,
      );
    } catch (error) {
      setCartFeedback({
        message: getCartErrorMessage(
          error,
          "This item could not be added to cart.",
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
              "This product could not be loaded. Please return to the catalog."}
          </span>
        </div>
        <Link className="button button--secondary" href="/products">
          Back to products
        </Link>
      </main>
    );
  }

  const product = state.product;
  const imageUrls = getProductImages(product);
  const categories = getProductCategories(product);
  const wishlistItem = productToWishlistItem(product);
  const displayPrice = selectedVariant
    ? getVariantUnitPrice(product, selectedVariant)
    : product.basePrice;
  const hasValidSelection = isVariantSelectable(selectedVariant);
  const addToCartDisabled =
    isAuthLoading ||
    isAddingToCart ||
    (isAuthenticated && !hasValidSelection);
  const selectionMessage = getSelectionMessage({
    selectedColor,
    selectedSize,
    totalStock,
  });

  return (
    <main className="product-detail-page">
      <section className="product-detail-shell" aria-labelledby="product-heading">
        <div className="product-gallery">
          <div className="product-gallery__main">
            <ProductImage
              alt={product.name}
              key={activeImage || "product-fallback"}
              url={activeImage}
            />
          </div>

          {imageUrls.length > 1 ? (
            <div className="product-gallery__thumbs" aria-label="Product images">
              {imageUrls.map((imageUrl, index) => (
                <button
                  aria-label={`View ${product.name} image ${index + 1}`}
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
                <Link href={`/categories/${category.slug}`} key={category.id}>
                  {category.name}
                </Link>
              ))}
            </div>
            <span className="product-status">
              <Check aria-hidden="true" size={14} />
              {product.isActive ? "Active" : "Inactive"}
            </span>
          </div>

          <div className="product-detail-copy__heading">
            <h1 id="product-heading">{product.name}</h1>
            <p className="product-detail-copy__price">{formatPrice(displayPrice)}</p>
          </div>

          <p className="product-detail-copy__description">
            {product.description || "Product details are being prepared for this item."}
          </p>

          <div className="stock-summary" role="status">
            <span>{totalStock > 0 ? "Available" : "Out of stock"}</span>
            <strong>
              {totalStock > 0
                ? `${totalStock} item${totalStock === 1 ? "" : "s"} across all variants`
                : "No purchasable variants"}
            </strong>
          </div>

          <section className="variant-panel" aria-labelledby="variants-heading">
            <div className="product-option-heading">
              <h2 id="variants-heading">Size</h2>
              <span>{selectedSize || "Select a size"}</span>
            </div>
            <div className="variant-choice-list">
              {sizes.map((size) => {
                const isAvailable = hasSelectableSize(state.variants, size);

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

            <div className="product-option-heading product-option-heading--color">
              <h2>Color</h2>
              <span>{selectedColor || (selectedSize ? "Select a color" : "Choose size first")}</span>
            </div>
            <div className="variant-choice-list">
              {colors.map((color) => {
                const isAvailable = Boolean(
                  selectedSize &&
                    hasSelectableCombination(state.variants, selectedSize, color),
                );

                return (
                  <button
                    aria-pressed={color === selectedColor}
                    className={color === selectedColor ? "is-selected" : undefined}
                    disabled={!isAvailable}
                    key={color}
                    onClick={() => handleColorSelect(color)}
                    type="button"
                  >
                    {color}
                  </button>
                );
              })}
            </div>

            {state.variants.length === 0 ? (
              <p className="product-selection-hint">No active variants are available.</p>
            ) : (
              <p className="product-selection-hint">{selectionMessage}</p>
            )}
          </section>

          <section className="quantity-panel" aria-labelledby="quantity-heading">
            <div>
              <h2 id="quantity-heading">Quantity</h2>
              <p>
                {hasValidSelection
                  ? `${selectedVariant.stock} available for this option.`
                  : "Complete the size and color selection first."}
              </p>
            </div>
            <div className="quantity-stepper">
              <button
                aria-label="Decrease quantity"
                disabled={!hasValidSelection || quantity <= 1}
                onClick={() => handleQuantityChange(quantity - 1)}
                type="button"
              >
                <Minus aria-hidden="true" size={15} />
              </button>
              <input
                aria-label="Cart quantity"
                disabled={!hasValidSelection}
                max={selectedMaxQuantity}
                min={1}
                onChange={(event) => handleQuantityChange(Number(event.target.value))}
                type="number"
                value={quantity}
              />
              <button
                aria-label="Increase quantity"
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
                isAuthenticated,
                selectedVariant,
                totalStock,
              })}
            </button>
            <WishlistButton item={wishlistItem} />
          </div>

          <dl className="product-facts">
            <div>
              <dt>SKU</dt>
              <dd>{selectedVariant?.sku || "Select a variant"}</dd>
            </div>
            <div>
              <dt>Variant</dt>
              <dd>
                {selectedVariant
                  ? `${selectedVariant.size} / ${selectedVariant.color}`
                  : `${selectableVariants.length} available option${
                      selectableVariants.length === 1 ? "" : "s"
                    }`}
              </dd>
            </div>
            <div>
              <dt>Availability</dt>
              <dd>
                {selectedVariant
                  ? `${selectedVariant.stock} in stock`
                  : totalStock > 0
                    ? "In stock"
                    : "Out of stock"}
              </dd>
            </div>
          </dl>
        </div>
      </section>
      <RecentlyViewedProducts excludeProductId={product.id} />
    </main>
  );
}

function ProductImage({ alt, url }: { alt: string; url?: string }) {
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    setHasFailed(false);
  }, [url]);

  if (!url || hasFailed) {
    return (
      <div className="product-image-fallback">
        <ImageOff aria-hidden="true" size={28} strokeWidth={1.4} />
        <span>Image unavailable</span>
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
    : "This product could not be loaded right now. Please try again soon.";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isVariantSelectable(
  variant: ProductVariant | undefined,
): variant is ProductVariant {
  return Boolean(variant?.isActive && variant.stock > 0);
}

function hasSelectableSize(variants: ProductVariant[], size: string): boolean {
  return variants.some(
    (variant) => variant.size === size && isVariantSelectable(variant),
  );
}

function hasSelectableCombination(
  variants: ProductVariant[],
  size: string,
  color?: string,
): boolean {
  return Boolean(
    color &&
      variants.some(
        (variant) =>
          variant.size === size &&
          variant.color === color &&
          isVariantSelectable(variant),
      ),
  );
}

function getVariantUnitPrice(product: Product, variant: ProductVariant): number {
  return variant.priceOverride ?? product.basePrice;
}

function getProductReturnPath(product: Product): string {
  return `/products/${encodeURIComponent(product.slug)}`;
}

function getSelectionMessage({
  selectedColor,
  selectedSize,
  totalStock,
}: {
  selectedColor?: string;
  selectedSize?: string;
  totalStock: number;
}): string {
  if (totalStock === 0) {
    return "This product is currently out of stock.";
  }

  if (!selectedSize) {
    return "Choose a size to see its available colors.";
  }

  if (!selectedColor) {
    return "Choose an available color to complete your selection.";
  }

  return "Your size and color are available.";
}

function getAddToCartLabel({
  isAddingToCart,
  isAuthenticated,
  selectedVariant,
  totalStock,
}: {
  isAddingToCart: boolean;
  isAuthenticated: boolean;
  selectedVariant?: ProductVariant;
  totalStock: number;
}): string {
  if (isAddingToCart) {
    return "Adding...";
  }

  if (!isAuthenticated) {
    return "Sign in to add to cart";
  }

  if (totalStock === 0) {
    return "Out of stock";
  }

  if (!selectedVariant) {
    return "Select size and color";
  }

  return "Add to cart";
}
