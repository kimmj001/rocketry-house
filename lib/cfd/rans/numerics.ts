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

export type ScalarReconstruction = ScalarGradient & {
  minimum: Float64Array;
  maximum: Float64Array;
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
  const vnLeft = left.u * normalX + left.v * normalR;
  const vnRight = right.u * normalX + right.v * normalR;
  const ul0 = left.rho;
  const ul1 = left.rho * left.u;
  const ul2 = left.rho * left.v;
  const ul3 = left.p / (left.thermo.gamma - 1) +
    0.5 * left.rho * (left.u * left.u + left.v * left.v);
  const ur0 = right.rho;
  const ur1 = right.rho * right.u;
  const ur2 = right.rho * right.v;
  const ur3 = right.p / (right.thermo.gamma - 1) +
    0.5 * right.rho * (right.u * right.u + right.v * right.v);
  const fl0 = left.rho * vnLeft;
  const fl1 = left.rho * left.u * vnLeft + left.p * normalX;
  const fl2 = left.rho * left.v * vnLeft + left.p * normalR;
  const fl3 = (ul3 + left.p) * vnLeft;
  const fr0 = right.rho * vnRight;
  const fr1 = right.rho * right.u * vnRight + right.p * normalX;
  const fr2 = right.rho * right.v * vnRight + right.p * normalR;
  const fr3 = (ur3 + right.p) * vnRight;
  const aLeft = Math.sqrt(left.thermo.gamma * left.p / left.rho);
  const aRight = Math.sqrt(right.thermo.gamma * right.p / right.rho);
  const lambda = Math.max(Math.abs(vnLeft) + aLeft, Math.abs(vnRight) + aRight);
  const flux: FluxVector = [
    0.5 * (fl0 + fr0) - 0.5 * lambda * (ur0 - ul0),
    0.5 * (fl1 + fr1) - 0.5 * lambda * (ur1 - ul1),
    0.5 * (fl2 + fr2) - 0.5 * lambda * (ur2 - ul2),
    0.5 * (fl3 + fr3) - 0.5 * lambda * (ur3 - ul3)
  ];
  return { flux, massFlux: flux[0], usedFallback: true };
}

