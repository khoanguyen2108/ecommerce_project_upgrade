"use client";

import { useContext } from "react";
import { I18nContext } from "@/features/i18n/I18nProvider";

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }

  return context;
}
