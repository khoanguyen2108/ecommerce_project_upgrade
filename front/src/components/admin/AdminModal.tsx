"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useRef } from "react";

interface AdminModalProps {
  children: ReactNode;
  closeDisabled?: boolean;
  compact?: boolean;
  confirmCloseMessage?: string;
  description?: string;
  footer?: ReactNode | ((requestClose: () => void) => ReactNode);
  hasUnsavedChanges?: boolean;
  isOpen: boolean;
  onClose: () => void;
  title: string;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function AdminModal({
  children,
  closeDisabled = false,
  compact = false,
  confirmCloseMessage = "Discard your unsaved changes?",
  description,
  footer,
  hasUnsavedChanges = false,
  isOpen,
  onClose,
  title,
}: AdminModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeOptionsRef = useRef({
    closeDisabled,
    confirmCloseMessage,
    hasUnsavedChanges,
    onClose,
  });
  closeOptionsRef.current = {
    closeDisabled,
    confirmCloseMessage,
    hasUnsavedChanges,
    onClose,
  };

  const requestClose = useCallback(() => {
    const closeOptions = closeOptionsRef.current;

    if (closeOptions.closeDisabled) {
      return;
    }

    if (
      closeOptions.hasUnsavedChanges &&
      !window.confirm(closeOptions.confirmCloseMessage)
    ) {
      return;
    }

    closeOptions.onClose();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(
        FOCUSABLE_SELECTOR,
      );
      (firstFocusable || dialogRef.current)?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        requestClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [isOpen, requestClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="admin-modal__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`admin-modal${compact ? " admin-modal--compact" : ""}`}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="admin-modal__header">
          <div className="admin-modal__heading">
            <h2 id={titleId}>{title}</h2>
            {description ? <p id={descriptionId}>{description}</p> : null}
          </div>
          <button
            aria-label="Close modal"
            className="icon-button admin-icon-button"
            disabled={closeDisabled}
            onClick={requestClose}
            type="button"
          >
            <X aria-hidden="true" size={20} />
          </button>
        </header>
        <div className="admin-modal__body">{children}</div>
        {footer ? (
          <footer className="admin-modal__footer">
            {typeof footer === "function" ? footer(requestClose) : footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
