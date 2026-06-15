"use client";

import {
  AlertCircle,
  CheckCircle2,
  Edit3,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  XCircle,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import {
  createAdminCategory,
  deactivateAdminCategory,
  getAdminCategory,
  listAdminCategories,
  updateAdminCategory,
} from "@/features/admin-catalog/api";
import type {
  AdminCategory,
  AdminCategoryQuery,
} from "@/features/admin-catalog/types";
import type { Pagination } from "@/lib/api/types";
import {
  formatAdminDate,
  formatOptional,
  getApiErrorMessage,
  getApiRequestId,
  getBooleanFilterValue,
  normalizeNullableText,
  parseActiveFilter,
} from "@/components/admin/admin-format";

const CATEGORY_LIMIT = 20;

const CATEGORY_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Your admin session is required. Sign in again to continue.",
  BAD_REQUEST: "Some category fields are invalid. Review the form and try again.",
  CATALOG_UPDATE_EMPTY: "Change at least one category field before saving.",
  CATEGORY_NOT_FOUND: "That category no longer exists.",
  CATEGORY_SLUG_EXISTS: "Another category already uses this slug.",
  FORBIDDEN: "This account is not allowed to manage catalog categories.",
  NETWORK_ERROR: "The category API could not be reached. Check the backend and retry.",
  VALIDATION_ERROR: "Some category fields are invalid. Review the form and try again.",
};

interface AdminCategoriesPageProps {
  initialQuery: AdminCategoryQuery;
}

interface CategoryFormState {
  description: string;
  isActive: boolean;
  name: string;
  slug: string;
}

type CategoryPanelMode = "create" | "edit";

