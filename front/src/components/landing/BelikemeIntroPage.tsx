"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Component, type ReactNode, useEffect } from "react";
import styles from "./BelikemeIntroPage.module.css";
import { markBelikemeIntroSeen } from "./IntroGate";

const LANDING_LOGO_SRC = "/assets/landing/belikeme-logo.png";
const LANDING_MODEL_SRC = "/assets/landing/belikeme-logo-3d.glb";
const SHOP_HREF = "/";

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
  useEffect(() => {
    document.body.classList.add("belikeme-intro-active");

    return () => {
      document.body.classList.remove("belikeme-intro-active");
    };
  }, []);

  return (
    <main className={styles.page}>
      <div className={styles.background} aria-hidden="true" />
      <div className={styles.overlay} aria-hidden="true" />

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
            onClick={markBelikemeIntroSeen}
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
