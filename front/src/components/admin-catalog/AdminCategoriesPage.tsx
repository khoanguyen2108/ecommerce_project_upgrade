"use client";

import { ADMIN_CATALOG_COPY, type AdminCatalogCopy } from "@/components/admin/admin-copy";
const copy = ADMIN_CATALOG_COPY;

import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Edit3,
  ImageIcon,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import {
  activateAdminCategory,
  createAdminCategory,
  deactivateAdminCategory,
  deleteAdminCategory,
  deleteAdminCategoryImage,
  getAdminCategory,
  listAdminCategories,
  reorderAdminCategory,
  updateAdminCategory,
  uploadAdminCategoryImage,
} from "@/features/admin-catalog/api";
import type {
  AdminCategory,
  AdminCategoryQuery,
} from "@/features/admin-catalog/types";
import { formatAdminCatalogNumber, getAdminCatalogErrorMessage } from "@/components/admin/admin-format";
import type { Pagination } from "@/lib/api/types";
import { AdminModal } from "@/components/admin/AdminModal";
import {
  formatAdminDate,
  getApiRequestId,
  getBooleanFilterValue,
  normalizeNullableText,
  parseActiveFilter,
} from "@/components/admin/admin-format";

const CATEGORY_LIMIT = 8;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

interface AdminCategoriesPageProps {
  initialQuery: AdminCategoryQuery;
}

interface CategoryFormState {
  description: string;
  featuredOrder: "" | "1" | "2" | "3";
  imageFile?: File;
  imageFilename: string;
  imageSource: "legacy" | "local" | "managed" | "none";
  imageUrl: string;
  isActive: boolean;
  isFeatured: boolean;
  name: string;
  slug: string;
}

