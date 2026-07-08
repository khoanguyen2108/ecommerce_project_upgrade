"use client";

import { useState } from "react";
import { StyleAssistantEmpty } from "@/components/ai/StyleAssistantEmpty";
import { StyleAssistantError } from "@/components/ai/StyleAssistantError";
import { StyleAssistantInput } from "@/components/ai/StyleAssistantInput";
import styles from "@/components/ai/StyleAssistant.module.css";
import { StyleAssistantResult } from "@/components/ai/StyleAssistantResult";
import { StyleAssistantSkeleton } from "@/components/ai/StyleAssistantSkeleton";
import { useStyleAdvice } from "@/features/ai/hooks";
import { useAuthSession } from "@/features/auth/AuthSessionProvider";

export function StyleAssistant() {
  const [prompt, setPrompt] = useState("");
  const { error, generate, result, retry, status } = useStyleAdvice();
  const { isAuthenticated, isLoading: isSessionLoading } = useAuthSession();
  const isLoading = status === "loading";
  const isLocked = !isSessionLoading && !isAuthenticated;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.intro}>
          <div className={styles.introCopy}>
            <h1>Your next look, thoughtfully edited.</h1>
            <p>
              Tell us the mood, the moment, or your budget. Our assistant will
              search Belikeme&apos;s live catalog and shape a considered edit around
              you.
            </p>
          </div>
          <StyleAssistantInput
            isDisabled={isLoading || isSessionLoading || !isAuthenticated}
            isLocked={isLocked}
            isLoading={isLoading}
            onChange={setPrompt}
            onSubmit={() => void generate(prompt)}
            value={prompt}
          />
          <p className={styles.disclaimer}>
            Recommendations use current catalog availability. Confirm live color,
            size, and price on the product page.
          </p>
        </section>

        <aside aria-label="Style assistant result" className={styles.resultColumn}>
          {status === "idle" ? <StyleAssistantEmpty /> : null}
          {status === "loading" ? <StyleAssistantSkeleton /> : null}
          {status === "error" ? (
            <StyleAssistantError
              message={error || "The style assistant is unavailable right now."}
              onRetry={retry}
            />
          ) : null}
          {status === "success" && result ? (
            <StyleAssistantResult result={result} />
          ) : null}
        </aside>
      </div>
    </main>
  );
}
