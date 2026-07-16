'use client';

import { ArrowLeft, Check, RefreshCw, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminFeedback } from '@/components/admin/AdminCommerceUi';
import { ReturnRequestStatusBadge } from '@/components/returns/ReturnRequestStatusBadge';
import {
  formatCurrency,
  formatDateTime,
  getFulfillmentStatusLabel,
  getOrderStatusLabel,
} from '@/components/orders/order-format';
import { requestAdminNavNotificationsRefresh } from '@/features/admin-notifications/events';
import { getAdminReturn, reviewAdminReturn } from '@/features/returns/api';
import { getReturnReasonLabel } from '@/features/returns/format';
import type { AdminReturnRequest } from '@/features/returns/types';
import type { OrderFulfillmentStatus, OrderStatus } from '@/features/orders/types';
import {
  getAdminOperationsTranslations,
  type AdminOperationsTranslations,
} from '@/features/i18n/admin-operations-translations';
import type { Locale } from '@/features/i18n/locale';
import { useI18n } from '@/features/i18n/useI18n';
import { ApiClientError } from '@/lib/errors/api-error';

interface ReturnDetailError {
  cause: unknown;
  fallback: 'load' | 'review';
}

export function AdminReturnDetailPage({ returnId }: { returnId: string }) {
  const { locale } = useI18n();
  const copy = getAdminOperationsTranslations(locale);
  const [request, setRequest] = useState<AdminReturnRequest>();
  const [isLoading, setIsLoading] = useState(true);
  const [busyStatus, setBusyStatus] = useState<'APPROVED' | 'REJECTED'>();
  const [error, setError] = useState<ReturnDetailError>();
  const [requestId, setRequestId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(undefined);
      setRequestId(undefined);

      try {
        const response = await getAdminReturn(returnId);
        if (active) setRequest(response.returnRequest);
      } catch (loadError) {
        if (active) {
          setRequest(undefined);
          setError({ cause: loadError, fallback: 'load' });
          setRequestId(loadError instanceof ApiClientError ? loadError.requestId : undefined);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, [refreshKey, returnId]);

  async function review(status: 'APPROVED' | 'REJECTED') {
    if (!request || request.status !== 'PENDING' || busyStatus) return;

    const confirmed = window.confirm(
      copy.returns.detail.confirmReview(status),
    );
    if (!confirmed) return;

    setBusyStatus(status);
    setError(undefined);
    setRequestId(undefined);

    try {
      const response = await reviewAdminReturn(request.id, status);
      setRequest(response.returnRequest);
      requestAdminNavNotificationsRefresh();
    } catch (reviewError) {
      setError({ cause: reviewError, fallback: 'review' });
      setRequestId(reviewError instanceof ApiClientError ? reviewError.requestId : undefined);
    } finally {
      setBusyStatus(undefined);
    }
  }

  const errorMessage = error
    ? getReturnErrorMessage(
        error.cause,
        copy,
        error.fallback === 'load'
          ? copy.returns.detail.loadError
          : copy.returns.detail.reviewError,
      )
    : undefined;

  if (isLoading && !request) {
    return (
      <div className="admin-detail-loading" role="status">
        {copy.returns.detail.loading}
      </div>
    );
  }

  return (
    <div className="admin-resource admin-resource--full-width admin-return-detail">
      <Link className="admin-return-detail__back" href="/admin/returns">
        <ArrowLeft aria-hidden="true" size={17} /> {copy.returns.detail.back}
      </Link>

      {errorMessage ? (
        <AdminFeedback message={errorMessage} requestId={requestId} tone="error" />
      ) : null}

      {!request ? (
        <section className="admin-detail-card">
          <h1>{copy.returns.detail.unavailable}</h1>
          <button className="button button--secondary" onClick={() => setRefreshKey((value) => value + 1)} type="button">
            <RefreshCw aria-hidden="true" size={16} /> {copy.returns.detail.retry}
          </button>
        </section>
      ) : (
        <>
          <section className="admin-returns-hero">
            <div className="admin-page-intro">
              <p className="admin-page-intro__eyebrow">{copy.returns.detail.eyebrow}</p>
              <h1>{copy.returns.detail.orderTitle(request.order.orderCode)}</h1>
              <p>
                {copy.returns.detail.submitted(
                  formatDateTime(request.createdAt, locale),
                )}
              </p>
            </div>
            <ReturnRequestStatusBadge status={request.status} />
          </section>

          <div className="admin-detail-grid">
            <section className="admin-detail-card">
              <h2>{copy.returns.detail.orderSummary}</h2>
              <dl className="admin-detail-list">
                <div><dt>{copy.common.order}</dt><dd>#{request.order.orderCode}</dd></div>
                <div>
                  <dt>{copy.returns.detail.orderStatus}</dt>
                  <dd>{formatOrderStatus(request.order.status, locale, copy.common.unknownStatus)}</dd>
                </div>
                <div>
                  <dt>{copy.returns.detail.fulfillment}</dt>
                  <dd>
                    {formatFulfillmentStatus(
                      request.order.fulfillmentStatus,
                      locale,
                      copy.common.unknownStatus,
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{copy.returns.detail.delivered}</dt>
                  <dd>
                    {request.order.fulfilledAt
                      ? formatDateTime(request.order.fulfilledAt, locale)
                      : copy.returns.detail.unavailableValue}
                  </dd>
                </div>
                <div>
                  <dt>{copy.common.total}</dt>
                  <dd>
                    {formatCurrency(
                      request.order.totalAmount,
                      request.order.currency,
                      locale,
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="admin-detail-card">
              <h2>{copy.common.customer}</h2>
              <dl className="admin-detail-list">
                <div>
                  <dt>{copy.common.name}</dt>
                  <dd>{request.customer.name || copy.common.customer}</dd>
                </div>
                <div><dt>{copy.common.email}</dt><dd>{request.customer.email}</dd></div>
              </dl>
            </section>
          </div>

          <section className="admin-detail-section admin-return-review-card">
            <div className="admin-detail-section__header">
              <div>
                <p className="eyebrow">{copy.returns.detail.customerRequest}</p>
                <h2>{getReturnReasonLabel(request.reason, locale)}</h2>
              </div>
            </div>
            <p>{request.description || copy.returns.detail.noDescription}</p>

            {request.status === 'PENDING' ? (
              <div className="admin-return-review-card__actions">
                <button className="button button--primary" disabled={Boolean(busyStatus)} onClick={() => void review('APPROVED')} type="button">
                  <Check aria-hidden="true" size={17} />
                  {busyStatus === 'APPROVED'
                    ? copy.returns.detail.approving
                    : copy.returns.detail.approve}
                </button>
                <button className="button button--danger" disabled={Boolean(busyStatus)} onClick={() => void review('REJECTED')} type="button">
                  <X aria-hidden="true" size={17} />
                  {busyStatus === 'REJECTED'
                    ? copy.returns.detail.rejecting
                    : copy.returns.detail.reject}
                </button>
              </div>
            ) : (
              <p className="admin-return-review-card__reviewed">
                {copy.returns.detail.reviewed(
                  request.reviewedAt
                    ? formatDateTime(request.reviewedAt, locale)
                    : copy.returns.detail.unavailableValue,
                  request.reviewer
                    ? request.reviewer.name || request.reviewer.email
                    : undefined,
                )}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function getReturnErrorMessage(
  error: unknown,
  copy: AdminOperationsTranslations,
  fallback: string,
): string {
  if (!(error instanceof ApiClientError)) {
    return fallback;
  }

  return (
    copy.returns.errors[error.code as keyof typeof copy.returns.errors] || fallback
  );
}

function formatOrderStatus(
  status: string,
  locale: Locale,
  fallback: string,
): string {
  return isOrderStatus(status) ? getOrderStatusLabel(status, locale) : fallback;
}

function formatFulfillmentStatus(
  status: string,
  locale: Locale,
  fallback: string,
): string {
  return isFulfillmentStatus(status)
    ? getFulfillmentStatusLabel(status, locale)
    : fallback;
}

function isOrderStatus(status: string): status is OrderStatus {
  return (
    status === 'PENDING_PAYMENT' ||
    status === 'PAID' ||
    status === 'CANCELLED' ||
    status === 'EXPIRED'
  );
}

function isFulfillmentStatus(status: string): status is OrderFulfillmentStatus {
  return (
    status === 'PENDING' ||
    status === 'PICKED_UP' ||
    status === 'IN_TRANSIT' ||
    status === 'OUT_FOR_DELIVERY' ||
    status === 'DELIVERED' ||
    status === 'RETURNED'
  );
}
