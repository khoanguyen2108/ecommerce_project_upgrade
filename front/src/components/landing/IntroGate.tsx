"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";

const INTRO_SEEN_STORAGE_KEY = "belikemeIntroSeen";
const INTRO_SEEN_STORAGE_VALUE = "true";

export function IntroGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [canShowLandingPage, setCanShowLandingPage] = useState(false);

  useEffect(() => {
    if (hasSeenBelikemeIntro()) {
      setCanShowLandingPage(true);
      return;
    }

    router.replace("/intro");
  }, [router]);

  if (!canShowLandingPage) {
    return null;
  }

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

function hasSeenBelikemeIntro() {
  try {
    return (
      window.localStorage.getItem(INTRO_SEEN_STORAGE_KEY) ===
      INTRO_SEEN_STORAGE_VALUE
    );
  } catch {
    // Avoid trapping visitors in a redirect loop when storage is unavailable.
    return true;
  }
}
