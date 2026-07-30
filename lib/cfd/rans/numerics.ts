import { adjacentRadialCell, ransCellIndex } from "./geometry";
import type {
  BodyFittedMesh,
  ConservativeState,
  PrimitiveArrays,
  RansSolverConfig,
  ScalarGradient,
  ThermoProperties
} from "./types";

export type ConservedVector = [number, number, number, number];
export type FluxVector = [number, number, number, number];

export type FacePrimitive = {
  rho: number;
  u: number;
  v: number;
  p: number;
  temperature: number;
  nuTilde: number;
  thermo: ThermoProperties;
};

export type HllcResult = {
  flux: FluxVector;
  massFlux: number;
  usedFallback: boolean;
};

const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;

export function symmetryAxisGhost(interior: FacePrimitive): FacePrimitive {
  return { ...interior, v: -interior.v };
}

export function noSlipAdiabaticWallGhost(interior: FacePrimitive): FacePrimitive {
  return {
    ...interior,
    u: -interior.u,
    v: -interior.v,
    temperature: interior.temperature,
    nuTilde: 0
  };
}

export function createConservativeState(cells: number): ConservativeState {
  return {
    rho: new Float64Array(cells),
    rhoU: new Float64Array(cells),
    rhoV: new Float64Array(cells),
    rhoE: new Float64Array(cells),
    rhoNuTilde: new Float64Array(cells)
  };
}

export function createPrimitiveArrays(cells: number): PrimitiveArrays {
  return {
    rho: new Float64Array(cells),
    u: new Float64Array(cells),
    v: new Float64Array(cells),
    p: new Float64Array(cells),
    temperature: new Float64Array(cells),
    soundSpeed: new Float64Array(cells),
    mach: new Float64Array(cells),
    gamma: new Float64Array(cells),
    gasConstant: new Float64Array(cells),
    cp: new Float64Array(cells),
    mu: new Float64Array(cells),
    conductivity: new Float64Array(cells),
    prandtl: new Float64Array(cells),
    nu: new Float64Array(cells),
    nuTilde: new Float64Array(cells),
    muT: new Float64Array(cells)
  };
}

export function conservativeFromPrimitive(face: FacePrimitive): ConservedVector {
  const kinetic = 0.5 * (face.u * face.u + face.v * face.v);
  const totalEnergy = face.p / ((face.thermo.gamma - 1) * face.rho) + kinetic;
  return [face.rho, face.rho * face.u, face.rho * face.v, face.rho * totalEnergy];
}

export function primitiveFromConservative(
  conserved: ConservedVector,
  thermo: ThermoProperties,
  config: Pick<RansSolverConfig, "rhoMin" | "pressureMin" | "temperatureMin">
) {
  const rawRho = conserved[0];
  const rho = Math.max(finite(rawRho, config.rhoMin), config.rhoMin);
  const u = finite(conserved[1] / rho, 0);
  const v = finite(conserved[2] / rho, 0);
  const kinetic = 0.5 * rho * (u * u + v * v);
  const rawPressure = (thermo.gamma - 1) * (conserved[3] - kinetic);
  const p = Math.max(finite(rawPressure, config.pressureMin), config.pressureMin);
  const rawTemperature = p / (rho * thermo.gasConstant);
  const temperature = Math.max(finite(rawTemperature, config.temperatureMin), config.temperatureMin);
  const soundSpeed = Math.sqrt(Math.max(thermo.gamma * thermo.gasConstant * temperature, 1e-12));
  return {
    rho,
    u,
    v,
    p,
    temperature,
    soundSpeed,
    mach: Math.hypot(u, v) / soundSpeed,
    rawRho,
    rawPressure,
    rawTemperature,
    floorCount:
      (rawRho < config.rhoMin || !Number.isFinite(rawRho) ? 1 : 0) +
      (rawPressure < config.pressureMin || !Number.isFinite(rawPressure) ? 1 : 0) +
      (rawTemperature < config.temperatureMin || !Number.isFinite(rawTemperature) ? 1 : 0)
  };
}

