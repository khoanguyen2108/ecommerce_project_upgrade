"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Component,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import styles from "./BelikemeIntroPage.module.css";
import { markBelikemeIntroSeen } from "./IntroGate";

const LANDING_LOGO_SRC = "/assets/landing/belikeme-logo.png";
const LANDING_MODEL_SRC = "/assets/landing/belikeme-logo-3d.glb";
const SHOP_HREF = "/";
const INTRO_EXIT_DURATION_MS = 520;

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

export function BelikemeIntroPage() {
  const router = useRouter();
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    document.body.classList.add("belikeme-intro-active");

    return () => {
      document.body.classList.remove("belikeme-intro-active");
    };
  }, []);

  useEffect(() => {
    if (!isLeaving) {
      return;
    }

    const transitionTimer = window.setTimeout(() => {
      router.push(SHOP_HREF);
    }, INTRO_EXIT_DURATION_MS);

    return () => {
      window.clearTimeout(transitionTimer);
    };
  }, [isLeaving, router]);

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

    if (isLeaving) {
      return;
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(SHOP_HREF);
      return;
    }

    setIsLeaving(true);
  }

  return (
    <main
      aria-busy={isLeaving}
      className={`${styles.page}${isLeaving ? ` ${styles.pageLeaving}` : ""}`}
    >
      <div className={styles.background} aria-hidden="true" />
      <div className={styles.overlay} aria-hidden="true" />
      <div className={styles.transitionVeil} aria-hidden="true" />

      <section className={styles.stage} aria-labelledby="belikeme-intro-title">
        <div className={styles.brandSlot}>
          <img
            alt="BELIKEME"
            className={styles.brandLogo}
            src={LANDING_LOGO_SRC}
          />
        </div>

        <div
          aria-label="Interactive 3D BELIKEME logo. Drag to rotate the logo."
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
          <h1 className={styles.srOnly} id="belikeme-intro-title">
            BELIKEME cinematic logo intro
          </h1>
          <Link
            className={styles.shopButton}
            href={SHOP_HREF}
            onClick={handleShopNow}
            tabIndex={isLeaving ? -1 : undefined}
          >
            SHOP NOW
          </Link>
        </div>
      </section>
    </main>
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
