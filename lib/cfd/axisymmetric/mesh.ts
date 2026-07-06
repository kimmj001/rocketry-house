import { nozzleWallRadius, type NozzleGeometry } from "@/lib/cfd/axisymmetric/geometry";
import type { NozzleCfdInputs } from "@/types/cfd";

export type MeshDensity = NozzleCfdInputs["meshDensity"];

export type CfdMesh = {
  nx: number;
  ny: number;
  dx: number;
  dy: number;
  x: number[];
  y: number[];
  inside: boolean[];
  fluid: boolean[];
  nozzleWallMask: boolean[];
  wallRadius: number[];
  nozzleExitIndex: number;
  cells: number;
  refinementRatio: number;
};

export function axialCellWidth(i: number, mesh: CfdMesh) {
  const left = i === 0 ? 0 : 0.5 * (mesh.x[i - 1] + mesh.x[i]);
  const right = i === mesh.nx - 1 ? mesh.x.at(-1)! + mesh.dx * 0.5 : 0.5 * (mesh.x[i] + mesh.x[i + 1]);
  return Math.max(right - left, mesh.dx * 0.1);
}

export function radialCellBounds(j: number, mesh: CfdMesh) {
  return {
    inner: Math.max(0, mesh.y[j] - mesh.dy * 0.5),
    outer: mesh.y[j] + mesh.dy * 0.5
  };
}

// Axisymmetric finite-volume measures with the common 2*pi factor omitted.
// The factor cancels from the conservative update while preserving the r weighting.
export function axisymmetricCellVolume(i: number, j: number, mesh: CfdMesh) {
  const { inner, outer } = radialCellBounds(j, mesh);
  const fluidOuter = Math.min(outer, mesh.wallRadius[i]);
  if (fluidOuter <= inner) return 0;
  return axialCellWidth(i, mesh) * 0.5 * (fluidOuter * fluidOuter - inner * inner);
}

export function meshDimensions(density: MeshDensity) {
  if (density === "research") return { nx: 300, ny: 120, refinementRatio: 10 };
  if (density === "fine") return { nx: 200, ny: 80, refinementRatio: 7 };
  if (density === "coarse") return { nx: 100, ny: 40, refinementRatio: 3 };
  return { nx: 128, ny: 52, refinementRatio: 5 };
}

export function generateStructuredMesh(geometry: NozzleGeometry, density: MeshDensity): CfdMesh {
  const dimensions = meshDimensions(density);
  const nx = dimensions.nx;
  const ny = dimensions.ny;
  const uniformDx = geometry.totalLengthM / Math.max(nx - 1, 1);
  const dy = geometry.maxRadiusM / Math.max(ny, 1);
  const x = Array.from({ length: nx }, (_, i) => (i + 0.5) * uniformDx);
  const throatIndex = x.reduce((best, value, index) =>
    Math.abs(value - geometry.convergenceLengthM) < Math.abs(x[best] - geometry.convergenceLengthM) ? index : best,
  0);
  const exitIndex = x.reduce((best, value, index) =>
    Math.abs(value - geometry.nozzleLengthM) < Math.abs(x[best] - geometry.nozzleLengthM) ? index : best,
  0);
  x[throatIndex] = geometry.convergenceLengthM;
  x[exitIndex] = geometry.nozzleLengthM;
  for (let i = 1; i < x.length; i += 1) {
    if (x[i] <= x[i - 1]) x[i] = x[i - 1] + uniformDx * 0.2;
  }
  const dx = x.slice(1).reduce((min, value, index) => Math.min(min, value - x[index]), uniformDx);
  const y = Array.from({ length: ny }, (_, j) => (j + 0.5) * dy);
  const wallRadius = x.map((xM) => nozzleWallRadius(xM, geometry));
  const fluid = Array.from({ length: nx * ny }, (_, index) => {
    const i = index % nx;
    const j = Math.floor(index / nx);
    const internalNozzle = x[i] <= geometry.nozzleLengthM + dx * 0.2;
    if (internalNozzle) return y[j] <= wallRadius[i] + dy * 0.45;
    return y[j] <= geometry.farfieldRadiusM + dy * 0.45;
  });
  const nozzleWallMask = Array.from({ length: nx * ny }, (_, index) => {
    const i = index % nx;
    const j = Math.floor(index / nx);
    if (x[i] > geometry.nozzleLengthM) return false;
    return y[j] > wallRadius[i] + dy * 0.45 && y[j] <= geometry.farfieldRadiusM + dy * 0.45;
  });
  const cells = fluid.filter(Boolean).length;

  return {
    nx,
    ny,
    dx,
    dy,
    x,
    y,
    inside: fluid,
    fluid,
    nozzleWallMask,
    wallRadius,
    nozzleExitIndex: exitIndex,
    cells,
    refinementRatio: dimensions.refinementRatio
  };
}

export function cellIndex(i: number, j: number, mesh: CfdMesh) {
  return j * mesh.nx + i;
}

export function isInside(i: number, j: number, mesh: CfdMesh) {
  if (i < 0 || j < 0 || i >= mesh.nx || j >= mesh.ny) return false;
  return mesh.inside[cellIndex(i, j, mesh)];
}
