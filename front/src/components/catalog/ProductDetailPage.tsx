"use client";

import { AlertCircle, CheckCircle2, Loader2, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { RecentlyViewedProducts } from "@/components/recently-viewed/RecentlyViewedProducts";
import { WishlistButton } from "@/components/wishlist/WishlistButton";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { addCartItem } from "@/features/cart/api";
import {
  getCartErrorMessage,
  getCartRequestId,
} from "@/features/cart/errors";
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
  kind: "error" | "success";
  message: string;
  requestId?: string;
}

export function ProductDetailPage({ productRef }: ProductDetailPageProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuthSession();
  const [state, setState] = useState<ProductDetailState>({
    isLoading: true,
    variants: [],
  });
  const [activeImage, setActiveImage] = useState<string>();
  const [selectedVariantId, setSelectedVariantId] = useState<string>();
  const [quantity, setQuantity] = useState(1);
  const [cartFeedback, setCartFeedback] = useState<CartFeedback>();
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const { addProduct: addRecentlyViewedProduct } = useRecentlyViewed();

  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      setState((current) => ({
        ...current,
        error: undefined,
        isLoading: true,
      }));

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

        setState({
          isLoading: false,
          product,
          variants,
        });
        setActiveImage(product.imageUrls[0]);
        setSelectedVariantId(undefined);
        setQuantity(1);
        setCartFeedback(undefined);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setState({
          error: getCatalogErrorMessage(error),
          isLoading: false,
          variants: [],
        });
      }
    }

    void loadProduct();

    return () => {
      isMounted = false;
    };
  }, [productRef]);

  useEffect(() => {
    if (!state.product) {
      return;
    }

    addRecentlyViewedProduct(productToRecentlyViewedProduct(state.product));
  }, [addRecentlyViewedProduct, state.product]);

  const totalStock = useMemo(
    () =>
      state.variants.reduce(
        (sum, variant) =>
          sum + (isVariantSelectable(variant) ? variant.stock : 0),
        0,
      ),
    [state.variants],
  );

  const selectedVariant = useMemo(
    () => state.variants.find((variant) => variant.id === selectedVariantId),
    [selectedVariantId, state.variants],
  );
  const selectedMaxQuantity = selectedVariant
    ? Math.max(1, Math.min(99, selectedVariant.stock))
    : 99;

  useEffect(() => {
    if (!selectedVariant || selectedVariant.stock <= 0) {
      return;
    }

    if (quantity > selectedMaxQuantity) {
      setQuantity(selectedMaxQuantity);
    }
  }, [quantity, selectedMaxQuantity, selectedVariant]);

  function handleVariantSelect(variant: ProductVariant) {
    if (!isVariantSelectable(variant)) {
      return;
    }

    const nextMaxQuantity = Math.max(1, Math.min(99, variant.stock));
    setSelectedVariantId(variant.id);
    setQuantity((current) => Math.max(1, Math.min(current, nextMaxQuantity)));
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
      setCartFeedback({
        kind: "error",
        message: "Choose an in-stock size and color before adding to cart.",
      });
      return;
    }

    setIsAddingToCart(true);
    setCartFeedback(undefined);

    try {
      const response = await addCartItem({
        quantity,
        variantId: selectedVariant.id,
      });
      setCartFeedback({
        kind: "success",
        message: `${state.product.name} was added. Cart now has ${response.cart.totalQuantity} total quantity.`,
      });
    } catch (error) {
      setCartFeedback({
        kind: "error",
        message: getCartErrorMessage(error, "This item could not be added to cart."),
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
          <div className="product-detail-copy">
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
  const wishlistItem = productToWishlistItem(product);
  const displayPrice = selectedVariant
    ? getVariantUnitPrice(product, selectedVariant)
    : product.basePrice;
  const addToCartDisabled =
    isAuthLoading ||
    isAddingToCart ||
    (isAuthenticated && !isVariantSelectable(selectedVariant));

  return (
    <main className="product-detail-page">
      <section className="product-detail-shell" aria-labelledby="product-heading">
        <div className="product-gallery">
          <div className="product-gallery__main">
            {activeImage ? (
              <img alt={product.name} src={activeImage} />
            ) : (
              <div className="product-card__placeholder">No image available</div>
            )}
          </div>

          {product.imageUrls.length > 1 ? (
            <div className="product-gallery__thumbs" aria-label="Product images">
              {product.imageUrls.map((imageUrl) => (
                <button
                  aria-label={`View ${product.name} image`}
                  className={imageUrl === activeImage ? "is-active" : undefined}
                  key={imageUrl}
                  onClick={() => setActiveImage(imageUrl)}
                  type="button"
                >
                  <img alt="" src={imageUrl} />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="product-detail-copy">
          <Link
            className="product-detail-copy__category"
            href={`/categories/${product.category.slug}`}
          >
            {product.category.name}
          </Link>
          <h1 id="product-heading">{product.name}</h1>
          <p className="product-detail-copy__price">{formatPrice(displayPrice)}</p>
          {product.description ? (
            <p className="product-detail-copy__description">{product.description}</p>
          ) : (
            <p className="product-detail-copy__description">
              Product details are being prepared for this item.
            </p>
          )}

          <div className="stock-summary" role="status">
            {totalStock > 0
              ? `${totalStock} items available across sizes and colors.`
              : "This product is currently out of stock."}
          </div>

          <section className="variant-panel" aria-labelledby="variants-heading">
            <h2 id="variants-heading">Sizes and colors</h2>
            {state.variants.length > 0 ? (
              <div className="variant-grid">
                {state.variants.map((variant) => (
                  <button
                    aria-pressed={variant.id === selectedVariantId}
                    className={getVariantOptionClassName(
                      variant,
                      variant.id === selectedVariantId,
                    )}
                    disabled={!isVariantSelectable(variant)}
                    key={variant.id}
                    onClick={() => handleVariantSelect(variant)}
                    type="button"
                  >
                    <span>{variant.size}</span>
                    <strong>{variant.color}</strong>
                    <small>
                      {variant.isActive
                        ? variant.stock > 0
                          ? `${variant.stock} in stock`
                          : "Sold out"
                        : "Unavailable"}
                    </small>
                    {variant.priceOverride !== null ? (
                      <small>{formatPrice(variant.priceOverride)}</small>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : (
              <p className="catalog-context">No active variants are available.</p>
            )}
          </section>

          <section className="quantity-panel" aria-labelledby="quantity-heading">
            <div>
              <h2 id="quantity-heading">Quantity</h2>
              {selectedVariant ? (
                <p>
                  {selectedVariant.stock > 0
                    ? `Up to ${selectedMaxQuantity} available.`
                    : "This selection is sold out."}
                </p>
              ) : (
                <p>Choose a size and color to set quantity.</p>
              )}
            </div>
            <input
              aria-label="Cart quantity"
              disabled={!selectedVariant || !isVariantSelectable(selectedVariant)}
              max={selectedMaxQuantity}
              min={1}
              onChange={(event) => handleQuantityChange(Number(event.target.value))}
              type="number"
              value={quantity}
            />
          </section>

          {cartFeedback ? (
            <div
              className={`customer-feedback customer-feedback--${cartFeedback.kind}`}
              role={cartFeedback.kind === "error" ? "alert" : "status"}
            >
              {cartFeedback.kind === "success" ? (
                <CheckCircle2 aria-hidden="true" size={19} />
              ) : (
                <AlertCircle aria-hidden="true" size={19} />
              )}
              <span>{cartFeedback.message}</span>
              {cartFeedback.requestId ? (
                <small>Request {cartFeedback.requestId}</small>
              ) : null}
            </div>
          ) : null}

          <div className="product-detail-actions">
            <WishlistButton item={wishlistItem} />
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
              })}
            </button>
            {cartFeedback?.kind === "success" ? (
              <Link className="button button--secondary button--full" href="/cart">
                View cart
              </Link>
            ) : null}
          </div>
        </div>
      </section>
      <RecentlyViewedProducts excludeProductId={product.id} />
    </main>
  );
}

function getCatalogErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  return "This product could not be loaded right now. Please try again soon.";
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

function getVariantUnitPrice(product: Product, variant: ProductVariant): number {
  return variant.priceOverride ?? product.basePrice;
}

function getVariantOptionClassName(
  variant: ProductVariant,
  isSelected: boolean,
): string {
  const classNames = ["variant-option"];

  if (!isVariantSelectable(variant)) {
    classNames.push("variant-option--sold-out");
  }

  if (isSelected) {
    classNames.push("is-selected");
  }

  return classNames.join(" ");
}

function getProductReturnPath(product: Product): string {
  return `/products/${encodeURIComponent(product.slug)}`;
}

function getAddToCartLabel({
  isAddingToCart,
  isAuthenticated,
  selectedVariant,
}: {
  isAddingToCart: boolean;
  isAuthenticated: boolean;
  selectedVariant?: ProductVariant;
}): string {
  if (isAddingToCart) {
    return "Adding...";
  }

  if (!isAuthenticated) {
    return "Sign in to add to cart";
  }

  if (!selectedVariant) {
    return "Select size and color";
  }

  return "Add to cart";
}
