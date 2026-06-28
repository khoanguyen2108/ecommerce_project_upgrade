"use client";

import { ArrowUpRight, Loader2 } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useRef } from "react";
import styles from "@/components/ai/StyleAssistant.module.css";

const SUGGESTED_PROMPTS = [
  "Minimal",
  "Streetwear",
  "Date Night",
  "Coffee",
  "Black Outfit",
  "Oversized",
] as const;

interface StyleAssistantInputProps {
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  value: string;
}

export function StyleAssistantInput({
  isLoading,
  onChange,
  onSubmit,
  value,
}: StyleAssistantInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [value]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();

    if (value.trim() && !isLoading) {
      onSubmit();
    }
  }

  function selectPrompt(prompt: string) {
    onChange(prompt);
    textareaRef.current?.focus();
  }

  return (
    <form
      className={styles.inputCard}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div className={styles.inputHeading}>
        <div>
          <span className={styles.stepNumber}>01</span>
          <h2>Tell us what you need</h2>
        </div>
        <span className={styles.inputHint}>Enter to send · Shift+Enter for a new line</span>
      </div>

      <label className={styles.visuallyHidden} htmlFor="style-assistant-prompt">
        Describe the outfit or style you want
      </label>
      <textarea
        aria-describedby="style-assistant-help"
        className={styles.textarea}
        disabled={isLoading}
        id="style-assistant-prompt"
        maxLength={500}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe your style, occasion, color, or budget..."
        ref={textareaRef}
        rows={4}
        value={value}
      />
      <span className={styles.visuallyHidden} id="style-assistant-help">
        Maximum 500 characters. Press Enter to generate advice.
      </span>

      <div aria-label="Suggested style prompts" className={styles.chips} role="group">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            className={styles.chip}
            disabled={isLoading}
            key={prompt}
            onClick={() => selectPrompt(prompt)}
            type="button"
          >
            {prompt}
          </button>
        ))}
      </div>

      <div className={styles.inputFooter}>
        <span>{value.length}/500</span>
        <button
          className={styles.generateButton}
          disabled={!value.trim() || isLoading}
          type="submit"
        >
          {isLoading ? (
            <>
              <Loader2 aria-hidden="true" className={styles.spinner} size={18} />
              Curating
            </>
          ) : (
            <>
              Generate Style
              <ArrowUpRight aria-hidden="true" size={18} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
