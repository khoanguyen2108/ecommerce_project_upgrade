'use client';

import { RotateCcw, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { createReturnRequest } from '@/features/returns/api';
import { getReturnReasonLabel, RETURN_REASON_LABELS } from '@/features/returns/format';
import type {
  CustomerReturnRequest,
  ReturnReason,
} from '@/features/returns/types';
import { ApiClientError } from '@/lib/errors/api-error';
import { useI18n } from '@/features/i18n/useI18n';
import type { TranslationKey } from '@/features/i18n/translations';
import styles from './ReturnRequestModal.module.css';

const REASONS = Object.keys(RETURN_REASON_LABELS) as ReturnReason[];

interface ReturnRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitted: (request: CustomerReturnRequest) => void;
  orderCode?: string;
}

export function ReturnRequestModal({
  isOpen,
  onClose,
  onSubmitted,
  orderCode,
}: ReturnRequestModalProps) {
  const { locale, t } = useI18n();
  const [reason, setReason] = useState<ReturnReason>('WRONG_SIZE');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setReason('WRONG_SIZE');
    setDescription('');
    setError(undefined);
  }, [isOpen, orderCode]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen || !orderCode) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting || !orderCode) {
      return;
    }

    setIsSubmitting(true);
    setError(undefined);

    try {
      const response = await createReturnRequest({
        orderCode,
        reason,
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      onSubmitted(response.returnRequest);
      onClose();
    } catch (submitError) {
      setError(getReturnErrorMessage(submitError, t));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      aria-labelledby="return-request-title"
      aria-modal="true"
      className={styles.backdrop}
      role="dialog"
    >
      <form className={styles.modal} onSubmit={(event) => void handleSubmit(event)}>
        <header className={styles.header}>
          <span className={styles.icon}>
            <RotateCcw aria-hidden="true" size={20} />
          </span>
          <div>
            <p>{t('return.order')} #{orderCode}</p>
            <h2 id="return-request-title">{t('return.title')}</h2>
          </div>
          <button
            aria-label={t('return.close')}
            className={styles.close}
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            <X aria-hidden="true" size={19} />
          </button>
        </header>

        <div className={styles.body}>
          <label>
            <span>{t('return.reason')}</span>
            <select
              disabled={isSubmitting}
              onChange={(event) => setReason(event.target.value as ReturnReason)}
              value={reason}
            >
              {REASONS.map((value) => (
                <option key={value} value={value}>
                  {getReturnReasonLabel(value, locale)}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{t('return.description')}</span>
            <textarea
              disabled={isSubmitting}
              maxLength={1000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('return.descriptionPlaceholder')}
              rows={5}
              value={description}
            />
            <small>{description.length}/1000</small>
          </label>

          {error ? <div className={styles.error} role="alert">{error}</div> : null}
        </div>

        <footer className={styles.footer}>
          <button
            className="button button--secondary"
            disabled={isSubmitting}
            onClick={onClose}
            type="button"
          >
            {t('return.cancel')}
          </button>
          <button
            className="button button--primary"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? t('return.submitting') : t('return.submit')}
          </button>
        </footer>
      </form>
    </div>
  );
}

function getReturnErrorMessage(
  error: unknown,
  t: (key: TranslationKey) => string,
): string {
  if (!(error instanceof ApiClientError)) {
    return t('return.submitError');
  }

  const messages: Record<string, string> = {
    RETURN_ORDER_NOT_DELIVERED: t('return.notDelivered'),
    RETURN_ORDER_NOT_FOUND: t('return.notFound'),
    RETURN_REQUEST_PENDING_EXISTS: t('return.pendingExists'),
  };

  return messages[error.code] || t('return.submitError');
}
