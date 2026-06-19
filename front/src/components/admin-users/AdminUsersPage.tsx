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
import type { AuthProvider, UserRole } from "@/features/auth/types";
import type { Pagination } from "@/lib/api/types";
import { AdminModal } from "@/components/admin/AdminModal";
import {
  formatAdminDate,
  formatOptional,
  getApiErrorMessage,
  getApiRequestId,
  getBooleanFilterValue,
  normalizeNullableText,
  parseActiveFilter,
} from "@/components/admin/admin-format";

const USER_LIMIT = 20;
const ROLE_OPTIONS: UserRole[] = ["CUSTOMER", "STAFF", "ADMIN"];
const AUTH_PROVIDER_OPTIONS: AuthProvider[] = ["EMAIL", "GOOGLE"];

const USER_ERROR_MESSAGES: Record<string, string> = {
  ADMIN_USER_UPDATE_EMPTY: "Change at least one editable field before saving.",
  AUTH_REQUIRED: "Your admin session is required. Sign in again to continue.",
  BAD_REQUEST: "Some user fields are invalid. Review the form and try again.",
  FORBIDDEN: "This account is not allowed to manage admin users.",
  LAST_ACTIVE_ADMIN: "At least one active admin account must remain available.",
  NETWORK_ERROR: "The users API could not be reached. Check the backend and retry.",
  USER_NOT_FOUND: "That user no longer exists.",
  VALIDATION_ERROR: "Some user fields are invalid. Review the form and try again.",
};

interface AdminUsersPageProps {
  initialQuery: AdminUserQuery;
}

interface UserFormState {
  isActive: boolean;
  name: string;
  phone: string;
  role: UserRole;
}

