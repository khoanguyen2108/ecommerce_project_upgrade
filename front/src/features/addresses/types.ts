export interface AddressInput {
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  addressLine: string;
  note?: string;
}

export interface Address extends Omit<AddressInput, 'note'> {
  id: string;
  note: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAddressRequest extends AddressInput {
  isDefault?: boolean;
}

export type UpdateAddressRequest = Partial<AddressInput>;

export interface AddressResponse { address: Address; }
export interface AddressListResponse { addresses: Address[]; }
