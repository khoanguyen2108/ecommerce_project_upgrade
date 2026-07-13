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
          <VietnamTime />
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
        ·
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
