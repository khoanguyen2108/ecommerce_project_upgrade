"use client";

import {
  ArrowDown,
  ArrowUp,
  Edit3,
  Eye,
  EyeOff,
  ImageIcon,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { AdminFeedback } from "@/components/admin/AdminCommerceUi";
import { AdminModal } from "@/components/admin/AdminModal";
import {
  formatAdminDate,
  getApiErrorMessage,
  getApiRequestId,
  normalizeNullableText,
} from "@/components/admin/admin-format";
import {
  createAdminLandingGalleryImage,
  deleteAdminLandingGalleryImage,
  deleteAdminLandingGalleryImageFile,
  getAdminLandingGallery,
  reorderAdminLandingGalleryImages,
  updateAdminLandingGalleryImage,
  uploadAdminLandingGalleryImage,
} from "@/features/landing/api";
import type {
  AdminLandingGalleryImage,
  CreateAdminLandingGalleryImageRequest,
} from "@/features/landing/types";

const LANDING_GALLERY_ERRORS: Record<string, string> = {
  AUTH_REQUIRED: "Your admin session is required. Sign in again to continue.",
  BAD_REQUEST: "Some gallery fields are invalid. Review the form and try again.",
  FORBIDDEN: "This account is not allowed to manage the landing gallery.",
  LANDING_GALLERY_FIELD_INVALID: "Some gallery fields are invalid.",
  LANDING_GALLERY_IMAGE_LIMIT_EXCEEDED:
    "The landing gallery already has 10 images. Delete one before adding another.",
  LANDING_GALLERY_IMAGE_NOT_FOUND: "That gallery image no longer exists.",
  LANDING_GALLERY_IMAGE_URL_INVALID:
    "Enter a valid public HTTP or HTTPS image URL.",
  LANDING_GALLERY_IMAGE_URL_INPUT_DISABLED:
    "Choose a JPEG, PNG, or WebP file instead of entering an image URL.",
  LANDING_GALLERY_REORDER_DUPLICATE:
    "Each gallery image can appear only once in a reorder request.",
  LANDING_GALLERY_REORDER_EMPTY:
    "Choose at least one image before saving a new order.",
  LANDING_GALLERY_UPDATE_EMPTY: "Change at least one image field before saving.",
  NETWORK_ERROR: "The gallery API could not be reached. Check the backend and retry.",
  PRODUCT_IMAGE_EMPTY: "Choose a non-empty JPEG, PNG, or WebP image.",
  PRODUCT_IMAGE_TOO_LARGE: "Gallery images must be 5 MB or smaller.",
  PRODUCT_IMAGE_TYPE_INVALID: "Only genuine JPEG, PNG, and WebP images are allowed.",
  VALIDATION_ERROR: "Some gallery fields are invalid. Review the form and try again.",
};

interface GalleryFormState {
  altText: string;
  caption: string;
  imageFile?: File;
  imageFilename: string;
  imageSource: "legacy" | "local" | "managed" | "none";
  imageUrl: string;
  isActive: boolean;
  sortOrder: string;
  title: string;
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type GalleryModalMode = "create" | "edit";
type MoveDirection = "up" | "down";

export function AdminLandingGalleryPage() {
  const [images, setImages] = useState<AdminLandingGalleryImage[]>([]);
  const [count, setCount] = useState(0);
  const [maxImages, setMaxImages] = useState(10);
  const [modalMode, setModalMode] = useState<GalleryModalMode>("create");
  const [selectedImage, setSelectedImage] = useState<AdminLandingGalleryImage>();
  const [form, setForm] = useState<GalleryFormState>(emptyGalleryForm());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [busyAction, setBusyAction] = useState<string>();
  const [listError, setListError] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [successMessage, setSuccessMessage] = useState<string>();
  const [requestId, setRequestId] = useState<string>();
  const [refreshKey, setRefreshKey] = useState(0);
  const savingRef = useRef(false);
  const localPreviewUrlRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    return () => releaseGalleryPreview(localPreviewUrlRef);
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadGallery() {
      setIsLoading(true);
      setListError(undefined);

      try {
        const response = await getAdminLandingGallery();

        if (!isMounted) {
          return;
        }

        setImages(response.images);
        setCount(response.count);
        setMaxImages(response.maxImages);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setImages([]);
        setCount(0);
        setListError(
          getApiErrorMessage(
            error,
            LANDING_GALLERY_ERRORS,
            "Landing gallery images could not be loaded right now.",
          ),
        );
        setRequestId(getApiRequestId(error));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadGallery();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  function resetActionFeedback() {
    setActionError(undefined);
    setSuccessMessage(undefined);
    setRequestId(undefined);
  }

  function openCreateModal() {
    if (count >= maxImages) {
      setActionError(LANDING_GALLERY_ERRORS.LANDING_GALLERY_IMAGE_LIMIT_EXCEEDED);
      return;
    }

    releaseGalleryPreview(localPreviewUrlRef);
    setModalMode("create");
    setSelectedImage(undefined);
    setForm(emptyGalleryForm());
    resetActionFeedback();
    setIsModalOpen(true);
  }

  function openEditModal(image: AdminLandingGalleryImage) {
    releaseGalleryPreview(localPreviewUrlRef);
    setModalMode("edit");
    setSelectedImage(image);
    setForm(galleryForm(image));
    resetActionFeedback();
    setIsModalOpen(true);
  }

  function handleGalleryImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setActionError("Only JPEG, PNG, and WebP images are allowed.");
      return;
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      setActionError("Gallery images must be non-empty and 5 MB or smaller.");
      return;
    }

    releaseGalleryPreview(localPreviewUrlRef);
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

  function removeGalleryImage() {
    releaseGalleryPreview(localPreviewUrlRef);
    setForm((current) => ({
      ...current,
      imageFile: undefined,
      imageFilename: "",
      imageSource: "none",
      imageUrl: "",
    }));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (savingRef.current) {
      return;
    }

    resetActionFeedback();

    const validationError = validateGalleryForm(form, modalMode);

    if (validationError) {
      setActionError(validationError);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    let latestImage: AdminLandingGalleryImage | undefined;
    const metadataChanged =
      modalMode === "create" ||
      !selectedImage ||
      !areGalleryDetailsEqual(form, galleryForm(selectedImage));

    try {
      const payload = galleryPayload(form);

      if (modalMode === "create") {
        const response = await createAdminLandingGalleryImage({
          ...payload,
          imageUrl: null,
        });
        latestImage = response.image;
      } else if (selectedImage && metadataChanged) {
        const response = await updateAdminLandingGalleryImage(
          selectedImage.id,
          payload,
        );
        latestImage = response.image;
      } else if (selectedImage) {
        latestImage = selectedImage;
      }

      if (!latestImage) throw new Error("Gallery image response was unavailable.");

      let warning: string | undefined;
      if (form.imageFile) {
        const response = await uploadAdminLandingGalleryImage(
          latestImage.id,
          form.imageFile,
        );
        latestImage = response.image;
        warning = response.warning;
        releaseGalleryPreview(localPreviewUrlRef);
      } else if (
        modalMode === "edit" &&
        selectedImage?.imageUrl &&
        form.imageSource === "none"
      ) {
        const response = await deleteAdminLandingGalleryImageFile(latestImage.id);
        latestImage = response.image;
        warning = response.warning;
      }

      setSelectedImage(latestImage);
      setForm(galleryForm(latestImage));
      setModalMode("edit");

      setRefreshKey((current) => current + 1);
      if (warning) {
        setSuccessMessage("Landing gallery image changes were saved.");
        setActionError(warning);
      } else {
        setIsModalOpen(false);
      }
    } catch (error) {
      if (latestImage) {
        setModalMode("edit");
        setSelectedImage(latestImage);
      }
      setActionError(
        getApiErrorMessage(
          error,
          LANDING_GALLERY_ERRORS,
          "Landing gallery image could not be saved.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  }

  async function handleStatusChange(image: AdminLandingGalleryImage) {
    if (busyAction) {
      return;
    }

    const nextIsActive = !image.isActive;

    if (
      !window.confirm(
        `${nextIsActive ? "Activate" : "Deactivate"} this gallery image?`,
      )
    ) {
      return;
    }

    setBusyAction(`${image.id}:status`);
    resetActionFeedback();

    try {
      await updateAdminLandingGalleryImage(image.id, {
        isActive: nextIsActive,
      });
      setSuccessMessage(
        nextIsActive
          ? "Landing gallery image activated."
          : "Landing gallery image deactivated.",
      );
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          LANDING_GALLERY_ERRORS,
          "Landing gallery image status could not be changed.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function handleDelete(image: AdminLandingGalleryImage) {
    if (busyAction) {
      return;
    }

    if (!window.confirm("Delete this landing gallery image? This cannot be undone.")) {
      return;
    }

    setBusyAction(`${image.id}:delete`);
    resetActionFeedback();

    try {
      const response = await deleteAdminLandingGalleryImage(image.id);
      setSuccessMessage("Landing gallery image deleted.");
      if (response.warning) {
        setActionError(response.warning);
      }
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          LANDING_GALLERY_ERRORS,
          "Landing gallery image could not be deleted.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setBusyAction(undefined);
    }
  }

  async function handleMove(
    image: AdminLandingGalleryImage,
    direction: MoveDirection,
  ) {
    if (busyAction) {
      return;
    }

    const orderedImages = getOrderedImages(images);
    const currentIndex = orderedImages.findIndex((entry) => entry.id === image.id);
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;

    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedImages.length) {
      return;
    }

    const reorderedImages = [...orderedImages];
    const [movedImage] = reorderedImages.splice(currentIndex, 1);
    reorderedImages.splice(nextIndex, 0, movedImage);

    setBusyAction(`${image.id}:move:${direction}`);
    resetActionFeedback();

    try {
      const response = await reorderAdminLandingGalleryImages({
        images: reorderedImages.map((entry, index) => ({
          id: entry.id,
          sortOrder: index,
        })),
      });

      setImages(response.images);
      setCount(response.count);
      setMaxImages(response.maxImages);
      setSuccessMessage("Landing gallery order updated.");
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          LANDING_GALLERY_ERRORS,
          "Landing gallery order could not be updated.",
        ),
      );
      setRequestId(getApiRequestId(error));
    } finally {
      setBusyAction(undefined);
    }
  }

  const orderedImages = getOrderedImages(images);
  const canAddImage = count < maxImages;
  const baselineForm =
    modalMode === "edit" && selectedImage
      ? galleryForm(selectedImage)
      : emptyGalleryForm();
  const hasUnsavedChanges =
    isModalOpen && JSON.stringify(form) !== JSON.stringify(baselineForm);

  return (
    <div className="admin-resource admin-resource--landing-gallery admin-resource--full-width">
      <section
        className="admin-resource__header"
        aria-labelledby="admin-landing-gallery-heading"
      >
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">Storefront moodboard</p>
          <h1 id="admin-landing-gallery-heading">Landing Gallery</h1>
          <p>Manage the inspiration images shown on the storefront.</p>
        </div>
        <div className="admin-header-actions">
          <span className="admin-gallery-count">{count}/{maxImages} images</span>
          <button
            className="button button--secondary"
            disabled={isLoading}
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={17} />
            Refresh
          </button>
          <button
            className="button button--primary"
            disabled={!canAddImage}
            onClick={openCreateModal}
            type="button"
          >
            <Plus aria-hidden="true" size={17} />
            New image
          </button>
        </div>
      </section>

      {successMessage ? <AdminFeedback message={successMessage} tone="success" /> : null}
      {!isModalOpen && actionError ? (
        <AdminFeedback message={actionError} requestId={requestId} tone="error" />
      ) : null}
      {listError ? (
        <AdminFeedback message={listError} requestId={requestId} tone="error" />
      ) : null}

      <section className="admin-landing-gallery-board" aria-label="Landing gallery images">
        {isLoading ? <AdminGallerySkeleton /> : null}
        {!isLoading && !listError && orderedImages.length === 0 ? (
          <div className="admin-landing-gallery-empty">
            <ImageIcon aria-hidden="true" size={28} strokeWidth={1.7} />
            <h2>No inspiration images yet</h2>
            <p>Add up to 10 standalone lookbook images for the homepage.</p>
            <button className="button button--primary" onClick={openCreateModal} type="button">
              <Plus aria-hidden="true" size={17} />
              New image
            </button>
          </div>
        ) : null}
        {!isLoading && !listError
          ? orderedImages.map((image, index) => (
              <article className="admin-landing-gallery-card" key={image.id}>
                <GalleryPreview
                  altText={image.altText}
                  imageUrl={image.imageUrl}
                  title={image.title}
                />
                <div className="admin-landing-gallery-card__body">
                  <div className="admin-landing-gallery-card__heading">
                    <div>
                      <h2>{image.title || "Untitled look"}</h2>
                      <span>Order {image.sortOrder}</span>
                    </div>
                    <span
                      className={`admin-badge ${
                        image.isActive ? "admin-badge--neutral" : "admin-badge--muted"
                      }`}
                    >
                      {image.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p>{image.caption || "No caption set."}</p>
                  <dl>
                    <div>
                      <dt>Alt text</dt>
                      <dd>{image.altText || "Not set"}</dd>
                    </div>
                    <div>
                      <dt>Updated</dt>
                      <dd>{formatAdminDate(image.updatedAt)}</dd>
                    </div>
                  </dl>
                  <code title={image.imageUrl || undefined}>
                    {image.imageUrl || "No image uploaded"}
                  </code>
                </div>
                <footer className="admin-landing-gallery-card__actions">
                  <button
                    aria-label="Move image up"
                    className="icon-button admin-icon-button"
                    disabled={Boolean(busyAction) || index === 0}
                    onClick={() => void handleMove(image, "up")}
                    title="Move up"
                    type="button"
                  >
                    <ArrowUp aria-hidden="true" size={17} />
                  </button>
                  <button
                    aria-label="Move image down"
                    className="icon-button admin-icon-button"
                    disabled={Boolean(busyAction) || index === orderedImages.length - 1}
                    onClick={() => void handleMove(image, "down")}
                    title="Move down"
                    type="button"
                  >
                    <ArrowDown aria-hidden="true" size={17} />
                  </button>
                  <button
                    aria-label="Edit gallery image"
                    className="icon-button admin-icon-button"
                    disabled={Boolean(busyAction)}
                    onClick={() => openEditModal(image)}
                    title="Edit image"
                    type="button"
                  >
                    <Edit3 aria-hidden="true" size={17} />
                  </button>
                  <button
                    className="admin-link-button"
                    disabled={Boolean(busyAction)}
                    onClick={() => void handleStatusChange(image)}
                    type="button"
                  >
                    {image.isActive ? (
                      <>
                        <EyeOff aria-hidden="true" size={15} />
                        Deactivate
                      </>
                    ) : (
                      <>
                        <Eye aria-hidden="true" size={15} />
                        Activate
                      </>
                    )}
                  </button>
                  <button
                    className="admin-link-button admin-link-button--delete"
                    disabled={Boolean(busyAction)}
                    onClick={() => void handleDelete(image)}
                    type="button"
                  >
                    <Trash2 aria-hidden="true" size={15} />
                    Delete
                  </button>
                </footer>
              </article>
            ))
          : null}
      </section>

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
              Cancel
            </button>
            <button
              className="button button--primary"
              disabled={isSaving}
              form="admin-landing-gallery-form"
              type="submit"
            >
              <Save aria-hidden="true" size={17} />
              {isSaving
                ? form.imageFile
                  ? "Uploading"
                  : "Saving"
                : modalMode === "create"
                  ? "Create"
                  : "Save"}
            </button>
          </>
        )}
        hasUnsavedChanges={hasUnsavedChanges}
        isOpen={isModalOpen}
        onClose={() => {
          releaseGalleryPreview(localPreviewUrlRef);
          setIsModalOpen(false);
        }}
        title={modalMode === "create" ? "New gallery image" : "Edit gallery image"}
      >
        {actionError ? (
          <AdminFeedback message={actionError} requestId={requestId} tone="error" />
        ) : null}
        <GalleryForm
          form={form}
          isDisabled={isSaving}
          onChange={setForm}
          onFileChange={handleGalleryImageSelection}
          onRemoveImage={removeGalleryImage}
          onSubmit={handleSave}
        />
      </AdminModal>
    </div>
  );
}

function GalleryForm({
  form,
  isDisabled,
  onChange,
  onFileChange,
  onRemoveImage,
  onSubmit,
}: {
  form: GalleryFormState;
  isDisabled: boolean;
  onChange: (form: GalleryFormState) => void;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const update = <K extends keyof GalleryFormState>(
    key: K,
    value: GalleryFormState[K],
  ) => onChange({ ...form, [key]: value });

  return (
    <form
      className="admin-form admin-compact-form admin-landing-gallery-form"
      id="admin-landing-gallery-form"
      onSubmit={onSubmit}
    >
      <section
        className="admin-form-section admin-compact-basic"
        aria-labelledby="landing-gallery-image-heading"
      >
        <div className="admin-form-section__heading">
          <p className="eyebrow">Image source</p>
          <h3 id="landing-gallery-image-heading">Lookbook image</h3>
          <p>Upload one JPEG, PNG, or WebP image, up to 5 MB.</p>
        </div>
        <div className="admin-landing-gallery-form__media">
          <GalleryPreview
            altText={form.altText}
            imageUrl={form.imageUrl}
            title={form.title}
          />
          <div className="admin-gallery-image-controls">
            <input
              accept="image/jpeg,image/png,image/webp"
              className="admin-image-file-input"
              disabled={isDisabled}
              onChange={onFileChange}
              ref={imageInputRef}
              type="file"
            />
            <button
              className="button button--secondary"
              disabled={isDisabled}
              onClick={() => imageInputRef.current?.click()}
              type="button"
            >
              <Upload aria-hidden="true" size={17} />
              Choose file
            </button>
            <div className="admin-gallery-image-meta">
              <strong>{form.imageFilename || "No gallery image"}</strong>
              <small>{getGalleryImageStatus(form)}</small>
            </div>
            {form.imageSource !== "none" ? (
              <button
                className="admin-link-button admin-link-button--delete"
                disabled={isDisabled}
                onClick={onRemoveImage}
                type="button"
              >
                <Trash2 aria-hidden="true" size={15} />
                Remove image
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="admin-compact-group" aria-labelledby="landing-gallery-copy-heading">
        <h3 id="landing-gallery-copy-heading">Copy and status</h3>
        <div className="admin-compact-fields">
          <label>
            <span>Title</span>
            <input
              disabled={isDisabled}
              maxLength={80}
              onChange={(event) => update("title", event.target.value)}
              placeholder="Looks in motion"
              value={form.title}
            />
          </label>
          <label>
            <span>Sort order</span>
            <input
              disabled={isDisabled}
              onChange={(event) => update("sortOrder", event.target.value)}
              placeholder="Auto"
              step="1"
              type="number"
              value={form.sortOrder}
            />
          </label>
          <label className="admin-compact-field--wide">
            <span>Caption</span>
            <textarea
              disabled={isDisabled}
              maxLength={160}
              onChange={(event) => update("caption", event.target.value)}
              placeholder="A short line for the storefront moodboard."
              rows={3}
              value={form.caption}
            />
          </label>
          <label className="admin-compact-field--wide">
            <span>Alt text</span>
            <input
              disabled={isDisabled}
              maxLength={160}
              onChange={(event) => update("altText", event.target.value)}
              placeholder="Describe the image for accessibility"
              value={form.altText}
            />
          </label>
          <label className="admin-checkbox admin-compact-checkbox admin-compact-field--wide">
            <input
              checked={form.isActive}
              disabled={isDisabled}
              onChange={(event) => update("isActive", event.target.checked)}
              type="checkbox"
            />
            <span>Active on storefront</span>
          </label>
        </div>
      </section>
    </form>
  );
}

function GalleryPreview({
  altText,
  imageUrl,
  title,
}: {
  altText: string | null;
  imageUrl: string | null;
  title: string | null;
}) {
  const [hasFailed, setHasFailed] = useState(false);

  useEffect(() => {
    setHasFailed(false);
  }, [imageUrl]);

  return (
    <div className="admin-landing-gallery-preview">
      {imageUrl && !hasFailed ? (
        <img
          alt={altText || title || "Landing gallery preview"}
          onError={() => setHasFailed(true)}
          src={imageUrl}
        />
      ) : (
        <span>
          <ImageIcon aria-hidden="true" size={22} />
          {imageUrl ? "Image unavailable" : "No image"}
        </span>
      )}
    </div>
  );
}

function AdminGallerySkeleton() {
  return Array.from({ length: 4 }, (_, index) => (
    <div aria-hidden="true" className="admin-landing-gallery-skeleton" key={index}>
      <span />
      <span />
      <span />
    </div>
  ));
}

function emptyGalleryForm(): GalleryFormState {
  return {
    altText: "",
    caption: "",
    imageFilename: "",
    imageSource: "none",
    imageUrl: "",
    isActive: true,
    sortOrder: "",
    title: "",
  };
}

function galleryForm(image: AdminLandingGalleryImage): GalleryFormState {
  return {
    altText: image.altText || "",
    caption: image.caption || "",
    imageFilename:
      image.managedImageAsset?.originalFilename ||
      (image.imageUrl ? "Existing gallery image" : ""),
    imageSource: image.managedImageAsset
      ? "managed"
      : image.imageUrl
        ? "legacy"
        : "none",
    imageUrl: image.imageUrl || "",
    isActive: image.isActive,
    sortOrder: String(image.sortOrder),
    title: image.title || "",
  };
}

function galleryPayload(
  form: GalleryFormState,
): CreateAdminLandingGalleryImageRequest {
  return {
    altText: normalizeNullableText(form.altText),
    caption: normalizeNullableText(form.caption),
    ...(form.imageSource === "legacy"
      ? { imageUrl: form.imageUrl }
      : form.imageSource === "none"
        ? { imageUrl: null }
        : {}),
    isActive: form.isActive,
    sortOrder: form.sortOrder.trim() ? Number(form.sortOrder) : undefined,
    title: normalizeNullableText(form.title),
  };
}

function validateGalleryForm(
  form: GalleryFormState,
  mode: GalleryModalMode,
): string | undefined {
  if (mode === "create" && form.imageSource === "none") {
    return "Choose a JPEG, PNG, or WebP image.";
  }

  if (form.title.trim().length > 80) {
    return "Title must be 80 characters or fewer.";
  }

  if (form.caption.trim().length > 160) {
    return "Caption must be 160 characters or fewer.";
  }

  if (form.altText.trim().length > 160) {
    return "Alt text must be 160 characters or fewer.";
  }

  if (
    form.sortOrder.trim() &&
    !Number.isInteger(Number(form.sortOrder.trim()))
  ) {
    return "Sort order must be a whole number.";
  }

  return undefined;
}

function areGalleryDetailsEqual(
  first: GalleryFormState,
  second: GalleryFormState,
): boolean {
  return (
    first.altText.trim() === second.altText.trim() &&
    first.caption.trim() === second.caption.trim() &&
    first.isActive === second.isActive &&
    first.sortOrder.trim() === second.sortOrder.trim() &&
    first.title.trim() === second.title.trim()
  );
}

function getGalleryImageStatus(form: GalleryFormState): string {
  switch (form.imageSource) {
    case "local":
      return "Ready to upload";
    case "managed":
      return "Stored securely in Supabase";
    case "legacy":
      return "Existing URL image; choose a file to migrate it";
    default:
      return "Choose one image for this gallery entry";
  }
}

function releaseGalleryPreview(reference: { current?: string }): void {
  if (!reference.current) return;
  URL.revokeObjectURL(reference.current);
  reference.current = undefined;
}

function getOrderedImages(
  images: AdminLandingGalleryImage[],
): AdminLandingGalleryImage[] {
  return [...images].sort((first, second) => {
    if (first.sortOrder !== second.sortOrder) {
      return first.sortOrder - second.sortOrder;
    }

    return new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime();
  });
}
