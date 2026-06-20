'use client';

import { AlertCircle, Check, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { AddressFields, emptyAddressInput, normalizeAddressInput, validateAddress } from './AddressFields';
import { createAddress, deleteAddress, listAddresses, setDefaultAddress, updateAddress } from '@/features/addresses/api';
import type { Address, AddressInput } from '@/features/addresses/types';
import { ApiClientError } from '@/lib/errors/api-error';

export function AddressBook() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [editingId, setEditingId] = useState<string | null>();
  const [form, setForm] = useState<AddressInput>(emptyAddressInput);
  const [makeDefault, setMakeDefault] = useState(false);
  const [error, setError] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => { void refresh(); }, []);

  async function refresh() {
    try { setAddresses((await listAddresses()).addresses); }
    catch (caught) { setError(message(caught, 'Saved addresses could not be loaded.')); }
  }

  function openCreate() { setEditingId('new'); setForm(emptyAddressInput); setMakeDefault(addresses.length === 0); setError(undefined); }
  function openEdit(address: Address) {
    setEditingId(address.id);
    setForm({ recipientName: address.recipientName, phone: address.phone, province: address.province, district: address.district, ward: address.ward, addressLine: address.addressLine, note: address.note || '' });
    setMakeDefault(false); setError(undefined);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateAddress(form);
    if (validation) { setError(validation); return; }
    setIsBusy(true); setError(undefined);
    try {
      const payload = normalizeAddressInput(form);
      if (editingId === 'new') await createAddress({ ...payload, isDefault: makeDefault });
      else if (editingId) {
        await updateAddress(editingId, payload);
        if (makeDefault) await setDefaultAddress(editingId);
      }
      setEditingId(null); await refresh();
    } catch (caught) { setError(message(caught, 'Address could not be saved.')); }
    finally { setIsBusy(false); }
  }

  async function remove(address: Address) {
    if (!window.confirm(`Delete the address for ${address.recipientName}?`)) return;
    setIsBusy(true); setError(undefined);
    try { await deleteAddress(address.id); await refresh(); }
    catch (caught) { setError(message(caught, 'Address could not be deleted.')); }
    finally { setIsBusy(false); }
  }

  async function makeAddressDefault(id: string) {
    setIsBusy(true); setError(undefined);
    try { await setDefaultAddress(id); await refresh(); }
    catch (caught) { setError(message(caught, 'Default address could not be changed.')); }
    finally { setIsBusy(false); }
  }

  return (
    <section className="address-book" aria-labelledby="address-book-heading">
      <div className="customer-section__header">
        <div><p className="eyebrow">Delivery</p><h2 id="address-book-heading">Address book</h2></div>
        <button className="button button--primary" disabled={isBusy || Boolean(editingId)} onClick={openCreate} type="button"><Plus size={16} />Add address</button>
      </div>
      {error ? <div className="customer-feedback customer-feedback--error" role="alert"><AlertCircle size={18} /><span>{error}</span></div> : null}
      {editingId ? (
        <form className="address-form" onSubmit={(event) => void submit(event)}>
          <div className="address-form__heading"><strong>{editingId === 'new' ? 'New address' : 'Edit address'}</strong><button aria-label="Close form" onClick={() => setEditingId(null)} type="button"><X size={18} /></button></div>
          <AddressFields disabled={isBusy} idPrefix="profile-address" onChange={setForm} value={form} />
          <label className="address-checkbox"><input checked={makeDefault} disabled={isBusy} onChange={(event) => setMakeDefault(event.target.checked)} type="checkbox" />Set as default address</label>
          <div className="profile-form__actions"><button className="button button--primary" disabled={isBusy} type="submit"><Check size={16} />{isBusy ? 'Saving...' : 'Save address'}</button><button className="button button--secondary" disabled={isBusy} onClick={() => setEditingId(null)} type="button">Cancel</button></div>
        </form>
      ) : null}
      <div className="address-list">
        {addresses.length === 0 && !editingId ? <div className="address-book__empty"><MapPin size={26} /><p>No saved delivery addresses yet.</p></div> : addresses.map((address) => (
          <article className="address-card" key={address.id}>
            <div className="address-card__content"><div><strong>{address.recipientName}</strong>{address.isDefault ? <span className="address-default-badge">Default</span> : null}</div><p>{address.phone}</p><p>{[address.addressLine, address.ward, address.district, address.province].join(', ')}</p>{address.note ? <small>{address.note}</small> : null}</div>
            <div className="address-card__actions">{!address.isDefault ? <button disabled={isBusy} onClick={() => void makeAddressDefault(address.id)} type="button">Set default</button> : null}<button aria-label="Edit address" disabled={isBusy} onClick={() => openEdit(address)} type="button"><Pencil size={15} />Edit</button><button aria-label="Delete address" disabled={isBusy} onClick={() => void remove(address)} type="button"><Trash2 size={15} />Delete</button></div>
          </article>
        ))}
      </div>
    </section>
  );
}

function message(error: unknown, fallback: string) { return error instanceof ApiClientError ? error.message : fallback; }
