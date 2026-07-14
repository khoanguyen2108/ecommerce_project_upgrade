import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { OrderItemImage } from "@/components/orders/OrderItemImage";
import type {
  SupportOrderCard,
  SupportOrderCardStatus,
} from "@/features/ai/supportTypes";
import { formatCurrency } from "@/components/orders/order-format";
import { useI18n } from "@/features/i18n/useI18n";
import type { Locale } from "@/features/i18n/locale";
import type { TranslationKey } from "@/features/i18n/translations";

interface AiOrderCardsProps {
  orders: SupportOrderCard[];
  variant?: "compact" | "single";
}

const STATUS_LABEL_KEYS: Record<SupportOrderCardStatus, TranslationKey> = {
  PENDING_PAYMENT: "chat.pendingPayment",
  PAID: "chat.paid",
  PICKED_UP: "chat.pickedUp",
  IN_TRANSIT: "chat.shipping",
  OUT_FOR_DELIVERY: "chat.outForDelivery",
};

export function AiOrderCards({
  orders,
  variant = "compact",
}: AiOrderCardsProps) {
  const { locale, t } = useI18n();
  return (
    <div
      className={`customer-chat-order-cards customer-chat-order-cards--${variant}`}
    >
      {orders.map((order) => (
        <Link
          aria-label={`${t("chat.viewOrder")} ${order.orderCode}`}
          className={`customer-chat-order-card customer-chat-order-card--${variant}`}
          href={order.detailUrl}
          key={order.detailUrl}
        >
          <OrderItemImage
            alt={`${t("chat.order")} ${order.orderCode}`}
            imageUrl={order.thumbnail}
            size="compact"
          />
          <span className="customer-chat-order-card__content">
            <span className="customer-chat-order-card__header">
              <strong>#{order.orderCode}</strong>
              <span
                className={`customer-chat-order-card__status customer-chat-order-card__status--${order.status.toLowerCase().replaceAll("_", "-")}`}
              >
                {t(STATUS_LABEL_KEYS[order.status])}
              </span>
            </span>
            <span className="customer-chat-order-card__date">
              {t("chat.placed")} {formatPlacedDate(order.createdAt, locale, t("chat.recently"))}
            </span>
            {order.estimatedArrival ? (
              <span className="customer-chat-order-card__date">
                {t("chat.estimatedArrival")} {formatPlacedDate(order.estimatedArrival, locale, t("chat.recently"))}
              </span>
            ) : null}
            <span className="customer-chat-order-card__footer">
              <strong>{formatCurrency(order.totalAmount, order.currency)}</strong>
              <span>{t("chat.trackOrder")}</span>
            </span>
          </span>
          <ChevronRight aria-hidden="true" size={18} />
        </Link>
      ))}
    </div>
  );
}

function formatPlacedDate(value: string, locale: Locale, fallback: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
    day: "numeric",
    month: "short",
  }).format(date);
}
