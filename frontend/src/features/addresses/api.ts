import { apiRequest } from '@/lib/api/client';
import type { AddressListResponse, AddressResponse, CreateAddressRequest, UpdateAddressRequest } from './types';

const options = { auth: true, credentials: 'include' as const };

export function listAddresses(): Promise<AddressListResponse> {
  return apiRequest<AddressListResponse>('/addresses', { ...options, method: 'GET' });
}

export function createAddress(payload: CreateAddressRequest): Promise<AddressResponse> {
  return apiRequest<AddressResponse>('/addresses', { ...options, body: payload, method: 'POST' });
}

export function updateAddress(id: string, payload: UpdateAddressRequest): Promise<AddressResponse> {
  return apiRequest<AddressResponse>(`/addresses/${encodeURIComponent(id)}`, { ...options, body: payload, method: 'PATCH' });
}

export function deleteAddress(id: string): Promise<{ deleted: boolean; id: string }> {
  return apiRequest(`/addresses/${encodeURIComponent(id)}`, { ...options, method: 'DELETE' });
}

export function setDefaultAddress(id: string): Promise<AddressResponse> {
  return apiRequest<AddressResponse>(`/addresses/${encodeURIComponent(id)}/default`, { ...options, method: 'PATCH' });
}
