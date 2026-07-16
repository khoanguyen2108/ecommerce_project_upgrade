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
  getApiRequestId,
  normalizeNullableText,
} from "@/components/admin/admin-format";
import {
  formatAdminCatalogNumber,
  getAdminCatalogErrorMessage,
  getAdminCatalogTranslations,
  type AdminCatalogTranslations,
} from "@/features/i18n/admin-catalog-translations";
import { useI18n } from "@/features/i18n/useI18n";
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
  const { locale } = useI18n();
  const copy = getAdminCatalogTranslations(locale);
  const copyRef = useRef(copy);
  copyRef.current = copy;
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
          getAdminCatalogErrorMessage(
            error,
            copyRef.current.gallery.errors,
            copyRef.current.gallery.feedback.listLoadError,
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
      setActionError(copy.gallery.errors.LANDING_GALLERY_IMAGE_LIMIT_EXCEEDED);
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
      setActionError(copy.gallery.feedback.imageType);
      return;
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      setActionError(copy.gallery.feedback.imageSize);
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

    const validationError = validateGalleryForm(form, modalMode, copy);

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
        setSuccessMessage(copy.gallery.feedback.changesSaved);
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
        getAdminCatalogErrorMessage(
          error,
          copy.gallery.errors,
          copy.gallery.feedback.saveError,
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
      !window.confirm(copy.gallery.confirm.status(nextIsActive))
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
          ? copy.gallery.feedback.activated
          : copy.gallery.feedback.deactivated,
      );
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setActionError(
        getAdminCatalogErrorMessage(
          error,
          copy.gallery.errors,
          copy.gallery.feedback.statusError,
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

    if (!window.confirm(copy.gallery.confirm.delete)) {
      return;
    }

    setBusyAction(`${image.id}:delete`);
    resetActionFeedback();

    try {
      const response = await deleteAdminLandingGalleryImage(image.id);
      setSuccessMessage(copy.gallery.feedback.deleted);
      if (response.warning) {
        setActionError(response.warning);
      }
      setRefreshKey((current) => current + 1);
    } catch (error) {
      setActionError(
        getAdminCatalogErrorMessage(
          error,
          copy.gallery.errors,
          copy.gallery.feedback.deleteError,
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
      setSuccessMessage(copy.gallery.feedback.orderUpdated);
    } catch (error) {
      setActionError(
        getAdminCatalogErrorMessage(
          error,
          copy.gallery.errors,
          copy.gallery.feedback.orderError,
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
          <p className="admin-page-intro__eyebrow">{copy.gallery.header.eyebrow}</p>
          <h1 id="admin-landing-gallery-heading">{copy.gallery.header.title}</h1>
          <p>{copy.gallery.header.subtitle}</p>
        </div>
        <div className="admin-header-actions">
          <span className="admin-gallery-count">
            {copy.gallery.header.count(
              formatAdminCatalogNumber(count, locale),
              formatAdminCatalogNumber(maxImages, locale),
            )}
          </span>
          <button
            className="button button--secondary"
            disabled={isLoading}
            onClick={() => setRefreshKey((current) => current + 1)}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={17} />
            {copy.common.refresh}
          </button>
          <button
            className="button button--primary"
            disabled={!canAddImage}
            onClick={openCreateModal}
            type="button"
          >
            <Plus aria-hidden="true" size={17} />
            {copy.gallery.header.newImage}
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

      <section className="admin-landing-gallery-board" aria-label={copy.gallery.board.aria}>
        {isLoading ? <AdminGallerySkeleton /> : null}
        {!isLoading && !listError && orderedImages.length === 0 ? (
          <div className="admin-landing-gallery-empty">
            <ImageIcon aria-hidden="true" size={28} strokeWidth={1.7} />
            <h2>{copy.gallery.board.emptyTitle}</h2>
            <p>{copy.gallery.board.emptyBody}</p>
            <button className="button button--primary" onClick={openCreateModal} type="button">
              <Plus aria-hidden="true" size={17} />
              {copy.gallery.header.newImage}
            </button>
          </div>
        ) : null}
        {!isLoading && !listError
          ? orderedImages.map((image, index) => (
              <article className="admin-landing-gallery-card" key={image.id}>
                <GalleryPreview
                  altText={image.altText}
                  copy={copy}
                  imageUrl={image.imageUrl}
                  title={image.title}
                />
                <div className="admin-landing-gallery-card__body">
                  <div className="admin-landing-gallery-card__heading">
                    <div>
                      <h2>{image.title || copy.gallery.board.untitled}</h2>
                      <span>
                        {copy.gallery.board.order(
                          formatAdminCatalogNumber(image.sortOrder, locale),
                        )}
                      </span>
                    </div>
                    <span
                      className={`admin-badge ${
                        image.isActive ? "admin-badge--neutral" : "admin-badge--muted"
                      }`}
                    >
                      {image.isActive ? copy.common.active : copy.common.inactive}
                    </span>
                  </div>
                  <p>{image.caption || copy.gallery.board.noCaption}</p>
                  <dl>
                    <div>
                      <dt>{copy.gallery.board.altText}</dt>
                      <dd>{image.altText || copy.common.notSet}</dd>
                    </div>
                    <div>
                      <dt>{copy.gallery.board.updated}</dt>
                      <dd>{formatAdminDate(image.updatedAt, locale)}</dd>
                    </div>
                  </dl>
                  <code title={image.imageUrl || undefined}>
                    {image.imageUrl || copy.gallery.board.noImageUploaded}
                  </code>
                </div>
                <footer className="admin-landing-gallery-card__actions">
                  <button
                    aria-label={copy.gallery.board.moveUpAria}
                    className="icon-button admin-icon-button"
                    disabled={Boolean(busyAction) || index === 0}
                    onClick={() => void handleMove(image, "up")}
                    title={copy.gallery.board.moveUpTitle}
                    type="button"
                  >
                    <ArrowUp aria-hidden="true" size={17} />
                  </button>
                  <button
                    aria-label={copy.gallery.board.moveDownAria}
                    className="icon-button admin-icon-button"
                    disabled={Boolean(busyAction) || index === orderedImages.length - 1}
                    onClick={() => void handleMove(image, "down")}
                    title={copy.gallery.board.moveDownTitle}
                    type="button"
                  >
                    <ArrowDown aria-hidden="true" size={17} />
                  </button>
                  <button
                    aria-label={copy.gallery.board.editAria}
                    className="icon-button admin-icon-button"
                    disabled={Boolean(busyAction)}
                    onClick={() => openEditModal(image)}
                    title={copy.gallery.board.editTitle}
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
                        {copy.common.deactivate}
                      </>
                    ) : (
                      <>
                        <Eye aria-hidden="true" size={15} />
                        {copy.common.activate}
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
                    {copy.common.delete}
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
              {copy.common.cancel}
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
                  ? copy.common.uploading
                  : copy.common.saving
                : modalMode === "create"
                  ? copy.common.create
                  : copy.common.save}
            </button>
          </>
        )}
        hasUnsavedChanges={hasUnsavedChanges}
        isOpen={isModalOpen}
        onClose={() => {
          releaseGalleryPreview(localPreviewUrlRef);
          setIsModalOpen(false);
        }}
        title={
          modalMode === "create"
            ? copy.gallery.form.newTitle
            : copy.gallery.form.editTitle
        }
      >
        {actionError ? (
          <AdminFeedback message={actionError} requestId={requestId} tone="error" />
        ) : null}
        <GalleryForm
          form={form}
          copy={copy}
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
  copy,
  form,
  isDisabled,
  onChange,
  onFileChange,
  onRemoveImage,
  onSubmit,
}: {
  copy: AdminCatalogTranslations;
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
          <p className="eyebrow">{copy.gallery.form.sourceEyebrow}</p>
          <h3 id="landing-gallery-image-heading">
            {copy.gallery.form.imageTitle}
          </h3>
          <p>{copy.gallery.form.imageHelper}</p>
        </div>
        <div className="admin-landing-gallery-form__media">
          <GalleryPreview
            altText={form.altText}
            copy={copy}
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
              {copy.gallery.form.chooseFile}
            </button>
            <div className="admin-gallery-image-meta">
              <strong>
                {form.imageFilename ||
                  (form.imageSource === "managed" ||
                  form.imageSource === "legacy"
                    ? copy.gallery.form.existingImage
                    : copy.gallery.form.noImage)}
              </strong>
              <small>{getGalleryImageStatus(form, copy)}</small>
            </div>
            {form.imageSource !== "none" ? (
              <button
                className="admin-link-button admin-link-button--delete"
                disabled={isDisabled}
                onClick={onRemoveImage}
                type="button"
              >
                <Trash2 aria-hidden="true" size={15} />
                {copy.gallery.form.removeImage}
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <section className="admin-compact-group" aria-labelledby="landing-gallery-copy-heading">
        <h3 id="landing-gallery-copy-heading">
          {copy.gallery.form.copyTitle}
        </h3>
        <div className="admin-compact-fields">
          <label>
            <span>{copy.gallery.form.title}</span>
            <input
              disabled={isDisabled}
              maxLength={80}
              onChange={(event) => update("title", event.target.value)}
              placeholder={copy.gallery.form.titlePlaceholder}
              value={form.title}
            />
          </label>
          <label>
            <span>{copy.gallery.form.sortOrder}</span>
            <input
              disabled={isDisabled}
              onChange={(event) => update("sortOrder", event.target.value)}
              placeholder={copy.gallery.form.sortOrderPlaceholder}
              step="1"
              type="number"
              value={form.sortOrder}
            />
          </label>
          <label className="admin-compact-field--wide">
            <span>{copy.gallery.form.caption}</span>
            <textarea
              disabled={isDisabled}
              maxLength={160}
              onChange={(event) => update("caption", event.target.value)}
              placeholder={copy.gallery.form.captionPlaceholder}
              rows={3}
              value={form.caption}
            />
          </label>
          <label className="admin-compact-field--wide">
            <span>{copy.gallery.form.altText}</span>
            <input
              disabled={isDisabled}
              maxLength={160}
              onChange={(event) => update("altText", event.target.value)}
              placeholder={copy.gallery.form.altTextPlaceholder}
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
            <span>{copy.gallery.form.active}</span>
          </label>
        </div>
      </section>
    </form>
  );
}

function GalleryPreview({
  altText,
  copy,
  imageUrl,
  title,
}: {
  altText: string | null;
  copy: AdminCatalogTranslations;
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
          alt={altText || title || copy.gallery.form.previewAlt}
          onError={() => setHasFailed(true)}
          src={imageUrl}
        />
      ) : (
        <span>
          <ImageIcon aria-hidden="true" size={22} />
          {imageUrl
            ? copy.gallery.form.imageUnavailable
            : copy.gallery.form.noPreviewImage}
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
    imageFilename: image.managedImageAsset?.originalFilename || "",
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
  copy: AdminCatalogTranslations,
): string | undefined {
  if (mode === "create" && form.imageSource === "none") {
    return copy.gallery.validation.imageRequired;
  }

  if (form.title.trim().length > 80) {
    return copy.gallery.validation.titleLength;
  }

  if (form.caption.trim().length > 160) {
    return copy.gallery.validation.captionLength;
  }

  if (form.altText.trim().length > 160) {
    return copy.gallery.validation.altTextLength;
  }

  if (
    form.sortOrder.trim() &&
    !Number.isInteger(Number(form.sortOrder.trim()))
  ) {
    return copy.gallery.validation.sortOrder;
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

function getGalleryImageStatus(
  form: GalleryFormState,
  copy: AdminCatalogTranslations,
): string {
  switch (form.imageSource) {
    case "local":
      return copy.gallery.form.readyToUpload;
    case "managed":
      return copy.gallery.form.managedImage;
    case "legacy":
      return copy.gallery.form.legacyImage;
    default:
      return copy.gallery.form.chooseImage;
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
