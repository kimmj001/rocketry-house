"use client";

import { useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { RocketComponent } from "@/lib/types";
import { sortComponents, totalLength } from "@/lib/cad/geometry";

const UNIT = 155;
const SCENE_Y_OFFSET = -1.85;
const VIEW_TARGET_Y = 1.35;

function axialCenter(component: RocketComponent, total: number) {
  return (component.position + component.length / 2 - total / 2) / UNIT;
}

function radius(component: RocketComponent, divisor = 2) {
  return component.diameter / divisor / UNIT;
}

function cylinderLength(component: RocketComponent) {
  return Math.max(component.length / UNIT, 0.02);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getFinPlanformPoints(component: RocketComponent) {
  const root = component.finRootChord ?? component.length;
  const tip = component.finTipChord ?? component.length * 0.48;
  const span = component.finSpan ?? component.diameter * 1.25;
  const sweep = component.finSweep ?? component.length * 0.25;
  const freeform = [
    { x: 0, y: 0 },
    { x: 44, y: 12 },
    { x: 155, y: 0 },
    { x: 118, y: 54 },
    { x: 68, y: 86 },
    { x: 12, y: 38 }
  ];

  if (component.finPlanform === "Freeform") {
    const source = component.finFreeformPoints?.length ? component.finFreeformPoints : freeform;
    return source.map((point) => ({ x: clamp(point.x, -root * 0.4, root * 1.4), y: clamp(point.y, 0, span * 1.35) }));
  }

  if (component.finPlanform === "Forward swept") {
    return [
      { x: 0, y: 0 },
      { x: root, y: 0 },
      { x: root + sweep, y: span },
      { x: Math.max(0, sweep) + Math.max(26, tip * 0.18), y: span }
    ];
  }

  if (component.finPlanform === "Elliptical") {
    return [
      { x: 0, y: 0 },
      { x: root * 0.24, y: span * 0.2 },
      { x: root * 0.58, y: span * 0.96 },
      { x: root * 0.9, y: span * 0.84 },
      { x: root, y: 0 }
    ];
  }

  if (component.finPlanform === "Split fin") {
    return [
      { x: 0, y: 0 },
      { x: root * 0.34, y: 0 },
      { x: root * 0.48, y: span * 0.44 },
      { x: root * 0.62, y: span * 0.15 },
      { x: root, y: span * 0.15 },
      { x: sweep + tip, y: span },
      { x: sweep, y: span },
      { x: root * 0.38, y: span * 0.5 }
    ];
  }

  if (component.finPlanform === "Tube fin") {
    return [
      { x: 0, y: span * 0.18 },
      { x: root * 0.18, y: 0 },
      { x: root * 0.82, y: 0 },
      { x: root, y: span * 0.18 },
      { x: root, y: span * 0.82 },
      { x: root * 0.82, y: span },
      { x: root * 0.18, y: span },
      { x: 0, y: span * 0.82 }
    ];
  }

  return [
    { x: 0, y: 0 },
    { x: root, y: 0 },
    { x: sweep + tip, y: span },
    { x: sweep, y: span }
  ];
}

function materialFor(component: RocketComponent) {
  if (component.type === "body_tube" || component.type === "payload_section") return { color: "#e7dfd0", opacity: 0.86 };
  if (component.type === "motor_mount" || component.type === "motor_retainer" || component.type === "engine_block") return { color: "#5b626a", opacity: 0.86 };
  if (component.type === "motor_nozzle") return { color: "#15171a", opacity: 1 };
  if (component.type === "recovery_bay" || component.type === "shock_cord") return { color: "#d7b56d", opacity: 0.22 };
  if (component.type === "coupler" || component.type === "bulkhead" || component.type === "centering_rings") return { color: "#7dd3fc", opacity: 0.72 };
  return { color: "#e7dfd0", opacity: 0.86 };
}

function NoseCone({ component, total }: { component: RocketComponent; total: number }) {
  const geometry = useMemo(() => {
    const length = cylinderLength(component);
    const baseRadius = radius(component);
    const shoulderLength = Math.min(length * 0.18, 0.12);
    const profile: THREE.Vector2[] = [];
    const segments = 18;
    for (let i = 0; i <= segments; i += 1) {
      const t = i / segments;
      const z = t * (length - shoulderLength);
      const shape = component.noseShape ?? "Ogive";
      const r =
        shape === "Conical" ? baseRadius * t :
        shape === "Elliptical" ? baseRadius * Math.sqrt(Math.max(0, 1 - (1 - t) ** 2)) :
        shape === "Haack" ? baseRadius * Math.sqrt(Math.max(0, (Math.acos(1 - 2 * t) - Math.sin(2 * Math.acos(1 - 2 * t)) / 2) / Math.PI)) :
        shape === "Parabolic" ? baseRadius * (2 * t - t ** 2) :
        baseRadius * Math.sin((t * Math.PI) / 2) ** 0.72;
      profile.push(new THREE.Vector2(r, z));
    }
    profile.push(new THREE.Vector2(baseRadius * 0.86, length - shoulderLength));
    profile.push(new THREE.Vector2(baseRadius * 0.86, length));
    profile.push(new THREE.Vector2(baseRadius * 0.58, length));
    const geo = new THREE.LatheGeometry(profile, 72);
    geo.rotateX(Math.PI / 2);
    return geo;
  }, [component.diameter, component.length, component.noseShape, component.shapeParameter, component.position]);
  const tipZ = (component.position - total / 2) / UNIT;
  return (
    <mesh geometry={geometry} position={[0, 0, tipZ]}>
      <meshStandardMaterial color="#f4efe5" metalness={0.12} roughness={0.38} />
    </mesh>
  );
}

function TubeShell({ component, total }: { component: RocketComponent; total: number }) {
  const z = axialCenter(component, total);
  const r = radius(component);
  const length = cylinderLength(component);
  const material = materialFor(component);
  return (
    <group position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[r, r, length, 64]} />
        <meshStandardMaterial color={material.color} transparent opacity={material.opacity} metalness={0.06} roughness={0.48} />
      </mesh>
      <mesh position={[0, length / 2 + 0.004, 0]}>
        <torusGeometry args={[r * 0.985, 0.012, 10, 64]} />
        <meshStandardMaterial color="#d7b56d" transparent opacity={0.28} roughness={0.35} />
      </mesh>
    </group>
  );
}

function TransitionShell({ component, total }: { component: RocketComponent; total: number }) {
  const z = axialCenter(component, total);
  const foreRadius = Math.max((component.foreDiameter ?? component.diameter) / 2 / UNIT, 0.018);
  const aftRadius = Math.max((component.aftDiameter ?? component.diameter * 0.8) / 2 / UNIT, 0.018);
  const length = cylinderLength(component);
  return (
    <group position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[aftRadius, foreRadius, length, 72, 1, true]} />
        <meshStandardMaterial color="#e7dfd0" transparent opacity={0.84} metalness={0.08} roughness={0.44} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -length / 2, 0]}>
        <torusGeometry args={[aftRadius, 0.01, 10, 64]} />
        <meshStandardMaterial color="#d7b56d" transparent opacity={0.32} roughness={0.35} />
      </mesh>
      <mesh position={[0, length / 2, 0]}>
        <torusGeometry args={[foreRadius, 0.01, 10, 64]} />
        <meshStandardMaterial color="#d7b56d" transparent opacity={0.32} roughness={0.35} />
      </mesh>
    </group>
  );
}

