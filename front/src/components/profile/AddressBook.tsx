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

export function AddressBook() {
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
  }, []);

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
    } catch (caught) {
      setError(message(caught, "Saved addresses could not be loaded."));
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

    const validation = validateAddress(form);
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
      setError(message(caught, "Address could not be saved."));
    } finally {
      setIsBusy(false);
    }
  }

  async function remove(address: Address) {
    if (!window.confirm(`Delete the address for ${address.recipientName}?`)) return;
    setIsBusy(true);
    setError(undefined);
    try {
      await deleteAddress(address.id);
      await refresh();
    } catch (caught) {
      setError(message(caught, "Address could not be deleted."));
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
      setError(message(caught, "Default address could not be changed."));
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
          <p className="eyebrow">Delivery</p>
          <h2 id="address-book-heading">Delivery Addresses</h2>
          <p>Choose where you would like your orders delivered.</p>
        </div>
        {addresses.length > 0 ? (
          <button
            className="button button--primary"
            disabled={isBusy || isModalOpen}
            onClick={openCreate}
            type="button"
          >
            <Plus size={16} />
            Add Address
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
              <strong>No saved addresses yet</strong>
              <p>Add an address for a faster checkout.</p>
            </div>
            <button
              className="button button--primary"
              disabled={isBusy}
              onClick={openCreate}
              type="button"
            >
              <Plus size={15} />
              Add Address
            </button>
          </div>
        ) : (
          addresses.map((address) => (
            <article className="address-card" key={address.id}>
              <div className="address-card__content">
                <div>
                  <strong>{address.recipientName}</strong>
                  {address.isDefault ? (
                    <span className="address-default-badge">Default</span>
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
                    Set default
                  </button>
                ) : null}
                <button
                  aria-label={`Edit address for ${address.recipientName}`}
                  disabled={isBusy}
                  onClick={() => openEdit(address)}
                  type="button"
                >
                  <Pencil size={15} />
                  Edit
                </button>
                <button
                  aria-label={`Delete address for ${address.recipientName}`}
                  disabled={isBusy}
                  onClick={() => void remove(address)}
                  type="button"
                >
                  <Trash2 size={15} />
                  Delete
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
                <p className="eyebrow">Delivery details</p>
                <h2 id="address-modal-title">
                  {editingId === "new" ? "Add Address" : "Edit Address"}
                </h2>
              </div>
              <button
                aria-label="Close address form"
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
                  This is your default delivery address.
                </p>
              ) : (
                <label className="address-checkbox">
                  <input
                    checked={makeDefault}
                    disabled={isBusy}
                    onChange={(event) => setMakeDefault(event.target.checked)}
                    type="checkbox"
                  />
                  Set as default address
                </label>
              )}

              <footer className="address-modal__actions">
                <button
                  className="button button--secondary"
                  disabled={isBusy}
                  onClick={closeModal}
                  type="button"
                >
                  Cancel
                </button>
                <button className="button button--primary" disabled={isBusy} type="submit">
                  {isBusy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
                  {isBusy ? "Saving..." : "Save Address"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}

function message(error: unknown, fallback: string) {
  return error instanceof ApiClientError ? error.message : fallback;
}
