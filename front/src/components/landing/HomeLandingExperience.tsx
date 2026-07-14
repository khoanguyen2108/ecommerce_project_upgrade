"use client";

import dynamic from "next/dynamic";
import {
  Component,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
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
const FLOATING_UI_RELEASE_PROGRESS = 0.88;
const HEADER_BRAND_FADE_END = 0.94;
const HEADER_BRAND_FADE_START = 0.82;
const HEADER_BRAND_INTERACTIVE_OPACITY = 0.18;
const INTRO_HANDOFF_END = 0.9;
const INTRO_HANDOFF_START = 0.12;
const INTRO_PROGRESS_EPSILON = 0.0005;
const ROOT_INTRO_BODY_CLASS = "belikeme-scroll-intro-active";
const SCENE_FADE_END = 0.94;
const SCENE_FADE_START = 0.76;
const SCENE_HIDDEN_PROGRESS = 0.985;

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

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
  const brandTargetRef = useRef<HTMLAnchorElement | null>(null);
  const sceneTargetRef = useRef<HTMLDivElement | null>(null);
  const {
    isHeaderBrandHidden,
    isSceneHidden,
    progressRef,
    transitionRef,
  } = useIntroScrollProgress({
    brandTargetRef,
    sceneTargetRef,
  });

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
      <SiteHeader
        brandHidden={isHeaderBrandHidden}
        brandRef={brandTargetRef}
        headerHidden={isHeaderBrandHidden}
        variant="intro-transition"
      />
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
              aria-hidden={isSceneHidden ? true : undefined}
              className={styles.sceneShell}
              ref={sceneTargetRef}
              role="img"
            >
              <div className={styles.sceneTransform}>
                <SceneErrorBoundary fallback={<LogoFallback label="BELIKEME" />}>
                  <InteractiveLogoScene
                    fallback={<LogoFallback label="BELIKEME" />}
                    mode="scroll"
                    modelSrc={LANDING_MODEL_SRC}
                    scrollProgressRef={progressRef}
                  />
                </SceneErrorBoundary>
              </div>
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

interface IntroScrollProgressOptions {
  brandTargetRef: { current: HTMLAnchorElement | null };
  sceneTargetRef: { current: HTMLDivElement | null };
}

interface LogoTarget {
  centerX: number;
  centerY: number;
  height: number;
  width: number;
}

function useIntroScrollProgress({
  brandTargetRef,
  sceneTargetRef,
}: IntroScrollProgressOptions) {
  const transitionRef = useRef<HTMLElement>(null);
  const progressRef = useRef(0);
  const [isHeaderBrandHidden, setIsHeaderBrandHidden] = useState(true);
  const [isSceneHidden, setIsSceneHidden] = useState(false);

  useIsomorphicLayoutEffect(() => {
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
    let isDisposed = false;
    let floatingUiSuppressed = false;
    let headerBrandHidden = true;
    let sceneHidden = false;

    function setFloatingUiSuppressed(nextIsSuppressed: boolean) {
      if (floatingUiSuppressed === nextIsSuppressed) {
        return;
      }

      floatingUiSuppressed = nextIsSuppressed;
      document.body.classList.toggle(
        ROOT_INTRO_BODY_CLASS,
        nextIsSuppressed,
      );
    }

    function setHeaderBrandHiddenState(nextIsHidden: boolean) {
      if (headerBrandHidden === nextIsHidden) {
        return;
      }

      headerBrandHidden = nextIsHidden;
      setIsHeaderBrandHidden(nextIsHidden);
    }

    function setSceneHiddenState(nextIsHidden: boolean) {
      if (sceneHidden === nextIsHidden) {
        return;
      }

      sceneHidden = nextIsHidden;
      setIsSceneHidden(nextIsHidden);
    }

    function writeHeaderBrandState(opacity: number, isHidden: boolean) {
      const brandElement = brandTargetRef.current;

      if (!brandElement) {
        return;
      }

      const headerElement = brandElement.closest(".site-header--intro-transition");

      brandElement.style.setProperty(
        "--site-header-brand-opacity",
        opacity.toFixed(4),
      );
      brandElement.style.setProperty(
        "--site-header-brand-pointer-events",
        isHidden ? "none" : "auto",
      );
      if (headerElement instanceof HTMLElement) {
        headerElement.style.setProperty(
          "--site-header-shell-opacity",
          opacity.toFixed(4),
        );
        headerElement.style.setProperty(
          "--site-header-shell-pointer-events",
          isHidden ? "none" : "auto",
        );
      }
    }

    function writeStableReducedMotionState() {
      progressRef.current = 0;
      setFloatingUiSuppressed(false);
      setHeaderBrandHiddenState(false);
      setSceneHiddenState(false);
      writeHeaderBrandState(1, false);
      variableElement.style.setProperty("--intro-progress", "0");
      variableElement.style.setProperty("--intro-scene-x", "0px");
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
      variableElement.style.setProperty(
        "--intro-landing-pointer-events",
        "auto",
      );
      variableElement.style.setProperty("--intro-landing-y", "0px");
      variableElement.style.setProperty(
        "--intro-scene-pointer-events",
        "auto",
      );
      variableElement.style.setProperty("--intro-scene-visibility", "visible");
    }

    function updateProgress() {
      if (isDisposed) {
        return;
      }

      animationFrameId = null;

      if (reducedMotionQuery.matches) {
        writeStableReducedMotionState();
        return;
      }

      const headerHeight = getHeaderHeight();
      const viewportHeight = Math.max(1, window.innerHeight);
      const viewportWidth = Math.max(1, window.innerWidth);
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

      const isMobile = viewportWidth <= 640;
      const headerLogoTarget = getHeaderLogoTarget(
        brandTargetRef.current,
        headerHeight,
        viewportWidth,
      );
      const sceneOrigin = getSceneOrigin(
        sceneTargetRef.current,
        headerHeight,
        viewportHeight,
        viewportWidth,
      );
      const scaleProgress = easeInOutCubic(
        normalize(progress, INTRO_HANDOFF_START, INTRO_HANDOFF_END),
      );
      const fadeProgress = smoothstep(
        normalize(progress, SCENE_FADE_START, SCENE_FADE_END),
      );
      const brandOpacity = smoothstep(
        normalize(progress, HEADER_BRAND_FADE_START, HEADER_BRAND_FADE_END),
      );
      const actionProgress = smoothstep(normalize(progress, 0.2, 0.62));
      const landingProgress = smoothstep(normalize(progress, 0.78, 0.94));
      const finalScale = getFinalSceneScale(
        headerLogoTarget.width,
        sceneOrigin.width,
        isMobile,
      );
      const finalTranslateX = headerLogoTarget.centerX - sceneOrigin.centerX;
      const finalTranslateY = headerLogoTarget.centerY - sceneOrigin.centerY;
      const scale = lerp(1, finalScale, scaleProgress);
      const translateX = lerp(0, finalTranslateX, scaleProgress);
      const translateY = lerp(0, finalTranslateY, scaleProgress);
      const sceneOpacity = lerp(1, 0, fadeProgress);
      const actionOpacity = lerp(1, 0, actionProgress);
      const actionTranslateY = lerp(0, -18, actionProgress);
      const landingOpacity = lerp(0, 1, landingProgress);
      const landingTranslateY = lerp(18, 0, landingProgress);
      const isHeaderBrandCurrentlyHidden =
        brandOpacity < HEADER_BRAND_INTERACTIVE_OPACITY;
      const isSceneCurrentlyHidden = progress >= SCENE_HIDDEN_PROGRESS;

      setFloatingUiSuppressed(progress < FLOATING_UI_RELEASE_PROGRESS);
      setHeaderBrandHiddenState(isHeaderBrandCurrentlyHidden);
      setSceneHiddenState(isSceneCurrentlyHidden);
      writeHeaderBrandState(brandOpacity, isHeaderBrandCurrentlyHidden);

      variableElement.style.setProperty(
        "--intro-progress",
        progress.toFixed(4),
      );
      variableElement.style.setProperty(
        "--intro-scene-x",
        `${translateX.toFixed(2)}px`,
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
        "--intro-landing-pointer-events",
        progress > FLOATING_UI_RELEASE_PROGRESS ? "auto" : "none",
      );
      variableElement.style.setProperty(
        "--intro-landing-y",
        `${landingTranslateY.toFixed(2)}px`,
      );
      variableElement.style.setProperty(
        "--intro-scene-pointer-events",
        progress > 0.68 ? "none" : "auto",
      );
      variableElement.style.setProperty(
        "--intro-scene-visibility",
        isSceneCurrentlyHidden ? "hidden" : "visible",
      );
    }

    function requestProgressUpdate() {
      if (isDisposed) {
        return;
      }

      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(updateProgress);
    }

    updateProgress();
    window.addEventListener("scroll", requestProgressUpdate, {
      passive: true,
    });
    window.addEventListener("resize", requestProgressUpdate);
    window.addEventListener("load", requestProgressUpdate);
    window.visualViewport?.addEventListener("resize", requestProgressUpdate);
    reducedMotionQuery.addEventListener("change", requestProgressUpdate);
    document.fonts?.ready.then(requestProgressUpdate).catch(() => undefined);

    return () => {
      isDisposed = true;
      window.removeEventListener("scroll", requestProgressUpdate);
      window.removeEventListener("resize", requestProgressUpdate);
      window.removeEventListener("load", requestProgressUpdate);
      window.visualViewport?.removeEventListener(
        "resize",
        requestProgressUpdate,
      );
      reducedMotionQuery.removeEventListener("change", requestProgressUpdate);
      document.body.classList.remove(ROOT_INTRO_BODY_CLASS);
      brandTargetRef.current?.style.removeProperty(
        "--site-header-brand-opacity",
      );
      brandTargetRef.current?.style.removeProperty(
        "--site-header-brand-pointer-events",
      );
      const headerElement = brandTargetRef.current?.closest(
        ".site-header--intro-transition",
      );
      if (headerElement instanceof HTMLElement) {
        headerElement.style.removeProperty("--site-header-shell-opacity");
        headerElement.style.removeProperty(
          "--site-header-shell-pointer-events",
        );
      }

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [brandTargetRef, sceneTargetRef]);

  return { isHeaderBrandHidden, isSceneHidden, progressRef, transitionRef };
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

function getHeaderLogoTarget(
  brandElement: HTMLAnchorElement | null,
  headerHeight: number,
  viewportWidth: number,
): LogoTarget {
  const rect = brandElement?.getBoundingClientRect();

  if (rect && hasUsableRect(rect)) {
    return {
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      height: rect.height,
      width: rect.width,
    };
  }

  const fallbackHeight = viewportWidth <= 640 ? 38 : 48;

  return {
    centerX: viewportWidth / 2,
    centerY: Math.max(1, headerHeight / 2),
    height: fallbackHeight,
    width: fallbackHeight * 2.4,
  };
}

function getSceneOrigin(
  sceneElement: HTMLDivElement | null,
  headerHeight: number,
  viewportHeight: number,
  viewportWidth: number,
): LogoTarget {
  const rect = sceneElement?.getBoundingClientRect();

  if (rect && hasUsableRect(rect)) {
    return {
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height * 0.44,
      height: rect.height,
      width: rect.width,
    };
  }

  const stageHeight = Math.max(1, viewportHeight - headerHeight);
  const isMobile = viewportWidth <= 640;
  const fallbackWidth = isMobile
    ? Math.min(viewportWidth, 420)
    : Math.min(viewportWidth * 0.86, 840);
  const fallbackHeight = isMobile
    ? clamp(viewportHeight * 0.5, 310, 430)
    : clamp(viewportHeight * 0.55, 330, 640);

  return {
    centerX: viewportWidth / 2,
    centerY: headerHeight + stageHeight * 0.46,
    height: fallbackHeight,
    width: fallbackWidth,
  };
}

function getFinalSceneScale(
  targetWidth: number,
  sceneWidth: number,
  isMobile: boolean,
) {
  const fallbackScale = isMobile ? 0.32 : 0.22;

  if (targetWidth <= 0 || sceneWidth <= 0) {
    return fallbackScale;
  }

  const measuredScale = (targetWidth / sceneWidth) * (isMobile ? 1.34 : 1.48);

  return clamp(
    measuredScale,
    isMobile ? 0.28 : 0.18,
    isMobile ? 0.38 : 0.26,
  );
}

function hasUsableRect(rect: DOMRect) {
  return (
    Number.isFinite(rect.left) &&
    Number.isFinite(rect.top) &&
    rect.width > 1 &&
    rect.height > 1
  );
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
