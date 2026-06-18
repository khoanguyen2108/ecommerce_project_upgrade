"use client";

import { Eye, RefreshCw, RotateCcw, Search } from "lucide-react";
import Link from "next/link";
import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  AdminFeedback,
  AdminOrderStatusBadge,
  AdminPagination,
  AdminPaymentSafetyNote,
  AdminPaymentStatusBadge,
  AdminTableSkeleton,
} from "@/components/admin/AdminCommerceUi";
import { listAdminPayments } from "@/features/admin-payments/api";
import {
  getAdminPaymentErrorMessage,
  getAdminPaymentRequestId,
} from "@/features/admin-payments/errors";
import type {
  AdminPaymentQuery,
  AdminPaymentSort,
  AdminPaymentSortDirection,
  AdminPaymentSummary,
} from "@/features/admin-payments/types";
import type { PaymentProvider, PaymentStatus } from "@/features/orders/types";
import type { Pagination } from "@/lib/api/types";
import {
  formatCurrency,
  formatDateTime,
  formatOrderCode,
} from "@/components/orders/order-format";

const LIMIT = 20;
const PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "PAID", "FAILED", "CANCELLED", "EXPIRED"];

export function AdminPaymentsPage({ initialQuery }: { initialQuery: AdminPaymentQuery }) {
  const [query, setQuery] = useState<AdminPaymentQuery>({ ...initialQuery, limit: LIMIT, page: initialQuery.page || 1 });
  const [searchInput, setSearchInput] = useState(initialQuery.search || "");
  const [payments, setPayments] = useState<AdminPaymentSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ limit: LIMIT, page: initialQuery.page || 1, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setIsLoading(true);
      setError(undefined);
      setRequestId(undefined);
      try {
        const response = await listAdminPayments(query);
        if (active) { setPayments(response.payments); setPagination(response.pagination); }
      } catch (loadError) {
        if (active) {
          setPayments([]);
          setError(getAdminPaymentErrorMessage(loadError, "Payment diagnostics could not be loaded."));
          setRequestId(getAdminPaymentRequestId(loadError));
        }
      } finally { if (active) setIsLoading(false); }
    }
    void load();
    return () => { active = false; };
  }, [query, refreshKey]);

  function updateQuery(next: Partial<AdminPaymentQuery>) { setQuery((current) => ({ ...current, ...next, page: 1 })); }
  function submitSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); updateQuery({ search: searchInput.trim() || undefined }); }
  function resetFilters() { setSearchInput(""); setQuery({ limit: LIMIT, order: "desc", page: 1, sort: "createdAt" }); }

  const hasFilters = Boolean(query.status || query.provider || query.search || query.from || query.to || query.sort !== "createdAt" || query.order !== "desc");

  return (
    <div className="admin-resource admin-resource--wide">
      <section className="admin-resource__header" aria-labelledby="admin-payments-heading"><h1 id="admin-payments-heading">Payments</h1><button className="button button--secondary" disabled={isLoading} onClick={() => setRefreshKey((current) => current + 1)} type="button"><RefreshCw aria-hidden="true" className={isLoading ? "spin" : undefined} size={17} />Refresh</button></section>
      <AdminPaymentSafetyNote />

      <section className="admin-resource__toolbar" aria-label="Payment filters">
        <form className="admin-search" onSubmit={submitSearch}><label htmlFor="admin-payment-search">Search</label><div><input id="admin-payment-search" maxLength={160} onChange={(event) => setSearchInput(event.target.value)} placeholder="Email, payment/order ID, payOS code, or reference" type="search" value={searchInput} /><button className="button button--primary" type="submit"><Search aria-hidden="true" size={17} />Search</button></div></form>
        <div className="admin-filter-grid admin-filter-grid--commerce">
          <FilterSelect label="Status" value={query.status || ""} onChange={(value) => updateQuery({ status: (value || undefined) as PaymentStatus | undefined })}><option value="">All statuses</option>{PAYMENT_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}</FilterSelect>
          <FilterSelect label="Provider" value={query.provider || ""} onChange={(value) => updateQuery({ provider: (value || undefined) as PaymentProvider | undefined })}><option value="">All providers</option><option value="PAYOS">PAYOS</option></FilterSelect>
          <DateFilter label="From" value={query.from || ""} onChange={(value) => updateQuery({ from: value || undefined })} />
          <DateFilter label="To" value={query.to || ""} onChange={(value) => updateQuery({ to: value || undefined })} />
          <FilterSelect label="Sort" value={query.sort || "createdAt"} onChange={(value) => updateQuery({ sort: value as AdminPaymentSort })}><option value="createdAt">Created</option><option value="updatedAt">Updated</option><option value="paidAt">Paid time</option><option value="amount">Amount</option></FilterSelect>
          <FilterSelect label="Order" value={query.order || "desc"} onChange={(value) => updateQuery({ order: value as AdminPaymentSortDirection })}><option value="desc">Descending</option><option value="asc">Ascending</option></FilterSelect>
          <button className="button button--secondary" disabled={!hasFilters || isLoading} onClick={resetFilters} type="button"><RotateCcw aria-hidden="true" size={17} />Reset</button>
        </div>
      </section>

      {error ? <AdminFeedback message={error} requestId={requestId} tone="error" /> : null}

      <div className="admin-table-wrap admin-table-wrap--commerce"><table className="admin-table admin-table--commerce"><thead><tr><th>Payment</th><th>Provider</th><th>Status</th><th>Amount</th><th>Provider order code</th><th>Order</th><th>Order status</th><th>Customer</th><th>Failure reason</th><th>Created</th><th>Paid</th><th>Cancelled</th><th>Action</th></tr></thead><tbody>
        {isLoading ? <AdminTableSkeleton columns={13} rows={6} /> : null}
        {!isLoading && !error && payments.length === 0 ? <tr><td className="admin-table__state" colSpan={13}>No payments match the current filters.</td></tr> : null}
        {!isLoading && !error ? payments.map((payment) => <tr key={payment.id}>
          <td><span className="admin-code">{payment.id}</span></td><td>{payment.provider}</td><td><AdminPaymentStatusBadge status={payment.status} /></td><td>{formatCurrency(payment.amount, payment.currency)}</td><td>{formatOrderCode(payment.providerOrderCode)}</td>
          <td><Link className="admin-code admin-table-link" href={`/admin/orders/${encodeURIComponent(payment.order.id)}`}>{payment.order.id}</Link></td><td><AdminOrderStatusBadge status={payment.order.status} /></td><td><strong>{payment.user.email}</strong><small className="admin-table__secondary">{payment.user.name || "Name not set"}</small></td><td>{payment.failureReason || "Not set"}</td><td>{formatDateTime(payment.createdAt)}</td><td>{formatDateTime(payment.paidAt)}</td><td>{formatDateTime(payment.cancelledAt)}</td><td><Link aria-label={`View payment ${payment.id}`} className="icon-button admin-icon-button" href={`/admin/payments/${encodeURIComponent(payment.id)}`} title="View payment"><Eye aria-hidden="true" size={17} /></Link></td>
        </tr>) : null}
      </tbody></table></div>

      <AdminPagination isLoading={isLoading} noun="payments" onPageChange={(page) => setQuery((current) => ({ ...current, page }))} pagination={pagination} />
    </div>
  );
}

function FilterSelect({ children, label, onChange, value }: { children: ReactNode; label: string; onChange: (value: string) => void; value: string }) { return <label><span>{label}</span><select onChange={(event) => onChange(event.target.value)} value={value}>{children}</select></label>; }
function DateFilter({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) { return <label><span>{label}</span><input aria-label={label} onChange={(event) => onChange(event.target.value)} type="date" value={value} /></label>; }
