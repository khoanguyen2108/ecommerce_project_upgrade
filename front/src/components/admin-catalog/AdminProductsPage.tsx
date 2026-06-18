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
  createAdminProduct,
  createAdminProductVariant,
  deactivateAdminProduct,
  deactivateAdminProductVariant,
  getAdminProduct,
  getAdminProductVariant,
  listAdminCategories,
  listAdminProducts,
  listAdminProductVariants,
  updateAdminProduct,
  updateAdminProductVariant,
} from "@/features/admin-catalog/api";
import type {
  AdminCategory,
  AdminProduct,
  AdminProductQuery,
  AdminProductVariant,
  AdminSortOrder,
  AdminProductSort,
} from "@/features/admin-catalog/types";
import { formatPrice } from "@/features/catalog/format";
import type { Pagination } from "@/lib/api/types";
import { AdminModal } from "@/components/admin/AdminModal";
import {
  formatOptional,
  getApiErrorMessage,
  getApiRequestId,
  getBooleanFilterValue,
  normalizeNullableText,
  parseActiveFilter,
} from "@/components/admin/admin-format";

const PRODUCT_LIMIT = 20;
const CATEGORY_OPTION_LIMIT = 100;

const PRODUCT_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Your admin session is required. Sign in again to continue.",
  BAD_REQUEST: "Some catalog fields are invalid. Review the form and try again.",
  CATALOG_UPDATE_EMPTY: "Change at least one catalog field before saving.",
  CATEGORY_INACTIVE: "Products cannot be assigned to an inactive category.",
  CATEGORY_NOT_FOUND: "That category no longer exists.",
  FORBIDDEN: "This account is not allowed to manage admin products.",
  INVALID_CATALOG_FIELD: "One or more catalog fields are invalid.",
  INVALID_PRICE_RANGE: "The price filter range is invalid.",
  NETWORK_ERROR: "The product API could not be reached. Check the backend and retry.",
  PRODUCT_NOT_FOUND: "That product no longer exists.",
  PRODUCT_SLUG_EXISTS: "Another product already uses this slug.",
  PRODUCT_VARIANT_NOT_FOUND: "That variant no longer exists.",
  PRODUCT_VARIANT_OPTION_EXISTS:
    "A variant with this size and color already exists for this product.",
  PRODUCT_VARIANT_SKU_EXISTS: "Another variant already uses this SKU.",
  VALIDATION_ERROR: "Some catalog fields are invalid. Review the form and try again.",
};

interface AdminProductsPageProps {
  initialQuery: AdminProductQuery;
}

interface ProductFormState {
  basePrice: string;
  categoryId: string;
  description: string;
  imageUrlsText: string;
  isActive: boolean;
  name: string;
  slug: string;
}

interface VariantFormState {
  color: string;
  isActive: boolean;
  priceOverride: string;
  size: string;
  sku: string;
  stock: string;
}

type ProductPanelMode = "create" | "edit";

interface ProductSortChoice {
  label: string;
  order: AdminSortOrder;
  sort: AdminProductSort;
  value: string;
}

const PRODUCT_SORT_CHOICES: ProductSortChoice[] = [
  {
    label: "Newest",
    order: "desc",
    sort: "createdAt",
    value: "createdAt_desc",
  },
  {
    label: "Recently updated",
    order: "desc",
    sort: "updatedAt",
    value: "updatedAt_desc",
  },
  {
    label: "Name A-Z",
    order: "asc",
    sort: "name",
    value: "name_asc",
  },
  {
    label: "Price low to high",
    order: "asc",
    sort: "basePrice",
    value: "basePrice_asc",
  },
  {
    label: "Price high to low",
    order: "desc",
    sort: "basePrice",
    value: "basePrice_desc",
  },
  {
    label: "Active first",
    order: "desc",
    sort: "isActive",
    value: "isActive_desc",
  },
];

