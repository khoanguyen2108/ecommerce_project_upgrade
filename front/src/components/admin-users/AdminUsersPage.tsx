"use client";

import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  activateAdminUser,
  deactivateAdminUser,
  deleteAdminUser,
  getAdminUser,
  listAdminUsers,
  updateAdminUser,
  updateAdminUserRole,
  updateAdminUserStatus,
} from "@/features/admin-users/api";
import type {
  AdminUser,
  AdminUserQuery,
} from "@/features/admin-users/types";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import type { AuthProvider, UserRole } from "@/features/auth/types";
import type { Pagination } from "@/lib/api/types";
import { ApiClientError } from "@/lib/errors/api-error";
import { AdminModal } from "@/components/admin/AdminModal";
import { formatNumber } from "@/components/orders/order-format";
import {
  formatAdminDate,
  formatOptional,
  getApiRequestId,
  getBooleanFilterValue,
  normalizeNullableText,
  parseActiveFilter,
} from "@/components/admin/admin-format";
import {
  getAdminOperationsTranslations,
  type AdminOperationsTranslations,
} from "@/features/i18n/admin-operations-translations";
import type { Locale } from "@/features/i18n/locale";
import { useI18n } from "@/features/i18n/useI18n";

const USER_LIMIT = 8;
const ROLE_OPTIONS: UserRole[] = ["CUSTOMER", "STAFF", "ADMIN"];
const AUTH_PROVIDER_OPTIONS: AuthProvider[] = ["EMAIL", "GOOGLE"];

interface AdminUsersPageProps {
  initialQuery: AdminUserQuery;
}

interface UserFormState {
  isActive: boolean;
  name: string;
  phone: string;
  role: UserRole;
}

type UserErrorFallback =
  | "delete"
  | "empty"
  | "list"
  | "open"
  | "selfDelete"
  | "status"
  | "update";

interface UserUiError {
  cause?: unknown;
  fallback: UserErrorFallback;
}

type UserSuccess = "activated" | "deactivated" | "deleted" | "updated";

