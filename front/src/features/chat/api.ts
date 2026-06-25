import { apiRequest } from "@/lib/api/client";
import type {
  ChatConversationDetailResponse,
  ChatConversationsListResponse,
  ChatMessageResponse,
  ChatMessagesResponse,
} from "@/features/chat/types";

export function getMyChat(): Promise<ChatConversationDetailResponse> {
  return apiRequest<ChatConversationDetailResponse>("/chat/me", {
    auth: true,
    credentials: "include",
    method: "GET",
  });
}

export function getMyChatMessages(): Promise<ChatMessagesResponse> {
  return apiRequest<ChatMessagesResponse>("/chat/me/messages", {
    auth: true,
    credentials: "include",
    method: "GET",
  });
}

export function sendMyChatMessage(body: string): Promise<ChatMessageResponse> {
  return apiRequest<ChatMessageResponse>("/chat/me/messages", {
    auth: true,
    body: { body },
    credentials: "include",
    method: "POST",
  });
}

export function listAdminChatConversations(): Promise<ChatConversationsListResponse> {
  return apiRequest<ChatConversationsListResponse>("/admin/chats", {
    auth: true,
    credentials: "include",
    method: "GET",
  });
}

export function getAdminChatConversation(
  conversationId: string,
): Promise<ChatConversationDetailResponse> {
  return apiRequest<ChatConversationDetailResponse>(
    `/admin/chats/${encodeURIComponent(conversationId)}`,
    {
      auth: true,
      credentials: "include",
      method: "GET",
    },
  );
}

export function sendAdminChatMessage(
  conversationId: string,
  body: string,
): Promise<ChatMessageResponse> {
  return apiRequest<ChatMessageResponse>(
    `/admin/chats/${encodeURIComponent(conversationId)}/messages`,
    {
      auth: true,
      body: { body },
      credentials: "include",
      method: "POST",
    },
  );
}
