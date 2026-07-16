'use client';

import { Eye, Inbox, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminFeedback, AdminPagination, AdminTableSkeleton } from '@/components/admin/AdminCommerceUi';
import { ReturnRequestStatusBadge } from '@/components/returns/ReturnRequestStatusBadge';
import { formatDate } from '@/components/orders/order-format';
import { listAdminReturns } from '@/features/returns/api';
import { getReturnReasonLabel, getReturnStatusLabel } from '@/features/returns/format';
import type { AdminReturnSummary, ReturnRequestStatus } from '@/features/returns/types';
import {
  getAdminOperationsTranslations,
  type AdminOperationsTranslations,
} from '@/features/i18n/admin-operations-translations';
import { useI18n } from '@/features/i18n/useI18n';
import type { Pagination } from '@/lib/api/types';
import { ApiClientError } from '@/lib/errors/api-error';

const LIMIT = 20;

export function AdminReturnsPage() {
  const { locale } = useI18n();
  const copy = getAdminOperationsTranslations(locale);
  const [status, setStatus] = useState<ReturnRequestStatus>();
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<AdminReturnSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    limit: LIMIT,
    page: 1,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<unknown>();
  const [requestId, setRequestId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function load() {
      setIsLoading(true);
      setError(undefined);
      setRequestId(undefined);

      try {
        const response = await listAdminReturns({ limit: LIMIT, page, status });

        if (active) {
          setRequests(response.returnRequests);
          setPagination(response.pagination);
        }
      } catch (loadError) {
        if (active) {
          setRequests([]);
          setError(loadError);
          setRequestId(
            loadError instanceof ApiClientError ? loadError.requestId : undefined,
          );
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [page, refreshKey, status]);

  const errorMessage = error
    ? getReturnErrorMessage(error, copy, copy.returns.list.loadError)
    : undefined;

  return (
    <div className="admin-resource admin-resource--full-width admin-returns-page">
      <section className="admin-returns-hero" aria-labelledby="admin-returns-heading">
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">{copy.returns.list.eyebrow}</p>
          <h1 id="admin-returns-heading">{copy.returns.list.title}</h1>
          <p>{copy.returns.list.subtitle}</p>
        </div>
        <button
          className="button button--secondary"
          disabled={isLoading}
          onClick={() => setRefreshKey((value) => value + 1)}
          type="button"
        >
          <RefreshCw aria-hidden="true" className={isLoading ? 'spin' : undefined} size={17} />
          {copy.common.refresh}
        </button>
      </section>

      <section className="admin-returns-filter" aria-label={copy.returns.list.filtersAria}>
        <label>
          <span>{copy.common.status}</span>
          <select
            onChange={(event) => {
              setStatus((event.target.value || undefined) as ReturnRequestStatus | undefined);
              setPage(1);
            }}
            value={status || ''}
          >
            <option value="">{copy.returns.list.allStatuses}</option>
            <option value="PENDING">{getReturnStatusLabel('PENDING', locale)}</option>
            <option value="APPROVED">{getReturnStatusLabel('APPROVED', locale)}</option>
            <option value="REJECTED">{getReturnStatusLabel('REJECTED', locale)}</option>
          </select>
        </label>
      </section>

      {errorMessage ? (
        <AdminFeedback message={errorMessage} requestId={requestId} tone="error" />
      ) : null}

      <div className="admin-table-wrap admin-table-wrap--commerce">
        <table className="admin-table admin-table--commerce">
          <thead>
            <tr>
              <th>{copy.returns.list.orderCode}</th>
              <th>{copy.common.customer}</th>
              <th>{copy.returns.list.reason}</th>
              <th>{copy.common.status}</th>
              <th>{copy.returns.list.created}</th>
              <th>{copy.common.actions}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <AdminTableSkeleton columns={6} rows={5} /> : null}
            {!isLoading && requests.length === 0 ? (
              <tr>
                <td className="admin-table__state" colSpan={6}>
                  <Inbox aria-hidden="true" size={24} />
                  <strong>{copy.returns.list.emptyTitle}</strong>
                  <span>{copy.returns.list.emptyBody}</span>
                </td>
              </tr>
            ) : null}
            {!isLoading
              ? requests.map((request) => (
                  <tr key={request.id}>
                    <td><strong>#{request.orderCode}</strong></td>
                    <td>
                      <strong>{request.customer.name || copy.returns.list.customerFallback}</strong>
                      <span className="admin-table__secondary">{request.customer.email}</span>
                    </td>
                    <td>{getReturnReasonLabel(request.reason, locale)}</td>
                    <td><ReturnRequestStatusBadge status={request.status} /></td>
                    <td>{formatDate(request.createdAt, locale)}</td>
                    <td>
                      <Link className="admin-table-link" href={`/admin/returns/${request.id}`}>
                        <Eye aria-hidden="true" size={16} />
                        {copy.common.view}
                      </Link>
                    </td>
                  </tr>
                ))
              : null}
          </tbody>
        </table>
      </div>

      <AdminPagination
        isLoading={isLoading}
        noun={copy.returns.list.noun}
        onPageChange={setPage}
        pagination={pagination}
      />
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
