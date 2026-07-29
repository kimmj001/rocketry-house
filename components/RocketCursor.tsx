"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type CursorMode = "following" | "charging";

type FlightMode = "flying" | "parachuting" | "landing";

type ParticleKind = "energy" | "smoke" | "dust";

type Particle = {
  id: number;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  rotation: number;
};

type Crack = {
  id: number;
  x: number;
  y: number;
  rotation: number;
  createdAt: number;
};

type CursorView = {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  charge: number;
  flame: number;
  mode: CursorMode;
  showParachute: boolean;
};

type LaunchedRocket = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  previousVy: number;
  rotation: number;
  scale: number;
  charge: number;
  mode: FlightMode;
  showParachute: boolean;
  landingStartedAt: number | null;
};

const ROCKET_CONFIG = {
  maxChargeDuration: 2500,
  minLaunchSpeed: 560,
  maxLaunchSpeed: 1540,
  gravity: 1180,
  parachuteFallSpeed: 96,
  cursorSize: 42,
  crackThreshold: 0.9,
  followLerp: 0.2,
  defaultLaunchAngle: -125,
  noseTipOffset: 21,
  maxChargeParachuteCutoff: 0.98,
  quickClickCharge: 0.12,
  quickClickSpeedScale: 0.33,
  maxActiveLaunches: 4,
};

