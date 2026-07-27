import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { OrderItemImage } from '@/components/orders/OrderItemImage';
import type { SupportReturnRequestCard } from '@/features/ai/supportTypes';
import styles from './AiReturnRequestCard.module.css';

export function AiReturnRequestCard({
  onRequestReturn,
  returnRequest,
}: {
  onRequestReturn: (returnRequest: SupportReturnRequestCard) => void;
  returnRequest: SupportReturnRequestCard;
}) {
  const isUnavailable = Boolean(returnRequest.requestStatus);

  return (
    <div className={styles.card}>
      <Link
        aria-label={`${"View order"} ${returnRequest.orderCode}`}
        className={styles.orderLink}
        href={returnRequest.detailUrl}
      >
        <OrderItemImage
          alt={`${"Order"} ${returnRequest.orderCode}`}
          imageUrl={returnRequest.thumbnail}
          size="compact"
        />
        <span className={styles.content}>
          <span className={styles.eyebrow}>{"Delivered order"}</span>
          <strong>#{returnRequest.orderCode}</strong>
          <span>{"Delivered"} {formatDate(returnRequest.deliveredAt, "recently")}</span>
        </span>
        <ChevronRight aria-hidden="true" size={18} />
      </Link>
      <button
        className={styles.action}
        disabled={isUnavailable}
        onClick={() => onRequestReturn(returnRequest)}
        type="button"
      >
        {returnRequest.requestStatus === 'APPROVED'
          ? "Return Approved"
          : returnRequest.requestStatus === 'PENDING'
            ? "Pending Review"
            : "Request Return"}
      </button>
    </div>
  );
}

function formatDate(value: string, fallback: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
