import type { ChatMessage as PersistedChatMessage } from "@/features/chat/types";
import { useI18n } from "@/features/i18n/useI18n";
import type { Locale } from "@/features/i18n/locale";

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
  const { locale, t } = useI18n();
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
        {formatChatTime(resolvedCreatedAt, locale, t("chat.now"))}
      </time>
    </article>
  );
}

function formatChatTime(value: string, locale: Locale, fallback: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
