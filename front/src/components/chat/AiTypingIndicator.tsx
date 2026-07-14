import { Sparkles } from "lucide-react";
import { useI18n } from "@/features/i18n/useI18n";

export function AiTypingIndicator() {
  const { t } = useI18n();
  return (
    <div
      aria-label={t("chat.aiTyping")}
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
