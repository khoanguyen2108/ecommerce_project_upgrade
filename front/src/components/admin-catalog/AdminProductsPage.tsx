"use client";

import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
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
  createAdminProduct,
  createAdminProductVariant,
  activateAdminProduct,
  deactivateAdminProduct,
  deactivateAdminProductVariant,
  getAdminProduct,
  getAdminProductVariant,
  listAdminCategories,
  listAdminProducts,
  listAdminProductVariants,
  deleteAdminProductImage,
  deleteAdminProduct,
  reorderAdminProductImages,
  uploadAdminProductImage,
  updateAdminProduct,
  updateAdminProductVariant,
} from "@/features/admin-catalog/api";
import type {
  AdminCategory,
  AdminManagedProductImage,
  AdminProduct,
  AdminProductQuery,
  AdminProductVariant,
  CreateAdminProductVariantRequest,
  AdminSortOrder,
  AdminProductSort,
} from "@/features/admin-catalog/types";
import { formatPrice } from "@/features/catalog/format";
import {
  CLOTHING_SIZE_ORDER,
  DEFAULT_ACCESSORY_VARIANT_COLOR,
  isNoSize,
  isShoeSize,
  ONE_SIZE,
  SHOE_SIZE_ORDER,
} from "@/features/catalog/sizes";
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

const PRODUCT_LIMIT = 8;
const CATEGORY_OPTION_LIMIT = 100;
const MAX_PRODUCT_IMAGES = 4;
const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_PRODUCT_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MAX_PRODUCT_VARIANTS = 50;
const PRODUCT_VARIANT_LIMIT_MESSAGE = "Maximum 50 variants per product.";

const PRODUCT_ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: "Your admin session is required. Sign in again to continue.",
  CATALOG_UPDATE_EMPTY: "Change at least one catalog field before saving.",
  CATEGORY_INACTIVE: "Products cannot be assigned to an inactive category.",
  CATEGORY_NOT_FOUND: "That category no longer exists.",
  FORBIDDEN: "This account is not allowed to manage admin products.",
  INVALID_CATALOG_FIELD: "One or more catalog fields are invalid.",
  INVALID_PRICE_RANGE: "The price filter range is invalid.",
  NETWORK_ERROR: "The product API could not be reached. Check the backend and retry.",
  PRODUCT_IMAGE_EMPTY: "Choose a non-empty JPEG, PNG, or WebP image.",
  PRODUCT_IMAGE_LIMIT_EXCEEDED: "A product can include at most 4 images.",
  PRODUCT_IMAGE_NOT_FOUND: "That product image no longer exists.",
  PRODUCT_IMAGE_ORDER_STALE: "Product images changed. Refresh and try again.",
  PRODUCT_IMAGE_TOO_LARGE: "Each product image must be 5 MB or smaller.",
  PRODUCT_IMAGE_TYPE_INVALID: "Only genuine JPEG, PNG, and WebP images are allowed.",
  PRODUCT_IMAGE_URL_INPUT_DISABLED:
    "New product images must be selected from your device.",
  SUPABASE_IMAGE_STORAGE_NOT_CONFIGURED:
    "Image storage is not configured. Ask an operator to configure Supabase Storage.",
  PRODUCT_NOT_FOUND: "That product no longer exists.",
  PRODUCT_DELETE_BLOCKED:
    "This product has related orders or carts. Deactivate it instead.",
  PRODUCT_SLUG_EXISTS: "Another product already uses this slug.",
  PRODUCT_VARIANT_NOT_FOUND: "That variant no longer exists.",
  PRODUCT_VARIANT_OPTION_EXISTS:
    "A variant with this size and color already exists for this product.",
  PRODUCT_VARIANT_LIMIT_EXCEEDED: PRODUCT_VARIANT_LIMIT_MESSAGE,
  PRODUCT_VARIANT_SKU_EXISTS: "Another variant already uses this SKU.",
  VALIDATION_ERROR: "Some catalog fields are invalid. Review the form and try again.",
};

interface AdminProductsPageProps {
  initialQuery: AdminProductQuery;
}

interface ProductFormState {
  basePrice: string;
  categoryIds: string[];
  description: string;
  imageItems: ProductImageFormItem[];
  isActive: boolean;
  name: string;
  slug: string;
  stockQuantity: string;
}

interface ProductImageFormItem {
  file?: File;
  filename: string;
  key: string;
  managedImageId?: string;
  source: "legacy" | "local" | "managed";
  url: string;
}

interface VariantFormState {
  color: string;
  isActive: boolean;
  priceOverride: string;
  size: string;
  sku: string;
  stock: string;
}

type SizingType = "CLOTHING" | "SHOES" | "ACCESSORIES";

