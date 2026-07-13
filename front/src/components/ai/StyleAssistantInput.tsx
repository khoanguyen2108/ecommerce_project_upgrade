"use client";

import { ArrowUpRight, Loader2 } from "lucide-react";
import Link from "next/link";
import type { KeyboardEvent } from "react";
import { useEffect, useRef } from "react";
import styles from "@/components/ai/StyleAssistant.module.css";
import { useI18n } from "@/features/i18n/useI18n";

interface StyleAssistantInputProps {
  isDisabled: boolean;
  isLocked: boolean;
  isLoading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  value: string;
}

export function StyleAssistantInput({
  isDisabled,
  isLocked,
  isLoading,
  onChange,
  onSubmit,
  value,
}: StyleAssistantInputProps) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 156)}px`;
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

    if (value.trim() && !isDisabled) {
      onSubmit();
    }
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
          <h2>{t("ai.tellNeed")}</h2>
        </div>
      </div>

      {isLocked ? (
        <div className={styles.signInPrompt} role="note">
          <div>
            <strong>{t("ai.signInTitle")}</strong>
            <span>{t("ai.signInBody")}</span>
          </div>
          <Link href="/login?next=%2Fai%2Fstyle-assistant">
            {t("ai.signInContinue")}
          </Link>
        </div>
      ) : null}

      <label className={styles.visuallyHidden} htmlFor="style-assistant-prompt">
        {t("ai.describeLabel")}
      </label>
      <textarea
        aria-describedby="style-assistant-help"
        className={styles.textarea}
        disabled={isDisabled}
        id="style-assistant-prompt"
        maxLength={500}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={t("ai.placeholder")}
        ref={textareaRef}
        rows={3}
        value={value}
      />
      <span className={styles.visuallyHidden} id="style-assistant-help">
        {t("ai.help")}
      </span>

      <div className={styles.inputFooter}>
        <span>{value.length}/500</span>
        <button
          className={styles.generateButton}
          disabled={!value.trim() || isDisabled}
          type="submit"
        >
          {isLoading ? (
            <>
              <Loader2 aria-hidden="true" className={styles.spinner} size={18} />
              {t("ai.curating")}
            </>
          ) : (
            <>
              {t("ai.generate")}
              <ArrowUpRight aria-hidden="true" size={18} />
            </>
          )}
        </button>
      </div>
    </form>
  );
}
