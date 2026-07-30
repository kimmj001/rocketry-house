import type { BodyFittedMesh, NozzleGeometryConfig, ResolutionPreset } from "./types";

const PI = Math.PI;

const smoothStep = (value: number) => value * value * (3 - 2 * value);

export function nozzleLength(geometry: NozzleGeometryConfig) {
  return geometry.chamberLengthM + geometry.convergentLengthM + geometry.divergentLengthM;
}

export function domainLength(geometry: NozzleGeometryConfig) {
  return nozzleLength(geometry) + Math.max(geometry.externalLengthM, geometry.exitRadiusM * 8);
}

export function throatX(geometry: NozzleGeometryConfig) {
  return geometry.chamberLengthM + geometry.convergentLengthM;
}

export function wallRadiusAt(xM: number, geometry: NozzleGeometryConfig) {
  if (xM <= geometry.chamberLengthM) return geometry.chamberRadiusM;
  const throatXM = throatX(geometry);
  if (xM <= throatXM) {
    const t = Math.max(0, Math.min(1, (xM - geometry.chamberLengthM) / geometry.convergentLengthM));
    return geometry.chamberRadiusM + (geometry.throatRadiusM - geometry.chamberRadiusM) * smoothStep(t);
  }
  const t = Math.max(0, Math.min(1, (xM - throatXM) / geometry.divergentLengthM));
  return geometry.throatRadiusM + (geometry.exitRadiusM - geometry.throatRadiusM) * smoothStep(t);
}

export function outerRadiusAt(xM: number, geometry: NozzleGeometryConfig) {
  const nozzleLengthM = nozzleLength(geometry);
  if (xM <= nozzleLengthM) return wallRadiusAt(xM, geometry);
  const farfieldRadiusM = Math.max(
    geometry.farfieldRadiusM,
    geometry.exitRadiusM * 3,
    geometry.chamberRadiusM * 1.5
  );
  const expansionLengthM = Math.min(
    Math.max(geometry.externalLengthM, geometry.exitRadiusM * 8),
    Math.max(nozzleLengthM * 1.6, (farfieldRadiusM - geometry.exitRadiusM) * 2.5)
  );
  const t = Math.max(0, Math.min(1, (xM - nozzleLengthM) / Math.max(expansionLengthM, 1e-8)));
  return geometry.exitRadiusM + (farfieldRadiusM - geometry.exitRadiusM) * smoothStep(t);
}

export function wallSlopeAt(xM: number, geometry: NozzleGeometryConfig) {
  const length = nozzleLength(geometry);
  const h = Math.max(length * 1e-5, 1e-7);
  const left = wallRadiusAt(Math.max(0, xM - h), geometry);
  const right = wallRadiusAt(Math.min(length, xM + h), geometry);
  return (right - left) / Math.max(Math.min(length, xM + h) - Math.max(0, xM - h), h);
}

export function resolutionDimensions(preset: ResolutionPreset) {
  if (preset === "high") return { nozzleNx: 240, externalNx: 176, nr: 80 };
  if (preset === "standard") return { nozzleNx: 160, externalNx: 128, nr: 56 };
  return { nozzleNx: 96, externalNx: 96, nr: 36 };
}

function cellIndex(i: number, j: number, nr: number) {
  return i * nr + j;
}

