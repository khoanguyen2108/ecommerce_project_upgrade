"use client";

import { ADMIN_OPERATIONS_COPY, type AdminOperationsCopy } from "@/components/admin/admin-copy";
const copy = ADMIN_OPERATIONS_COPY;

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
import { ApiClientError } from '@/lib/errors/api-error';

interface ReturnDetailError {
  cause: unknown;
  fallback: 'load' | 'review';
}

export function AdminReturnDetailPage({ returnId }: { returnId: string }) {
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
      ((status) => status === "APPROVED"
                ? "Approve this return request? This decision cannot be edited."
                : "Reject this return request? This decision cannot be edited.")(status),
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
          ? "Return request could not be loaded."
          : "Return request could not be reviewed.",
      )
    : undefined;

  if (isLoading && !request) {
    return (
      <div className="admin-detail-loading" role="status">
        {"Loading return request..."}
      </div>
    );
  }

  return (
    <div className="admin-resource admin-resource--full-width admin-return-detail">
      <Link className="admin-return-detail__back" href="/admin/returns">
        <ArrowLeft aria-hidden="true" size={17} /> {"Back to returns"}
      </Link>

      {errorMessage ? (
        <AdminFeedback message={errorMessage} requestId={requestId} tone="error" />
      ) : null}

      {!request ? (
        <section className="admin-detail-card">
          <h1>{"Return request unavailable"}</h1>
          <button className="button button--secondary" onClick={() => setRefreshKey((value) => value + 1)} type="button">
            <RefreshCw aria-hidden="true" size={16} /> {"Retry"}
          </button>
        </section>
      ) : (
        <>
          <section className="admin-returns-hero">
            <div className="admin-page-intro">
              <p className="admin-page-intro__eyebrow">{"RETURN REVIEW"}</p>
              <h1>{((orderCode) => `Order #${orderCode}`)(request.order.orderCode)}</h1>
              <p>
                {((date) => `Submitted ${date}`)(
                  formatDateTime(request.createdAt),
                )}
              </p>
            </div>
            <ReturnRequestStatusBadge status={request.status} />
          </section>

          <div className="admin-detail-grid">
            <section className="admin-detail-card">
              <h2>{"Order summary"}</h2>
              <dl className="admin-detail-list">
                <div><dt>{"Order"}</dt><dd>#{request.order.orderCode}</dd></div>
                <div>
                  <dt>{"Order status"}</dt>
                  <dd>{formatOrderStatus(request.order.status, "Unknown status")}</dd>
                </div>
                <div>
                  <dt>{"Fulfillment"}</dt>
                  <dd>
                    {formatFulfillmentStatus(request.order.fulfillmentStatus, "Unknown status")}
                  </dd>
                </div>
                <div>
                  <dt>{"Delivered"}</dt>
                  <dd>
                    {request.order.fulfilledAt
                      ? formatDateTime(request.order.fulfilledAt)
                      : "Unavailable"}
                  </dd>
                </div>
                <div>
                  <dt>{"Total"}</dt>
                  <dd>
                    {formatCurrency(request.order.totalAmount, request.order.currency)}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="admin-detail-card">
              <h2>{"Customer"}</h2>
              <dl className="admin-detail-list">
                <div>
                  <dt>{"Name"}</dt>
                  <dd>{request.customer.name || "Customer"}</dd>
                </div>
                <div><dt>{"Email"}</dt><dd>{request.customer.email}</dd></div>
              </dl>
            </section>
          </div>

          <section className="admin-detail-section admin-return-review-card">
            <div className="admin-detail-section__header">
              <div>
                <p className="eyebrow">{"Customer request"}</p>
                <h2>{getReturnReasonLabel(request.reason)}</h2>
              </div>
            </div>
            <p>{request.description || "No additional description was provided."}</p>

            {request.status === 'PENDING' ? (
              <div className="admin-return-review-card__actions">
                <button className="button button--primary" disabled={Boolean(busyStatus)} onClick={() => void review('APPROVED')} type="button">
                  <Check aria-hidden="true" size={17} />
                  {busyStatus === 'APPROVED'
                    ? "Approving..."
                    : "Approve"}
                </button>
                <button className="button button--danger" disabled={Boolean(busyStatus)} onClick={() => void review('REJECTED')} type="button">
                  <X aria-hidden="true" size={17} />
                  {busyStatus === 'REJECTED'
                    ? "Rejecting..."
                    : "Reject"}
                </button>
              </div>
            ) : (
              <p className="admin-return-review-card__reviewed">
                {((date, reviewer) => `Reviewed ${date}${reviewer ? ` by ${reviewer}` : ""}.`)(
                  request.reviewedAt
                    ? formatDateTime(request.reviewedAt)
                    : "Unavailable",
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
  copy: AdminOperationsCopy,
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
  fallback: string,
): string {
  return isOrderStatus(status) ? getOrderStatusLabel(status) : fallback;
}

function formatFulfillmentStatus(
  status: string,
  fallback: string,
): string {
  return isFulfillmentStatus(status)
    ? getFulfillmentStatusLabel(status)
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