export function AdminUsersPage({ initialQuery }: AdminUsersPageProps) {
  const { currentUser } = useAuthSession();
  const { locale } = useI18n();
  const copy = getAdminOperationsTranslations(locale);
  const [query, setQuery] = useState<AdminUserQuery>({
    ...initialQuery,
    limit: USER_LIMIT,
    page: initialQuery.page || 1,
  });
  const [searchInput, setSearchInput] = useState(initialQuery.search || "");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    limit: USER_LIMIT,
    page: query.page || 1,
    total: 0,
    totalPages: 1,
  });
  const [selectedUser, setSelectedUser] = useState<AdminUser>();
  const [form, setForm] = useState<UserFormState>({
    isActive: true,
    name: "",
    phone: "",
    role: "CUSTOMER",
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string>();
  const [listError, setListError] = useState<UserUiError>();
  const [actionError, setActionError] = useState<UserUiError>();
  const [requestId, setRequestId] = useState<string>();
  const [success, setSuccess] = useState<UserSuccess>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadUsers() {
      setIsLoading(true);
      setListError(undefined);

      try {
        const response = await listAdminUsers(query);

        if (!isMounted) {
          return;
        }

        const validPage = Math.min(
          query.page || 1,
          Math.max(1, response.pagination.totalPages),
        );

        if (validPage !== (query.page || 1)) {
          setQuery((current) => ({ ...current, page: validPage }));
          return;
        }

        setUsers(response.users);
        setPagination(response.pagination);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setUsers([]);
        setListError({ cause: error, fallback: "list" });
        setRequestId(getApiRequestId(error));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadUsers();

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

  function handleFilterChange(nextQuery: Partial<AdminUserQuery>) {
    setQuery((current) => ({
      ...current,
      ...nextQuery,
      page: 1,
    }));
  }

  function goToPage(page: number) {
    setQuery((current) => ({
      ...current,
      page,
    }));
  }

  async function openUserDetail(user: AdminUser) {
    setSelectedUser(user);
    setForm(getUserFormState(user));
    setActionError(undefined);
    setSuccess(undefined);
    setRequestId(undefined);
    setIsModalOpen(true);
    setIsDetailLoading(true);

    try {
      const response = await getAdminUser(user.id);

      setSelectedUser(response.user);
      setForm(getUserFormState(response.user));
    } catch (error) {
      setActionError({ cause: error, fallback: "open" });
      setRequestId(getApiRequestId(error));
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function handleUserSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedUser) {
      return;
    }

    setActionError(undefined);
    setSuccess(undefined);
    setRequestId(undefined);

    const name = normalizeNullableText(form.name);
    const phone = normalizeNullableText(form.phone);
    const profileChanged = name !== selectedUser.name || phone !== selectedUser.phone;
    const roleChanged = form.role !== selectedUser.role;
    const statusChanged = form.isActive !== selectedUser.isActive;

    if (!profileChanged && !roleChanged && !statusChanged) {
      setActionError({ fallback: "empty" });
      return;
    }

    if (
      statusChanged &&
      !window.confirm(
        copy.users.confirmStatus(form.isActive, selectedUser.email),
      )
    ) {
      return;
    }

    setIsSaving(true);

    try {
      let updatedUser = selectedUser;

      if (profileChanged) {
        const response = await updateAdminUser(selectedUser.id, { name, phone });
        updatedUser = response.user;
        syncUser(updatedUser);
      }

      if (roleChanged) {
        const response = await updateAdminUserRole(selectedUser.id, {
          role: form.role,
        });
        updatedUser = response.user;
        syncUser(updatedUser);
      }

      if (statusChanged) {
        const response = await updateAdminUserStatus(selectedUser.id, {
          isActive: form.isActive,
        });
        updatedUser = response.user;
        syncUser(updatedUser);
      }

      setForm(getUserFormState(updatedUser));
      setRefreshKey((current) => current + 1);
      setSuccess("updated");
      setIsModalOpen(false);
    } catch (error) {
      setActionError({ cause: error, fallback: "update" });
      setRequestId(getApiRequestId(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(user: AdminUser) {
    const nextIsActive = !user.isActive;

    if (
      !window.confirm(
        copy.users.confirmStatus(nextIsActive, user.email),
      )
    ) {
      return;
    }

    const actionKey = `${user.id}:status`;

    setBusyAction(actionKey);
    setActionError(undefined);
    setSuccess(undefined);
    setRequestId(undefined);

    try {
      const response = nextIsActive
        ? await activateAdminUser(user.id)
        : await deactivateAdminUser(user.id);

      syncUser(response.user);
      setRefreshKey((current) => current + 1);
      setSuccess(response.user.isActive ? "activated" : "deactivated");
    } catch (error) {
      setActionError({ cause: error, fallback: "status" });
      setRequestId(getApiRequestId(error));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function handleDelete(user: AdminUser) {
    if (user.id === currentUser?.id) {
      setActionError({ fallback: "selfDelete" });
      return;
    }
    if (!window.confirm(copy.users.deleteConfirm(user.email))) return;

    setBusyAction(`${user.id}:delete`);
    setActionError(undefined);
    setSuccess(undefined);
    setRequestId(undefined);
    try {
      await deleteAdminUser(user.id);
      if (users.length === 1 && (query.page || 1) > 1) {
        setQuery((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }));
      } else {
        setRefreshKey((current) => current + 1);
      }
      setSuccess("deleted");
    } catch (error) {
      setActionError({ cause: error, fallback: "delete" });
      setRequestId(getApiRequestId(error));
    } finally {
      setBusyAction(undefined);
    }
  }

  function syncUser(user: AdminUser) {
    setUsers((current) =>
      current.map((item) => (item.id === user.id ? user : item)),
    );
    setSelectedUser((current) => (current?.id === user.id ? user : current));
    setForm((current) =>
      selectedUser?.id === user.id ? getUserFormState(user) : current,
    );
  }

  const hasFilters =
    Boolean(query.search) ||
    Boolean(query.role) ||
    Boolean(query.authProvider) ||
    query.isActive !== undefined;
  const hasUnsavedChanges = selectedUser
    ? !areUserFormsEqual(form, getUserFormState(selectedUser))
    : false;
  const listErrorMessage = listError
    ? getUserErrorMessage(listError, copy)
    : undefined;
  const actionErrorMessage = actionError
    ? getUserErrorMessage(actionError, copy)
    : undefined;
  const successMessage = success
    ? success === "activated"
      ? copy.users.userStatusActivated
      : success === "deactivated"
        ? copy.users.userStatusDeactivated
        : success === "deleted"
          ? copy.users.userDeleted
          : copy.users.userUpdated
    : undefined;

  return (
    <div className="admin-resource admin-resource--full-width">
      <section className="admin-resource__header" aria-labelledby="admin-users-heading">
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">{copy.users.eyebrow}</p>
          <h1 id="admin-users-heading">{copy.users.title}</h1>
          <p>{copy.users.subtitle}</p>
        </div>
        <button
          className="button button--secondary"
          disabled={isLoading}
          onClick={() => setRefreshKey((current) => current + 1)}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={17} />
          {copy.common.refresh}
        </button>
      </section>

      <section
        className="admin-resource__toolbar admin-resource__toolbar--compact admin-resource__toolbar--inline admin-filter-surface"
        aria-label={copy.users.filtersAria}
      >
        <form className="admin-search" onSubmit={handleSearchSubmit}>
          <label htmlFor="admin-user-search">{copy.users.search}</label>
          <div>
            <input
              id="admin-user-search"
              maxLength={120}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={copy.users.searchPlaceholder}
              type="search"
              value={searchInput}
            />
            <button className="button button--primary" type="submit">
              <Search aria-hidden="true" size={17} />
              {copy.users.search}
            </button>
          </div>
        </form>

        <div className="admin-filter-grid">
          <label>
            <span>{copy.common.role}</span>
            <select
              onChange={(event) =>
                handleFilterChange({
                  role: (event.target.value || undefined) as UserRole | undefined,
                })
              }
              value={query.role || ""}
            >
              <option value="">{copy.users.allRoles}</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {copy.users.roles[role]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{copy.users.authProvider}</span>
            <select
              onChange={(event) =>
                handleFilterChange({
                  authProvider: (event.target.value || undefined) as
                    | AuthProvider
                    | undefined,
                })
              }
              value={query.authProvider || ""}
            >
              <option value="">{copy.users.allProviders}</option>
              {AUTH_PROVIDER_OPTIONS.map((provider) => (
                <option key={provider} value={provider}>
                  {copy.users.providers[provider]}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>{copy.common.status}</span>
            <select
              onChange={(event) =>
                handleFilterChange({
                  isActive: parseActiveFilter(event.target.value),
                })
              }
              value={getBooleanFilterValue(query.isActive)}
            >
              <option value="">{copy.users.allStatuses}</option>
              <option value="true">{copy.users.active}</option>
              <option value="false">{copy.users.inactive}</option>
            </select>
          </label>

          <button
            className="button button--secondary"
            disabled={!hasFilters || isLoading}
            onClick={() => {
              setSearchInput("");
              setQuery({ limit: USER_LIMIT, page: 1 });
            }}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={17} />
            {copy.users.reset}
          </button>
        </div>
      </section>

      {successMessage ? (
        <AdminFeedback message={successMessage} tone="success" />
      ) : null}
      {!isModalOpen && actionErrorMessage ? (
        <AdminFeedback message={actionErrorMessage} requestId={requestId} tone="error" />
      ) : null}
      {listErrorMessage ? (
        <AdminFeedback message={listErrorMessage} requestId={requestId} tone="error" />
      ) : null}

      <section className="admin-resource__body admin-resource__body--full-width">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{copy.common.email}</th>
                <th>{copy.common.name}</th>
                <th>{copy.common.phone}</th>
                <th>{copy.common.role}</th>
                <th>{copy.common.status}</th>
                <th>{copy.common.created}</th>
                <th>{copy.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <AdminTableSkeleton columns={7} rows={6} /> : null}
              {!isLoading && !listError && users.length === 0 ? (
                <tr>
                  <td className="admin-table__state" colSpan={7}>
                    {copy.users.listEmpty}
                  </td>
                </tr>
              ) : null}
              {!isLoading && !listError
                ? users.map((user) => (
                    <tr
                      aria-label={copy.users.openAria(user.email)}
                      className="admin-table__clickable-row"
                      key={user.id}
                      onClick={() => void openUserDetail(user)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void openUserDetail(user);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td>
                        <strong>{user.email}</strong>
                      </td>
                      <td>{formatOptional(user.name, locale)}</td>
                      <td>{formatOptional(user.phone, locale)}</td>
                      <td>{copy.users.roles[user.role]}</td>
                      <td>
                        <span
                          className={`admin-badge ${
                            user.isActive
                              ? "admin-badge--success"
                              : "admin-badge--muted"
                          }`}
                        >
                          {user.isActive ? copy.users.active : copy.users.inactive}
                        </span>
                      </td>
                      <td>{formatAdminDate(user.createdAt, locale)}</td>
                      <td>
                        <div
                          className="admin-row-actions"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <button
                            aria-label={copy.users.editAria(user.email)}
                            className="icon-button admin-icon-button"
                            onClick={() => void openUserDetail(user)}
                            title={copy.users.editTitle}
                            type="button"
                          >
                            <Edit3 aria-hidden="true" size={17} />
                          </button>
                          <button
                            className="admin-link-button"
                            disabled={busyAction === `${user.id}:status`}
                            onClick={() => void handleStatusChange(user)}
                            type="button"
                          >
                            {user.isActive ? copy.users.deactivate : copy.users.activate}
                          </button>
                          <button
                            className="admin-link-button admin-link-button--delete"
                            disabled={
                              user.id === currentUser?.id ||
                              busyAction === `${user.id}:delete`
                            }
                            onClick={() => void handleDelete(user)}
                            title={
                              user.id === currentUser?.id
                                ? copy.users.deleteCurrentTitle
                                : copy.users.deleteTitle
                            }
                            type="button"
                          >
                            {busyAction === `${user.id}:delete`
                              ? copy.users.deleting
                              : copy.users.delete}
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
        copy={copy}
        isLoading={isLoading}
        locale={locale}
        onPageChange={goToPage}
        pagination={pagination}
      />

      <AdminModal
        closeDisabled={isSaving}
        compact
        footer={(requestClose) => (
          <>
            <button
              className="button button--secondary"
              disabled={isSaving}
              onClick={requestClose}
              type="button"
            >
              {copy.common.cancel}
            </button>
            <button
              className="button button--primary"
              disabled={isSaving || isDetailLoading}
              form="admin-user-edit-form"
              type="submit"
            >
              <Save aria-hidden="true" size={17} />
              {isSaving ? copy.common.saving : copy.common.save}
            </button>
          </>
        )}
        hasUnsavedChanges={hasUnsavedChanges}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={copy.users.editTitle}
      >
        {actionErrorMessage ? (
          <AdminFeedback message={actionErrorMessage} requestId={requestId} tone="error" />
        ) : null}
        {selectedUser ? (
            <form className="admin-form admin-compact-form" id="admin-user-edit-form" onSubmit={handleUserSave}>
              <section className="admin-compact-group" aria-labelledby="user-account-heading">
                <h3 id="user-account-heading">{copy.users.account}</h3>
                <div className="admin-compact-fields">
                  <label className="admin-compact-field--wide">
                    <span>{copy.common.name}</span>
                    <input disabled={isDetailLoading} maxLength={120} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} value={form.name} />
                  </label>
                  <label className="admin-compact-field--wide">
                    <span>{copy.common.email}</span>
                    <input disabled readOnly type="email" value={selectedUser.email} />
                  </label>
                  <label className="admin-compact-field--wide">
                    <span>{copy.common.phone}</span>
                    <input disabled={isDetailLoading} maxLength={32} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} value={form.phone} />
                  </label>
                </div>
              </section>

              <section className="admin-compact-group" aria-labelledby="user-access-heading">
                <h3 id="user-access-heading">{copy.users.access}</h3>
                <div className="admin-compact-fields">
                <label>
                  <span>{copy.common.role}</span>
                  <select
                    disabled={isDetailLoading}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        role: event.target.value as UserRole,
                      }))
                    }
                    value={form.role}
                  >
                    {ROLE_OPTIONS.map((role) => (
                      <option key={role} value={role}>
                        {copy.users.roles[role]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-checkbox admin-compact-checkbox">
                  <input
                    checked={form.isActive}
                    disabled={isDetailLoading}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        isActive: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  <span>{copy.users.active}</span>
                </label>
              </div>
              </section>

              <section className="admin-compact-group" aria-labelledby="user-metadata-heading">
                <h3 id="user-metadata-heading">{copy.users.metadata}</h3>
                <div className="admin-meta-grid admin-meta-grid--compact">
                <span>
                  <small>{copy.common.provider}</small>
                  <strong>{copy.users.providers[selectedUser.authProvider]}</strong>
                </span>
                <span>
                  <small>{copy.users.createdAt}</small>
                  <strong>{formatAdminDate(selectedUser.createdAt, locale)}</strong>
                </span>
                <span>
                  <small>{copy.users.updatedAt}</small>
                  <strong>{formatAdminDate(selectedUser.updatedAt, locale)}</strong>
                </span>
              </div>
              </section>

            </form>
          ) : (
            <div className="admin-panel__empty" role="status">
              {copy.users.loadingDetail}
            </div>
          )}
      </AdminModal>
    </div>
  );
}

function getUserFormState(user: AdminUser): UserFormState {
  return {
    isActive: user.isActive,
    name: user.name || "",
    phone: user.phone || "",
    role: user.role,
  };
}

function areUserFormsEqual(left: UserFormState, right: UserFormState): boolean {
  return (
    left.isActive === right.isActive &&
    left.name === right.name &&
    left.phone === right.phone &&
    left.role === right.role
  );
}

function AdminFeedback({
  message,
  requestId,
  tone,
}: {
  message: string;
  requestId?: string;
  tone: "error" | "success";
}) {
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;
  const { locale } = useI18n();
  const copy = getAdminOperationsTranslations(locale);

  return (
    <div className={`admin-feedback admin-feedback--${tone}`} role="status">
      <Icon aria-hidden="true" size={19} />
      <span>{message}</span>
      {requestId ? (
        <small>
          {copy.common.request} {requestId}
        </small>
      ) : null}
    </div>
  );
}

function AdminTableSkeleton({
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

function AdminPagination({
  copy,
  isLoading,
  locale,
  onPageChange,
  pagination,
}: {
  copy: AdminOperationsTranslations;
  isLoading: boolean;
  locale: Locale;
  onPageChange: (page: number) => void;
  pagination: Pagination;
}) {
  const totalPages = Math.max(1, pagination.totalPages);

  return (
    <nav className="admin-pagination" aria-label={copy.users.paginationAria}>
      <button
        className="button button--secondary"
        disabled={isLoading || pagination.page <= 1}
        onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        type="button"
      >
        {copy.common.previous}
      </button>
      <span>
        {copy.users.pageSummary(
          formatNumber(pagination.page, locale),
          formatNumber(totalPages, locale),
          formatNumber(pagination.total, locale),
        )}
      </span>
      <button
        className="button button--secondary"
        disabled={isLoading || pagination.page >= totalPages}
        onClick={() => onPageChange(pagination.page + 1)}
        type="button"
      >
        {copy.common.next}
      </button>
    </nav>
  );
}

function getUserErrorMessage(
  error: UserUiError,
  copy: AdminOperationsTranslations,
): string {
  const fallback =
    error.fallback === "list"
      ? copy.users.loadError
      : error.fallback === "open"
        ? copy.users.userOpenError
        : error.fallback === "empty"
          ? copy.users.errors.ADMIN_USER_UPDATE_EMPTY
          : error.fallback === "update"
            ? copy.users.userUpdateError
            : error.fallback === "status"
              ? copy.users.userStatusError
              : error.fallback === "selfDelete"
                ? copy.users.selfDeleteError
                : copy.users.userDeleteError;

  if (!(error.cause instanceof ApiClientError)) {
    return fallback;
  }

  return (
    copy.users.errors[
      error.cause.code as keyof typeof copy.users.errors
    ] || fallback
  );
}
