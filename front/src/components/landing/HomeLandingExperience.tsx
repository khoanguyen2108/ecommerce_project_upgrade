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
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { LandingPage } from "@/components/marketing/LandingPage";
import { useI18n } from "@/features/i18n/useI18n";
import styles from "./HomeLandingExperience.module.css";
import { markBelikemeIntroSeen } from "./IntroGate";

const LANDING_LOGO_SRC = "/assets/landing/belikeme-logo.png";
const LANDING_MODEL_SRC = "/assets/landing/belikeme-logo-3d.glb";
const LANDING_TARGET_ID = "landing";
const CLICK_TRANSITION_DURATION_MS = 1_700;
const HEADER_BRAND_FADE_END = 0.66;
const HEADER_BRAND_FADE_START = 0.54;
const HEADER_CONTENT_REVEAL_MIN_DURATION_MS = 680;
const HEADER_CONTENT_REVEAL_START = 0.6;
const HEADER_SHELL_FADE_END = 0.76;
const HEADER_SHELL_FADE_START = 0.58;
const LOGO_TRAVEL_END = 0.54;
const ROOT_INTRO_BODY_CLASS = "belikeme-scroll-intro-active";
const SCENE_FADE_END = 0.68;
const SCENE_FADE_START = LOGO_TRAVEL_END;
const SCENE_HIDDEN_PROGRESS = 0.7;
const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const vietnamTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  second: "2-digit",
  timeZone: VIETNAM_TIME_ZONE,
});
const vietnamDateFormatter = new Intl.DateTimeFormat("en-US", {
  day: "numeric",
  month: "short",
  timeZone: VIETNAM_TIME_ZONE,
  weekday: "short",
  year: "numeric",
});

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

interface HomeLandingExperienceProps {
  mode?: "intro" | "landing";
}

