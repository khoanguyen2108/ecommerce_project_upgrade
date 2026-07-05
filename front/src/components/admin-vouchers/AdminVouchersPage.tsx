"use client";

import {
  Edit3,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  AdminFeedback,
  AdminPagination,
  AdminTableSkeleton,
} from "@/components/admin/AdminCommerceUi";
import { AdminModal } from "@/components/admin/AdminModal";
import {
  formatAdminDate,
  getApiErrorMessage,
  getApiRequestId,
  getBooleanFilterValue,
  normalizeNullableText,
  parseActiveFilter,
} from "@/components/admin/admin-format";
import {
  activateAdminVoucher,
  createAdminVoucher,
  deactivateAdminVoucher,
  deleteAdminVoucher,
  getAdminVoucher,
  listAdminVouchers,
  updateAdminVoucher,
} from "@/features/admin-vouchers/api";
import type {
  AdminVoucher,
  AdminVoucherQuery,
  AdminVoucherWriteRequest,
  VoucherDiscountType,
} from "@/features/admin-vouchers/types";
import type { Pagination } from "@/lib/api/types";

const VOUCHER_LIMIT = 8;
const VOUCHER_ERRORS: Record<string, string> = {
  AUTH_REQUIRED: "Your admin session is required. Sign in again to continue.",
  BAD_REQUEST: "Some voucher fields are invalid. Review the form and try again.",
  FORBIDDEN: "This account is not allowed to manage vouchers.",
  NETWORK_ERROR: "The voucher API could not be reached. Check the backend and retry.",
  VALIDATION_ERROR: "Some voucher fields are invalid. Review the form and try again.",
  VOUCHER_CODE_EXISTS: "Another voucher already uses this code.",
  VOUCHER_NOT_FOUND: "That voucher no longer exists.",
  VOUCHER_RULE_INVALID: "The voucher does not satisfy its business rules.",
  VOUCHER_UPDATE_EMPTY: "Change at least one voucher field before saving.",
  VOUCHER_DELETE_BLOCKED:
    "This voucher is attached to orders. Deactivate it instead.",
};

interface AdminVouchersPageProps {
  initialQuery: AdminVoucherQuery;
}

interface VoucherFormState {
  code: string;
  name: string;
  description: string;
  discountType: VoucherDiscountType;
  discountValue: string;
  minSubtotal: string;
  maxDiscount: string;
  usageLimit: string;
  perUserLimit: string;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
}

type ModalMode = "create" | "edit";