export function createBodyFittedMesh(
  geometry: NozzleGeometryConfig,
  resolution: ResolutionPreset,
  nxOverride?: number,
  nrOverride?: number
): BodyFittedMesh {
  const preset = resolutionDimensions(resolution);
  const nx = Math.max(32, Math.round(nxOverride ?? preset.nozzleNx + preset.externalNx));
  const nr = Math.max(12, Math.round(nrOverride ?? preset.nr));
  const nozzleLengthM = nozzleLength(geometry);
  const lengthM = domainLength(geometry);
  const nozzleNx = nxOverride
    ? Math.max(16, Math.min(nx - 16, Math.round(nx * 0.5)))
    : preset.nozzleNx;
  const externalNx = nx - nozzleNx;
  const externalLengthM = lengthM - nozzleLengthM;
  const xFaces = new Float64Array(nx + 1);
  for (let i = 0; i <= nozzleNx; i += 1) xFaces[i] = nozzleLengthM * i / nozzleNx;
  for (let i = 1; i <= externalNx; i += 1) {
    const fraction = i / externalNx;
    xFaces[nozzleNx + i] = nozzleLengthM + externalLengthM * fraction ** 1.28;
  }
  const xCenters = Float64Array.from({ length: nx }, (_, i) => 0.5 * (xFaces[i] + xFaces[i + 1]));
  const etaFaces = Float64Array.from({ length: nr + 1 }, (_, j) => j / nr);
  const etaCenters = Float64Array.from({ length: nr }, (_, j) => 0.5 * (etaFaces[j] + etaFaces[j + 1]));
  const wallFaces = Float64Array.from(xFaces, (x) => outerRadiusAt(x, geometry));
  const wallCenters = Float64Array.from(xCenters, (x) => outerRadiusAt(x, geometry));
  const cells = nx * nr;
  const cellX = new Float64Array(cells);
  const cellR = new Float64Array(cells);
  const volumes = new Float64Array(cells);
  const wallDistance = new Float64Array(cells);
  let minCellLength = Number.POSITIVE_INFINITY;

  for (let i = 0; i < nx; i += 1) {
    const dx = xFaces[i + 1] - xFaces[i];
    const wallLeft = wallFaces[i];
    const wallRight = wallFaces[i + 1];
    const insideNozzle = i < nozzleNx;
    const slope = insideNozzle ? wallSlopeAt(xCenters[i], geometry) : 0;
    for (let j = 0; j < nr; j += 1) {
      const index = cellIndex(i, j, nr);
      const etaInner2 = etaFaces[j] ** 2;
      const etaOuter2 = etaFaces[j + 1] ** 2;
      cellX[index] = xCenters[i];
      cellR[index] = etaCenters[j] * wallCenters[i];
      volumes[index] = PI * dx * (wallLeft * wallLeft + wallLeft * wallRight + wallRight * wallRight) *
        (etaOuter2 - etaInner2) / 3;
      wallDistance[index] = insideNozzle
        ? Math.max((wallCenters[i] - cellR[index]) / Math.sqrt(1 + slope * slope), 1e-8)
        : Math.max(Math.hypot(xCenters[i] - nozzleLengthM, cellR[index] - geometry.exitRadiusM), 1e-8);
      const localDr = wallCenters[i] / nr;
      minCellLength = Math.min(minCellLength, dx, localDr);
    }
  }

  let throatIndex = 0;
  const targetThroat = throatX(geometry);
  for (let i = 1; i < nozzleNx; i += 1) {
    if (Math.abs(xCenters[i] - targetThroat) < Math.abs(xCenters[throatIndex] - targetThroat)) throatIndex = i;
  }

  return {
    nx,
    nr,
    cells,
    lengthM,
    nozzleLengthM,
    maxRadiusM: Math.max(
      geometry.chamberRadiusM * 1.5,
      geometry.exitRadiusM * 3,
      geometry.farfieldRadiusM
    ),
    throatIndex,
    nozzleExitIndex: nozzleNx - 1,
    xFaces,
    xCenters,
    etaFaces,
    etaCenters,
    wallFaces,
    wallCenters,
    cellX,
    cellR,
    volumes,
    wallDistance,
    minCellLength
  };
}

export function axialFaceArea(mesh: BodyFittedMesh, faceI: number, j: number) {
  const wall = mesh.wallFaces[faceI];
  const inner = mesh.etaFaces[j] * wall;
  const outer = mesh.etaFaces[j + 1] * wall;
  return PI * (outer * outer - inner * inner);
}

export function radialFaceAreaVector(mesh: BodyFittedMesh, i: number, faceJ: number) {
  const eta = mesh.etaFaces[faceJ];
  const rLeft = eta * mesh.wallFaces[i];
  const rRight = eta * mesh.wallFaces[i + 1];
  const dx = mesh.xFaces[i + 1] - mesh.xFaces[i];
  return {
    x: -PI * (rRight * rRight - rLeft * rLeft),
    r: PI * (rLeft + rRight) * dx
  };
}

export function ringAreaAtCell(mesh: BodyFittedMesh, i: number, j: number) {
  const wall = mesh.wallCenters[i];
  const inner = mesh.etaFaces[j] * wall;
  const outer = mesh.etaFaces[j + 1] * wall;
  return PI * (outer * outer - inner * inner);
}

export function ransCellIndex(i: number, j: number, mesh: BodyFittedMesh) {
  return i * mesh.nr + j;
}