export function AdminCategoriesPage({ initialQuery }: AdminCategoriesPageProps) {
  const [query, setQuery] = useState<AdminCategoryQuery>({
    ...initialQuery,
    limit: CATEGORY_LIMIT,
    page: initialQuery.page || 1,
  });
  const [searchInput, setSearchInput] = useState(initialQuery.search || "");
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    limit: CATEGORY_LIMIT,
    page: query.page || 1,
    total: 0,
    totalPages: 1,
  });
  const [panelMode, setPanelMode] = useState<CategoryPanelMode>("create");
  const [selectedCategory, setSelectedCategory] = useState<AdminCategory>();
  const [form, setForm] = useState<CategoryFormState>(getEmptyCategoryForm());
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

    async function loadCategories() {
      setIsLoading(true);
      setListError(undefined);

      try {
        const response = await listAdminCategories(query);

        if (!isMounted) {
          return;
        }

        setCategories(response.categories);
        setPagination(response.pagination);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setCategories([]);
        setListError(
          getApiErrorMessage(
            error,
            CATEGORY_ERROR_MESSAGES,
            "Admin categories could not be loaded right now.",
          ),
        );
        setRequestId(getApiRequestId(error));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadCategories();

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

  function handleFilterChange(nextQuery: Partial<AdminCategoryQuery>) {
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

  function openCreatePanel() {
    setPanelMode("create");
    setSelectedCategory(undefined);
    setForm(getEmptyCategoryForm());
    setActionError(undefined);
    setSuccessMessage(undefined);
  }

  async function openEditPanel(category: AdminCategory) {
    setPanelMode("edit");
    setSelectedCategory(category);
    setForm(getCategoryForm(category));
    setActionError(undefined);
    setSuccessMessage(undefined);
    setIsDetailLoading(true);

    try {
      const response = await getAdminCategory(category.id);

      setSelectedCategory(response.category);
      setForm(getCategoryForm(response.category));
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          CATEGORY_ERROR_MESSAGES,
          "This category could not be opened right now.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setIsDetailLoading(false);
    }
  }

  async function handleCategorySave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(undefined);
    setSuccessMessage(undefined);

    const validationError = validateCategoryForm(form);

    if (validationError) {
      setActionError(validationError);
      return;
    }

    setIsSaving(true);

    try {
      if (panelMode === "create") {
        const response = await createAdminCategory({
          description: normalizeNullableText(form.description),
          isActive: form.isActive,
          name: form.name.trim(),
          slug: form.slug.trim(),
        });

        setSelectedCategory(response.category);
        setPanelMode("edit");
        setForm(getCategoryForm(response.category));
        setSuccessMessage("Category created.");
      } else if (selectedCategory) {
        const response = await updateAdminCategory(selectedCategory.id, {
          description: normalizeNullableText(form.description),
          isActive: form.isActive,
          name: form.name.trim(),
          slug: form.slug.trim(),
        });

        setSelectedCategory(response.category);
        setForm(getCategoryForm(response.category));
        setSuccessMessage("Category updated.");
      }

      setRefreshKey((current) => current + 1);
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          CATEGORY_ERROR_MESSAGES,
          "Category could not be saved.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeactivateCategory(category: AdminCategory) {
    setBusyAction(category.id);
    setActionError(undefined);
    setSuccessMessage(undefined);

    try {
      const response = await deactivateAdminCategory(category.id);

      setSelectedCategory((current) =>
        current?.id === response.category.id ? response.category : current,
      );
      setForm((current) =>
        selectedCategory?.id === response.category.id
          ? getCategoryForm(response.category)
          : current,
      );
      setRefreshKey((current) => current + 1);
      setSuccessMessage("Category deactivated.");
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          CATEGORY_ERROR_MESSAGES,
          "Category could not be deactivated.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setBusyAction(undefined);
    }
  }

  const hasFilters = Boolean(query.search) || query.isActive !== undefined;

  return (
    <div className="admin-resource">
      <section
        className="admin-resource__header"
        aria-labelledby="admin-categories-heading"
      >
        <div>
          <p className="eyebrow">Admin catalog</p>
          <h1 id="admin-categories-heading">Categories</h1>
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
          <button className="button button--primary" onClick={openCreatePanel} type="button">
            <Plus aria-hidden="true" size={17} />
            New category
          </button>
        </div>
      </section>

      <section className="admin-resource__toolbar" aria-label="Category filters">
        <form className="admin-search" onSubmit={handleSearchSubmit}>
          <label htmlFor="admin-category-search">Search</label>
          <div>
            <input
              id="admin-category-search"
              maxLength={120}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Name or slug"
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
              setQuery({ limit: CATEGORY_LIMIT, page: 1 });
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
      {actionError ? (
        <AdminFeedback message={actionError} requestId={requestId} tone="error" />
      ) : null}
      {listError ? (
        <AdminFeedback message={listError} requestId={requestId} tone="error" />
      ) : null}

      <section className="admin-resource__body">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Description</th>
                <th>Status</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <AdminTableSkeleton columns={7} rows={6} /> : null}
              {!isLoading && !listError && categories.length === 0 ? (
                <tr>
                  <td className="admin-table__state" colSpan={7}>
                    No categories match the current filters.
                  </td>
                </tr>
              ) : null}
              {!isLoading && !listError
                ? categories.map((category) => (
                    <tr key={category.id}>
                      <td>
                        <strong>{category.name}</strong>
                      </td>
                      <td>{category.slug}</td>
                      <td className="admin-table__muted">
                        {formatOptional(category.description)}
                      </td>
                      <td>
                        <span
                          className={`admin-badge ${
                            category.isActive
                              ? "admin-badge--success"
                              : "admin-badge--muted"
                          }`}
                        >
                          {category.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>{formatAdminDate(category.createdAt)}</td>
                      <td>{formatAdminDate(category.updatedAt)}</td>
                      <td>
                        <div className="admin-row-actions">
                          <button
                            aria-label={`Edit ${category.name}`}
                            className="icon-button admin-icon-button"
                            onClick={() => void openEditPanel(category)}
                            title="Edit category"
                            type="button"
                          >
                            <Edit3 aria-hidden="true" size={17} />
                          </button>
                          <button
                            className="admin-link-button"
                            disabled={!category.isActive || busyAction === category.id}
                            onClick={() => void handleDeactivateCategory(category)}
                            type="button"
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        <aside className="admin-panel" aria-labelledby="category-detail-heading">
          <div className="admin-panel__header">
            <div>
              <p className="eyebrow">
                {panelMode === "create" ? "Create category" : "Category detail"}
              </p>
              <h2 id="category-detail-heading">
                {panelMode === "create"
                  ? "New category"
                  : selectedCategory?.name || "Category"}
              </h2>
            </div>
          </div>

          <form className="admin-form" onSubmit={handleCategorySave}>
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
                required
                value={form.name}
              />
            </label>

            <label>
              <span>Slug</span>
              <input
                disabled={isDetailLoading}
                maxLength={160}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    slug: event.target.value,
                  }))
                }
                required
                value={form.slug}
              />
            </label>

            <label>
              <span>Description</span>
              <textarea
                disabled={isDetailLoading}
                maxLength={2000}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={5}
                value={form.description}
              />
            </label>

            <label className="admin-checkbox">
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

            <button
              className="button button--primary button--full"
              disabled={isSaving || isDetailLoading}
              type="submit"
            >
              <Save aria-hidden="true" size={17} />
              {isSaving
                ? "Saving"
                : panelMode === "create"
                  ? "Create category"
                  : "Save category"}
            </button>

            {panelMode === "edit" && selectedCategory?.isActive ? (
              <button
                className="button button--secondary button--full"
                disabled={busyAction === selectedCategory.id}
                onClick={() => void handleDeactivateCategory(selectedCategory)}
                type="button"
              >
                <XCircle aria-hidden="true" size={17} />
                Deactivate category
              </button>
            ) : null}
          </form>
        </aside>
      </section>

      <AdminPagination
        isLoading={isLoading}
        onPageChange={goToPage}
        pagination={pagination}
      />
    </div>
  );
}

function getEmptyCategoryForm(): CategoryFormState {
  return {
    description: "",
    isActive: true,
    name: "",
    slug: "",
  };
}

function getCategoryForm(category: AdminCategory): CategoryFormState {
  return {
    description: category.description || "",
    isActive: category.isActive,
    name: category.name,
    slug: category.slug,
  };
}

function validateCategoryForm(form: CategoryFormState): string | undefined {
  if (!form.name.trim()) {
    return "Category name is required.";
  }

  if (!form.slug.trim()) {
    return "Category slug is required.";
  }

  return undefined;
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
    <nav className="admin-pagination" aria-label="Categories pagination">
      <button
        className="button button--secondary"
        disabled={isLoading || pagination.page <= 1}
        onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        type="button"
      >
        Previous
      </button>
      <span>
        Page {pagination.page} of {totalPages} ({pagination.total} categories)
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
