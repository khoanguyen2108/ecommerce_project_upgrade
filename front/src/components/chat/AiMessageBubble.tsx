import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { AiOrderCards } from "@/components/chat/AiOrderCards";
import type { SupportOrderCard } from "@/features/ai/supportTypes";

export type AiMessageTone = "answer" | "error" | "handoff" | "out-of-scope";

interface AiMessageBubbleProps {
  body: string;
  createdAt?: string;
  messageType?: "text" | "order_cards";
  orders?: SupportOrderCard[];
  showDayLabel?: boolean;
  status?: string;
  statusDetail?: string;
  tone?: AiMessageTone;
}

export function AiMessageBubble({
  body,
  createdAt,
  messageType = "text",
  orders = [],
  showDayLabel = false,
  status,
  statusDetail,
  tone = "answer",
}: AiMessageBubbleProps) {
  return (
    <>
      {showDayLabel ? (
        <span className="customer-chat-message__day">Today</span>
      ) : null}
      <article
        className={`customer-chat-ai-message customer-chat-ai-message--${tone} ${
          messageType === "order_cards"
            ? "customer-chat-ai-message--order-cards"
            : ""
        }`}
      >
        <div className="customer-chat-ai-message__identity">
          <span className="customer-chat-ai-message__badge">
            <Sparkles aria-hidden="true" size={12} />
            AI
          </span>
          <span>Belikeme AI</span>
        </div>
        <div className="customer-chat-ai-message__bubble">
          {messageType === "order_cards" ? (
            <div className="customer-chat-ai-message__content">
              <p>{body}</p>
              <AiOrderCards orders={orders} />
            </div>
          ) : (
            <SafeMarkdown value={body} />
          )}
          {status ? (
            <div className="customer-chat-ai-message__status">
              <strong>{status}</strong>
              {statusDetail ? <span>{statusDetail}</span> : null}
            </div>
          ) : null}
        </div>
        <time dateTime={createdAt || undefined}>
          {createdAt ? formatChatTime(createdAt) : "Now"}
        </time>
      </article>
    </>
  );
}

function SafeMarkdown({ value }: { value: string }) {
  const lines = value.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let bulletItems: string[] = [];

  function flushBullets() {
    if (!bulletItems.length) {
      return;
    }

    const items = bulletItems;
    bulletItems = [];
    blocks.push(
      <ul key={`list-${blocks.length}`}>
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>{renderInlineMarkdown(item)}</li>
        ))}
      </ul>,
    );
  }

  lines.forEach((line) => {
    const bullet = line.match(/^\s*(?:[-*•])\s+(.+)$/);

    if (bullet) {
      bulletItems.push(bullet[1]);
      return;
    }

    flushBullets();

    if (line.trim()) {
      blocks.push(
        <p key={`paragraph-${blocks.length}`}>
          {renderInlineMarkdown(line.trim())}
        </p>,
      );
    }
  });

  flushBullets();

  return <div className="customer-chat-ai-message__content">{blocks}</div>;
}

function renderInlineMarkdown(value: string): ReactNode[] {
  const tokenPattern = /(\*\*[^*\n]+\*\*|\[[^\]\n]+\]\([^\s)]+\))/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of value.matchAll(tokenPattern)) {
    const index = match.index ?? 0;

    if (index > cursor) {
      nodes.push(value.slice(cursor, index));
    }

    const token = match[0];

    if (token.startsWith("**")) {
      nodes.push(<strong key={`${index}-${token}`}>{token.slice(2, -2)}</strong>);
    } else {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const href = linkMatch?.[2];

      if (linkMatch && isSafeLink(href)) {
        nodes.push(
          <a
            href={href}
            key={`${index}-${token}`}
            rel="noreferrer noopener"
            target="_blank"
          >
            {linkMatch[1]}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    }

    cursor = index + token.length;
  }

  if (cursor < value.length) {
    nodes.push(value.slice(cursor));
  }

  return nodes;
}

function isSafeLink(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
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