type CategoryPanelMode = "create" | "edit";
type CategoryMoveDirection = "up" | "down";

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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const localPreviewUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    return () => releaseCategoryPreview(localPreviewUrlRef);
  }, []);

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

        const validPage = Math.min(
          query.page || 1,
          Math.max(1, response.pagination.totalPages),
        );

        if (validPage !== (query.page || 1)) {
          setQuery((current) => ({ ...current, page: validPage }));
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
          getAdminCatalogErrorMessage(
            error,
            { "ADMIN_CATEGORY_FEATURED_LIMIT_EXCEEDED": "Three active categories are already featured. Unfeature one before adding another.", "ADMIN_CATEGORY_FEATURED_ORDER_CONFLICT": "Another featured category already uses that display order.", "ADMIN_CATEGORY_FEATURED_ORDER_INVALID": "Choose featured order 1, 2, or 3.", "ADMIN_CATEGORY_IMAGE_URL_INVALID": "Enter a valid public HTTP or HTTPS image URL.", "CATEGORY_IMAGE_URL_INPUT_DISABLED": "Choose a JPEG, PNG, or WebP file instead of entering an image URL.", "ADMIN_CATEGORY_NOT_FOUND": "That category no longer exists.", "AUTH_REQUIRED": "Your admin session is required. Sign in again to continue.", "BAD_REQUEST": "Some category fields are invalid. Review the form and try again.", "CATALOG_UPDATE_EMPTY": "Change at least one category field before saving.", "CATEGORY_NOT_FOUND": "That category no longer exists.", "CATEGORY_SLUG_EXISTS": "Another category already uses this slug.", "CATEGORY_DELETE_BLOCKED": "This category has products. Move or remove them before deleting.", "FORBIDDEN": "This account is not allowed to manage catalog categories.", "NETWORK_ERROR": "The category API could not be reached. Check the backend and retry.", "PRODUCT_IMAGE_EMPTY": "Choose a non-empty JPEG, PNG, or WebP image.", "PRODUCT_IMAGE_TOO_LARGE": "Category images must be 5 MB or smaller.", "PRODUCT_IMAGE_TYPE_INVALID": "Only genuine JPEG, PNG, and WebP images are allowed.", "VALIDATION_ERROR": "Some category fields are invalid. Review the form and try again." },
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
    releaseCategoryPreview(localPreviewUrlRef);
    setPanelMode("create");
    setSelectedCategory(undefined);
    setForm(getEmptyCategoryForm());
    setActionError(undefined);
    setSuccessMessage(undefined);
    setRequestId(undefined);
    setIsModalOpen(true);
  }

  async function openEditPanel(category: AdminCategory) {
    releaseCategoryPreview(localPreviewUrlRef);
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
        getAdminCatalogErrorMessage(
          error,
          copy.categories.errors,
          "This category could not be opened right now.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setIsDetailLoading(false);
    }
  }

  function handleCategoryImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setActionError("Only JPEG, PNG, and WebP images are allowed.");
      return;
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      setActionError("Category images must be non-empty and 5 MB or smaller.");
      return;
    }

    releaseCategoryPreview(localPreviewUrlRef);
    const imageUrl = URL.createObjectURL(file);
    localPreviewUrlRef.current = imageUrl;
    setForm((current) => ({
      ...current,
      imageFile: file,
      imageFilename: file.name,
      imageSource: "local",
      imageUrl,
    }));
    setActionError(undefined);
  }

  function removeCategoryImage() {
    releaseCategoryPreview(localPreviewUrlRef);
    setForm((current) => ({
      ...current,
      imageFile: undefined,
      imageFilename: "",
      imageSource: "none",
      imageUrl: "",
    }));
  }

  async function handleCategorySave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(undefined);
    setSuccessMessage(undefined);

    const validationError = validateCategoryForm(form, copy);

    if (validationError) {
      setActionError(validationError);
      return;
    }

    if (
      panelMode === "edit" &&
      selectedCategory &&
      form.isActive !== selectedCategory.isActive &&
      !window.confirm(((nextIsActive, categoryName) => `${nextIsActive ? "Activate" : "Deactivate"} ${categoryName}?`)(form.isActive, selectedCategory.name))
    ) {
      return;
    }

    setIsSaving(true);
    let latestCategory: AdminCategory | undefined;
    const categoryDetailsChanged =
      panelMode === "create" ||
      !selectedCategory ||
      !areCategoryDetailsEqual(form, getCategoryForm(selectedCategory));

    try {
      if (panelMode === "create") {
        const response = await createAdminCategory({
          description: normalizeNullableText(form.description),
          featuredOrder: form.isFeatured ? Number(form.featuredOrder) : null,
          imageUrl: null,
          isActive: form.isActive,
          isFeatured: form.isFeatured,
          name: form.name.trim(),
          slug: form.slug.trim(),
        });
        latestCategory = response.category;
      } else if (selectedCategory && categoryDetailsChanged) {
        const legacyImageUrl =
          form.imageSource === "legacy"
            ? form.imageUrl
            : form.imageSource === "none"
              ? null
              : undefined;
        const response = await updateAdminCategory(selectedCategory.id, {
          description: normalizeNullableText(form.description),
          featuredOrder: form.isFeatured ? Number(form.featuredOrder) : null,
          ...(legacyImageUrl !== undefined ? { imageUrl: legacyImageUrl } : {}),
          isActive: form.isActive,
          isFeatured: form.isFeatured,
          name: form.name.trim(),
          slug: form.slug.trim(),
        });
        latestCategory = response.category;
      } else if (selectedCategory) {
        latestCategory = selectedCategory;
      }

      if (!latestCategory) throw new Error("Category response was unavailable.");

      let warning: string | undefined;
      if (form.imageFile) {
        const response = await uploadAdminCategoryImage(
          latestCategory.id,
          form.imageFile,
        );
        latestCategory = response.category;
        warning = response.warning;
        releaseCategoryPreview(localPreviewUrlRef);
      } else if (
        panelMode === "edit" &&
        selectedCategory?.imageUrl &&
        form.imageSource === "none"
      ) {
        const response = await deleteAdminCategoryImage(latestCategory.id);
        latestCategory = response.category;
        warning = response.warning;
      }

      setSelectedCategory(latestCategory);
      setForm(getCategoryForm(latestCategory));
      setPanelMode("edit");

      setRefreshKey((current) => current + 1);
      if (warning) {
        setSuccessMessage("Category image changes were saved.");
        setActionError(warning);
      } else {
        setIsModalOpen(false);
      }
    } catch (error) {
      if (latestCategory) {
        setPanelMode("edit");
        setSelectedCategory(latestCategory);
      }
      setActionError(
        getAdminCatalogErrorMessage(
          error,
          copy.categories.errors,
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
        ((nextIsActive, categoryName) => `${nextIsActive ? "Activate" : "Deactivate"} ${categoryName}?`)(
          nextIsActive,
          (category.name ?? ""),
        ),
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
        ? await activateAdminCategory(category.id)
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
        getAdminCatalogErrorMessage(
          error,
          copy.categories.errors,
          "Category status could not be changed.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function handleCategoryDelete(category: AdminCategory) {
    if (
      !window.confirm(
        ((categoryName) => `Delete ${categoryName}? This cannot be undone.`)(
          (category.name ?? ""),
        ),
      )
    ) return;

    setBusyAction(`${category.id}:delete`);
    setActionError(undefined);
    setSuccessMessage(undefined);
    setRequestId(undefined);
    try {
      const response = await deleteAdminCategory(category.id);
      if (categories.length === 1 && (query.page || 1) > 1) {
        setQuery((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }));
      } else {
        setRefreshKey((current) => current + 1);
      }
      setSuccessMessage("Category deleted.");
      if (response.warning) {
        setActionError(response.warning);
      }
    } catch (error) {
      setActionError(
        getAdminCatalogErrorMessage(
          error,
          copy.categories.errors,
          "Category could not be deleted.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function handleCategoryMove(
    category: AdminCategory,
    direction: CategoryMoveDirection,
  ) {
    if (busyAction || hasFilters) {
      return;
    }

    setBusyAction(`${category.id}:move:${direction}`);
    setActionError(undefined);
    setSuccessMessage(undefined);
    setRequestId(undefined);

    try {
      const response = await reorderAdminCategory(category.id, { direction });

      setSelectedCategory((current) =>
        current?.id === response.category.id ? response.category : current,
      );
      setForm((current) =>
        selectedCategory?.id === response.category.id
          ? getCategoryForm(response.category)
          : current,
      );
      setRefreshKey((current) => current + 1);
      setSuccessMessage("Category order updated.");
    } catch (error) {
      setActionError(
        getAdminCatalogErrorMessage(
          error,
          copy.categories.errors,
          "Category order could not be updated.",
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
          <p className="admin-page-intro__eyebrow">{"Catalog structure"}</p>
          <h1 id="admin-categories-heading">{"Categories Management"}</h1>
          <p>{"Organize storefront categories, imagery, and featured placement."}</p>
        </div>
        <div className="admin-header-actions">
          <button
            className="button button--secondary"
            disabled={isLoading}
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={17} />
            {"Refresh"}
          </button>
          <button className="button button--primary" onClick={openCreatePanel} type="button">
            <Plus aria-hidden="true" size={17} />
            {"New category"}
          </button>
        </div>
      </section>

      <section className="admin-resource__toolbar admin-resource__toolbar--compact admin-resource__toolbar--inline admin-filter-surface" aria-label={"Category filters"}>
        <form className="admin-search" onSubmit={handleSearchSubmit}>
          <label htmlFor="admin-category-search">{"Search"}</label>
          <div>
            <input
              id="admin-category-search"
              maxLength={120}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={"Name or slug"}
              type="search"
              value={searchInput}
            />
            <button className="button button--primary" type="submit">
              <Search aria-hidden="true" size={17} />
              {"Search"}
            </button>
          </div>
        </form>

        <div className="admin-filter-grid admin-filter-grid--compact">
          <label>
            <span>{"Status"}</span>
            <select
              onChange={(event) =>
                handleFilterChange({
                  isActive: parseActiveFilter(event.target.value),
                })
              }
              value={getBooleanFilterValue(query.isActive)}
            >
              <option value="">{"All statuses"}</option>
              <option value="true">{"Active"}</option>
              <option value="false">{"Inactive"}</option>
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
            {"Reset"}
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
                <th>{"Name"}</th>
                <th>{"Image"}</th>
                <th>{"Slug"}</th>
                <th>{"Status"}</th>
                <th>{"Landing"}</th>
                <th>{"Created"}</th>
                <th>{"Updated"}</th>
                <th>{"Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <AdminTableSkeleton columns={8} rows={6} /> : null}
              {!isLoading && !listError && categories.length === 0 ? (
                <tr>
                  <td className="admin-table__state" colSpan={8}>
                    {"No categories match the current filters."}
                  </td>
                </tr>
              ) : null}
              {!isLoading && !listError
                ? categories.map((category, index) => {
                    const categoryName = (category.name ?? "");
                    const page = query.page || 1;
                    const canMoveUp = !hasFilters && (page > 1 || index > 0);
                    const canMoveDown =
                      !hasFilters &&
                      (page < pagination.totalPages ||
                        index < categories.length - 1);

                    return (
                    <tr
                      aria-label={((categoryName) => `Open ${categoryName}`)(categoryName)}
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
                        <strong>{categoryName}</strong>
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
                            {"None"}
                          </span>
                        )}
                      </td>
                      <td>{category.slug}</td>
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
                            ? ((order) => `Featured #${order}`)(
                                formatAdminCatalogNumber(category.featuredOrder || 0),
                              )
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
                            aria-label={((categoryName) => `Move ${categoryName} up`)(
                              categoryName,
                            )}
                            className="icon-button admin-icon-button"
                            disabled={Boolean(busyAction) || !canMoveUp}
                            onClick={() => void handleCategoryMove(category, "up")}
                            title={"Move up"}
                            type="button"
                          >
                            <ArrowUp aria-hidden="true" size={17} />
                          </button>
                          <button
                            aria-label={((categoryName) => `Move ${categoryName} down`)(
                              categoryName,
                            )}
                            className="icon-button admin-icon-button"
                            disabled={Boolean(busyAction) || !canMoveDown}
                            onClick={() => void handleCategoryMove(category, "down")}
                            title={"Move down"}
                            type="button"
                          >
                            <ArrowDown aria-hidden="true" size={17} />
                          </button>
                          <button
                            aria-label={((categoryName) => `Edit ${categoryName}`)(categoryName)}
                            className="icon-button admin-icon-button"
                            onClick={() => void openEditPanel(category)}
                            title={"Edit category"}
                            type="button"
                          >
                            <Edit3 aria-hidden="true" size={17} />
                          </button>
                          <button
                            aria-label={`${"Delete"}: ${categoryName}`}
                            className="icon-button admin-icon-button admin-icon-button--delete"
                            disabled={busyAction === `${category.id}:delete`}
                            onClick={() => void handleCategoryDelete(category)}
                            title={
                              busyAction === `${category.id}:delete`
                                ? "Deleting"
                                : "Delete"
                            }
                            type="button"
                          >
                            <Trash2 aria-hidden="true" size={17} />
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
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>

      </section>

      <AdminPagination
        copy={copy}
        isLoading={isLoading}
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
              {"Cancel"}
            </button>
            <button
              className="button button--primary"
              disabled={isSaving || isDetailLoading}
              form="admin-category-form"
              type="submit"
            >
              <Save aria-hidden="true" size={17} />
              {isSaving
                ? form.imageFile
                  ? "Uploading"
                  : "Saving"
                : panelMode === "create"
                  ? "Create"
                  : "Save"}
            </button>
          </>
        )}
        hasUnsavedChanges={hasUnsavedChanges}
        isOpen={isModalOpen}
        onClose={() => {
          releaseCategoryPreview(localPreviewUrlRef);
          setIsModalOpen(false);
        }}
        title={
          panelMode === "create"
            ? "New category"
            : "Edit category"
        }
      >
        {actionError ? (
          <AdminFeedback message={actionError} requestId={requestId} tone="error" />
        ) : null}
          <form className="admin-form admin-compact-form" id="admin-category-form" onSubmit={handleCategorySave}>
            <section className="admin-form-section admin-compact-basic" aria-labelledby="category-basic-heading">
              <div className="admin-form-section__heading">
                <p className="eyebrow">{"Basic information"}</p>
                <h3 id="category-basic-heading">{"Category details"}</h3>
                <p>{"Name the collection and describe how it appears in the storefront."}</p>
              </div>
              <div className="admin-form-section__content admin-compact-fields">
                <label className="admin-compact-field--wide">
                  <span>{"Name"}</span>
                  <input disabled={isDetailLoading} maxLength={120} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={"e.g. Dresses"} required value={form.name} />
                </label>
                <label className="admin-compact-field--wide">
                  <span>{"Slug"}</span>
                  <input disabled={isDetailLoading} maxLength={160} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder={"dresses"} required value={form.slug} />
                </label>
                <label className="admin-compact-field--wide">
                  <span>{"Description"}</span>
                  <textarea disabled={isDetailLoading} maxLength={2000} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder={"Enter category detail..."} rows={3} value={form.description} />
                </label>
              </div>
            </section>

            <section className="admin-form-section" aria-labelledby="category-visual-heading">
              <div className="admin-form-section__heading">
                <p className="eyebrow">{"Category image"}</p>
                <h3 id="category-visual-heading">{"Category image"}</h3>
                <p>{"JPEG, PNG, or WebP. Maximum 5 MB."}</p>
              </div>
              <div className="admin-category-visual-grid">
                <CategoryImagePreview copy={copy} url={form.imageUrl} />
                <div className="admin-category-image-controls">
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="admin-image-file-input"
                    disabled={isDetailLoading || isSaving}
                    onChange={handleCategoryImageSelection}
                    ref={imageInputRef}
                    type="file"
                  />
                  <button
                    className="button button--secondary"
                    disabled={isDetailLoading || isSaving}
                    onClick={() => imageInputRef.current?.click()}
                    type="button"
                  >
                    <Upload aria-hidden="true" size={15} />
                    {"Choose file"}
                  </button>
                  <div className="admin-category-image-meta">
                    <strong>{getCategoryImageLabel(form, copy)}</strong>
                    <small>{getCategoryImageStatus(form, copy)}</small>
                  </div>
                  {form.imageSource !== "none" ? (
                    <button
                      className="button button--secondary"
                      disabled={isDetailLoading || isSaving}
                      onClick={removeCategoryImage}
                      type="button"
                    >
                      <Trash2 aria-hidden="true" size={15} />
                    {"Remove"}
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="admin-form-section admin-form-section--compact" aria-labelledby="category-featured-heading">
              <div className="admin-form-section__heading">
                <p className="eyebrow">{"Featured placement"}</p>
                <h3 id="category-featured-heading">{"Featured placement"}</h3>
                <p>{"Up to three active categories can occupy the numbered featured slots."}</p>
              </div>
              <div className="admin-form-section__content admin-form-section__content--two-column">
                <label className="admin-checkbox admin-compact-checkbox">
                  <input
                    checked={form.isFeatured}
                    disabled={isDetailLoading || !form.isActive}
                    onChange={(event) => setForm((current) => ({ ...current, isFeatured: event.target.checked, featuredOrder: event.target.checked ? current.featuredOrder : "" }))}
                    type="checkbox"
                  />
                  <span>{"Featured on landing"}</span>
                </label>
                <label>
                  <span>{"Featured order"}</span>
                  <select disabled={isDetailLoading || !form.isFeatured} onChange={(event) => setForm((current) => ({ ...current, featuredOrder: event.target.value as CategoryFormState["featuredOrder"] }))} required={form.isFeatured} value={form.featuredOrder}>
                    <option value="">{"Choose an order"}</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="admin-form-section admin-form-section--compact" aria-labelledby="category-status-heading">
              <div className="admin-form-section__heading">
                <p className="eyebrow">{"Status"}</p>
                <h3 id="category-status-heading">{"Status"}</h3>
                <p>{"Deactivating a category also removes it from featured placement."}</p>
              </div>
              <label className="admin-checkbox admin-compact-checkbox">
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
              <span>{"Active"}</span>
            </label>
            </section>
          </form>
      </AdminModal>
    </div>
  );
}

function getEmptyCategoryForm(): CategoryFormState {
  return {
    description: "",
    featuredOrder: "",
    imageFilename: "",
    imageSource: "none",
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
    imageFilename:
      category.managedImageAsset?.originalFilename || "",
    imageSource: category.managedImageAsset
      ? "managed"
      : category.imageUrl
        ? "legacy"
        : "none",
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
    left.imageFilename === right.imageFilename &&
    left.imageSource === right.imageSource &&
    left.imageUrl === right.imageUrl &&
    left.isActive === right.isActive &&
    left.isFeatured === right.isFeatured &&
    left.name === right.name &&
    left.slug === right.slug
  );
}

function areCategoryDetailsEqual(
  left: CategoryFormState,
  right: CategoryFormState,
): boolean {
  return (
    left.description === right.description &&
    left.featuredOrder === right.featuredOrder &&
    left.isActive === right.isActive &&
    left.isFeatured === right.isFeatured &&
    left.name === right.name &&
    left.slug === right.slug
  );
}

function validateCategoryForm(
  form: CategoryFormState,
  copy: AdminCatalogCopy,
): string | undefined {
  if (!form.name.trim()) {
    return "Category name is required.";
  }

  if (!form.slug.trim()) {
    return "Category slug is required.";
  }

  if (form.isFeatured && !form.featuredOrder) {
    return "Choose featured order 1, 2, or 3.";
  }

  return undefined;
}

function getCategoryImageLabel(
  form: CategoryFormState,
  copy: AdminCatalogCopy,
): string {
  if (form.imageFilename) return form.imageFilename;
  if (form.imageSource === "legacy") return "Legacy category image";
  return "No category image";
}

function getCategoryImageStatus(
  form: CategoryFormState,
  copy: AdminCatalogCopy,
): string {
  if (form.imageSource === "local") return "Ready to upload";
  if (form.imageSource === "managed") return "Managed in Supabase Storage";
  if (form.imageSource === "legacy") return "Legacy URL image";
  return "Choose one image from your device";
}

function releaseCategoryPreview(ref: { current: string | undefined }) {
  if (ref.current) {
    URL.revokeObjectURL(ref.current);
    ref.current = undefined;
  }
}

function CategoryImagePreview({
  copy,
  url,
}: {
  copy: AdminCatalogCopy;
  url: string;
}) {
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    setHasFailed(false);
  }, [url]);

  return (
    <div className="admin-category-preview">
      {url && !hasFailed ? (
        <img
          alt={"Category preview"}
          onError={() => setHasFailed(true)}
          src={url}
        />
      ) : (
        <span>
          <ImageIcon aria-hidden="true" size={20} />
          {url ? "Image unavailable" : "No category image"}
        </span>
      )}
    </div>
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
      {requestId ? <small>{((requestId) => `Request ${requestId}`)(requestId)}</small> : null}
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
  onPageChange,
  pagination,
}: {
  copy: AdminCatalogCopy;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  pagination: Pagination;
}) {
  const totalPages = Math.max(1, pagination.totalPages);

  return (
    <nav
      className="admin-pagination"
      aria-label={((noun) => `${noun} pagination`)("categories")}
    >
      <button
        className="button button--secondary"
        disabled={isLoading || pagination.page <= 1}
        onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        type="button"
      >
        {"Previous"}
      </button>
      <span>
        {(({ noun, page, total, totalPages }) => `Page ${page} of ${totalPages} (${total} ${noun})`)({
          noun: "categories",
          page: formatAdminCatalogNumber(pagination.page),
          total: formatAdminCatalogNumber(pagination.total),
          totalPages: formatAdminCatalogNumber(totalPages),
        })}
      </span>
      <button
        className="button button--secondary"
        disabled={isLoading || pagination.page >= totalPages}
        onClick={() => onPageChange(pagination.page + 1)}
        type="button"
      >
        {"Next"}
      </button>
    </nav>
  );
}
