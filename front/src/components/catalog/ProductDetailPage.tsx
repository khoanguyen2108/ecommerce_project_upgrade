"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getProductById,
  getProductBySlug,
  getProductVariants,
  getProductVariantsBySlug,
} from "@/features/catalog/api";
import { formatPrice } from "@/features/catalog/format";
import type { Product, ProductVariant } from "@/features/catalog/types";
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

export function ProductDetailPage({ productRef }: ProductDetailPageProps) {
  const [state, setState] = useState<ProductDetailState>({
    isLoading: true,
    variants: [],
  });
  const [activeImage, setActiveImage] = useState<string>();

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

  const totalStock = useMemo(
    () => state.variants.reduce((sum, variant) => sum + variant.stock, 0),
    [state.variants],
  );

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
            href={`/products?categorySlug=${product.category.slug}`}
          >
            {product.category.name}
          </Link>
          <h1 id="product-heading">{product.name}</h1>
          <p className="product-detail-copy__price">{formatPrice(product.basePrice)}</p>
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
                  <div
                    className={
                      variant.stock > 0
                        ? "variant-option"
                        : "variant-option variant-option--sold-out"
                    }
                    key={variant.id}
                  >
                    <span>{variant.size}</span>
                    <strong>{variant.color}</strong>
                    <small>
                      {variant.stock > 0
                        ? `${variant.stock} in stock`
                        : "Sold out"}
                    </small>
                    {variant.priceOverride ? (
                      <small>{formatPrice(variant.priceOverride)}</small>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="catalog-context">No active variants are available.</p>
            )}
          </section>

          <button className="button button--primary button--full" disabled type="button">
            Cart is coming soon.
          </button>
        </div>
      </section>
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
