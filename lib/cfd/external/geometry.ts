import { EXTERNAL_CFD_PRESETS } from "./constants";
import { ExternalCfdError, type ExternalCfdResolution, type SolverGrid } from "./types";
import type { RocketComponent } from "@/lib/types";

const EXTERNAL_BODY_TYPES = new Set<RocketComponent["type"]>([
  "nose_cone", "body_tube", "transition", "recovery_bay", "payload_section"
]);

function finitePositive(value: number | undefined, fallback = 0) {
  return Number.isFinite(value) && (value ?? 0) > 0 ? value as number : fallback;
}

function noseRadius(shape: RocketComponent["noseShape"], t: number, radius: number) {
  const x = Math.max(0, Math.min(1, t));
  if (shape === "Conical") return radius * x;
  if (shape === "Elliptical") return radius * Math.sqrt(Math.max(0, 1 - (1 - x) ** 2));
  if (shape === "Parabolic") return radius * (2 * x - x * x);
  if (shape === "Haack") {
    const theta = Math.acos(1 - 2 * x);
    const profile = (theta - Math.sin(2 * theta) / 2) / Math.PI;
    return radius * Math.sqrt(Math.max(0, profile));
  }
  return radius * Math.sqrt(Math.max(0, 2 * x - x * x));
}

function componentRadius(component: RocketComponent, xMm: number) {
  const start = component.position;
  const length = finitePositive(component.length);
  if (!length || xMm < start || xMm > start + length) return 0;
  const t = (xMm - start) / length;
  if (component.type === "nose_cone") return noseRadius(component.noseShape, t, finitePositive(component.diameter) / 2);
  if (component.type === "transition") {
    const fore = finitePositive(component.foreDiameter, component.diameter) / 2;
    const aft = finitePositive(component.aftDiameter, component.diameter) / 2;
    return fore + (aft - fore) * t;
  }
  return finitePositive(component.diameter) / 2;
}

function radiusAt(components: RocketComponent[], xMm: number) {
  let radius = 0;
  for (const component of components) {
    if (EXTERNAL_BODY_TYPES.has(component.type)) radius = Math.max(radius, componentRadius(component, xMm));
  }
  return radius;
}

function pointInPolygon(x: number, y: number, points: Array<{ x: number; y: number }>) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / ((b.y - a.y) || 1e-12) + a.x) inside = !inside;
  }
  return inside;
}

function finPolygons(components: RocketComponent[]) {
  const polygons: Array<Array<{ x: number; y: number }>> = [];
  for (const fin of components.filter((component) => component.type === "fins")) {
    const root = finitePositive(fin.finRootChord, fin.length);
    const tip = finitePositive(fin.finTipChord, root * 0.45);
    const span = finitePositive(fin.finSpan, fin.diameter * 0.8);
    const sweep = Number.isFinite(fin.finSweep) ? fin.finSweep ?? 0 : 0;
    const x0 = fin.position;
    const bodyRadius = Math.max(radiusAt(components, x0), finitePositive(fin.diameter) / 2);
    const top = [
      { x: x0, y: bodyRadius },
      { x: x0 + sweep, y: bodyRadius + span },
      { x: x0 + sweep + tip, y: bodyRadius + span },
      { x: x0 + root, y: bodyRadius }
    ];
    polygons.push(top, top.map((point) => ({ x: point.x, y: -point.y })));
  }
  return polygons;
}

export function rocketExtents(components: RocketComponent[]) {
  const physical = components.filter((component) => EXTERNAL_BODY_TYPES.has(component.type) || component.type === "fins");
  if (!physical.length) throw new ExternalCfdError("INVALID_GEOMETRY", "The rocket needs a nose, body, transition, or fin component before CFD can run.");
  const xMinMm = Math.min(...physical.map((component) => component.position));
  const xMaxMm = Math.max(...physical.map((component) => component.position + finitePositive(component.length, component.finRootChord ?? 0)));
  const lengthMm = xMaxMm - xMinMm;
  if (!Number.isFinite(lengthMm) || lengthMm <= 1) throw new ExternalCfdError("INVALID_GEOMETRY", "The rocket longitudinal geometry has no usable length.");
  let maxRadiusMm = 0;
  for (let i = 0; i <= 200; i += 1) maxRadiusMm = Math.max(maxRadiusMm, radiusAt(physical, xMinMm + lengthMm * i / 200));
  for (const fin of physical) if (fin.type === "fins") maxRadiusMm = Math.max(maxRadiusMm, finitePositive(fin.diameter) / 2 + finitePositive(fin.finSpan));
  return { xMinMm, xMaxMm, lengthMm, maxRadiusMm: Math.max(maxRadiusMm, lengthMm * 0.02) };
}

export function buildRocketGrid(components: RocketComponent[], resolution: ExternalCfdResolution): SolverGrid {
  const preset = EXTERNAL_CFD_PRESETS[resolution];
  const extents = rocketExtents(components);
  const rocketLengthM = extents.lengthMm / 1000;
  const upstreamM = rocketLengthM * 0.75;
  const downstreamM = rocketLengthM * 3;
  const halfHeightM = Math.max(rocketLengthM * 0.72, extents.maxRadiusMm / 1000 * 4);
  const xMinM = -upstreamM;
  const xMaxM = rocketLengthM + downstreamM;
  const yMinM = -halfHeightM;
  const yMaxM = halfHeightM;
  const dxM = (xMaxM - xMinM) / (preset.width - 1);
  const dyM = (yMaxM - yMinM) / (preset.height - 1);
  const mask = new Uint8Array(preset.width * preset.height);
  const polygons = finPolygons(components);

  for (let y = 0; y < preset.height; y += 1) {
    const yMm = (yMinM + y * dyM) * 1000;
    for (let x = 0; x < preset.width; x += 1) {
      const localXMm = (xMinM + x * dxM) * 1000 + extents.xMinMm;
      const body = Math.abs(yMm) <= radiusAt(components, localXMm);
      const fin = !body && polygons.some((polygon) => pointInPolygon(localXMm, yMm, polygon));
      mask[y * preset.width + x] = body || fin ? 1 : 0;
    }
  }

  const solidCells = mask.reduce((sum, value) => sum + value, 0);
  if (solidCells < 6) throw new ExternalCfdError("INVALID_GEOMETRY", "The rocket is too small for the selected CFD grid. Increase its dimensions or resolution.");
  return { width: preset.width, height: preset.height, mask, xMinM, xMaxM, yMinM, yMaxM, dxM, dyM, rocketLengthM };
}
