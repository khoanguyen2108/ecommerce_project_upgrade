import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { OrderItemImage } from '@/components/orders/OrderItemImage';
import type { SupportReturnRequestCard } from '@/features/ai/supportTypes';
import styles from './AiReturnRequestCard.module.css';
import { useI18n } from '@/features/i18n/useI18n';
import type { Locale } from '@/features/i18n/locale';

export function AiReturnRequestCard({
  onRequestReturn,
  returnRequest,
}: {
  onRequestReturn: (returnRequest: SupportReturnRequestCard) => void;
  returnRequest: SupportReturnRequestCard;
}) {
  const { locale, t } = useI18n();
  const isUnavailable = Boolean(returnRequest.requestStatus);

  return (
    <div className={styles.card}>
      <Link
        aria-label={`${t('chat.viewOrder')} ${returnRequest.orderCode}`}
        className={styles.orderLink}
        href={returnRequest.detailUrl}
      >
        <OrderItemImage
          alt={`${t('chat.order')} ${returnRequest.orderCode}`}
          imageUrl={returnRequest.thumbnail}
          size="compact"
        />
        <span className={styles.content}>
          <span className={styles.eyebrow}>{t('chat.deliveredOrder')}</span>
          <strong>#{returnRequest.orderCode}</strong>
          <span>{t('chat.delivered')} {formatDate(returnRequest.deliveredAt, locale, t('chat.recently'))}</span>
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
          ? t('return.approved')
          : returnRequest.requestStatus === 'PENDING'
            ? t('return.pendingReview')
            : t('chat.requestReturn')}
      </button>
    </div>
  );
}

function formatDate(value: string, locale: Locale, fallback: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}
