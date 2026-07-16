"use client";

import {
  AlertCircle,
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
  updateAdminCategory,
  uploadAdminCategoryImage,
} from "@/features/admin-catalog/api";
import type {
  AdminCategory,
  AdminCategoryQuery,
} from "@/features/admin-catalog/types";
import {
  localizeCategoryDescription,
  localizeCategoryName,
} from "@/features/catalog/localization";
import {
  formatAdminCatalogNumber,
  getAdminCatalogErrorMessage,
  getAdminCatalogTranslations,
  type AdminCatalogTranslations,
} from "@/features/i18n/admin-catalog-translations";
import { useI18n } from "@/features/i18n/useI18n";
import type { Pagination } from "@/lib/api/types";
import { AdminModal } from "@/components/admin/AdminModal";
import {
  formatAdminDate,
  formatOptional,
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

export function AdminCategoriesPage({ initialQuery }: AdminCategoriesPageProps) {
  const { locale } = useI18n();
  const copy = getAdminCatalogTranslations(locale);
  const copyRef = useRef(copy);
  copyRef.current = copy;
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
            copyRef.current.categories.errors,
            copyRef.current.categories.feedback.listLoadError,
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
          copy.categories.feedback.openError,
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
      setActionError(copy.categories.feedback.imageType);
      return;
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      setActionError(copy.categories.feedback.imageSize);
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
      !window.confirm(copy.categories.confirm.status(form.isActive, selectedCategory.name))
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
        setSuccessMessage(copy.categories.feedback.imageSaved);
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
          copy.categories.feedback.saveError,
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
        copy.categories.confirm.status(
          nextIsActive,
          localizeCategoryName(category.name, locale),
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
          ? copy.categories.feedback.activated
          : copy.categories.feedback.deactivated,
      );
    } catch (error) {
      setActionError(
        getAdminCatalogErrorMessage(
          error,
          copy.categories.errors,
          copy.categories.feedback.statusError,
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
        copy.categories.confirm.delete(
          localizeCategoryName(category.name, locale),
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
      setSuccessMessage(copy.categories.feedback.deleted);
      if (response.warning) {
        setActionError(response.warning);
      }
    } catch (error) {
      setActionError(
        getAdminCatalogErrorMessage(
          error,
          copy.categories.errors,
          copy.categories.feedback.deleteError,
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
          <p className="admin-page-intro__eyebrow">{copy.categories.header.eyebrow}</p>
          <h1 id="admin-categories-heading">{copy.categories.header.title}</h1>
          <p>{copy.categories.header.subtitle}</p>
        </div>
        <div className="admin-header-actions">
          <button
            className="button button--secondary"
            disabled={isLoading}
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={17} />
            {copy.common.refresh}
          </button>
          <button className="button button--primary" onClick={openCreatePanel} type="button">
            <Plus aria-hidden="true" size={17} />
            {copy.categories.header.newCategory}
          </button>
        </div>
      </section>

      <section className="admin-resource__toolbar admin-resource__toolbar--compact admin-resource__toolbar--inline admin-filter-surface" aria-label={copy.categories.filters.aria}>
        <form className="admin-search" onSubmit={handleSearchSubmit}>
          <label htmlFor="admin-category-search">{copy.common.search}</label>
          <div>
            <input
              id="admin-category-search"
              maxLength={120}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={copy.categories.filters.searchPlaceholder}
              type="search"
              value={searchInput}
            />
            <button className="button button--primary" type="submit">
              <Search aria-hidden="true" size={17} />
              {copy.common.search}
            </button>
          </div>
        </form>

        <div className="admin-filter-grid admin-filter-grid--compact">
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
              <option value="">{copy.common.allStatuses}</option>
              <option value="true">{copy.common.active}</option>
              <option value="false">{copy.common.inactive}</option>
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
            {copy.common.reset}
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
                <th>{copy.common.name}</th>
                <th>{copy.common.image}</th>
                <th>{copy.common.slug}</th>
                <th>{copy.common.description}</th>
                <th>{copy.common.status}</th>
                <th>{copy.categories.table.landing}</th>
                <th>{copy.categories.table.created}</th>
                <th>{copy.categories.table.updated}</th>
                <th>{copy.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? <AdminTableSkeleton columns={9} rows={6} /> : null}
              {!isLoading && !listError && categories.length === 0 ? (
                <tr>
                  <td className="admin-table__state" colSpan={9}>
                    {copy.categories.table.empty}
                  </td>
                </tr>
              ) : null}
              {!isLoading && !listError
                ? categories.map((category) => (
                    <tr
                      aria-label={copy.categories.table.openAria(
                        localizeCategoryName(category.name, locale),
                      )}
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
                        <strong>{localizeCategoryName(category.name, locale)}</strong>
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
                            {copy.categories.table.noImage}
                          </span>
                        )}
                      </td>
                      <td>{category.slug}</td>
                      <td className="admin-table__muted">
                        {formatOptional(
                          localizeCategoryDescription(category.description, locale),
                          locale,
                        )}
                      </td>
                      <td>
                        <span
                          className={`admin-badge ${
                            category.isActive
                              ? "admin-badge--neutral"
                              : "admin-badge--muted"
                          }`}
                        >
                          {category.isActive ? copy.common.active : copy.common.inactive}
                        </span>
                      </td>
                      <td>
                        <span className="admin-badge admin-badge--neutral">
                          {category.isFeatured
                            ? copy.categories.table.featured(
                                formatAdminCatalogNumber(
                                  category.featuredOrder || 0,
                                  locale,
                                ),
                              )
                            : copy.categories.table.notFeatured}
                        </span>
                      </td>
                      <td>{formatAdminDate(category.createdAt, locale)}</td>
                      <td>{formatAdminDate(category.updatedAt, locale)}</td>
                      <td>
                        <div
                          className="admin-row-actions"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <button
                            aria-label={copy.categories.table.editAria(
                              localizeCategoryName(category.name, locale),
                            )}
                            className="icon-button admin-icon-button"
                            onClick={() => void openEditPanel(category)}
                            title={copy.categories.table.editTitle}
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
                            {category.isActive ? copy.common.deactivate : copy.common.activate}
                          </button>
                          <button
                            className="admin-link-button admin-link-button--delete"
                            disabled={busyAction === `${category.id}:delete`}
                            onClick={() => void handleCategoryDelete(category)}
                            type="button"
                          >
                            {busyAction === `${category.id}:delete`
                              ? copy.common.deleting
                              : copy.common.delete}
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
              form="admin-category-form"
              type="submit"
            >
              <Save aria-hidden="true" size={17} />
              {isSaving
                ? form.imageFile
                  ? copy.common.uploading
                  : copy.common.saving
                : panelMode === "create"
                  ? copy.common.create
                  : copy.common.save}
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
            ? copy.categories.form.newTitle
            : copy.categories.form.editTitle
        }
      >
        {actionError ? (
          <AdminFeedback message={actionError} requestId={requestId} tone="error" />
        ) : null}
          <form className="admin-form admin-compact-form" id="admin-category-form" onSubmit={handleCategorySave}>
            <section className="admin-form-section admin-compact-basic" aria-labelledby="category-basic-heading">
              <div className="admin-form-section__heading">
                <p className="eyebrow">{copy.categories.form.basicEyebrow}</p>
                <h3 id="category-basic-heading">{copy.categories.form.detailsTitle}</h3>
                <p>{copy.categories.form.detailsHelper}</p>
              </div>
              <div className="admin-form-section__content admin-compact-fields">
                <label className="admin-compact-field--wide">
                  <span>{copy.common.name}</span>
                  <input disabled={isDetailLoading} maxLength={120} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={copy.categories.form.namePlaceholder} required value={form.name} />
                </label>
                <label className="admin-compact-field--wide">
                  <span>{copy.common.slug}</span>
                  <input disabled={isDetailLoading} maxLength={160} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder={copy.categories.form.slugPlaceholder} required value={form.slug} />
                </label>
                <label className="admin-compact-field--wide">
                  <span>{copy.common.description}</span>
                  <textarea disabled={isDetailLoading} maxLength={2000} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder={copy.categories.form.descriptionPlaceholder} rows={3} value={form.description} />
                </label>
              </div>
            </section>

            <section className="admin-form-section" aria-labelledby="category-visual-heading">
              <div className="admin-form-section__heading">
                <p className="eyebrow">{copy.categories.form.imageTitle}</p>
                <h3 id="category-visual-heading">{copy.categories.form.imageTitle}</h3>
                <p>{copy.categories.form.imageHelper}</p>
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
                    {copy.categories.form.chooseFile}
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
                    {copy.common.remove}
                    </button>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="admin-form-section admin-form-section--compact" aria-labelledby="category-featured-heading">
              <div className="admin-form-section__heading">
                <p className="eyebrow">{copy.categories.form.featuredTitle}</p>
                <h3 id="category-featured-heading">{copy.categories.form.featuredTitle}</h3>
                <p>{copy.categories.form.featuredHelper}</p>
              </div>
              <div className="admin-form-section__content admin-form-section__content--two-column">
                <label className="admin-checkbox admin-compact-checkbox">
                  <input
                    checked={form.isFeatured}
                    disabled={isDetailLoading || !form.isActive}
                    onChange={(event) => setForm((current) => ({ ...current, isFeatured: event.target.checked, featuredOrder: event.target.checked ? current.featuredOrder : "" }))}
                    type="checkbox"
                  />
                  <span>{copy.categories.form.featuredOnLanding}</span>
                </label>
                <label>
                  <span>{copy.categories.form.featuredOrder}</span>
                  <select disabled={isDetailLoading || !form.isFeatured} onChange={(event) => setForm((current) => ({ ...current, featuredOrder: event.target.value as CategoryFormState["featuredOrder"] }))} required={form.isFeatured} value={form.featuredOrder}>
                    <option value="">{copy.categories.form.chooseOrder}</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="admin-form-section admin-form-section--compact" aria-labelledby="category-status-heading">
              <div className="admin-form-section__heading">
                <p className="eyebrow">{copy.common.status}</p>
                <h3 id="category-status-heading">{copy.common.status}</h3>
                <p>{copy.categories.form.statusHelper}</p>
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
              <span>{copy.common.active}</span>
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
  copy: AdminCatalogTranslations,
): string | undefined {
  if (!form.name.trim()) {
    return copy.categories.validation.nameRequired;
  }

  if (!form.slug.trim()) {
    return copy.categories.validation.slugRequired;
  }

  if (form.isFeatured && !form.featuredOrder) {
    return copy.categories.validation.featuredOrder;
  }

  return undefined;
}

function getCategoryImageLabel(
  form: CategoryFormState,
  copy: AdminCatalogTranslations,
): string {
  if (form.imageFilename) return form.imageFilename;
  if (form.imageSource === "legacy") return copy.categories.form.legacyImageFallback;
  return copy.categories.form.noImage;
}

function getCategoryImageStatus(
  form: CategoryFormState,
  copy: AdminCatalogTranslations,
): string {
  if (form.imageSource === "local") return copy.categories.form.readyToUpload;
  if (form.imageSource === "managed") return copy.categories.form.managedImage;
  if (form.imageSource === "legacy") return copy.categories.form.legacyImage;
  return copy.categories.form.chooseImage;
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
  copy: AdminCatalogTranslations;
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
          alt={copy.categories.form.previewAlt}
          onError={() => setHasFailed(true)}
          src={url}
        />
      ) : (
        <span>
          <ImageIcon aria-hidden="true" size={20} />
          {url ? copy.categories.form.imageUnavailable : copy.categories.form.noImage}
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
  const { locale } = useI18n();
  const copy = getAdminCatalogTranslations(locale);
  const Icon = tone === "success" ? CheckCircle2 : AlertCircle;

  return (
    <div className={`admin-feedback admin-feedback--${tone}`} role="status">
      <Icon aria-hidden="true" size={19} />
      <span>{message}</span>
      {requestId ? <small>{copy.common.request(requestId)}</small> : null}
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
  copy: AdminCatalogTranslations;
  isLoading: boolean;
  locale: "en" | "vi";
  onPageChange: (page: number) => void;
  pagination: Pagination;
}) {
  const totalPages = Math.max(1, pagination.totalPages);

  return (
    <nav
      className="admin-pagination"
      aria-label={copy.common.paginationAria(copy.categories.noun)}
    >
      <button
        className="button button--secondary"
        disabled={isLoading || pagination.page <= 1}
        onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        type="button"
      >
        {copy.common.previous}
      </button>
      <span>
        {copy.common.paginationSummary({
          noun: copy.categories.noun,
          page: formatAdminCatalogNumber(pagination.page, locale),
          total: formatAdminCatalogNumber(pagination.total, locale),
          totalPages: formatAdminCatalogNumber(totalPages, locale),
        })}
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
