"use client";

import {
  AlertCircle,
  Inbox,
  MessageCircle,
  RefreshCw,
  Send,
} from "lucide-react";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { AdminFeedback } from "@/components/admin/AdminCommerceUi";
import { formatAdminDate } from "@/components/admin/admin-format";
import { formatNumber } from "@/components/orders/order-format";
import { requestAdminNavNotificationsRefresh } from "@/features/admin-notifications/events";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { isAdminUser } from "@/features/auth/roles";
import {
  getAdminOperationsTranslations,
  type AdminOperationsTranslations,
} from "@/features/i18n/admin-operations-translations";
import { useI18n } from "@/features/i18n/useI18n";
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
type ChatErrorFallback = "connection" | "load" | "reply";

interface ChatUiError {
  cause: unknown;
  fallback: ChatErrorFallback;
}

export function AdminChatsPage() {
  const { accessToken, currentUser } = useAuthSession();
  const { locale } = useI18n();
  const copy = getAdminOperationsTranslations(locale);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [selectedConversation, setSelectedConversation] =
    useState<ChatConversation>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isListLoading, setIsListLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<ChatUiError>();
  const [socketError, setSocketError] = useState<ChatUiError>();
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
        setError({ cause: loadError, fallback: "load" });
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
        requestAdminNavNotificationsRefresh();
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setSelectedConversation(undefined);
        setMessages([]);
        setError({ cause: loadError, fallback: "load" });
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
      setSocketError({ cause: connectError, fallback: "connection" });
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
        setSocketError({ cause: connectError, fallback: "connection" });
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
        setSocketError({ cause: connectError, fallback: "connection" });
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
        setSocketError({ cause: chatError, fallback: "connection" });
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
            setSocketError({
              cause: response.error,
              fallback: "reply",
            });
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
      setError({ cause: sendError, fallback: "reply" });
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
    copy.chats.customerFallback;
  return (
    <div className="admin-resource admin-resource--full-width admin-chats-page">
      <section className="admin-resource__header" aria-labelledby="admin-chats-heading">
        <div className="admin-page-intro">
          <p className="admin-page-intro__eyebrow">{copy.chats.eyebrow}</p>
          <h1 id="admin-chats-heading">{copy.chats.title}</h1>
          <p>{copy.chats.subtitle}</p>
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
          {copy.common.refresh}
        </button>
      </section>

      {error ? (
        <AdminFeedback message={getChatErrorMessage(error, copy.chats)} tone="error" />
      ) : null}
      {socketError ? (
        <AdminFeedback
          message={getChatErrorMessage(socketError, copy.chats)}
          tone="error"
        />
      ) : null}

      <section className="admin-chats-layout" aria-label={copy.chats.layoutAria}>
        <aside className="admin-chats-list" aria-label={copy.chats.listAria}>
          <div className="admin-chats-list__header">
            <div>
              <strong>{copy.chats.conversations}</strong>
              <span>
                {copy.chats.conversationTotal(formatNumber(conversations.length, locale))}
              </span>
            </div>
          </div>

          <div className="admin-chats-list__body">
            {isListLoading ? <AdminChatListSkeleton /> : null}
            {!isListLoading && conversations.length === 0 ? (
              <AdminChatEmptyList label={copy.chats.emptyList} />
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
                            locale,
                            copy.chats.noActivity,
                          )}
                        </small>
                      </span>
                      <span className="admin-chat-list-item__email">
                        {conversation.customer.email}
                      </span>
                      <span className="admin-chat-list-item__preview">
                        {conversation.lastMessage?.body || copy.chats.emptyPreview}
                      </span>
                      {conversation.unreadCount > 0 ? (
                        <span className="admin-chat-list-item__meta">
                          <span className="admin-chat-list-item__unread">
                            {formatNumber(conversation.unreadCount, locale)}
                          </span>
                        </span>
                      ) : null}
                    </span>
                  </button>
                ))
              : null}
          </div>
        </aside>

        <main className="admin-chat-thread" aria-label={copy.chats.selectedConversationAria}>
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
                    <dt>{locale === "vi" ? "Khách hàng" : "Customer"}</dt>
                    <dd>
                      <span className={`admin-chat-presence admin-chat-presence--${getCustomerPresence(selectedConversation)}`}>
                        {formatCustomerPresence(getCustomerPresence(selectedConversation), locale)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.chats.lastActivity}</dt>
                    <dd>
                      {formatNullableTime(
                        selectedConversation.lastMessageAt ||
                          selectedConversation.updatedAt,
                          locale,
                          copy.chats.noActivity,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>{copy.chats.conversationId}</dt>
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
                    <span>{copy.chats.emptyConversation}</span>
                  </div>
                ) : null}
                {!isDetailLoading
                  ? messages.map((message) => (
                      <AdminChatBubble
                        isAdmin={message.senderRole === "ADMIN"}
                        key={message.id}
                        locale={locale}
                        message={message}
                        copy={copy.chats}
                      />
                    ))
                  : null}
                <div ref={messagesEndRef} />
              </div>

              <form className="admin-chat-composer" onSubmit={handleSend}>
                <label htmlFor="admin-chat-reply">{copy.chats.reply}</label>
                <div className="admin-chat-composer__field">
                  <textarea
                    disabled={isSending || selectedConversation.status === "CLOSED"}
                    id="admin-chat-reply"
                    maxLength={2000}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={handleComposerKeyDown}
                    placeholder={copy.chats.replyPlaceholder}
                    rows={2}
                    value={draft}
                  />
                </div>
                <button
                  aria-label={copy.chats.sendAria}
                  className="admin-chat-composer__send"
                  disabled={
                    !draft.trim() ||
                    isSending ||
                    selectedConversation.status === "CLOSED"
                  }
                  type="submit"
                >
                  <Send aria-hidden="true" size={17} />
                  <span>{isSending ? copy.chats.sending : copy.chats.send}</span>
                </button>
              </form>
            </>
          ) : (
            <div className="admin-chat-thread__empty admin-chat-thread__empty--full">
              {isListLoading ? (
                <span>{copy.chats.loadingConversations}</span>
              ) : (
                <>
                  <Inbox aria-hidden="true" size={30} />
                  <span>{copy.chats.selectConversation}</span>
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
  copy,
  isAdmin,
  locale,
  message,
}: {
  copy: AdminOperationsTranslations["chats"];
  isAdmin: boolean;
  locale: "en" | "vi";
  message: ChatMessage;
}) {
  const isAi = message.senderRole === "AI";

  return (
    <article
      className={`admin-chat-message ${
        isAdmin
          ? "admin-chat-message--admin"
          : isAi
            ? "admin-chat-message--ai"
            : "admin-chat-message--customer"
      }`}
    >
      <div>
        <strong>
          {isAdmin
            ? copy.actorAdmin
            : isAi
              ? "Belikeme AI"
              : message.sender?.name || copy.actorCustomer}
        </strong>
        <time dateTime={message.createdAt}>
          {formatAdminDate(message.createdAt, locale)}
        </time>
      </div>
      <p>{message.body}</p>
    </article>
  );
}

function AdminChatEmptyList({ label }: { label: string }) {
  return (
    <div className="admin-chats-list__empty" role="status">
      <AlertCircle aria-hidden="true" size={18} />
      <span>{label}</span>
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

function getChatErrorMessage(
  error: ChatUiError,
  copy: AdminOperationsTranslations["chats"],
): string {
  const socketError = error.cause as Partial<ChatSocketError> | undefined;
  const code =
    error.cause instanceof ApiClientError
      ? error.cause.code
      : typeof socketError?.code === "string"
        ? socketError.code
        : undefined;
  const mapped = code
    ? copy.errors[code as keyof typeof copy.errors]
    : undefined;

  if (mapped) {
    return mapped;
  }

  if (error.fallback === "reply") {
    return copy.replyError;
  }

  if (error.fallback === "connection") {
    return copy.connectionError;
  }

  return copy.genericError;
}

function formatNullableTime(
  value: string | null | undefined,
  locale: "en" | "vi",
  fallback: string,
): string {
  if (!value) {
    return fallback;
  }

  return formatAdminDate(value, locale);
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

function getCustomerPresence(conversation: ChatConversation): "online" | "offline" {
  const lastActivity = conversation.lastMessageAt || conversation.updatedAt;

  if (!lastActivity) {
    return "offline";
  }

  const lastActivityTime = new Date(lastActivity).getTime();

  if (!Number.isFinite(lastActivityTime)) {
    return "offline";
  }

  return Date.now() - lastActivityTime <= 5 * 60 * 1000 ? "online" : "offline";
}

function formatCustomerPresence(
  presence: "online" | "offline",
  locale: "en" | "vi",
): string {
  if (locale === "vi") {
    return presence === "online" ? "Đang online" : "Đang offline";
  }

  return presence === "online" ? "Online" : "Offline";
}
