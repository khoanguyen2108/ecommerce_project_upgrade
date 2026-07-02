import { RotateCcw } from 'lucide-react';
import type { SupportReturnRequestCard } from '@/features/ai/supportTypes';
import styles from './AiReturnRequestCard.module.css';

export function AiReturnRequestCard({
  onRequestReturn,
  returnRequest,
}: {
  onRequestReturn: (returnRequest: SupportReturnRequestCard) => void;
  returnRequest: SupportReturnRequestCard;
}) {
  const isPending = returnRequest.requestStatus === 'PENDING';

  return (
    <div className={styles.card}>
      <span className={styles.icon}>
        <RotateCcw aria-hidden="true" size={18} />
      </span>
      <div className={styles.content}>
        <span className={styles.eyebrow}>Delivered order</span>
        <strong>#{returnRequest.orderCode}</strong>
        <span>Delivered {formatDate(returnRequest.deliveredAt)}</span>
      </div>
      <button
        className={styles.action}
        disabled={isPending}
        onClick={() => onRequestReturn(returnRequest)}
        type="button"
      >
        {isPending ? 'Pending Review' : 'Request Return'}
      </button>
    </div>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }

  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