function physicalFlux(face: FacePrimitive, normalX: number, normalR: number): FluxVector {
  const conserved = conservativeFromPrimitive(face);
  const vn = face.u * normalX + face.v * normalR;
  return [
    face.rho * vn,
    face.rho * face.u * vn + face.p * normalX,
    face.rho * face.v * vn + face.p * normalR,
    (conserved[3] + face.p) * vn
  ];
}

function admissible(face: FacePrimitive) {
  return Number.isFinite(face.rho) && face.rho > 0 &&
    Number.isFinite(face.p) && face.p > 0 &&
    Number.isFinite(face.temperature) && face.temperature > 0 &&
    Number.isFinite(face.u) && Number.isFinite(face.v);
}

export function rusanovFlux(
  left: FacePrimitive,
  right: FacePrimitive,
  normalX: number,
  normalR: number
): HllcResult {
  const ul = conservativeFromPrimitive(left);
  const ur = conservativeFromPrimitive(right);
  const fl = physicalFlux(left, normalX, normalR);
  const fr = physicalFlux(right, normalX, normalR);
  const vnLeft = left.u * normalX + left.v * normalR;
  const vnRight = right.u * normalX + right.v * normalR;
  const aLeft = Math.sqrt(left.thermo.gamma * left.p / left.rho);
  const aRight = Math.sqrt(right.thermo.gamma * right.p / right.rho);
  const lambda = Math.max(Math.abs(vnLeft) + aLeft, Math.abs(vnRight) + aRight);
  const flux = fl.map((value, component) =>
    0.5 * (value + fr[component]) - 0.5 * lambda * (ur[component] - ul[component])
  ) as FluxVector;
  return { flux, massFlux: flux[0], usedFallback: true };
}

export function hllcFlux(
  left: FacePrimitive,
  right: FacePrimitive,
  normalX: number,
  normalR: number
): HllcResult {
  if (!admissible(left) || !admissible(right)) return rusanovFlux(left, right, normalX, normalR);
  const ul = conservativeFromPrimitive(left);
  const ur = conservativeFromPrimitive(right);
  const fl = physicalFlux(left, normalX, normalR);
  const fr = physicalFlux(right, normalX, normalR);
  const vnLeft = left.u * normalX + left.v * normalR;
  const vnRight = right.u * normalX + right.v * normalR;
  const vtLeft = -left.u * normalR + left.v * normalX;
  const vtRight = -right.u * normalR + right.v * normalX;
  const aLeft = Math.sqrt(left.thermo.gamma * left.p / left.rho);
  const aRight = Math.sqrt(right.thermo.gamma * right.p / right.rho);
  const sLeft = Math.min(vnLeft - aLeft, vnRight - aRight);
  const sRight = Math.max(vnLeft + aLeft, vnRight + aRight);
  if (sLeft >= 0) return { flux: fl, massFlux: fl[0], usedFallback: false };
  if (sRight <= 0) return { flux: fr, massFlux: fr[0], usedFallback: false };

  const denominator = left.rho * (sLeft - vnLeft) - right.rho * (sRight - vnRight);
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) {
    return rusanovFlux(left, right, normalX, normalR);
  }
  const sMiddle = (
    right.p - left.p +
    left.rho * vnLeft * (sLeft - vnLeft) -
    right.rho * vnRight * (sRight - vnRight)
  ) / denominator;

  const starState = (
    state: ConservedVector,
    primitive: FacePrimitive,
    vn: number,
    vt: number,
    wave: number
  ): ConservedVector | null => {
    const waveGap = wave - sMiddle;
    const upstreamGap = wave - vn;
    if (Math.abs(waveGap) < 1e-12 || Math.abs(upstreamGap) < 1e-12) return null;
    const rhoStar = primitive.rho * upstreamGap / waveGap;
    const normalMomentum = rhoStar * sMiddle;
    const tangentMomentum = rhoStar * vt;
    const energyStar = rhoStar * (
      state[3] / primitive.rho +
      (sMiddle - vn) * (sMiddle + primitive.p / (primitive.rho * upstreamGap))
    );
    const star: ConservedVector = [
      rhoStar,
      normalMomentum * normalX - tangentMomentum * normalR,
      normalMomentum * normalR + tangentMomentum * normalX,
      energyStar
    ];
    const kinetic = 0.5 * (star[1] * star[1] + star[2] * star[2]) / Math.max(star[0], 1e-20);
    if (!star.every(Number.isFinite) || star[0] <= 0 || star[3] <= kinetic) return null;
    return star;
  };

  if (sMiddle >= 0) {
    const star = starState(ul, left, vnLeft, vtLeft, sLeft);
    if (!star) return rusanovFlux(left, right, normalX, normalR);
    const flux = fl.map((value, component) => value + sLeft * (star[component] - ul[component])) as FluxVector;
    return { flux, massFlux: flux[0], usedFallback: false };
  }
  const star = starState(ur, right, vnRight, vtRight, sRight);
  if (!star) return rusanovFlux(left, right, normalX, normalR);
  const flux = fr.map((value, component) => value + sRight * (star[component] - ur[component])) as FluxVector;
  return { flux, massFlux: flux[0], usedFallback: false };
}

