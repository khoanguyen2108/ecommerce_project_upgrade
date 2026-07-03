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
  productId?: string;
}

export interface ConversationProduct {
  name: string;
  slug: string;
}

export interface ConversationMemory {
  budget?: { amount: number; currency: "USD" | "VND" };
  preferredStyle?: string;
  preferredFit?: "slim" | "regular" | "oversized";
  occasion?: string;
  genderPreference?: string;
  favoriteColor?: string;
  lastSelectedProducts: ConversationProduct[];
}

export interface SizeRecommendation {
  status: "complete" | "needs_information" | "unavailable";
  product?: ConversationProduct;
  recommendedSize?: string;
  confidence?: number;
  reason?: string;
  alternativeSize?: string;
  availableSizes: string[];
  missingFields: string[];
  question?: string;
}

export interface ComparisonProduct extends ConversationProduct {
  price: number;
  currency: "VND";
  category: string;
  material: string | null;
  fit: string | null;
  style: string | null;
  availableSizes: string[];
  availableColors: string[];
  available: boolean;
  bestFor: string;
}

export interface ProductComparison {
  status: "complete" | "needs_information";
  productA?: ComparisonProduct;
  productB?: ComparisonProduct;
  recommendation?: string;
  question?: string;
  ambiguousProducts: ConversationProduct[];
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
  thumbnail: string | null;
  detailUrl: string;
  requestStatus?: "PENDING" | "APPROVED";
}

export interface SupportHandoff {
  required: boolean;
  reason?: string;
  suggestedMessage?: string;
}

export interface SupportResponse {
  mode: SupportMode;
  type?:
    | "text"
    | "single_order_card"
    | "order_cards"
    | "return_request_card"
    | "size_recommendation"
    | "comparison_card"
    | "conversation_memory";
  answer: string;
  sources?: SupportSource[];
  orderSummary?: SupportOrderSummary;
  order?: SupportOrderCard;
  orders?: SupportOrderCard[];
  returnRequest?: SupportReturnRequestCard;
  returnRequests?: SupportReturnRequestCard[];
  sizeRecommendation?: SizeRecommendation;
  comparison?: ProductComparison;
  conversationMemory?: ConversationMemory;
  handoff?: SupportHandoff;
  history?: {
    messages: ChatMessage[];
  };
}

export type SupportRequestStatus = "idle" | "loading" | "success" | "error";
import type { ChatMessage } from "@/features/chat/types";
