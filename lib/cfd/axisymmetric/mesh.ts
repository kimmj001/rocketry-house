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

export function meshDimensions(density: MeshDensity) {
  if (density === "research") return { nx: 380, ny: 152, refinementRatio: 10 };
  if (density === "fine") return { nx: 276, ny: 108, refinementRatio: 7 };
  if (density === "coarse") return { nx: 100, ny: 40, refinementRatio: 3 };
  return { nx: 180, ny: 72, refinementRatio: 5 };
}

export function generateStructuredMesh(geometry: NozzleGeometry, density: MeshDensity): CfdMesh {
  const dimensions = meshDimensions(density);
  const nx = dimensions.nx;
  const ny = dimensions.ny;
  const uniformDx = geometry.totalLengthM / Math.max(nx - 1, 1);
  const dy = geometry.maxRadiusM / Math.max(ny - 1, 1);
  const x = Array.from({ length: nx }, (_, i) => i * uniformDx);
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
  const y = Array.from({ length: ny }, (_, j) => j * dy);
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
