"use client";

import { useEffect, useRef, useState } from "react";

type CursorMode = "following" | "charging" | "flying" | "parachuting" | "landing" | "returning";

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

const ROCKET_CONFIG = {
  maxChargeDuration: 2500,
  minLaunchSpeed: 560,
  maxLaunchSpeed: 1540,
  gravity: 1180,
  parachuteFallSpeed: 96,
  cursorSize: 42,
  hotspotX: 21,
  hotspotY: 6,
  returnDuration: 450,
  crackThreshold: 0.9,
  followLerp: 0.2,
  defaultLaunchAngle: -55,
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
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

let particleId = 0;
let crackId = 0;

export default function RocketCursor() {
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

  const viewRef = useRef(view);
  const pointerRef = useRef({ x: -100, y: -100 });
  const modeRef = useRef<CursorMode>("following");
  const chargeStartRef = useRef(0);
  const chargeRef = useRef(0);
  const downRef = useRef({ x: 0, y: 0 });
  const flightRef = useRef({ x: -100, y: -100, vx: 0, vy: 0, previousVy: 0, charge: 0 });
  const landingRef = useRef({ startedAt: 0, x: 0, y: 0 });
  const returnRef = useRef({ startedAt: 0, fromX: 0, fromY: 0 });
  const particlesRef = useRef<Particle[]>([]);
  const cracksRef = useRef<Crack[]>([]);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
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
      const pointer = pointerRef.current;
      const dragX = pointer.x - downRef.current.x;
      const dragY = pointer.y - downRef.current.y;
      const dragDistance = Math.hypot(dragX, dragY);
      const launchAngle =
        dragDistance > 14
          ? Math.atan2(-dragY, -dragX)
          : (ROCKET_CONFIG.defaultLaunchAngle * Math.PI) / 180;
      const motionScale = reducedMotionRef.current ? 0.34 : 1;
      const speed =
        (ROCKET_CONFIG.minLaunchSpeed + (ROCKET_CONFIG.maxLaunchSpeed - ROCKET_CONFIG.minLaunchSpeed) * charge) *
        motionScale;

      modeRef.current = "flying";
      flightRef.current = {
        x: viewRef.current.x,
        y: viewRef.current.y,
        vx: Math.cos(launchAngle) * speed,
        vy: Math.sin(launchAngle) * speed,
        previousVy: Math.sin(launchAngle) * speed,
        charge,
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
      downRef.current = { x: event.clientX, y: event.clientY };
      pointerRef.current = { x: event.clientX, y: event.clientY };
      viewRef.current = {
        ...current,
        x: event.clientX - ROCKET_CONFIG.hotspotX + ROCKET_CONFIG.cursorSize / 2,
        y: event.clientY - ROCKET_CONFIG.hotspotY + ROCKET_CONFIG.cursorSize / 2,
        mode: "charging",
        showParachute: false,
      };
    };

    const onPointerUp = () => {
      if (modeRef.current !== "charging") {
        return;
      }

      launch(clamp(Math.max(chargeRef.current, 0.08), 0, 1));
    };

    const resetToPointer = () => {
      modeRef.current = "following";
      chargeRef.current = 0;
      particlesRef.current = [];
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

    const tick = (time: number) => {
      const dt = clamp((time - lastTime) / 1000, 0, 0.033);
      lastTime = time;
      const pointer = pointerRef.current;
      const current = viewRef.current;
      let next: CursorView = current;
      const mode = modeRef.current;

      if (mode === "following") {
        next = {
          ...current,
          x: lerp(current.x, pointer.x - ROCKET_CONFIG.hotspotX + ROCKET_CONFIG.cursorSize / 2, ROCKET_CONFIG.followLerp),
          y: lerp(current.y, pointer.y - ROCKET_CONFIG.hotspotY + ROCKET_CONFIG.cursorSize / 2, ROCKET_CONFIG.followLerp),
          rotation: -35,
          scale: 1,
          charge: 0,
          flame: 0,
          mode,
          showParachute: false,
        };
      }

      if (mode === "charging") {
        const charge = clamp((time - chargeStartRef.current) / ROCKET_CONFIG.maxChargeDuration, 0, 1);
        const shake = charge > 0.8 ? 4.6 : 2.3;
        const jitterX = Math.sin(time / 23) * shake * charge;
        const jitterY = Math.cos(time / 29) * shake * charge;
        chargeRef.current = charge;

        if (Math.random() < 0.18 + charge * 0.34) {
          addParticle("energy", current.x, current.y + ROCKET_CONFIG.cursorSize * 0.5, charge);
        }

        next = {
          ...current,
          x: pointer.x - ROCKET_CONFIG.hotspotX + ROCKET_CONFIG.cursorSize / 2 + jitterX,
          y: pointer.y - ROCKET_CONFIG.hotspotY + ROCKET_CONFIG.cursorSize / 2 + jitterY,
          rotation: -35 + Math.sin(time / 18) * charge * 3,
          scale: 1 + charge * 0.12,
          charge,
          flame: 0.24 + charge * 0.76,
          mode,
          showParachute: false,
        };
      }

      if (mode === "flying") {
        const flight = flightRef.current;
        flight.x += flight.vx * dt;
        flight.y += flight.vy * dt;
        flight.previousVy = flight.vy;
        flight.vy += ROCKET_CONFIG.gravity * dt;

        if (Math.random() < 0.72) {
          addParticle("smoke", flight.x - Math.cos(Math.atan2(flight.vy, flight.vx)) * 18, flight.y - Math.sin(Math.atan2(flight.vy, flight.vx)) * 18, flight.charge);
        }

        const offscreen =
          flight.x < -90 ||
          flight.x > window.innerWidth + 90 ||
          flight.y < -90 ||
          flight.y > window.innerHeight + 90;

        if (offscreen && flight.charge >= ROCKET_CONFIG.crackThreshold) {
          const edgeX = clamp(flight.x, 8, window.innerWidth - 8);
          const edgeY = clamp(flight.y, 8, window.innerHeight - 8);
          addCrack(edgeX, edgeY, deg(Math.atan2(flight.vy, flight.vx)));
          returnRef.current = { startedAt: time, fromX: edgeX, fromY: edgeY };
          modeRef.current = "returning";
        } else if (flight.previousVy < 0 && flight.vy >= 0) {
          modeRef.current = "parachuting";
        }

        next = {
          ...current,
          x: flight.x,
          y: flight.y,
          rotation: deg(Math.atan2(flight.vy, flight.vx)) + 90,
          scale: 1,
          charge: flight.charge,
          flame: modeRef.current === "flying" ? 0.56 : 0,
          mode: modeRef.current,
          showParachute: modeRef.current === "parachuting",
        };
      }

      if (mode === "parachuting") {
        const flight = flightRef.current;
        flight.y += ROCKET_CONFIG.parachuteFallSpeed * dt;
        flight.x += Math.sin(time / 380) * 42 * dt;

        if (flight.y > window.innerHeight - 28) {
          landingRef.current = { startedAt: time, x: flight.x, y: window.innerHeight - 28 };
          for (let i = 0; i < 9; i += 1) {
            addParticle("dust", flight.x, window.innerHeight - 20, 0);
          }
          modeRef.current = "landing";
        }

        next = {
          ...current,
          x: flight.x,
          y: flight.y,
          rotation: Math.sin(time / 270) * 7,
          scale: 1,
          charge: 0,
          flame: 0,
          mode: modeRef.current,
          showParachute: modeRef.current !== "landing",
        };
      }

      if (mode === "landing") {
        const elapsed = time - landingRef.current.startedAt;
        const squash = elapsed < 180 ? 1 - Math.sin((elapsed / 180) * Math.PI) * 0.14 : 1;
        next = {
          ...current,
          x: landingRef.current.x,
          y: landingRef.current.y,
          rotation: 0,
          scale: squash,
          charge: 0,
          flame: 0,
          mode,
          showParachute: elapsed < 360,
        };

        if (elapsed > 500) {
          returnRef.current = { startedAt: time, fromX: landingRef.current.x, fromY: landingRef.current.y };
          modeRef.current = "returning";
        }
      }

      if (mode === "returning") {
        const elapsed = time - returnRef.current.startedAt;
        const progress = clamp(elapsed / ROCKET_CONFIG.returnDuration, 0, 1);
        const eased = easeOutCubic(progress);
        const targetX = pointer.x - ROCKET_CONFIG.hotspotX + ROCKET_CONFIG.cursorSize / 2;
        const targetY = pointer.y - ROCKET_CONFIG.hotspotY + ROCKET_CONFIG.cursorSize / 2;

        next = {
          ...current,
          x: lerp(returnRef.current.fromX, targetX, eased),
          y: lerp(returnRef.current.fromY, targetY, eased),
          rotation: lerp(current.rotation, -35, 0.18),
          scale: 1,
          charge: 0,
          flame: 0,
          mode,
          showParachute: false,
        };

        if (progress >= 1) {
          modeRef.current = "following";
        }
      }

      updateParticles(dt);
      viewRef.current = next;
      setView(next);
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
  }, []);

  if (!enabled) {
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

      {view.showParachute && (
        <div
          className="rocket-cursor-parachute"
          style={{
            left: view.x,
            top: view.y - 76,
            transform: `translate(-50%, -50%) rotate(${-view.rotation * 0.45}deg)`,
          }}
        >
          <img src={ASSETS.parachute} alt="" />
          <span className="rocket-cursor-line rocket-cursor-line-left" />
          <span className="rocket-cursor-line rocket-cursor-line-right" />
        </div>
      )}

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
