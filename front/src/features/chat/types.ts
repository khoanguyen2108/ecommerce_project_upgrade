import type { UserRole } from "@/features/auth/types";

export type ChatStatus = "OPEN" | "CLOSED";
export type ChatSenderRole = "CUSTOMER" | "ADMIN" | "AI";

export interface ChatCustomer {
  id: string;
  email: string;
  name: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string | null;
  senderRole: ChatSenderRole;
  body: string;
  messageType: string;
  metadata: unknown;
  readAt: string | null;
  createdAt: string;
  sender: {
    id: string;
    name: string | null;
    role: UserRole;
  } | null;
}

export interface ChatConversation {
  id: string;
  customerId: string;
  customer: ChatCustomer;
  status: ChatStatus;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

export interface ChatConversationDetailResponse {
  conversation: ChatConversation;
  messages: ChatMessage[];
}

export interface ChatConversationsListResponse {
  conversations: ChatConversation[];
}

export interface ChatMessagesResponse {
  messages: ChatMessage[];
}

export interface ChatMessageResponse {
  conversation: ChatConversation;
  message: ChatMessage;
}

export interface ChatSocketError {
  code: string;
  message: string;
}