export function AdminVouchersPage({ initialQuery }: AdminVouchersPageProps) {
  const [query, setQuery] = useState<AdminVoucherQuery>({
    ...initialQuery,
    limit: VOUCHER_LIMIT,
    page: initialQuery.page || 1,
  });
  const [searchInput, setSearchInput] = useState(initialQuery.search || "");
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    limit: VOUCHER_LIMIT,
    page: query.page || 1,
    total: 0,
    totalPages: 1,
  });
  const [modalMode, setModalMode] = useState<ModalMode>("create");
  const [selectedVoucher, setSelectedVoucher] = useState<AdminVoucher>();
  const [form, setForm] = useState<VoucherFormState>(emptyVoucherForm());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string>();
  const [listError, setListError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);
  const savingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    async function loadVouchers() {
      setIsLoading(true);
      setListError(undefined);

      try {
        const response = await listAdminVouchers(query);
        if (!isMounted) return;

        const validPage = Math.min(
          query.page || 1,
          Math.max(1, response.pagination.totalPages),
        );
        if (validPage !== (query.page || 1)) {
          setQuery((current) => ({ ...current, page: validPage }));
          return;
        }

        setVouchers(response.vouchers);
        setPagination(response.pagination);
      } catch (error) {
        if (!isMounted) return;
        setVouchers([]);
        setListError(
          getApiErrorMessage(
            error,
            VOUCHER_ERRORS,
            "Admin vouchers could not be loaded right now.",
          ),
        );
        setRequestId(getApiRequestId(error));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    void loadVouchers();
    return () => {
      isMounted = false;
    };
  }, [query, refreshKey]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery((current) => ({
      ...current,
      page: 1,
      search: searchInput.trim() || undefined,
    }));
  }

  function openCreateModal() {
    setModalMode("create");
    setSelectedVoucher(undefined);
    setForm(emptyVoucherForm());
    resetActionFeedback();
    setIsModalOpen(true);
  }

  async function openEditModal(voucher: AdminVoucher) {
    setModalMode("edit");
    setSelectedVoucher(voucher);
    setForm(voucherForm(voucher));
    resetActionFeedback();
    setIsModalOpen(true);
    setIsDetailLoading(true);

    try {
      const response = await getAdminVoucher(voucher.id);
      setSelectedVoucher(response.voucher);
      setForm(voucherForm(response.voucher));
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          VOUCHER_ERRORS,
          "This voucher could not be opened right now.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingRef.current) return;

    resetActionFeedback();
    const validationError = validateVoucherForm(form);
    if (validationError) {
      setActionError(validationError);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    try {
      const payload = voucherPayload(form);
      if (modalMode === "create") {
        await createAdminVoucher(payload);
        setSuccessMessage("Voucher created.");
      } else if (selectedVoucher) {
        await updateAdminVoucher(selectedVoucher.id, payload);
        setSuccessMessage("Voucher updated.");
      }
      setIsModalOpen(false);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, VOUCHER_ERRORS, "Voucher could not be saved."),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  async function handleStatusChange(voucher: AdminVoucher) {
    if (busyAction) return;
    const nextActive = !voucher.isActive;
    if (!window.confirm(`${nextActive ? "Activate" : "Deactivate"} ${voucher.code}?`)) {
      return;
    }

    setBusyAction(voucher.id);
    resetActionFeedback();
    try {
      if (nextActive) await activateAdminVoucher(voucher.id);
      else await deactivateAdminVoucher(voucher.id);
      setSuccessMessage(`Voucher ${nextActive ? "activated" : "deactivated"}.`);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          VOUCHER_ERRORS,
          "Voucher status could not be changed.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function handleDelete(voucher: AdminVoucher) {
    if (busyAction) return;
    if (!window.confirm(`Delete ${voucher.code}? This cannot be undone.`)) return;

    setBusyAction(`${voucher.id}:delete`);
    resetActionFeedback();
    try {
      await deleteAdminVoucher(voucher.id);
      if (vouchers.length === 1 && (query.page || 1) > 1) {
        setQuery((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }));
      } else {
        setRefreshKey((current) => current + 1);
      }
      setSuccessMessage("Voucher deleted.");
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, VOUCHER_ERRORS, "Voucher could not be deleted."),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setBusyAction(undefined);
    }
  }

  function resetActionFeedback() {
    setActionError(undefined);
    setSuccessMessage(undefined);
    setRequestId(undefined);
  }

  const hasFilters = Boolean(query.search) || query.isActive !== undefined;
  const baselineForm =
    modalMode === "edit" && selectedVoucher
      ? voucherForm(selectedVoucher)
      : emptyVoucherForm();
  const hasUnsavedChanges =
    isModalOpen && JSON.stringify(form) !== JSON.stringify(baselineForm);

  return (
    <div className="admin-resource admin-resource--vouchers admin-resource--full-width">
      <section className="admin-resource__header" aria-labelledby="admin-vouchers-heading">
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">Promotion operations</p>
          <h1 id="admin-vouchers-heading">Vouchers Management</h1>
          <p>Create, schedule, and control voucher definitions.</p>
        </div>
        <div className="admin-header-actions">
          <button
            className="button button--secondary"
            disabled={isLoading}
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={17} />
            Refresh
          </button>
          <button className="button button--primary" onClick={openCreateModal} type="button">
            <Plus aria-hidden="true" size={17} />
            New voucher
          </button>
        </div>
      </section>

      <section
        aria-label="Voucher filters"
        className="admin-resource__toolbar admin-resource__toolbar--compact admin-resource__toolbar--inline admin-filter-surface"
      >
        <form className="admin-search" onSubmit={handleSearchSubmit}>
          <label htmlFor="admin-voucher-search">Search</label>
          <div>
            <input
              id="admin-voucher-search"
              maxLength={120}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Code or name"
              type="search"
              value={searchInput}
            />
            <button className="button button--primary" type="submit">
              <Search aria-hidden="true" size={17} />
              Search
            </button>
          </div>
        </form>

        <div className="admin-filter-grid admin-filter-grid--compact">
          <label>
            <span>Status</span>
            <select
              onChange={(event) =>
                setQuery((current) => ({
                  ...current,
                  isActive: parseActiveFilter(event.target.value),
                  page: 1,
                }))
              }
              value={getBooleanFilterValue(query.isActive)}
            >
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </label>
          <button
            className="button button--secondary"
            disabled={!hasFilters || isLoading}
            onClick={() => {
              setSearchInput("");
              setQuery({ limit: VOUCHER_LIMIT, page: 1 });
            }}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={17} />
            Reset
          </button>
        </div>
      </section>

      {successMessage ? <AdminFeedback message={successMessage} tone="success" /> : null}
      {!isModalOpen && actionError ? (
        <AdminFeedback message={actionError} requestId={requestId} tone="error" />
      ) : null}
      {listError ? <AdminFeedback message={listError} requestId={requestId} tone="error" /> : null}

      <section className="admin-resource__body admin-resource__body--full-width">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Value</th>
                <th>Min subtotal</th>
                <th>Max discount</th>
                <th>Usage limit</th>
                <th>Per-user limit</th>
                <th>Validity window</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <AdminTableSkeleton columns={11} rows={6} /> : null}
              {!isLoading && !listError && vouchers.length === 0 ? (
                <tr>
                  <td className="admin-table__state" colSpan={11}>
                    No vouchers match the current filters.
                  </td>
                </tr>
              ) : null}
              {!isLoading && !listError
                ? vouchers.map((voucher) => (
                    <tr
                      aria-label={`Open ${voucher.code}`}
                      className="admin-table__clickable-row"
                      key={voucher.id}
                      onClick={() => void openEditModal(voucher)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void openEditModal(voucher);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td><strong>{voucher.code}</strong></td>
                      <td>{voucher.name}</td>
                      <td>{voucher.discountType}</td>
                      <td>{formatDiscountValue(voucher)}</td>
                      <td>{formatMoney(voucher.minSubtotal)}</td>
                      <td>{voucher.maxDiscount === null ? "Not set" : formatMoney(voucher.maxDiscount)}</td>
                      <td>{voucher.usageLimit ?? "Unlimited"}</td>
                      <td>{voucher.perUserLimit ?? "Unlimited"}</td>
                      <td><ValidityWindow voucher={voucher} /></td>
                      <td>
                        <span className={`admin-badge ${voucher.isActive ? "admin-badge--neutral" : "admin-badge--muted"}`}>
                          {voucher.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <div
                          className="admin-row-actions"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <button
                            aria-label={`Edit ${voucher.code}`}
                            className="icon-button admin-icon-button"
                            onClick={() => void openEditModal(voucher)}
                            title="Edit voucher"
                            type="button"
                          >
                            <Edit3 aria-hidden="true" size={17} />
                          </button>
                          <button
                            className="admin-link-button admin-link-button--delete"
                            disabled={Boolean(busyAction)}
                            onClick={() => void handleDelete(voucher)}
                            type="button"
                          >
                            {busyAction === `${voucher.id}:delete` ? "Deleting" : "Delete"}
                          </button>
                          <button
                            className="admin-link-button"
                            disabled={Boolean(busyAction)}
                            onClick={() => void handleStatusChange(voucher)}
                            type="button"
                          >
                            {busyAction === voucher.id
                              ? "Working"
                              : voucher.isActive
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </section>

      <AdminPagination
        isLoading={isLoading}
        noun="vouchers"
        onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
        pagination={pagination}
      />

      <AdminModal
        closeDisabled={isSaving}
        compact
        footer={(requestClose) => (
          <>
            <button className="button button--secondary" disabled={isSaving} onClick={requestClose} type="button">
              Cancel
            </button>
            <button
              className="button button--primary"
              disabled={isSaving || isDetailLoading}
              form="admin-voucher-form"
              type="submit"
            >
              <Save aria-hidden="true" size={17} />
              {isSaving ? "Saving" : modalMode === "create" ? "Create" : "Save"}
            </button>
          </>
        )}
        hasUnsavedChanges={hasUnsavedChanges}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={modalMode === "create" ? "New voucher" : `Edit ${selectedVoucher?.code || "voucher"}`}
      >
        {actionError ? <AdminFeedback message={actionError} requestId={requestId} tone="error" /> : null}
        <VoucherForm
          form={form}
          isDisabled={isDetailLoading}
          onChange={setForm}
          onSubmit={handleSave}
        />
      </AdminModal>
    </div>
  );
}

function VoucherForm({
  form,
  isDisabled,
  onChange,
  onSubmit,
}: {
  form: VoucherFormState;
  isDisabled: boolean;
  onChange: (form: VoucherFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = <K extends keyof VoucherFormState>(key: K, value: VoucherFormState[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <form className="admin-form admin-compact-form" id="admin-voucher-form" onSubmit={onSubmit}>
      <section className="admin-compact-group" aria-labelledby="voucher-identity-heading">
        <h3 id="voucher-identity-heading">Identity</h3>
        <div className="admin-compact-fields">
          <label>
            <span>Code</span>
            <input disabled={isDisabled} maxLength={64} onChange={(event) => update("code", event.target.value.toUpperCase())} required value={form.code} />
          </label>
          <label>
            <span>Name</span>
            <input disabled={isDisabled} maxLength={160} onChange={(event) => update("name", event.target.value)} required value={form.name} />
          </label>
          <label className="admin-compact-field--wide">
            <span>Description</span>
            <textarea disabled={isDisabled} maxLength={2000} onChange={(event) => update("description", event.target.value)} value={form.description} />
          </label>
        </div>
      </section>

      <section className="admin-compact-group" aria-labelledby="voucher-discount-heading">
        <h3 id="voucher-discount-heading">Discount</h3>
        <div className="admin-compact-fields">
          <label>
            <span>Discount type</span>
            <select disabled={isDisabled} onChange={(event) => update("discountType", event.target.value as VoucherDiscountType)} value={form.discountType}>
              <option value="PERCENT">Percent</option>
              <option value="FIXED">Fixed</option>
            </select>
          </label>
          <NumberField disabled={isDisabled} label="Discount value" onChange={(value) => update("discountValue", value)} required value={form.discountValue} />
          <NumberField disabled={isDisabled} label="Min subtotal" min="0" onChange={(value) => update("minSubtotal", value)} required value={form.minSubtotal} />
          <NumberField disabled={isDisabled} label="Max discount" onChange={(value) => update("maxDiscount", value)} value={form.maxDiscount} />
        </div>
      </section>

      <section className="admin-compact-group" aria-labelledby="voucher-limits-heading">
        <h3 id="voucher-limits-heading">Limits and validity</h3>
        <div className="admin-compact-fields">
          <NumberField disabled={isDisabled} label="Usage limit" onChange={(value) => update("usageLimit", value)} value={form.usageLimit} />
          <NumberField disabled={isDisabled} label="Per user limit" onChange={(value) => update("perUserLimit", value)} value={form.perUserLimit} />
          <label>
            <span>Starts at</span>
            <input disabled={isDisabled} onChange={(event) => update("startsAt", event.target.value)} type="datetime-local" value={form.startsAt} />
          </label>
          <label>
            <span>Ends at</span>
            <input disabled={isDisabled} onChange={(event) => update("endsAt", event.target.value)} type="datetime-local" value={form.endsAt} />
          </label>
          <label className="admin-checkbox admin-compact-checkbox admin-compact-field--wide">
            <input checked={form.isActive} disabled={isDisabled} onChange={(event) => update("isActive", event.target.checked)} type="checkbox" />
            <span>Active</span>
          </label>
        </div>
      </section>
    </form>
  );
}

function NumberField({
  disabled,
  label,
  min = "1",
  onChange,
  required = false,
  value,
}: {
  disabled: boolean;
  label: string;
  min?: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  return (
    <label>
      <span>{label}</span>
      <input disabled={disabled} min={min} onChange={(event) => onChange(event.target.value)} required={required} step="1" type="number" value={value} />
    </label>
  );
}

function ValidityWindow({ voucher }: { voucher: AdminVoucher }) {
  if (!voucher.startsAt && !voucher.endsAt) return <>Always</>;
  return (
    <span className="admin-voucher-validity">
      <span>From {voucher.startsAt ? formatAdminDate(voucher.startsAt) : "any time"}</span>
      <span>To {voucher.endsAt ? formatAdminDate(voucher.endsAt) : "no end"}</span>
    </span>
  );
}

function emptyVoucherForm(): VoucherFormState {
  return {
    code: "",
    name: "",
    description: "",
    discountType: "PERCENT",
    discountValue: "",
    minSubtotal: "0",
    maxDiscount: "",
    usageLimit: "",
    perUserLimit: "",
    startsAt: "",
    endsAt: "",
    isActive: true,
  };
}

function voucherForm(voucher: AdminVoucher): VoucherFormState {
  return {
    code: voucher.code,
    name: voucher.name,
    description: voucher.description || "",
    discountType: voucher.discountType,
    discountValue: String(voucher.discountValue),
    minSubtotal: String(voucher.minSubtotal),
    maxDiscount: nullableNumber(voucher.maxDiscount),
    usageLimit: nullableNumber(voucher.usageLimit),
    perUserLimit: nullableNumber(voucher.perUserLimit),
    startsAt: toDateTimeLocal(voucher.startsAt),
    endsAt: toDateTimeLocal(voucher.endsAt),
    isActive: voucher.isActive,
  };
}

function voucherPayload(form: VoucherFormState): AdminVoucherWriteRequest {
  return {
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    description: normalizeNullableText(form.description),
    discountType: form.discountType,
    discountValue: Number(form.discountValue),
    minSubtotal: Number(form.minSubtotal),
    maxDiscount: optionalInteger(form.maxDiscount),
    usageLimit: optionalInteger(form.usageLimit),
    perUserLimit: optionalInteger(form.perUserLimit),
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    isActive: form.isActive,
  };
}

function validateVoucherForm(form: VoucherFormState): string | undefined {
  const code = form.code.trim();
  if (!code) return "Code is required.";
  if (/\s/.test(code)) return "Code must not contain spaces.";
  if (!form.name.trim()) return "Name is required.";

  const discountValue = Number(form.discountValue);
  if (!Number.isInteger(discountValue) || discountValue <= 0) {
    return "Discount value must be a positive whole number.";
  }
  if (form.discountType === "PERCENT" && discountValue > 100) {
    return "Percent discount value cannot exceed 100.";
  }

  const minSubtotal = Number(form.minSubtotal);
  if (!Number.isInteger(minSubtotal) || minSubtotal < 0) {
    return "Minimum subtotal must be a non-negative whole number.";
  }

  for (const [label, value] of [
    ["Maximum discount", form.maxDiscount],
    ["Usage limit", form.usageLimit],
    ["Per-user limit", form.perUserLimit],
  ] as const) {
    if (value && (!Number.isInteger(Number(value)) || Number(value) <= 0)) {
      return `${label} must be a positive whole number.`;
    }
  }

  if (form.startsAt && form.endsAt && new Date(form.startsAt) >= new Date(form.endsAt)) {
    return "Start date must be before end date.";
  }
  return undefined;
}

function optionalInteger(value: string): number | null {
  return value === "" ? null : Number(value);
}

function nullableNumber(value: number | null): string {
  return value === null ? "" : String(value);
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function formatMoney(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
}

function formatDiscountValue(voucher: AdminVoucher): string {
  return voucher.discountType === "PERCENT"
    ? `${voucher.discountValue}%`
    : formatMoney(voucher.discountValue);
}
