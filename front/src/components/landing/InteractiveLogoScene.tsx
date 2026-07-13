"use client";

import { Bounds, Center, Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { Suspense, type ReactNode, useEffect, useRef, useState } from "react";
import type { Group } from "three";
import styles from "./BelikemeIntroPage.module.css";

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

  return (
    <div
      className={`${styles.logoScene} ${
        isInteracting ? styles.logoSceneInteracting : ""
      }`}
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
                modelSrc={modelSrc}
                prefersReducedMotion={prefersReducedMotion}
              />
            </Center>
          </Bounds>
        </Suspense>

        <OrbitControls
          dampingFactor={0.08}
          enableDamping
          enablePan={false}
          enableZoom={false}
          maxPolarAngle={Math.PI / 1.65}
          minPolarAngle={Math.PI / 2.35}
          onEnd={() => setIsInteracting(false)}
          onStart={() => setIsInteracting(true)}
          rotateSpeed={0.62}
        />
      </Canvas>
    </div>
  );
}

function LogoModel({
  isInteracting,
  modelSrc,
  prefersReducedMotion,
}: {
  isInteracting: boolean;
  modelSrc: string;
  prefersReducedMotion: boolean;
}) {
  const groupRef = useRef<Group>(null);
  const { scene } = useGLTF(modelSrc);

  useFrame(({ clock }, delta) => {
    const group = groupRef.current;

    if (!group || prefersReducedMotion) {
      return;
    }

    const idleSpeed = isInteracting ? 0.035 : 0.22;
    group.rotation.y += delta * idleSpeed;
    group.rotation.x = Math.sin(clock.elapsedTime * 0.35) * 0.025;
  });

  return (
    <group ref={groupRef} rotation={[0, Math.PI, Math.PI]}>
      <primitive object={scene} />
    </group>
  );
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