interface DraftVariant extends CreateAdminProductVariantRequest {
  tempId: string;
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
  const [draftVariants, setDraftVariants] = useState<DraftVariant[]>([]);
  const [sizingType, setSizingType] = useState<SizingType>("CLOTHING");
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
  const imageInputRef = useRef<HTMLInputElement>(null);
  const localPreviewUrlsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const previewUrls = localPreviewUrlsRef.current;

    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.clear();
    };
  }, []);

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

        const validPage = Math.min(
          query.page || 1,
          Math.max(1, response.pagination.totalPages),
        );

        if (validPage !== (query.page || 1)) {
          setQuery((current) => ({ ...current, page: validPage }));
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
    releaseLocalImagePreviews(productForm.imageItems, localPreviewUrlsRef.current);
    setPanelMode("create");
    setSelectedProduct(undefined);
    setProductForm(getEmptyProductForm());
    setVariantForm(getEmptyVariantForm());
    setDraftVariants([]);
    setSizingType("CLOTHING");
    setEditingVariantId(undefined);
    setActionError(undefined);
    setSuccessMessage(undefined);
    setRequestId(undefined);
    setIsModalOpen(true);
  }

  async function openEditPanel(product: AdminProduct) {
    releaseLocalImagePreviews(productForm.imageItems, localPreviewUrlsRef.current);
    setPanelMode("edit");
    setSelectedProduct(product);
    setProductForm(getProductForm(product));
    setVariantForm(getEmptyVariantForm());
    setDraftVariants([]);
    setSizingType(inferSizingType(product.variants));
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
      setSizingType(inferSizingType(loadedProduct.variants));
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

    const productDetailsChanged =
      panelMode === "create" ||
      !selectedProduct ||
      !areProductDetailsEqual(productForm, getProductForm(selectedProduct));

    const accessoryStock =
      panelMode === "create" && sizingType === "ACCESSORIES"
        ? parseRequiredInteger(productForm.stockQuantity)
        : undefined;

    if (
      panelMode === "create" &&
      sizingType === "ACCESSORIES" &&
      accessoryStock === undefined
    ) {
      setActionError(
        "Stock quantity must be a whole number greater than or equal to 0.",
      );
      return;
    }

    if (
      panelMode === "edit" &&
      selectedProduct &&
      productDetailsChanged &&
      productPayload.payload.isActive !== selectedProduct.isActive &&
      !window.confirm(
        `${productPayload.payload.isActive ? "Activate" : "Deactivate"} ${selectedProduct.name}?`,
      )
    ) {
      return;
    }

    setIsSavingProduct(true);
    let latestProduct: AdminProduct | undefined;
    let workingImageItems = [...productForm.imageItems];
    const cleanupWarnings: string[] = [];

    try {
      if (panelMode === "create") {
        const response = await createAdminProduct({
          ...productPayload.payload,
          variants:
            sizingType === "ACCESSORIES"
              ? [
                  {
                    color: DEFAULT_ACCESSORY_VARIANT_COLOR,
                    isActive: true,
                    priceOverride: null,
                    size: ONE_SIZE,
                    sku: null,
                    stock: accessoryStock!,
                  },
                ]
              : draftVariants.map(({ tempId: _tempId, ...variant }) => variant),
        });
        latestProduct = response.product;
      } else if (selectedProduct && productDetailsChanged) {
        const response = await updateAdminProduct(
          selectedProduct.id,
          productPayload.payload,
        );
        latestProduct = {
          ...response.product,
          variants: response.product.variants || selectedProduct.variants,
        };
      } else if (selectedProduct) {
        latestProduct = selectedProduct;
      }

      if (!latestProduct) {
        throw new Error("Product response was unavailable.");
      }

      const previousManagedImages = selectedProduct?.managedImages ?? [];
      const retainedManagedIds = new Set(
        workingImageItems
          .map((item) => item.managedImageId)
          .filter((id): id is string => Boolean(id)),
      );

      for (const image of previousManagedImages) {
        if (retainedManagedIds.has(image.id)) {
          continue;
        }

        const response = await deleteAdminProductImage(latestProduct.id, image.id);
        latestProduct = response.product;
        if (response.warning) {
          cleanupWarnings.push(response.warning);
        }
      }

      for (const item of [...workingImageItems]) {
        if (item.source !== "local" || !item.file) {
          continue;
        }

        const response = await uploadAdminProductImage(latestProduct.id, item.file);
        latestProduct = response.product;
        const uploadedImage = latestProduct.managedImages.find(
          (image) => image.id === response.uploadedImageId,
        );

        if (!uploadedImage) {
          throw new Error("Uploaded image metadata was unavailable.");
        }

        releaseLocalImagePreviews([item], localPreviewUrlsRef.current);
        workingImageItems = workingImageItems.map((candidate) =>
          candidate.key === item.key
            ? toManagedProductImageFormItem(uploadedImage)
            : candidate,
        );
        setProductForm((current) => ({
          ...current,
          imageItems: workingImageItems,
        }));
      }

      const desiredManagedOrder = workingImageItems
        .map((item) => item.managedImageId)
        .filter((id): id is string => Boolean(id));
      const currentManagedOrder = latestProduct.managedImages.map(
        (image) => image.id,
      );

      if (
        desiredManagedOrder.length > 0 &&
        desiredManagedOrder.join("|") !== currentManagedOrder.join("|")
      ) {
        const response = await reorderAdminProductImages(
          latestProduct.id,
          desiredManagedOrder,
        );
        latestProduct = response.product;
      }

      setSelectedProduct(latestProduct);
      setProductForm(getProductForm(latestProduct));
      syncProduct(latestProduct);
      setDraftVariants([]);
      setPanelMode("edit");
      setRefreshKey((current) => current + 1);

      if (cleanupWarnings.length > 0) {
        setSuccessMessage("Product image changes were saved.");
        setActionError(cleanupWarnings.join(" "));
        return;
      }

      setIsModalOpen(false);
    } catch (error) {
      if (latestProduct) {
        setPanelMode("edit");
        setSelectedProduct(latestProduct);
        setDraftVariants([]);
        setProductForm((current) => ({
          ...current,
          imageItems: workingImageItems,
        }));
        syncProduct(latestProduct);
        setRefreshKey((current) => current + 1);
      }

      setActionError(
        getApiErrorMessage(
          error,
          PRODUCT_ERROR_MESSAGES,
          latestProduct
            ? "Product details were saved, but image changes did not finish. Review the images and retry."
            : "Product could not be saved.",
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
        ? await activateAdminProduct(product.id)
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

    setActionError(undefined);
    setSuccessMessage(undefined);

    const variantPayload = getVariantPayload(variantForm, sizingType);

    if (variantPayload.error || !variantPayload.payload) {
      setActionError(variantPayload.error || "Variant fields are invalid.");
      return;
    }

    const currentVariantCount =
      panelMode === "create"
        ? draftVariants.length
        : (selectedProduct?.variants.length ?? 0);
    if (!editingVariantId && currentVariantCount >= MAX_PRODUCT_VARIANTS) {
      setActionError(PRODUCT_VARIANT_LIMIT_MESSAGE);
      return;
    }

    const editingVariant = editingVariantId && selectedProduct
      ? selectedProduct.variants.find((variant) => variant.id === editingVariantId)
      : undefined;

    const duplicateError = getDuplicateVariantError(
      variantPayload.payload,
      panelMode === "create" ? draftVariants : selectedProduct?.variants ?? [],
      editingVariantId,
    );
    if (duplicateError) {
      setActionError(duplicateError);
      return;
    }

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
      if (panelMode === "create") {
        setDraftVariants((current) => [
          ...current,
          { ...variantPayload.payload, tempId: crypto.randomUUID() },
        ]);
        setSuccessMessage("Draft variant added. It will be saved with the product.");
      } else if (editingVariantId) {
        const response = await updateAdminProductVariant(
          editingVariantId,
          variantPayload.payload,
        );

        syncVariant(response.variant);
        setSuccessMessage("Variant updated.");
      } else if (selectedProduct) {
        const response = await createAdminProductVariant(
          selectedProduct.id,
          variantPayload.payload,
        );

        syncVariant(response.variant);
        setSuccessMessage("Variant created.");
      }

      setVariantForm(getEmptyVariantForm(sizingType));
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

  async function handleProductDelete(product: AdminProduct) {
    if (!window.confirm(`Delete ${product.name}? This cannot be undone.`)) return;

    setBusyAction(`${product.id}:delete`);
    setActionError(undefined);
    setSuccessMessage(undefined);
    setRequestId(undefined);
    try {
      const response = await deleteAdminProduct(product.id);
      if (products.length === 1 && (query.page || 1) > 1) {
        setQuery((current) => ({ ...current, page: Math.max(1, (current.page || 1) - 1) }));
      } else {
        setRefreshKey((current) => current + 1);
      }
      setSuccessMessage("Product deleted.");
      if (response.warning) {
        setActionError(response.warning);
      }
    } catch (error) {
      setActionError(
        getApiErrorMessage(error, PRODUCT_ERROR_MESSAGES, "Product could not be deleted."),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setBusyAction(undefined);
    }
  }

  function handleSizingTypeChange(nextType: SizingType) {
    const variants = panelMode === "create" ? draftVariants : selectedProduct?.variants ?? [];
    if (
      variants.length > 0 &&
      !window.confirm(
        "Changing classification may require updating variant sizes. Continue?",
      )
    ) {
      return;
    }

    setSizingType(nextType);
    setVariantForm(getEmptyVariantForm(nextType));
    setEditingVariantId(undefined);
    if (panelMode === "create" && nextType === "ACCESSORIES") {
      setDraftVariants([]);
    }
  }

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    const retainedItems = productForm.imageItems.filter(
      (item) => item.source !== "legacy",
    );

    if (retainedItems.length + files.length > MAX_PRODUCT_IMAGES) {
      setActionError("A product can include at most 4 images.");
      return;
    }

    for (const file of files) {
      if (!ALLOWED_PRODUCT_IMAGE_TYPES.has(file.type)) {
        setActionError("Only JPEG, PNG, and WebP images are allowed.");
        return;
      }

      if (file.size === 0) {
        setActionError("Choose a non-empty image file.");
        return;
      }

      if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
        setActionError("Each product image must be 5 MB or smaller.");
        return;
      }
    }

    const localItems = files.map((file) => {
      const url = URL.createObjectURL(file);
      localPreviewUrlsRef.current.add(url);

      return {
        file,
        filename: file.name,
        key: createImageItemKey(),
        source: "local" as const,
        url,
      };
    });

    setProductForm((current) => ({
      ...current,
      imageItems: [
        ...current.imageItems.filter((item) => item.source !== "legacy"),
        ...localItems,
      ],
    }));
    setActionError(undefined);
  }

  function removeImageItem(item: ProductImageFormItem) {
    releaseLocalImagePreviews([item], localPreviewUrlsRef.current);
    setProductForm((current) => ({
      ...current,
      imageItems: current.imageItems.filter((image) => image.key !== item.key),
    }));
  }

  function moveImageItem(index: number, direction: -1 | 1) {
    setProductForm((current) => {
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= current.imageItems.length) {
        return current;
      }

      const imageItems = [...current.imageItems];
      [imageItems[index], imageItems[targetIndex]] = [
        imageItems[targetIndex],
        imageItems[index],
      ];
      return { ...current, imageItems };
    });
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
    : getEmptyVariantForm(sizingType);
  const allowedSizes = getSizeOptions(sizingType);
  const hasLegacyVariantSize = Boolean(
    editingVariantId &&
      variantForm.size &&
      !allowedSizes.includes(variantForm.size),
  );
  const displayedVariants =
    panelMode === "create"
      ? draftVariants.map((variant) => ({
          ...variant,
          id: variant.tempId,
          isDraft: true as const,
        }))
      : (selectedProduct?.variants ?? []).map((variant) => ({
          ...variant,
          isDraft: false as const,
        }));
  const isVariantLimitReached = displayedVariants.length >= MAX_PRODUCT_VARIANTS;
  const hasPendingImageUploads = productForm.imageItems.some(
    (image) => image.source === "local",
  );
  const hasUnsavedChanges = isModalOpen
    ? !areProductFormsEqual(productForm, productFormBaseline) ||
      !areVariantFormsEqual(variantForm, variantFormBaseline) ||
      draftVariants.length > 0 ||
      sizingType !==
        (panelMode === "edit" && selectedProduct
          ? inferSizingType(selectedProduct.variants)
          : "CLOTHING")
    : false;

  return (
    <div className="admin-resource admin-resource--full-width">
      <section
        className="admin-resource__header"
        aria-labelledby="admin-products-heading"
      >
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">Catalog</p>
          <h1 id="admin-products-heading">Products Management</h1>
          <p>Manage catalog content, pricing, inventory, and visibility.</p>
        </div>
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

      <section className="admin-resource__toolbar admin-resource__toolbar--compact" aria-label="Product filters">
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
          <table className="admin-table admin-table--products">
            <thead>
              <tr>
                <th>Image</th>
                <th>Name</th>
                <th>Slug</th>
                <th>Category</th>
                <th>Base price</th>
                <th>Stock</th>
                <th>Status</th>
                <th>Variants</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isProductLoading ? <AdminTableSkeleton columns={9} rows={6} /> : null}
              {!isProductLoading && !listError && products.length === 0 ? (
                <tr>
                  <td className="admin-table__state" colSpan={9}>
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
                        <AdminProductImage
                          alt={product.name}
                          className="admin-product-thumb"
                          url={product.imageUrls[0]}
                        />
                      </td>
                      <td>
                        <strong>{product.name}</strong>
                      </td>
                      <td>{product.slug}</td>
                      <td>
                        <span className="admin-category-summary">
                          {getProductCategories(product)[0]?.name || "Not set"}
                          {getProductCategories(product).length > 1 ? (
                            <small>+{getProductCategories(product).length - 1}</small>
                          ) : null}
                        </span>
                      </td>
                      <td>{formatPrice(product.basePrice)}</td>
                      <td>
                        <span
                          className={`admin-badge ${
                            getProductStock(product) > 0
                              ? "admin-badge--neutral"
                              : "admin-badge--muted"
                          }`}
                        >
                          {getProductStock(product) > 0
                            ? `${getProductStock(product).toLocaleString("en")} in stock`
                            : "Out of stock"}
                        </span>
                      </td>
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
                          <button
                            className="admin-link-button admin-link-button--delete"
                            disabled={busyAction === `${product.id}:delete`}
                            onClick={() => void handleProductDelete(product)}
                            type="button"
                          >
                            {busyAction === `${product.id}:delete` ? "Deleting" : "Delete"}
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
        compact
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
                ? hasPendingImageUploads
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
          releaseLocalImagePreviews(
            productForm.imageItems,
            localPreviewUrlsRef.current,
          );
          setIsModalOpen(false);
        }}
        title={panelMode === "create" ? "New product" : "Edit product"}
      >
        {actionError ? (
          <AdminFeedback message={actionError} requestId={requestId} tone="error" />
        ) : null}
        {successMessage ? (
          <AdminFeedback message={successMessage} tone="success" />
        ) : null}
          <form className="admin-form admin-compact-form" id="admin-product-form" onSubmit={handleProductSave}>
              <div className="admin-compact-fields">
                <label className="admin-compact-field--wide">
                  <span>Name</span>
                  <input
                    disabled={isPanelLoading}
                    maxLength={160}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="e.g. Silk Slip Dress"
                    required
                    value={productForm.name}
                  />
                </label>
                <label className="admin-compact-field--wide">
                  <span>Slug</span>
                  <input
                    disabled={isPanelLoading}
                    maxLength={180}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, slug: event.target.value }))
                    }
                    placeholder="silk-slip-dress"
                    required
                    value={productForm.slug}
                  />
                </label>
                <label className="admin-compact-field--wide">
                  <span>Description</span>
                  <textarea
                    disabled={isPanelLoading}
                    maxLength={4000}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, description: event.target.value }))
                    }
                    placeholder="Enter product detail..."
                    rows={4}
                    value={productForm.description}
                  />
                </label>
                <label>
                  <span>Base price (&#8363;)</span>
                  <input
                    disabled={isPanelLoading}
                    min="0"
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, basePrice: event.target.value }))
                    }
                    required
                    type="number"
                    value={productForm.basePrice}
                  />
                </label>
                <label>
                  <span>Stock quantity</span>
                  <input
                    aria-label="Stock quantity"
                    disabled={
                      isPanelLoading ||
                      panelMode !== "create" ||
                      sizingType !== "ACCESSORIES"
                    }
                    min="0"
                    onChange={(event) =>
                      setProductForm((current) => ({
                        ...current,
                        stockQuantity: event.target.value,
                      }))
                    }
                    required={panelMode === "create" && sizingType === "ACCESSORIES"}
                    type="number"
                    value={
                      panelMode === "create" && sizingType === "ACCESSORIES"
                        ? productForm.stockQuantity
                        : selectedProduct
                          ? getProductStock(selectedProduct)
                          : 0
                    }
                  />
                  <small>
                    {panelMode === "create" && sizingType === "ACCESSORIES"
                      ? "Enter stock directly for this accessory."
                      : "Managed through variants."}
                  </small>
                </label>
                <label className="admin-compact-field--wide">
                  <span>Selling classification</span>
                  <select
                    disabled={isPanelLoading}
                    onChange={(event) =>
                      handleSizingTypeChange(event.target.value as SizingType)
                    }
                    value={sizingType}
                  >
                    <option value="CLOTHING">Clothing</option>
                    <option value="SHOES">Shoes</option>
                    <option value="ACCESSORIES">Accessories</option>
                  </select>
                  <small>Changing classification may require updating variant sizes.</small>
                </label>
              </div>

            <fieldset className="admin-category-picker">
              <legend>Categories</legend>
              <small>
                Select one or more. The first selected category is the primary category.
              </small>
              <div className="admin-category-picker__options">
                {isCategoryLoading ? (
                  <p className="admin-form-inline-state" role="status">Loading categories...</p>
                ) : null}
                {!isCategoryLoading && categoryError ? (
                  <p className="admin-form-inline-state" role="status">Category options are unavailable.</p>
                ) : null}
                {!isCategoryLoading && !categoryError && categories.length === 0 ? (
                  <p className="admin-form-inline-state" role="status">No categories are available.</p>
                ) : null}
                {categories.map((category) => {
                  const isSelected = productForm.categoryIds.includes(category.id);

                  return (
                    <label key={category.id}>
                      <input
                        checked={isSelected}
                        disabled={
                          isPanelLoading ||
                          isCategoryLoading ||
                          (!category.isActive && !isSelected)
                        }
                        onChange={(event) =>
                          setProductForm((current) => ({
                            ...current,
                            categoryIds: event.target.checked
                              ? [...current.categoryIds, category.id]
                              : current.categoryIds.filter(
                                  (categoryId) => categoryId !== category.id,
                                ),
                          }))
                        }
                        type="checkbox"
                      />
                      <span>
                        {category.name}
                        {category.isActive ? "" : " (inactive)"}
                      </span>
                    </label>
                  );
                })}
              </div>
              {productForm.categoryIds.length > 0 ? (
                <div className="admin-category-chips" aria-label="Selected categories">
                  {productForm.categoryIds.map((categoryId, index) => {
                    const category = categories.find((item) => item.id === categoryId);

                    return (
                      <span className="admin-category-chip" key={categoryId}>
                        {category?.name || "Unknown category"}
                        {index === 0 ? <small>Primary</small> : null}
                        <button
                          aria-label={`Remove ${category?.name || "category"}`}
                          disabled={isPanelLoading}
                          onClick={() =>
                            setProductForm((current) => ({
                              ...current,
                              categoryIds: current.categoryIds.filter(
                                (item) => item !== categoryId,
                              ),
                            }))
                          }
                          type="button"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              ) : null}
            </fieldset>

            <section className="admin-image-url-editor" aria-labelledby="product-images-heading">
              <div className="admin-image-url-editor__header">
                <div>
                  <span id="product-images-heading">Product images</span>
                  <small>JPEG, PNG, or WebP. Up to 4 images, 5 MB each.</small>
                </div>
                <input
                  accept="image/jpeg,image/png,image/webp"
                  className="admin-image-file-input"
                  disabled={isPanelLoading || isSavingProduct}
                  multiple
                  onChange={handleImageSelection}
                  ref={imageInputRef}
                  type="file"
                />
                <button
                  className="button button--secondary"
                  disabled={
                    isPanelLoading ||
                    isSavingProduct ||
                    productForm.imageItems.length >= MAX_PRODUCT_IMAGES
                  }
                  onClick={() => imageInputRef.current?.click()}
                  type="button"
                >
                  <Upload aria-hidden="true" size={15} />
                  Choose files
                </button>
              </div>

              <div className="admin-image-url-list">
                {productForm.imageItems.length === 0 ? (
                  <p className="admin-image-empty">No product images selected.</p>
                ) : null}
                {productForm.imageItems.map((image, index) => (
                  <div className="admin-image-url-row" key={image.key}>
                    <div className="admin-image-preview-wrap">
                      <AdminProductImage
                        alt={`Image ${index + 1} preview`}
                        className="admin-image-url-preview"
                        url={image.url}
                      />
                      {index === 0 ? <span className="admin-image-primary">Primary</span> : null}
                    </div>
                    <div className="admin-image-file-meta">
                      <strong>{image.filename}</strong>
                      <small>
                        {image.source === "local"
                          ? "Ready to upload"
                          : image.source === "managed"
                            ? "Managed in Supabase Storage"
                            : "Legacy URL image"}
                      </small>
                    </div>
                    <div className="admin-image-actions">
                      <button
                        aria-label={`Move image ${index + 1} up`}
                        className="icon-button admin-icon-button"
                        disabled={isPanelLoading || isSavingProduct || index === 0}
                        onClick={() => moveImageItem(index, -1)}
                        title="Move image up"
                        type="button"
                      >
                        <ChevronUp aria-hidden="true" size={15} />
                      </button>
                      <button
                        aria-label={`Move image ${index + 1} down`}
                        className="icon-button admin-icon-button"
                        disabled={
                          isPanelLoading ||
                          isSavingProduct ||
                          index === productForm.imageItems.length - 1
                        }
                        onClick={() => moveImageItem(index, 1)}
                        title="Move image down"
                        type="button"
                      >
                        <ChevronDown aria-hidden="true" size={15} />
                      </button>
                      <button
                        aria-label={`Remove image ${index + 1}`}
                        className="icon-button admin-icon-button"
                        disabled={isPanelLoading || isSavingProduct}
                        onClick={() => removeImageItem(image)}
                        title="Remove image"
                        type="button"
                      >
                        <Trash2 aria-hidden="true" size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>

              <label className="admin-checkbox admin-compact-checkbox">
                <input
                  checked={productForm.isActive}
                  disabled={isPanelLoading}
                  onChange={(event) =>
                    setProductForm((current) => ({ ...current, isActive: event.target.checked }))
                  }
                  type="checkbox"
                />
                <span>Active</span>
              </label>

          </form>

          {panelMode === "create" && sizingType === "ACCESSORIES" ? null : (
            <section className="admin-variants" aria-labelledby="product-variants-heading">
            <div className="admin-variants__header">
              <div>
                <p className="eyebrow">Variants</p>
                <h3 id="product-variants-heading">Product variants</h3>
                <p className="admin-variants__helper">
                  {displayedVariants.length} of {MAX_PRODUCT_VARIANTS} variants.
                  Manage SKU, size, color, stock, and optional price overrides.
                </p>
              </div>
              {editingVariantId ? (
                <button
                  className="admin-link-button"
                  onClick={() => {
                    setEditingVariantId(undefined);
                    setVariantForm(getEmptyVariantForm(sizingType));
                  }}
                  type="button"
                >
                  New variant
                </button>
              ) : null}
            </div>

            {panelMode === "create" || selectedProduct ? (
              <>
                <div className="admin-variant-grid">
                  {displayedVariants.length === 0 ? (
                    <div className="admin-panel__empty admin-variant-grid__empty">
                      {panelMode === "create"
                        ? "Add the first variant before creating this product."
                        : "No variants exist for this product."}
                    </div>
                  ) : (
                    displayedVariants.map((variant, index) => (
                      <article className="admin-variant-card" key={variant.id}>
                        <div className="admin-variant-card__header">
                          <h4>Variant {index + 1}</h4>
                          <span className="admin-variant-card__status">
                            {variant.isDraft
                              ? "Draft"
                              : variant.isActive
                                ? "Active"
                                : "Inactive"}
                          </span>
                        </div>
                        <dl className="admin-variant-card__details">
                          <div className="admin-variant-card__detail--wide">
                            <dt>SKU</dt>
                            <dd>{formatOptional(variant.sku)}</dd>
                          </div>
                          <div>
                            <dt>Color</dt>
                            <dd>{variant.color}</dd>
                          </div>
                          <div>
                            <dt>Size</dt>
                            <dd>{isNoSize(variant.size) ? "No size" : variant.size}</dd>
                          </div>
                          <div>
                            <dt>Stock</dt>
                            <dd>{variant.stock}</dd>
                          </div>
                          <div>
                            <dt>Override</dt>
                            <dd>
                              {variant.priceOverride == null
                                ? "Not set"
                                : formatPrice(variant.priceOverride)}
                            </dd>
                          </div>
                        </dl>
                        <div className="admin-variant-card__actions">
                          {variant.isDraft ? (
                            <button
                              className="admin-link-button admin-link-button--delete"
                              onClick={() =>
                                setDraftVariants((current) =>
                                  current.filter((item) => item.tempId !== variant.id),
                                )
                              }
                              type="button"
                            >
                              Remove
                            </button>
                          ) : (
                            <>
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
                            </>
                          )}
                        </div>
                      </article>
                    ))
                  )}
                </div>
                {isVariantLimitReached && !editingVariantId ? (
                  <p className="admin-form-inline-state" role="status">
                    {PRODUCT_VARIANT_LIMIT_MESSAGE}
                  </p>
                ) : null}

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
                      {sizingType === "ACCESSORIES" ? (
                        <input disabled value="No size required" />
                      ) : (
                        <select
                          aria-describedby={
                            hasLegacyVariantSize
                              ? "admin-variant-size-guidance"
                              : undefined
                          }
                          onChange={(event) =>
                            setVariantForm((current) => ({
                              ...current,
                              size: event.target.value,
                            }))
                          }
                          required
                          value={variantForm.size}
                        >
                          <option value="">Select a size</option>
                          {hasLegacyVariantSize ? (
                            <option disabled value={variantForm.size}>
                              Custom: {variantForm.size}
                            </option>
                          ) : null}
                          {allowedSizes.map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      )}
                      {hasLegacyVariantSize ? (
                        <small id="admin-variant-size-guidance">
                          This existing custom size is preserved until you choose
                          a size allowed by the selected classification.
                        </small>
                      ) : null}
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
                    disabled={
                      isSavingVariant ||
                      isPanelLoading ||
                      (!editingVariantId && isVariantLimitReached)
                    }
                    type="submit"
                  >
                    <Save aria-hidden="true" size={17} />
                    {isSavingVariant
                      ? "Saving"
                      : editingVariantId
                        ? "Save variant"
                        : "Add variant"}
                  </button>
                </form>
              </>
            ) : null}
            </section>
          )}
      </AdminModal>
    </div>
  );
}

function getEmptyProductForm(): ProductFormState {
  return {
    basePrice: "",
    categoryIds: [],
    description: "",
    imageItems: [],
    isActive: true,
    name: "",
    slug: "",
    stockQuantity: "0",
  };
}

function getProductForm(product: AdminProduct): ProductFormState {
  return {
    basePrice: String(product.basePrice),
    categoryIds: getProductCategories(product).map((category) => category.id),
    description: product.description || "",
    imageItems:
      product.managedImages?.length > 0
        ? product.managedImages
            .slice(0, MAX_PRODUCT_IMAGES)
            .map(toManagedProductImageFormItem)
        : product.imageUrls.slice(0, MAX_PRODUCT_IMAGES).map((url, index) => ({
            filename: getLegacyImageLabel(url, index),
            key: `legacy:${index}:${url}`,
            source: "legacy" as const,
            url,
          })),
    isActive: product.isActive,
    name: product.name,
    slug: product.slug,
    stockQuantity: String(getProductStock(product)),
  };
}

function mergeVariant(
  variants: AdminProductVariant[],
  variant: AdminProductVariant,
): AdminProductVariant[] {
  const hasVariant = variants.some((item) => item.id === variant.id);

  return hasVariant
    ? variants.map((item) => (item.id === variant.id ? variant : item))
    : [...variants, variant];
}

function getEmptyVariantForm(sizingType: SizingType = "CLOTHING"): VariantFormState {
  return {
    color: "",
    isActive: true,
    priceOverride: "",
    size: sizingType === "ACCESSORIES" ? ONE_SIZE : "",
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
    left.categoryIds.join("|") === right.categoryIds.join("|") &&
    left.description === right.description &&
    serializeImageItems(left.imageItems) === serializeImageItems(right.imageItems) &&
    left.isActive === right.isActive &&
    left.name === right.name &&
    left.slug === right.slug &&
    left.stockQuantity === right.stockQuantity
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
        categoryIds: string[];
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

  if (!form.name.trim()) {
    return { error: "Product name is required." };
  }

  if (!form.slug.trim()) {
    return { error: "Product slug is required." };
  }

  if (form.categoryIds.length === 0) {
    return { error: "Select at least one product category." };
  }

  if (basePrice === undefined) {
    return { error: "Base price must be a whole number greater than or equal to 0." };
  }

  return {
    payload: {
      basePrice,
      categoryId: form.categoryIds[0],
      categoryIds: form.categoryIds,
      description: normalizeNullableText(form.description),
      imageUrls: form.imageItems
        .filter((image) => image.source === "legacy")
        .map((image) => image.url),
      isActive: form.isActive,
      name: form.name.trim(),
      slug: form.slug.trim(),
    },
  };
}

function getVariantPayload(form: VariantFormState, sizingType: SizingType):
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

  const size = sizingType === "ACCESSORIES" ? ONE_SIZE : form.size.trim();

  if (!size) {
    return { error: "Variant size is required." };
  }

  if (sizingType !== "ACCESSORIES" && !getSizeOptions(sizingType).includes(size)) {
    return {
      error:
        sizingType === "SHOES"
          ? "Shoe size must be between 35 and 46."
          : "Clothing size must be XS, S, M, L, or XL.",
    };
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
      size,
      sku: normalizeNullableText(form.sku),
      stock,
    },
  };
}

function getSizeOptions(sizingType: SizingType): string[] {
  if (sizingType === "SHOES") return [...SHOE_SIZE_ORDER];
  if (sizingType === "ACCESSORIES") return [];
  return [...CLOTHING_SIZE_ORDER];
}

function inferSizingType(
  variants: Array<Pick<AdminProductVariant, "size">>,
): SizingType {
  if (variants.length > 0 && variants.every((variant) => isNoSize(variant.size))) {
    return "ACCESSORIES";
  }
  if (variants.length > 0 && variants.every((variant) => isShoeSize(variant.size))) {
    return "SHOES";
  }
  return "CLOTHING";
}

function getDuplicateVariantError(
  candidate: CreateAdminProductVariantRequest,
  variants: Array<
    CreateAdminProductVariantRequest & { id?: string; tempId?: string }
  >,
  excludeId?: string,
): string | undefined {
  const normalizedColor = candidate.color.trim().toLocaleLowerCase();
  const duplicateCombination = variants.some((variant) => {
    const variantId = variant.id ?? variant.tempId;
    return (
      variantId !== excludeId &&
      variant.color.trim().toLocaleLowerCase() === normalizedColor &&
      variant.size === candidate.size
    );
  });

  if (duplicateCombination) {
    return isNoSize(candidate.size)
      ? "Each accessory color can only be used once."
      : "Each color and size combination can only be used once.";
  }

  const normalizedSku = candidate.sku?.trim().toLocaleUpperCase();
  if (
    normalizedSku &&
    variants.some((variant) => {
      const variantId = variant.id ?? variant.tempId;
      return (
        variantId !== excludeId &&
        variant.sku?.trim().toLocaleUpperCase() === normalizedSku
      );
    })
  ) {
    return "Each variant SKU must be unique.";
  }

  return undefined;
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

function toManagedProductImageFormItem(
  image: AdminManagedProductImage,
): ProductImageFormItem {
  return {
    filename: image.originalFilename || `Managed image ${image.sortOrder + 1}`,
    key: `managed:${image.id}`,
    managedImageId: image.id,
    source: "managed",
    url: image.url,
  };
}

function areProductDetailsEqual(
  left: ProductFormState,
  right: ProductFormState,
): boolean {
  return (
    left.basePrice === right.basePrice &&
    left.categoryIds.join("|") === right.categoryIds.join("|") &&
    left.description === right.description &&
    left.isActive === right.isActive &&
    left.name === right.name &&
    left.slug === right.slug &&
    left.stockQuantity === right.stockQuantity
  );
}

function serializeImageItems(items: ProductImageFormItem[]): string {
  return items
    .map((item) =>
      [item.source, item.managedImageId || "", item.url, item.filename].join(":"),
    )
    .join("|");
}

function getLegacyImageLabel(url: string, index: number): string {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split("/").filter(Boolean).pop();
    return filename ? decodeURIComponent(filename).slice(0, 120) : `Legacy image ${index + 1}`;
  } catch {
    return `Legacy image ${index + 1}`;
  }
}

function createImageItemKey(): string {
  return `local:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

function releaseLocalImagePreviews(
  items: ProductImageFormItem[],
  previewUrls: Set<string>,
) {
  items.forEach((item) => {
    if (item.source === "local" && previewUrls.has(item.url)) {
      URL.revokeObjectURL(item.url);
      previewUrls.delete(item.url);
    }
  });
}

function getProductSortValue(query: AdminProductQuery): string {
  const sort = query.sort || "createdAt";
  const order = query.order || "desc";
  const value = `${sort}_${order}`;

  return PRODUCT_SORT_CHOICES.some((choice) => choice.value === value)
    ? value
    : "createdAt_desc";
}

function getProductStock(product: AdminProduct): number {
  return product.variants.reduce(
    (total, variant) => total + (variant.isActive ? variant.stock : 0),
    0,
  );
}

function getProductCategories(product: AdminProduct) {
  return product.categories?.length > 0
    ? product.categories
    : product.category
      ? [product.category]
      : [];
}

function AdminProductImage({
  alt,
  className,
  url,
}: {
  alt: string;
  className: string;
  url?: string;
}) {
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    setHasFailed(false);
  }, [url]);

  return (
    <div className={className}>
      {url && !hasFailed ? (
        <img alt={alt} onError={() => setHasFailed(true)} src={url} />
      ) : (
        <span>
          <ImageIcon aria-hidden="true" size={17} />
          No image
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
