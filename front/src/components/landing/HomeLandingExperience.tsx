"use client";

import dynamic from "next/dynamic";
import {
  Component,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
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
const INTRO_PROGRESS_EPSILON = 0.0005;

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
  const { progressRef, transitionRef } = useIntroScrollProgress();

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
          ref={transitionRef}
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
                  mode="scroll"
                  modelSrc={LANDING_MODEL_SRC}
                  scrollProgressRef={progressRef}
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

function useIntroScrollProgress() {
  const transitionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);

  useEffect(() => {
    const transitionElement = transitionRef.current;

    if (!transitionElement) {
      return;
    }

    const transitionNode = transitionElement;
    const variableElement = transitionNode.parentElement ?? transitionNode;
    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let animationFrameId: number | null = null;

    function writeStableReducedMotionState() {
      progressRef.current = 0;
      variableElement.style.setProperty("--intro-progress", "0");
      variableElement.style.setProperty("--intro-scene-scale", "1");
      variableElement.style.setProperty("--intro-scene-y", "0px");
      variableElement.style.setProperty("--intro-scene-opacity", "1");
      variableElement.style.setProperty("--intro-action-opacity", "1");
      variableElement.style.setProperty("--intro-action-y", "0px");
      variableElement.style.setProperty(
        "--intro-action-pointer-events",
        "auto",
      );
      variableElement.style.setProperty("--intro-landing-opacity", "1");
      variableElement.style.setProperty("--intro-landing-y", "0px");
      variableElement.style.setProperty(
        "--intro-scene-pointer-events",
        "auto",
      );
    }

    function updateProgress() {
      animationFrameId = null;

      if (reducedMotionQuery.matches) {
        writeStableReducedMotionState();
        return;
      }

      const headerHeight = getHeaderHeight();
      const viewportHeight = Math.max(1, window.innerHeight);
      const stickyHeight = Math.max(1, viewportHeight - headerHeight);
      const rect = transitionNode.getBoundingClientRect();
      const scrollableDistance = Math.max(1, rect.height - stickyHeight);
      const progress = clamp(
        (headerHeight - rect.top) / scrollableDistance,
        0,
        1,
      );

      if (Math.abs(progressRef.current - progress) > INTRO_PROGRESS_EPSILON) {
        progressRef.current = progress;
      }

      const isMobile = window.innerWidth <= 640;
      const scaleProgress = easeInOutCubic(normalize(progress, 0.12, 0.82));
      const fadeProgress = smoothstep(normalize(progress, 0.78, 1));
      const actionProgress = smoothstep(normalize(progress, 0.2, 0.62));
      const landingProgress = smoothstep(normalize(progress, 0.56, 0.96));
      const finalScale = isMobile ? 0.32 : 0.22;
      const travelDistance = isMobile
        ? Math.min(viewportHeight * 0.24, 190)
        : Math.min(viewportHeight * 0.31, 286);
      const scale = lerp(1, finalScale, scaleProgress);
      const translateY = -lerp(0, travelDistance, scaleProgress);
      const sceneOpacity = lerp(1, 0, fadeProgress);
      const actionOpacity = lerp(1, 0, actionProgress);
      const actionTranslateY = lerp(0, -18, actionProgress);
      const landingOpacity = lerp(0.92, 1, landingProgress);
      const landingTranslateY = lerp(28, 0, landingProgress);

      variableElement.style.setProperty(
        "--intro-progress",
        progress.toFixed(4),
      );
      variableElement.style.setProperty(
        "--intro-scene-scale",
        scale.toFixed(4),
      );
      variableElement.style.setProperty(
        "--intro-scene-y",
        `${translateY.toFixed(2)}px`,
      );
      variableElement.style.setProperty(
        "--intro-scene-opacity",
        sceneOpacity.toFixed(4),
      );
      variableElement.style.setProperty(
        "--intro-action-opacity",
        actionOpacity.toFixed(4),
      );
      variableElement.style.setProperty(
        "--intro-action-y",
        `${actionTranslateY.toFixed(2)}px`,
      );
      variableElement.style.setProperty(
        "--intro-action-pointer-events",
        progress > 0.62 ? "none" : "auto",
      );
      variableElement.style.setProperty(
        "--intro-landing-opacity",
        landingOpacity.toFixed(4),
      );
      variableElement.style.setProperty(
        "--intro-landing-y",
        `${landingTranslateY.toFixed(2)}px`,
      );
      variableElement.style.setProperty(
        "--intro-scene-pointer-events",
        progress > 0.68 ? "none" : "auto",
      );
    }

    function requestProgressUpdate() {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(updateProgress);
    }

    requestProgressUpdate();
    window.addEventListener("scroll", requestProgressUpdate, {
      passive: true,
    });
    window.addEventListener("resize", requestProgressUpdate);
    reducedMotionQuery.addEventListener("change", requestProgressUpdate);

    return () => {
      window.removeEventListener("scroll", requestProgressUpdate);
      window.removeEventListener("resize", requestProgressUpdate);
      reducedMotionQuery.removeEventListener("change", requestProgressUpdate);

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return { progressRef, transitionRef };
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

function getHeaderHeight() {
  const rawHeight = window
    .getComputedStyle(document.documentElement)
    .getPropertyValue("--header-height");
  const parsedHeight = Number.parseFloat(rawHeight);

  return Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : 72;
}

function normalize(value: number, start: number, end: number) {
  if (end <= start) {
    return value >= end ? 1 : 0;
  }

  return clamp((value - start) / (end - start), 0, 1);
}

function smoothstep(value: number) {
  const normalizedValue = clamp(value, 0, 1);

  return normalizedValue * normalizedValue * (3 - 2 * normalizedValue);
}

function easeInOutCubic(value: number) {
  const normalizedValue = clamp(value, 0, 1);

  return normalizedValue < 0.5
    ? 4 * normalizedValue * normalizedValue * normalizedValue
    : 1 - Math.pow(-2 * normalizedValue + 2, 3) / 2;
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
