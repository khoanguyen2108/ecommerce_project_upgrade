"use client";

import { LogIn, MessageCircle, Send, WifiOff, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { FormEvent, KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";
import { isAdminUser } from "@/features/auth/roles";
import {
  getMyChat,
  sendMyChatMessage,
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

const CUSTOMER_CHAT_HIDDEN_PREFIXES = [
  "/admin",
  "/login",
  "/register",
  "/forgot-password",
] as const;

const CUSTOMER_CHAT_WELCOME_MESSAGE =
  "Hi there! 👋 Welcome to Belikeme. How can we help you elevate your style today?";

export function CustomerChatWidget() {
  const pathname = usePathname() || "/";
  const { accessToken, currentUser, isAuthenticated, isLoading: isSessionLoading } =
    useAuthSession();
  const isAdmin = isAdminUser(currentUser);
  const shouldHide = CUSTOMER_CHAT_HIDDEN_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState<ChatConversation>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string>();
  const [unreadAdminCount, setUnreadAdminCount] = useState(0);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("offline");
  const isOpenRef = useRef(isOpen);
  const socketRef = useRef<ChatSocket | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isOpenRef.current = isOpen;

    if (isOpen) {
      setUnreadAdminCount(0);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, isOpen]);

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
        const response = await getMyChat();

        if (!isMounted) {
          return;
        }

        setConversation(response.conversation);
        setMessages(response.messages);
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
    if (!isAuthenticated) {
      return "Sign in required";
    }

    if (connectionState === "connected") {
      return "Online";
    }

    if (connectionState === "connecting") {
      return "Reconnecting";
    }

    return "Offline";
  }, [connectionState, isAuthenticated]);

  if (shouldHide || isAdmin) {
    return null;
  }

  async function sendMessage() {
    const body = draft.trim();

    if (!body || !isAuthenticated || isSending) {
      return;
    }

    setIsSending(true);
    setError(undefined);

    const activeSocket = socketRef.current;

    if (activeSocket?.connected) {
      setDraft("");
      activeSocket.emit(
        "chat:send",
        { body },
        (response?: ChatSocketAck<ChatMessageResponse>) => {
          setIsSending(false);

          if (!response) {
            return;
          }

          if (!response.ok) {
            setError(response.error?.message || "Message could not be sent.");
            setDraft(body);
            return;
          }

          if (response.data) {
            setConversation(response.data.conversation);
            setMessages((current) =>
              appendMessage(current, response.data?.message),
            );
          }
        },
      );
      return;
    }

    try {
      const response = await sendMyChatMessage(body);

      setDraft("");
      setConversation(response.conversation);
      setMessages((current) => appendMessage(current, response.message));
    } catch (sendError) {
      setError(getChatErrorMessage(sendError));
    } finally {
      setIsSending(false);
    }
  }

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter") {
      return;
    }

    if (event.shiftKey || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    void sendMessage();
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
            <div>
              <h2>Belikeme Support</h2>
              <span
                className={`customer-chat-panel__status customer-chat-panel__status--${connectionState}`}
              >
                {connectionState === "offline" ? (
                  <WifiOff aria-hidden="true" size={13} />
                ) : null}
                {connectionLabel}
              </span>
            </div>
            <button
              aria-label="Close support chat"
              className="customer-chat-panel__close"
              onClick={() => setIsOpen(false)}
              title="Close support chat"
              type="button"
            >
              <X aria-hidden="true" size={18} />
            </button>
          </header>

          <div className="customer-chat-panel__body">
            {isSessionLoading ? (
              <ChatPanelState message="Checking your session." />
            ) : !isAuthenticated ? (
              <div className="customer-chat-login">
                <p>Log in to chat with Belikeme support.</p>
                <Link className="button button--primary" href="/login">
                  <LogIn aria-hidden="true" size={17} />
                  Log in
                </Link>
              </div>
            ) : isLoading ? (
              <ChatMessageSkeleton />
            ) : messages.length === 0 ? (
              <div className="customer-chat-messages" role="log">
                <ChatWelcomeMessage />
                <div ref={messagesEndRef} />
              </div>
            ) : (
              <div className="customer-chat-messages" role="log">
                {messages.map((message) => (
                  <ChatBubble
                    isOwn={message.senderRole === "CUSTOMER"}
                    key={message.id}
                    message={message}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {error ? (
            <div className="customer-chat-panel__error" role="alert">
              {error}
            </div>
          ) : null}

          {isAuthenticated ? (
            <form className="customer-chat-composer" onSubmit={handleSend}>
              <label htmlFor="customer-chat-message">Message</label>
              <textarea
                disabled={isSending}
                id="customer-chat-message"
                maxLength={2000}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder="Type your message..."
                rows={2}
                value={draft}
              />
              <button
                aria-label="Send message"
                className="customer-chat-composer__send"
                disabled={!draft.trim() || isSending}
                title="Send message"
                type="submit"
              >
                <Send aria-hidden="true" size={17} />
              </button>
            </form>
          ) : null}
        </section>
      ) : null}

      <button
        aria-expanded={isOpen}
        aria-label="Open Belikeme support chat"
        className="customer-chat-widget__launcher"
        onClick={() => setIsOpen((current) => !current)}
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
    </div>
  );
}

function ChatWelcomeMessage() {
  return (
    <article
      className="customer-chat-message customer-chat-message--support customer-chat-message--welcome"
      key="virtual-welcome-message"
    >
      <span className="customer-chat-message__day">Today</span>
      <span className="customer-chat-message__sender">Belikeme Support</span>
      <p>{CUSTOMER_CHAT_WELCOME_MESSAGE}</p>
    </article>
  );
}

function ChatBubble({
  isOwn,
  message,
}: {
  isOwn: boolean;
  message: ChatMessage;
}) {
  return (
    <article
      className={`customer-chat-message ${
        isOwn ? "customer-chat-message--own" : "customer-chat-message--support"
      }`}
    >
      <p>{message.body}</p>
      <time dateTime={message.createdAt}>{formatChatTime(message.createdAt)}</time>
    </article>
  );
}

function ChatPanelState({ message }: { message: string }) {
  return (
    <div className="customer-chat-panel__state" role="status">
      {message}
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

function formatChatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
