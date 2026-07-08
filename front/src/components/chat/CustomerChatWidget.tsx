"use client";

import { MessageCircle, WifiOff, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiMessageBubble, type AiMessageTone } from "@/components/chat/AiMessageBubble";
import { AiTypingIndicator } from "@/components/chat/AiTypingIndicator";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatMessage as ChatMessageBubble } from "@/components/chat/ChatMessage";
import { ReturnRequestModal } from "@/components/returns/ReturnRequestModal";
import { useAiSupport } from "@/features/ai/supportHooks";
import type {
  SupportOrderCard,
  SupportRequest,
  SupportReturnRequestCard,
  SupportResponse,
} from "@/features/ai/supportTypes";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { isAdminUser } from "@/features/auth/roles";
import { getMyChat, sendMyChatMessage } from "@/features/chat/api";
import { listMyReturnRequests } from "@/features/returns/api";
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

interface LocalChatMessage {
  body: string;
  createdAt: string;
  id: string;
  kind: "ai" | "customer";
  messageType?: SupportResponse["type"];
  order?: SupportOrderCard;
  orders?: SupportOrderCard[];
  returnRequest?: SupportReturnRequestCard;
  returnRequests?: SupportReturnRequestCard[];
  showDayLabel?: boolean;
  status?: string;
  statusDetail?: string;
  tone?: AiMessageTone;
  welcome?: boolean;
}

type TimelineMessage =
  | { createdAt: string; id: string; kind: "persisted"; message: ChatMessage }
  | { createdAt: string; id: string; kind: "local"; message: LocalChatMessage };

interface PendingForward {
  body: string;
  localMessageId: string;
}

const CUSTOMER_CHAT_HIDDEN_PREFIXES = [
  "/admin",
  "/login",
  "/register",
  "/forgot-password",
] as const;

