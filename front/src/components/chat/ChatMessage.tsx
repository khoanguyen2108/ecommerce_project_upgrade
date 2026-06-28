import type { ChatMessage as PersistedChatMessage } from "@/features/chat/types";

interface ChatMessageProps {
  body?: string;
  createdAt?: string;
  isOwn?: boolean;
  message?: PersistedChatMessage;
}

export function ChatMessage({
  body,
  createdAt,
  isOwn,
  message,
}: ChatMessageProps) {
  const resolvedBody = message?.body ?? body ?? "";
  const resolvedCreatedAt = message?.createdAt ?? createdAt ?? "";
  const resolvedIsOwn = message
    ? message.senderRole === "CUSTOMER"
    : Boolean(isOwn);

  return (
    <article
      className={`customer-chat-message ${
        resolvedIsOwn
          ? "customer-chat-message--own"
          : "customer-chat-message--support"
      }`}
    >
      <p>{resolvedBody}</p>
      <time dateTime={resolvedCreatedAt || undefined}>
        {formatChatTime(resolvedCreatedAt)}
      </time>
    </article>
  );
}

function formatChatTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Now";
  }

  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
