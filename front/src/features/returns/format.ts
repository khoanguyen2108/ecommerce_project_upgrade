import type { ReturnReason, ReturnRequestStatus } from './types';
import type { Locale } from '@/features/i18n/locale';

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  WRONG_SIZE: 'Wrong Size',
  WRONG_ITEM: 'Wrong Item',
  DAMAGED: 'Damaged',
  CHANGED_MIND: 'Changed Mind',
  OTHER: 'Other',
};

export const RETURN_STATUS_LABELS: Record<ReturnRequestStatus, string> = {
  PENDING: 'Pending Review',
  APPROVED: 'Return Approved',
  REJECTED: 'Return Rejected',
};

export function getReturnReasonLabel(
  reason: ReturnReason,
  locale: Locale = 'en',
): string {
  if (locale === 'vi') {
    const labels: Record<ReturnReason, string> = {
      WRONG_SIZE: 'Sai kích cỡ',
      WRONG_ITEM: 'Sai sản phẩm',
      DAMAGED: 'Sản phẩm bị hỏng',
      CHANGED_MIND: 'Thay đổi ý định',
      OTHER: 'Lý do khác',
    };
    return labels[reason];
  }

  return RETURN_REASON_LABELS[reason];
}

export function getReturnStatusLabel(
  status: ReturnRequestStatus,
  locale: Locale = 'en',
): string {
  if (locale === 'vi') {
    const labels: Record<ReturnRequestStatus, string> = {
      PENDING: 'Đang chờ xem xét',
      APPROVED: 'Đã chấp thuận trả hàng',
      REJECTED: 'Đã từ chối trả hàng',
    };
    return labels[status];
  }

  return RETURN_STATUS_LABELS[status];
}
