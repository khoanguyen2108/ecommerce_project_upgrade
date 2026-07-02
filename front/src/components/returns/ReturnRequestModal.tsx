'use client';

import { RotateCcw, X } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { createReturnRequest } from '@/features/returns/api';
import { RETURN_REASON_LABELS } from '@/features/returns/format';
import type {
  CustomerReturnRequest,
  ReturnReason,
} from '@/features/returns/types';
import { ApiClientError } from '@/lib/errors/api-error';
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
      setError(getReturnErrorMessage(submitError));
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
            <p>Order #{orderCode}</p>
            <h2 id="return-request-title">Request Return</h2>
          </div>
          <button
            aria-label="Close return request"
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
            <span>Reason</span>
            <select
              disabled={isSubmitting}
              onChange={(event) => setReason(event.target.value as ReturnReason)}
              value={reason}
            >
              {REASONS.map((value) => (
                <option key={value} value={value}>
                  {RETURN_REASON_LABELS[value]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Description</span>
            <textarea
              disabled={isSubmitting}
              maxLength={1000}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Tell us briefly what happened (optional)."
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
            Cancel
          </button>
          <button
            className="button button--primary"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function getReturnErrorMessage(error: unknown): string {
  if (!(error instanceof ApiClientError)) {
    return 'The return request could not be submitted. Please try again.';
  }

  const messages: Record<string, string> = {
    RETURN_ORDER_NOT_DELIVERED:
      'This order is not eligible yet. Returns can be requested after delivery.',
    RETURN_ORDER_NOT_FOUND: 'This order could not be found for your account.',
    RETURN_REQUEST_PENDING_EXISTS:
      'A return request for this order is already pending review.',
  };

  return messages[error.code] || error.message;
}
