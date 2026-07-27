import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { OrderItemImage } from "@/components/orders/OrderItemImage";
import type {
  SupportOrderCard,
  SupportOrderCardStatus,
} from "@/features/ai/supportTypes";
import { formatCurrency } from "@/components/orders/order-format";

interface AiOrderCardsProps {
  orders: SupportOrderCard[];
  variant?: "compact" | "single";
}

const STATUS_LABELS: Record<SupportOrderCardStatus, string> = {
  PENDING_PAYMENT: "Pending payment",
  PAID: "Paid",
  PICKED_UP: "Picked up",
  IN_TRANSIT: "Shipping",
  OUT_FOR_DELIVERY: "Out for delivery",
};

export function AiOrderCards({
  orders,
  variant = "compact",
}: AiOrderCardsProps) {
  return (
    <div
      className={`customer-chat-order-cards customer-chat-order-cards--${variant}`}
    >
      {orders.map((order) => (
        <Link
          aria-label={`${"View order"} ${order.orderCode}`}
          className={`customer-chat-order-card customer-chat-order-card--${variant}`}
          href={order.detailUrl}
          key={order.detailUrl}
        >
          <OrderItemImage
            alt={`${"Order"} ${order.orderCode}`}
            imageUrl={order.thumbnail}
            size="compact"
          />
          <span className="customer-chat-order-card__content">
            <span className="customer-chat-order-card__header">
              <strong>#{order.orderCode}</strong>
              <span
                className={`customer-chat-order-card__status customer-chat-order-card__status--${order.status.toLowerCase().replaceAll("_", "-")}`}
              >
                {STATUS_LABELS[order.status]}
              </span>
            </span>
            <span className="customer-chat-order-card__date">
              {"Placed"} {formatPlacedDate(order.createdAt, "recently")}
            </span>
            {order.estimatedArrival ? (
              <span className="customer-chat-order-card__date">
                {"Estimated arrival"} {formatPlacedDate(order.estimatedArrival, "recently")}
              </span>
            ) : null}
            <span className="customer-chat-order-card__footer">
              <strong>{formatCurrency(order.totalAmount, order.currency)}</strong>
              <span>{"Track Order"}</span>
            </span>
          </span>
          <ChevronRight aria-hidden="true" size={18} />
        </Link>
      ))}
    </div>
  );
}

function formatPlacedDate(value: string, fallback: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
  }).format(date);
}
