import type { BodyFittedMesh, NozzleGeometryConfig, ResolutionPreset } from "./types";

const PI = Math.PI;

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
    return geometry.chamberRadiusM + (geometry.throatRadiusM - geometry.chamberRadiusM) * t;
  }
  const t = Math.max(0, Math.min(1, (xM - throatXM) / geometry.divergentLengthM));
  return geometry.throatRadiusM + (geometry.exitRadiusM - geometry.throatRadiusM) * t;
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
  const openingProgress = Math.sqrt(t);
  const rapidOpening = openingProgress * openingProgress * (3 - 2 * openingProgress);
  return geometry.exitRadiusM + (farfieldRadiusM - geometry.exitRadiusM) * rapidOpening;
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

function nearestRadialCell(i: number, radiusM: number, mesh: BodyFittedMesh) {
  let low = 0;
  let high = mesh.nr - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (mesh.cellR[cellIndex(i, mid, mesh.nr)] < radiusM) low = mid + 1;
    else high = mid;
  }
  if (low === 0) return 0;
  const lower = low - 1;
  return Math.abs(mesh.cellR[cellIndex(i, lower, mesh.nr)] - radiusM) <=
    Math.abs(mesh.cellR[cellIndex(i, low, mesh.nr)] - radiusM)
    ? lower
    : low;
}

