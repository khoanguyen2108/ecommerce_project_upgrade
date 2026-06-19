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

const CATEGORY_LIMIT = 20;

const CATEGORY_ERROR_MESSAGES: Record<string, string> = {
  ADMIN_CATEGORY_FEATURED_LIMIT_EXCEEDED:
    "Three active categories are already featured. Unfeature one before adding another.",
  ADMIN_CATEGORY_FEATURED_ORDER_CONFLICT:
    "Another featured category already uses that display order.",
  ADMIN_CATEGORY_FEATURED_ORDER_INVALID:
    "Choose featured order 1, 2, or 3.",
  ADMIN_CATEGORY_IMAGE_URL_INVALID:
    "Enter a valid public HTTP or HTTPS image URL.",
  ADMIN_CATEGORY_NOT_FOUND: "That category no longer exists.",
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
  featuredOrder: "" | "1" | "2" | "3";
  imageUrl: string;
  isActive: boolean;
  isFeatured: boolean;
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
    setRequestId(undefined);
    setIsModalOpen(true);
  }

  async function openEditPanel(category: AdminCategory) {
    setPanelMode("edit");
    setSelectedCategory(category);
    setForm(getCategoryForm(category));
    setActionError(undefined);
    setSuccessMessage(undefined);
    setRequestId(undefined);
    setIsModalOpen(true);
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

    if (
      panelMode === "edit" &&
      selectedCategory &&
      form.isActive !== selectedCategory.isActive &&
      !window.confirm(
        `${form.isActive ? "Activate" : "Deactivate"} ${selectedCategory.name}?`,
      )
    ) {
      return;
    }

    setIsSaving(true);

    try {
      if (panelMode === "create") {
        await createAdminCategory({
          description: normalizeNullableText(form.description),
          featuredOrder: form.isFeatured ? Number(form.featuredOrder) : null,
          imageUrl: normalizeNullableText(form.imageUrl),
          isActive: form.isActive,
          isFeatured: form.isFeatured,
          name: form.name.trim(),
          slug: form.slug.trim(),
        });

        setSuccessMessage("Category created.");
      } else if (selectedCategory) {
        const response = await updateAdminCategory(selectedCategory.id, {
          description: normalizeNullableText(form.description),
          featuredOrder: form.isFeatured ? Number(form.featuredOrder) : null,
          imageUrl: normalizeNullableText(form.imageUrl),
          isActive: form.isActive,
          isFeatured: form.isFeatured,
          name: form.name.trim(),
          slug: form.slug.trim(),
        });

        setSelectedCategory(response.category);
        setForm(getCategoryForm(response.category));
        setSuccessMessage("Category updated.");
      }

      setRefreshKey((current) => current + 1);
      setIsModalOpen(false);
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

  async function handleCategoryStatusChange(category: AdminCategory) {
    const nextIsActive = !category.isActive;

    if (
      !window.confirm(
        `${nextIsActive ? "Activate" : "Deactivate"} ${category.name}?`,
      )
    ) {
      return;
    }

    setBusyAction(category.id);
    setActionError(undefined);
    setSuccessMessage(undefined);
    setRequestId(undefined);

    try {
      const response = nextIsActive
        ? await updateAdminCategory(category.id, { isActive: true })
        : await deactivateAdminCategory(category.id);

      setSelectedCategory((current) =>
        current?.id === response.category.id ? response.category : current,
      );
      setForm((current) =>
        selectedCategory?.id === response.category.id
          ? getCategoryForm(response.category)
          : current,
      );
      setRefreshKey((current) => current + 1);
      setSuccessMessage(
        response.category.isActive
          ? "Category activated."
          : "Category deactivated.",
      );
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          CATEGORY_ERROR_MESSAGES,
          "Category status could not be changed.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setBusyAction(undefined);
    }
  }

  const hasFilters = Boolean(query.search) || query.isActive !== undefined;
  const hasUnsavedChanges = isModalOpen
    ? !areCategoryFormsEqual(
        form,
        panelMode === "edit" && selectedCategory
          ? getCategoryForm(selectedCategory)
          : getEmptyCategoryForm(),
      )
    : false;

  return (
    <div className="admin-resource admin-resource--categories admin-resource--full-width">
      <section
        className="admin-resource__header"
        aria-labelledby="admin-categories-heading"
      >
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">Catalog structure</p>
          <h1 id="admin-categories-heading">Categories Management</h1>
          <p>Organize storefront categories, imagery, and featured placement.</p>
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
                <th>Name</th>
                <th>Image</th>
                <th>Slug</th>
                <th>Description</th>
                <th>Status</th>
                <th>Landing</th>
                <th>Created</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <AdminTableSkeleton columns={9} rows={6} /> : null}
              {!isLoading && !listError && categories.length === 0 ? (
                <tr>
                  <td className="admin-table__state" colSpan={9}>
                    No categories match the current filters.
                  </td>
                </tr>
              ) : null}
              {!isLoading && !listError
                ? categories.map((category) => (
                    <tr
                      aria-label={`Open ${category.name}`}
                      className="admin-table__clickable-row"
                      key={category.id}
                      onClick={() => void openEditPanel(category)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void openEditPanel(category);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td>
                        <strong>{category.name}</strong>
                      </td>
                      <td>
                        {category.imageUrl ? (
                          <img
                            alt=""
                            className="admin-category-thumbnail"
                            src={category.imageUrl}
                          />
                        ) : (
                          <span className="admin-category-thumbnail admin-category-thumbnail--empty">
                            None
                          </span>
                        )}
                      </td>
                      <td>{category.slug}</td>
                      <td className="admin-table__muted">
                        {formatOptional(category.description)}
                      </td>
                      <td>
                        <span
                          className={`admin-badge ${
                            category.isActive
                              ? "admin-badge--neutral"
                              : "admin-badge--muted"
                          }`}
                        >
                          {category.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <span className="admin-badge admin-badge--neutral">
                          {category.isFeatured
                            ? `Featured #${category.featuredOrder}`
                            : "Not featured"}
                        </span>
                      </td>
                      <td>{formatAdminDate(category.createdAt)}</td>
                      <td>{formatAdminDate(category.updatedAt)}</td>
                      <td>
                        <div
                          className="admin-row-actions"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
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
                            disabled={busyAction === category.id}
                            onClick={() => void handleCategoryStatusChange(category)}
                            type="button"
                          >
                            {category.isActive ? "Deactivate" : "Activate"}
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
              form="admin-category-form"
              type="submit"
            >
              <Save aria-hidden="true" size={17} />
              {isSaving
                ? "Saving"
                : panelMode === "create"
                  ? "Create"
                  : "Save"}
            </button>
          </>
        )}
        hasUnsavedChanges={hasUnsavedChanges}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          panelMode === "create"
            ? "New category"
            : selectedCategory?.name || "Category detail"
        }
      >
        {actionError ? (
          <AdminFeedback message={actionError} requestId={requestId} tone="error" />
        ) : null}
          <form className="admin-form" id="admin-category-form" onSubmit={handleCategorySave}>
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

            <label>
              <span>Image URL</span>
              <input
                disabled={isDetailLoading}
                maxLength={2048}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    imageUrl: event.target.value,
                  }))
                }
                placeholder="https://example.com/category.jpg"
                type="url"
                value={form.imageUrl}
              />
              <small>Landing images are loaded from the Image URL.</small>
            </label>

            <div className="admin-category-preview">
              {form.imageUrl.trim() ? (
                <img alt="Category preview" src={form.imageUrl.trim()} />
              ) : (
                <span>No category image</span>
              )}
            </div>

            <label className="admin-checkbox">
              <input
                checked={form.isActive}
                disabled={isDetailLoading}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                    isFeatured: event.target.checked ? current.isFeatured : false,
                    featuredOrder: event.target.checked
                      ? current.featuredOrder
                      : "",
                  }))
                }
                type="checkbox"
              />
              <span>Active</span>
            </label>

            <label className="admin-checkbox">
              <input
                checked={form.isFeatured}
                disabled={isDetailLoading || !form.isActive}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    isFeatured: event.target.checked,
                    featuredOrder: event.target.checked
                      ? current.featuredOrder
                      : "",
                  }))
                }
                type="checkbox"
              />
              <span>Featured on landing</span>
            </label>

            <label>
              <span>Featured order</span>
              <select
                disabled={isDetailLoading || !form.isFeatured}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    featuredOrder: event.target
                      .value as CategoryFormState["featuredOrder"],
                  }))
                }
                required={form.isFeatured}
                value={form.featuredOrder}
              >
                <option value="">Choose an order</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
              <small>
                Up to 3 active categories can be featured on the landing page.
              </small>
            </label>

          </form>
      </AdminModal>
    </div>
  );
}

