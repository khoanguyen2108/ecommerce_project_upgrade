"use client";

import { Minus, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatPrice } from "@/features/catalog/format";
import { isImplicitAccessoryOption } from "@/features/catalog/sizes";
import type { CartItem } from "@/features/cart/types";

interface CartItemRowProps {
  isBusy: boolean;
  item: CartItem;
  onRemove: (id: string) => void;
  onUpdate: (id: string, quantity: number) => void;
}

export function CartItemRow({
  isBusy,
  item,
  onRemove,
  onUpdate,
}: CartItemRowProps) {
  const [quantity, setQuantity] = useState(item.quantity);
  const maxQuantity = useMemo(
    () => Math.max(1, Math.min(99, item.availableStock)),
    [item.availableStock],
  );
  const canUpdate = item.availableStock > 0;
  const hasChanged = quantity !== item.quantity;
  const productHref = `/products/${encodeURIComponent(item.product.slug)}`;
  const showVariantOption = !isImplicitAccessoryOption(item.variant);

  useEffect(() => {
    setQuantity(item.quantity);
  }, [item.quantity]);

  function handleQuantityChange(value: number) {
    if (!Number.isFinite(value)) {
      setQuantity(1);
      return;
    }

    setQuantity(Math.max(1, Math.min(maxQuantity, Math.trunc(value))));
  }

  return (
    <article className="cart-item-row">
      <Link
        aria-label={`View ${item.product.name}`}
        className="cart-item-row__image"
        href={productHref}
      >
        {item.product.firstImageUrl ? (
          <img alt={item.product.name} loading="lazy" src={item.product.firstImageUrl} />
        ) : (
          <span>No image available</span>
        )}
      </Link>

      <div className="cart-item-row__body">
        <p className="cart-item-row__category">{item.product.category.name}</p>
        <h2>
          <Link href={productHref}>{item.product.name}</Link>
        </h2>
        {showVariantOption ? (
          <p className="cart-item-row__variant">
            {item.variant.size} / {item.variant.color}
            {item.variant.sku ? ` / ${item.variant.sku}` : ""}
          </p>
        ) : null}
        <p className="cart-item-row__stock">
          {item.availableStock > 0
            ? `${item.availableStock} in stock`
            : "Out of stock"}
        </p>
      </div>

      <div className="cart-item-row__quantity">
        <span>Quantity</span>
        <div className="quantity-stepper">
          <button
            aria-label={`Decrease ${item.product.name} quantity`}
            disabled={isBusy || !canUpdate || quantity <= 1}
            onClick={() => handleQuantityChange(quantity - 1)}
            type="button"
          >
            <Minus aria-hidden="true" size={16} />
          </button>
          <input
            aria-label={`${item.product.name} quantity`}
            disabled={isBusy || !canUpdate}
            max={maxQuantity}
            min={1}
            onChange={(event) => handleQuantityChange(Number(event.target.value))}
            type="number"
            value={quantity}
          />
          <button
            aria-label={`Increase ${item.product.name} quantity`}
            disabled={isBusy || !canUpdate || quantity >= maxQuantity}
            onClick={() => handleQuantityChange(quantity + 1)}
            type="button"
          >
            <Plus aria-hidden="true" size={16} />
          </button>
        </div>
        <button
          className="button button--secondary cart-item-row__update"
          disabled={isBusy || !canUpdate || !hasChanged}
          onClick={() => onUpdate(item.id, quantity)}
          type="button"
        >
          Update
        </button>
      </div>

      <div className="cart-item-row__price">
        <span>Unit price</span>
        <strong>{formatPrice(item.currentUnitPrice)}</strong>
      </div>

      <div className="cart-item-row__price">
        <span>Line total</span>
        <strong>{formatPrice(item.currentLineTotal)}</strong>
      </div>

      <button
        aria-label={`Remove ${item.product.name} from cart`}
        className="icon-button cart-item-row__remove"
        disabled={isBusy}
        onClick={() => onRemove(item.id)}
        title="Remove"
        type="button"
      >
        <Trash2 aria-hidden="true" size={18} strokeWidth={1.9} />
      </button>
    </article>
  );
}
