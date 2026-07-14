"use client";

import {
  AlertCircle,
  Check,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, MouseEvent, useEffect, useState } from "react";
import {
  AddressFields,
  emptyAddressInput,
  normalizeAddressInput,
  validateAddress,
} from "./AddressFields";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from "@/features/addresses/api";
import type { Address, AddressInput } from "@/features/addresses/types";
import { ApiClientError } from "@/lib/errors/api-error";
import { useI18n } from "@/features/i18n/useI18n";
import type { Locale } from "@/features/i18n/locale";

export function AddressBook() {
  const { locale, t } = useI18n();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingId, setEditingId] = useState<string | null>();
  const [form, setForm] = useState<AddressInput>(emptyAddressInput);
  const [makeDefault, setMakeDefault] = useState(false);
  const [error, setError] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);
  const isModalOpen = Boolean(editingId);
  const editingAddress = addresses.find((address) => address.id === editingId);

  useEffect(() => {
    void refresh();
  }, [locale]);

  useEffect(() => {
    if (!isModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isBusy) closeModal();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isBusy, isModalOpen]);

  async function refresh() {
    try {
      setAddresses((await listAddresses()).addresses);
      setError(undefined);
    } catch (caught) {
      setError(message(caught, t("profile.addressesLoadError"), locale));
    }
  }

  function openCreate() {
    setEditingId("new");
    setForm(emptyAddressInput);
    setMakeDefault(addresses.length === 0);
    setError(undefined);
  }

  function openEdit(address: Address) {
    setEditingId(address.id);
    setForm({
      recipientName: address.recipientName,
      phone: address.phone,
      province: address.province,
      district: address.district,
      ward: address.ward,
      addressLine: address.addressLine,
      note: address.note || "",
    });
    setMakeDefault(false);
    setError(undefined);
  }

  function closeModal() {
    if (isBusy) return;
    setEditingId(null);
    setMakeDefault(false);
    setError(undefined);
  }

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) closeModal();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isBusy) return;

    const validation = validateAddress(form, locale);
    if (validation) {
      setError(validation);
      return;
    }

    setIsBusy(true);
    setError(undefined);
    try {
      const payload = normalizeAddressInput(form);
      if (editingId === "new") {
        await createAddress({ ...payload, isDefault: makeDefault });
      } else if (editingId) {
        await updateAddress(editingId, payload);
        if (makeDefault) await setDefaultAddress(editingId);
      }
      setEditingId(null);
      setMakeDefault(false);
      await refresh();
    } catch (caught) {
      setError(message(caught, t("profile.addressSaveError"), locale));
    } finally {
      setIsBusy(false);
    }
  }

  async function remove(address: Address) {
    if (!window.confirm(`${t("profile.deleteConfirm")} ${address.recipientName}?`)) return;
    setIsBusy(true);
    setError(undefined);
    try {
      await deleteAddress(address.id);
      await refresh();
    } catch (caught) {
      setError(message(caught, t("profile.addressDeleteError"), locale));
    } finally {
      setIsBusy(false);
    }
  }

  async function makeAddressDefault(id: string) {
    setIsBusy(true);
    setError(undefined);
    try {
      await setDefaultAddress(id);
      await refresh();
    } catch (caught) {
      setError(message(caught, t("profile.defaultError"), locale));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section
      className="profile-subsection address-book"
      aria-labelledby="address-book-heading"
    >
      <div className="profile-subsection__header">
        <div>
          <h2 id="address-book-heading">{t("profile.addresses")}</h2>
          <p>{t("profile.addressesIntro")}</p>
        </div>
        {addresses.length > 0 ? (
          <button
            className="button button--primary"
            disabled={isBusy || isModalOpen}
            onClick={openCreate}
            type="button"
          >
            <Plus size={16} />
            {t("profile.addAddress")}
          </button>
        ) : null}
      </div>

      {error && !isModalOpen ? (
        <div className="customer-feedback customer-feedback--error" role="alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="address-list">
        {addresses.length === 0 ? (
          <div className="address-book__empty">
            <span className="address-book__empty-icon"><MapPin size={21} /></span>
            <div>
              <strong>{t("profile.noAddresses")}</strong>
              <p>{t("profile.noAddressesBody")}</p>
            </div>
            <button
              className="button button--primary"
              disabled={isBusy}
              onClick={openCreate}
              type="button"
            >
              <Plus size={15} />
              {t("profile.addAddress")}
            </button>
          </div>
        ) : (
          addresses.map((address) => (
            <article className="address-card" key={address.id}>
              <div className="address-card__content">
                <div>
                  <strong>{address.recipientName}</strong>
                  {address.isDefault ? (
                    <span className="address-default-badge">{t("profile.default")}</span>
                  ) : null}
                </div>
                <p>{address.phone}</p>
                <p>
                  {[address.addressLine, address.ward, address.district, address.province].join(", ")}
                </p>
                {address.note ? <small>{address.note}</small> : null}
              </div>
              <div className="address-card__actions">
                {!address.isDefault ? (
                  <button
                    disabled={isBusy}
                    onClick={() => void makeAddressDefault(address.id)}
                    type="button"
                  >
                    {t("profile.setDefault")}
                  </button>
                ) : null}
                <button
                  aria-label={`${t("profile.editAddressFor")} ${address.recipientName}`}
                  disabled={isBusy}
                  onClick={() => openEdit(address)}
                  type="button"
                >
                  <Pencil size={15} />
                  {t("profile.edit")}
                </button>
                <button
                  aria-label={`${t("profile.deleteAddressFor")} ${address.recipientName}`}
                  disabled={isBusy}
                  onClick={() => void remove(address)}
                  type="button"
                >
                  <Trash2 size={15} />
                  {t("profile.delete")}
                </button>
              </div>
            </article>
          ))
        )}
      </div>

      {isModalOpen ? (
        <div
          className="address-modal"
          onMouseDown={handleBackdropClick}
          role="presentation"
        >
          <section
            aria-labelledby="address-modal-title"
            aria-modal="true"
            className="address-modal__panel"
            role="dialog"
          >
            <header className="address-modal__header">
              <div>
                <p className="eyebrow">{t("profile.deliveryDetails")}</p>
                <h2 id="address-modal-title">
                  {editingId === "new" ? t("profile.addAddress") : t("profile.editAddress")}
                </h2>
              </div>
              <button
                aria-label={t("profile.closeAddress")}
                className="address-modal__close"
                disabled={isBusy}
                onClick={closeModal}
                type="button"
              >
                <X size={19} />
              </button>
            </header>

            <form className="address-modal__form" onSubmit={(event) => void submit(event)}>
              {error ? (
                <div className="customer-feedback customer-feedback--error" role="alert">
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              ) : null}

              <AddressFields
                autoFocus
                compact
                disabled={isBusy}
                idPrefix="profile-address"
                onChange={setForm}
                value={form}
              />

              {editingAddress?.isDefault ? (
                <p className="address-modal__default-note">
                  <Check size={16} />
                  {t("profile.defaultNote")}
                </p>
              ) : (
                <label className="address-checkbox">
                  <input
                    checked={makeDefault}
                    disabled={isBusy}
                    onChange={(event) => setMakeDefault(event.target.checked)}
                    type="checkbox"
                  />
                  {t("profile.setAsDefault")}
                </label>
              )}

              <footer className="address-modal__actions">
                <button
                  className="button button--secondary"
                  disabled={isBusy}
                  onClick={closeModal}
                  type="button"
                >
                  {t("profile.cancel")}
                </button>
                <button className="button button--primary" disabled={isBusy} type="submit">
                  {isBusy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
                  {isBusy ? t("profile.saving") : t("profile.saveAddress")}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function message(error: unknown, fallback: string, locale: Locale) {
  return error instanceof ApiClientError && locale === "en"
    ? error.message
    : fallback;
}