function neighborIndices(index: number, mesh: BodyFittedMesh) {
  const i = Math.floor(index / mesh.nr);
  const j = index % mesh.nr;
  const neighbors: number[] = [];
  if (i > 0) {
    neighbors.push(ransCellIndex(i - 1, adjacentRadialCell(i, j, i - 1, mesh), mesh));
  }
  if (i + 1 < mesh.nx) {
    neighbors.push(ransCellIndex(i + 1, adjacentRadialCell(i, j, i + 1, mesh), mesh));
  }
  if (j > 0) neighbors.push(ransCellIndex(i, j - 1, mesh));
  if (j + 1 < mesh.nr) neighbors.push(ransCellIndex(i, j + 1, mesh));
  return neighbors;
}

export function weightedLeastSquaresGradient(values: Float64Array, mesh: BodyFittedMesh): ScalarGradient {
  const gradient = {
    x: new Float64Array(mesh.cells),
    r: new Float64Array(mesh.cells)
  };

  for (let index = 0; index < mesh.cells; index += 1) {
    let a11 = 0;
    let a12 = 0;
    let a22 = 0;
    let b1 = 0;
    let b2 = 0;
    const neighbors = neighborIndices(index, mesh);
    for (const neighbor of neighbors) {
      const dx = mesh.cellX[neighbor] - mesh.cellX[index];
      const dr = mesh.cellR[neighbor] - mesh.cellR[index];
      const distance2 = dx * dx + dr * dr;
      const weight = 1 / Math.max(distance2, 1e-20);
      const delta = values[neighbor] - values[index];
      a11 += weight * dx * dx;
      a12 += weight * dx * dr;
      a22 += weight * dr * dr;
      b1 += weight * dx * delta;
      b2 += weight * dr * delta;
    }
    const determinant = a11 * a22 - a12 * a12;
    if (Math.abs(determinant) > 1e-10 * Math.max(a11 * a22, 1e-30)) {
      gradient.x[index] = (a22 * b1 - a12 * b2) / determinant;
      gradient.r[index] = (a11 * b2 - a12 * b1) / determinant;
      continue;
    }

    const i = Math.floor(index / mesh.nr);
    const j = index % mesh.nr;
    const leftI = Math.max(i - 1, 0);
    const rightI = Math.min(i + 1, mesh.nx - 1);
    const left = ransCellIndex(
      leftI,
      leftI === i ? j : adjacentRadialCell(i, j, leftI, mesh),
      mesh
    );
    const right = ransCellIndex(
      rightI,
      rightI === i ? j : adjacentRadialCell(i, j, rightI, mesh),
      mesh
    );
    const bottom = ransCellIndex(i, Math.max(j - 1, 0), mesh);
    const top = ransCellIndex(i, Math.min(j + 1, mesh.nr - 1), mesh);
    gradient.x[index] = (values[right] - values[left]) /
      Math.max(mesh.cellX[right] - mesh.cellX[left], mesh.minCellLength);
    gradient.r[index] = (values[top] - values[bottom]) /
      Math.max(mesh.cellR[top] - mesh.cellR[bottom], mesh.minCellLength);
  }
  return gradient;
}

