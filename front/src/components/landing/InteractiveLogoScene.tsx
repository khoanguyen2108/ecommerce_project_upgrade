"use client";

import { Bounds, Center, Html, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Suspense,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Group } from "three";
import styles from "./BelikemeIntroPage.module.css";

const FRONT_FACING_MODEL_ROTATION: [number, number, number] = [0, 0, 0];
const HORIZONTAL_DRAG_SPEED = 0.006;
const MAX_VERTICAL_ROTATION = Math.PI / 9;
const VERTICAL_DRAG_SPEED = 0.004;

interface ManualRotation {
  x: number;
  y: number;
}

interface PointerDragState {
  pointerId: number;
  startRotationX: number;
  startRotationY: number;
  startX: number;
  startY: number;
}

interface InteractiveLogoSceneProps {
  fallback: ReactNode;
  modelSrc: string;
}

export function InteractiveLogoScene({
  fallback,
  modelSrc,
}: InteractiveLogoSceneProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [isInteracting, setIsInteracting] = useState(false);
  const dragStateRef = useRef<PointerDragState | null>(null);
  const manualRotationRef = useRef<ManualRotation>({ x: 0, y: 0 });

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startRotationX: manualRotationRef.current.x,
      startRotationY: manualRotationRef.current.y,
      startX: event.clientX,
      startY: event.clientY,
    };
    setIsInteracting(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    manualRotationRef.current.y =
      dragState.startRotationY +
      (event.clientX - dragState.startX) * HORIZONTAL_DRAG_SPEED;
    manualRotationRef.current.x = clamp(
      dragState.startRotationX +
        (event.clientY - dragState.startY) * VERTICAL_DRAG_SPEED,
      -MAX_VERTICAL_ROTATION,
      MAX_VERTICAL_ROTATION,
    );
  }

  function handlePointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;

    if (!dragState || dragState.pointerId !== event.pointerId) {
      return;
    }

    dragStateRef.current = null;
    setIsInteracting(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      className={`${styles.logoScene} ${
        isInteracting ? styles.logoSceneInteracting : ""
      }`}
      onLostPointerCapture={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
    >
      <Canvas
        aria-label="Interactive 3D BELIKEME logo"
        camera={{ fov: 30, near: 0.1, far: 100, position: [0, 0.15, 6.2] }}
        className={styles.logoCanvas}
        dpr={[1, 1.65]}
        fallback={fallback}
        gl={{
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        }}
        role="img"
      >
        <ambientLight intensity={1.35} />
        <directionalLight intensity={3.1} position={[3.2, 4.4, 4.8]} />
        <directionalLight intensity={1.1} position={[-4.2, 1.6, -3.8]} />
        <pointLight color="#d7dde4" intensity={1.2} position={[0, 2.8, -3.5]} />

        <Suspense
          fallback={
            <Html center>
              <span className={styles.sceneLoading}>LOADING BELIKEME</span>
            </Html>
          }
        >
          <Bounds fit clip observe margin={1.72}>
            <Center>
              <LogoModel
                isInteracting={isInteracting}
                manualRotationRef={manualRotationRef}
                modelSrc={modelSrc}
                prefersReducedMotion={prefersReducedMotion}
              />
            </Center>
          </Bounds>
        </Suspense>
      </Canvas>
    </div>
  );
}

function LogoModel({
  isInteracting,
  manualRotationRef,
  modelSrc,
  prefersReducedMotion,
}: {
  isInteracting: boolean;
  manualRotationRef: MutableRefObject<ManualRotation>;
  modelSrc: string;
  prefersReducedMotion: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const { scene } = useGLTF(modelSrc);

  useFrame(({ clock }) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    const idleRotationX =
      !isInteracting && !prefersReducedMotion
        ? Math.sin(clock.elapsedTime * 0.24) * 0.018
        : 0;
    const idleRotationY =
      !isInteracting && !prefersReducedMotion
        ? Math.sin(clock.elapsedTime * 0.32) * 0.1
        : 0;

    group.rotation.x = manualRotationRef.current.x + idleRotationX;
    group.rotation.y = manualRotationRef.current.y + idleRotationY;
  });

  return (
    <group ref={groupRef} rotation={FRONT_FACING_MODEL_ROTATION}>
      <primitive object={scene} />
    </group>
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum);
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    function updatePreference() {
      setPrefersReducedMotion(mediaQuery.matches);
    }

    updatePreference();
    mediaQuery.addEventListener("change", updatePreference);

    return () => {
      mediaQuery.removeEventListener("change", updatePreference);
    };
  }, []);

  return prefersReducedMotion;
}