export function HomeLandingExperience({
  mode = "landing",
}: HomeLandingExperienceProps) {
  const { t } = useI18n();
  const router = useRouter();
  const brandTargetRef = useRef<HTMLAnchorElement | null>(null);
  const sceneTargetRef = useRef<HTMLDivElement | null>(null);
  const [hasEnteredLanding, setHasEnteredLanding] = useState(
    mode === "landing",
  );
  const [isTransitioning, setIsTransitioning] = useState(false);

  function completeLandingEntry() {
    markBelikemeIntroSeen();
    setHasEnteredLanding(true);
    setIsTransitioning(false);
    window.scrollTo(0, 0);
    router.replace("/");
  }

  const {
    isHeaderContentVisible,
    isHeaderHidden,
    isSceneHidden,
    transitionRef,
  } =
    useIntroClickTransition({
      brandTargetRef,
      hasEnteredLanding,
      isTransitioning,
      onComplete: completeLandingEntry,
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

    event.preventDefault();

    if (hasEnteredLanding || isTransitioning) {
      return;
    }

    setIsTransitioning(true);
  }

  const homeStateClass = hasEnteredLanding
    ? styles.homeEntered
    : isTransitioning
      ? styles.homeTransitioning
      : styles.homeIntro;
  const shouldHideHeader = hasEnteredLanding ? false : isHeaderHidden;
  const shouldRenderIntro = mode === "intro" && !hasEnteredLanding;

  return (
    <>
      <SiteHeader
        brandHidden={shouldHideHeader}
        brandRef={brandTargetRef}
        headerHidden={shouldHideHeader}
        introContentVisible={isHeaderContentVisible}
        variant={hasEnteredLanding ? "default" : "intro-transition"}
      />
      <main className={`${styles.home} ${homeStateClass}`}>
        {shouldRenderIntro ? (
          <section
            aria-labelledby="belikeme-home-intro-title"
            className={styles.intro}
            ref={transitionRef}
          >
            <div className={styles.background} aria-hidden="true" />
            <div className={styles.overlay} aria-hidden="true" />

            <div className={styles.stage}>
              <div className={styles.brandSlot}>
                <img
                  alt="BELIKEME"
                  className={styles.brandLogo}
                  src={LANDING_LOGO_SRC}
                />
                <VietnamTime />
              </div>

              <div
                aria-hidden={isSceneHidden ? true : undefined}
                aria-label={t("intro.logoAria")}
                className={styles.sceneShell}
                ref={sceneTargetRef}
                role="img"
              >
                <div className={styles.sceneTransform}>
                  <SceneErrorBoundary fallback={<LogoFallback label="BELIKEME" />}>
                    <InteractiveLogoScene
                      fallback={<LogoFallback label="BELIKEME" />}
                      modelSrc={LANDING_MODEL_SRC}
                    />
                  </SceneErrorBoundary>
                </div>
              </div>

              <div className={styles.actionStack}>
                <h1 className={styles.srOnly} id="belikeme-home-intro-title">
                  {t("intro.title")}
                </h1>
                <a
                  className={styles.shopButton}
                  href={`#${LANDING_TARGET_ID}`}
                  onClick={handleShopNow}
                  tabIndex={isTransitioning ? -1 : undefined}
                >
                  {t("intro.shopNow")}
                </a>
              </div>
            </div>
          </section>
        ) : null}

        <section
          aria-label={t("intro.landingLabel")}
          className={styles.landingSection}
          id={LANDING_TARGET_ID}
          tabIndex={-1}
        >
          <LandingPage />
        </section>
      </main>
      {hasEnteredLanding ? <SiteFooter /> : null}
    </>
  );
}

interface IntroClickTransitionOptions {
  brandTargetRef: { current: HTMLAnchorElement | null };
  hasEnteredLanding: boolean;
  isTransitioning: boolean;
  onComplete: () => void;
  sceneTargetRef: { current: HTMLDivElement | null };
}

interface LogoTarget {
  centerX: number;
  centerY: number;
  height: number;
  width: number;
}

function useIntroClickTransition({
  brandTargetRef,
  hasEnteredLanding,
  isTransitioning,
  onComplete,
  sceneTargetRef,
}: IntroClickTransitionOptions) {
  const transitionRef = useRef<HTMLElement>(null);
  const onCompleteRef = useRef(onComplete);
  const progressRef = useRef(0);
  const headerContentVisibleRef = useRef(false);
  const headerHiddenRef = useRef(true);
  const sceneHiddenRef = useRef(false);
  const [isHeaderContentVisible, setIsHeaderContentVisible] = useState(false);
  const [isHeaderHidden, setIsHeaderHidden] = useState(true);
  const [isSceneHidden, setIsSceneHidden] = useState(false);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

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

    function setHeaderContentVisibleState(nextIsVisible: boolean) {
      if (headerContentVisibleRef.current === nextIsVisible) {
        return;
      }

      headerContentVisibleRef.current = nextIsVisible;
      setIsHeaderContentVisible(nextIsVisible);
    }

    function setHeaderHiddenState(nextIsHidden: boolean) {
      if (headerHiddenRef.current === nextIsHidden) {
        return;
      }

      headerHiddenRef.current = nextIsHidden;
      setIsHeaderHidden(nextIsHidden);
    }

    function setSceneHiddenState(nextIsHidden: boolean) {
      if (sceneHiddenRef.current === nextIsHidden) {
        return;
      }

      sceneHiddenRef.current = nextIsHidden;
      setIsSceneHidden(nextIsHidden);
    }

    function writeHeaderState(
      brandOpacity: number,
      shellOpacity: number,
      isHidden: boolean,
    ) {
      const brandElement = brandTargetRef.current;

      if (!brandElement) {
        return;
      }

      const headerElement = brandElement.closest(".site-header--intro-transition");

      brandElement.style.setProperty(
        "--site-header-brand-opacity",
        brandOpacity.toFixed(4),
      );
      brandElement.style.setProperty(
        "--site-header-brand-pointer-events",
        isHidden ? "none" : "auto",
      );

      if (headerElement instanceof HTMLElement) {
        headerElement.style.setProperty(
          "--site-header-shell-opacity",
          shellOpacity.toFixed(4),
        );
        headerElement.style.setProperty(
          "--site-header-shell-pointer-events",
          isHidden ? "none" : "auto",
        );
      }
    }

    function writeIdleState() {
      progressRef.current = 0;
      document.body.classList.add(ROOT_INTRO_BODY_CLASS);
      setHeaderContentVisibleState(false);
      setHeaderHiddenState(true);
      setSceneHiddenState(false);
      writeHeaderState(0, 0, true);
      variableElement.style.setProperty("--intro-backdrop-opacity", "1");
      variableElement.style.setProperty("--intro-brand-opacity", "1");
      variableElement.style.setProperty("--intro-brand-y", "0px");
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
      variableElement.style.setProperty("--intro-landing-opacity", "0");
      variableElement.style.setProperty(
        "--intro-landing-pointer-events",
        "none",
      );
      variableElement.style.setProperty("--intro-landing-y", "24px");
      variableElement.style.setProperty(
        "--intro-scene-pointer-events",
        "auto",
      );
      variableElement.style.setProperty("--intro-scene-visibility", "visible");
    }

    function writeEnteredState() {
      progressRef.current = 1;
      document.body.classList.remove(ROOT_INTRO_BODY_CLASS);
      setHeaderContentVisibleState(true);
      setHeaderHiddenState(false);
      setSceneHiddenState(true);
      writeHeaderState(1, 1, false);
      variableElement.style.setProperty("--intro-backdrop-opacity", "0");
      variableElement.style.setProperty("--intro-brand-opacity", "0");
      variableElement.style.setProperty("--intro-brand-y", "-10px");
      variableElement.style.setProperty("--intro-scene-opacity", "0");
      variableElement.style.setProperty(
        "--intro-scene-pointer-events",
        "none",
      );
      variableElement.style.setProperty("--intro-scene-visibility", "hidden");
      variableElement.style.setProperty("--intro-action-opacity", "0");
      variableElement.style.setProperty(
        "--intro-action-pointer-events",
        "none",
      );
      variableElement.style.setProperty("--intro-landing-opacity", "1");
      variableElement.style.setProperty(
        "--intro-landing-pointer-events",
        "auto",
      );
      variableElement.style.setProperty("--intro-landing-y", "0px");
    }

    function writeTransitionProgress(progress: number) {
      const headerHeight = getHeaderHeight();
      const viewportHeight = Math.max(1, window.innerHeight);
      const viewportWidth = Math.max(1, window.innerWidth);
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
      const travelProgress = smoothstep(normalize(progress, 0, LOGO_TRAVEL_END));
      const sceneFadeProgress = smoothstep(
        normalize(progress, SCENE_FADE_START, SCENE_FADE_END),
      );
      const headerBrandOpacity = smoothstep(
        normalize(progress, HEADER_BRAND_FADE_START, HEADER_BRAND_FADE_END),
      );
      const headerShellOpacity = smoothstep(
        normalize(progress, HEADER_SHELL_FADE_START, HEADER_SHELL_FADE_END),
      );
      const introBrandProgress = smoothstep(normalize(progress, 0.02, 0.34));
      const actionProgress = smoothstep(normalize(progress, 0, 0.28));
      const landingProgress = smoothstep(normalize(progress, 0.28, 0.98));
      const finalScale = getFinalSceneScale(
        headerLogoTarget.width,
        sceneOrigin.width,
        isMobile,
      );
      const finalTranslateX = headerLogoTarget.centerX - sceneOrigin.centerX;
      const finalTranslateY = headerLogoTarget.centerY - sceneOrigin.centerY;
      const scale = lerp(1, finalScale, travelProgress);
      const translateX = lerp(0, finalTranslateX, travelProgress);
      const translateY = lerp(0, finalTranslateY, travelProgress);
      const sceneOpacity = lerp(1, 0, sceneFadeProgress);
      const introBrandOpacity = lerp(1, 0, introBrandProgress);
      const introBrandY = lerp(0, -10, introBrandProgress);
      const actionOpacity = lerp(1, 0, actionProgress);
      const actionTranslateY = lerp(0, 16, actionProgress);
      const landingOpacity = lerp(0, 1, landingProgress);
      const landingTranslateY = lerp(24, 0, landingProgress);
      const backdropOpacity = lerp(1, 0, landingProgress);
      const isHeaderContentCurrentlyVisible =
        progress >= HEADER_CONTENT_REVEAL_START;
      const isSceneCurrentlyHidden = progress >= SCENE_HIDDEN_PROGRESS;

      progressRef.current = progress;
      setHeaderContentVisibleState(isHeaderContentCurrentlyVisible);
      setHeaderHiddenState(true);
      setSceneHiddenState(isSceneCurrentlyHidden);
      writeHeaderState(headerBrandOpacity, headerShellOpacity, true);
      variableElement.style.setProperty(
        "--intro-backdrop-opacity",
        backdropOpacity.toFixed(4),
      );
      variableElement.style.setProperty(
        "--intro-brand-opacity",
        introBrandOpacity.toFixed(4),
      );
      variableElement.style.setProperty(
        "--intro-brand-y",
        `${introBrandY.toFixed(2)}px`,
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
        progress > 0.1 ? "none" : "auto",
      );
      variableElement.style.setProperty(
        "--intro-landing-opacity",
        landingOpacity.toFixed(4),
      );
      variableElement.style.setProperty(
        "--intro-landing-pointer-events",
        progress > 0.72 ? "auto" : "none",
      );
      variableElement.style.setProperty(
        "--intro-landing-y",
        `${landingTranslateY.toFixed(2)}px`,
      );
      variableElement.style.setProperty(
        "--intro-scene-pointer-events",
        progress > 0.18 ? "none" : "auto",
      );
      variableElement.style.setProperty(
        "--intro-scene-visibility",
        isSceneCurrentlyHidden ? "hidden" : "visible",
      );
    }

    function requestCurrentStateWrite() {
      if (isDisposed) {
        return;
      }

      if (hasEnteredLanding) {
        writeEnteredState();
        return;
      }

      if (isTransitioning) {
        writeTransitionProgress(progressRef.current);
        return;
      }

      writeIdleState();
    }

    if (hasEnteredLanding) {
      writeEnteredState();
    } else if (!isTransitioning) {
      writeIdleState();
    } else if (reducedMotionQuery.matches) {
      writeEnteredState();
      onCompleteRef.current();
    } else {
      const startTime = performance.now();
      let headerRevealStartedAt: number | null = null;
      document.body.classList.add(ROOT_INTRO_BODY_CLASS);

      function tick(timestamp: number) {
        if (isDisposed) {
          return;
        }

        const rawProgress = clamp(
          (timestamp - startTime) / CLICK_TRANSITION_DURATION_MS,
          0,
          1,
        );

        if (
          rawProgress >= HEADER_CONTENT_REVEAL_START &&
          headerRevealStartedAt === null
        ) {
          headerRevealStartedAt = timestamp;
        }

        writeTransitionProgress(rawProgress);

        const headerRevealElapsed =
          headerRevealStartedAt === null ? 0 : timestamp - headerRevealStartedAt;

        if (
          rawProgress >= 1 &&
          headerRevealElapsed >= HEADER_CONTENT_REVEAL_MIN_DURATION_MS
        ) {
          writeEnteredState();
          onCompleteRef.current();
          return;
        }

        animationFrameId = window.requestAnimationFrame(tick);
      }

      animationFrameId = window.requestAnimationFrame(tick);
    }

    window.addEventListener("resize", requestCurrentStateWrite);
    window.addEventListener("load", requestCurrentStateWrite);
    window.visualViewport?.addEventListener("resize", requestCurrentStateWrite);

    return () => {
      isDisposed = true;
      window.removeEventListener("resize", requestCurrentStateWrite);
      window.removeEventListener("load", requestCurrentStateWrite);
      window.visualViewport?.removeEventListener(
        "resize",
        requestCurrentStateWrite,
      );

      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      document.body.classList.remove(ROOT_INTRO_BODY_CLASS);
    };
  }, [
    brandTargetRef,
    hasEnteredLanding,
    isTransitioning,
    sceneTargetRef,
  ]);

  return {
    isHeaderContentVisible,
    isHeaderHidden,
    isSceneHidden,
    transitionRef,
  };
}