function InternalBand({ component, total }: { component: RocketComponent; total: number }) {
  const z = axialCenter(component, total);
  const r = radius(component);
  return (
    <mesh position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[r, 0.012, 10, 56]} />
      <meshStandardMaterial color="#7dd3fc" transparent opacity={0.36} roughness={0.38} />
    </mesh>
  );
}

function RingPair({ component, total }: { component: RocketComponent; total: number }) {
  const positions = [component.position, component.position + component.length + 170].map((start) => (start + component.length / 2 - total / 2) / UNIT);
  return (
    <group>
      {positions.map((z) => (
        <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[radius(component), radius(component), 0.045, 48]} />
          <meshStandardMaterial color="#7dd3fc" transparent opacity={0.75} roughness={0.38} />
        </mesh>
      ))}
    </group>
  );
}

function FinPlate({ component, total, angle, selected = false }: { component: RocketComponent; total: number; angle: number; selected?: boolean }) {
  const geometry = useMemo(() => {
    const thickness = Math.max(component.wallThickness, 2.5) / UNIT;
    const bodyRadius = component.diameter / 2 / UNIT;
    const planform = getFinPlanformPoints(component);

    const radial = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
    const tangent = new THREE.Vector3(-Math.sin(angle), Math.cos(angle), 0);

    const makePoint = (point: { x: number; y: number }, side: number) => {
      const r = bodyRadius + point.y / UNIT;
      const z = (component.position + point.x - total / 2) / UNIT;
      return radial.clone().multiplyScalar(r).add(tangent.clone().multiplyScalar((side * thickness) / 2)).add(new THREE.Vector3(0, 0, z));
    };

    const front = planform.map((point) => makePoint(point, 1));
    const back = planform.map((point) => makePoint(point, -1));
    const vertices = [...front, ...back];
    const faces: number[] = [];
    for (let index = 1; index < planform.length - 1; index += 1) {
      faces.push(0, index, index + 1);
      faces.push(planform.length, planform.length + index + 1, planform.length + index);
    }
    for (let index = 0; index < planform.length; index += 1) {
      const next = (index + 1) % planform.length;
      faces.push(index, planform.length + index, planform.length + next);
      faces.push(index, planform.length + next, next);
    }
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints(vertices);
    geo.setIndex(faces);
    geo.computeVertexNormals();
    return geo;
  }, [angle, component.diameter, component.finFreeformPoints, component.finPlanform, component.finRootChord, component.finSpan, component.finSweep, component.finTipChord, component.length, component.position, component.wallThickness, total]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color={selected ? "#f97316" : "#5fb8ff"} transparent opacity={selected ? 0.52 : 1} roughness={0.34} metalness={0.08} side={THREE.DoubleSide} />
    </mesh>
  );
}