export function hllcFlux(
  left: FacePrimitive,
  right: FacePrimitive,
  normalX: number,
  normalR: number
): HllcResult {
  if (!admissible(left) || !admissible(right)) return rusanovFlux(left, right, normalX, normalR);
  const vnLeft = left.u * normalX + left.v * normalR;
  const vnRight = right.u * normalX + right.v * normalR;
  const vtLeft = -left.u * normalR + left.v * normalX;
  const vtRight = -right.u * normalR + right.v * normalX;
  const ul0 = left.rho;
  const ul1 = left.rho * left.u;
  const ul2 = left.rho * left.v;
  const ul3 = left.p / (left.thermo.gamma - 1) +
    0.5 * left.rho * (left.u * left.u + left.v * left.v);
  const ur0 = right.rho;
  const ur1 = right.rho * right.u;
  const ur2 = right.rho * right.v;
  const ur3 = right.p / (right.thermo.gamma - 1) +
    0.5 * right.rho * (right.u * right.u + right.v * right.v);
  const fl0 = left.rho * vnLeft;
  const fl1 = left.rho * left.u * vnLeft + left.p * normalX;
  const fl2 = left.rho * left.v * vnLeft + left.p * normalR;
  const fl3 = (ul3 + left.p) * vnLeft;
  const fr0 = right.rho * vnRight;
  const fr1 = right.rho * right.u * vnRight + right.p * normalX;
  const fr2 = right.rho * right.v * vnRight + right.p * normalR;
  const fr3 = (ur3 + right.p) * vnRight;
  const aLeft = Math.sqrt(left.thermo.gamma * left.p / left.rho);
  const aRight = Math.sqrt(right.thermo.gamma * right.p / right.rho);
  const sLeft = Math.min(vnLeft - aLeft, vnRight - aRight);
  const sRight = Math.max(vnLeft + aLeft, vnRight + aRight);
  if (sLeft >= 0) {
    return { flux: [fl0, fl1, fl2, fl3], massFlux: fl0, usedFallback: false };
  }
  if (sRight <= 0) {
    return { flux: [fr0, fr1, fr2, fr3], massFlux: fr0, usedFallback: false };
  }

  const denominator = left.rho * (sLeft - vnLeft) - right.rho * (sRight - vnRight);
  if (!Number.isFinite(denominator) || Math.abs(denominator) < 1e-12) {
    return rusanovFlux(left, right, normalX, normalR);
  }
  const sMiddle = (
    right.p - left.p +
    left.rho * vnLeft * (sLeft - vnLeft) -
    right.rho * vnRight * (sRight - vnRight)
  ) / denominator;

  if (sMiddle >= 0) {
    const waveGap = sLeft - sMiddle;
    const upstreamGap = sLeft - vnLeft;
    if (Math.abs(waveGap) < 1e-12 || Math.abs(upstreamGap) < 1e-12) {
      return rusanovFlux(left, right, normalX, normalR);
    }
    const star0 = left.rho * upstreamGap / waveGap;
    const normalMomentum = star0 * sMiddle;
    const tangentMomentum = star0 * vtLeft;
    const star1 = normalMomentum * normalX - tangentMomentum * normalR;
    const star2 = normalMomentum * normalR + tangentMomentum * normalX;
    const star3 = star0 * (
      ul3 / left.rho +
      (sMiddle - vnLeft) *
        (sMiddle + left.p / (left.rho * upstreamGap))
    );
    const kinetic = 0.5 * (star1 * star1 + star2 * star2) / Math.max(star0, 1e-20);
    if (
      !Number.isFinite(star0) ||
      !Number.isFinite(star1) ||
      !Number.isFinite(star2) ||
      !Number.isFinite(star3) ||
      star0 <= 0 ||
      star3 <= kinetic
    ) {
      return rusanovFlux(left, right, normalX, normalR);
    }
    const flux: FluxVector = [
      fl0 + sLeft * (star0 - ul0),
      fl1 + sLeft * (star1 - ul1),
      fl2 + sLeft * (star2 - ul2),
      fl3 + sLeft * (star3 - ul3)
    ];
    return { flux, massFlux: flux[0], usedFallback: false };
  }
  const waveGap = sRight - sMiddle;
  const upstreamGap = sRight - vnRight;
  if (Math.abs(waveGap) < 1e-12 || Math.abs(upstreamGap) < 1e-12) {
    return rusanovFlux(left, right, normalX, normalR);
  }
  const star0 = right.rho * upstreamGap / waveGap;
  const normalMomentum = star0 * sMiddle;
  const tangentMomentum = star0 * vtRight;
  const star1 = normalMomentum * normalX - tangentMomentum * normalR;
  const star2 = normalMomentum * normalR + tangentMomentum * normalX;
  const star3 = star0 * (
    ur3 / right.rho +
    (sMiddle - vnRight) *
      (sMiddle + right.p / (right.rho * upstreamGap))
  );
  const kinetic = 0.5 * (star1 * star1 + star2 * star2) / Math.max(star0, 1e-20);
  if (
    !Number.isFinite(star0) ||
    !Number.isFinite(star1) ||
    !Number.isFinite(star2) ||
    !Number.isFinite(star3) ||
    star0 <= 0 ||
    star3 <= kinetic
  ) {
    return rusanovFlux(left, right, normalX, normalR);
  }
  const flux: FluxVector = [
    fr0 + sRight * (star0 - ur0),
    fr1 + sRight * (star1 - ur1),
    fr2 + sRight * (star2 - ur2),
    fr3 + sRight * (star3 - ur3)
  ];
  return { flux, massFlux: flux[0], usedFallback: false };
}

type GradientStencil = {
  count: Uint8Array;
  neighbors: Int32Array;
  coefficientX: Float64Array;
  coefficientR: Float64Array;
};

const gradientStencilCache = new WeakMap<BodyFittedMesh, GradientStencil>();
const MAX_STENCIL_NEIGHBORS = 4;

