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
  Tag,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
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
import {
  CLOTHING_SIZE_ORDER,
  DEFAULT_ACCESSORY_VARIANT_COLOR,
  isNoSize,
  isShoeSize,
  ONE_SIZE,
  SHOE_SIZE_ORDER,
} from "@/features/catalog/sizes";
import {
  formatAdminCatalogMoney,
  formatAdminCatalogNumber,
  getAdminCatalogErrorMessage,
  getAdminCatalogTranslations,
  type AdminCatalogTranslations,
} from "@/features/i18n/admin-catalog-translations";
import { useI18n } from "@/features/i18n/useI18n";
import type { Pagination } from "@/lib/api/types";
import { AdminModal } from "@/components/admin/AdminModal";
import {
  formatOptional,
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
const MAX_PRODUCT_AI_TAGS = 30;
const MAX_PRODUCT_AI_TAG_LENGTH = 60;

interface AdminProductsPageProps {
  initialQuery: AdminProductQuery;
}

interface ProductFormState {
  aiTagInput: string;
  aiTags: string[];
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
  labelKey: keyof AdminCatalogTranslations["products"]["sort"];
  order: AdminSortOrder;
  sort: AdminProductSort;
  value: string;
}

const PRODUCT_SORT_CHOICES: ProductSortChoice[] = [
  {
    labelKey: "newest",
    order: "desc",
    sort: "createdAt",
    value: "createdAt_desc",
  },
  {
    labelKey: "recentlyUpdated",
    order: "desc",
    sort: "updatedAt",
    value: "updatedAt_desc",
  },
  {
    labelKey: "nameAscending",
    order: "asc",
    sort: "name",
    value: "name_asc",
  },
  {
    labelKey: "priceAscending",
    order: "asc",
    sort: "basePrice",
    value: "basePrice_asc",
  },
  {
    labelKey: "priceDescending",
    order: "desc",
    sort: "basePrice",
    value: "basePrice_desc",
  },
  {
    labelKey: "activeFirst",
    order: "desc",
    sort: "isActive",
    value: "isActive_desc",
  },
];

export function AdminProductsPage({ initialQuery }: AdminProductsPageProps) {
  const { locale } = useI18n();
  const copy = getAdminCatalogTranslations(locale);
  const copyRef = useRef(copy);
  copyRef.current = copy;
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
          getAdminCatalogErrorMessage(
            error,
            copyRef.current.products.errors,
            copyRef.current.products.feedback.categoryOptionsLoadError,
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
          getAdminCatalogErrorMessage(
            error,
            copyRef.current.products.errors,
            copyRef.current.products.feedback.listLoadError,
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
      setActionError(copy.products.validation.priceFilters);
      return;
    }

    if (
      minPrice.value !== undefined &&
      maxPrice.value !== undefined &&
      minPrice.value > maxPrice.value
    ) {
      setActionError(copy.products.validation.priceRange);
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
        getAdminCatalogErrorMessage(
          error,
          copy.products.errors,
          copy.products.feedback.openError,
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

    const productPayload = getProductPayload(productForm, copy);

    if (productPayload.error || !productPayload.payload) {
      setActionError(productPayload.error || copy.products.feedback.fieldsInvalid);
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
        copy.products.validation.stockQuantity,
      );
      return;
    }

    if (
      panelMode === "edit" &&
      selectedProduct &&
      productDetailsChanged &&
      productPayload.payload.isActive !== selectedProduct.isActive &&
      !window.confirm(
        copy.products.confirm.productStatus(
          productPayload.payload.isActive,
          selectedProduct.name,
        ),
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
        setSuccessMessage(copy.products.feedback.imagesSaved);
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
        getAdminCatalogErrorMessage(
          error,
          copy.products.errors,
          latestProduct
            ? copy.products.feedback.partialImageSaveError
            : copy.products.feedback.saveError,
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setIsSavingProduct(false);
    }
  }

  async function handleProductStatusChange(product: AdminProduct) {
    const nextIsActive = !product.isActive;

    if (!window.confirm(copy.products.confirm.productStatus(nextIsActive, product.name))) {
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
        response.product.isActive
          ? copy.products.feedback.activated
          : copy.products.feedback.deactivated,
      );
    } catch (error) {
      setActionError(
        getAdminCatalogErrorMessage(
          error,
          copy.products.errors,
          copy.products.feedback.statusError,
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
        getAdminCatalogErrorMessage(
          error,
          copy.products.errors,
          copy.products.feedback.variantOpenError,
        ),
      );
      setRequestId(getApiRequestId(error));
    }
  }

  async function handleVariantSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setActionError(undefined);
    setSuccessMessage(undefined);

    const variantPayload = getVariantPayload(variantForm, sizingType, copy);

    if (variantPayload.error || !variantPayload.payload) {
      setActionError(variantPayload.error || copy.products.feedback.variantFieldsInvalid);
      return;
    }

    const currentVariantCount =
      panelMode === "create"
        ? draftVariants.length
        : (selectedProduct?.variants.length ?? 0);
    if (!editingVariantId && currentVariantCount >= MAX_PRODUCT_VARIANTS) {
      setActionError(copy.products.validation.variantLimit(MAX_PRODUCT_VARIANTS));
      return;
    }

    const editingVariant = editingVariantId && selectedProduct
      ? selectedProduct.variants.find((variant) => variant.id === editingVariantId)
      : undefined;

    const duplicateError = getDuplicateVariantError(
      variantPayload.payload,
      panelMode === "create" ? draftVariants : selectedProduct?.variants ?? [],
      editingVariantId,
      copy,
    );
    if (duplicateError) {
      setActionError(duplicateError);
      return;
    }

    if (
      editingVariant &&
      variantPayload.payload.isActive !== editingVariant.isActive &&
      !window.confirm(
        copy.products.confirm.variantStatus(variantPayload.payload.isActive, editingVariant),
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
        setSuccessMessage(copy.products.feedback.draftVariantAdded);
      } else if (editingVariantId) {
        const response = await updateAdminProductVariant(
          editingVariantId,
          variantPayload.payload,
        );

        syncVariant(response.variant);
        setSuccessMessage(copy.products.feedback.variantUpdated);
      } else if (selectedProduct) {
        const response = await createAdminProductVariant(
          selectedProduct.id,
          variantPayload.payload,
        );

        syncVariant(response.variant);
        setSuccessMessage(copy.products.feedback.variantCreated);
      }

      setVariantForm(getEmptyVariantForm(sizingType));
      setEditingVariantId(undefined);
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setActionError(
        getAdminCatalogErrorMessage(
          error,
          copy.products.errors,
          copy.products.feedback.variantSaveError,
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setIsSavingVariant(false);
    }
  }

  async function handleProductDelete(product: AdminProduct) {
    if (!window.confirm(copy.products.confirm.deleteProduct(product.name))) return;

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
      setSuccessMessage(copy.products.feedback.deleted);
      if (response.warning) {
        setActionError(response.warning);
      }
    } catch (error) {
      setActionError(
        getAdminCatalogErrorMessage(
          error,
          copy.products.errors,
          copy.products.feedback.deleteError,
        ),
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
      !window.confirm(copy.products.confirm.classification)
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

  function handleAddAiTags() {
    const parsedTags = parseAiTagInput(productForm.aiTagInput);

    if (parsedTags.length === 0) {
      return;
    }

    const nextTags = mergeAiTags(productForm.aiTags, parsedTags);
    const validationError = getAiTagsValidationError(nextTags, copy);

    if (validationError) {
      setActionError(validationError);
      return;
    }

    setProductForm((current) => ({
      ...current,
      aiTagInput: "",
      aiTags: mergeAiTags(current.aiTags, parsedTags),
    }));
    setActionError(undefined);
  }

  function handleAiTagInputKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" && event.key !== ",") {
      return;
    }

    event.preventDefault();
    handleAddAiTags();
  }

  function handleRemoveAiTag(tagIndex: number) {
    setProductForm((current) => ({
      ...current,
      aiTags: current.aiTags.filter((_, index) => index !== tagIndex),
    }));
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
      setActionError(copy.products.validation.imageLimit);
      return;
    }

    for (const file of files) {
      if (!ALLOWED_PRODUCT_IMAGE_TYPES.has(file.type)) {
        setActionError(copy.products.validation.imageType);
        return;
      }

      if (file.size === 0) {
        setActionError(copy.products.validation.imageEmpty);
        return;
      }

      if (file.size > MAX_PRODUCT_IMAGE_BYTES) {
        setActionError(copy.products.validation.imageSize);
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

    if (!window.confirm(copy.products.confirm.variantStatus(nextIsActive, variant))) {
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
        response.variant.isActive
          ? copy.products.feedback.variantActivated
          : copy.products.feedback.variantDeactivated,
      );
    } catch (error) {
      setActionError(
        getAdminCatalogErrorMessage(
          error,
          copy.products.errors,
          copy.products.feedback.variantStatusError,
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
          <p className="admin-page-intro__eyebrow">{copy.products.header.eyebrow}</p>
          <h1 id="admin-products-heading">{copy.products.header.title}</h1>
          <p>{copy.products.header.subtitle}</p>
        </div>
        <div className="admin-header-actions">
          <button
            className="button button--secondary"
            disabled={isProductLoading}
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={17} />
            {copy.common.refresh}
          </button>
          <button className="button button--primary" onClick={openCreatePanel} type="button">
            <Plus aria-hidden="true" size={17} />
            {copy.products.header.newProduct}
          </button>
        </div>
      </section>

      <section className="admin-resource__toolbar admin-resource__toolbar--compact admin-filter-surface" aria-label={copy.products.filters.aria}>
        <form className="admin-search admin-search--products" onSubmit={handleSearchSubmit}>
          <label htmlFor="admin-product-search">{copy.common.search}</label>
          <div>
            <input
              id="admin-product-search"
              maxLength={120}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={copy.products.filters.searchPlaceholder}
              type="search"
              value={searchInput}
            />
            <input
              aria-label={copy.products.filters.minimumPriceAria}
              inputMode="numeric"
              min="0"
              onChange={(event) => setMinPriceInput(event.target.value)}
              placeholder={copy.products.filters.minimumPricePlaceholder}
              type="number"
              value={minPriceInput}
            />
            <input
              aria-label={copy.products.filters.maximumPriceAria}
              inputMode="numeric"
              min="0"
              onChange={(event) => setMaxPriceInput(event.target.value)}
              placeholder={copy.products.filters.maximumPricePlaceholder}
              type="number"
              value={maxPriceInput}
            />
            <button className="button button--primary" type="submit">
              <Search aria-hidden="true" size={17} />
              {copy.common.search}
            </button>
          </div>
        </form>

        <div className="admin-filter-grid">
          <label>
            <span>{copy.products.filters.category}</span>
            <select
              disabled={isCategoryLoading || Boolean(categoryError)}
              onChange={(event) =>
                handleFilterChange({
                  categoryId: event.target.value || undefined,
                })
              }
              value={query.categoryId || ""}
            >
              <option value="">{copy.products.filters.allCategories}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
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
              <option value="">{copy.common.allStatuses}</option>
              <option value="true">{copy.common.active}</option>
              <option value="false">{copy.common.inactive}</option>
            </select>
          </label>

          <label>
            <span>{copy.products.filters.sort}</span>
            <select onChange={(event) => handleSortChange(event.target.value)} value={selectedSortValue}>
              {PRODUCT_SORT_CHOICES.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {copy.products.sort[choice.labelKey]}
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
            {copy.common.reset}
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
                <th>{copy.common.image}</th>
                <th>{copy.common.name}</th>
                <th>{copy.common.slug}</th>
                <th>{copy.products.table.category}</th>
                <th>{copy.products.table.basePrice}</th>
                <th>{copy.products.table.stock}</th>
                <th>{copy.common.status}</th>
                <th>{copy.products.table.variants}</th>
                <th>{copy.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {isProductLoading ? <AdminTableSkeleton columns={9} rows={6} /> : null}
              {!isProductLoading && !listError && products.length === 0 ? (
                <tr>
                  <td className="admin-table__state" colSpan={9}>
                    {copy.products.table.empty}
                  </td>
                </tr>
              ) : null}
              {!isProductLoading && !listError
                ? products.map((product) => (
                    <tr
                      aria-label={copy.products.table.openAria(product.name)}
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
                          {getProductCategories(product)[0]?.name || copy.common.notSet}
                          {getProductCategories(product).length > 1 ? (
                            <small>
                              +
                              {formatAdminCatalogNumber(
                                getProductCategories(product).length - 1,
                                locale,
                              )}
                            </small>
                          ) : null}
                        </span>
                      </td>
                      <td>{formatAdminCatalogMoney(product.basePrice, locale)}</td>
                      <td>
                        <span
                          className={`admin-badge ${
                            getProductStock(product) > 0
                              ? "admin-badge--neutral"
                              : "admin-badge--muted"
                          }`}
                        >
                          {getProductStock(product) > 0
                            ? copy.products.table.inStock(
                                formatAdminCatalogNumber(getProductStock(product), locale),
                              )
                            : copy.products.table.outOfStock}
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
                          {product.isActive ? copy.common.active : copy.common.inactive}
                        </span>
                      </td>
                      <td>
                        {formatAdminCatalogNumber(product.variants.length, locale)}
                      </td>
                      <td>
                        <div
                          className="admin-row-actions"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <button
                            aria-label={copy.products.table.editAria(product.name)}
                            className="icon-button admin-icon-button"
                            onClick={() => void openEditPanel(product)}
                            title={copy.products.table.editTitle}
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
                            {product.isActive ? copy.common.deactivate : copy.common.activate}
                          </button>
                          <button
                            className="admin-link-button admin-link-button--delete"
                            disabled={busyAction === `${product.id}:delete`}
                            onClick={() => void handleProductDelete(product)}
                            type="button"
                          >
                            {busyAction === `${product.id}:delete`
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
        isLoading={isProductLoading}
        locale={locale}
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
              {copy.common.cancel}
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
          releaseLocalImagePreviews(
            productForm.imageItems,
            localPreviewUrlsRef.current,
          );
          setIsModalOpen(false);
        }}
        title={
          panelMode === "create"
            ? copy.products.form.newTitle
            : copy.products.form.editTitle
        }
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
                  <span>{copy.common.name}</span>
                  <input
                    disabled={isPanelLoading}
                    maxLength={160}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder={copy.products.form.namePlaceholder}
                    required
                    value={productForm.name}
                  />
                </label>
                <label className="admin-compact-field--wide">
                  <span>{copy.common.slug}</span>
                  <input
                    disabled={isPanelLoading}
                    maxLength={180}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, slug: event.target.value }))
                    }
                    placeholder={copy.products.form.slugPlaceholder}
                    required
                    value={productForm.slug}
                  />
                </label>
                <label className="admin-compact-field--wide">
                  <span>{copy.common.description}</span>
                  <textarea
                    disabled={isPanelLoading}
                    maxLength={4000}
                    onChange={(event) =>
                      setProductForm((current) => ({ ...current, description: event.target.value }))
                    }
                    placeholder={copy.products.form.descriptionPlaceholder}
                    rows={4}
                    value={productForm.description}
                  />
                </label>
                <fieldset className="admin-ai-tags admin-compact-field--wide">
                  <legend>{copy.products.form.aiTags}</legend>
                  <small>{copy.products.form.aiTagsHelper}</small>
                  <div className="admin-ai-tags__input-row">
                    <div className="admin-ai-tags__input-wrap">
                      <Tag aria-hidden="true" size={15} />
                      <input
                        disabled={isPanelLoading}
                        maxLength={2000}
                        onChange={(event) =>
                          setProductForm((current) => ({
                            ...current,
                            aiTagInput: event.target.value,
                          }))
                        }
                        onKeyDown={handleAiTagInputKeyDown}
                        placeholder={copy.products.form.aiTagsPlaceholder}
                        value={productForm.aiTagInput}
                      />
                    </div>
                    <button
                      className="button button--secondary"
                      disabled={isPanelLoading || !productForm.aiTagInput.trim()}
                      onClick={handleAddAiTags}
                      type="button"
                    >
                      <Plus aria-hidden="true" size={15} />
                      {copy.common.add}
                    </button>
                  </div>
                  <div className="admin-ai-tags__chips" aria-label={copy.products.form.aiTags}>
                    {productForm.aiTags.length === 0 ? (
                      <p className="admin-ai-tags__empty">{copy.products.form.noAiTags}</p>
                    ) : null}
                    {productForm.aiTags.map((tag, index) => (
                      <span className="admin-ai-tag-chip" key={`${tag}:${index}`}>
                        {tag}
                        <button
                          aria-label={copy.products.form.removeAiTagAria(tag)}
                          disabled={isPanelLoading}
                          onClick={() => handleRemoveAiTag(index)}
                          type="button"
                        >
                          <X aria-hidden="true" size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                </fieldset>
                <label>
                  <span>{copy.products.form.basePrice}</span>
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
                  <span>{copy.products.form.stockQuantity}</span>
                  <input
                    aria-label={copy.products.form.stockQuantity}
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
                      ? copy.products.form.accessoryStockHelper
                      : copy.products.form.variantStockHelper}
                  </small>
                </label>
                <label className="admin-compact-field--wide">
                  <span>{copy.products.form.classification}</span>
                  <select
                    disabled={isPanelLoading}
                    onChange={(event) =>
                      handleSizingTypeChange(event.target.value as SizingType)
                    }
                    value={sizingType}
                  >
                    <option value="CLOTHING">{copy.products.form.clothing}</option>
                    <option value="SHOES">{copy.products.form.shoes}</option>
                    <option value="ACCESSORIES">{copy.products.form.accessories}</option>
                  </select>
                  <small>{copy.products.form.classificationHelper}</small>
                </label>
              </div>

            <fieldset className="admin-category-picker">
              <legend>{copy.products.form.categories}</legend>
              <small>
                {copy.products.form.categoriesHelper}
              </small>
              <div className="admin-category-picker__options">
                {isCategoryLoading ? (
                  <p className="admin-form-inline-state" role="status">
                    {copy.products.form.loadingCategories}
                  </p>
                ) : null}
                {!isCategoryLoading && categoryError ? (
                  <p className="admin-form-inline-state" role="status">
                    {copy.products.form.categoriesUnavailable}
                  </p>
                ) : null}
                {!isCategoryLoading && !categoryError && categories.length === 0 ? (
                  <p className="admin-form-inline-state" role="status">
                    {copy.products.form.noCategories}
                  </p>
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
                        {copy.products.form.categoryOption(
                          category.name,
                          category.isActive,
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
              {productForm.categoryIds.length > 0 ? (
                <div
                  className="admin-category-chips"
                  aria-label={copy.products.form.selectedCategoriesAria}
                >
                  {productForm.categoryIds.map((categoryId, index) => {
                    const category = categories.find((item) => item.id === categoryId);

                    return (
                      <span className="admin-category-chip" key={categoryId}>
                        {category?.name || copy.products.form.unknownCategory}
                        {index === 0 ? <small>{copy.products.form.primary}</small> : null}
                        <button
                          aria-label={copy.products.form.removeCategoryAria(
                            category?.name || copy.products.form.unknownCategory,
                          )}
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
                  <span id="product-images-heading">{copy.products.form.images}</span>
                  <small>{copy.products.form.imagesHelper}</small>
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
                  {copy.products.form.chooseFiles}
                </button>
              </div>

              <div className="admin-image-url-list">
                {productForm.imageItems.length === 0 ? (
                  <p className="admin-image-empty">{copy.products.form.noImages}</p>
                ) : null}
                {productForm.imageItems.map((image, index) => (
                  <div className="admin-image-url-row" key={image.key}>
                    <div className="admin-image-preview-wrap">
                      <AdminProductImage
                        alt={copy.products.form.imagePreviewAlt(
                          formatAdminCatalogNumber(index + 1, locale),
                        )}
                        className="admin-image-url-preview"
                        url={image.url}
                      />
                      {index === 0 ? (
                        <span className="admin-image-primary">{copy.products.form.primary}</span>
                      ) : null}
                    </div>
                    <div className="admin-image-file-meta">
                      <strong>
                        {image.filename ||
                          (image.source === "managed"
                            ? copy.products.form.managedImageFallback(
                                formatAdminCatalogNumber(index + 1, locale),
                              )
                            : copy.products.form.legacyImageFallback(
                                formatAdminCatalogNumber(index + 1, locale),
                              ))}
                      </strong>
                      <small>
                        {image.source === "local"
                          ? copy.products.form.readyToUpload
                          : image.source === "managed"
                            ? copy.products.form.managedImage
                            : copy.products.form.legacyImage}
                      </small>
                    </div>
                    <div className="admin-image-actions">
                      <button
                        aria-label={copy.products.form.moveImageUpAria(
                          formatAdminCatalogNumber(index + 1, locale),
                        )}
                        className="icon-button admin-icon-button"
                        disabled={isPanelLoading || isSavingProduct || index === 0}
                        onClick={() => moveImageItem(index, -1)}
                        title={copy.products.form.moveImageUpTitle}
                        type="button"
                      >
                        <ChevronUp aria-hidden="true" size={15} />
                      </button>
                      <button
                        aria-label={copy.products.form.moveImageDownAria(
                          formatAdminCatalogNumber(index + 1, locale),
                        )}
                        className="icon-button admin-icon-button"
                        disabled={
                          isPanelLoading ||
                          isSavingProduct ||
                          index === productForm.imageItems.length - 1
                        }
                        onClick={() => moveImageItem(index, 1)}
                        title={copy.products.form.moveImageDownTitle}
                        type="button"
                      >
                        <ChevronDown aria-hidden="true" size={15} />
                      </button>
                      <button
                        aria-label={copy.products.form.removeImageAria(
                          formatAdminCatalogNumber(index + 1, locale),
                        )}
                        className="icon-button admin-icon-button"
                        disabled={isPanelLoading || isSavingProduct}
                        onClick={() => removeImageItem(image)}
                        title={copy.products.form.removeImageTitle}
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
                <span>{copy.common.active}</span>
              </label>

          </form>

          {panelMode === "create" && sizingType === "ACCESSORIES" ? null : (
            <section className="admin-variants" aria-labelledby="product-variants-heading">
            <div className="admin-variants__header">
              <div>
                <p className="eyebrow">{copy.products.variants.eyebrow}</p>
                <h3 id="product-variants-heading">{copy.products.variants.title}</h3>
                <p className="admin-variants__helper">
                  {copy.products.variants.summary(
                    formatAdminCatalogNumber(displayedVariants.length, locale),
                    formatAdminCatalogNumber(MAX_PRODUCT_VARIANTS, locale),
                  )}
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
                  {copy.products.variants.newVariant}
                </button>
              ) : null}
            </div>

            {panelMode === "create" || selectedProduct ? (
              <>
                <div className="admin-variant-grid">
                  {displayedVariants.length === 0 ? (
                    <div className="admin-panel__empty admin-variant-grid__empty">
                      {panelMode === "create"
                        ? copy.products.variants.createEmpty
                        : copy.products.variants.editEmpty}
                    </div>
                  ) : (
                    displayedVariants.map((variant, index) => (
                      <article className="admin-variant-card" key={variant.id}>
                        <div className="admin-variant-card__header">
                          <h4>
                            {copy.products.variants.cardTitle(
                              formatAdminCatalogNumber(index + 1, locale),
                            )}
                          </h4>
                          <span className="admin-variant-card__status">
                            {variant.isDraft
                              ? copy.products.variants.draft
                              : variant.isActive
                                ? copy.common.active
                                : copy.common.inactive}
                          </span>
                        </div>
                        <dl className="admin-variant-card__details">
                          <div className="admin-variant-card__detail--wide">
                            <dt>{copy.products.variants.sku}</dt>
                            <dd>{formatOptional(variant.sku, locale)}</dd>
                          </div>
                          <div>
                            <dt>{copy.products.variants.color}</dt>
                            <dd>{variant.color}</dd>
                          </div>
                          <div>
                            <dt>{copy.products.variants.size}</dt>
                            <dd>
                              {isNoSize(variant.size)
                                ? copy.products.variants.noSize
                                : variant.size}
                            </dd>
                          </div>
                          <div>
                            <dt>{copy.products.variants.stock}</dt>
                            <dd>{formatAdminCatalogNumber(variant.stock, locale)}</dd>
                          </div>
                          <div>
                            <dt>{copy.products.variants.override}</dt>
                            <dd>
                              {variant.priceOverride == null
                                ? copy.common.notSet
                                : formatAdminCatalogMoney(variant.priceOverride, locale)}
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
                              {copy.common.remove}
                            </button>
                          ) : (
                            <>
                              <button
                                aria-label={copy.products.variants.editAria(variant)}
                                className="icon-button admin-icon-button"
                                onClick={() => void handleEditVariant(variant)}
                                title={copy.products.variants.editTitle}
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
                                {variant.isActive
                                  ? copy.common.deactivate
                                  : copy.common.activate}
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
                    {copy.products.validation.variantLimit(MAX_PRODUCT_VARIANTS)}
                  </p>
                ) : null}

                <form className="admin-form admin-form--variant" onSubmit={handleVariantSave}>
                  <div className="admin-form__split">
                    <label>
                      <span>{copy.products.variants.sku}</span>
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
                      <span>{copy.products.variants.size}</span>
                      {sizingType === "ACCESSORIES" ? (
                        <input disabled value={copy.products.variants.noSizeRequired} />
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
                          <option value="">{copy.products.variants.selectSize}</option>
                          {hasLegacyVariantSize ? (
                            <option disabled value={variantForm.size}>
                              {copy.products.variants.customSize(variantForm.size)}
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
                          {copy.products.variants.customSizeHelper}
                        </small>
                      ) : null}
                    </label>
                  </div>

                  <div className="admin-form__split">
                    <label>
                      <span>{copy.products.variants.color}</span>
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
                      <span>{copy.products.variants.stock}</span>
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
                    <span>{copy.products.variants.priceOverride}</span>
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
                    <span>{copy.common.active}</span>
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
                      ? copy.common.saving
                      : editingVariantId
                        ? copy.products.variants.saveVariant
                        : copy.products.variants.addVariant}
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
    aiTagInput: "",
    aiTags: [],
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
    aiTagInput: "",
    aiTags: mergeAiTags(product.aiTags ?? [], []),
    basePrice: String(product.basePrice),
    categoryIds: getProductCategories(product).map((category) => category.id),
    description: product.description || "",
    imageItems:
      product.managedImages?.length > 0
        ? product.managedImages
            .slice(0, MAX_PRODUCT_IMAGES)
            .map(toManagedProductImageFormItem)
        : product.imageUrls.slice(0, MAX_PRODUCT_IMAGES).map((url, index) => ({
            filename: getLegacyImageLabel(url),
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
    serializeAiTags(left) === serializeAiTags(right) &&
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

function getProductPayload(
  form: ProductFormState,
  copy: AdminCatalogTranslations,
):
  | {
      payload: {
        basePrice: number;
        categoryId: string;
        categoryIds: string[];
        description: string | null;
        imageUrls: string[];
        aiTags: string[];
        isActive: boolean;
        name: string;
        slug: string;
      };
      error?: undefined;
    }
  | { error: string; payload?: undefined } {
  const basePrice = parseRequiredInteger(form.basePrice);

  if (!form.name.trim()) {
    return { error: copy.products.validation.productNameRequired };
  }

  if (!form.slug.trim()) {
    return { error: copy.products.validation.productSlugRequired };
  }

  if (form.categoryIds.length === 0) {
    return { error: copy.products.validation.categoryRequired };
  }

  if (basePrice === undefined) {
    return { error: copy.products.validation.basePrice };
  }

  const aiTags = getProductFormAiTags(form);
  const aiTagsError = getAiTagsValidationError(aiTags, copy);

  if (aiTagsError) {
    return { error: aiTagsError };
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
      aiTags,
      isActive: form.isActive,
      name: form.name.trim(),
      slug: form.slug.trim(),
    },
  };
}

function getVariantPayload(
  form: VariantFormState,
  sizingType: SizingType,
  copy: AdminCatalogTranslations,
):
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
    return { error: copy.products.validation.variantSizeRequired };
  }

  if (sizingType !== "ACCESSORIES" && !getSizeOptions(sizingType).includes(size)) {
    return {
      error:
        sizingType === "SHOES"
          ? copy.products.validation.shoeSize
          : copy.products.validation.clothingSize,
    };
  }

  if (!form.color.trim()) {
    return { error: copy.products.validation.variantColorRequired };
  }

  if (stock === undefined) {
    return { error: copy.products.validation.variantStock };
  }

  if (priceOverride === undefined) {
    return {
      error: copy.products.validation.variantPrice,
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
  excludeId: string | undefined,
  copy: AdminCatalogTranslations,
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
      ? copy.products.validation.duplicateAccessoryColor
      : copy.products.validation.duplicateOption;
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
    return copy.products.validation.duplicateSku;
  }

  return undefined;
}

function parseAiTagInput(value: string): string[] {
  return value
    .split(/[,\n]+/)
    .map(normalizeAiTag)
    .filter(Boolean);
}

function normalizeAiTag(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function mergeAiTags(currentTags: string[], nextTags: string[]): string[] {
  const tags: string[] = [];
  const seenTags = new Set<string>();

  [...currentTags, ...nextTags].forEach((tag) => {
    const normalized = normalizeAiTag(tag);

    if (!normalized) {
      return;
    }

    const key = normalized.toLocaleLowerCase();
    if (!seenTags.has(key)) {
      seenTags.add(key);
      tags.push(normalized);
    }
  });

  return tags;
}

function getProductFormAiTags(form: ProductFormState): string[] {
  return mergeAiTags(form.aiTags, parseAiTagInput(form.aiTagInput));
}

function serializeAiTags(form: ProductFormState): string {
  return getProductFormAiTags(form)
    .map((tag) => tag.toLocaleLowerCase())
    .join("|");
}

function getAiTagsValidationError(
  tags: string[],
  copy: AdminCatalogTranslations,
): string | undefined {
  if (tags.length > MAX_PRODUCT_AI_TAGS) {
    return copy.products.validation.aiTagLimit(MAX_PRODUCT_AI_TAGS);
  }

  if (tags.some((tag) => tag.length > MAX_PRODUCT_AI_TAG_LENGTH)) {
    return copy.products.validation.aiTagLength(MAX_PRODUCT_AI_TAG_LENGTH);
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
    filename: image.originalFilename || "",
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
    serializeAiTags(left) === serializeAiTags(right) &&
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

function getLegacyImageLabel(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const filename = pathname.split("/").filter(Boolean).pop();
    return filename ? decodeURIComponent(filename).slice(0, 120) : "";
  } catch {
    return "";
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
  const { locale } = useI18n();
  const copy = getAdminCatalogTranslations(locale);
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
          {copy.common.noImage}
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
      aria-label={copy.common.paginationAria(copy.products.noun)}
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
          noun: copy.products.noun,
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
