"use client";

import { Heart } from "lucide-react";
import type { WishlistItem } from "@/features/wishlist/types";
import { useWishlist } from "@/features/wishlist/useWishlist";

interface WishlistButtonProps {
  className?: string;
  item: WishlistItem;
  variant?: "icon" | "action";
}

export function WishlistButton({
  className,
  item,
  variant = "action",
}: WishlistButtonProps) {
  const { isSaved, toggleItem } = useWishlist();
  const isItemSaved = isSaved(item.id);
  const label = isItemSaved ? "Remove from wishlist" : "Save to wishlist";
  const classes = [
    "wishlist-button",
    `wishlist-button--${variant}`,
    isItemSaved ? "is-active" : undefined,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      aria-label={`${label}: ${item.name}`}
      aria-pressed={isItemSaved}
      className={classes}
      onClick={() => toggleItem(item)}
      title={label}
      type="button"
    >
      <Heart
        aria-hidden="true"
        fill={isItemSaved ? "currentColor" : "none"}
        size={variant === "icon" ? 19 : 18}
        strokeWidth={1.9}
      />
      {variant === "action" ? (
        <span>{isItemSaved ? "Saved to wishlist" : "Save to wishlist"}</span>
      ) : null}
    </button>
  );
}

