"use client";

import { type ReactNode } from "react";

const INTRO_SEEN_STORAGE_KEY = "belikemeIntroSeen";
const INTRO_SEEN_STORAGE_VALUE = "true";

export function IntroGate({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function markBelikemeIntroSeen() {
  try {
    window.localStorage.setItem(
      INTRO_SEEN_STORAGE_KEY,
      INTRO_SEEN_STORAGE_VALUE,
    );
  } catch {
    // Storage can be unavailable in hardened browsers. The link still works.
  }
}
