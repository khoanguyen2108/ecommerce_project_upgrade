export type SupportMode =
  | "ai"
  | "answer"
  | "policy_fallback"
  | "handoff"
  | "out_of_scope";

export interface SupportRequest {
  message: string;
  action?: "TRACK_ORDER" | "RETURN_REQUEST";
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
  estimatedArrival: string | null;
  totalAmount: number;
  currency: string;
  thumbnail: string | null;
  detailUrl: string;
}

export interface SupportReturnRequestCard {
  orderCode: string;
  deliveredAt: string;
  status: "DELIVERED";
  requestStatus?: "PENDING";
}

export interface SupportHandoff {
  required: boolean;
  reason?: string;
  suggestedMessage?: string;
}

export interface SupportResponse {
  mode: SupportMode;
  type?: "text" | "single_order_card" | "order_cards" | "return_request_card";
  answer: string;
  sources?: SupportSource[];
  orderSummary?: SupportOrderSummary;
  order?: SupportOrderCard;
  orders?: SupportOrderCard[];
  returnRequest?: SupportReturnRequestCard;
  handoff?: SupportHandoff;
}

export type SupportRequestStatus = "idle" | "loading" | "success" | "error";