export function AdminUsersPage({ initialQuery }: AdminUsersPageProps) {
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
  const [listError, setListError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
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

        setUsers(response.users);
        setPagination(response.pagination);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setUsers([]);
        setListError(
          getApiErrorMessage(
            error,
            USER_ERROR_MESSAGES,
            "Admin users could not be loaded right now.",
          ),
        );
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
    setSuccessMessage(undefined);
    setRequestId(undefined);
    setIsModalOpen(true);
    setIsDetailLoading(true);

    try {
      const response = await getAdminUser(user.id);

      setSelectedUser(response.user);
      setForm(getUserFormState(response.user));
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          USER_ERROR_MESSAGES,
          "This user could not be opened right now.",
        ),
      );
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
    setSuccessMessage(undefined);
    setRequestId(undefined);

    const name = normalizeNullableText(form.name);
    const phone = normalizeNullableText(form.phone);
    const profileChanged = name !== selectedUser.name || phone !== selectedUser.phone;
    const roleChanged = form.role !== selectedUser.role;
    const statusChanged = form.isActive !== selectedUser.isActive;

    if (!profileChanged && !roleChanged && !statusChanged) {
      setActionError("Change at least one editable field before saving.");
      return;
    }

    if (
      statusChanged &&
      !window.confirm(
        `${form.isActive ? "Activate" : "Deactivate"} ${selectedUser.email}?`,
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
      setSuccessMessage("User updated.");
      setIsModalOpen(false);
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          USER_ERROR_MESSAGES,
          "User profile could not be updated.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleStatusChange(user: AdminUser) {
    const nextIsActive = !user.isActive;

    if (
      !window.confirm(
        `${nextIsActive ? "Activate" : "Deactivate"} ${user.email}?`,
      )
    ) {
      return;
    }

    const actionKey = `${user.id}:status`;

    setBusyAction(actionKey);
    setActionError(undefined);
    setSuccessMessage(undefined);
    setRequestId(undefined);

    try {
      const response = await updateAdminUserStatus(user.id, {
        isActive: nextIsActive,
      });

      syncUser(response.user);
      setRefreshKey((current) => current + 1);
      setSuccessMessage(
        response.user.isActive
          ? "User account activated."
          : "User account deactivated.",
      );
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          USER_ERROR_MESSAGES,
          "User active status could not be changed.",
        ),
      );
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

  return (
    <div className="admin-resource admin-resource--full-width">
      <section className="admin-resource__header" aria-labelledby="admin-users-heading">
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">Access management</p>
          <h1 id="admin-users-heading">Users Management</h1>
          <p>Review customer and staff profiles, roles, and account access.</p>
        </div>
        <button
          className="button button--secondary"
          disabled={isLoading}
          onClick={() => setRefreshKey((current) => current + 1)}
          type="button"
        >
          <RefreshCw aria-hidden="true" size={17} />
          Refresh
        </button>
      </section>

      <section className="admin-resource__toolbar" aria-label="User filters">
        <form className="admin-search" onSubmit={handleSearchSubmit}>
          <label htmlFor="admin-user-search">Search</label>
          <div>
            <input
              id="admin-user-search"
              maxLength={120}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Email, name, or phone"
              type="search"
              value={searchInput}
            />
            <button className="button button--primary" type="submit">
              <Search aria-hidden="true" size={17} />
              Search
            </button>
          </div>
        </form>

        <div className="admin-filter-grid">
          <label>
            <span>Role</span>
            <select
              onChange={(event) =>
                handleFilterChange({
                  role: (event.target.value || undefined) as UserRole | undefined,
                })
              }
              value={query.role || ""}
            >
              <option value="">All roles</option>
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Auth provider</span>
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
              <option value="">All providers</option>
              {AUTH_PROVIDER_OPTIONS.map((provider) => (
                <option key={provider} value={provider}>
                  {provider}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Status</span>
            <select
              onChange={(event) =>
                handleFilterChange({
                  isActive: parseActiveFilter(event.target.value),
                })
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
              setQuery({ limit: USER_LIMIT, page: 1 });
            }}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={17} />
            Reset
          </button>
        </div>
      </section>

      {successMessage ? (
        <AdminFeedback message={successMessage} tone="success" />
      ) : null}
      {!isModalOpen && actionError ? (
        <AdminFeedback message={actionError} requestId={requestId} tone="error" />
      ) : null}
      {listError ? (
        <AdminFeedback message={listError} requestId={requestId} tone="error" />
      ) : null}

      <section className="admin-resource__body admin-resource__body--full-width">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <AdminTableSkeleton columns={7} rows={6} /> : null}
              {!isLoading && !listError && users.length === 0 ? (
                <tr>
                  <td className="admin-table__state" colSpan={7}>
                    No users match the current filters.
                  </td>
                </tr>
              ) : null}
              {!isLoading && !listError
                ? users.map((user) => (
                    <tr
                      aria-label={`Open ${user.email}`}
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
                      <td>{formatOptional(user.name)}</td>
                      <td>{formatOptional(user.phone)}</td>
                      <td>{user.role}</td>
                      <td>
                        <span
                          className={`admin-badge ${
                            user.isActive
                              ? "admin-badge--success"
                              : "admin-badge--muted"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>{formatAdminDate(user.createdAt)}</td>
                      <td>
                        <div
                          className="admin-row-actions"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <button
                            aria-label={`Edit ${user.email}`}
                            className="icon-button admin-icon-button"
                            onClick={() => void openUserDetail(user)}
                            title="Edit user"
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
                            {user.isActive ? "Deactivate" : "Activate"}
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
        onPageChange={goToPage}
        pagination={pagination}
      />

      <AdminModal
        closeDisabled={isSaving}
        footer={(requestClose) => (
          <>
            <button
              className="button button--secondary"
              disabled={isSaving}
              onClick={requestClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button button--primary"
              disabled={isSaving || isDetailLoading}
              form="admin-user-edit-form"
              type="submit"
            >
              <Save aria-hidden="true" size={17} />
              {isSaving ? "Saving" : "Save"}
            </button>
          </>
        )}
        hasUnsavedChanges={hasUnsavedChanges}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={selectedUser ? selectedUser.email : "User detail"}
      >
        {actionError ? (
          <AdminFeedback message={actionError} requestId={requestId} tone="error" />
        ) : null}
        {selectedUser ? (
            <form className="admin-form" id="admin-user-edit-form" onSubmit={handleUserSave}>
              <label>
                <span>Name</span>
                <input
                  disabled={isDetailLoading}
                  maxLength={120}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  value={form.name}
                />
              </label>

              <div className="admin-form__split">
                <label>
                  <span>Role</span>
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
                        {role}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="admin-checkbox admin-checkbox--modal">
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
                  <span>Active</span>
                </label>
              </div>

              <label>
                <span>Phone</span>
                <input
                  disabled={isDetailLoading}
                  maxLength={32}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                  value={form.phone}
                />
              </label>

              <div className="admin-meta-grid">
                <span>
                  <small>Role</small>
                  <strong>{selectedUser.role}</strong>
                </span>
                <span>
                  <small>Provider</small>
                  <strong>{selectedUser.authProvider}</strong>
                </span>
                <span>
                  <small>Status</small>
                  <strong>{selectedUser.isActive ? "Active" : "Inactive"}</strong>
                </span>
                <span>
                  <small>Updated</small>
                  <strong>{formatAdminDate(selectedUser.updatedAt)}</strong>
                </span>
              </div>

            </form>
          ) : (
            <div className="admin-panel__empty" role="status">
              Loading user detail.
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

  return (
    <div className={`admin-feedback admin-feedback--${tone}`} role="status">
      <Icon aria-hidden="true" size={19} />
      <span>{message}</span>
      {requestId ? <small>Request {requestId}</small> : null}
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
  isLoading,
  onPageChange,
  pagination,
}: {
  isLoading: boolean;
  onPageChange: (page: number) => void;
  pagination: Pagination;
}) {
  const totalPages = Math.max(1, pagination.totalPages);

  return (
    <nav className="admin-pagination" aria-label="Users pagination">
      <button
        className="button button--secondary"
        disabled={isLoading || pagination.page <= 1}
        onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        type="button"
      >
        Previous
      </button>
      <span>
        Page {pagination.page} of {totalPages} ({pagination.total} users)
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
