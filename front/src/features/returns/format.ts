import type { ReturnReason, ReturnRequestStatus } from './types';

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