function FinSet({ component, total }: { component: RocketComponent; total: number }) {
  const count = component.finCount ?? 4;
  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2;
        return <FinPlate key={i} component={component} total={total} angle={angle} />;
      })}
    </group>
  );
}

function MotorNozzle({ component, total }: { component: RocketComponent; total: number }) {
  const aftZ = (component.position + component.length - total / 2) / UNIT;
  const casingRadius = radius(component);
  const throat = Math.max(casingRadius * 0.22, 0.026);
  const exit = Math.max(casingRadius * 0.58, throat * 1.75);
  const length = cylinderLength(component);
  return (
    <group position={[0, 0, aftZ]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh position={[0, -length * 0.16, 0]}>
        <cylinderGeometry args={[casingRadius * 0.72, casingRadius * 0.72, length * 0.18, 64]} />
        <meshStandardMaterial color="#4d5458" metalness={0.32} roughness={0.34} />
      </mesh>
      <mesh position={[0, -length * 0.43, 0]}>
        <cylinderGeometry args={[casingRadius * 0.62, throat, length * 0.38, 64, 1, true]} />
        <meshStandardMaterial color="#d6d2c8" metalness={0.24} roughness={0.36} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -length * 0.82, 0]}>
        <cylinderGeometry args={[throat, exit, length * 0.45, 64, 1, true]} />
        <meshStandardMaterial color="#2b3035" metalness={0.25} roughness={0.44} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -length * 1.06, 0]}>
        <torusGeometry args={[exit * 0.96, 0.012, 12, 64]} />
        <meshStandardMaterial color="#e6e0d4" metalness={0.22} roughness={0.34} />
      </mesh>
    </group>
  );
}

