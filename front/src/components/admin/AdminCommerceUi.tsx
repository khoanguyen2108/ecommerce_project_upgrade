"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { OrderStatus, PaymentStatus } from "@/features/orders/types";
import type { Pagination } from "@/lib/api/types";
import {
  formatAdminPaginationLabel,
  formatAdminPaginationSummary,
  useAdminCommonI18n,
} from "@/features/i18n/admin-common-translations";
import {
  getOrderStatusClass,
  getOrderStatusLabel,
  getPaymentStatusClass,
  getPaymentStatusLabel,
} from "@/components/orders/order-format";

export function AdminOrderStatusBadge({ status }: { status: OrderStatus }) {
  const { locale } = useAdminCommonI18n();

  return (
    <span className={`order-status-badge ${getOrderStatusClass(status)}`}>
      {getOrderStatusLabel(status, locale)}
    </span>
  );
}

export function AdminPaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { locale } = useAdminCommonI18n();

  return (
    <span className={`payment-status-badge ${getPaymentStatusClass(status)}`}>
      {getPaymentStatusLabel(status, locale)}
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
  const { messages } = useAdminCommonI18n();

  return (
    <div
      className={`admin-feedback admin-feedback--${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <Icon aria-hidden="true" size={19} />
      <span>{message}</span>
      {requestId ? <small>{messages.common.request} {requestId}</small> : null}
    </div>
  );
}

export function AdminPaymentSafetyNote({ includeTransition = false }) {
  const { messages } = useAdminCommonI18n();

  return (
    <div className="admin-safety-note" role="note">
      <Info aria-hidden="true" size={18} />
      <span>
        {messages.commerce.paymentSafety}
        {includeTransition ? ` ${messages.commerce.paymentSafetyTransition}` : ""}
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
  const { locale, messages } = useAdminCommonI18n();

  return (
    <nav
      className="admin-pagination"
      aria-label={formatAdminPaginationLabel(locale, noun)}
    >
      <button
        className="button button--secondary"
        disabled={isLoading || pagination.page <= 1}
        onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        type="button"
      >
        {messages.common.previous}
      </button>
      <span>
        {formatAdminPaginationSummary(
          locale,
          pagination.page,
          totalPages,
          pagination.total,
          noun,
        )}
      </span>
      <button
        className="button button--secondary"
        disabled={isLoading || pagination.page >= totalPages}
        onClick={() => onPageChange(pagination.page + 1)}
        type="button"
      >
        {messages.common.next}
      </button>
    </nav>
  );
}
