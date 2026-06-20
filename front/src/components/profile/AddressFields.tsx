import type { AddressInput } from '@/features/addresses/types';

export const emptyAddressInput: AddressInput = {
  recipientName: '', phone: '', province: '', district: '', ward: '', addressLine: '', note: '',
};

export function AddressFields({ compact = false, disabled = false, idPrefix, onChange, value }: {
  compact?: boolean;
  disabled?: boolean;
  idPrefix: string;
  onChange: (value: AddressInput) => void;
  value: AddressInput;
}) {
  const field = (key: keyof AddressInput, label: string, autoComplete: string, maxLength: number, placeholder: string) => (
    <div className={`form-field ${(compact ? key === 'note' : key === 'addressLine' || key === 'note') ? 'address-form__wide' : ''}`}>
      <label htmlFor={`${idPrefix}-${key}`}>{label}{key === 'note' ? ' (optional)' : ''}</label>
      <input
        autoComplete={autoComplete}
        disabled={disabled}
        id={`${idPrefix}-${key}`}
        maxLength={maxLength}
        onChange={(event) => onChange({ ...value, [key]: event.target.value })}
        placeholder={placeholder}
        required={key !== 'note'}
        type={key === 'phone' ? 'tel' : 'text'}
        value={value[key] || ''}
      />
    </div>
  );

  return (
    <div className={`address-form__fields ${compact ? 'address-form__fields--compact' : ''}`}>
      {field('recipientName', 'Recipient name', 'name', 120, 'Nguyen Van An')}
      {field('phone', 'Phone number', 'tel', 20, '0901234567')}
      {field('province', 'Province / City', 'address-level1', 120, 'Ho Chi Minh City')}
      {field('district', 'District', 'address-level2', 120, 'District 1')}
      {field('ward', 'Ward', 'address-level3', 120, 'Ben Nghe Ward')}
      {field('addressLine', 'Address line', 'street-address', 255, '12 Nguyen Hue Street')}
      {field('note', 'Delivery note', 'off', 500, 'Call before delivery')}
    </div>
  );
}

export function validateAddress(value: AddressInput): string | undefined {
  if (!value.recipientName.trim() || !value.phone.trim() || !value.province.trim() || !value.district.trim() || !value.ward.trim() || !value.addressLine.trim()) {
    return 'Complete all required delivery fields.';
  }
  if (!/^(?:\+84|0)\d{9}$/.test(value.phone.trim())) {
    return 'Enter a valid Vietnamese phone number, such as 0901234567.';
  }
  return undefined;
}

export function normalizeAddressInput(value: AddressInput): AddressInput {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item?.trim()])) as unknown as AddressInput;
}