function createGradientStencil(mesh: BodyFittedMesh): GradientStencil {
  const count = new Uint8Array(mesh.cells);
  const neighbors = new Int32Array(mesh.cells * MAX_STENCIL_NEIGHBORS);
  const coefficientX = new Float64Array(mesh.cells * MAX_STENCIL_NEIGHBORS);
  const coefficientR = new Float64Array(mesh.cells * MAX_STENCIL_NEIGHBORS);
  neighbors.fill(-1);

  for (let index = 0; index < mesh.cells; index += 1) {
    const i = Math.floor(index / mesh.nr);
    const j = index % mesh.nr;
    const offset = index * MAX_STENCIL_NEIGHBORS;
    let neighborCount = 0;
    if (i > 0) {
      neighbors[offset + neighborCount] = ransCellIndex(
        i - 1,
        adjacentRadialCell(i, j, i - 1, mesh),
        mesh
      );
      neighborCount += 1;
    }
    if (i + 1 < mesh.nx) {
      neighbors[offset + neighborCount] = ransCellIndex(
        i + 1,
        adjacentRadialCell(i, j, i + 1, mesh),
        mesh
      );
      neighborCount += 1;
    }
    if (j > 0) {
      neighbors[offset + neighborCount] = ransCellIndex(i, j - 1, mesh);
      neighborCount += 1;
    }
    if (j + 1 < mesh.nr) {
      neighbors[offset + neighborCount] = ransCellIndex(i, j + 1, mesh);
      neighborCount += 1;
    }
    count[index] = neighborCount;

    let a11 = 0;
    let a12 = 0;
    let a22 = 0;
    for (let slot = 0; slot < neighborCount; slot += 1) {
      const neighbor = neighbors[offset + slot];
      const dx = mesh.cellX[neighbor] - mesh.cellX[index];
      const dr = mesh.cellR[neighbor] - mesh.cellR[index];
      const weight = 1 / Math.max(dx * dx + dr * dr, 1e-20);
      a11 += weight * dx * dx;
      a12 += weight * dx * dr;
      a22 += weight * dr * dr;
    }
    const regularization = Math.max((a11 + a22) * 1e-14, 1e-20);
    a11 += regularization;
    a22 += regularization;
    const determinant = Math.max(a11 * a22 - a12 * a12, 1e-30);
    for (let slot = 0; slot < neighborCount; slot += 1) {
      const neighbor = neighbors[offset + slot];
      const dx = mesh.cellX[neighbor] - mesh.cellX[index];
      const dr = mesh.cellR[neighbor] - mesh.cellR[index];
      const weight = 1 / Math.max(dx * dx + dr * dr, 1e-20);
      coefficientX[offset + slot] =
        weight * (a22 * dx - a12 * dr) / determinant;
      coefficientR[offset + slot] =
        weight * (a11 * dr - a12 * dx) / determinant;
    }
  }
  return { count, neighbors, coefficientX, coefficientR };
}

function gradientStencil(mesh: BodyFittedMesh) {
  const cached = gradientStencilCache.get(mesh);
  if (cached) return cached;
  const stencil = createGradientStencil(mesh);
  gradientStencilCache.set(mesh, stencil);
  return stencil;
}

export function weightedLeastSquaresReconstruction(
  values: Float64Array,
  mesh: BodyFittedMesh,
  target?: ScalarReconstruction
): ScalarReconstruction {
  const reconstruction = target ?? {
    x: new Float64Array(mesh.cells),
    r: new Float64Array(mesh.cells),
    minimum: new Float64Array(mesh.cells),
    maximum: new Float64Array(mesh.cells)
  };
  const stencil = gradientStencil(mesh);

  for (let index = 0; index < mesh.cells; index += 1) {
    let gradientX = 0;
    let gradientR = 0;
    const offset = index * MAX_STENCIL_NEIGHBORS;
    const center = values[index];
    let minimum = center;
    let maximum = center;
    for (let slot = 0; slot < stencil.count[index]; slot += 1) {
      const neighbor = stencil.neighbors[offset + slot];
      const neighborValue = values[neighbor];
      const difference = neighborValue - center;
      gradientX += stencil.coefficientX[offset + slot] * difference;
      gradientR += stencil.coefficientR[offset + slot] * difference;
      minimum = Math.min(minimum, neighborValue);
      maximum = Math.max(maximum, neighborValue);
    }
    reconstruction.x[index] = gradientX;
    reconstruction.r[index] = gradientR;
    reconstruction.minimum[index] = minimum;
    reconstruction.maximum[index] = maximum;
  }
  return reconstruction;
}

export function weightedLeastSquaresGradient(values: Float64Array, mesh: BodyFittedMesh): ScalarGradient {
  return weightedLeastSquaresReconstruction(values, mesh);
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
  mesh: BodyFittedMesh,
  bounds?: Pick<ScalarReconstruction, "minimum" | "maximum">
) {
  const delta = gradient.x[index] * (faceX - mesh.cellX[index]) +
    gradient.r[index] * (faceR - mesh.cellR[index]);
  let minValue = bounds?.minimum[index] ?? values[index];
  let maxValue = bounds?.maximum[index] ?? values[index];
  if (!bounds) {
    const stencil = gradientStencil(mesh);
    const offset = index * MAX_STENCIL_NEIGHBORS;
    for (let slot = 0; slot < stencil.count[index]; slot += 1) {
      const neighbor = stencil.neighbors[offset + slot];
      minValue = Math.min(minValue, values[neighbor]);
      maxValue = Math.max(maxValue, values[neighbor]);
    }
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
