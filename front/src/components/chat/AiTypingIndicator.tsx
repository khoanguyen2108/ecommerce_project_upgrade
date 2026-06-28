import { Sparkles } from "lucide-react";

export function AiTypingIndicator() {
  return (
    <div
      aria-label="Belikeme AI is typing"
      aria-live="polite"
      className="customer-chat-ai-typing"
      role="status"
    >
      <span className="customer-chat-ai-typing__badge" aria-hidden="true">
        <Sparkles size={12} />
        AI
      </span>
      <span className="customer-chat-ai-typing__dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  );
}