export function venkatakrishnanLimiter(delta: number, allowableDelta: number, epsilon2: number) {
  if (Math.abs(delta) < 1e-20) return 1;
  if (delta * allowableDelta <= 0) return 0;
  const numerator = allowableDelta * allowableDelta + 2 * allowableDelta * delta + epsilon2;
  const denominator = allowableDelta * allowableDelta + allowableDelta * delta + 2 * delta * delta + epsilon2;
  return Math.max(0, Math.min(1, numerator / Math.max(denominator, 1e-30)));
}

export function reconstructScalar(
  values: Float64Array,
  gradient: ScalarGradient,
  index: number,
  faceX: number,
  faceR: number,
  mesh: BodyFittedMesh
) {
  const delta = gradient.x[index] * (faceX - mesh.cellX[index]) +
    gradient.r[index] * (faceR - mesh.cellR[index]);
  let minValue = values[index];
  let maxValue = values[index];
  for (const neighbor of neighborIndices(index, mesh)) {
    minValue = Math.min(minValue, values[neighbor]);
    maxValue = Math.max(maxValue, values[neighbor]);
  }
  const allowable = delta >= 0 ? maxValue - values[index] : minValue - values[index];
  const h3 = mesh.minCellLength ** 3;
  const limiter = venkatakrishnanLimiter(delta, allowable, h3 * h3 + 1e-30);
  return {
    value: values[index] + limiter * delta,
    limited: limiter < 0.999999
  };
}

export function residualNorm(
  residual: ConservativeState,
  mesh: BodyFittedMesh,
  iteration: number,
  reference: {
    densityKgM3: number;
    soundSpeedMS: number;
    lengthM: number;
    kinematicViscosityM2S: number;
  }
) {
  let continuity = 0;
  let axialMomentum = 0;
  let radialMomentum = 0;
  let energy = 0;
  let turbulence = 0;
  const densityScale = Math.max(reference.densityKgM3, 1e-12);
  const velocityScale = Math.max(reference.soundSpeedMS, 1);
  const lengthScale = Math.max(reference.lengthM, 1e-8);
  const continuityScale = densityScale * velocityScale / lengthScale;
  const momentumScale = densityScale * velocityScale * velocityScale / lengthScale;
  const energyScale = densityScale * velocityScale ** 3 / lengthScale;
  const turbulenceScale = densityScale *
    Math.max(reference.kinematicViscosityM2S, 1e-12) *
    velocityScale /
    lengthScale;
  for (let index = 0; index < mesh.cells; index += 1) {
    const inverseVolume = 1 / Math.max(mesh.volumes[index], 1e-30);
    continuity += (residual.rho[index] * inverseVolume / continuityScale) ** 2;
    axialMomentum += (residual.rhoU[index] * inverseVolume / momentumScale) ** 2;
    radialMomentum += (residual.rhoV[index] * inverseVolume / momentumScale) ** 2;
    energy += (residual.rhoE[index] * inverseVolume / energyScale) ** 2;
    turbulence += (residual.rhoNuTilde[index] * inverseVolume / turbulenceScale) ** 2;
  }
  const divisor = Math.max(mesh.cells, 1);
  return {
    iteration,
    continuity: Math.sqrt(continuity / divisor),
    axialMomentum: Math.sqrt(axialMomentum / divisor),
    radialMomentum: Math.sqrt(radialMomentum / divisor),
    energy: Math.sqrt(energy / divisor),
    turbulence: Math.sqrt(turbulence / divisor)
  };
}