const ORDER_DETAIL_PATH_PATTERN =
  /^\/orders\/(BK\d{6,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;
const ORDER_DETAIL_URL_PATTERN =
  /^\/orders\/(?:BK\d{6,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const SUPPORT_ORDER_CARD_STATUSES = new Set([
  "PENDING_PAYMENT",
  "PAID",
  "PICKED_UP",
  "IN_TRANSIT",
  "OUT_FOR_DELIVERY",
]);
const SUPPORTED_AI_MESSAGE_TYPES = new Set<NonNullable<SupportResponse["type"]>>([
  "text",
  "single_order_card",
  "order_cards",
  "return_request_card",
  "conversation_memory",
]);
const LEGACY_UNSUPPORTED_AI_MESSAGE_TYPES = new Set([
  "size_recommendation",
  "comparison_card",
]);
const LEGACY_UNSUPPORTED_AI_MESSAGE =
  "Belikeme AI Support: This older AI message used a feature that is no longer available. You can keep chatting here for product questions, order tracking, returns, or human support.";

const CUSTOMER_CHAT_WELCOME_MESSAGE = `Hi

I'm Belikeme AI.

I can help you with:

- outfit suggestions
- products
- order status
- shipping

If I can't solve it,

I'll connect you with our team.`;

const AI_UNAVAILABLE_MESSAGE = `AI is temporarily unavailable.

You can continue chatting with our support team.`;

const OUT_OF_SCOPE_MESSAGE = `Sorry,

I can only help with Belikeme shopping,

orders,

products,

and shipping.`;

const CUSTOMER_CHAT_QUICK_ACTIONS = [
  {
    label: "Track Order",
    message: "I need help tracking my order.",
    action: "TRACK_ORDER",
  },
  {
    label: "Request Return",
    message: "I want to return my order.",
    action: "RETURN_REQUEST",
  },
] as const;

let localMessageSequence = 0;

export function CustomerChatWidget() {
  const pathname = usePathname() || "/";
  const {
    accessToken,
    currentUser,
    isAuthenticated,
    isLoading: isSessionLoading,
  } = useAuthSession();
  const { ask: askAiSupport, isLoading: isAiTyping } = useAiSupport();
  const isAdmin = isAdminUser(currentUser);
  const shouldHide = CUSTOMER_CHAT_HIDDEN_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState<ChatConversation>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [localMessages, setLocalMessages] = useState<LocalChatMessage[]>([]);
  const [forwardedPersistedIds, setForwardedPersistedIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [draft, setDraft] = useState("");
  const [draftAction, setDraftAction] = useState<SupportRequest["action"]>();
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingRealtime, setIsSendingRealtime] = useState(false);
  const [error, setError] = useState<string>();
  const [unreadAdminCount, setUnreadAdminCount] = useState(0);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("offline");
  const [selectedReturnOrder, setSelectedReturnOrder] =
    useState<SupportReturnRequestCard>();
  const isOpenRef = useRef(isOpen);
  const pendingForwardRef = useRef<PendingForward | undefined>(undefined);
  const isSubmissionPendingRef = useRef(false);
  const socketRef = useRef<ChatSocket | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeCustomerId = currentUser?.id;
  const activeCustomerIdRef = useRef(activeCustomerId);
  activeCustomerIdRef.current = activeCustomerId;
  const isSending = isAiTyping || isSendingRealtime;

  useEffect(() => {
    setConversation(undefined);
    setMessages([]);
    setLocalMessages([]);
    setForwardedPersistedIds(new Set());
    setDraft("");
    setError(undefined);
    setSelectedReturnOrder(undefined);
    pendingForwardRef.current = undefined;
    isSubmissionPendingRef.current = false;
  }, [activeCustomerId]);

  useEffect(() => {
    isOpenRef.current = isOpen;

    if (isOpen) {
      setUnreadAdminCount(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !isAuthenticated || isAdmin) {
      return;
    }

    setLocalMessages((current) => {
      if (current.some((message) => message.welcome)) {
        return current;
      }

      return [
        ...current,
        createLocalMessage("ai", CUSTOMER_CHAT_WELCOME_MESSAGE, {
          showDayLabel: true,
          welcome: true,
        }),
      ];
    });
  }, [isAdmin, isAuthenticated, isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [isAiTyping, isLoading, isOpen, localMessages, messages]);

  useEffect(() => {
    if (!isOpen || !isAuthenticated || isAdmin) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    async function loadHistory() {
      setIsLoading(true);
      setError(undefined);

      try {
        const [response, returnsResponse] = await Promise.all([
          getMyChat(),
          listMyReturnRequests().catch(() => ({ returnRequests: [] })),
        ]);

        if (!isMounted) {
          return;
        }

        setConversation(response.conversation);
        const returnStatuses = new Map<string, "PENDING" | "APPROVED">();

        for (const request of returnsResponse.returnRequests) {
          if (request.status === "PENDING" || request.status === "APPROVED") {
            returnStatuses.set(request.orderCode, request.status);
          }
        }

        setMessages(
          response.messages.map((message) =>
            applyReturnStatusesToAiMessage(message, returnStatuses),
          ),
        );
        setUnreadAdminCount(0);
      } catch (loadError) {
        if (!isMounted) {
          return;
        }

        setError(getChatErrorMessage(loadError));
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadHistory();

    return () => {
      isMounted = false;
    };
  }, [isAdmin, isAuthenticated, isOpen]);

  useEffect(() => {
    if (!isAuthenticated || isAdmin) {
      socketRef.current?.disconnect();
      socketRef.current = undefined;
      setConnectionState("offline");
      return;
    }

    let isMounted = true;
    let socket: ChatSocket | undefined;
    const activeAccessToken = accessToken;

    function connectSocket() {
      try {
        socket = createChatSocket(activeAccessToken);
        socketRef.current = socket;
        setConnectionState("connecting");
      } catch (socketError) {
        setError(getChatErrorMessage(socketError));
        setConnectionState("offline");
        return;
      }

      socket.on("connect", () => {
        if (isMounted) {
          setConnectionState("connected");
          setError(undefined);
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
          setError(getChatErrorMessage(connectError));
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
          setError(getChatErrorMessage(connectError));
        }
      });
      socket.io.on("reconnect", () => {
        if (isMounted) {
          setConnectionState("connected");
        }
      });
      socket.on("chat:conversationUpdated", (nextConversation) => {
        if (isMounted) {
          setConversation(nextConversation);
        }
      });
      socket.on("chat:message", (message) => {
        if (!isMounted) {
          return;
        }

        const pendingForward = pendingForwardRef.current;

        if (
          pendingForward &&
          message.senderRole === "CUSTOMER" &&
          message.body === pendingForward.body
        ) {
          markMessageAsForwarded(message.id, setForwardedPersistedIds);
        }

        setMessages((current) => {
          const alreadyExists = current.some((item) => item.id === message.id);

          if (
            !alreadyExists &&
            shouldCountCustomerUnread(message, isOpenRef.current)
          ) {
            setUnreadAdminCount((count) => count + 1);
          }

          return appendMessage(current, message);
        });
      });
      socket.on("chat:error", (socketError) => {
        if (isMounted) {
          setError(socketError.message);
        }
      });
    }

    connectSocket();

    return () => {
      isMounted = false;
      socket?.disconnect();
      socketRef.current = undefined;
    };
  }, [accessToken, isAdmin, isAuthenticated]);

  const connectionLabel = useMemo(() => {
    if (connectionState === "connected") {
      return "Online • Usually responds in minutes";
    }

    if (connectionState === "connecting") {
      return "Reconnecting • Usually responds in minutes";
    }

    return "Offline • We will reconnect shortly";
  }, [connectionState]);

  const timeline = useMemo(
    () => buildTimeline(messages, localMessages, forwardedPersistedIds),
    [forwardedPersistedIds, localMessages, messages],
  );

  if (shouldHide || isAdmin || isSessionLoading) {
    return null;
  }

  async function sendMessage() {
    const body = draft.trim();
    const action = draftAction;

    if (
      !body ||
      !isAuthenticated ||
      isSending ||
      isSubmissionPendingRef.current
    ) {
      return;
    }

    isSubmissionPendingRef.current = true;
    setError(undefined);

    try {
      setDraft("");
      setDraftAction(undefined);
      const customerMessage = createLocalMessage("customer", body);
      const requestCustomerId = activeCustomerId;
      setLocalMessages((current) => [...current, customerMessage]);

      try {
        const orderId = getOrderIdFromPathname(pathname);
        const response = await askAiSupport({
          message: body,
          ...(action ? { action } : {}),
          ...(orderId ? { orderId } : {}),
        });

        if (activeCustomerIdRef.current !== requestCustomerId) {
          return;
        }

        if (!isValidSupportResponse(response)) {
          throw new Error("Invalid AI support response");
        }

        const isOutOfScope = isOutOfScopeResponse(response);
        const needsHandoff = !isOutOfScope && isHandoffResponse(response);
        const hasPersistedHistory = syncPersistedAiHistory(
          response,
          customerMessage.id,
        );

        if (isOutOfScope) {
          if (!hasPersistedHistory) {
            addAiMessage(OUT_OF_SCOPE_MESSAGE, "out-of-scope");
          }
          return;
        }

        if (needsHandoff) {
          const isOrderContextRequired =
            response.handoff?.reason?.toUpperCase() ===
            "ORDER_CONTEXT_REQUIRED";

          if (!hasPersistedHistory) {
            addAiMessage(
              response.answer,
              "handoff",
              isOrderContextRequired
                ? {}
                : {
                    status:
                      "This conversation has been forwarded to Belikeme Support.",
                    statusDetail: "Waiting for an available specialist...",
                  },
            );
          }

          if (!hasPersistedHistory && !isOrderContextRequired) {
            await forwardToHumanSupport(body, customerMessage.id);
          }

          return;
        }

        if (!hasPersistedHistory) {
          addAiMessage(response.answer, "answer", {
            messageType: response.type ?? "text",
            order: response.order,
            orders: response.orders,
            returnRequest: response.returnRequest,
            returnRequests:
              response.returnRequests ??
              (response.returnRequest ? [response.returnRequest] : undefined),
          });
        }
      } catch {
        if (activeCustomerIdRef.current !== requestCustomerId) {
          return;
        }

        addAiMessage(AI_UNAVAILABLE_MESSAGE, "error");
        await forwardToHumanSupport(body, customerMessage.id);
      }
    } finally {
      isSubmissionPendingRef.current = false;
    }
  }

  function syncPersistedAiHistory(
    response: SupportResponse,
    localCustomerMessageId: string,
  ): boolean {
    const persistedMessages = response.history?.messages;

    if (!persistedMessages?.length) {
      return false;
    }

    setLocalMessages((current) =>
      current.filter((message) => message.id !== localCustomerMessageId),
    );
    setMessages((current) =>
      persistedMessages.reduce(appendMessage, current),
    );

    return true;
  }

  async function forwardToHumanSupport(body: string, localMessageId: string) {
    pendingForwardRef.current = { body, localMessageId };

    try {
      await sendRealtimeMessage(body, {
        forwardedLocalMessageId: localMessageId,
        restoreDraftOnFailure: false,
      });
    } finally {
      pendingForwardRef.current = undefined;
    }
  }

  async function sendRealtimeMessage(
    body: string,
    options: {
      forwardedLocalMessageId?: string;
      restoreDraftOnFailure: boolean;
    },
  ): Promise<void> {
    setIsSendingRealtime(true);
    const activeSocket = socketRef.current;

    if (!options.forwardedLocalMessageId) {
      setDraft("");
    }

    if (activeSocket?.connected) {
      await new Promise<void>((resolve) => {
        activeSocket.emit(
          "chat:send",
          { body },
          (response?: ChatSocketAck<ChatMessageResponse>) => {
            setIsSendingRealtime(false);

            if (!response) {
              setError("Message could not be sent.");

              if (options.restoreDraftOnFailure) {
                setDraft(body);
              }

              resolve();
              return;
            }

            if (!response.ok) {
              setError(response.error?.message || "Message could not be sent.");

              if (options.restoreDraftOnFailure) {
                setDraft(body);
              }

              resolve();
              return;
            }

            if (response.data) {
              setConversation(response.data.conversation);
              setMessages((current) =>
                appendMessage(current, response.data?.message),
              );

              if (options.forwardedLocalMessageId) {
                markMessageAsForwarded(
                  response.data.message.id,
                  setForwardedPersistedIds,
                );
              }
            }

            resolve();
          },
        );
      });
      return;
    }

    try {
      const response = await sendMyChatMessage(body);

      setConversation(response.conversation);
      setMessages((current) => appendMessage(current, response.message));

      if (options.forwardedLocalMessageId) {
        markMessageAsForwarded(response.message.id, setForwardedPersistedIds);
      }
    } catch (sendError) {
      setError(getChatErrorMessage(sendError));

      if (options.restoreDraftOnFailure) {
        setDraft(body);
      }
    } finally {
      setIsSendingRealtime(false);
    }
  }

  function addAiMessage(
    body: string,
    tone: AiMessageTone,
    details: Pick<
      LocalChatMessage,
      | "messageType"
      | "order"
      | "orders"
      | "returnRequest"
      | "returnRequests"
      | "status"
      | "statusDetail"
    > = {},
  ) {
    setLocalMessages((current) => [
      ...current,
      createLocalMessage("ai", body, { ...details, tone }),
    ]);
  }

  function handleQuickAction(
    action: (typeof CUSTOMER_CHAT_QUICK_ACTIONS)[number],
  ) {
    setDraft(action.message);
    setDraftAction("action" in action ? action.action : undefined);
    textareaRef.current?.focus();
  }

  return (
    <div className="customer-chat-widget">
      {isOpen ? (
        <section
          aria-label="Belikeme Support"
          className="customer-chat-panel"
          role="dialog"
        >
          <header className="customer-chat-panel__header">
            <div className="customer-chat-panel__identity">
              <div aria-hidden="true" className="customer-chat-panel__avatar">
                B
                <span />
              </div>
              <div>
                <h2>Belikeme Support</h2>
                <span
                  className={`customer-chat-panel__status customer-chat-panel__status--${connectionState}`}
                >
                  {isAuthenticated && connectionState === "offline" ? (
                    <WifiOff aria-hidden="true" size={13} />
                  ) : null}
                  {isAuthenticated
                    ? connectionLabel
                    : "Sign in to start a conversation"}
                </span>
              </div>
            </div>
            <div className="customer-chat-panel__controls">
              <button
                aria-label="Close support chat"
                className="customer-chat-panel__control"
                onClick={() => setIsOpen(false)}
                title="Close support chat"
                type="button"
              >
                <X aria-hidden="true" size={18} />
              </button>
            </div>
          </header>

          <div className="customer-chat-panel__body">
            {!isAuthenticated ? (
              <div className="customer-chat-panel__sign-in">
                <div aria-hidden="true" className="customer-chat-panel__sign-in-icon">
                  <MessageCircle size={25} />
                </div>
                <h3>We&apos;re here to help</h3>
                <p>
                  Sign in to chat with Belikeme AI and our customer support team.
                </p>
                <Link href={`/login?next=${encodeURIComponent(pathname)}`}>
                  Sign in to chat
                </Link>
              </div>
            ) : isLoading ? (
              <ChatMessageSkeleton />
            ) : (
              <div
                aria-live="polite"
                className="customer-chat-messages"
                role="log"
              >
                {timeline.map((item) => {
                  if (item.kind === "persisted") {
                    const aiResponse = getPersistedAiResponse(item.message);

                    if (aiResponse) {
                      const requiresHuman = isHandoffResponse(aiResponse);
                      const requiresOrderContext =
                        aiResponse.handoff?.reason?.toUpperCase() ===
                        "ORDER_CONTEXT_REQUIRED";

                      return (
                        <AiMessageBubble
                          body={item.message.body}
                          createdAt={item.message.createdAt}
                          key={item.id}
                          messageType={aiResponse.type ?? "text"}
                          onRequestReturn={setSelectedReturnOrder}
                          order={aiResponse.order}
                          orders={aiResponse.orders}
                          returnRequest={aiResponse.returnRequest}
                          returnRequests={aiResponse.returnRequests}
                          status={
                            requiresHuman && !requiresOrderContext
                              ? "This conversation has been forwarded to Belikeme Support."
                              : undefined
                          }
                          statusDetail={
                            requiresHuman && !requiresOrderContext
                              ? "Waiting for an available specialist..."
                              : undefined
                          }
                          tone={
                            isOutOfScopeResponse(aiResponse)
                              ? "out-of-scope"
                              : requiresHuman
                                ? "handoff"
                                : "answer"
                          }
                        />
                      );
                    }

                    return (
                      <ChatMessageBubble key={item.id} message={item.message} />
                    );
                  }

                  if (item.message.kind === "customer") {
                    return (
                      <ChatMessageBubble
                        body={item.message.body}
                        createdAt={item.message.createdAt}
                        isOwn
                        key={item.id}
                      />
                    );
                  }

                  return (
                    <AiMessageBubble
                      body={item.message.body}
                      createdAt={item.message.createdAt}
                      key={item.id}
                      messageType={item.message.messageType}
                      onRequestReturn={setSelectedReturnOrder}
                      order={item.message.order}
                      orders={item.message.orders}
                      returnRequest={item.message.returnRequest}
                      returnRequests={item.message.returnRequests}
                      showDayLabel={item.message.showDayLabel}
                      status={item.message.status}
                      statusDetail={item.message.statusDetail}
                      tone={item.message.tone}
                    />
                  );
                })}
                {isAiTyping ? <AiTypingIndicator /> : null}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {isAuthenticated && error ? (
            <div className="customer-chat-panel__error" role="alert">
              {error}
            </div>
          ) : null}

          {isAuthenticated ? (
            <>
              <div
                aria-label="Quick messages"
                className="customer-chat-quick-actions"
                role="group"
              >
                {CUSTOMER_CHAT_QUICK_ACTIONS.map((action) => (
                  <button
                    className="customer-chat-quick-actions__chip"
                    disabled={isSending}
                    key={action.label}
                    onClick={() => handleQuickAction(action)}
                    type="button"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
              <ChatComposer
                draft={draft}
                isSending={isSending}
                maxLength={800}
                onDraftChange={(value) => {
                  setDraft(value);
                  setDraftAction(undefined);
                }}
                onSend={() => void sendMessage()}
                textareaRef={textareaRef}
              />
            </>
          ) : null}
        </section>
      ) : null}

      {!isOpen ? (
        <button
          aria-expanded="false"
          aria-label="Open Belikeme support chat"
          className="customer-chat-widget__launcher"
          onClick={() => setIsOpen(true)}
          title="Belikeme Support"
          type="button"
        >
          <MessageCircle aria-hidden="true" size={24} />
          {unreadAdminCount ? (
            <span className="customer-chat-widget__badge">
              {Math.min(unreadAdminCount, 9)}
            </span>
          ) : null}
        </button>
      ) : null}

      <ReturnRequestModal
        isOpen={Boolean(selectedReturnOrder)}
        onClose={() => setSelectedReturnOrder(undefined)}
        onSubmitted={(request) => {
          setLocalMessages((current) =>
            current.map((message) => ({
              ...message,
              returnRequest:
                message.returnRequest?.orderCode === request.orderCode
                  ? { ...message.returnRequest, requestStatus: "PENDING" }
                  : message.returnRequest,
              returnRequests: message.returnRequests?.map((item) =>
                item.orderCode === request.orderCode
                  ? { ...item, requestStatus: "PENDING" }
                  : item,
              ),
            })),
          );
          setMessages((current) =>
            current.map((message) =>
              applyReturnStatusesToAiMessage(
                message,
                new Map<string, "PENDING" | "APPROVED">([
                  [request.orderCode, "PENDING"],
                ]),
              ),
            ),
          );
        }}
        orderCode={selectedReturnOrder?.orderCode}
      />
    </div>
  );
}

function ChatMessageSkeleton() {
  return (
    <div className="customer-chat-messages" role="status">
      {Array.from({ length: 3 }, (_, index) => (
        <div
          aria-hidden="true"
          className={`customer-chat-message customer-chat-message--skeleton ${
            index % 2 === 0
              ? "customer-chat-message--support"
              : "customer-chat-message--own"
          }`}
          key={index}
        />
      ))}
    </div>
  );
}

function createLocalMessage(
  kind: LocalChatMessage["kind"],
  body: string,
  details: Partial<Omit<LocalChatMessage, "body" | "createdAt" | "id" | "kind">> = {},
): LocalChatMessage {
  localMessageSequence += 1;

  return {
    body,
    createdAt: new Date().toISOString(),
    id: `local-${localMessageSequence}`,
    kind,
    ...details,
  };
}

function buildTimeline(
  messages: ChatMessage[],
  localMessages: LocalChatMessage[],
  forwardedPersistedIds: Set<string>,
): TimelineMessage[] {
  const timeline: TimelineMessage[] = [
    ...messages
      .filter((message) => !forwardedPersistedIds.has(message.id))
      .map((message) => ({
        createdAt: message.createdAt,
        id: `persisted-${message.id}`,
        kind: "persisted" as const,
        message,
      })),
    ...localMessages.map((message) => ({
      createdAt: message.createdAt,
      id: message.id,
      kind: "local" as const,
      message,
    })),
  ];

  return timeline.sort(
    (left, right) =>
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
  );
}

function markMessageAsForwarded(
  messageId: string,
  setForwardedPersistedIds: (
    value: Set<string> | ((current: Set<string>) => Set<string>),
  ) => void,
) {
  setForwardedPersistedIds((current) => {
    if (current.has(messageId)) {
      return current;
    }

    const next = new Set(current);
    next.add(messageId);
    return next;
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

function getOrderIdFromPathname(pathname: string): string | undefined {
  return ORDER_DETAIL_PATH_PATTERN.exec(pathname)?.[1];
}

function isValidSupportResponse(response: SupportResponse): boolean {
  const hasValidBase = Boolean(
    response &&
      typeof response.mode === "string" &&
      typeof response.answer === "string" &&
      response.answer.trim(),
  );

  if (!hasValidBase) {
    return false;
  }

  const responseType = response.type ?? "text";

  if (!SUPPORTED_AI_MESSAGE_TYPES.has(responseType)) {
    return false;
  }

  if (response.type === "single_order_card") {
    return Boolean(response.order && isValidOrderCard(response.order));
  }

  if (response.type === "return_request_card") {
    const returnRequests =
      response.returnRequests ??
      (response.returnRequest ? [response.returnRequest] : []);

    return Boolean(
      returnRequests.length > 0 &&
        returnRequests.every(isValidReturnRequestCard),
    );
  }

  if (response.type !== "order_cards") {
    return hasValidBase;
  }

  return Boolean(
    Array.isArray(response.orders) &&
      response.orders.length > 1 &&
      response.orders.every(isValidOrderCard),
  );
}

function isValidReturnRequestCard(
  returnRequest: SupportReturnRequestCard,
): boolean {
  return Boolean(
    returnRequest &&
      typeof returnRequest.orderCode === "string" &&
      /^BK\d{6,}$/.test(returnRequest.orderCode) &&
      returnRequest.status === "DELIVERED" &&
      typeof returnRequest.deliveredAt === "string" &&
      !Number.isNaN(new Date(returnRequest.deliveredAt).getTime()) &&
      (returnRequest.thumbnail === null ||
        typeof returnRequest.thumbnail === "string") &&
      ORDER_DETAIL_URL_PATTERN.test(returnRequest.detailUrl),
  );
}

function isValidOrderCard(order: SupportOrderCard): boolean {
  return Boolean(
    order &&
      typeof order.orderCode === "string" &&
      /^BK\d{6,}$/.test(order.orderCode) &&
      SUPPORT_ORDER_CARD_STATUSES.has(order.status) &&
      typeof order.createdAt === "string" &&
      !Number.isNaN(new Date(order.createdAt).getTime()) &&
      (order.estimatedArrival === null ||
        (typeof order.estimatedArrival === "string" &&
          !Number.isNaN(new Date(order.estimatedArrival).getTime()))) &&
      Number.isSafeInteger(order.totalAmount) &&
      order.totalAmount >= 0 &&
      typeof order.currency === "string" &&
      /^[A-Z]{3}$/.test(order.currency) &&
      (order.thumbnail === null || typeof order.thumbnail === "string") &&
      ORDER_DETAIL_URL_PATTERN.test(order.detailUrl),
  );
}

function isOutOfScopeResponse(response: SupportResponse): boolean {
  return (
    response.mode === "out_of_scope" ||
    response.handoff?.reason?.toUpperCase() === "OUT_OF_SCOPE"
  );
}

function getPersistedAiResponse(
  message: ChatMessage,
): SupportResponse | undefined {
  if (message.senderRole !== "AI") {
    return undefined;
  }

  const response = message.metadata;

  if (!isRecord(response)) {
    return undefined;
  }

  if (isLegacyUnsupportedAiResponse(response)) {
    return {
      mode: "ai",
      type: "text",
      answer: LEGACY_UNSUPPORTED_AI_MESSAGE,
      sources: [],
      handoff: { required: false },
    };
  }

  const supportResponse = response as unknown as SupportResponse;

  return isValidSupportResponse(supportResponse) ? supportResponse : undefined;
}

function isLegacyUnsupportedAiResponse(
  response: Record<string, unknown>,
): boolean {
  return (
    typeof response.type === "string" &&
    LEGACY_UNSUPPORTED_AI_MESSAGE_TYPES.has(response.type)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function applyReturnStatusesToAiMessage(
  message: ChatMessage,
  statuses: Map<string, "PENDING" | "APPROVED">,
): ChatMessage {
  if (message.senderRole !== "AI" || !message.metadata) {
    return message;
  }

  const response = message.metadata as SupportResponse;
  const applyStatus = (item: SupportReturnRequestCard) => ({
    ...item,
    requestStatus: statuses.get(item.orderCode) ?? item.requestStatus,
  });

  return {
    ...message,
    metadata: {
      ...response,
      returnRequest: response.returnRequest
        ? applyStatus(response.returnRequest)
        : undefined,
      returnRequests: response.returnRequests?.map(applyStatus),
    },
  };
}

function isHandoffResponse(response: SupportResponse): boolean {
  if (response.handoff?.required) {
    return true;
  }

  return response.mode === "handoff" && response.handoff?.required !== false;
}

function shouldCountCustomerUnread(
  message: ChatMessage,
  isChatOpen: boolean,
): boolean {
  if (message.senderRole.toUpperCase() !== "ADMIN") {
    return false;
  }

  if (!isChatOpen) {
    return true;
  }

  return typeof document !== "undefined" && document.visibilityState !== "visible";
}

function getChatErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  const socketError = error as Partial<ChatSocketError>;

  if (typeof socketError?.message === "string") {
    return socketError.message;
  }

  return "Belikeme support chat is unavailable right now.";
}
