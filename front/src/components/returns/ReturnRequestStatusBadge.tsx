import { getReturnStatusLabel } from '@/features/returns/format';
import type { ReturnRequestStatus } from '@/features/returns/types';
import { useI18n } from '@/features/i18n/useI18n';

export function ReturnRequestStatusBadge({
  status,
}: {
  status: ReturnRequestStatus;
}) {
  const { locale } = useI18n();
  return (
    <span
      className={`return-request-status return-request-status--${status.toLowerCase()}`}
    >
      {getReturnStatusLabel(status, locale)}
    </span>
  );
}
