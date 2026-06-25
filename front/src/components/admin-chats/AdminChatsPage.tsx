"use client";

import {
  AlertCircle,
  Inbox,
  MessageCircle,
  RefreshCw,
  Send,
  WifiOff,
} from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { AdminFeedback } from "@/components/admin/AdminCommerceUi";
import { formatAdminDate } from "@/components/admin/admin-format";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { isAdminUser } from "@/features/auth/roles";
import {
  getAdminChatConversation,
  listAdminChatConversations,
  sendAdminChatMessage,
} from "@/features/chat/api";
import {
  createChatSocket,
  type ChatSocket,
  type ChatSocketAck,
} from "@/features/chat/socket";
import type {
  ChatConversation,
  ChatMessage,
  ChatMessageResponse,
  ChatSocketError,
} from "@/features/chat/types";
import { ApiClientError } from "@/lib/errors/api-error";

type ConnectionState = "connected" | "connecting" | "offline";

export function AdminChatsPage() {
  const { accessToken, currentUser } = useAuthSession();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedConversation, setSelectedConversation] =
    useState<ChatConversation>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isListLoading, setIsListLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>();
  const [socketError, setSocketError] = useState<string>();
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("offline");
  const [refreshKey, setRefreshKey] = useState(0);
  const socketRef = useRef<ChatSocket | undefined>(undefined);
  const selectedIdRef = useRef<string | undefined>(undefined);
  const messagesViewportRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldStickToLatestRef = useRef(true);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    shouldStickToLatestRef.current = true;
  }, [selectedId]);

  useEffect(() => {
    if (!shouldStickToLatestRef.current) {
      return;
    }

    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, selectedId, isDetailLoading]);

  useEffect(() => {
    let isMounted = true;

    async function loadConversations() {
      setIsListLoading(true);
      setError(undefined);

      try {
        const response = await listAdminChatConversations();

        if (!isMounted) {
          return;
        }

        setConversations(response.conversations);
        setSelectedId((current) => current ?? response.conversations[0]?.id);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setConversations([]);
        setError(getChatErrorMessage(loadError));
      } finally {
        if (isMounted) {
          setIsListLoading(false);
        }
      }
    }

    void loadConversations();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedConversation(undefined);
      setMessages([]);
      return;
    }

    let isMounted = true;
    const activeConversationId = selectedId;

    async function loadDetail() {
      setIsDetailLoading(true);
      setError(undefined);

      try {
        const response = await getAdminChatConversation(activeConversationId);

        if (!isMounted) {
          return;
        }

        const conversation = {
          ...response.conversation,
          unreadCount: 0,
        };

        setSelectedConversation(conversation);
        setMessages(response.messages);
        setConversations((current) => upsertConversation(current, conversation));
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setSelectedConversation(undefined);
        setMessages([]);
        setError(getChatErrorMessage(loadError));
      } finally {
        if (isMounted) {
          setIsDetailLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      isMounted = false;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!isAdminUser(currentUser)) {
      socketRef.current?.disconnect();
      socketRef.current = undefined;
      setConnectionState("offline");
      return;
    }

    let isMounted = true;
    let socket: ChatSocket | undefined;
    const activeAccessToken = accessToken;

    try {
      socket = createChatSocket(activeAccessToken);
      socketRef.current = socket;
      setConnectionState("connecting");
    } catch (connectError) {
      setSocketError(getChatErrorMessage(connectError));
      setConnectionState("offline");
      return;
    }

    socket.on("connect", () => {
      if (isMounted) {
        setConnectionState("connected");
        setSocketError(undefined);
      }
    });
    socket.on("disconnect", () => {
      if (isMounted) {
        setConnectionState("offline");
      }
    });
    socket.on("connect_error", (connectError) => {
      if (isMounted) {
        setConnectionState("offline");
        setSocketError(getChatErrorMessage(connectError));
      }
    });
    socket.io.on("reconnect_attempt", () => {
      if (isMounted) {
        setConnectionState("connecting");
      }
    });
    socket.io.on("reconnect_error", (connectError) => {
      if (isMounted) {
        setConnectionState("offline");
        setSocketError(getChatErrorMessage(connectError));
      }
    });
    socket.io.on("reconnect", () => {
      if (isMounted) {
        setConnectionState("connected");
        setRefreshKey((current) => current + 1);
      }
    });
    socket.on("chat:conversationUpdated", (conversation) => {
      if (!isMounted) {
        return;
      }

      const isSelectedConversation = selectedIdRef.current === conversation.id;
      const nextConversation = isSelectedConversation
        ? { ...conversation, unreadCount: 0 }
        : conversation;

      setConversations((current) => upsertConversation(current, nextConversation));

      if (isSelectedConversation) {
        setSelectedConversation((current) => ({
          ...(current ?? nextConversation),
          ...nextConversation,
          unreadCount: 0,
        }));
      }
    });
    socket.on("chat:message", (message) => {
      if (!isMounted || selectedIdRef.current !== message.conversationId) {
        return;
      }

      setMessages((current) => appendMessage(current, message));
    });
    socket.on("chat:error", (chatError) => {
      if (isMounted) {
        setSocketError(chatError.message);
      }
    });

    return () => {
      isMounted = false;
      socket?.disconnect();
      socketRef.current = undefined;
    };
  }, [accessToken, currentUser]);

  useEffect(() => {
    const socket = socketRef.current;

    if (!selectedId || !socket || !socket.connected) {
      return;
    }

    socket.emit("chat:joinConversation", { conversationId: selectedId });

    return () => {
      socket.emit("chat:leaveConversation", { conversationId: selectedId });
    };
  }, [connectionState, selectedId]);

  async function sendReply() {
    const body = draft.trim();
    const activeConversationId = selectedId;

    if (
      !activeConversationId ||
      !body ||
      isSending ||
      selectedConversation?.status === "CLOSED"
    ) {
      return;
    }

    setIsSending(true);
    setError(undefined);
    setSocketError(undefined);

    const activeSocket = socketRef.current;

    if (activeSocket?.connected) {
      setDraft("");
      activeSocket.emit(
        "chat:send",
        { body, conversationId: activeConversationId },
        (response?: ChatSocketAck<ChatMessageResponse>) => {
          setIsSending(false);

          if (!response) {
            return;
          }

          if (!response.ok) {
            setSocketError(response.error?.message || "Reply could not be sent.");
            setDraft(body);
            return;
          }

          if (response.data) {
            setSelectedConversation(response.data.conversation);
            setConversations((current) =>
              upsertConversation(current, response.data!.conversation),
            );
            setMessages((current) =>
              appendMessage(current, response.data?.message),
            );
          }
        },
      );
      return;
    }

    try {
      const response = await sendAdminChatMessage(activeConversationId, body);

      setDraft("");
      setSelectedConversation(response.conversation);
      setConversations((current) =>
        upsertConversation(current, response.conversation),
      );
      setMessages((current) => appendMessage(current, response.message));
    } catch (sendError) {
      setError(getChatErrorMessage(sendError));
    } finally {
      setIsSending(false);
    }
  }

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendReply();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") {
      return;
    }

    if (event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    void sendReply();
  }

  function handleMessagesScroll() {
    const viewport = messagesViewportRef.current;

    if (!viewport) {
      return;
    }

    const distanceFromBottom =
      viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;

    shouldStickToLatestRef.current = distanceFromBottom < 96;
  }

  const selectedCustomerLabel =
    selectedConversation?.customer.name ||
    selectedConversation?.customer.email ||
    "Customer";
  const connectionLabel =
    connectionState === "connected"
      ? "ONLINE"
      : connectionState === "connecting"
        ? "CONNECTING"
        : "OFFLINE";

  return (
    <div className="admin-resource admin-resource--full-width admin-chats-page">
      <section className="admin-resource__header" aria-labelledby="admin-chats-heading">
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">SUPPORT INBOX</p>
          <h1 id="admin-chats-heading">Chats</h1>
          <p>Reply to customer questions about orders, sizing, and delivery.</p>
        </div>
        <button
          className="button button--secondary"
          disabled={isListLoading}
          onClick={() => setRefreshKey((current) => current + 1)}
          type="button"
        >
          <RefreshCw
            aria-hidden="true"
            className={isListLoading ? "spin" : undefined}
            size={17}
          />
          Refresh
        </button>
      </section>

      {error ? <AdminFeedback message={error} tone="error" /> : null}
      {socketError ? <AdminFeedback message={socketError} tone="error" /> : null}

      <section className="admin-chats-layout" aria-label="Customer support chats">
        <aside className="admin-chats-list" aria-label="Conversations">
          <div className="admin-chats-list__header">
            <div>
              <strong>Conversations</strong>
              <span>{conversations.length} total</span>
            </div>
            <span
              className={`admin-chats-connection admin-chats-connection--${connectionState}`}
            >
              {connectionState === "offline" ? (
                <WifiOff aria-hidden="true" size={13} />
              ) : null}
              {connectionLabel}
            </span>
          </div>

          <div className="admin-chats-list__body">
            {isListLoading ? <AdminChatListSkeleton /> : null}
            {!isListLoading && conversations.length === 0 ? (
              <AdminChatEmptyList />
            ) : null}
            {!isListLoading
              ? conversations.map((conversation) => (
                  <button
                    aria-current={
                      selectedId === conversation.id ? "true" : undefined
                    }
                    className={`admin-chat-list-item ${
                      selectedId === conversation.id ? "is-active" : ""
                    }`}
                    key={conversation.id}
                    onClick={() => setSelectedId(conversation.id)}
                    type="button"
                  >
                    <span
                      aria-hidden="true"
                      className="admin-chat-list-item__avatar"
                    >
                      {getCustomerInitials(conversation.customer.name, conversation.customer.email)}
                    </span>
                    <span className="admin-chat-list-item__content">
                      <span className="admin-chat-list-item__topline">
                        <strong>
                          {conversation.customer.name ||
                            conversation.customer.email}
                        </strong>
                        <small>
                          {formatNullableTime(
                            conversation.lastMessageAt || conversation.updatedAt,
                          )}
                        </small>
                      </span>
                      <span className="admin-chat-list-item__email">
                        {conversation.customer.email}
                      </span>
                      <span className="admin-chat-list-item__preview">
                        {conversation.lastMessage?.body || "No messages yet."}
                      </span>
                      <span className="admin-chat-list-item__meta">
                        <span
                          className={`admin-chat-status admin-chat-status--${conversation.status.toLowerCase()}`}
                        >
                          {conversation.status}
                        </span>
                        {conversation.unreadCount > 0 ? (
                          <span className="admin-chat-list-item__unread">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                ))
              : null}
          </div>
        </aside>

        <main className="admin-chat-thread" aria-label="Selected conversation">
          {selectedConversation ? (
            <>
              <header className="admin-chat-thread__header">
                <div className="admin-chat-thread__identity">
                  <span aria-hidden="true" className="admin-chat-thread__avatar">
                    {getCustomerInitials(
                      selectedConversation.customer.name,
                      selectedConversation.customer.email,
                    )}
                  </span>
                  <div>
                  <h2>{selectedCustomerLabel}</h2>
                    <span>{selectedConversation.customer.email}</span>
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      <span
                        className={`admin-chat-status admin-chat-status--${selectedConversation.status.toLowerCase()}`}
                      >
                        {selectedConversation.status}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Last activity</dt>
                    <dd>
                      {formatNullableTime(
                        selectedConversation.lastMessageAt ||
                          selectedConversation.updatedAt,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>ID</dt>
                    <dd>{formatConversationId(selectedConversation.id)}</dd>
                  </div>
                </dl>
              </header>

              <div
                className="admin-chat-thread__messages"
                onScroll={handleMessagesScroll}
                ref={messagesViewportRef}
                role="log"
              >
                {isDetailLoading ? <AdminChatMessageSkeleton /> : null}
                {!isDetailLoading && messages.length === 0 ? (
                  <div className="admin-chat-thread__empty" role="status">
                    <MessageCircle aria-hidden="true" size={28} />
                    <span>No messages in this conversation yet.</span>
                  </div>
                ) : null}
                {!isDetailLoading
                  ? messages.map((message) => (
                      <AdminChatBubble
                        isAdmin={message.senderRole === "ADMIN"}
                        key={message.id}
                        message={message}
                      />
                    ))
                  : null}
                <div ref={messagesEndRef} />
              </div>

              <form className="admin-chat-composer" onSubmit={handleSend}>
                <label htmlFor="admin-chat-reply">Reply</label>
                <div className="admin-chat-composer__field">
                  <textarea
                    disabled={isSending || selectedConversation.status === "CLOSED"}
                    id="admin-chat-reply"
                    maxLength={2000}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder="Type your reply..."
                    rows={2}
                    value={draft}
                  />
                </div>
                <button
                  aria-label="Send reply"
                  className="admin-chat-composer__send"
                  disabled={
                    !draft.trim() ||
                    isSending ||
                    selectedConversation.status === "CLOSED"
                  }
                  type="submit"
                >
                  <Send aria-hidden="true" size={17} />
                  <span>{isSending ? "Sending" : "Send"}</span>
                </button>
              </form>
            </>
          ) : (
            <div className="admin-chat-thread__empty admin-chat-thread__empty--full">
              {isListLoading ? (
                <span>Loading conversations.</span>
              ) : (
                <>
                  <Inbox aria-hidden="true" size={30} />
                  <span>Select a conversation to start replying.</span>
                </>
              )}
            </div>
          )}
        </main>
      </section>
    </div>
  );
}

function AdminChatBubble({
  isAdmin,
  message,
}: {
  isAdmin: boolean;
  message: ChatMessage;
}) {
  return (
    <article
      className={`admin-chat-message ${
        isAdmin ? "admin-chat-message--admin" : "admin-chat-message--customer"
      }`}
    >
      <div>
        <strong>{isAdmin ? "Admin" : message.sender.name || "Customer"}</strong>
        <time dateTime={message.createdAt}>{formatAdminDate(message.createdAt)}</time>
      </div>
      <p>{message.body}</p>
    </article>
  );
}

function AdminChatEmptyList() {
  return (
    <div className="admin-chats-list__empty" role="status">
      <AlertCircle aria-hidden="true" size={18} />
      <span>No customer conversations yet.</span>
    </div>
  );
}

function AdminChatListSkeleton() {
  return (
    <div className="admin-chats-list__skeleton" role="status">
      {Array.from({ length: 5 }, (_, index) => (
        <span aria-hidden="true" className="admin-skeleton-line" key={index} />
      ))}
    </div>
  );
}

function AdminChatMessageSkeleton() {
  return (
    <div className="admin-chat-thread__skeleton" role="status">
      {Array.from({ length: 4 }, (_, index) => (
        <span
          aria-hidden="true"
          className={`admin-chat-message admin-chat-message--skeleton ${
            index % 2 === 0
              ? "admin-chat-message--customer"
              : "admin-chat-message--admin"
          }`}
          key={index}
        />
      ))}
    </div>
  );
}

function upsertConversation(
  current: ChatConversation[],
  conversation: ChatConversation,
): ChatConversation[] {
  const next = current.some((item) => item.id === conversation.id)
    ? current.map((item) => (item.id === conversation.id ? conversation : item))
    : [conversation, ...current];

  return next.sort((left, right) => {
    const leftDate = left.lastMessageAt || left.updatedAt;
    const rightDate = right.lastMessageAt || right.updatedAt;

    return new Date(rightDate).getTime() - new Date(leftDate).getTime();
  });
}

function appendMessage(
  current: ChatMessage[],
  message: ChatMessage | undefined,
): ChatMessage[] {
  if (!message || current.some((item) => item.id === message.id)) {
    return current;
  }

  return [...current, message].sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

function getChatErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  const socketError = error as Partial<ChatSocketError>;

  if (typeof socketError?.message === "string") {
    return socketError.message;
  }

  return "Chats could not be loaded right now.";
}

function formatNullableTime(value: string | null | undefined): string {
  if (!value) {
    return "No activity";
  }

  return formatAdminDate(value);
}

function getCustomerInitials(name: string | null | undefined, email: string): string {
  const source = name || email;
  const words = source
    .replace(/@.*/, "")
    .split(/[\s._-]+/)
    .filter(Boolean);

  if (words.length === 0) {
    return "C";
  }

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function formatConversationId(id: string): string {
  return `#${id.slice(0, 8).toUpperCase()}`;
}
