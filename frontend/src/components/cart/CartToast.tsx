"use client";

import { AlertCircle, Check, X } from "lucide-react";

interface CartToastProps {
  kind?: "error" | "success";
  message?: string;
  onDismiss: () => void;
}

export function CartToast({ kind, message, onDismiss }: CartToastProps) {
  if (!kind || !message) {
    return null;
  }

  return (
    <div
      aria-atomic="true"
      className={`cart-toast cart-toast--${kind}`}
      role={kind === "error" ? "alert" : "status"}
    >
      {kind === "success" ? (
        <Check aria-hidden="true" size={18} />
      ) : (
        <AlertCircle aria-hidden="true" size={18} />
      )}
      <span>{message}</span>
      <button aria-label="Dismiss notification" onClick={onDismiss} type="button">
        <X aria-hidden="true" size={17} />
      </button>
    </div>
  );
}
