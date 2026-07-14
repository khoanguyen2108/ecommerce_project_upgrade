import type { AddressInput } from '@/features/addresses/types';
import type { Locale } from '@/features/i18n/locale';
import { translate } from '@/features/i18n/translations';
import { useI18n } from '@/features/i18n/useI18n';

export const emptyAddressInput: AddressInput = {
  recipientName: '', phone: '', province: '', district: '', ward: '', addressLine: '', note: '',
};

export function AddressFields({ autoFocus = false, compact = false, disabled = false, idPrefix, onChange, value }: {
  autoFocus?: boolean;
  compact?: boolean;
  disabled?: boolean;
  idPrefix: string;
  onChange: (value: AddressInput) => void;
  value: AddressInput;
}) {
  const { t } = useI18n();
  const field = (key: keyof AddressInput, label: string, autoComplete: string, maxLength: number, placeholder: string) => (
    <div className={`form-field address-form__field--${key} ${(compact ? key === 'note' : key === 'addressLine' || key === 'note') ? 'address-form__wide' : ''}`}>
      <label htmlFor={`${idPrefix}-${key}`}>{label}{key === 'note' ? ` (${t('profile.optional')})` : ''}</label>
      <input
        autoComplete={autoComplete}
        autoFocus={autoFocus && key === 'recipientName'}
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
      {field('recipientName', t('profile.recipientName'), 'name', 120, 'Nguyễn Văn An')}
      {field('phone', t('profile.phone'), 'tel', 20, '0901234567')}
      {field('province', t('profile.province'), 'address-level1', 120, t('profile.provincePlaceholder'))}
      {field('district', t('profile.district'), 'address-level2', 120, t('profile.districtPlaceholder'))}
      {field('ward', t('profile.ward'), 'address-level3', 120, t('profile.wardPlaceholder'))}
      {field('addressLine', compact ? t('profile.streetAddress') : t('profile.addressLine'), 'street-address', 255, t('profile.addressPlaceholder'))}
      {field('note', t('profile.deliveryNote'), 'off', 500, t('profile.notePlaceholder'))}
    </div>
  );
}

export function validateAddress(
  value: AddressInput,
  locale: Locale = 'en',
): string | undefined {
  if (!value.recipientName.trim() || !value.phone.trim() || !value.province.trim() || !value.district.trim() || !value.ward.trim() || !value.addressLine.trim()) {
    return translate(locale, 'profile.requiredFields');
  }
  if (!/^(?:\+84|0)\d{9}$/.test(value.phone.trim())) {
    return translate(locale, 'profile.invalidPhone');
  }
  return undefined;
}

export function normalizeAddressInput(value: AddressInput): AddressInput {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, item?.trim()])) as unknown as AddressInput;
}