export function AdminProductsPage({ initialQuery }: AdminProductsPageProps) {
  const [query, setQuery] = useState<AdminProductQuery>({
    ...initialQuery,
    limit: PRODUCT_LIMIT,
    page: initialQuery.page || 1,
    sort: initialQuery.sort || "createdAt",
    order: initialQuery.order || "desc",
  });
  const [searchInput, setSearchInput] = useState(initialQuery.search || "");
  const [minPriceInput, setMinPriceInput] = useState(
    initialQuery.minPrice?.toString() || "",
  );
  const [maxPriceInput, setMaxPriceInput] = useState(
    initialQuery.maxPrice?.toString() || "",
  );
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    limit: PRODUCT_LIMIT,
    page: query.page || 1,
    total: 0,
    totalPages: 1,
  });
  const [panelMode, setPanelMode] = useState<ProductPanelMode>("create");
  const [selectedProduct, setSelectedProduct] = useState<AdminProduct>();
  const [productForm, setProductForm] =
    useState<ProductFormState>(getEmptyProductForm());
  const [variantForm, setVariantForm] =
    useState<VariantFormState>(getEmptyVariantForm());
  const [editingVariantId, setEditingVariantId] = useState<string>();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProductLoading, setIsProductLoading] = useState(true);
  const [isCategoryLoading, setIsCategoryLoading] = useState(true);
  const [isPanelLoading, setIsPanelLoading] = useState(false);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isSavingVariant, setIsSavingVariant] = useState(false);
  const [busyAction, setBusyAction] = useState<string>();
  const [listError, setListError] = useState<string>();
  const [categoryError, setCategoryError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadCategories() {
      setIsCategoryLoading(true);

      try {
        const response = await listAdminCategories({
          limit: CATEGORY_OPTION_LIMIT,
          order: "asc",
          sort: "name",
        });

        if (!isMounted) {
          return;
        }

        setCategories(response.categories);
        setCategoryError(undefined);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setCategories([]);
        setCategoryError(
          getApiErrorMessage(
            error,
            PRODUCT_ERROR_MESSAGES,
            "Category options could not be loaded.",
          ),
        );
      } finally {
        if (isMounted) {
          setIsCategoryLoading(false);
        }
      }
    }

    void loadCategories();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    let isMounted = true;

    async function loadProducts() {
      setIsProductLoading(true);
      setListError(undefined);

      try {
        const response = await listAdminProducts(query);

        if (!isMounted) {
          return;
        }

        setProducts(response.products);
        setPagination(response.pagination);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setProducts([]);
        setListError(
          getApiErrorMessage(
            error,
            PRODUCT_ERROR_MESSAGES,
            "Admin products could not be loaded right now.",
          ),
        );
        setRequestId(getApiRequestId(error));
      } finally {
        if (isMounted) {
          setIsProductLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      isMounted = false;
    };
  }, [query, refreshKey]);

  function handleSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(undefined);

    const minPrice = parseOptionalInteger(minPriceInput);
    const maxPrice = parseOptionalInteger(maxPriceInput);

    if (minPrice.error || maxPrice.error) {
      setActionError("Price filters must be whole numbers greater than or equal to 0.");
      return;
    }

    if (
      minPrice.value !== undefined &&
      maxPrice.value !== undefined &&
      minPrice.value > maxPrice.value
    ) {
      setActionError("Minimum price cannot be higher than maximum price.");
      return;
    }

    setQuery((current) => ({
      ...current,
      maxPrice: maxPrice.value,
      minPrice: minPrice.value,
      page: 1,
      search: searchInput.trim() || undefined,
    }));
  }

  function handleFilterChange(nextQuery: Partial<AdminProductQuery>) {
    setQuery((current) => ({
      ...current,
      ...nextQuery,
      page: 1,
    }));
  }

  function handleSortChange(value: string) {
    const sortChoice =
      PRODUCT_SORT_CHOICES.find((choice) => choice.value === value) ||
      PRODUCT_SORT_CHOICES[0];

    handleFilterChange({
      order: sortChoice.order,
      sort: sortChoice.sort,
    });
  }

  function goToPage(page: number) {
    setQuery((current) => ({
      ...current,
      page,
    }));
  }

  function openCreatePanel() {
    setPanelMode("create");
    setSelectedProduct(undefined);
    setProductForm(getEmptyProductForm());
    setVariantForm(getEmptyVariantForm());
    setEditingVariantId(undefined);
    setActionError(undefined);
    setSuccessMessage(undefined);
    setRequestId(undefined);
    setIsModalOpen(true);
  }

  async function openEditPanel(product: AdminProduct) {
    setPanelMode("edit");
    setSelectedProduct(product);
    setProductForm(getProductForm(product));
    setVariantForm(getEmptyVariantForm());
    setEditingVariantId(undefined);
    setActionError(undefined);
    setSuccessMessage(undefined);
    setRequestId(undefined);
    setIsModalOpen(true);
    setIsPanelLoading(true);

    try {
      const [productResponse, variantsResponse] = await Promise.all([
        getAdminProduct(product.id),
        listAdminProductVariants(product.id, {
          limit: CATEGORY_OPTION_LIMIT,
          order: "desc",
          sort: "createdAt",
        }),
      ]);
      const loadedProduct = {
        ...productResponse.product,
        variants: variantsResponse.variants,
      };

      setSelectedProduct(loadedProduct);
      setProductForm(getProductForm(loadedProduct));
      syncProduct(loadedProduct);
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          PRODUCT_ERROR_MESSAGES,
          "This product could not be opened right now.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setIsPanelLoading(false);
    }
  }

  async function handleProductSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(undefined);
    setSuccessMessage(undefined);

    const productPayload = getProductPayload(productForm);

    if (productPayload.error || !productPayload.payload) {
      setActionError(productPayload.error || "Product fields are invalid.");
      return;
    }

    if (
      panelMode === "edit" &&
      selectedProduct &&
      productPayload.payload.isActive !== selectedProduct.isActive &&
      !window.confirm(
        `${productPayload.payload.isActive ? "Activate" : "Deactivate"} ${selectedProduct.name}?`,
      )
    ) {
      return;
    }

    setIsSavingProduct(true);

    try {
      if (panelMode === "create") {
        await createAdminProduct(productPayload.payload);

        setSuccessMessage("Product created.");
      } else if (selectedProduct) {
        const response = await updateAdminProduct(
          selectedProduct.id,
          productPayload.payload,
        );
        const updatedProduct = {
          ...response.product,
          variants: response.product.variants || selectedProduct.variants,
        };

        setSelectedProduct(updatedProduct);
        setProductForm(getProductForm(updatedProduct));
        syncProduct(updatedProduct);
        setSuccessMessage("Product updated.");
      }

      setRefreshKey((current) => current + 1);
      setIsModalOpen(false);
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          PRODUCT_ERROR_MESSAGES,
          "Product could not be saved.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function handleProductStatusChange(product: AdminProduct) {
    const nextIsActive = !product.isActive;

    if (
      !window.confirm(
        `${nextIsActive ? "Activate" : "Deactivate"} ${product.name}?`,
      )
    ) {
      return;
    }

    setBusyAction(`${product.id}:product`);
    setActionError(undefined);
    setSuccessMessage(undefined);
    setRequestId(undefined);

    try {
      const response = nextIsActive
        ? await updateAdminProduct(product.id, { isActive: true })
        : await deactivateAdminProduct(product.id);
      const updatedProduct = {
        ...response.product,
        variants:
          selectedProduct?.id === response.product.id
            ? selectedProduct.variants
            : response.product.variants,
      };

      syncProduct(updatedProduct);
      setRefreshKey((current) => current + 1);
      setSuccessMessage(
        response.product.isActive ? "Product activated." : "Product deactivated.",
      );
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          PRODUCT_ERROR_MESSAGES,
          "Product status could not be changed.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function handleEditVariant(variant: AdminProductVariant) {
    setEditingVariantId(variant.id);
    setVariantForm(getVariantForm(variant));
    setActionError(undefined);

    try {
      const response = await getAdminProductVariant(variant.id);

      setVariantForm(getVariantForm(response.variant));
      syncVariant(response.variant);
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          PRODUCT_ERROR_MESSAGES,
          "This variant could not be opened right now.",
        ),
      );
      setRequestId(getApiRequestId(error));
    }
  }

  async function handleVariantSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedProduct) {
      return;
    }

    setActionError(undefined);
    setSuccessMessage(undefined);

    const variantPayload = getVariantPayload(variantForm);

    if (variantPayload.error || !variantPayload.payload) {
      setActionError(variantPayload.error || "Variant fields are invalid.");
      return;
    }

    const editingVariant = editingVariantId
      ? selectedProduct.variants.find((variant) => variant.id === editingVariantId)
      : undefined;

    if (
      editingVariant &&
      variantPayload.payload.isActive !== editingVariant.isActive &&
      !window.confirm(
        `${variantPayload.payload.isActive ? "Activate" : "Deactivate"} variant ${editingVariant.size} / ${editingVariant.color}?`,
      )
    ) {
      return;
    }

    setIsSavingVariant(true);

    try {
      if (editingVariantId) {
        const response = await updateAdminProductVariant(
          editingVariantId,
          variantPayload.payload,
        );

        syncVariant(response.variant);
        setSuccessMessage("Variant updated.");
      } else {
        const response = await createAdminProductVariant(
          selectedProduct.id,
          variantPayload.payload,
        );

        syncVariant(response.variant);
        setSuccessMessage("Variant created.");
      }

      setVariantForm(getEmptyVariantForm());
      setEditingVariantId(undefined);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          PRODUCT_ERROR_MESSAGES,
          "Variant could not be saved.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setIsSavingVariant(false);
    }
  }

  async function handleVariantStatusChange(variant: AdminProductVariant) {
    const nextIsActive = !variant.isActive;

    if (
      !window.confirm(
        `${nextIsActive ? "Activate" : "Deactivate"} variant ${variant.size} / ${variant.color}?`,
      )
    ) {
      return;
    }

    setBusyAction(`${variant.id}:variant`);
    setActionError(undefined);
    setSuccessMessage(undefined);

    try {
      const response = nextIsActive
        ? await updateAdminProductVariant(variant.id, { isActive: true })
        : await deactivateAdminProductVariant(variant.id);

      syncVariant(response.variant);
      setRefreshKey((current) => current + 1);
      setSuccessMessage(
        response.variant.isActive ? "Variant activated." : "Variant deactivated.",
      );
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          PRODUCT_ERROR_MESSAGES,
          "Variant status could not be changed.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setBusyAction(undefined);
    }
  }

  function syncProduct(product: AdminProduct) {
    setProducts((current) =>
      current.map((item) => (item.id === product.id ? product : item)),
    );
    setSelectedProduct((current) => (current?.id === product.id ? product : current));
  }

  function syncVariant(variant: AdminProductVariant) {
    setSelectedProduct((current) =>
      current && current.id === variant.productId
        ? {
            ...current,
            variants: mergeVariant(current.variants, variant),
          }
        : current,
    );
    setProducts((current) =>
      current.map((product) =>
        product.id === variant.productId
          ? {
              ...product,
              variants: mergeVariant(product.variants, variant),
            }
          : product,
      ),
    );
  }

  const hasFilters =
    Boolean(query.search) ||
    Boolean(query.categoryId) ||
    query.isActive !== undefined ||
    query.minPrice !== undefined ||
    query.maxPrice !== undefined ||
    query.sort !== "createdAt" ||
    query.order !== "desc";

  const selectedSortValue = getProductSortValue(query);
  const productFormBaseline =
    panelMode === "edit" && selectedProduct
      ? getProductForm(selectedProduct)
      : getEmptyProductForm();
  const editingVariant = editingVariantId
    ? selectedProduct?.variants.find(
        (variant) => variant.id === editingVariantId,
      )
    : undefined;
  const variantFormBaseline = editingVariant
    ? getVariantForm(editingVariant)
    : getEmptyVariantForm();
  const hasUnsavedChanges = isModalOpen
    ? !areProductFormsEqual(productForm, productFormBaseline) ||
      !areVariantFormsEqual(variantForm, variantFormBaseline)
    : false;

  return (
    <div className="admin-resource admin-resource--full-width">
      <section
        className="admin-resource__header"
        aria-labelledby="admin-products-heading"
      >
        <h1 id="admin-products-heading">Products</h1>
        <div className="admin-header-actions">
          <button
            className="button button--secondary"
            disabled={isProductLoading}
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={17} />
            Refresh
          </button>
          <button className="button button--primary" onClick={openCreatePanel} type="button">
            <Plus aria-hidden="true" size={17} />
            New product
          </button>
        </div>
      </section>

      <section className="admin-resource__toolbar" aria-label="Product filters">
        <form className="admin-search admin-search--products" onSubmit={handleSearchSubmit}>
          <label htmlFor="admin-product-search">Search</label>
          <div>
            <input
              id="admin-product-search"
              maxLength={120}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Name or slug"
              type="search"
              value={searchInput}
            />
            <input
              aria-label="Minimum price"
              inputMode="numeric"
              min="0"
              onChange={(event) => setMinPriceInput(event.target.value)}
              placeholder="Min price"
              type="number"
              value={minPriceInput}
            />
            <input
              aria-label="Maximum price"
              inputMode="numeric"
              min="0"
              onChange={(event) => setMaxPriceInput(event.target.value)}
              placeholder="Max price"
              type="number"
              value={maxPriceInput}
            />
            <button className="button button--primary" type="submit">
              <Search aria-hidden="true" size={17} />
              Search
            </button>
          </div>
        </form>

        <div className="admin-filter-grid">
          <label>
            <span>Category</span>
            <select
              disabled={isCategoryLoading || Boolean(categoryError)}
              onChange={(event) =>
                handleFilterChange({
                  categoryId: event.target.value || undefined,
                })
              }
              value={query.categoryId || ""}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
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

          <label>
            <span>Sort</span>
            <select onChange={(event) => handleSortChange(event.target.value)} value={selectedSortValue}>
              {PRODUCT_SORT_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
          </label>

          <button
            className="button button--secondary"
            disabled={!hasFilters || isProductLoading}
            onClick={() => {
              setSearchInput("");
              setMinPriceInput("");
              setMaxPriceInput("");
              setQuery({
                limit: PRODUCT_LIMIT,
                order: "desc",
                page: 1,
                sort: "createdAt",
              });
            }}
            type="button"
          >
            <RotateCcw aria-hidden="true" size={17} />
            Reset
          </button>
        </div>
      </section>

      {categoryError ? (
        <AdminFeedback message={categoryError} tone="error" />
      ) : null}
      {!isModalOpen && successMessage ? (
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
                <th>Image</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Category</th>
                <th>Base price</th>
                <th>Status</th>
                <th>Variants</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isProductLoading ? <AdminTableSkeleton columns={8} rows={6} /> : null}
              {!isProductLoading && !listError && products.length === 0 ? (
                <tr>
                  <td className="admin-table__state" colSpan={8}>
                    No products match the current filters.
                  </td>
                </tr>
              ) : null}
              {!isProductLoading && !listError
                ? products.map((product) => (
                    <tr
                      aria-label={`Open ${product.name}`}
                      className="admin-table__clickable-row"
                      key={product.id}
                      onClick={() => void openEditPanel(product)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          void openEditPanel(product);
                        }
                      }}
                      tabIndex={0}
                    >
                      <td>
                        <div className="admin-product-thumb">
                          {product.imageUrls[0] ? (
                            <img alt={product.name} src={product.imageUrls[0]} />
                          ) : (
                            <span>No image</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <strong>{product.name}</strong>
                      </td>
                      <td>{product.slug}</td>
                      <td>{product.category?.name || "Not set"}</td>
                      <td>{formatPrice(product.basePrice)}</td>
                      <td>
                        <span
                          className={`admin-badge ${
                            product.isActive
                              ? "admin-badge--success"
                              : "admin-badge--muted"
                          }`}
                        >
                          {product.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>{product.variants.length}</td>
                      <td>
                        <div
                          className="admin-row-actions"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <button
                            aria-label={`Edit ${product.name}`}
                            className="icon-button admin-icon-button"
                            onClick={() => void openEditPanel(product)}
                            title="Edit product"
                            type="button"
                          >
                            <Edit3 aria-hidden="true" size={17} />
                          </button>
                          <button
                            className="admin-link-button"
                            disabled={
                              busyAction === `${product.id}:product`
                            }
                            onClick={() => void handleProductStatusChange(product)}
                            type="button"
                          >
                            {product.isActive ? "Deactivate" : "Activate"}
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
        isLoading={isProductLoading}
        onPageChange={goToPage}
        pagination={pagination}
      />

      <AdminModal
        closeDisabled={isSavingProduct || isSavingVariant}
        footer={(requestClose) => (
          <>
            <button
              className="button button--secondary"
              disabled={isSavingProduct || isSavingVariant}
              onClick={requestClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="button button--primary"
              disabled={isSavingProduct || isSavingVariant || isPanelLoading}
              form="admin-product-form"
              type="submit"
            >
              <Save aria-hidden="true" size={17} />
              {isSavingProduct
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
            ? "New product"
            : selectedProduct?.name || "Product detail"
        }
      >
        {actionError ? (
          <AdminFeedback message={actionError} requestId={requestId} tone="error" />
        ) : null}
        {successMessage ? (
          <AdminFeedback message={successMessage} tone="success" />
        ) : null}
          <form className="admin-form" id="admin-product-form" onSubmit={handleProductSave}>
            <label>
              <span>Name</span>
              <input
                disabled={isPanelLoading}
                maxLength={160}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                required
                value={productForm.name}
              />
            </label>

            <label>
              <span>Slug</span>
              <input
                disabled={isPanelLoading}
                maxLength={180}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    slug: event.target.value,
                  }))
                }
                required
                value={productForm.slug}
              />
            </label>

            <label>
              <span>Description</span>
              <textarea
                disabled={isPanelLoading}
                maxLength={4000}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={4}
                value={productForm.description}
              />
            </label>

            <div className="admin-form__split">
              <label>
                <span>Base price</span>
                <input
                  disabled={isPanelLoading}
                  min="0"
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      basePrice: event.target.value,
                    }))
                  }
                  required
                  type="number"
                  value={productForm.basePrice}
                />
              </label>

              <label>
                <span>Category</span>
                <select
                  disabled={isPanelLoading || isCategoryLoading}
                  onChange={(event) =>
                    setProductForm((current) => ({
                      ...current,
                      categoryId: event.target.value,
                    }))
                  }
                  required
                  value={productForm.categoryId}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                      {category.isActive ? "" : " (inactive)"}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              <span>Image URLs</span>
              <textarea
                disabled={isPanelLoading}
                maxLength={24576}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    imageUrlsText: event.target.value,
                  }))
                }
                placeholder="https://example.com/image.jpg"
                rows={5}
                value={productForm.imageUrlsText}
              />
            </label>

            <label className="admin-checkbox">
              <input
                checked={productForm.isActive}
                disabled={isPanelLoading}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
                type="checkbox"
              />
              <span>Active</span>
            </label>

          </form>

          <section className="admin-variants" aria-labelledby="product-variants-heading">
            <div className="admin-variants__header">
              <div>
                <p className="eyebrow">Variants</p>
                <h3 id="product-variants-heading">Product variants</h3>
              </div>
              {editingVariantId ? (
                <button
                  className="admin-link-button"
                  onClick={() => {
                    setEditingVariantId(undefined);
                    setVariantForm(getEmptyVariantForm());
                  }}
                  type="button"
                >
                  New variant
                </button>
              ) : null}
            </div>

            {panelMode === "edit" && selectedProduct ? (
              <>
                <div className="admin-table-wrap admin-table-wrap--compact">
                  <table className="admin-table admin-table--compact">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>Size</th>
                        <th>Color</th>
                        <th>Stock</th>
                        <th>Override</th>
                        <th>Status</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProduct.variants.length === 0 ? (
                        <tr>
                          <td className="admin-table__state" colSpan={7}>
                            No variants exist for this product.
                          </td>
                        </tr>
                      ) : (
                        selectedProduct.variants.map((variant) => (
                          <tr key={variant.id}>
                            <td>{formatOptional(variant.sku)}</td>
                            <td>{variant.size}</td>
                            <td>{variant.color}</td>
                            <td>{variant.stock}</td>
                            <td>
                              {variant.priceOverride === null
                                ? "Not set"
                                : formatPrice(variant.priceOverride)}
                            </td>
                            <td>
                              <span
                                className={`admin-badge ${
                                  variant.isActive
                                    ? "admin-badge--success"
                                    : "admin-badge--muted"
                                }`}
                              >
                                {variant.isActive ? "Active" : "Inactive"}
                              </span>
                            </td>
                            <td>
                              <div className="admin-row-actions">
                                <button
                                  aria-label={`Edit variant ${variant.size} ${variant.color}`}
                                  className="icon-button admin-icon-button"
                                  onClick={() => void handleEditVariant(variant)}
                                  title="Edit variant"
                                  type="button"
                                >
                                  <Edit3 aria-hidden="true" size={16} />
                                </button>
                                <button
                                  className="admin-link-button"
                                  disabled={busyAction === `${variant.id}:variant`}
                                  onClick={() => void handleVariantStatusChange(variant)}
                                  type="button"
                                >
                                  {variant.isActive ? "Deactivate" : "Activate"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <form className="admin-form admin-form--variant" onSubmit={handleVariantSave}>
                  <div className="admin-form__split">
                    <label>
                      <span>SKU</span>
                      <input
                        maxLength={80}
                        onChange={(event) =>
                          setVariantForm((current) => ({
                            ...current,
                            sku: event.target.value,
                          }))
                        }
                        value={variantForm.sku}
                      />
                    </label>

                    <label>
                      <span>Size</span>
                      <input
                        maxLength={32}
                        onChange={(event) =>
                          setVariantForm((current) => ({
                            ...current,
                            size: event.target.value,
                          }))
                        }
                        required
                        value={variantForm.size}
                      />
                    </label>
                  </div>

                  <div className="admin-form__split">
                    <label>
                      <span>Color</span>
                      <input
                        maxLength={64}
                        onChange={(event) =>
                          setVariantForm((current) => ({
                            ...current,
                            color: event.target.value,
                          }))
                        }
                        required
                        value={variantForm.color}
                      />
                    </label>

                    <label>
                      <span>Stock</span>
                      <input
                        min="0"
                        onChange={(event) =>
                          setVariantForm((current) => ({
                            ...current,
                            stock: event.target.value,
                          }))
                        }
                        required
                        type="number"
                        value={variantForm.stock}
                      />
                    </label>
                  </div>

                  <label>
                    <span>Price override</span>
                    <input
                      min="0"
                      onChange={(event) =>
                        setVariantForm((current) => ({
                          ...current,
                          priceOverride: event.target.value,
                        }))
                      }
                      type="number"
                      value={variantForm.priceOverride}
                    />
                  </label>

                  <label className="admin-checkbox">
                    <input
                      checked={variantForm.isActive}
                      onChange={(event) =>
                        setVariantForm((current) => ({
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
                    disabled={isSavingVariant}
                    type="submit"
                  >
                    <Save aria-hidden="true" size={17} />
                    {isSavingVariant
                      ? "Saving"
                      : editingVariantId
                        ? "Save variant"
                        : "Create variant"}
                  </button>
                </form>
              </>
            ) : (
              <div className="admin-panel__empty" role="status">
                Save or open a product before editing variants.
              </div>
            )}
          </section>
      </AdminModal>
    </div>
  );
}

function getEmptyProductForm(): ProductFormState {
  return {
    basePrice: "",
    categoryId: "",
    description: "",
    imageUrlsText: "",
    isActive: true,
    name: "",
    slug: "",
  };
}

function getProductForm(product: AdminProduct): ProductFormState {
  return {
    basePrice: String(product.basePrice),
    categoryId: product.categoryId,
    description: product.description || "",
    imageUrlsText: product.imageUrls.join("\n"),
    isActive: product.isActive,
    name: product.name,
    slug: product.slug,
  };
}

function mergeVariant(
  variants: AdminProductVariant[],
  variant: AdminProductVariant,
): AdminProductVariant[] {
  const hasVariant = variants.some((item) => item.id === variant.id);

  return hasVariant
    ? variants.map((item) => (item.id === variant.id ? variant : item))
    : [variant, ...variants];
}

function getEmptyVariantForm(): VariantFormState {
  return {
    color: "",
    isActive: true,
    priceOverride: "",
    size: "",
    sku: "",
    stock: "",
  };
}

function getVariantForm(variant: AdminProductVariant): VariantFormState {
  return {
    color: variant.color,
    isActive: variant.isActive,
    priceOverride: variant.priceOverride === null ? "" : String(variant.priceOverride),
    size: variant.size,
    sku: variant.sku || "",
    stock: String(variant.stock),
  };
}

function areProductFormsEqual(
  left: ProductFormState,
  right: ProductFormState,
): boolean {
  return (
    left.basePrice === right.basePrice &&
    left.categoryId === right.categoryId &&
    left.description === right.description &&
    left.imageUrlsText === right.imageUrlsText &&
    left.isActive === right.isActive &&
    left.name === right.name &&
    left.slug === right.slug
  );
}

function areVariantFormsEqual(
  left: VariantFormState,
  right: VariantFormState,
): boolean {
  return (
    left.color === right.color &&
    left.isActive === right.isActive &&
    left.priceOverride === right.priceOverride &&
    left.size === right.size &&
    left.sku === right.sku &&
    left.stock === right.stock
  );
}

function getProductPayload(form: ProductFormState):
  | {
      payload: {
        basePrice: number;
        categoryId: string;
        description: string | null;
        imageUrls: string[];
        isActive: boolean;
        name: string;
        slug: string;
      };
      error?: undefined;
    }
  | { error: string; payload?: undefined } {
  const basePrice = parseRequiredInteger(form.basePrice);
  const imageUrls = parseImageUrls(form.imageUrlsText);

  if (!form.name.trim()) {
    return { error: "Product name is required." };
  }

  if (!form.slug.trim()) {
    return { error: "Product slug is required." };
  }

  if (!form.categoryId) {
    return { error: "Product category is required." };
  }

  if (basePrice === undefined) {
    return { error: "Base price must be a whole number greater than or equal to 0." };
  }

  if (imageUrls.error) {
    return { error: imageUrls.error };
  }

  return {
    payload: {
      basePrice,
      categoryId: form.categoryId,
      description: normalizeNullableText(form.description),
      imageUrls: imageUrls.urls,
      isActive: form.isActive,
      name: form.name.trim(),
      slug: form.slug.trim(),
    },
  };
}

function getVariantPayload(form: VariantFormState):
  | {
      payload: {
        color: string;
        isActive: boolean;
        priceOverride: number | null;
        size: string;
        sku: string | null;
        stock: number;
      };
      error?: undefined;
    }
  | { error: string; payload?: undefined } {
  const stock = parseRequiredInteger(form.stock);
  const priceOverride = form.priceOverride.trim()
    ? parseRequiredInteger(form.priceOverride)
    : null;

  if (!form.size.trim()) {
    return { error: "Variant size is required." };
  }

  if (!form.color.trim()) {
    return { error: "Variant color is required." };
  }

  if (stock === undefined) {
    return { error: "Variant stock must be a whole number greater than or equal to 0." };
  }

  if (priceOverride === undefined) {
    return {
      error: "Variant price override must be a whole number greater than or equal to 0.",
    };
  }

  return {
    payload: {
      color: form.color.trim(),
      isActive: form.isActive,
      priceOverride,
      size: form.size.trim(),
      sku: normalizeNullableText(form.sku),
      stock,
    },
  };
}

function parseOptionalInteger(value: string): {
  error?: true;
  value?: number;
} {
  if (!value.trim()) {
    return {};
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return { error: true };
  }

  return { value: parsed };
}

function parseRequiredInteger(value: string): number | undefined {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

function parseImageUrls(text: string): { error?: string; urls: string[] } {
  const urls = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (urls.length > 12) {
    return { error: "Image URL list can include at most 12 URLs.", urls: [] };
  }

  for (const url of urls) {
    if (url.length > 2048 || !isHttpUrl(url)) {
      return {
        error: "Each image URL must be a valid http or https URL.",
        urls: [],
      };
    }
  }

  return { urls };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getProductSortValue(query: AdminProductQuery): string {
  const sort = query.sort || "createdAt";
  const order = query.order || "desc";
  const value = `${sort}_${order}`;

  return PRODUCT_SORT_CHOICES.some((choice) => choice.value === value)
    ? value
    : "createdAt_desc";
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
    <nav className="admin-pagination" aria-label="Products pagination">
      <button
        className="button button--secondary"
        disabled={isLoading || pagination.page <= 1}
        onClick={() => onPageChange(Math.max(1, pagination.page - 1))}
        type="button"
      >
        Previous
      </button>
      <span>
        Page {pagination.page} of {totalPages} ({pagination.total} products)
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
