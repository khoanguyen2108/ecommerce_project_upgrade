import { Send } from "lucide-react";
import type { FormEvent, KeyboardEvent, RefObject } from "react";

interface ChatComposerProps {
  draft: string;
  isSending: boolean;
  maxLength: number;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export function ChatComposer({
  draft,
  isSending,
  maxLength,
  onDraftChange,
  onSend,
  textareaRef,
}: ChatComposerProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSend();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    onSend();
  }

  return (
    <form className="customer-chat-composer" onSubmit={handleSubmit}>
      <label htmlFor="customer-chat-message">{"Message"}</label>
      <div className="customer-chat-composer__field">
        <textarea
          aria-label={"Type your message"}
          disabled={isSending}
          id="customer-chat-message"
          maxLength={maxLength}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={"Type your message..."}
          ref={textareaRef}
          rows={1}
          value={draft}
        />
        <button
          aria-label={"Send message"}
          className="customer-chat-composer__send"
          disabled={!draft.trim() || isSending}
          title={"Send message"}
          type="submit"
        >
          <Send aria-hidden="true" size={17} />
        </button>
      </div>
    </form>
  );
}
