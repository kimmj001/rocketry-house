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
  wallRadius: number[];
  cells: number;
  refinementRatio: number;
};

export function meshDimensions(density: MeshDensity) {
  if (density === "research") return { nx: 220, ny: 88, refinementRatio: 8 };
  if (density === "fine") return { nx: 160, ny: 64, refinementRatio: 5 };
  if (density === "coarse") return { nx: 58, ny: 24, refinementRatio: 2 };
  return { nx: 104, ny: 42, refinementRatio: 3 };
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
  x[throatIndex] = geometry.convergenceLengthM;
  for (let i = 1; i < x.length; i += 1) {
    if (x[i] <= x[i - 1]) x[i] = x[i - 1] + uniformDx * 0.2;
  }
  const dx = x.slice(1).reduce((min, value, index) => Math.min(min, value - x[index]), uniformDx);
  const y = Array.from({ length: ny }, (_, j) => j * dy);
  const wallRadius = x.map((xM) => nozzleWallRadius(xM, geometry));
  const inside = Array.from({ length: nx * ny }, (_, index) => {
    const i = index % nx;
    const j = Math.floor(index / nx);
    return y[j] <= wallRadius[i] + dy * 0.45;
  });
  const cells = inside.filter(Boolean).length;

  return {
    nx,
    ny,
    dx,
    dy,
    x,
    y,
    inside,
    wallRadius,
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
