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

export interface SupportHandoff {
  required: boolean;
  reason?: string;
  suggestedMessage?: string;
}

export interface SupportResponse {
  mode: SupportMode;
  answer: string;
  sources?: SupportSource[];
  orderSummary?: SupportOrderSummary;
  handoff?: SupportHandoff;
}

export type SupportRequestStatus = "idle" | "loading" | "success" | "error";
