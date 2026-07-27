"use client";

import { ADMIN_OPERATIONS_COPY, type AdminOperationsCopy } from "@/components/admin/admin-copy";
const copy = ADMIN_OPERATIONS_COPY;

import { Eye, Inbox, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminFeedback, AdminPagination, AdminTableSkeleton } from '@/components/admin/AdminCommerceUi';
import { ReturnRequestStatusBadge } from '@/components/returns/ReturnRequestStatusBadge';
import { formatDate } from '@/components/orders/order-format';
import { listAdminReturns } from '@/features/returns/api';
import { getReturnReasonLabel, getReturnStatusLabel } from '@/features/returns/format';
import type { AdminReturnSummary, ReturnRequestStatus } from '@/features/returns/types';
import type { Pagination } from '@/lib/api/types';
import { ApiClientError } from '@/lib/errors/api-error';

const LIMIT = 20;

export function AdminReturnsPage() {
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
    ? getReturnErrorMessage(error, copy, "Return requests could not be loaded.")
    : undefined;

  return (
    <div className="admin-resource admin-resource--full-width admin-returns-page">
      <section className="admin-returns-hero" aria-labelledby="admin-returns-heading">
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">{"CUSTOMER CARE"}</p>
          <h1 id="admin-returns-heading">{"Returns"}</h1>
          <p>{"Review submitted return requests and approve or reject them."}</p>
        </div>
        <button
          className="button button--secondary"
          disabled={isLoading}
          onClick={() => setRefreshKey((value) => value + 1)}
          type="button"
        >
          <RefreshCw aria-hidden="true" className={isLoading ? 'spin' : undefined} size={17} />
          {"Refresh"}
        </button>
      </section>

      <section className="admin-returns-filter" aria-label={"Return request filters"}>
        <label>
          <span>{"Status"}</span>
          <select
            onChange={(event) => {
              setStatus((event.target.value || undefined) as ReturnRequestStatus | undefined);
              setPage(1);
            }}
            value={status || ''}
          >
            <option value="">{"All statuses"}</option>
            <option value="PENDING">{getReturnStatusLabel('PENDING')}</option>
            <option value="APPROVED">{getReturnStatusLabel('APPROVED')}</option>
            <option value="REJECTED">{getReturnStatusLabel('REJECTED')}</option>
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
              <th>{"Order Code"}</th>
              <th>{"Customer"}</th>
              <th>{"Reason"}</th>
              <th>{"Status"}</th>
              <th>{"Created"}</th>
              <th>{"Actions"}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <AdminTableSkeleton columns={6} rows={5} /> : null}
            {!isLoading && requests.length === 0 ? (
              <tr>
                <td className="admin-table__state" colSpan={6}>
                  <Inbox aria-hidden="true" size={24} />
                  <strong>{"No return requests found"}</strong>
                  <span>{"New customer requests will appear here."}</span>
                </td>
              </tr>
            ) : null}
            {!isLoading
              ? requests.map((request) => (
                  <tr key={request.id}>
                    <td><strong>#{request.orderCode}</strong></td>
                    <td>
                      <strong>{request.customer.name || "Customer"}</strong>
                      <span className="admin-table__secondary">{request.customer.email}</span>
                    </td>
                    <td>{getReturnReasonLabel(request.reason)}</td>
                    <td><ReturnRequestStatusBadge status={request.status} /></td>
                    <td>{formatDate(request.createdAt)}</td>
                    <td>
                      <Link className="admin-table-link" href={`/admin/returns/${request.id}`}>
                        <Eye aria-hidden="true" size={16} />
                        {"View"}
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
        noun={"requests"}
        onPageChange={setPage}
        pagination={pagination}
      />
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
