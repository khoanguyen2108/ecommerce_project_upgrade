import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { OrderStatus, PaymentStatus } from "@/features/orders/types";
import type { Pagination } from "@/lib/api/types";
import {
  getOrderStatusClass,
  getPaymentStatusClass,
} from "@/components/orders/order-format";

export function AdminOrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`order-status-badge ${getOrderStatusClass(status)}`}>
      {status}
    </span>
  );
}

export function AdminPaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`payment-status-badge ${getPaymentStatusClass(status)}`}>
      {status}
    </span>
  );
}

export function AdminFeedback({
  message,
  requestId,
  tone,
}: {
  message: string;
  requestId?: string;
  tone: "error" | "success";
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div
      className={`admin-feedback admin-feedback--${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" size={19} />
      <span>{message}</span>
      {requestId ? <small>Request {requestId}</small> : null}
    </div>
  );
}

export function AdminPaymentSafetyNote({ includeTransition = false }) {
  return (
    <div className="admin-safety-note" role="note">
      <Info aria-hidden="true" size={18} />
      <span>
        Paid state is finalized only by verified payOS webhook. Admin diagnostics
        are read-only for payment state.
        {includeTransition ? " Cancel/expire does not call payOS provider." : ""}
      </span>
    </div>
  );
}

export function AdminTableSkeleton({
  columns,
  rows,
}: {
  columns: number;
  rows: number;
}) {
  return Array.from({ length: rows }, (_, rowIndex) => (
    <tr aria-hidden="true" key={rowIndex}>
      {Array.from({ length: columns }, (_, columnIndex) => (
        <td key={columnIndex}>
          <span className="admin-skeleton-line" />
        </td>
      ))}
    </tr>
  ));
}

export function AdminPagination({
  isLoading,
  noun,
  onPageChange,
  pagination,
}: {
  isLoading: boolean;
  noun: string;
  onPageChange: (page: number) => void;
  pagination: Pagination;
}) {
  const totalPages = Math.max(1, pagination.totalPages);

  return (
    <nav className="admin-pagination" aria-label={`${noun} pagination`}>
      <button
        className="button button--secondary"
        disabled={isLoading || pagination.page <= 1}
        onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        type="button"
      >
        Previous
      </button>
      <span>
        Page {pagination.page} of {totalPages} ({pagination.total} {noun})
      </span>
      <button
        className="button button--secondary"
        disabled={isLoading || pagination.page >= totalPages}
        onClick={() => onPageChange(pagination.page + 1)}
        type="button"
      >
        Next
      </button>
    </nav>
  );
}
