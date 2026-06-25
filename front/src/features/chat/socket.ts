import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "@/config/env";
import { ApiClientError } from "@/lib/errors/api-error";
import type {
  ChatConversation,
  ChatMessage,
  ChatMessageResponse,
  ChatSocketError,
} from "@/features/chat/types";

export interface ServerToClientChatEvents {
  "chat:conversationUpdated": (conversation: ChatConversation) => void;
  "chat:error": (error: ChatSocketError) => void;
  "chat:message": (message: ChatMessage) => void;
}

export interface ClientToServerChatEvents {
  "chat:joinConversation": (
    payload: { conversationId: string },
    callback?: (response: ChatSocketAck) => void,
  ) => void;
  "chat:leaveConversation": (
    payload: { conversationId: string },
    callback?: (response: ChatSocketAck) => void,
  ) => void;
  "chat:send": (
    payload: { body: string; conversationId?: string },
    callback?: (response: ChatSocketAck<ChatMessageResponse>) => void,
  ) => void;
}

export interface ChatSocketAck<T = unknown> {
  data?: T;
  error?: ChatSocketError;
  ok: boolean;
}

export type ChatSocket = Socket<
  ServerToClientChatEvents,
  ClientToServerChatEvents
>;

export function createChatSocket(accessToken: string): ChatSocket {
  if (!API_BASE_URL) {
    throw new ApiClientError(
      "Belikeme API is not configured. Set NEXT_PUBLIC_API_BASE_URL and try again.",
      "API_BASE_URL_MISSING",
    );
  }

  return io(`${API_BASE_URL}/chat`, {
    auth: {
      token: accessToken,
    },
    withCredentials: true,
  });
}
