"use client";

import {
  Edit3,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
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
import {
  formatAdminCatalogMoney,
  formatAdminCatalogNumber,
  formatAdminCatalogPercent,
  getAdminCatalogErrorMessage,
  getAdminCatalogTranslations,
  type AdminCatalogTranslations,
} from "@/features/i18n/admin-catalog-translations";
import { useI18n } from "@/features/i18n/useI18n";
import type { Locale } from "@/features/i18n/locale";
import type { Pagination } from "@/lib/api/types";

const VOUCHER_LIMIT = 8;

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
  const { locale } = useI18n();
  const copy = getAdminCatalogTranslations(locale);
  const copyRef = useRef(copy);
  copyRef.current = copy;
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
          getAdminCatalogErrorMessage(
            error,
            copyRef.current.vouchers.errors,
            copyRef.current.vouchers.feedback.listLoadError,
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
        getAdminCatalogErrorMessage(
          error,
          copy.vouchers.errors,
          copy.vouchers.feedback.openError,
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
    const validationError = validateVoucherForm(form, copy.vouchers.validation);
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
        setSuccessMessage(copy.vouchers.feedback.created);
      } else if (selectedVoucher) {
        await updateAdminVoucher(selectedVoucher.id, payload);
        setSuccessMessage(copy.vouchers.feedback.updated);
      }
      setIsModalOpen(false);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setActionError(
        getAdminCatalogErrorMessage(
          error,
          copy.vouchers.errors,
          copy.vouchers.feedback.saveError,
        ),
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
    if (!window.confirm(copy.vouchers.confirm.status(nextActive, voucher.code))) {
      return;
    }

    setBusyAction(voucher.id);
    resetActionFeedback();
    try {
      if (nextActive) await activateAdminVoucher(voucher.id);
      else await deactivateAdminVoucher(voucher.id);
      setSuccessMessage(
        nextActive
          ? copy.vouchers.feedback.activated
          : copy.vouchers.feedback.deactivated,
      );
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setActionError(
        getAdminCatalogErrorMessage(
          error,
          copy.vouchers.errors,
          copy.vouchers.feedback.statusError,
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function handleDelete(voucher: AdminVoucher) {
    if (busyAction) return;
    if (!window.confirm(copy.vouchers.confirm.delete(voucher.code))) return;

    setBusyAction(`${voucher.id}:delete`);
    resetActionFeedback();
    try {
      await deleteAdminVoucher(voucher.id);
      if (vouchers.length === 1 && (query.page || 1) > 1) {
        setQuery((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }));
      } else {
        setRefreshKey((current) => current + 1);
      }
      setSuccessMessage(copy.vouchers.feedback.deleted);
    } catch (error) {
      setActionError(
        getAdminCatalogErrorMessage(
          error,
          copy.vouchers.errors,
          copy.vouchers.feedback.deleteError,
        ),
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
  const commonCopy = copy.common;
  const voucherCopy = copy.vouchers;

  return (
    <div className="admin-resource admin-resource--vouchers admin-resource--full-width">
      <section className="admin-resource__header" aria-labelledby="admin-vouchers-heading">
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">{voucherCopy.header.eyebrow}</p>
          <h1 id="admin-vouchers-heading">{voucherCopy.header.title}</h1>
          <p>{voucherCopy.header.subtitle}</p>
        </div>
        <div className="admin-header-actions">
          <button
            className="button button--secondary"
            disabled={isLoading}
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={17} />
            {commonCopy.refresh}
          </button>
          <button className="button button--primary" onClick={openCreateModal} type="button">
            <Plus aria-hidden="true" size={17} />
            {voucherCopy.header.newVoucher}
          </button>
        </div>
      </section>

      <section
        aria-label={voucherCopy.filters.aria}
        className="admin-resource__toolbar admin-resource__toolbar--compact admin-resource__toolbar--inline admin-filter-surface"
      >
        <form className="admin-search" onSubmit={handleSearchSubmit}>
          <label htmlFor="admin-voucher-search">{commonCopy.search}</label>
          <div>
            <input
              id="admin-voucher-search"
              maxLength={120}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={voucherCopy.filters.searchPlaceholder}
              type="search"
              value={searchInput}
            />
            <button className="button button--primary" type="submit">
              <Search aria-hidden="true" size={17} />
              {commonCopy.search}
            </button>
          </div>
        </form>

        <div className="admin-filter-grid admin-filter-grid--compact">
          <label>
            <span>{commonCopy.status}</span>
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
              <option value="">{commonCopy.allStatuses}</option>
              <option value="true">{commonCopy.active}</option>
              <option value="false">{commonCopy.inactive}</option>
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
            {commonCopy.reset}
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
                <th>{voucherCopy.table.code}</th>
                <th>{commonCopy.name}</th>
                <th>{voucherCopy.table.type}</th>
                <th>{voucherCopy.table.value}</th>
                <th>{voucherCopy.table.minSubtotal}</th>
                <th>{voucherCopy.table.maxDiscount}</th>
                <th>{voucherCopy.table.usageLimit}</th>
                <th>{voucherCopy.table.perUserLimit}</th>
                <th>{voucherCopy.table.validityWindow}</th>
                <th>{commonCopy.status}</th>
                <th>{commonCopy.actions}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <AdminTableSkeleton columns={11} rows={6} /> : null}
              {!isLoading && !listError && vouchers.length === 0 ? (
                <tr>
                  <td className="admin-table__state" colSpan={11}>
                    {voucherCopy.table.empty}
                  </td>
                </tr>
              ) : null}
              {!isLoading && !listError
                ? vouchers.map((voucher) => (
                    <tr
                      aria-label={voucherCopy.table.openAria(voucher.code)}
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
                      <td>
                        {voucher.discountType === "PERCENT"
                          ? voucherCopy.table.percent
                          : voucherCopy.table.fixed}
                      </td>
                      <td>{formatDiscountValue(voucher, locale)}</td>
                      <td>{formatAdminCatalogMoney(voucher.minSubtotal, locale)}</td>
                      <td>
                        {voucher.maxDiscount === null
                          ? commonCopy.notSet
                          : formatAdminCatalogMoney(voucher.maxDiscount, locale)}
                      </td>
                      <td>
                        {voucher.usageLimit === null
                          ? voucherCopy.table.unlimited
                          : formatAdminCatalogNumber(voucher.usageLimit, locale)}
                      </td>
                      <td>
                        {voucher.perUserLimit === null
                          ? voucherCopy.table.unlimited
                          : formatAdminCatalogNumber(voucher.perUserLimit, locale)}
                      </td>
                      <td>
                        <ValidityWindow copy={voucherCopy} locale={locale} voucher={voucher} />
                      </td>
                      <td>
                        <span className={`admin-badge ${voucher.isActive ? "admin-badge--neutral" : "admin-badge--muted"}`}>
                          {voucher.isActive ? commonCopy.active : commonCopy.inactive}
                        </span>
                      </td>
                      <td>
                        <div
                          className="admin-row-actions"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <button
                            aria-label={voucherCopy.table.editAria(voucher.code)}
                            className="icon-button admin-icon-button"
                            onClick={() => void openEditModal(voucher)}
                            title={voucherCopy.table.editTitle}
                            type="button"
                          >
                            <Edit3 aria-hidden="true" size={17} />
                          </button>
                          <button
                            aria-label={`${commonCopy.delete}: ${voucher.code}`}
                            className="icon-button admin-icon-button admin-icon-button--delete"
                            disabled={Boolean(busyAction)}
                            onClick={() => void handleDelete(voucher)}
                            title={
                              busyAction === `${voucher.id}:delete`
                                ? commonCopy.deleting
                                : commonCopy.delete
                            }
                            type="button"
                          >
                            <Trash2 aria-hidden="true" size={17} />
                          </button>
                          <button
                            className="admin-link-button"
                            disabled={Boolean(busyAction)}
                            onClick={() => void handleStatusChange(voucher)}
                            type="button"
                          >
                            {busyAction === voucher.id
                              ? voucherCopy.table.working
                              : voucher.isActive
                                ? commonCopy.deactivate
                                : commonCopy.activate}
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
        noun={voucherCopy.noun}
        onPageChange={(page) => setQuery((current) => ({ ...current, page }))}
        pagination={pagination}
      />

      <AdminModal
        closeDisabled={isSaving}
        compact
        footer={(requestClose) => (
          <>
            <button className="button button--secondary" disabled={isSaving} onClick={requestClose} type="button">
              {commonCopy.cancel}
            </button>
            <button
              className="button button--primary"
              disabled={isSaving || isDetailLoading}
              form="admin-voucher-form"
              type="submit"
            >
              <Save aria-hidden="true" size={17} />
              {isSaving
                ? commonCopy.saving
                : modalMode === "create"
                  ? commonCopy.create
                  : commonCopy.save}
            </button>
          </>
        )}
        hasUnsavedChanges={hasUnsavedChanges}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          modalMode === "create"
            ? voucherCopy.form.newTitle
            : voucherCopy.form.editTitle(
                selectedVoucher?.code || voucherCopy.form.voucherFallback,
              )
        }
      >
        {actionError ? <AdminFeedback message={actionError} requestId={requestId} tone="error" /> : null}
        <VoucherForm
          copy={copy}
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
  copy,
  form,
  isDisabled,
  onChange,
  onSubmit,
}: {
  copy: AdminCatalogTranslations;
  form: VoucherFormState;
  isDisabled: boolean;
  onChange: (form: VoucherFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const commonCopy = copy.common;
  const voucherCopy = copy.vouchers;
  const update = <K extends keyof VoucherFormState>(key: K, value: VoucherFormState[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <form className="admin-form admin-compact-form" id="admin-voucher-form" onSubmit={onSubmit}>
      <section className="admin-compact-group" aria-labelledby="voucher-identity-heading">
        <h3 id="voucher-identity-heading">{voucherCopy.form.identity}</h3>
        <div className="admin-compact-fields">
          <label>
            <span>{voucherCopy.form.code}</span>
            <input disabled={isDisabled} maxLength={64} onChange={(event) => update("code", event.target.value.toUpperCase())} required value={form.code} />
          </label>
          <label>
            <span>{commonCopy.name}</span>
            <input disabled={isDisabled} maxLength={160} onChange={(event) => update("name", event.target.value)} required value={form.name} />
          </label>
          <label className="admin-compact-field--wide">
            <span>{commonCopy.description}</span>
            <textarea disabled={isDisabled} maxLength={2000} onChange={(event) => update("description", event.target.value)} value={form.description} />
          </label>
        </div>
      </section>

      <section className="admin-compact-group" aria-labelledby="voucher-discount-heading">
        <h3 id="voucher-discount-heading">{voucherCopy.form.discount}</h3>
        <div className="admin-compact-fields">
          <label>
            <span>{voucherCopy.form.discountType}</span>
            <select disabled={isDisabled} onChange={(event) => update("discountType", event.target.value as VoucherDiscountType)} value={form.discountType}>
              <option value="PERCENT">{voucherCopy.form.percent}</option>
              <option value="FIXED">{voucherCopy.form.fixed}</option>
            </select>
          </label>
          <NumberField disabled={isDisabled} label={voucherCopy.form.discountValue} onChange={(value) => update("discountValue", value)} required value={form.discountValue} />
          <NumberField disabled={isDisabled} label={voucherCopy.form.minSubtotal} min="0" onChange={(value) => update("minSubtotal", value)} required value={form.minSubtotal} />
          <NumberField disabled={isDisabled} label={voucherCopy.form.maxDiscount} onChange={(value) => update("maxDiscount", value)} value={form.maxDiscount} />
        </div>
      </section>

      <section className="admin-compact-group" aria-labelledby="voucher-limits-heading">
        <h3 id="voucher-limits-heading">{voucherCopy.form.limits}</h3>
        <div className="admin-compact-fields">
          <NumberField disabled={isDisabled} label={voucherCopy.form.usageLimit} onChange={(value) => update("usageLimit", value)} value={form.usageLimit} />
          <NumberField disabled={isDisabled} label={voucherCopy.form.perUserLimit} onChange={(value) => update("perUserLimit", value)} value={form.perUserLimit} />
          <label>
            <span>{voucherCopy.form.startsAt}</span>
            <input disabled={isDisabled} onChange={(event) => update("startsAt", event.target.value)} type="datetime-local" value={form.startsAt} />
          </label>
          <label>
            <span>{voucherCopy.form.endsAt}</span>
            <input disabled={isDisabled} onChange={(event) => update("endsAt", event.target.value)} type="datetime-local" value={form.endsAt} />
          </label>
          <label className="admin-checkbox admin-compact-checkbox admin-compact-field--wide">
            <input checked={form.isActive} disabled={isDisabled} onChange={(event) => update("isActive", event.target.checked)} type="checkbox" />
            <span>{commonCopy.active}</span>
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

function ValidityWindow({
  copy,
  locale,
  voucher,
}: {
  copy: AdminCatalogTranslations["vouchers"];
  locale: Locale;
  voucher: AdminVoucher;
}) {
  if (!voucher.startsAt && !voucher.endsAt) return <>{copy.form.always}</>;

  const lines = copy.form.validity(
    voucher.startsAt
      ? formatAdminDate(voucher.startsAt, locale)
      : copy.form.anyTime,
    voucher.endsAt
      ? formatAdminDate(voucher.endsAt, locale)
      : copy.form.noEnd,
  ).split("\n");

  return (
    <span className="admin-voucher-validity">
      {lines.map((line) => <span key={line}>{line}</span>)}
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

function validateVoucherForm(
  form: VoucherFormState,
  copy: AdminCatalogTranslations["vouchers"]["validation"],
): string | undefined {
  const code = form.code.trim();
  if (!code) return copy.codeRequired;
  if (/\s/.test(code)) return copy.codeSpaces;
  if (!form.name.trim()) return copy.nameRequired;

  const discountValue = Number(form.discountValue);
  if (!Number.isInteger(discountValue) || discountValue <= 0) {
    return copy.discountValue;
  }
  if (form.discountType === "PERCENT" && discountValue > 100) {
    return copy.percentLimit;
  }

  const minSubtotal = Number(form.minSubtotal);
  if (!Number.isInteger(minSubtotal) || minSubtotal < 0) {
    return copy.minSubtotal;
  }

  for (const [label, value] of [
    [copy.maximumDiscount, form.maxDiscount],
    [copy.usageLimit, form.usageLimit],
    [copy.perUserLimit, form.perUserLimit],
  ] as const) {
    if (value && (!Number.isInteger(Number(value)) || Number(value) <= 0)) {
      return copy.positiveInteger(label);
    }
  }

  if (form.startsAt && form.endsAt && new Date(form.startsAt) >= new Date(form.endsAt)) {
    return copy.dateOrder;
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

function formatDiscountValue(voucher: AdminVoucher, locale: Locale): string {
  return voucher.discountType === "PERCENT"
    ? formatAdminCatalogPercent(voucher.discountValue, locale)
    : formatAdminCatalogMoney(voucher.discountValue, locale);
}
