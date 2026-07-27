import { getReturnStatusLabel } from '@/features/returns/format';
import type { ReturnRequestStatus } from '@/features/returns/types';

export function ReturnRequestStatusBadge({
  status,
}: {
  status: ReturnRequestStatus;
}) {
  return (
    <span
      className={`return-request-status return-request-status--${status.toLowerCase()}`}
    >
      {getReturnStatusLabel(status)}
    </span>
  );
}
