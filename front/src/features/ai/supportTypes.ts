export type SupportMode =
  | "ai"
  | "answer"
  | "policy_fallback"
  | "handoff"
  | "out_of_scope";

export interface SupportRequest {
  message: string;
  orderId?: string;
}

export interface SupportSource {
  id: string;
  title: string;
}

export interface SupportOrderSummary {
  orderId: string;
  status: string;
  fulfillmentStatus: string;
  paymentStatus: string;
  updatedAt: string;
}

export type SupportOrderCardStatus =
  | "PENDING_PAYMENT"
  | "PAID"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "OUT_FOR_DELIVERY";

export interface SupportOrderCard {
  orderCode: string;
  status: SupportOrderCardStatus;
  createdAt: string;
  totalAmount: number;
  currency: string;
  thumbnail: string | null;
  detailUrl: string;
}

export interface SupportHandoff {
  required: boolean;
  reason?: string;
  suggestedMessage?: string;
}

export interface SupportResponse {
  mode: SupportMode;
  type?: "text" | "order_cards";
  answer: string;
  sources?: SupportSource[];
  orderSummary?: SupportOrderSummary;
  orders?: SupportOrderCard[];
  handoff?: SupportHandoff;
}

export type SupportRequestStatus = "idle" | "loading" | "success" | "error";
