"use client";

import dynamic from "next/dynamic";
import {
  Component,
  type MouseEvent,
  type ReactNode,
} from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LandingPage } from "@/components/marketing/LandingPage";
import { useI18n } from "@/features/i18n/useI18n";
import styles from "./HomeLandingExperience.module.css";
import { markBelikemeIntroSeen } from "./IntroGate";

const LANDING_LOGO_SRC = "/assets/landing/belikeme-logo.png";
const LANDING_MODEL_SRC = "/assets/landing/belikeme-logo-3d.glb";
const LANDING_TARGET_ID = "landing";

const InteractiveLogoScene = dynamic(
  () =>
    import("./InteractiveLogoScene").then(
      (module) => module.InteractiveLogoScene,
    ),
  {
    loading: () => <LogoFallback label="LOADING BELIKEME" />,
    ssr: false,
  },
);

export function HomeLandingExperience() {
  const { t } = useI18n();

  function handleShopNow(event: MouseEvent<HTMLAnchorElement>) {
    markBelikemeIntroSeen();

    if (
      event.button !== 0 ||
      event.metaKey ||
      event.altKey ||
      event.ctrlKey ||
      event.shiftKey
    ) {
      return;
    }

    const landingTarget = document.getElementById(LANDING_TARGET_ID);

    if (
      !landingTarget ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    event.preventDefault();
    landingTarget.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.pushState(null, "", `#${LANDING_TARGET_ID}`);
  }

  return (
    <>
      <SiteHeader />
      <main className={styles.home}>
        <section
          className={styles.intro}
          aria-labelledby="belikeme-home-intro-title"
        >
          <div className={styles.background} aria-hidden="true" />
          <div className={styles.overlay} aria-hidden="true" />

          <div className={styles.stage}>
            <h1 className={styles.srOnly} id="belikeme-home-intro-title">
              {t("intro.title")}
            </h1>

            <div
              aria-label={t("intro.logoAria")}
              className={styles.sceneShell}
              role="img"
            >
              <SceneErrorBoundary fallback={<LogoFallback label="BELIKEME" />}>
                <InteractiveLogoScene
                  fallback={<LogoFallback label="BELIKEME" />}
                  modelSrc={LANDING_MODEL_SRC}
                />
              </SceneErrorBoundary>
            </div>

            <div className={styles.actionStack}>
              <a
                className={styles.shopButton}
                href={`#${LANDING_TARGET_ID}`}
                onClick={handleShopNow}
              >
                {t("intro.shopNow")}
              </a>
              <p className={styles.helperText}>
                <span className={styles.helperDesktop}>
                  {t("intro.dragToInteract")}
                </span>
                <span className={styles.helperTouch}>
                  {t("intro.touchAndDrag")}
                </span>
              </p>
            </div>
          </div>
        </section>

        <section
          aria-label={t("intro.landingLabel")}
          className={styles.landingSection}
          id={LANDING_TARGET_ID}
          tabIndex={-1}
        >
          <LandingPage />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

function LogoFallback({ label }: { label: string }) {
  return (
    <div className={styles.logoFallback} role="status">
      <img
        alt="BELIKEME"
        className={styles.logoFallbackImage}
        src={LANDING_LOGO_SRC}
      />
      <span>{label}</span>
    </div>
  );
}

class SceneErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}
