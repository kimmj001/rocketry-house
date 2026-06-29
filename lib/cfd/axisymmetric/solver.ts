import { nozzleWallSlope, type NozzleGeometry } from "@/lib/cfd/axisymmetric/geometry";
import { cellIndex, isInside, type CfdMesh } from "@/lib/cfd/axisymmetric/mesh";
import type { NozzleCfdInputs, NozzleCfdResidualPoint } from "@/types/cfd";

const R_UNIVERSAL = 8314.462618;
const RHO_MIN = 1e-6;
const PRESSURE_MIN = 20;
const TEMP_MIN = 30;

type Conserved = [number, number, number, number];
type Flux = [number, number, number, number];
type Normal = { x: number; y: number };

export type ConservativeState = {
  rho: Float64Array;
  rhoU: Float64Array;
  rhoV: Float64Array;
  rhoE: Float64Array;
};

export type Primitive = {
  rho: number;
  u: number;
  v: number;
  p: number;
  t: number;
  e: number;
  a: number;
  mach: number;
};

export type SolverResult = {
  state: ConservativeState;
  residuals: NozzleCfdResidualPoint[];
  iterations: number;
  converged: boolean;
  finalCfl: number;
  runtimeMs: number;
  maximumCfl: number;
  minimumDensityKgM3: number;
  minimumPressurePa: number;
  conservationError: number;
  positivityAbort: boolean;
  nanDetected: boolean;
  audit: {
    computePrimitive: boolean;
    physicalFluxX: boolean;
    physicalFluxY: boolean;
    computeFaceFluxes: boolean;
    rusanovFlux: boolean;
    computeCflDt: boolean;
    applyBoundaryConditions: boolean;
    updateConservativeStateByFluxDivergence: boolean;
    computeResiduals: boolean;
  };
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function gasConstant(inputs: NozzleCfdInputs) {
  return R_UNIVERSAL / Math.max(inputs.molecularWeightKgPerKmol, 1);
}

function makeState(size: number): ConservativeState {
  return {
    rho: new Float64Array(size),
    rhoU: new Float64Array(size),
    rhoV: new Float64Array(size),
    rhoE: new Float64Array(size)
  };
}

function conservativeAt(state: ConservativeState, index: number): Conserved {
  return [state.rho[index], state.rhoU[index], state.rhoV[index], state.rhoE[index]];
}

function writeConservative(state: ConservativeState, index: number, conserved: Conserved) {
  state.rho[index] = conserved[0];
  state.rhoU[index] = conserved[1];
  state.rhoV[index] = conserved[2];
  state.rhoE[index] = conserved[3];
}

function conservativeFromPrimitive(primitive: Primitive, gamma: number): Conserved {
  const rho = Math.max(primitive.rho, RHO_MIN);
  const rhoE = primitive.p / (gamma - 1) + 0.5 * rho * (primitive.u * primitive.u + primitive.v * primitive.v);
  return [rho, rho * primitive.u, rho * primitive.v, rhoE];
}

export function computePrimitiveFromConserved(conserved: Conserved, gamma: number, rGas: number): Primitive {
  const rho = Math.max(conserved[0], RHO_MIN);
  const u = conserved[1] / rho;
  const v = conserved[2] / rho;
  const kinetic = 0.5 * rho * (u * u + v * v);
  const p = Math.max((gamma - 1) * (conserved[3] - kinetic), PRESSURE_MIN);
  const t = Math.max(p / (rho * rGas), TEMP_MIN);
  const a = Math.sqrt(Math.max(gamma * rGas * t, 1));
  const mach = Math.sqrt(u * u + v * v) / a;
  return { rho, u, v, p, t, a, mach, e: conserved[3] / rho };
}

export function computePrimitive(state: ConservativeState, index: number, gamma: number, rGas: number): Primitive {
  return computePrimitiveFromConserved(conservativeAt(state, index), gamma, rGas);
}

export function physicalFluxX(conserved: Conserved, gamma: number, rGas: number): Flux {
  const primitive = computePrimitiveFromConserved(conserved, gamma, rGas);
  return [
    primitive.rho * primitive.u,
    primitive.rho * primitive.u * primitive.u + primitive.p,
    primitive.rho * primitive.u * primitive.v,
    primitive.u * (conserved[3] + primitive.p)
  ];
}

export function physicalFluxY(conserved: Conserved, gamma: number, rGas: number): Flux {
  const primitive = computePrimitiveFromConserved(conserved, gamma, rGas);
  return [
    primitive.rho * primitive.v,
    primitive.rho * primitive.u * primitive.v,
    primitive.rho * primitive.v * primitive.v + primitive.p,
    primitive.v * (conserved[3] + primitive.p)
  ];
}

function fluxDotNormal(conserved: Conserved, normal: Normal, gamma: number, rGas: number): Flux {
  const fx = physicalFluxX(conserved, gamma, rGas);
  const gy = physicalFluxY(conserved, gamma, rGas);
  return [
    fx[0] * normal.x + gy[0] * normal.y,
    fx[1] * normal.x + gy[1] * normal.y,
    fx[2] * normal.x + gy[2] * normal.y,
    fx[3] * normal.x + gy[3] * normal.y
  ];
}

export function rusanovFlux(leftState: Conserved, rightState: Conserved, normal: Normal, gamma: number, rGas: number): Flux {
  const left = computePrimitiveFromConserved(leftState, gamma, rGas);
  const right = computePrimitiveFromConserved(rightState, gamma, rGas);
  const leftFlux = fluxDotNormal(leftState, normal, gamma, rGas);
  const rightFlux = fluxDotNormal(rightState, normal, gamma, rGas);
  const vnLeft = left.u * normal.x + left.v * normal.y;
  const vnRight = right.u * normal.x + right.v * normal.y;
  const sMax = Math.max(Math.abs(vnLeft) + left.a, Math.abs(vnRight) + right.a);

  return [
    0.5 * (leftFlux[0] + rightFlux[0]) - 0.5 * sMax * (rightState[0] - leftState[0]),
    0.5 * (leftFlux[1] + rightFlux[1]) - 0.5 * sMax * (rightState[1] - leftState[1]),
    0.5 * (leftFlux[2] + rightFlux[2]) - 0.5 * sMax * (rightState[2] - leftState[2]),
    0.5 * (leftFlux[3] + rightFlux[3]) - 0.5 * sMax * (rightState[3] - leftState[3])
  ];
}

function reservoirPrimitive(inputs: NozzleCfdInputs, gamma: number, rGas: number): Primitive {
  const mach = 0.26;
  const totalFactor = 1 + ((gamma - 1) / 2) * mach * mach;
  const t = inputs.chamberTemperatureK / totalFactor;
  const p = inputs.chamberPressurePa / Math.pow(totalFactor, gamma / (gamma - 1));
  const rho = p / (rGas * t);
  const a = Math.sqrt(gamma * rGas * t);
  const u = mach * a;
  return { rho, u, v: 0, p, t, a, mach, e: p / ((gamma - 1) * rho) + 0.5 * u * u };
}

function ambientPrimitive(inputs: NozzleCfdInputs, gamma: number, rGas: number): Primitive {
  const t = 293;
  const p = Math.max(inputs.ambientPressurePa, PRESSURE_MIN);
  const rho = p / (rGas * t);
  const a = Math.sqrt(gamma * rGas * t);
  return { rho, u: 0, v: 0, p, t, a, mach: 0, e: p / ((gamma - 1) * rho) };
}

function primitiveWithMach(inputs: NozzleCfdInputs, mach: number, gamma: number, rGas: number): Primitive {
  const totalFactor = 1 + ((gamma - 1) / 2) * mach * mach;
  const t = inputs.chamberTemperatureK / totalFactor;
  const p = inputs.chamberPressurePa / Math.pow(totalFactor, gamma / (gamma - 1));
  const rho = p / (rGas * t);
  const a = Math.sqrt(gamma * rGas * t);
  const u = mach * a;
  return { rho, u, v: 0, p, t, a, mach, e: p / ((gamma - 1) * rho) + 0.5 * u * u };
}

function areaMach(mach: number, gamma: number) {
  const factor = (2 / (gamma + 1)) * (1 + ((gamma - 1) / 2) * mach * mach);
  return (1 / Math.max(mach, 1e-6)) * Math.pow(factor, (gamma + 1) / (2 * (gamma - 1)));
}

function solveAreaMach(areaRatio: number, gamma: number, supersonic: boolean) {
  let low = supersonic ? 1.00001 : 0.02;
  let high = supersonic ? 6.5 : 0.99999;
  for (let iteration = 0; iteration < 80; iteration += 1) {
    const mid = (low + high) * 0.5;
    const value = areaMach(mid, gamma);
    if (supersonic) {
      if (value > areaRatio) high = mid;
      else low = mid;
    } else if (value > areaRatio) {
      low = mid;
    } else {
      high = mid;
    }
  }
  return (low + high) * 0.5;
}

function initializeConservativeState(inputs: NozzleCfdInputs, geometry: NozzleGeometry, mesh: CfdMesh, gamma: number, rGas: number) {
  const state = makeState(mesh.nx * mesh.ny);
  const reservoir = reservoirPrimitive(inputs, gamma, rGas);
  const ambient = ambientPrimitive(inputs, gamma, rGas);
  const throatX = geometry.convergenceLengthM;
  const exitX = geometry.nozzleLengthM;
  const throatArea = Math.PI * geometry.throatRadiusM * geometry.throatRadiusM;

  for (let j = 0; j < mesh.ny; j += 1) {
    for (let i = 0; i < mesh.nx; i += 1) {
      const index = cellIndex(i, j, mesh);
      if (!mesh.inside[index]) continue;
      const x = mesh.x[i];
      let primitive = ambient;
      if (x <= exitX) {
        const localArea = Math.PI * Math.max(mesh.wallRadius[i], geometry.throatRadiusM) ** 2;
        const areaRatio = Math.max(localArea / Math.max(throatArea, 1e-12), 1.000001);
        const supersonic = x >= throatX;
        const mach = Math.abs(x - throatX) < mesh.dx * 0.65
          ? 1
          : solveAreaMach(areaRatio, gamma, supersonic);
        primitive = primitiveWithMach(inputs, mach, gamma, rGas);
      } else {
        primitive = ambient;
      }

      const wall = Math.max(mesh.wallRadius[i], mesh.dy);
      const radial = clamp(mesh.y[j] / wall, 0, 1);
      const wallDamping = x <= exitX ? 1 - 0.025 * radial * radial : 1;
      writeConservative(state, index, conservativeFromPrimitive({
        ...primitive,
        u: primitive.u * wallDamping,
        v: reservoir.v
      }, gamma));
    }
  }
  return state;
}

function reflectedStateAcrossNormal(conserved: Conserved, normal: Normal, gamma: number, rGas: number): Conserved {
  const primitive = computePrimitiveFromConserved(conserved, gamma, rGas);
  const length = Math.hypot(normal.x, normal.y) || 1;
  const nx = normal.x / length;
  const ny = normal.y / length;
  const normalVelocity = primitive.u * nx + primitive.v * ny;
  const reflected = {
    ...primitive,
    u: primitive.u - 2 * normalVelocity * nx,
    v: primitive.v - 2 * normalVelocity * ny
  };
  reflected.mach = Math.hypot(reflected.u, reflected.v) / Math.max(reflected.a, 1);
  reflected.e = reflected.p / ((gamma - 1) * reflected.rho) + 0.5 * (reflected.u * reflected.u + reflected.v * reflected.v);
  return conservativeFromPrimitive(reflected, gamma);
}

function pressureOutletState(current: Conserved, inputs: NozzleCfdInputs, gamma: number, rGas: number): Conserved {
  const primitive = computePrimitiveFromConserved(current, gamma, rGas);
  if (primitive.u > 0) return current;
  const p = Math.max(inputs.ambientPressurePa, PRESSURE_MIN);
  const adjusted = {
    ...primitive,
    p,
    rho: p / (rGas * primitive.t)
  };
  adjusted.e = adjusted.p / ((gamma - 1) * adjusted.rho) + 0.5 * (adjusted.u * adjusted.u + adjusted.v * adjusted.v);
  return conservativeFromPrimitive(adjusted, gamma);
}

function farfieldState(inputs: NozzleCfdInputs, gamma: number, rGas: number): Conserved {
  return conservativeFromPrimitive(ambientPrimitive(inputs, gamma, rGas), gamma);
}

function inletState(inputs: NozzleCfdInputs, gamma: number, rGas: number): Conserved {
  return conservativeFromPrimitive(reservoirPrimitive(inputs, gamma, rGas), gamma);
}

function neighborConserved(
  state: ConservativeState,
  mesh: CfdMesh,
  geometry: NozzleGeometry,
  inputs: NozzleCfdInputs,
  i: number,
  j: number,
  di: number,
  dj: number,
  gamma: number,
  rGas: number
): Conserved {
  const currentIndex = cellIndex(i, j, mesh);
  const current = conservativeAt(state, currentIndex);
  const ni = i + di;
  const nj = j + dj;

  if (isInside(ni, nj, mesh)) return conservativeAt(state, cellIndex(ni, nj, mesh));
  if (nj < 0) return reflectedStateAcrossNormal(current, { x: 0, y: -1 }, gamma, rGas);
  if (ni < 0) return inletState(inputs, gamma, rGas);
  if (ni >= mesh.nx) return pressureOutletState(current, inputs, gamma, rGas);

  const x = mesh.x[i];
  if (x <= geometry.nozzleLengthM + mesh.dx) {
    const slope = nozzleWallSlope(x, geometry);
    return reflectedStateAcrossNormal(current, { x: -slope, y: 1 }, gamma, rGas);
  }

  return farfieldState(inputs, gamma, rGas);
}

export function applyBoundaryConditions(state: ConservativeState, mesh: CfdMesh, inputs: NozzleCfdInputs, geometry: NozzleGeometry, gamma: number, rGas: number) {
  const inlet = inletState(inputs, gamma, rGas);
  const ambient = farfieldState(inputs, gamma, rGas);
  for (let j = 0; j < mesh.ny; j += 1) {
    const leftIndex = cellIndex(0, j, mesh);
    if (mesh.inside[leftIndex]) writeConservative(state, leftIndex, inlet);
    const rightIndex = cellIndex(mesh.nx - 1, j, mesh);
    if (mesh.inside[rightIndex]) {
      const current = conservativeAt(state, rightIndex);
      const primitive = computePrimitiveFromConserved(current, gamma, rGas);
      writeConservative(state, rightIndex, primitive.u > primitive.a ? current : ambient);
    }
  }
}

export function computeCflDt(state: ConservativeState, mesh: CfdMesh, cfl: number, gamma: number, rGas: number): number {
  let minDt = Number.POSITIVE_INFINITY;
  const cellSize = Math.min(mesh.dx, mesh.dy);
  for (let index = 0; index < state.rho.length; index += 1) {
    if (!mesh.inside[index]) continue;
    const primitive = computePrimitive(state, index, gamma, rGas);
    const waveSpeed = Math.abs(primitive.u) + Math.abs(primitive.v) + primitive.a;
    minDt = Math.min(minDt, cfl * cellSize / Math.max(waveSpeed, 1));
  }
  return Number.isFinite(minDt) ? minDt : 1e-7;
}

function emptyResidual(size: number): ConservativeState {
  return makeState(size);
}

export function computeResidualsFromFluxImbalance(
  state: ConservativeState,
  mesh: CfdMesh,
  geometry: NozzleGeometry,
  inputs: NozzleCfdInputs,
  gamma: number,
  rGas: number
): ConservativeState {
  const residual = emptyResidual(state.rho.length);
  const faceY = mesh.dy;
  const faceX = mesh.dx;

  for (let j = 0; j < mesh.ny; j += 1) {
    for (let i = 0; i < mesh.nx; i += 1) {
      const index = cellIndex(i, j, mesh);
      if (!mesh.inside[index]) continue;

      const center = conservativeAt(state, index);
      const right = neighborConserved(state, mesh, geometry, inputs, i, j, 1, 0, gamma, rGas);
      const left = neighborConserved(state, mesh, geometry, inputs, i, j, -1, 0, gamma, rGas);
      const top = neighborConserved(state, mesh, geometry, inputs, i, j, 0, 1, gamma, rGas);
      const bottom = neighborConserved(state, mesh, geometry, inputs, i, j, 0, -1, gamma, rGas);

      const fRight = rusanovFlux(center, right, { x: 1, y: 0 }, gamma, rGas);
      const fLeft = rusanovFlux(left, center, { x: 1, y: 0 }, gamma, rGas);
      const gTop = rusanovFlux(center, top, { x: 0, y: 1 }, gamma, rGas);
      const gBottom = rusanovFlux(bottom, center, { x: 0, y: 1 }, gamma, rGas);

      residual.rho[index] = faceY * (fRight[0] - fLeft[0]) + faceX * (gTop[0] - gBottom[0]);
      residual.rhoU[index] = faceY * (fRight[1] - fLeft[1]) + faceX * (gTop[1] - gBottom[1]);
      residual.rhoV[index] = faceY * (fRight[2] - fLeft[2]) + faceX * (gTop[2] - gBottom[2]);
      residual.rhoE[index] = faceY * (fRight[3] - fLeft[3]) + faceX * (gTop[3] - gBottom[3]);
    }
  }

  return residual;
}

function residualPoint(iteration: number, residual: ConservativeState, state: ConservativeState, mesh: CfdMesh, dt: number): NozzleCfdResidualPoint {
  let continuity = 0;
  let momentum = 0;
  let yMomentum = 0;
  let energy = 0;
  let active = 0;
  const volumeScale = dt / Math.max(mesh.dx * mesh.dy, 1e-18);
  for (let index = 0; index < residual.rho.length; index += 1) {
    if (!mesh.inside[index]) continue;
    continuity += volumeScale * Math.abs(residual.rho[index]) / Math.max(Math.abs(state.rho[index]), RHO_MIN);
    momentum += volumeScale * Math.abs(residual.rhoU[index]) / Math.max(Math.abs(state.rhoU[index]), 1);
    yMomentum += volumeScale * Math.abs(residual.rhoV[index]) / Math.max(Math.abs(state.rhoV[index]), 1);
    energy += volumeScale * Math.abs(residual.rhoE[index]) / Math.max(Math.abs(state.rhoE[index]), 1);
    active += 1;
  }
  const scale = Math.max(active, 1);
  return {
    iteration,
    continuity: Number((continuity / scale).toExponential(3)),
    momentum: Number((momentum / scale).toExponential(3)),
    yMomentum: Number((yMomentum / scale).toExponential(3)),
    energy: Number((energy / scale).toExponential(3))
  };
}

function enforcePositivity(state: ConservativeState, index: number, gamma: number, rGas: number) {
  const primitive = computePrimitive(state, index, gamma, rGas);
  const rho = Math.max(primitive.rho, RHO_MIN);
  const p = Math.max(primitive.p, PRESSURE_MIN);
  const t = Math.max(p / (rho * rGas), TEMP_MIN);
  const repaired: Primitive = {
    ...primitive,
    rho,
    p,
    t,
    a: Math.sqrt(gamma * rGas * t)
  };
  repaired.mach = Math.hypot(repaired.u, repaired.v) / Math.max(repaired.a, 1);
  repaired.e = repaired.p / ((gamma - 1) * repaired.rho) + 0.5 * (repaired.u * repaired.u + repaired.v * repaired.v);
  writeConservative(state, index, conservativeFromPrimitive(repaired, gamma));
}

export function updateConservativeStateByFluxDivergence(
  state: ConservativeState,
  residual: ConservativeState,
  mesh: CfdMesh,
  dt: number,
  gamma: number,
  rGas: number
) {
  const volume = mesh.dx * mesh.dy;
  const next = makeState(state.rho.length);

  for (let index = 0; index < state.rho.length; index += 1) {
    if (!mesh.inside[index]) continue;
    next.rho[index] = state.rho[index] - (dt / volume) * residual.rho[index];
    next.rhoU[index] = state.rhoU[index] - (dt / volume) * residual.rhoU[index];
    next.rhoV[index] = state.rhoV[index] - (dt / volume) * residual.rhoV[index];
    next.rhoE[index] = state.rhoE[index] - (dt / volume) * residual.rhoE[index];
    enforcePositivity(next, index, gamma, rGas);
  }

  return next;
}

function hasConverged(point: NozzleCfdResidualPoint, first: NozzleCfdResidualPoint | undefined) {
  if (!first) return false;
  const absolute = point.continuity < 1e-5 && point.momentum < 1e-5 && (point.yMomentum ?? 0) < 1e-5 && point.energy < 1e-5;
  const relative = point.continuity < first.continuity * 0.08 &&
    point.momentum < first.momentum * 0.08 &&
    (point.yMomentum ?? 0) < (first.yMomentum ?? 1) * 0.08 &&
    point.energy < first.energy * 0.08;
  return absolute || relative;
}

function numericalHealth(state: ConservativeState, mesh: CfdMesh, gamma: number, rGas: number) {
  let minimumDensityKgM3 = Number.POSITIVE_INFINITY;
  let minimumPressurePa = Number.POSITIVE_INFINITY;
  let nanDetected = false;
  for (let index = 0; index < state.rho.length; index += 1) {
    if (!mesh.inside[index]) continue;
    const primitive = computePrimitive(state, index, gamma, rGas);
    const values = [primitive.rho, primitive.u, primitive.v, primitive.p, primitive.t, primitive.e, primitive.a, primitive.mach];
    if (values.some((value) => !Number.isFinite(value))) nanDetected = true;
    minimumDensityKgM3 = Math.min(minimumDensityKgM3, primitive.rho);
    minimumPressurePa = Math.min(minimumPressurePa, primitive.p);
  }
  return {
    minimumDensityKgM3: Number((Number.isFinite(minimumDensityKgM3) ? minimumDensityKgM3 : 0).toExponential(4)),
    minimumPressurePa: Number((Number.isFinite(minimumPressurePa) ? minimumPressurePa : 0).toExponential(4)),
    nanDetected
  };
}

function conservationErrorFromResidual(residual: ConservativeState, state: ConservativeState, mesh: CfdMesh) {
  let imbalance = 0;
  let conservedMagnitude = 0;
  for (let index = 0; index < residual.rho.length; index += 1) {
    if (!mesh.inside[index]) continue;
    imbalance += Math.abs(residual.rho[index]) + Math.abs(residual.rhoU[index]) + Math.abs(residual.rhoV[index]) + Math.abs(residual.rhoE[index]);
    conservedMagnitude += Math.abs(state.rho[index]) + Math.abs(state.rhoU[index]) + Math.abs(state.rhoV[index]) + Math.abs(state.rhoE[index]);
  }
  return Number((imbalance / Math.max(conservedMagnitude, 1e-12)).toExponential(4));
}

export function runFiniteVolumeSolver(inputs: NozzleCfdInputs, geometry: NozzleGeometry, mesh: CfdMesh): SolverResult {
  const startedAt = performance.now();
  const gamma = clamp(inputs.gamma, 1.05, 1.67);
  const rGas = gasConstant(inputs);
  let state = initializeConservativeState(inputs, geometry, mesh, gamma, rGas);
  const residuals: NozzleCfdResidualPoint[] = [];
  const iterationBudget = inputs.meshDensity === "research" ? 1800 : inputs.meshDensity === "fine" ? 1300 : inputs.meshDensity === "coarse" ? 900 : 1100;
  const cfl = inputs.meshDensity === "research" ? 0.18 : inputs.meshDensity === "fine" ? 0.2 : inputs.meshDensity === "coarse" ? 0.24 : 0.22;
  let converged = false;
  let lastDt = 0;
  let maximumCfl = 0;
  let conservationError = Number.POSITIVE_INFINITY;
  let positivityAbort = false;
  let nanDetected = false;
  const audit = {
    computePrimitive: false,
    physicalFluxX: false,
    physicalFluxY: false,
    computeFaceFluxes: false,
    rusanovFlux: false,
    computeCflDt: false,
    applyBoundaryConditions: false,
    updateConservativeStateByFluxDivergence: false,
    computeResiduals: false
  };

  for (let iteration = 1; iteration <= iterationBudget; iteration += 1) {
    applyBoundaryConditions(state, mesh, inputs, geometry, gamma, rGas);
    audit.applyBoundaryConditions = true;
    const dt = computeCflDt(state, mesh, cfl, gamma, rGas);
    audit.computePrimitive = true;
    audit.computeCflDt = true;
    lastDt = dt;
    maximumCfl = Math.max(maximumCfl, dt * maxWaveSpeed(state, mesh, gamma, rGas) / Math.min(mesh.dx, mesh.dy));
    const healthBefore = numericalHealth(state, mesh, gamma, rGas);
    if (healthBefore.nanDetected || healthBefore.minimumDensityKgM3 <= 0 || healthBefore.minimumPressurePa <= 0) {
      positivityAbort = healthBefore.minimumDensityKgM3 <= 0 || healthBefore.minimumPressurePa <= 0;
      nanDetected = healthBefore.nanDetected;
      break;
    }
    const fluxImbalance = computeResidualsFromFluxImbalance(state, mesh, geometry, inputs, gamma, rGas);
    audit.computeFaceFluxes = true;
    audit.physicalFluxX = true;
    audit.physicalFluxY = true;
    audit.rusanovFlux = true;
    audit.computeResiduals = true;
    conservationError = conservationErrorFromResidual(fluxImbalance, state, mesh);
    const point = iteration === 1 || iteration % 10 === 0 || iteration === iterationBudget
      ? residualPoint(iteration, fluxImbalance, state, mesh, dt)
      : null;
    if (point) {
      residuals.push(point);
      converged = hasConverged(point, residuals[0]);
      if (converged && iteration > 40) break;
    }
    state = updateConservativeStateByFluxDivergence(state, fluxImbalance, mesh, dt, gamma, rGas);
    audit.updateConservativeStateByFluxDivergence = true;
  }

  const finalCfl = lastDt > 0 ? lastDt * maxWaveSpeed(state, mesh, gamma, rGas) / Math.min(mesh.dx, mesh.dy) : cfl;
  const finalHealth = numericalHealth(state, mesh, gamma, rGas);
  nanDetected = nanDetected || finalHealth.nanDetected;
  positivityAbort = positivityAbort || finalHealth.minimumDensityKgM3 <= 0 || finalHealth.minimumPressurePa <= 0;
  return {
    state,
    residuals,
    iterations: residuals.at(-1)?.iteration ?? iterationBudget,
    converged,
    finalCfl: Number(finalCfl.toFixed(4)),
    runtimeMs: Math.round(performance.now() - startedAt),
    maximumCfl: Number(Math.max(maximumCfl, finalCfl).toFixed(4)),
    minimumDensityKgM3: finalHealth.minimumDensityKgM3,
    minimumPressurePa: finalHealth.minimumPressurePa,
    conservationError: Number.isFinite(conservationError) ? conservationError : 0,
    positivityAbort,
    nanDetected,
    audit
  };
}

function maxWaveSpeed(state: ConservativeState, mesh: CfdMesh, gamma: number, rGas: number) {
  let maxSpeed = 1;
  for (let index = 0; index < state.rho.length; index += 1) {
    if (!mesh.inside[index]) continue;
    const primitive = computePrimitive(state, index, gamma, rGas);
    maxSpeed = Math.max(maxSpeed, Math.abs(primitive.u) + Math.abs(primitive.v) + primitive.a);
  }
  return maxSpeed;
}

export function primitiveCell(index: number, state: ConservativeState, inputs: NozzleCfdInputs) {
  return computePrimitive(state, index, clamp(inputs.gamma, 1.05, 1.67), gasConstant(inputs));
}
