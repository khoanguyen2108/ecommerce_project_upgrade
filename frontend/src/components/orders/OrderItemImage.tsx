"use client";

import { useState } from "react";

interface OrderItemImageProps {
  alt: string;
  imageUrl?: string | null;
  size?: "compact" | "detail";
}

export function OrderItemImage({
  alt,
  imageUrl,
  size = "detail",
}: OrderItemImageProps) {
  const className = `order-item-image order-item-image--${size}`;
  const normalizedImageUrl = imageUrl?.trim() || null;
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);

  if (!normalizedImageUrl || failedImageUrl === normalizedImageUrl) {
    return (
      <span
        aria-label={`${alt} image unavailable`}
        className={`${className} order-item-image--fallback`}
        role="img"
      />
    );
  }

  return (
    <img
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailedImageUrl(normalizedImageUrl)}
      src={normalizedImageUrl}
    />
  );
}