function getEmptyCategoryForm(): CategoryFormState {
  return {
    description: "",
    featuredOrder: "",
    imageUrl: "",
    isActive: true,
    isFeatured: false,
    name: "",
    slug: "",
  };
}

function getCategoryForm(category: AdminCategory): CategoryFormState {
  return {
    description: category.description || "",
    featuredOrder: category.featuredOrder
      ? (String(category.featuredOrder) as CategoryFormState["featuredOrder"])
      : "",
    imageUrl: category.imageUrl || "",
    isActive: category.isActive,
    isFeatured: category.isFeatured,
    name: category.name,
    slug: category.slug,
  };
}

function areCategoryFormsEqual(
  left: CategoryFormState,
  right: CategoryFormState,
): boolean {
  return (
    left.description === right.description &&
    left.featuredOrder === right.featuredOrder &&
    left.imageUrl === right.imageUrl &&
    left.isActive === right.isActive &&
    left.isFeatured === right.isFeatured &&
    left.name === right.name &&
    left.slug === right.slug
  );
}

function validateCategoryForm(form: CategoryFormState): string | undefined {
  if (!form.name.trim()) {
    return "Category name is required.";
  }

  if (!form.slug.trim()) {
    return "Category slug is required.";
  }

  if (form.imageUrl.trim() && !isPublicHttpUrl(form.imageUrl)) {
    return "Enter a valid public HTTP or HTTPS image URL.";
  }

  if (form.isFeatured && !form.featuredOrder) {
    return "Choose featured order 1, 2, or 3.";
  }

  return undefined;
}

function isPublicHttpUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