function VietnamTime() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const updateTime = () => {
      setNow(new Date());
    };

    updateTime();
    const timeInterval = window.setInterval(updateTime, 1_000);

    return () => {
      window.clearInterval(timeInterval);
    };
  }, []);

  const date = now ? formatVietnamDate(now) : "---";
  const time = now ? vietnamTimeFormatter.format(now) : "--:--:--";

  return (
    <time className={styles.vietnamTime} dateTime={now?.toISOString()}>
      <span>{date}</span>
      <span aria-hidden="true" className={styles.timeSeparator}>
        {"\u00b7"}
      </span>
      <span>{time} ICT</span>
    </time>
  );
}

function formatVietnamDate(date: Date) {
  const dateParts = vietnamDateFormatter.formatToParts(date);
  const partValue = (type: Intl.DateTimeFormatPartTypes) =>
    dateParts.find((part) => part.type === type)?.value ?? "";

  return `${partValue("weekday")}, ${partValue("day")} ${partValue("month")} ${partValue("year")}`;
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

  const isMobile = viewportWidth <= 640;
  const fallbackWidth = isMobile
    ? Math.min(viewportWidth, 420)
    : Math.min(viewportWidth * 0.86, 840);
  const fallbackHeight = isMobile
    ? clamp(viewportHeight * 0.5, 310, 430)
    : clamp(viewportHeight * 0.55, 330, 640);

  return {
    centerX: viewportWidth / 2,
    centerY: headerHeight + (viewportHeight - headerHeight) * 0.48,
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

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}