export function adjacentRadialCell(
  i: number,
  j: number,
  adjacentI: number,
  mesh: BodyFittedMesh
) {
  return nearestRadialCell(adjacentI, mesh.cellR[cellIndex(i, j, mesh.nr)], mesh);
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
    ? Math.max(16, Math.min(nx - 16, Math.round(nx * 0.38)))
    : preset.nozzleNx;
  const externalNx = nx - nozzleNx;
  const externalLengthM = lengthM - nozzleLengthM;
  const xFaces = new Float64Array(nx + 1);
  for (let i = 0; i <= nozzleNx; i += 1) xFaces[i] = nozzleLengthM * i / nozzleNx;
  for (let i = 1; i <= externalNx; i += 1) {
    const fraction = i / externalNx;
    xFaces[nozzleNx + i] = nozzleLengthM + externalLengthM * fraction ** 1.18;
  }
  const xCenters = Float64Array.from({ length: nx }, (_, i) => 0.5 * (xFaces[i] + xFaces[i + 1]));
  const etaFaces = Float64Array.from({ length: nr + 1 }, (_, j) => j / nr);
  const etaCenters = Float64Array.from({ length: nr }, (_, j) => 0.5 * (etaFaces[j] + etaFaces[j + 1]));
  const wallFaces = Float64Array.from(xFaces, (x) => outerRadiusAt(x, geometry));
  const farfieldRadiusM = Math.max(
    geometry.farfieldRadiusM,
    geometry.exitRadiusM * 3,
    geometry.chamberRadiusM * 1.5
  );
  const wallCenters = Float64Array.from(
    xCenters,
    (x, i) => i < nozzleNx ? wallRadiusAt(x, geometry) : farfieldRadiusM
  );
  const cells = nx * nr;
  const radialFaceLeft = new Float64Array(nx * (nr + 1));
  const radialFaceRight = new Float64Array(nx * (nr + 1));
  const cellX = new Float64Array(cells);
  const cellR = new Float64Array(cells);
  const volumes = new Float64Array(cells);
  const wallDistance = new Float64Array(cells);
  let minCellLength = Number.POSITIVE_INFINITY;

  for (let i = 0; i < nx; i += 1) {
    const dx = xFaces[i + 1] - xFaces[i];
    const insideNozzle = i < nozzleNx;
    const wallLeft = insideNozzle ? wallRadiusAt(xFaces[i], geometry) : farfieldRadiusM;
    const wallRight = insideNozzle ? wallRadiusAt(xFaces[i + 1], geometry) : farfieldRadiusM;
    const slope = insideNozzle ? wallSlopeAt(xCenters[i], geometry) : 0;
    for (let faceJ = 0; faceJ <= nr; faceJ += 1) {
      const fraction = faceJ / nr;
      const radialFraction = insideNozzle ? fraction : fraction ** 1.7;
      radialFaceLeft[i * (nr + 1) + faceJ] = radialFraction * wallLeft;
      radialFaceRight[i * (nr + 1) + faceJ] = radialFraction * wallRight;
    }
    for (let j = 0; j < nr; j += 1) {
      const index = cellIndex(i, j, nr);
      const radialIndex = i * (nr + 1) + j;
      const innerLeft = radialFaceLeft[radialIndex];
      const innerRight = radialFaceRight[radialIndex];
      const outerLeft = radialFaceLeft[radialIndex + 1];
      const outerRight = radialFaceRight[radialIndex + 1];
      cellX[index] = xCenters[i];
      cellR[index] = 0.25 * (innerLeft + innerRight + outerLeft + outerRight);
      volumes[index] = PI * dx / 3 * (
        outerLeft * outerLeft + outerLeft * outerRight + outerRight * outerRight -
        innerLeft * innerLeft - innerLeft * innerRight - innerRight * innerRight
      );
      wallDistance[index] = insideNozzle
        ? Math.max((wallCenters[i] - cellR[index]) / Math.sqrt(1 + slope * slope), 1e-8)
        : Math.max(Math.hypot(xCenters[i] - nozzleLengthM, cellR[index] - geometry.exitRadiusM), 1e-8);
      const localDr = 0.5 * (
        outerLeft + outerRight - innerLeft - innerRight
      );
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
    radialFaceLeft,
    radialFaceRight,
    cellX,
    cellR,
    volumes,
    wallDistance,
    minCellLength
  };
}

export function axialFaceArea(mesh: BodyFittedMesh, faceI: number, j: number) {
  const side = faceI === 0 ? "left" : "right";
  const column = faceI === 0 ? 0 : faceI - 1;
  const faces = side === "left" ? mesh.radialFaceLeft : mesh.radialFaceRight;
  const offset = column * (mesh.nr + 1);
  const inner = faces[offset + j];
  const outer = faces[offset + j + 1];
  return PI * (outer * outer - inner * inner);
}

export function radialFaceAreaVector(mesh: BodyFittedMesh, i: number, faceJ: number) {
  const offset = i * (mesh.nr + 1) + faceJ;
  const rLeft = mesh.radialFaceLeft[offset];
  const rRight = mesh.radialFaceRight[offset];
  const dx = mesh.xFaces[i + 1] - mesh.xFaces[i];
  return {
    x: -PI * (rRight * rRight - rLeft * rLeft),
    r: PI * (rLeft + rRight) * dx
  };
}

export function ringAreaAtCell(mesh: BodyFittedMesh, i: number, j: number) {
  const offset = i * (mesh.nr + 1) + j;
  const inner = 0.5 * (mesh.radialFaceLeft[offset] + mesh.radialFaceRight[offset]);
  const outer = 0.5 * (
    mesh.radialFaceLeft[offset + 1] + mesh.radialFaceRight[offset + 1]
  );
  return PI * (outer * outer - inner * inner);
}

export function axisymmetricSourceMeasure(mesh: BodyFittedMesh, i: number, j: number) {
  const offset = i * (mesh.nr + 1) + j;
  const dx = mesh.xFaces[i + 1] - mesh.xFaces[i];
  return PI * dx * (
    mesh.radialFaceLeft[offset + 1] +
    mesh.radialFaceRight[offset + 1] -
    mesh.radialFaceLeft[offset] -
    mesh.radialFaceRight[offset]
  );
}

export function radialFaceRadius(
  mesh: BodyFittedMesh,
  i: number,
  side: "left" | "right",
  faceJ: number
) {
  const faces = side === "left" ? mesh.radialFaceLeft : mesh.radialFaceRight;
  return faces[i * (mesh.nr + 1) + faceJ];
}

export function ransCellIndex(i: number, j: number, mesh: BodyFittedMesh) {
  return i * mesh.nr + j;
}