function SavedMotorCase({ component, total }: { component: RocketComponent; total: number }) {
  const z = axialCenter(component, total);
  const caseRadius = radius(component);
  const length = cylinderLength(component);
  const throat = Math.max(caseRadius * 0.2, 0.022);
  const exit = Math.max(caseRadius * 0.55, throat * 1.9);
  return (
    <group position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[caseRadius, caseRadius, length, 64]} />
        <meshStandardMaterial color="#8f948e" metalness={0.35} roughness={0.31} transparent opacity={0.78} />
      </mesh>
      <mesh position={[0, length / 2 + 0.012, 0]}>
        <cylinderGeometry args={[caseRadius * 1.05, caseRadius * 1.05, 0.035, 64]} />
        <meshStandardMaterial color="#b7b3aa" metalness={0.28} roughness={0.35} />
      </mesh>
      <mesh position={[0, -length / 2 - 0.012, 0]}>
        <cylinderGeometry args={[caseRadius * 1.04, caseRadius * 1.04, 0.04, 64]} />
        <meshStandardMaterial color="#60686d" metalness={0.32} roughness={0.34} />
      </mesh>
      <mesh position={[0, -length / 2 - 0.12, 0]}>
        <cylinderGeometry args={[caseRadius * 0.62, throat, 0.22, 64, 1, true]} />
        <meshStandardMaterial color="#d6d2c8" metalness={0.24} roughness={0.36} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -length / 2 - 0.31, 0]}>
        <cylinderGeometry args={[throat, exit, 0.26, 64, 1, true]} />
        <meshStandardMaterial color="#252b31" metalness={0.27} roughness={0.44} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -length / 2 - 0.45, 0]}>
        <torusGeometry args={[exit * 0.96, 0.011, 12, 64]} />
        <meshStandardMaterial color="#e6e0d4" metalness={0.2} roughness={0.38} />
      </mesh>
    </group>
  );
}

function SelectionOverlay({ component, total }: { component: RocketComponent; total: number }) {
  const z = axialCenter(component, total);
  const r = Math.max(radius(component) * 1.08, 0.04);
  const length = Math.max(cylinderLength(component), 0.04);
  const color = "#f97316";

  if (component.type === "nose_cone") {
    return (
      <mesh position={[0, 0, (component.position + component.length * 0.55 - total / 2) / UNIT]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[r * 1.18, length * 0.95, 72, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.22} side={THREE.DoubleSide} />
      </mesh>
    );
  }

  if (component.type === "fins") {
    const count = component.finCount ?? 4;
    return (
      <group>
        {Array.from({ length: count }, (_, index) => (
          <FinPlate key={index} component={{ ...component, finSpan: (component.finSpan ?? component.diameter) + 10, wallThickness: Math.max(component.wallThickness, 4) }} total={total} angle={(index / count) * Math.PI * 2} selected />
        ))}
      </group>
    );
  }

  return (
    <group position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[r, r, length, 64, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -length / 2, 0]}>
        <torusGeometry args={[r, 0.018, 10, 64]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.72} />
      </mesh>
      <mesh position={[0, length / 2, 0]}>
        <torusGeometry args={[r, 0.018, 10, 64]} />
        <meshBasicMaterial color="#facc15" transparent opacity={0.72} />
      </mesh>
    </group>
  );
}