const ASSETS = {
  rocket: "/rocket-cursor.png",
  parachute: "/rocket-parachute.png",
  energy: "/rocket-energy-ring.png",
  smoke: "/rocket-smoke.png",
  crack: "/rocket-crack.png",
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;
const deg = (radians: number) => (radians * 180) / Math.PI;
const cursorCenterFromPointer = (pointer: { x: number; y: number }, rotation: number, scale = 1) => {
  const radians = (rotation * Math.PI) / 180;
  const noseX = Math.sin(radians) * ROCKET_CONFIG.noseTipOffset * scale;
  const noseY = -Math.cos(radians) * ROCKET_CONFIG.noseTipOffset * scale;

  return {
    x: pointer.x - noseX,
    y: pointer.y - noseY,
  };
};

let particleId = 0;
let crackId = 0;
let launchedRocketId = 0;

export default function RocketCursor() {
  const pathname = usePathname();
  const disabled = pathname === "/logo-reveal" || pathname.startsWith("/logo-reveal/");
  const [enabled, setEnabled] = useState(false);
  const [view, setView] = useState<CursorView>({
    x: -100,
    y: -100,
    rotation: -35,
    scale: 1,
    charge: 0,
    flame: 0,
    mode: "following",
    showParachute: false,
  });
  const [particles, setParticles] = useState<Particle[]>([]);
  const [cracks, setCracks] = useState<Crack[]>([]);
  const [launchedRockets, setLaunchedRockets] = useState<LaunchedRocket[]>([]);

  const viewRef = useRef(view);
  const pointerRef = useRef({ x: -100, y: -100 });
  const modeRef = useRef<CursorMode>("following");
  const chargeStartRef = useRef(0);
  const chargeRef = useRef(0);
  const particlesRef = useRef<Particle[]>([]);
  const cracksRef = useRef<Crack[]>([]);
  const launchedRocketsRef = useRef<LaunchedRocket[]>([]);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    if (disabled) {
      setEnabled(false);
      document.documentElement.classList.remove("rocket-cursor-enabled");
      document.body.classList.remove("rocket-cursor-impact");
      return;
    }

    const hasPointer = window.matchMedia("(pointer: fine)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    reducedMotionRef.current = reducedMotion;

    if (!hasPointer) {
      return;
    }

    setEnabled(true);
    document.documentElement.classList.add("rocket-cursor-enabled");

    let rafId = 0;
    let lastTime = performance.now();

    const addParticle = (kind: ParticleKind, x: number, y: number, charge = 0) => {
      if (reducedMotionRef.current && kind !== "dust") {
        return;
      }

      const angle = Math.random() * Math.PI * 2;
      const speed = kind === "energy" ? 24 + charge * 65 : kind === "smoke" ? 34 : 70;
      const size = kind === "energy" ? 18 + charge * 14 : kind === "smoke" ? 18 + Math.random() * 18 : 8 + Math.random() * 8;
      particlesRef.current.push({
        id: particleId++,
        kind,
        x,
        y,
        vx: Math.cos(angle) * speed - (kind === "smoke" ? 50 : 0),
        vy: Math.sin(angle) * speed + (kind === "smoke" ? 24 : -20),
        life: kind === "dust" ? 0.42 : kind === "smoke" ? 0.75 : 0.48,
        maxLife: kind === "dust" ? 0.42 : kind === "smoke" ? 0.75 : 0.48,
        size,
        rotation: Math.random() * 360,
      });
    };

    const addCrack = (x: number, y: number, rotation: number) => {
      if (reducedMotionRef.current) {
        return;
      }

      cracksRef.current = [
        ...cracksRef.current,
        {
          id: crackId++,
          x,
          y,
          rotation,
          createdAt: performance.now(),
        },
      ].slice(-2);

      document.body.classList.add("rocket-cursor-impact");
      window.setTimeout(() => document.body.classList.remove("rocket-cursor-impact"), 280);
    };

    const launch = (charge: number) => {
      const launchAngle = (ROCKET_CONFIG.defaultLaunchAngle * Math.PI) / 180;
      const motionScale = reducedMotionRef.current ? 0.34 : 1;
      const quickClickScale = charge < ROCKET_CONFIG.quickClickCharge ? ROCKET_CONFIG.quickClickSpeedScale : 1;
      const speed =
        (ROCKET_CONFIG.minLaunchSpeed + (ROCKET_CONFIG.maxLaunchSpeed - ROCKET_CONFIG.minLaunchSpeed) * charge) *
        quickClickScale *
        motionScale;
      const vx = Math.cos(launchAngle) * speed;
      const vy = Math.sin(launchAngle) * speed;
      const launchedRocket: LaunchedRocket = {
        id: launchedRocketId++,
        x: viewRef.current.x,
        y: viewRef.current.y,
        vx,
        vy,
        previousVy: vy,
        rotation: deg(Math.atan2(vy, vx)) + 90,
        scale: 1,
        charge,
        mode: "flying",
        showParachute: false,
        landingStartedAt: null,
      };

      launchedRocketsRef.current = [...launchedRocketsRef.current, launchedRocket].slice(-ROCKET_CONFIG.maxActiveLaunches);
      modeRef.current = "following";
      chargeRef.current = 0;
      viewRef.current = {
        ...viewRef.current,
        charge: 0,
        flame: 0,
        mode: "following",
        showParachute: false,
      };
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerRef.current = { x: event.clientX, y: event.clientY };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === "touch") {
        return;
      }

      const current = viewRef.current;
      modeRef.current = "charging";
      chargeStartRef.current = performance.now();
      chargeRef.current = 0;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      const rotation = -35;
      const center = cursorCenterFromPointer(pointerRef.current, rotation);
      viewRef.current = {
        ...current,
        x: center.x,
        y: center.y,
        rotation,
        mode: "charging",
        showParachute: false,
      };
    };

    const onPointerUp = () => {
      if (modeRef.current !== "charging") {
        return;
      }

      launch(clamp(chargeRef.current, 0, 1));
    };

    const resetToPointer = () => {
      modeRef.current = "following";
      chargeRef.current = 0;
      particlesRef.current = [];
      launchedRocketsRef.current = [];
      viewRef.current = {
        ...viewRef.current,
        charge: 0,
        flame: 0,
        mode: "following",
        showParachute: false,
      };
    };

    const updateParticles = (dt: number) => {
      particlesRef.current = particlesRef.current
        .map((particle) => ({
          ...particle,
          x: particle.x + particle.vx * dt,
          y: particle.y + particle.vy * dt,
          vy: particle.vy + (particle.kind === "dust" ? 160 : 30) * dt,
          life: particle.life - dt,
          rotation: particle.rotation + 80 * dt,
        }))
        .filter((particle) => particle.life > 0)
        .slice(-90);

      cracksRef.current = cracksRef.current.filter((crack) => performance.now() - crack.createdAt < 1300);
    };

    const updateLaunchedRockets = (dt: number, time: number) => {
      launchedRocketsRef.current = launchedRocketsRef.current
        .map((rocket) => {
          if (rocket.mode === "flying") {
            const x = rocket.x + rocket.vx * dt;
            const y = rocket.y + rocket.vy * dt;
            const previousVy = rocket.vy;
            const vy = rocket.vy + ROCKET_CONFIG.gravity * dt;
            const rotation = deg(Math.atan2(vy, rocket.vx)) + 90;

            if (Math.random() < 0.72) {
              const tailAngle = Math.atan2(vy, rocket.vx);
              addParticle("smoke", x - Math.cos(tailAngle) * 18, y - Math.sin(tailAngle) * 18, rocket.charge);
            }

            const offscreen =
              x < -90 ||
              x > window.innerWidth + 90 ||
              y < -90 ||
              y > window.innerHeight + 90;

            if (offscreen && rocket.charge >= ROCKET_CONFIG.crackThreshold) {
              const edgeX = clamp(x, 8, window.innerWidth - 8);
              const edgeY = clamp(y, 8, window.innerHeight - 8);
              addCrack(edgeX, edgeY, rotation);
              return null;
            }

            if (previousVy < 0 && vy >= 0 && rocket.charge < ROCKET_CONFIG.maxChargeParachuteCutoff) {
              return {
                ...rocket,
                x,
                y,
                vy,
                previousVy,
                rotation,
                mode: "parachuting" as const,
                showParachute: true,
              };
            }

            return {
              ...rocket,
              x,
              y,
              vy,
              previousVy,
              rotation,
              showParachute: false,
            };
          }

          if (rocket.mode === "parachuting") {
            const x = rocket.x + Math.sin(time / 380 + rocket.id) * 42 * dt;
            const y = rocket.y + ROCKET_CONFIG.parachuteFallSpeed * dt;

            if (y > window.innerHeight - 28) {
              for (let i = 0; i < 9; i += 1) {
                addParticle("dust", x, window.innerHeight - 20, 0);
              }

              return {
                ...rocket,
                x,
                y: window.innerHeight - 28,
                rotation: 0,
                scale: 1,
                mode: "landing" as const,
                showParachute: false,
                landingStartedAt: time,
              };
            }

            return {
              ...rocket,
              x,
              y,
              rotation: Math.sin(time / 270 + rocket.id) * 7,
              scale: 1,
              showParachute: true,
            };
          }

          const elapsed = rocket.landingStartedAt ? time - rocket.landingStartedAt : 0;
          const squash = elapsed < 180 ? 1 - Math.sin((elapsed / 180) * Math.PI) * 0.14 : 1;

          if (elapsed > 650) {
            return null;
          }

          return {
            ...rocket,
            scale: squash,
            showParachute: false,
          };
        })
        .filter((rocket): rocket is LaunchedRocket => rocket !== null);
    };

    const tick = (time: number) => {
      const dt = clamp((time - lastTime) / 1000, 0, 0.033);
      lastTime = time;
      const pointer = pointerRef.current;
      const current = viewRef.current;
      let next: CursorView = current;
      const mode = modeRef.current;

      if (mode === "following") {
        const rotation = -35;
        const center = cursorCenterFromPointer(pointer, rotation);
        next = {
          ...current,
          x: lerp(current.x, center.x, ROCKET_CONFIG.followLerp),
          y: lerp(current.y, center.y, ROCKET_CONFIG.followLerp),
          rotation,
          scale: 1,
          charge: 0,
          flame: 0,
          mode,
          showParachute: false,
        };
      }

      if (mode === "charging") {
        const charge = clamp((time - chargeStartRef.current) / ROCKET_CONFIG.maxChargeDuration, 0, 1);
        chargeRef.current = charge;

        if (Math.random() < 0.18 + charge * 0.34) {
          addParticle("energy", current.x, current.y + ROCKET_CONFIG.cursorSize * 0.5, charge);
        }

        const rotation = -35 + Math.sin(time / 18) * charge * 3;
        const scale = 1 + charge * 0.12;
        const center = cursorCenterFromPointer(pointer, rotation, scale);
        next = {
          ...current,
          x: center.x,
          y: center.y,
          rotation,
          scale,
          charge,
          flame: 0.24 + charge * 0.76,
          mode,
          showParachute: false,
        };
      }

      updateLaunchedRockets(dt, time);
      updateParticles(dt);
      viewRef.current = next;
      setView(next);
      setLaunchedRockets([...launchedRocketsRef.current]);
      setParticles([...particlesRef.current]);
      setCracks([...cracksRef.current]);
      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("blur", resetToPointer);
    document.addEventListener("visibilitychange", resetToPointer);
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("blur", resetToPointer);
      document.removeEventListener("visibilitychange", resetToPointer);
      document.documentElement.classList.remove("rocket-cursor-enabled");
      document.body.classList.remove("rocket-cursor-impact");
    };
  }, [disabled]);

  if (disabled || !enabled) {
    return null;
  }

  return (
    <div className="rocket-cursor-layer" aria-hidden="true">
      {cracks.map((crack) => (
        <img
          key={crack.id}
          src={ASSETS.crack}
          alt=""
          className="rocket-cursor-crack"
          style={{
            left: crack.x,
            top: crack.y,
            transform: `translate(-50%, -50%) rotate(${crack.rotation}deg)`,
          }}
        />
      ))}

      {particles.map((particle) => {
        const progress = 1 - particle.life / particle.maxLife;
        const opacity = clamp(1 - progress, 0, 1);
        return (
          <span
            key={particle.id}
            className={`rocket-cursor-particle rocket-cursor-particle-${particle.kind}`}
            style={{
              left: particle.x,
              top: particle.y,
              width: particle.size,
              height: particle.size,
              opacity,
              transform: `translate(-50%, -50%) scale(${0.7 + progress * 0.65}) rotate(${particle.rotation}deg)`,
            }}
          />
        );
      })}

      {launchedRockets.map((rocket) =>
        rocket.showParachute ? (
          <div
            key={`parachute-${rocket.id}`}
            className="rocket-cursor-parachute"
            style={{
              left: rocket.x,
              top: rocket.y - 76,
              transform: `translate(-50%, -50%) rotate(${-rocket.rotation * 0.45}deg)`,
            }}
          >
            <img src={ASSETS.parachute} alt="" />
            <span className="rocket-cursor-line rocket-cursor-line-left" />
            <span className="rocket-cursor-line rocket-cursor-line-right" />
          </div>
        ) : null
      )}

      {launchedRockets.map((rocket) => (
        <div
          key={rocket.id}
          className={`rocket-cursor-ship rocket-cursor-clone rocket-cursor-mode-${rocket.mode}`}
          style={{
            left: rocket.x,
            top: rocket.y,
            width: ROCKET_CONFIG.cursorSize,
            height: ROCKET_CONFIG.cursorSize,
            transform: `translate(-50%, -50%) rotate(${rocket.rotation}deg) scale(${rocket.scale})`,
          }}
        >
          <span
            className="rocket-cursor-flame"
            style={{
              opacity: rocket.mode === "flying" ? 0.56 : 0,
              transform: `translateX(-50%) scaleY(${rocket.mode === "flying" ? 0.91 : 0.35})`,
            }}
          />
          <img src={ASSETS.rocket} alt="" />
        </div>
      ))}

      {view.mode === "charging" && (
        <div className="rocket-cursor-charge" style={{ left: view.x, top: view.y + 34 }}>
          <span style={{ width: `${view.charge * 100}%` }} />
        </div>
      )}

      <div
        className={`rocket-cursor-ship rocket-cursor-mode-${view.mode}`}
        style={{
          left: view.x,
          top: view.y,
          width: ROCKET_CONFIG.cursorSize,
          height: ROCKET_CONFIG.cursorSize,
          transform: `translate(-50%, -50%) rotate(${view.rotation}deg) scale(${view.scale})`,
        }}
      >
        <span className="rocket-cursor-flame" style={{ opacity: view.flame, transform: `translateX(-50%) scaleY(${0.35 + view.flame})` }} />
        <img src={ASSETS.rocket} alt="" />
      </div>
    </div>
  );
}