function ComponentMesh({ component, total, selected = false, onSelect }: { component: RocketComponent; total: number; selected?: boolean; onSelect?: (id: string) => void }) {
  const z = axialCenter(component, total);
  const content = (() => {
  if (component.type === "nose_cone") {
    return <NoseCone component={component} total={total} />;
  }
  if (component.type === "fins") return <FinSet component={component} total={total} />;
  if (component.type === "transition") return <TransitionShell component={component} total={total} />;
  if (component.type === "centering_rings") return <RingPair component={component} total={total} />;
  if (component.type === "motor_nozzle") return <MotorNozzle component={component} total={total} />;
  if (component.type === "coupler" || component.type === "bulkhead") return <InternalBand component={component} total={total} />;
  if (component.type === "shock_cord" || component.type === "engine_block") return null;
  if (component.type === "recovery_bay") return <InternalBand component={component} total={total} />;
  if (component.type === "motor_mount" && component.material === "Saved motor") return <SavedMotorCase component={component} total={total} />;
  if (component.type === "rail_buttons") {
    return (
      <group position={[0, 0, z]}>
        {[0, 1].map((offset) => (
          <mesh key={offset} position={[0, radius(component, 0.55), offset ? 1.25 : -0.75]} rotation={[0, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.08, 24]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.2} />
          </mesh>
        ))}
      </group>
    );
  }
  const material = materialFor(component);
  const r = radius(component);
  if (component.type === "body_tube" || component.type === "payload_section") return <TubeShell component={component} total={total} />;
  return (
    <mesh position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[r, r, cylinderLength(component), 48]} />
      <meshStandardMaterial color={material.color} transparent opacity={material.opacity} metalness={0.08} roughness={0.48} />
    </mesh>
  );
  })();

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.(component.id);
      }}
    >
      {content}
      {selected ? <SelectionOverlay component={component} total={total} /> : null}
    </group>
  );
}

export function RocketViewer3D({ components, selectedComponentId, onSelectComponent }: { components: RocketComponent[]; selectedComponentId?: string; onSelectComponent?: (id: string) => void }) {
  const sorted = sortComponents(components);
  const length = totalLength(sorted);
  const halfLength = length / UNIT / 2;
  const fin = sorted.find((component) => component.type === "fins");
  const motor = sorted.find((component) => component.type === "motor_mount");
  return (
    <div className="h-[420px] overflow-hidden rounded-lg border border-white/10 bg-[#080b14]">
      <Canvas>
        <PerspectiveCamera makeDefault position={[4.2, 5.2, 7.2]} fov={42} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[4, 4, 6]} intensity={1.5} />
        <pointLight position={[-3, -2, 3]} intensity={1} color="#5fb8ff" />
        <group position={[0, SCENE_Y_OFFSET, 0]}>
          <group position={[0, halfLength, 0]} rotation={[Math.PI / 2, 0, 0]}>
            {sorted.map((component) => <ComponentMesh key={component.id} component={component} total={length} selected={component.id === selectedComponentId} onSelect={onSelectComponent} />)}
            {selectedComponentId ? (
              <Html position={[1.05, 1.08, axialCenter(sorted.find((component) => component.id === selectedComponentId) ?? sorted[0], length)]} className="pointer-events-none">
                <span className="whitespace-nowrap rounded border border-orange-200/45 bg-black/65 px-2 py-1 text-[10px] font-semibold text-orange-100 shadow-lg">selected component</span>
              </Html>
            ) : null}
            {fin && (
              <Html position={[0.7, 0.9, axialCenter(fin, length)]} className="pointer-events-none">
                <span className="whitespace-nowrap rounded bg-black/55 px-2 py-1 text-[10px] text-cyan-100">fin can / CP driver</span>
              </Html>
            )}
            {motor && (
              <Html position={[-1.1, -0.7, axialCenter(motor, length)]} className="pointer-events-none">
                <span className="whitespace-nowrap rounded bg-black/55 px-2 py-1 text-[10px] text-orange-100">29 mm motor mount</span>
              </Html>
            )}
          </group>
          <gridHelper args={[8, 16, "#31516b", "#1b2738"]} position={[0, 0, 0]} />
        </group>
        <OrbitControls enablePan enableZoom target={[0, VIEW_TARGET_Y, 0]} />
      </Canvas>
    </div>
  );
}
